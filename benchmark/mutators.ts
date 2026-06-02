/**
 * Deterministic defect mutators for the (C) INJECTED-DEFECT HARNESS
 * (plan §8 "Output-level mutation", §7 blocker taxonomy).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Methodology B (measure the gate on the model's *natural* defects) is empirically
 * dead: Haiku AND Sonnet both score 0% defect density on the calibration corpus
 * (see benchmark/calibration/*.json). With no natural defects there is nothing for
 * the gate to catch, so gate value cannot be measured that way.
 *
 * Methodology C measures the gate on KNOWN, PLANTED defects instead. We take a
 * verified-CORRECT base answer and apply a deterministic, model-free transform that
 * turns it into a KNOWN-WRONG variant carrying a declared label:
 *   { defect_class, mutated_field, expected_blocker_code }.
 * A scorer can then ask the gate to judge each mutant and measure precision/recall
 * against ground truth — base-rate-independent, because the wrong answers are
 * manufactured, not waited for.
 *
 * DESIGN LAWS
 * -----------
 *  1. NO MODEL CALLS. Every mutator is a pure function of (oracle, base answer).
 *  2. Each mutant must be GENUINELY oracle-WRONG — the guardrail tests assert
 *     gradeWithOracle(mutant).correct === false for every emitted mutant, so a
 *     future "gate caught it" is a real catch, not an oracle artifact.
 *  3. Each mutant is keyed to the oracle KIND and labeled with the §7 blocker code
 *     the gate is EXPECTED to emit when it blocks the mutant.
 *  4. Determinism: the same (oracle, base) yields the same mutant(s) every call.
 *
 * SCOPE: output-level mutation only (plan §8 row 1: "the gate works / blocker
 * coverage"). Task-level mutation (row 2: "the workflow works") is a separate,
 * model-in-the-loop layer and is intentionally out of scope here.
 */

import {
  gradeWithOracle,
  extractJsonObject,
  type Oracle,
  type GoldAnswerOracle,
  type SourceSpanOracle,
  type StructuredConstraintOracle,
  type OracleKind,
} from './oracles.js';

/**
 * §7 blocker taxonomy codes. Every BLOCK the gate emits carries exactly one of
 * these; the scorer compares the emitted code to a mutant's expected code to
 * measure blocker_code_accuracy.
 */
export type BlockerCode =
  | 'NUMERIC_MISMATCH'
  | 'UNSUPPORTED_CLAIM'
  | 'MISSING_REQUIREMENT'
  | 'SOURCE_SPAN_MISMATCH'
  | 'CONSTRAINT_VIOLATION'
  | 'UNDECLARED_ASSUMPTION'
  | 'OPTION_COVERAGE_GAP'
  | 'PROFILE_DOWNGRADE'
  | 'FINAL_ANSWER_ARTIFACT_DRIFT';

/** The defect families this harness can plant, keyed by oracle kind. */
export type DefectClass =
  // gold_answer
  | 'unweighted_substitution'
  | 'dropped_intermediate'
  | 'boundary_off_by_one'
  // source_span
  | 'unsupported_fact'
  | 'stripped_gold_span'
  // structured_constraint
  | 'field_across_bound'
  | 'dropped_required_field'
  | 'flipped_must_not';

export interface MutantLabel {
  /** Which defect family was planted. */
  defect_class: DefectClass;
  /**
   * The field/quantity the mutation changed. For gold_answer this is the logical
   * "final_answer"; for source_span the gold span or the injected claim; for
   * structured_constraint the JSON field name.
   */
  mutated_field: string;
  /** The §7 blocker code the gate is EXPECTED to emit when it blocks this mutant. */
  expected_blocker_code: BlockerCode;
}

export interface Mutant {
  /** Stable id: `${base_id}::${defect_class}` (deterministic). */
  id: string;
  base_id: string;
  oracle_kind: OracleKind;
  /** The oracle the mutant is graded against (same as the base's oracle). */
  oracle: Oracle;
  /** The base CORRECT answer this mutant was derived from. */
  base_answer: string;
  /** The KNOWN-WRONG answer the gate will be asked to judge. */
  mutated_answer: string;
  label: MutantLabel;
}

/** A verified-correct base the mutators operate on. */
export interface CorrectBase {
  id: string;
  oracle: Oracle;
  /** A verified-correct answer (from the calibration corpus or synthesized). */
  answer: string;
}

// ── gold_answer mutators ──────────────────────────────────────────────────────
// All three turn a correct final number into a declared distractor. The gate is
// expected to block with NUMERIC_MISMATCH (the answer-number does not match the
// derivation / gold). We pick a wrong target value PER DEFECT CLASS:
//
//  - unweighted_substitution : prefer the oracle's first declared distractor (the
//    classic unweighted/simple-mean trap); these corpora declare it explicitly.
//  - dropped_intermediate    : a SECOND declared distractor if present (the
//    "forgot a step" value), else a deterministic skew that is provably != gold.
//  - boundary_off_by_one     : gold +/- 1 (an off-by-one slip), guaranteed != gold.
//
// Every variant emits a bare final number, so extractNumericAnswer() reads exactly
// the planted wrong value — no ambiguity with the base text.

function goldDistractor(oracle: GoldAnswerOracle, index: number): number | null {
  const d = oracle.distractors;
  if (d && d.length > index) return d[index];
  return null;
}

/** A value provably outside tolerance of gold, used when no declared distractor fits. */
function offGold(oracle: GoldAnswerOracle, delta: number): number {
  const tol = oracle.tolerance ?? 1e-6;
  // Move by at least the larger of `delta` and 2*tol so it is unambiguously wrong.
  const step = Math.max(Math.abs(delta), 2 * tol);
  return oracle.gold + (delta < 0 ? -step : step);
}

function mutateGoldAnswer(base: CorrectBase): Mutant[] {
  const oracle = base.oracle as GoldAnswerOracle;
  const out: Mutant[] = [];

  // 1. unweighted_substitution — first declared distractor, else a clear skew.
  {
    const declared = goldDistractor(oracle, 0);
    const wrong = declared !== null && !near(declared, oracle.gold, oracle.tolerance)
      ? declared
      : offGold(oracle, oracle.gold * 0.1 || 1);
    out.push(
      makeGoldMutant(base, oracle, wrong, {
        defect_class: 'unweighted_substitution',
        mutated_field: 'final_answer',
        expected_blocker_code: 'NUMERIC_MISMATCH',
      }),
    );
  }

  // 2. dropped_intermediate — second declared distractor if present & wrong, else skew.
  {
    const declared = goldDistractor(oracle, 1);
    const wrong = declared !== null && !near(declared, oracle.gold, oracle.tolerance)
      ? declared
      : offGold(oracle, -(oracle.gold * 0.2 || 2));
    out.push(
      makeGoldMutant(base, oracle, wrong, {
        defect_class: 'dropped_intermediate',
        mutated_field: 'final_answer',
        expected_blocker_code: 'NUMERIC_MISMATCH',
      }),
    );
  }

  // 3. boundary_off_by_one — gold +/- 1, always outside tolerance for these corpora.
  {
    const tol = oracle.tolerance ?? 1e-6;
    // +1 unless tolerance would swallow it; in that case use a larger step.
    const wrong = 1 > 2 * tol ? oracle.gold + 1 : offGold(oracle, 1);
    out.push(
      makeGoldMutant(base, oracle, wrong, {
        defect_class: 'boundary_off_by_one',
        mutated_field: 'final_answer',
        expected_blocker_code: 'NUMERIC_MISMATCH',
      }),
    );
  }

  return out;
}

function near(a: number, b: number, tol?: number): boolean {
  return Math.abs(a - b) <= (tol ?? 1e-6);
}

function makeGoldMutant(
  base: CorrectBase,
  oracle: GoldAnswerOracle,
  wrong: number,
  label: MutantLabel,
): Mutant {
  // Emit a bare final number so the oracle extracts exactly the planted value.
  const mutated = formatNumber(wrong);
  return {
    id: `${base.id}::${label.defect_class}`,
    base_id: base.id,
    oracle_kind: 'gold_answer',
    oracle,
    base_answer: base.answer,
    mutated_answer: mutated,
    label,
  };
}

/** Render a number without scientific notation, trimming spurious float noise. */
function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Round to a stable 6 decimals then trim trailing zeros.
  return String(Number(n.toFixed(6)));
}

// ── source_span mutators ──────────────────────────────────────────────────────
//  - unsupported_fact : append a declared planted-unsupported assertion to the
//    correct answer. The gold span is STILL present (so missing_gold_span does not
//    fire) — the ONLY defect is the fabricated claim. Expected gate code:
//    UNSUPPORTED_CLAIM.
//  - stripped_gold_span : replace the answer with text that omits the gold span
//    entirely (and asserts nothing unsupported), so the ONLY defect is the missing
//    grounded fact. Expected gate code: SOURCE_SPAN_MISMATCH.

function mutateSourceSpan(base: CorrectBase): Mutant[] {
  const oracle = base.oracle as SourceSpanOracle;
  const out: Mutant[] = [];

  // 1. unsupported_fact — keep the (correct) base, append a planted fabrication.
  const planted = oracle.planted_unsupported[0];
  if (planted !== undefined) {
    // Base answer is verified to convey the gold span; appending a fabricated
    // sentence leaves the gold span intact and adds exactly one unsupported claim.
    const mutated = `${base.answer} It also notes ${planted}.`;
    out.push({
      id: `${base.id}::unsupported_fact`,
      base_id: base.id,
      oracle_kind: 'source_span',
      oracle,
      base_answer: base.answer,
      mutated_answer: mutated,
      label: {
        defect_class: 'unsupported_fact',
        mutated_field: planted,
        expected_blocker_code: 'UNSUPPORTED_CLAIM',
      },
    });
  }

  // 2. stripped_gold_span — answer that OMITS the grounded fact and asserts nothing
  // unsupported. A deliberately vague, source-free response. We build it so it is
  // GUARANTEED to drop at least one gold-span token (otherwise a single-token gold
  // span like "not" would survive in generic filler and the mutant would grade
  // correct). The guardrail tests assert this for every base.
  out.push({
    id: `${base.id}::stripped_gold_span`,
    base_id: base.id,
    oracle_kind: 'source_span',
    oracle,
    base_answer: base.answer,
    mutated_answer: strippedSpanText(oracle),
    label: {
      defect_class: 'stripped_gold_span',
      mutated_field: oracle.gold_span,
      expected_blocker_code: 'SOURCE_SPAN_MISMATCH',
    },
  });

  return out;
}

/**
 * Build a response that omits the gold span and contains no planted-unsupported
 * phrase. We emit a fixed evasive sentence built from tokens chosen to never
 * collide with a gold-span token — guaranteeing `missing_gold_span` fires and no
 * fabrication fires, so the SOLE defect is the missing grounded fact.
 */
function strippedSpanText(oracle: SourceSpanOracle): string {
  // A pool of innocuous tokens; we keep only those that are NOT gold-span tokens
  // and do not appear in any planted-unsupported phrase, then assemble a sentence.
  const goldStems = new Set(
    normTokens(oracle.gold_span).map(lightStem),
  );
  const plantedJoined = oracle.planted_unsupported.map((p) => p.toLowerCase());
  const pool = [
    'I',
    'cannot',
    'determine',
    'that',
    'here',
    'please',
    'consult',
    'elsewhere',
    'unavailable',
    'omitted',
    'unclear',
  ];
  const safe = pool.filter((w) => {
    const stem = lightStem(w.toLowerCase());
    if (goldStems.has(stem)) return false;
    // reject any word that is a substring of a planted phrase to avoid laundering
    return !plantedJoined.some((p) => p.includes(w.toLowerCase()));
  });
  // safe is large; the gold spans in this corpus are short, so we always have >=1.
  const body = safe.length > 0 ? safe.join(' ') : 'redacted';
  return `${body}.`;
}

/** Lowercase, strip markdown/punct, split — mirrors the oracle's norm tokenizer. */
function normTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[*_`~]/g, '')
    .replace(/[.,;:!?"']/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/** Light stem matching the oracle's stem() so token-collision checks agree. */
function lightStem(token: string): string {
  return token.replace(/(ing|ed|es|s)$/i, '').replace(/e$/i, '');
}

// ── structured_constraint mutators ─────────────────────────────────────────────
//  - field_across_bound  : take the FIRST numeric-bound check and push the field's
//    value just past the bound (CONSTRAINT_VIOLATION).
//  - dropped_required_field : delete a field that a check references, so the field
//    is missing from the JSON (MISSING_REQUIREMENT).
//  - flipped_must_not    : take the FIRST equality/enum check and set the field to a
//    forbidden value (a flipped must-not / out-of-enum) (CONSTRAINT_VIOLATION).
//
// We start from the parsed base object so the mutant differs from the correct base
// by exactly one field — every other constraint still passes, isolating the defect.

type Check = StructuredConstraintOracle['checks'][number];

function baseObject(base: CorrectBase): Record<string, unknown> {
  const obj = extractJsonObject(base.answer);
  if (!obj) {
    throw new Error(
      `mutateStructuredConstraint: base ${base.id} answer is not parseable JSON; ` +
        `structured bases must carry a satisfying object.`,
    );
  }
  return obj;
}

/** A value that VIOLATES a numeric-bound check (just past the bound). */
function violatingNumeric(check: Check): number | null {
  const v = check.value;
  if (typeof v !== 'number') return null;
  switch (check.op) {
    case '<':
      return v; // not strictly less than v
    case '<=':
      return v + 1; // exceeds inclusive max
    case '>':
      return v; // not strictly greater than v
    case '>=':
      return v - 1; // below inclusive min
    case '==':
      return v + 1; // not equal
    case '!=':
      return v; // equals the forbidden value
    default:
      return null;
  }
}

function isNumericBound(check: Check): boolean {
  return (
    typeof check.value === 'number' &&
    (check.op === '<' || check.op === '<=' || check.op === '>' || check.op === '>=')
  );
}

/** A value that VIOLATES an equality / enum check. */
function violatingEnumOrEq(check: Check): unknown {
  switch (check.op) {
    case '==':
      // Flip booleans; bump numbers; mangle strings — all guaranteed != value.
      if (typeof check.value === 'boolean') return !check.value;
      if (typeof check.value === 'number') return check.value + 1;
      return `__NOT__${String(check.value)}`;
    case '!=':
      return check.value; // assert the forbidden value
    case 'in':
      return '__OUT_OF_ENUM__';
    case 'not_in':
      return Array.isArray(check.value) ? check.value[0] : '__FORBIDDEN__';
    default:
      return undefined;
  }
}

function isEqualityOrEnum(check: Check): boolean {
  return (
    check.op === '==' ||
    check.op === '!=' ||
    check.op === 'in' ||
    check.op === 'not_in'
  );
}

function mutateStructuredConstraint(base: CorrectBase): Mutant[] {
  const oracle = base.oracle as StructuredConstraintOracle;
  const out: Mutant[] = [];
  const original = baseObject(base);

  // 1. field_across_bound — push the first numeric-bound field past its bound.
  const boundCheck = oracle.checks.find(isNumericBound);
  if (boundCheck) {
    const bad = violatingNumeric(boundCheck);
    if (bad !== null) {
      const obj = { ...original, [boundCheck.field]: bad };
      out.push({
        id: `${base.id}::field_across_bound`,
        base_id: base.id,
        oracle_kind: 'structured_constraint',
        oracle,
        base_answer: base.answer,
        mutated_answer: JSON.stringify(obj),
        label: {
          defect_class: 'field_across_bound',
          mutated_field: boundCheck.field,
          expected_blocker_code: 'CONSTRAINT_VIOLATION',
        },
      });
    }
  }

  // 2. dropped_required_field — delete the field of the first check entirely.
  const firstCheck = oracle.checks[0];
  if (firstCheck) {
    const obj = { ...original };
    delete obj[firstCheck.field];
    out.push({
      id: `${base.id}::dropped_required_field`,
      base_id: base.id,
      oracle_kind: 'structured_constraint',
      oracle,
      base_answer: base.answer,
      mutated_answer: JSON.stringify(obj),
      label: {
        defect_class: 'dropped_required_field',
        mutated_field: firstCheck.field,
        expected_blocker_code: 'MISSING_REQUIREMENT',
      },
    });
  }

  // 3. flipped_must_not — set the first equality/enum field to a forbidden value.
  const eqCheck = oracle.checks.find(isEqualityOrEnum);
  if (eqCheck) {
    const bad = violatingEnumOrEq(eqCheck);
    if (bad !== undefined) {
      const obj = { ...original, [eqCheck.field]: bad };
      out.push({
        id: `${base.id}::flipped_must_not`,
        base_id: base.id,
        oracle_kind: 'structured_constraint',
        oracle,
        base_answer: base.answer,
        mutated_answer: JSON.stringify(obj),
        label: {
          defect_class: 'flipped_must_not',
          mutated_field: eqCheck.field,
          expected_blocker_code: 'CONSTRAINT_VIOLATION',
        },
      });
    }
  }

  return out;
}

/**
 * Mutate one verified-correct base into all applicable known-wrong variants.
 * Pure and deterministic. Throws for an unknown oracle kind.
 */
export function mutateBase(base: CorrectBase): Mutant[] {
  switch (base.oracle.kind) {
    case 'gold_answer':
      return mutateGoldAnswer(base);
    case 'source_span':
      return mutateSourceSpan(base);
    case 'structured_constraint':
      return mutateStructuredConstraint(base);
  }
}

/** Mutate a list of bases, flattening all mutants. Deterministic and order-stable. */
export function mutateAll(bases: CorrectBase[]): Mutant[] {
  return bases.flatMap(mutateBase);
}

/**
 * Self-guard: a mutant is VALID only if it is genuinely oracle-wrong. Returned for
 * use by the scorer / tests so a mis-specified base (one whose "mutant" still
 * grades correct) is surfaced loudly rather than silently inflating recall.
 */
export function isGenuinelyWrong(m: Mutant): boolean {
  return gradeWithOracle(m.oracle, m.mutated_answer).correct === false;
}
