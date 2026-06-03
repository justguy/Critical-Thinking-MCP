/**
 * Phase 4 STEP 4 — re-report the existing live_gate_score numbers WITH honest
 * Wilson 95% CIs (PHASE4_PREREGISTRATION.md STEP 4: "re-report existing
 * live_gate_score numbers WITH CIs — false_block 0/41 -> Wilson [0, 0.086]").
 *
 * This is PURE: it loads benchmark/reports/live_gate_score.json, attaches Wilson
 * intervals to the three block-accounting proportions, prints them, and writes
 * benchmark/phase4/live_gate_score_with_cis.json. NO model / claude-CLI calls.
 *
 * Per Amendment A1 / the prereg: these are GATE-MECHANICS sanity numbers on the
 * INJECTED corpus. They measure whether the deterministic gate blocks known-wrong
 * mutants and passes known-clean controls — they are NOT a measurement of
 * fabrication-catching on live model output. The label below says so explicitly.
 *
 * Run: npx tsx benchmark/phase4/report_gate_cis.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { proportionReport } from './stats.js';

const LABEL = 'gate-mechanics sanity (injected corpus; NOT fabrication-catching)';

const inputPath = fileURLToPath(
  new URL('../../benchmark/reports/live_gate_score.json', import.meta.url),
);
const outputPath = fileURLToPath(
  new URL('../../benchmark/phase4/live_gate_score_with_cis.json', import.meta.url),
);

interface GateScore {
  metrics: {
    total_mutated: number;
    blocked_mutated: number;
    total_correct: number;
    blocked_correct: number;
    block_recall: number;
    false_block_rate: number;
    block_precision: number;
  };
}

const src = JSON.parse(readFileSync(inputPath, 'utf-8')) as GateScore;
const m = src.metrics;

// block_recall = blocked_mutated / total_mutated (106/106).
const blockRecall = proportionReport(m.blocked_mutated, m.total_mutated);

// false_block_rate = blocked_correct / total_correct (0/41) — reported WITH its
// Wilson upper bound, never as a certain 0.
const falseBlock = proportionReport(m.blocked_correct, m.total_correct);

// block_precision = true blocks / all blocks
//                 = blocked_mutated / (blocked_mutated + blocked_correct) (106/106).
const allBlocks = m.blocked_mutated + m.blocked_correct;
const blockPrecision = proportionReport(m.blocked_mutated, allBlocks);

const report = {
  kind: 'live_gate_score_with_cis',
  generated_at: new Date().toISOString(),
  label: LABEL,
  source: 'benchmark/reports/live_gate_score.json',
  ci_method: 'Wilson score interval, z=1.96 (95%)',
  metrics: {
    block_recall: {
      successes: m.blocked_mutated,
      n: m.total_mutated,
      rate: blockRecall.rate,
      ci: blockRecall.ci,
    },
    false_block_rate: {
      successes: m.blocked_correct,
      n: m.total_correct,
      rate: falseBlock.rate,
      ci: falseBlock.ci,
    },
    block_precision: {
      successes: m.blocked_mutated,
      n: allBlocks,
      rate: blockPrecision.rate,
      ci: blockPrecision.ci,
    },
  },
};

writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');

const fmt = (x: number) => x.toFixed(4);
const line = (name: string, r: { successes: number; n: number; rate: number; ci: [number, number] }) =>
  `  ${name.padEnd(18)} ${r.successes}/${r.n} = ${fmt(r.rate)}  Wilson95% [${fmt(r.ci[0])}, ${fmt(r.ci[1])}]`;

console.log(LABEL);
console.log('CI method: Wilson score interval, z=1.96 (95%)');
console.log(line('block_recall', report.metrics.block_recall));
console.log(line('false_block_rate', report.metrics.false_block_rate));
console.log(line('block_precision', report.metrics.block_precision));
console.log(`\nwrote ${outputPath}`);
