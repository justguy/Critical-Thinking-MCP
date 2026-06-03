/**
 * Phase 4 — STEP 6, Deliverable 1: the DEFECTIVE-DRAFT generator for the REPAIR
 * track (the now-headline §10 PRIMARY endpoint H4, Amendment C).
 *
 * The repair experiment seeds the model with a REALISTIC wrong first draft (a
 * REAL planted defect the oracle flags) plus arm-specific feedback, then lets it
 * repair (≤2 retries). To isolate the differential value of structured gate
 * feedback (B/D) vs generic "incorrect" (A) vs prompted self-review (C), every
 * arm starts from the SAME defective draft for a given task; only the FEEDBACK
 * framing differs (repair_prompts.ts).
 *
 * defectiveDraft(task) builds, per oracle kind, a draft that gradeArmAnswer /
 * gradeWithOracle flags as a DEFECT:
 *   • gold_answer (numeric) — short prose with a plausible-but-wrong derivation
 *     asserting a DISTRACTOR value (the common method slip, e.g. the unweighted
 *     mean), ending `FINAL ANSWER: <distractor>`. Graded on the sentinel value →
 *     extracted != gold → DEFECT.
 *   • source_span (RAG) — a one-sentence answer asserting a planted_unsupported
 *     distractor (the laundering/superseded figure) and NOT conveying the gold
 *     span → missing_gold_span + asserted_unsupported → DEFECT.
 *   • structured_constraint — a JSON object that satisfies every numeric bound but
 *     sets the forbidden-enum field to a FORBIDDEN value → violates exactly one
 *     check → DEFECT.
 *
 * Drafts are SHORT (they are seeds, not the model's work). Each is a GENUINE
 * defect: tests/benchmark/phase4_repair.test.ts asserts gradeArmAnswer(task,
 * fakeTranscript(draft)).correct === false for EVERY HARD_CORPUS task.
 *
 * NO model / CLI calls — pure deterministic draft construction.
 */

import type { Phase4Task } from './corpus.js';
import type {
  GoldAnswerOracle,
  SourceSpanOracle,
  StructuredConstraintOracle,
} from '../oracles.js';

/** A defective draft seed plus a human-readable note on the planted defect. */
export interface DefectiveDraft {
  /** The wrong first-draft answer text, as a model would surface it. */
  draft: string;
  /** What real defect was planted (for transcripts / audit). */
  planted_defect: string;
}

// ── gold_answer: assert distractors[0] with a plausible wrong derivation ──────

function numericDraft(oracle: GoldAnswerOracle): DefectiveDraft {
  const distractor = oracle.distractors?.[0];
  if (distractor === undefined) {
    throw new Error('defectiveDraft: gold_answer oracle has no distractors[0] to plant');
  }
  // A terse, plausible-but-wrong derivation (the common method slip) ending in
  // the required sentinel. The sentinel VALUE is what gradeArmAnswer extracts.
  const draft = [
    'Working it through: I summed the relevant figures and applied the steps in order, ' +
      `which gives ${distractor}.`,
    `FINAL ANSWER: ${distractor}`,
  ].join('\n');
  return {
    draft,
    planted_defect: `numeric distractor asserted: ${distractor} (gold ${oracle.gold})`,
  };
}

// ── source_span: assert planted_unsupported[0], omit the gold span ────────────

function sourceSpanDraft(oracle: SourceSpanOracle): DefectiveDraft {
  const planted = oracle.planted_unsupported?.[0];
  if (planted === undefined) {
    throw new Error('defectiveDraft: source_span oracle has no planted_unsupported[0] to plant');
  }
  // A confident one-sentence answer that asserts the UNSUPPORTED (laundering /
  // superseded) figure and does NOT convey the gold span → two grounding defects
  // (missing_gold_span + asserted_unsupported).
  const draft = `Based on the documents, the answer is ${planted}.`;
  return {
    draft,
    planted_defect: `unsupported fact asserted: "${planted}" (gold span "${oracle.gold_span}")`,
  };
}

// ── structured_constraint: violate EXACTLY the forbidden-enum check ───────────

type Check = StructuredConstraintOracle['checks'][number];

/**
 * Pick a numeric value that satisfies EVERY numeric check on one field. Fields can
 * carry several bounds at once (e.g. events: >0 AND <200; vcpus: >=2 AND <=8), so
 * we compute the tightest open lower/upper bounds and return a value strictly
 * inside them. Throws if a field has no feasible numeric value (a corpus bug).
 */
function satisfyingNumericValue(field: string, checks: Check[]): number {
  let lo = -Infinity; // strict lower bound (value must be > lo)
  let hi = Infinity; // strict upper bound (value must be < hi)
  for (const c of checks) {
    if (c.field !== field) continue;
    const v = c.value;
    if (typeof v !== 'number') continue;
    if (c.op === '>') lo = Math.max(lo, v);
    else if (c.op === '>=') lo = Math.max(lo, v - 1); // value > v-1  ⇔  value >= v (integers)
    else if (c.op === '<') hi = Math.min(hi, v);
    else if (c.op === '<=') hi = Math.min(hi, v + 1); // value < v+1  ⇔  value <= v (integers)
  }
  // Strict-open interval (lo, hi). For integer bounds the corpus always leaves a
  // gap of ≥1; pick the integer just above lo (or a mid-point when both bounded).
  if (lo === -Infinity && hi === Infinity) return 1;
  if (lo === -Infinity) return hi - 1;
  if (hi === Infinity) return lo + 1;
  const candidate = lo + 1;
  if (candidate < hi) return candidate;
  const mid = (lo + hi) / 2;
  if (mid > lo && mid < hi) return mid;
  throw new Error(`defectiveDraft: no feasible numeric value for field "${field}" (corpus bug)`);
}

function constraintDraft(oracle: StructuredConstraintOracle): DefectiveDraft {
  const enumCheck = oracle.checks.find(
    c => c.op === 'not_in' && Array.isArray(c.value),
  );
  if (!enumCheck || !Array.isArray(enumCheck.value) || enumCheck.value.length === 0) {
    throw new Error('defectiveDraft: structured_constraint oracle has no forbidden-enum check to violate');
  }

  const obj: Record<string, unknown> = {};
  const numericFields = new Set(
    oracle.checks
      .filter(c => c.field !== enumCheck.field && typeof c.value === 'number')
      .map(c => c.field),
  );
  for (const field of numericFields) {
    obj[field] = satisfyingNumericValue(field, oracle.checks);
  }
  // Any other non-numeric, non-enum fields (none in the current corpus) get a
  // benign satisfying value; the only PLANTED violation is the forbidden enum.
  for (const c of oracle.checks) {
    if (c.field === enumCheck.field) continue;
    if (!(c.field in obj)) obj[c.field] = 'ok';
  }
  // The PLANTED defect: set the enum field to a FORBIDDEN value → violates this
  // single check while every numeric bound holds.
  const forbidden = (enumCheck.value as unknown[])[0];
  obj[enumCheck.field] = forbidden;

  return {
    draft: JSON.stringify(obj),
    planted_defect: `forbidden enum asserted: ${enumCheck.field}=${JSON.stringify(forbidden)} (violates ${enumCheck.id})`,
  };
}

/**
 * Build a realistic DEFECTIVE first-draft for a Phase-4 task. The returned draft
 * is graded `correct: false` by gradeArmAnswer for the task's oracle kind — a
 * GENUINE planted defect, not a malformed/non-answer.
 */
export function defectiveDraft(task: Phase4Task): DefectiveDraft {
  switch (task.oracle.kind) {
    case 'gold_answer':
      return numericDraft(task.oracle);
    case 'source_span':
      return sourceSpanDraft(task.oracle);
    case 'structured_constraint':
      return constraintDraft(task.oracle);
  }
}
