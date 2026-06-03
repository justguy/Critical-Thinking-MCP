/**
 * Phase 4 — STEP 5 calibration runner (multi-sample arm-A defect density).
 *
 * Per the prereg §2.1 / Amendment A2: run the ARM-A invocation at k samples/task
 * (default k=8) over HARD_CORPUS, grade with the objective oracles, and report
 * per-suite/-split/-family defect density with Wilson CIs. ACCEPTANCE (read off
 * the report, not auto-enforced here): Haiku failure-prone HOLDOUT suite-mean
 * density in [0.30,0.60]; clean-control density <= 0.02; realistic in [0.05,0.25];
 * Sonnet monotonicity = Sonnet failure-prone density < Haiku by >= 0.10.
 *
 * Arm A is single-shot empty-MCP (the cheap, discriminating baseline) — NOT the
 * multi-turn B/D arms. Run: node --import tsx benchmark/phase4/calibrate.ts \
 *   [--k 8] [--models haiku,sonnet] [--suites failure-prone,clean-control] \
 *   [--split tuning|holdout|all] [--concurrency 5]
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HARD_CORPUS, type Phase4Task } from './corpus.js';
import { armConfig } from './arms.js';
import { runArm } from './arm_adapter.js';
import { gradeArmAnswer } from './grade_answer.js';
import { wilsonInterval } from './stats.js';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const K = parseInt(arg('k', '8'), 10);
const MODELS = arg('models', 'haiku').split(',').map(s => s.trim()).filter(Boolean);
const SUITES = arg('suites', 'all');
const SPLIT = arg('split', 'all');
const CONCURRENCY = parseInt(arg('concurrency', '5'), 10);

let corpus: Phase4Task[] = HARD_CORPUS;
if (SUITES !== 'all') {
  const want = new Set(SUITES.split(',').map(s => s.trim()));
  corpus = corpus.filter(t => want.has(t.suite));
}
if (SPLIT !== 'all') corpus = corpus.filter(t => t.split === SPLIT);

// Build the full job list: (model, task, sampleIndex).
interface Job { model: string; task: Phase4Task; sample: number; }
const jobs: Job[] = [];
for (const model of MODELS) for (const task of corpus) for (let s = 0; s < K; s++) jobs.push({ model, task, sample: s });

interface Row { model: string; id: string; suite: string; split: string; category: string; correct: boolean; defect: boolean; error: boolean; sentinel: string | null; }
const rows: Row[] = [];

async function runJob(job: Job): Promise<void> {
  const opts = armConfig('A', { task: job.task.prompt, model: job.model, caps: { maxOutputTokens: 8000, wallClockMs: 120_000 } });
  const res = await runArm(opts);
  // Type-aware grading on the FIXED instrument (Amendment B1): grade the INTENDED
  // answer per oracle kind (sentinel value for numeric; extracted JSON for
  // constraint; full text for source_span), not a raw text||sentinel blob.
  const verdict = gradeArmAnswer(job.task, res.transcript);
  rows.push({
    model: job.model, id: job.task.id, suite: job.task.suite, split: job.task.split, category: job.task.category,
    correct: verdict.correct, defect: !verdict.correct && !res.error, error: res.error, sentinel: res.transcript.final_answer_sentinel,
  });
}

// Simple concurrency pool.
let done = 0;
async function worker(queue: Job[]): Promise<void> {
  while (queue.length) {
    const job = queue.shift();
    if (!job) break;
    await runJob(job);
    done++;
    if (done % 10 === 0 || done === jobs.length) process.stderr.write(`[calibrate] ${done}/${jobs.length}\n`);
  }
}
const shared = [...jobs];
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, () => worker(shared)));

// Aggregate per (model, suite) and (model, suite, split).
function agg(filter: (r: Row) => boolean) {
  const sub = rows.filter(filter);
  const graded = sub.filter(r => !r.error);
  const defective = graded.filter(r => r.defect).length;
  const n = graded.length;
  const w = wilsonInterval(defective, n);
  return { n, errors: sub.length - graded.length, defective, defect_density: n ? defective / n : null, wilson95: [w.lower, w.upper] };
}

const report: any = { generated_for: 'phase4 calibration', k: K, models: MODELS, suites: SUITES, split: SPLIT, concurrency: CONCURRENCY, total_calls: jobs.length, per_model: {} };
const SUITE_NAMES = ['failure-prone', 'clean-control', 'realistic-distribution'];
for (const model of MODELS) {
  const m: any = { overall: agg(r => r.model === model), by_suite: {}, failure_prone_by_split: {}, by_category: {} };
  for (const suite of SUITE_NAMES) m.by_suite[suite] = agg(r => r.model === model && r.suite === suite);
  for (const split of ['tuning', 'holdout']) m.failure_prone_by_split[split] = agg(r => r.model === model && r.suite === 'failure-prone' && r.split === split);
  for (const cat of ['numeric', 'factual_qa', 'constraint']) m.by_category[cat] = agg(r => r.model === model && r.category === cat);
  report.per_model[model] = m;
}

// Band checks (read-off; not auto-enforced).
const haiku = report.per_model['haiku'];
if (haiku) {
  const fpHold = haiku.failure_prone_by_split['holdout'].defect_density;
  const cc = haiku.by_suite['clean-control'].defect_density;
  const rd = haiku.by_suite['realistic-distribution'].defect_density;
  report.band_checks = {
    failure_prone_holdout_in_band_030_060: fpHold != null && fpHold >= 0.30 && fpHold <= 0.60,
    failure_prone_holdout_density: fpHold,
    clean_control_le_002: cc != null && cc <= 0.02,
    clean_control_density: cc,
    realistic_in_band_005_025: rd != null && rd >= 0.05 && rd <= 0.25,
    realistic_density: rd,
  };
  if (report.per_model['sonnet']) {
    const sFp = report.per_model['sonnet'].by_suite['failure-prone'].defect_density;
    const hFp = haiku.by_suite['failure-prone'].defect_density;
    report.band_checks['sonnet_monotonicity_ge_0.10'] = sFp != null && hFp != null && (hFp - sFp) >= 0.10;
    report.band_checks['sonnet_vs_haiku_fp_density'] = { sonnet: sFp, haiku: hFp, gap: hFp != null && sFp != null ? hFp - sFp : null };
  }
}

const outPath = fileURLToPath(new URL('./calibration_run.json', import.meta.url));
writeFileSync(outPath, JSON.stringify({ report, rows }, null, 2));
process.stdout.write('\n' + JSON.stringify(report, null, 2) + '\n');
