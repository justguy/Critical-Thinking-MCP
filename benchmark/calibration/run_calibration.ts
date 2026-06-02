#!/usr/bin/env npx tsx
/**
 * Difficulty CALIBRATION run (plan §1a; tracker dvp-p1a-run "calibration slice").
 *
 * GOAL: BEFORE scaling to a Tier-B (~150) corpus, confirm the HARDER calibration
 * corpus (./suites/calibration.ts) puts a STRONG (shipped-class) model in the
 * 30-60% defect band on the failure-prone suite — and that clean-control does NOT
 * false-trigger. If difficulty is healthy, the orchestrator scales; if not, we
 * tune the corpus first.
 *
 * MODEL: SONNET (the shipped class), driven through the SAME CLI adapter the
 * Phase-1a harness uses (benchmark/model_adapter.ts). CLI-ONLY, no billed API:
 * the adapter spawns the local `claude` binary from a neutral cwd with an EMPTY
 * MCP surface and never reads ANTHROPIC_API_KEY.
 *
 * CALL VOLUME: one `baseline` call per task (no `prompted` arm here) = ~38 calls.
 * This is a calibration slice, NOT the full powered run.
 *
 * GRADING: objective oracles only (gold_answer / source_span / structured_constraint).
 *
 * Usage:
 *   BENCH_REAL_MODEL=1 BENCH_MODEL=sonnet npx tsx benchmark/calibration/run_calibration.ts
 *
 * Guard: refuses to run unless BENCH_REAL_MODEL=1 (so it never fires by accident).
 * Writes a JSON transcript artifact under benchmark/calibration/.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { runModel, type AdapterBackend } from '../model_adapter.js';
import { gradeWithOracle } from '../oracles.js';
import { calibrationTasks, CALIBRATION_SUITES } from '../suites/calibration.js';
import type { BenchTask, SuiteName } from '../suites/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));

interface CalRow {
  task_id: string;
  suite: SuiteName;
  category: BenchTask['category'];
  oracle_kind: string;
  model: string;
  backend: AdapterBackend;
  /** REAL model output — never synthetic. */
  synthetic: false;
  correct: boolean;
  high_sev_defects: number;
  oracle_reasons: string[];
  adapter_error: boolean;
  adapter_error_detail?: string;
  answer_excerpt: string;
  /** Hash of the full answer text for reproducibility/audit. */
  answer_hash: string;
}

interface SuiteSummary {
  suite: SuiteName;
  n: number;
  graded: number;           // excludes adapter errors
  defective: number;        // graded rows with high_sev_defects > 0
  defect_density: number;   // defective / graded
  adapter_errors: number;
}

function sha256(s: string): string {
  return 'sha256:' + createHash('sha256').update(s).digest('hex');
}

function summarize(rows: CalRow[]): SuiteSummary[] {
  const out: SuiteSummary[] = [];
  const suites = Object.keys(CALIBRATION_SUITES) as SuiteName[];
  for (const suite of suites) {
    const subset = rows.filter(r => r.suite === suite);
    const graded = subset.filter(r => !r.adapter_error);
    const defective = graded.filter(r => r.high_sev_defects > 0).length;
    out.push({
      suite,
      n: subset.length,
      graded: graded.length,
      defective,
      defect_density: graded.length > 0 ? defective / graded.length : 0,
      adapter_errors: subset.filter(r => r.adapter_error).length,
    });
  }
  return out;
}

function main(): void {
  if (process.env.BENCH_REAL_MODEL !== '1') {
    console.error('Refusing to run: set BENCH_REAL_MODEL=1 to make a real (CLI) calibration run.');
    process.exit(2);
  }
  const model = process.env.BENCH_MODEL ?? 'sonnet';
  const backend = (process.env.BENCH_BACKEND as AdapterBackend) ?? 'claude';
  const timeoutMs = Number(process.env.BENCH_TIMEOUT_MS ?? '60000');

  const tasks = calibrationTasks();
  console.log(`CALIBRATION run: model=${model} backend=${backend} tasks=${tasks.length} (baseline condition only)`);
  console.log('Driving local CLI adapter from a neutral cwd (empty MCP surface, no tools, no API key)...\n');

  // Capture the exact invocation argv for the first call as the reproducible record.
  let invocationRecord: string[] = [];

  const rows: CalRow[] = [];
  let i = 0;
  for (const task of tasks) {
    i++;
    const out = runModel(task.prompt, model, { backend, timeoutMs });
    if (i === 1) invocationRecord = out.invocation;

    let correct = false;
    let highSev = 0;
    let reasons: string[] = [];
    if (out.error) {
      reasons = [out.error_detail ?? 'adapter_error'];
    } else {
      const v = gradeWithOracle(task.oracle, out.text);
      correct = v.correct;
      highSev = v.high_sev_defects;
      reasons = v.reasons;
    }

    const row: CalRow = {
      task_id: task.id,
      suite: task.suite,
      category: task.category,
      oracle_kind: task.oracle.kind,
      model: out.model,
      backend: out.backend,
      synthetic: false,
      correct,
      high_sev_defects: highSev,
      oracle_reasons: reasons,
      adapter_error: out.error,
      adapter_error_detail: out.error ? out.error_detail : undefined,
      answer_excerpt: out.text.slice(0, 240),
      answer_hash: sha256(out.text),
    };
    rows.push(row);

    const status = row.adapter_error ? 'ADAPTER_ERROR' : row.correct ? 'CORRECT' : 'DEFECT';
    console.log(`[${i}/${tasks.length}] ${task.id} [${task.suite}/${task.oracle.kind}] -> ${status}`);
    console.log(`   answer: ${JSON.stringify(row.answer_excerpt)}`);
    if (reasons.length > 0) console.log(`   oracle: ${reasons.join('; ')}`);
  }

  const perSuite = summarize(rows);

  // Failure-prone defect density is the calibration target band.
  const fp = perSuite.find(s => s.suite === 'failure-prone')!;
  const cc = perSuite.find(s => s.suite === 'clean-control')!;
  const realistic = perSuite.find(s => s.suite === 'realistic-distribution')!;

  console.log('\n── PER-SUITE DEFECT DENSITY (Sonnet, baseline) ──');
  for (const s of perSuite) {
    console.log(
      `  ${s.suite}: n=${s.n} graded=${s.graded} defective=${s.defective} ` +
      `density=${(s.defect_density * 100).toFixed(1)}% adapter_errors=${s.adapter_errors}`,
    );
  }

  const fpInBand = fp.graded > 0 && fp.defect_density >= 0.30 && fp.defect_density <= 0.60;
  const ccClean = cc.graded > 0 && cc.defect_density <= 0.02;
  const recommendation =
    fpInBand && ccClean
      ? 'SCALE: failure-prone density is in the 30-60% band and clean-control false-trigger <=2%. Corpus is hard enough to scale to Tier-B (~150) as-is.'
      : !ccClean
      ? `TUNE FIRST: clean-control false-trigger rate is ${(cc.defect_density * 100).toFixed(1)}% (> 2%). Investigate before scaling (oracle/task false positives invalidate the measurement).`
      : fp.defect_density < 0.30
      ? `TUNE FIRST (too easy): failure-prone density ${(fp.defect_density * 100).toFixed(1)}% is below 30%. Make failure-prone tasks harder before scaling.`
      : `TUNE FIRST (too hard): failure-prone density ${(fp.defect_density * 100).toFixed(1)}% is above 60%. This is a torture set, not a representative one; ease the hardest tasks before scaling.`;

  const artifact = {
    kind: 'calibration_run',
    plan_ref: 'docs/designs/DETERMINISTIC_VALUE_PLAN.md:119-132',
    tracker_task: 'dvp-p1a-run',
    generated_at: new Date().toISOString(),
    model,
    backend,
    condition: 'baseline',
    cli_invocation_example: invocationRecord,
    total_tasks: rows.length,
    per_suite: perSuite,
    target_band: { failure_prone_defect_density: [0.3, 0.6], clean_control_false_trigger_max: 0.02 },
    failure_prone_in_band: fpInBand,
    clean_control_clean: ccClean,
    realistic_defect_density: realistic.defect_density,
    recommendation,
    rows,
  };

  mkdirSync(HERE, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = join(HERE, `calibration_${model}_${stamp}.json`);
  writeFileSync(outPath, JSON.stringify(artifact, null, 2));

  console.log(`\nClean-control false-trigger rate: ${(cc.defect_density * 100).toFixed(1)}% (target <=2%)`);
  console.log(`Failure-prone defect density: ${(fp.defect_density * 100).toFixed(1)}% (target 30-60%)`);
  console.log(`\nRECOMMENDATION: ${recommendation}`);
  console.log(`\nTranscript artifact: ${outPath}`);
}

main();
