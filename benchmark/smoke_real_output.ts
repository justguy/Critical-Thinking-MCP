#!/usr/bin/env npx tsx
/**
 * Tiny SMOKE run for the real-output harness (plan §1a verification step).
 *
 * Drives the local CLI adapter on a SMALL number of seed tasks (default 3) for
 * the baseline condition, grades each with its objective oracle, and prints a
 * transcript. This is the "actually run real outputs through the oracle" check.
 *
 * It is deliberately tiny to keep CLI call volume low. The full, statistically
 * powered corpus run (powered n + confidence interval) is the Phase-1a REMAINDER
 * and is NOT performed here.
 *
 * Usage:
 *   npx tsx benchmark/smoke_real_output.ts            # 3 tasks, baseline
 *   BENCH_SMOKE_N=2 npx tsx benchmark/smoke_real_output.ts
 */

import { runRealOutput, summarizeReal, type ModelCondition } from './real_output_runner.js';

const N = Number(process.env.BENCH_SMOKE_N ?? '3');
const MODEL = process.env.BENCH_MODEL ?? 'haiku';
const CONDITION = (process.env.BENCH_CONDITION ?? 'baseline') as ModelCondition;

console.log(`SMOKE real-output run: model=${MODEL} condition=${CONDITION} n=${N}`);
console.log('Driving local CLI adapter from a neutral cwd (no MCP, no tools)...\n');

const rows = runRealOutput({
  model: MODEL,
  conditions: [CONDITION],
  limit: N,
  onRow: (r) => {
    const status = r.adapter_error ? 'ADAPTER_ERROR' : r.correct ? 'CORRECT' : 'DEFECT';
    console.log(`── ${r.task_id} [${r.suite}/${r.category}] → ${status}`);
    console.log(`   answer: ${JSON.stringify(r.answer_excerpt)}`);
    if (r.oracle_reasons.length > 0) console.log(`   oracle: ${r.oracle_reasons.join('; ')}`);
    console.log('');
  },
});

console.log('── SUMMARY (by condition × suite) ──');
for (const s of summarizeReal(rows)) {
  console.log(
    `  ${s.condition}/${s.suite}: n=${s.n} graded=${s.graded} ` +
    `defective=${s.defective} density=${(s.defect_density * 100).toFixed(1)}% errors=${s.adapter_errors}`,
  );
}

const anyReal = rows.some(r => !r.adapter_error);
const anyGraded = rows.some(r => !r.adapter_error);
console.log(`\nReal outputs flowed: ${anyReal}; graded by objective oracle: ${anyGraded}`);
