/**
 * CORRECT BASES for the injected-defect harness.
 *
 * Methodology C mutates verified-CORRECT answers into known-wrong variants. The
 * "correct base" = a task's oracle + an answer that the oracle grades as correct.
 * We source bases two ways:
 *
 *   A. FROM THE LIVE CALIBRATION RUNS (preferred, plan §"reject synthetic RESULTS"):
 *      benchmark/calibration/*.json store, per task, the REAL model answer
 *      (`answer_excerpt`) and whether the oracle graded it correct. We join those
 *      rows back to the calibration corpus oracle by task id and keep only rows the
 *      oracle confirmed correct. These are real model outputs, not synthesized.
 *
 *   B. SYNTHESIZED FALLBACK (only when no live correct row exists for a task):
 *      a minimal answer constructed to satisfy the oracle, so every corpus task can
 *      still contribute a base. Synthesized bases are flagged `synthetic: true`.
 *
 * The calibration corpus tasks come from benchmark/suites/calibration.ts (reused,
 * not re-authored). No model calls happen here — reading recorded JSON only.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { calibrationTasks } from './suites/calibration.js';
import { gradeWithOracle, type Oracle, type SourceSpanOracle, type StructuredConstraintOracle, type GoldAnswerOracle } from './oracles.js';
import type { CorrectBase } from './mutators.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const CALIBRATION_DIR = join(HERE, 'calibration');

interface CalibrationRow {
  task_id: string;
  correct: boolean;
  adapter_error?: boolean;
  answer_excerpt?: string;
}
interface CalibrationFile {
  kind?: string;
  rows?: CalibrationRow[];
}

/** Read every calibration_*.json and return the recorded rows, flattened. */
function loadCalibrationRows(): CalibrationRow[] {
  let files: string[];
  try {
    files = readdirSync(CALIBRATION_DIR).filter(
      (f) => f.startsWith('calibration_') && f.endsWith('.json'),
    );
  } catch {
    return [];
  }
  const rows: CalibrationRow[] = [];
  for (const f of files) {
    try {
      const parsed = JSON.parse(readFileSync(join(CALIBRATION_DIR, f), 'utf8')) as CalibrationFile;
      if (Array.isArray(parsed.rows)) rows.push(...parsed.rows);
    } catch {
      /* skip unreadable / non-conforming file */
    }
  }
  return rows;
}

/** Synthesize a minimal oracle-satisfying answer (fallback only). */
function synthesizeCorrect(oracle: Oracle): string {
  switch (oracle.kind) {
    case 'gold_answer':
      return formatGold(oracle);
    case 'source_span':
      return synthesizeSpan(oracle);
    case 'structured_constraint':
      return synthesizeStructured(oracle);
  }
}

function formatGold(oracle: GoldAnswerOracle): string {
  return Number.isInteger(oracle.gold) ? String(oracle.gold) : String(oracle.gold);
}

function synthesizeSpan(oracle: SourceSpanOracle): string {
  // The gold span verbatim conveys the grounded fact and asserts nothing planted.
  return `The answer is ${oracle.gold_span}.`;
}

function synthesizeStructured(oracle: StructuredConstraintOracle): string {
  // Build a field map that satisfies every check. For coupled checks the corpus
  // tasks are simple enough that per-field satisfaction suffices; we verify with
  // the oracle before returning and throw if synthesis failed.
  const obj: Record<string, unknown> = {};
  for (const c of oracle.checks) {
    obj[c.field] = satisfyingValue(c, obj[c.field]);
  }
  return JSON.stringify(obj);
}

function satisfyingValue(
  c: StructuredConstraintOracle['checks'][number],
  current: unknown,
): unknown {
  const v = c.value;
  switch (c.op) {
    case '<':
      return typeof v === 'number' ? v - 1 : current;
    case '<=':
      return typeof v === 'number' ? v : current;
    case '>':
      return typeof v === 'number' ? v + 1 : current;
    case '>=':
      return typeof v === 'number' ? v : current;
    case '==':
      return v;
    case '!=':
      return typeof v === 'number' ? v + 1 : `__OTHER__${String(v)}`;
    case 'in':
      return Array.isArray(v) ? v[0] : current;
    case 'not_in':
      return '__SAFE_VALUE__';
    default:
      return current;
  }
}

/**
 * Build verified-correct bases from the calibration corpus, preferring real
 * recorded model answers and falling back to a synthesized satisfying answer.
 * Every returned base is RE-GRADED here so a base is included only if the oracle
 * confirms it correct (a synthesized answer that fails synthesis is dropped, not
 * silently shipped).
 *
 * @returns bases plus the source tag per base, for honest reporting.
 */
export function buildCorrectBases(): Array<CorrectBase & { synthetic: boolean }> {
  const tasks = calibrationTasks();
  const rows = loadCalibrationRows();
  // Index the best recorded correct answer per task id.
  const recordedCorrect = new Map<string, string>();
  for (const r of rows) {
    if (r.adapter_error) continue;
    if (!r.correct) continue;
    if (typeof r.answer_excerpt !== 'string') continue;
    if (!recordedCorrect.has(r.task_id)) recordedCorrect.set(r.task_id, r.answer_excerpt);
  }

  const bases: Array<CorrectBase & { synthetic: boolean }> = [];
  for (const t of tasks) {
    const recorded = recordedCorrect.get(t.id);
    if (recorded !== undefined && gradeWithOracle(t.oracle, recorded).correct) {
      bases.push({ id: t.id, oracle: t.oracle, answer: recorded, synthetic: false });
      continue;
    }
    // Fallback: synthesize and keep only if it genuinely satisfies the oracle.
    const synth = synthesizeCorrect(t.oracle);
    if (gradeWithOracle(t.oracle, synth).correct) {
      bases.push({ id: t.id, oracle: t.oracle, answer: synth, synthetic: true });
    }
    // else: drop (a task whose own oracle we cannot satisfy is surfaced by tests,
    // not silently mutated into a meaningless base).
  }
  return bases;
}

/** Count how many bases came from real recorded answers vs synthesis. */
export function basesProvenance(bases: Array<CorrectBase & { synthetic: boolean }>): {
  total: number;
  recorded: number;
  synthetic: number;
} {
  const synthetic = bases.filter((b) => b.synthetic).length;
  return { total: bases.length, recorded: bases.length - synthetic, synthetic };
}
