/**
 * Real-output runner (plan §1a "Real-output harness").
 *
 * Drives the LOCAL CLI model adapter to produce REAL outputs for the bare-model
 * conditions (baseline + prompted), then grades each output with an OBJECTIVE
 * oracle. Every row produced here has `synthetic: false` and a concrete defect
 * count from the oracle — there are no placeholder rows in this path.
 *
 * Conditions (bare model, no tools — that is the point of the comparison):
 *   - baseline  : raw prompt, no system prompt.
 *   - prompted  : the same critical-thinking system prompt the main runner uses,
 *                 prepended to the task prompt (CLI -p has no separate system
 *                 channel, so we prepend it as guidance).
 *
 * The CT-MCP arm is graded deterministically in runner.ts; this module only
 * covers the model-output arms that previously had to be faked.
 */

import { runModel, type AdapterBackend } from './model_adapter.js';
import { gradeWithOracle } from './oracles.js';
import { allTasks, type BenchTask, type SuiteName } from './suites/index.js';

export type ModelCondition = 'baseline' | 'prompted';

/** Critical-thinking guidance prepended in the `prompted` condition. */
export const PROMPTED_GUIDANCE =
  'Before answering, restate the question, list each assumption, work through the ' +
  'calculation or source lookup step by step, then give the final answer exactly ' +
  'as the question requests. ';

export interface RealRow {
  task_id: string;
  suite: SuiteName;
  category: BenchTask['category'];
  condition: ModelCondition;
  /** REAL output from a model — never synthetic. */
  synthetic: false;
  model: string;
  backend: AdapterBackend;
  /** Objective grade. */
  correct: boolean;
  high_sev_defects: number;
  oracle_reasons: string[];
  /** True when the CLI call itself failed (excluded from defect-density stats). */
  adapter_error: boolean;
  adapter_error_detail?: string;
  /** Truncated answer text for the transcript. */
  answer_excerpt: string;
}

function buildPrompt(task: BenchTask, condition: ModelCondition): string {
  return condition === 'prompted' ? PROMPTED_GUIDANCE + task.prompt : task.prompt;
}

export interface RunOptions {
  model?: string;
  conditions?: ModelCondition[];
  /** Limit to the first N tasks (smoke runs). */
  limit?: number;
  /** Restrict to specific suites. */
  suites?: SuiteName[];
  backend?: AdapterBackend;
  timeoutMs?: number;
  onRow?: (row: RealRow) => void;
}

/** Run the real-output harness over the corpus, returning graded real rows. */
export function runRealOutput(opts: RunOptions = {}): RealRow[] {
  const model = opts.model ?? 'haiku';
  const conditions = opts.conditions ?? (['baseline', 'prompted'] as ModelCondition[]);
  let tasks = allTasks();
  if (opts.suites) tasks = tasks.filter(t => opts.suites!.includes(t.suite));
  if (opts.limit != null) tasks = tasks.slice(0, opts.limit);

  const rows: RealRow[] = [];
  for (const task of tasks) {
    for (const condition of conditions) {
      const prompt = buildPrompt(task, condition);
      const out = runModel(prompt, model, { backend: opts.backend, timeoutMs: opts.timeoutMs });

      let correct = false;
      let highSev = 0;
      let reasons: string[] = [];
      if (out.error) {
        reasons = [out.error_detail ?? 'adapter_error'];
      } else {
        const verdict = gradeWithOracle(task.oracle, out.text);
        correct = verdict.correct;
        highSev = verdict.high_sev_defects;
        reasons = verdict.reasons;
      }

      const row: RealRow = {
        task_id: task.id,
        suite: task.suite,
        category: task.category,
        condition,
        synthetic: false,
        model: out.model,
        backend: out.backend,
        correct,
        high_sev_defects: highSev,
        oracle_reasons: reasons,
        adapter_error: out.error,
        adapter_error_detail: out.error ? out.error_detail : undefined,
        answer_excerpt: out.text.slice(0, 200),
      };
      rows.push(row);
      opts.onRow?.(row);
    }
  }
  return rows;
}

export interface SuiteStats {
  condition: ModelCondition;
  suite: SuiteName;
  n: number;
  graded: number; // excludes adapter errors
  defective: number; // graded rows with high_sev_defects > 0
  defect_density: number; // defective / graded
  adapter_errors: number;
}

/** Aggregate defect density by (condition, suite). Adapter-error rows excluded. */
export function summarizeReal(rows: RealRow[]): SuiteStats[] {
  const out: SuiteStats[] = [];
  const conditions = [...new Set(rows.map(r => r.condition))];
  const suites = [...new Set(rows.map(r => r.suite))];
  for (const condition of conditions) {
    for (const suite of suites) {
      const subset = rows.filter(r => r.condition === condition && r.suite === suite);
      if (subset.length === 0) continue;
      const graded = subset.filter(r => !r.adapter_error);
      const defective = graded.filter(r => r.high_sev_defects > 0).length;
      out.push({
        condition,
        suite,
        n: subset.length,
        graded: graded.length,
        defective,
        defect_density: graded.length > 0 ? defective / graded.length : 0,
        adapter_errors: subset.filter(r => r.adapter_error).length,
      });
    }
  }
  return out;
}
