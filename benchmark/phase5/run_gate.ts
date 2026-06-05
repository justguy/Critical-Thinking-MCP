/**
 * Phase 5 — the curated single-call gate runner.
 *
 * Pipes EACH (host_contract, deliverable) — satisfying AND violating — through the
 * REAL ct-enforce CLI (`node dist/host/cli.js`, JSON on stdin, decision on stdout)
 * exactly once per deliverable. NO multi-turn artifact spine: each deliverable
 * carries its own artifacts produced as one bundle. DETERMINISTIC: no model calls,
 * no network. From the rows it computes:
 *   - false_release_reduction = REJECTED(violating) / total(violating)
 *     (= block-recall on the would-be false releases),
 *   - curated_false_block      = REJECTED(satisfying) / total(satisfying) (sanity),
 * and records the blocking reason/code per row. Saves benchmark/phase5/gate_run.json.
 *
 * main() runs ONLY on direct execution (guarded by import.meta vs process.argv[1]),
 * so importing this module from a test never spawns the CLI.
 *
 * Run:  node --import tsx benchmark/phase5/run_gate.ts
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { PHASE5_SCENARIOS, type Phase5Scenario } from './scenarios.js';
import { phase5Metrics, evaluateKillRule, type GateRow } from './metrics.js';
import type { ContractSpec, DeliverableArtifacts } from '../../src/host/enforcement_host.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CLI_PATH = resolve(REPO_ROOT, 'dist', 'host', 'cli.js');
const OUT_PATH = resolve(HERE, 'gate_run.json');

export interface GateCallResult {
  decision: 'RELEASE' | 'REJECT' | 'ERROR';
  reason: string;
  blocking_mechanisms: string[];
  exit_code: number | null;
}

/**
 * Run ONE deliverable through the real ct-enforce CLI. Spawns
 * `node dist/host/cli.js` with the JSON payload on stdin and parses the decision.
 * Throws only on a non-parseable CLI response (an environment fault, not a row).
 */
export function runGateOnce(
  spec: ContractSpec,
  artifacts: DeliverableArtifacts,
  eval_time?: { value: string; authority: 'host' | 'agent' },
  cliPath: string = CLI_PATH,
): GateCallResult {
  const payload = JSON.stringify({ spec, artifacts, eval_time });
  const proc = spawnSync(process.execPath, [cliPath], { input: payload, encoding: 'utf8' });
  if (!proc.stdout) {
    throw new Error(
      `ct-enforce produced no stdout (exit ${proc.status}). stderr: ${(proc.stderr ?? '').slice(0, 500)}`,
    );
  }
  let json: any;
  try {
    json = JSON.parse(proc.stdout);
  } catch (e) {
    throw new Error(`ct-enforce stdout is not JSON: ${proc.stdout.slice(0, 500)}`);
  }
  return {
    decision: json.decision,
    reason: json.reason,
    blocking_mechanisms: Array.isArray(json.blocking_issues)
      ? json.blocking_issues.map((b: any) => b.mechanism)
      : [],
    exit_code: proc.status,
  };
}

/** Turn the whole scenario corpus into curated gate rows via the real CLI. */
export function runCuratedGate(
  scenarios: Phase5Scenario[] = PHASE5_SCENARIOS,
  cliPath: string = CLI_PATH,
): GateRow[] {
  const rows: GateRow[] = [];
  for (const s of scenarios) {
    const sg = runGateOnce(s.host_contract, s.satisfying, s.eval_time, cliPath);
    rows.push({
      scenario_id: s.id,
      deliverable_type: s.deliverable_type,
      ground_truth: 'satisfying',
      decision: sg.decision,
      reason: sg.reason,
      blocking_mechanisms: sg.blocking_mechanisms,
      heavy_artifact_spine: s.heavy_artifact_spine === true,
    });
    for (const v of s.violating) {
      const vg = runGateOnce(s.host_contract, v.artifacts, s.eval_time, cliPath);
      rows.push({
        scenario_id: s.id,
        deliverable_type: s.deliverable_type,
        ground_truth: 'violating',
        violation_label: v.violation_label,
        decision: vg.decision,
        reason: vg.reason,
        blocking_mechanisms: vg.blocking_mechanisms,
      });
    }
  }
  return rows;
}

function main(): void {
  const rows = runCuratedGate();
  const contracts = PHASE5_SCENARIOS.map(s => s.host_contract);
  // No realism rows here — that arm is run separately (run_realism.ts). The kill
  // rule will therefore report the realism arm as missing, which is correct: the
  // curated gate alone cannot decide ship-worthiness.
  const metrics = phase5Metrics(rows, undefined, contracts);
  const killRule = evaluateKillRule(metrics);

  const output = {
    generated_at: new Date().toISOString(),
    cli_path: CLI_PATH,
    scenario_count: PHASE5_SCENARIOS.length,
    rows,
    metrics,
    kill_rule: killRule,
    note:
      'Curated arm only. realism_false_block / natural_violation_rate are filled by ' +
      'run_realism.ts (the live arm). spine_required here reflects only the curated ' +
      'heavy-spine flag.',
  };
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  const fr = metrics.false_release_reduction;
  const cfb = metrics.curated_false_block;
  process.stdout.write(
    `Phase 5 curated gate run -> ${OUT_PATH}\n` +
      `  scenarios:               ${PHASE5_SCENARIOS.length}\n` +
      `  false_release_reduction: ${fr.rejected}/${fr.total} = ${fr.rate.toFixed(3)} ` +
      `(Wilson 95% [${fr.ci[0].toFixed(3)}, ${fr.ci[1].toFixed(3)}])\n` +
      `  curated_false_block:     ${cfb.blocked}/${cfb.total} = ${cfb.rate.toFixed(3)}` +
      (cfb.blocked_ids.length ? ` (blocked: ${cfb.blocked_ids.join(', ')})` : '') +
      `\n  spine_required (curated): ${metrics.spine_required}` +
      (metrics.spine_evidence.curated_heavy_spine_scenarios.length
        ? ` (${metrics.spine_evidence.curated_heavy_spine_scenarios.join(', ')})`
        : '') +
      `\n  host_contract_burden:    ${metrics.host_contract_burden.avg_fields_per_contract.toFixed(2)} fields, ` +
      `${metrics.host_contract_burden.avg_checks_per_contract.toFixed(2)} checks / contract\n`,
  );
}

// Direct-execution guard: only spawn the CLI when run as a script, never on import.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
