/**
 * Phase 5 — the LIVE-REALISM arm (BUILT here; NOT executed in this chunk).
 *
 * Pre-registration: PHASE5_PREREGISTRATION.md §2 (live-realism arm), §3
 * (natural_violation_rate), §6 (realism_false_block is THE friction input to the
 * kill rule). For each scenario it:
 *   1. prompts the model SINGLE-SHOT (no spine) with the scenario's surface_task,
 *      asking for ONE JSON deliverable carrying its own artifacts
 *      ({answer_text, sources?, claims?, structured_answer?, numeric_derivation?,
 *      arithmetic_checks?}),
 *   2. grades that deliverable's artifacts against the host contract by GROUND TRUTH
 *      (gradeAgainstContract — INDEPENDENT of the gate), then
 *   3. runs the SAME deliverable through the REAL ct-enforce (runGateOnce).
 *
 * It records:
 *   - natural_violation_rate : deliverables whose artifacts VIOLATE the host
 *     contract (graded by ground truth) / total — the defect-opportunity reality.
 *   - realism_false_block    : good-faith deliverables that DO satisfy the
 *     contract's intent yet the gate REJECTs / total-satisfies-intent — the REAL
 *     friction input to the kill rule.
 *   - spine_observed         : did ANY deliverable need >1 generation to RELEASE.
 *
 * Single-shot ONLY: each deliverable is one generation. We DO NOT retry to coax a
 * RELEASE — a good-faith deliverable that the gate blocks is recorded as a
 * realism_false_block (the friction signal), and generations_to_release stays 1.
 * Reaching RELEASE only by re-generating would be the spine the design forbids.
 *
 * main() runs ONLY on direct execution (import.meta guard). Importing this module
 * (e.g. from a test) makes NO model calls and spawns NO CLI.
 *
 * Run (NOT in this chunk):  node --import tsx benchmark/phase5/run_realism.ts
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { PHASE5_SCENARIOS, type Phase5Scenario } from './scenarios.js';
import { gradeAgainstContract } from './ground_truth.js';
import { runGateOnce } from './run_gate.js';
import { phase5Metrics, evaluateKillRule, type GateRow, type RealismRow } from './metrics.js';
import { runModel, type ModelOutput } from '../model_adapter.js';
import type { DeliverableArtifacts } from '../../src/host/enforcement_host.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(HERE, 'realism_run.json');
const DEFAULT_MODEL = 'haiku';

/**
 * The exact JSON shape each deliverable_type must return, so the model reliably emits
 * ONE parseable object carrying the fields the host contract checks. Keyed by the
 * scenario's deliverable_type (financial/config -> structured_answer; RAG/freshness ->
 * sources + claims; compliance -> answer_text only).
 */
function deliverableShape(scenario: Phase5Scenario): string[] {
  switch (scenario.deliverable_type) {
    case 'financial_summary':
    case 'config_spec':
      return [
        'Return EXACTLY these keys:',
        '  "answer_text"       (string): one sentence stating the values you are shipping.',
        '  "structured_answer" (object): the fields the request asks for, e.g. { "field_name": value }.',
      ];
    case 'rag_customer_answer':
      return [
        'Return EXACTLY these keys:',
        '  "answer_text" (string): the answer, grounded ONLY in the source text below.',
        '  "sources"     (array):  [{ "id": "<source id>", "text": "<the source text you relied on>", "origin": "host_supplied" }].',
        '  "claims"      (array):  one entry per factual claim:',
        '                [{ "claim_id": "<id>", "claim_text": "<the claim>", "source_id": "<the source id>",',
        '                   "quoted_span": "<a VERBATIM substring of that source text that supports it>",',
        '                   "supporting_token": "<the key token>", "claim_kind": "status" | "numeric" }].',
      ];
    case 'compliance_format':
      // Freshness scenarios are typed compliance_format but need dated sources + claims.
      if (scenario.host_contract.freshness) {
        return [
          'Return EXACTLY these keys:',
          '  "answer_text" (string): the summary/quote, grounded ONLY in the snapshot below.',
          '  "sources"     (array):  [{ "id": "<id>", "text": "<the snapshot text>", "origin": "host_supplied",',
          '                            "published_at": "<the snapshot ISO-8601 timestamp>" }].',
          '  "claims"      (array):  [{ "claim_id": "<id>", "claim_text": "<the claim>", "source_id": "<id>",',
          '                            "quoted_span": "<a VERBATIM substring of the snapshot>",',
          '                            "supporting_token": "<key token>", "claim_kind": "status" | "numeric" }].',
        ];
      }
      return [
        'Return EXACTLY this key:',
        '  "answer_text" (string): the drafted text, including every disclosure the request requires verbatim.',
      ];
  }
}

/** Build the single-shot deliverable prompt for a scenario (no spine, one JSON). */
export function buildRealismPrompt(scenario: Phase5Scenario): string {
  return [
    scenario.surface_task,
    '',
    ...deliverableShape(scenario),
    '',
    'Output ONLY a single JSON object, no prose, no code fence. Do not add any keys',
    'beyond those listed. Start your response with { and end it with }.',
  ].join('\n');
}

/**
 * Parse the model's single-shot output into a DeliverableArtifacts bundle. Returns
 * null on a non-answer / unparseable output (recorded as a no_answer ground truth).
 * Prefers a fenced ```json block, else the LAST balanced object literal in the text.
 */
export function parseDeliverable(text: string): DeliverableArtifacts | null {
  if (!text || !text.trim()) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1]);
  // Last balanced top-level object literal.
  const start = text.lastIndexOf('{');
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          candidates.push(text.slice(start, i + 1));
          break;
        }
      }
    }
  }
  candidates.push(text);
  for (const c of candidates) {
    try {
      const obj = JSON.parse(c.trim());
      if (obj && typeof obj === 'object' && typeof obj.answer_text === 'string' && obj.answer_text.length > 0) {
        return obj as DeliverableArtifacts;
      }
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

export interface RealismResult {
  realism_rows: RealismRow[];
  /** Per-scenario detail for the archive (raw model output, parse, grade, gate). */
  details: Array<{
    scenario_id: string;
    deliverable_type: string;
    model_error: boolean;
    parsed: boolean;
    ground_truth: RealismRow['ground_truth'];
    ground_truth_failures: string[];
    gate_decision: string;
    gate_reason: string;
  }>;
}

/**
 * Run the live arm over the corpus. `runModelFn` is injectable so a test can drive
 * it with a stub (no real CLI). By default it spawns the real `claude` CLI via the
 * model adapter — which is why this is NEVER called in this chunk's tests.
 */
export function runRealismArm(
  scenarios: Phase5Scenario[] = PHASE5_SCENARIOS,
  runModelFn: (prompt: string, model: string) => ModelOutput = (p, m) => runModel(p, m),
  model: string = DEFAULT_MODEL,
): RealismResult {
  const realism_rows: RealismRow[] = [];
  const details: RealismResult['details'] = [];

  for (const s of scenarios) {
    const prompt = buildRealismPrompt(s);
    const out = runModelFn(prompt, model);
    const deliverable = out.error ? null : parseDeliverable(out.text);

    if (!deliverable) {
      realism_rows.push({
        scenario_id: s.id,
        deliverable_type: s.deliverable_type,
        ground_truth: 'no_answer',
        decision: 'ERROR',
        reason: out.error ? 'model_error' : 'unparseable_deliverable',
      });
      details.push({
        scenario_id: s.id,
        deliverable_type: s.deliverable_type,
        model_error: out.error,
        parsed: false,
        ground_truth: 'no_answer',
        ground_truth_failures: [],
        gate_decision: 'ERROR',
        gate_reason: out.error ? 'model_error' : 'unparseable_deliverable',
      });
      continue;
    }

    // GROUND TRUTH first (independent of the gate).
    const gt = gradeAgainstContract(s.host_contract, deliverable, s.eval_time);
    const groundTruth: RealismRow['ground_truth'] = gt.satisfies ? 'satisfies_intent' : 'violates';

    // Then the REAL gate — single shot, no retry/spine.
    const gate = runGateOnce(s.host_contract, deliverable, s.eval_time);
    const generationsToRelease = gate.decision === 'RELEASE' ? 1 : undefined;

    realism_rows.push({
      scenario_id: s.id,
      deliverable_type: s.deliverable_type,
      ground_truth: groundTruth,
      decision: gate.decision,
      reason: gate.reason,
      generations_to_release: generationsToRelease,
    });
    details.push({
      scenario_id: s.id,
      deliverable_type: s.deliverable_type,
      model_error: false,
      parsed: true,
      ground_truth: groundTruth,
      ground_truth_failures: gt.failures,
      gate_decision: gate.decision,
      gate_reason: gate.reason,
    });
  }

  return { realism_rows, details };
}

function main(): void {
  // The live arm: spawns the real model CLI per scenario. Single-shot, no spine.
  const { realism_rows, details } = runRealismArm();

  // Re-run the curated gate so the saved metrics carry BOTH arms (the kill rule
  // needs the realism friction input). Imported lazily to keep this module's
  // top-level import-safe (no spawning on import).
  const curatedRows: GateRow[] = [];
  for (const s of PHASE5_SCENARIOS) {
    const sg = runGateOnce(s.host_contract, s.satisfying, s.eval_time);
    curatedRows.push({
      scenario_id: s.id,
      deliverable_type: s.deliverable_type,
      ground_truth: 'satisfying',
      decision: sg.decision,
      reason: sg.reason,
      blocking_mechanisms: sg.blocking_mechanisms,
      heavy_artifact_spine: s.heavy_artifact_spine === true,
    });
    for (const v of s.violating) {
      const vg = runGateOnce(s.host_contract, v.artifacts, s.eval_time);
      curatedRows.push({
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

  const contracts = PHASE5_SCENARIOS.map(s => s.host_contract);
  const metrics = phase5Metrics(curatedRows, realism_rows, contracts);
  const killRule = evaluateKillRule(metrics);

  const output = {
    generated_at: new Date().toISOString(),
    model: DEFAULT_MODEL,
    scenario_count: PHASE5_SCENARIOS.length,
    realism_rows,
    details,
    metrics,
    kill_rule: killRule,
  };
  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

  const nvr = metrics.natural_violation_rate;
  const rfb = metrics.realism_false_block;
  process.stdout.write(
    `Phase 5 live-realism arm -> ${OUT_PATH}\n` +
      (nvr ? `  natural_violation_rate: ${nvr.violations}/${nvr.total} = ${nvr.rate.toFixed(3)}\n` : '') +
      (rfb
        ? `  realism_false_block:    ${rfb.blocked}/${rfb.total_satisfies_intent} = ${rfb.rate.toFixed(3)}\n`
        : '') +
      `  spine_required:         ${metrics.spine_required}\n` +
      `  ship_worthy:            ${killRule.ship_worthy}` +
      (killRule.reasons.length ? ` (${killRule.reasons.join('; ')})` : '') +
      '\n',
  );
}

// Direct-execution guard: the model CLI / gate spawn only when run as a script.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
