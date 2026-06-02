/**
 * BUNDLE-LEVEL cases for the LIVE gate-scoring run (plan §8 "Output-level mutation",
 * §9 profile × check matrix, §7 taxonomy).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The settled enforcement gate does NOT judge raw answer TEXT — it judges an
 * ArtifactBundle (the §1b chain contract → requirements → artifacts →
 * final_answer_bindings) plus the contract's grounding/constraint inputs. mutators.ts
 * produces TEXT mutants (for the oracle-backed stub scorer); this module lifts each
 * verified-correct text base into a BUNDLE CASE the REAL gate can actually check, and
 * applies bundle-level mutations that make the settled Cat-1 gates (drift /
 * requirement-coverage / strong-grounding) and the contract constraint gate fire.
 *
 * It imports from src/ (the gate) — it does NOT modify src/.
 *
 * GUARDRAILS (asserted by tests + by the run harness):
 *   1. Every CORRECT bundle case passes the gate clean (renders, no drift, every
 *      requirement covered, every strong claim grounded, every constraint satisfied).
 *   2. Every MUTATED bundle case is GENUINELY wrong at the bundle level (the planted
 *      defect is structurally present), so a gate block is a real catch.
 *   3. Deterministic: same base → same cases every call. No model/LLM calls.
 *
 * MAPPING (oracle kind → §9 gate → §7 code the SETTLED gate emits):
 *
 *   gold_answer           → final-answer↔artifact DRIFT (rendered number ≠ derivation)
 *                           → mechanism final_answer_artifact_drift → FINAL_ANSWER_ARTIFACT_DRIFT
 *                           (NB: the C label expects NUMERIC_MISMATCH; the BUNDLE
 *                            surface is drift — reported honestly as a code mismatch.)
 *
 *   source_span/wrong     → strong source-span GROUNDING (quoted_span ∉ source)
 *                           → mechanism quote_grounding → SOURCE_SPAN_MISMATCH
 *   source_span/fabricated→ strong source-span GROUNDING (asserts a planted fact)
 *                           → mechanism quote_grounding → SOURCE_SPAN_MISMATCH
 *                           (C label expects UNSUPPORTED_CLAIM; the bundle strong-
 *                            grounding gate collapses both into SOURCE_SPAN_MISMATCH —
 *                            reported honestly as a code mismatch.)
 *
 *   structured/bound      → contract CONSTRAINT check (field past its bound / forbidden
 *                           value) → mechanism constraint → CONSTRAINT_VIOLATION
 *   structured/dropped    → requirement COVERAGE (a requirement's binding removed)
 *                           → mechanism requirement_coverage → MISSING_REQUIREMENT
 */

import type {
  Artifact,
  ArtifactBundle,
  AnswerConstraint,
  SourceManifestEntry,
} from '../src/enforcement/types.js';
import type { LeveledGroundingClaim } from '../src/tools/check_quote_grounding.js';

import {
  type Oracle,
  type GoldAnswerOracle,
  type SourceSpanOracle,
  type StructuredConstraintOracle,
  type OracleKind,
  extractJsonObject,
} from './oracles.js';
import type { CorrectBase, BlockerCode, DefectClass } from './mutators.js';

/**
 * One thing the SETTLED gate judges. Exactly one of the three payloads is set, per
 * the §9 gate that this case exercises:
 *   - `bundle`         → renderAnswer + detectFinalAnswerDrift / checkRequirementCoverage
 *   - `grounding`      → checkStrongGrounding (sources + leveled claims)
 *   - `constraintCheck`→ handleCheckAnswerAgainstConstraints
 */
export interface GatePayload {
  bundle?: ArtifactBundle;
  /** Which bundle gate this case targets (so the gate driver runs the right one). */
  bundle_gate?: 'drift' | 'requirement_coverage';
  grounding?: { sources: SourceManifestEntry[]; claims: LeveledGroundingClaim[] };
  constraintCheck?: {
    answer: Record<string, unknown>;
    constraints: AnswerConstraint[];
    original_request_text: string;
  };
}

/** A verified-correct base lifted into the gate's native input. */
export interface CorrectBundleCase {
  id: string;
  base_id: string;
  oracle_kind: OracleKind;
  payload: GatePayload;
}

/** A known-wrong bundle variant the gate SHOULD block, with its expected §7 code. */
export interface MutantBundleCase {
  id: string;
  base_id: string;
  oracle_kind: OracleKind;
  defect_class: DefectClass;
  /** The §7 code the C taxonomy LABELS this defect with (mutators.ts). */
  expected_blocker_code: BlockerCode;
  payload: GatePayload;
}

// ── helpers ─────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(6)));
}

function near(a: number, b: number, tol?: number): boolean {
  return Math.abs(a - b) <= (tol ?? 1e-6);
}

/** A value provably outside tolerance of gold (mirrors mutators.ts offGold). */
function offGold(oracle: GoldAnswerOracle, delta: number): number {
  const tol = oracle.tolerance ?? 1e-6;
  const step = Math.max(Math.abs(delta), 2 * tol);
  return oracle.gold + (delta < 0 ? -step : step);
}

function goldWrongValues(oracle: GoldAnswerOracle): Array<{ defect_class: DefectClass; value: number }> {
  const out: Array<{ defect_class: DefectClass; value: number }> = [];
  const d0 = oracle.distractors?.[0];
  out.push({
    defect_class: 'unweighted_substitution',
    value: d0 !== undefined && !near(d0, oracle.gold, oracle.tolerance) ? d0 : offGold(oracle, oracle.gold * 0.1 || 1),
  });
  const d1 = oracle.distractors?.[1];
  out.push({
    defect_class: 'dropped_intermediate',
    value: d1 !== undefined && !near(d1, oracle.gold, oracle.tolerance) ? d1 : offGold(oracle, -(oracle.gold * 0.2 || 2)),
  });
  const tol = oracle.tolerance ?? 1e-6;
  out.push({ defect_class: 'boundary_off_by_one', value: 1 > 2 * tol ? oracle.gold + 1 : offGold(oracle, 1) });
  return out;
}

// ── gold_answer → DRIFT bundle ───────────────────────────────────────────────────
//
// A derivation artifact holds the gold number verbatim; the final-answer binding
// renders that number. Correct: rendered number == derivation number (no drift).
// Mutated: rendered number is a declared wrong value, so the rendered field's number
// is absent from the derivation → numeric drift fires.

function goldDerivationArtifact(gold: number): Artifact {
  return {
    id: 'deriv_total',
    provenance: 'host_extracted',
    kind: 'derivation',
    text: `Derived result: ${fmt(gold)}`,
  };
}

function goldBundle(gold: number, rendered: number): ArtifactBundle {
  return {
    contract_id: 'gold_contract',
    requirements: [{ id: 'final_answer', text: 'Report the computed final value.' }],
    artifacts: [goldDerivationArtifact(gold)],
    final_answer_bindings: [
      {
        field: 'final_answer',
        binding_kind: 'derivation',
        artifact_id: 'deriv_total',
        rendered_value: `The final value is ${fmt(rendered)}.`,
      },
    ],
  };
}

function goldCorrect(base: CorrectBase): CorrectBundleCase {
  const o = base.oracle as GoldAnswerOracle;
  return {
    id: base.id,
    base_id: base.id,
    oracle_kind: 'gold_answer',
    payload: { bundle: goldBundle(o.gold, o.gold), bundle_gate: 'drift' },
  };
}

function goldMutants(base: CorrectBase): MutantBundleCase[] {
  const o = base.oracle as GoldAnswerOracle;
  return goldWrongValues(o).map(({ defect_class, value }) => ({
    id: `${base.id}::${defect_class}`,
    base_id: base.id,
    oracle_kind: 'gold_answer' as const,
    defect_class,
    expected_blocker_code: 'NUMERIC_MISMATCH' as const,
    payload: { bundle: goldBundle(o.gold, value), bundle_gate: 'drift' as const },
  }));
}

// ── source_span → STRONG-GROUNDING ───────────────────────────────────────────────
//
// One claim, grounding_level 'strong', cites a source whose text is the oracle's
// source_text and whose quoted_span is the gold span. Correct: quoted_span is a
// verbatim substring of the source. Mutated:
//   - wrong span  : quoted_span replaced by a token NOT in the source (stripped fact)
//   - fabricated  : quoted_span is a planted-unsupported fact (asserts ∉ source)

function spanGrounding(source: string, quoted: string): GatePayload {
  return {
    grounding: {
      sources: [{ id: 'src1', text: source }],
      claims: [
        {
          claim_id: 'claim1',
          claim_text: `The source states "${quoted}".`,
          source_id: 'src1',
          quoted_span: quoted,
          supporting_token: quoted,
          claim_kind: 'status',
          grounding_level: 'strong',
        },
      ],
    },
  };
}

/**
 * The actual-cased verbatim substring of the source that conveys the gold span, or
 * null when the gold span is ABSTRACTIVE (e.g. "not stated", a laundered "999%") and
 * is not a verbatim substring of the source. The strong-grounding gate requires an
 * EXACT quote (case-sensitive, §4), so only verbatim spans can faithfully drive it —
 * abstractive gold spans are an interpretive/weak claim, not strong-grounded, and are
 * excluded from this bundle harness rather than mis-declared as strong (which would
 * false-block the correct base).
 */
function verbatimGoldSpan(o: SourceSpanOracle): string | null {
  const idx = o.source_text.toLowerCase().indexOf(o.gold_span.toLowerCase());
  if (idx < 0) return null;
  return o.source_text.slice(idx, idx + o.gold_span.length);
}

function spanCorrect(base: CorrectBase): CorrectBundleCase | null {
  const o = base.oracle as SourceSpanOracle;
  const verbatim = verbatimGoldSpan(o);
  if (verbatim === null) return null; // abstractive gold span — not strong-groundable.
  return {
    id: base.id,
    base_id: base.id,
    oracle_kind: 'source_span',
    payload: spanGrounding(o.source_text, verbatim),
  };
}

/** A short token guaranteed absent from the source (for the stripped-span mutant). */
function absentToken(o: SourceSpanOracle): string {
  const candidates = ['__no_such_span__', 'absent placeholder text', 'unstated figure'];
  const src = o.source_text.toLowerCase();
  for (const c of candidates) {
    if (!src.includes(c.toLowerCase())) return c;
  }
  return '__absent__';
}

function spanMutants(base: CorrectBase): MutantBundleCase[] {
  const o = base.oracle as SourceSpanOracle;
  // Only verbatim-groundable bases drive the strong-grounding BLOCK path. An
  // abstractive gold span yields a WEAK claim, which the §4 gate never blocks — so
  // it cannot exercise the gate and is excluded (reported honestly in the run).
  if (verbatimGoldSpan(o) === null) return [];
  const out: MutantBundleCase[] = [];

  // fabricated unsupported fact (C label: UNSUPPORTED_CLAIM)
  const planted = o.planted_unsupported.find(p => !o.source_text.toLowerCase().includes(p.toLowerCase()));
  if (planted !== undefined) {
    out.push({
      id: `${base.id}::unsupported_fact`,
      base_id: base.id,
      oracle_kind: 'source_span',
      defect_class: 'unsupported_fact',
      expected_blocker_code: 'UNSUPPORTED_CLAIM',
      payload: spanGrounding(o.source_text, planted),
    });
  }

  // stripped / wrong gold span (C label: SOURCE_SPAN_MISMATCH)
  out.push({
    id: `${base.id}::stripped_gold_span`,
    base_id: base.id,
    oracle_kind: 'source_span',
    defect_class: 'stripped_gold_span',
    expected_blocker_code: 'SOURCE_SPAN_MISMATCH',
    payload: spanGrounding(o.source_text, absentToken(o)),
  });

  return out;
}

// ── structured_constraint → CONSTRAINT check + requirement COVERAGE ──────────────
//
// The correct base answer carries a JSON object satisfying every check. We feed that
// object + the contract constraints to handleCheckAnswerAgainstConstraints (correct:
// no violation). Two mutation families:
//   - field_across_bound / flipped_must_not : push one field to a violating value
//     → constraint mechanism → CONSTRAINT_VIOLATION
//   - dropped_required_field : a requirement-coverage bundle whose binding for one
//     requirement is removed → requirement_coverage → MISSING_REQUIREMENT

type Check = StructuredConstraintOracle['checks'][number];

function constraintsFromOracle(o: StructuredConstraintOracle): AnswerConstraint[] {
  return o.checks.map(c => ({ field: c.field, op: c.op, value: c.value } as AnswerConstraint));
}

function baseObject(base: CorrectBase): Record<string, unknown> {
  const obj = extractJsonObject(base.answer);
  if (!obj) {
    throw new Error(`structured base ${base.id} answer is not parseable JSON.`);
  }
  return obj;
}

function isNumericBound(c: Check): boolean {
  return typeof c.value === 'number' && (c.op === '<' || c.op === '<=' || c.op === '>' || c.op === '>=');
}
function isEqualityOrEnum(c: Check): boolean {
  return c.op === '==' || c.op === '!=' || c.op === 'in' || c.op === 'not_in';
}
function violatingNumeric(c: Check): number | null {
  const v = c.value;
  if (typeof v !== 'number') return null;
  switch (c.op) {
    case '<': return v;
    case '<=': return v + 1;
    case '>': return v;
    case '>=': return v - 1;
    default: return null;
  }
}
function violatingEnumOrEq(c: Check): unknown {
  switch (c.op) {
    case '==':
      if (typeof c.value === 'boolean') return !c.value;
      if (typeof c.value === 'number') return c.value + 1;
      return `__NOT__${String(c.value)}`;
    case '!=': return c.value;
    case 'in': return '__OUT_OF_ENUM__';
    case 'not_in': return Array.isArray(c.value) ? c.value[0] : '__FORBIDDEN__';
    default: return undefined;
  }
}

function structuredCorrect(base: CorrectBase): CorrectBundleCase {
  const o = base.oracle as StructuredConstraintOracle;
  return {
    id: base.id,
    base_id: base.id,
    oracle_kind: 'structured_constraint',
    payload: {
      constraintCheck: {
        answer: baseObject(base),
        constraints: constraintsFromOracle(o),
        original_request_text: `Produce a configuration satisfying: ${o.checks.map(c => c.id).join(', ')}.`,
      },
    },
  };
}

function structuredMutants(base: CorrectBase): MutantBundleCase[] {
  const o = base.oracle as StructuredConstraintOracle;
  const original = baseObject(base);
  const constraints = constraintsFromOracle(o);
  const requestText = `Produce a configuration satisfying: ${o.checks.map(c => c.id).join(', ')}.`;
  const out: MutantBundleCase[] = [];

  // 1. field_across_bound (CONSTRAINT_VIOLATION) — first numeric-bound field past bound.
  const boundCheck = o.checks.find(isNumericBound);
  if (boundCheck) {
    const bad = violatingNumeric(boundCheck);
    if (bad !== null) {
      out.push({
        id: `${base.id}::field_across_bound`,
        base_id: base.id,
        oracle_kind: 'structured_constraint',
        defect_class: 'field_across_bound',
        expected_blocker_code: 'CONSTRAINT_VIOLATION',
        payload: { constraintCheck: { answer: { ...original, [boundCheck.field]: bad }, constraints, original_request_text: requestText } },
      });
    }
  }

  // 2. flipped_must_not (CONSTRAINT_VIOLATION) — first equality/enum field forbidden value.
  const eqCheck = o.checks.find(isEqualityOrEnum);
  if (eqCheck) {
    const bad = violatingEnumOrEq(eqCheck);
    if (bad !== undefined) {
      out.push({
        id: `${base.id}::flipped_must_not`,
        base_id: base.id,
        oracle_kind: 'structured_constraint',
        defect_class: 'flipped_must_not',
        expected_blocker_code: 'CONSTRAINT_VIOLATION',
        payload: { constraintCheck: { answer: { ...original, [eqCheck.field]: bad }, constraints, original_request_text: requestText } },
      });
    }
  }

  // 3. dropped_required_field (MISSING_REQUIREMENT) — requirement-coverage bundle whose
  //    binding for the first requirement is removed. Each field becomes a requirement;
  //    correct bundle binds all, the mutant drops one binding.
  const fields = Object.keys(original);
  if (fields.length >= 2) {
    const dropped = fields[0];
    const requirements = fields.map(f => ({ id: `req_${f}`, text: `Provide a value for ${f}.` }));
    const artifacts: Artifact[] = fields.map(f => ({
      id: `art_${f}`,
      provenance: 'host_extracted' as const,
      kind: 'derivation' as const,
      text: `${f} = ${JSON.stringify(original[f])}`,
    }));
    const bindings = fields
      .filter(f => f !== dropped)
      .map(f => ({ field: `req_${f}`, binding_kind: 'derivation' as const, artifact_id: `art_${f}`, rendered_value: `${f} = ${JSON.stringify(original[f])}` }));
    out.push({
      id: `${base.id}::dropped_required_field`,
      base_id: base.id,
      oracle_kind: 'structured_constraint',
      defect_class: 'dropped_required_field',
      expected_blocker_code: 'MISSING_REQUIREMENT',
      payload: { bundle: { contract_id: `struct_${base.id}`, requirements, artifacts, final_answer_bindings: bindings }, bundle_gate: 'requirement_coverage' },
    });
  }

  return out;
}

// ── public builders ──────────────────────────────────────────────────────────────

/** A correct bundle case, or null when the base cannot faithfully drive any gate. */
export function correctBundleCase(base: CorrectBase): CorrectBundleCase | null {
  switch (base.oracle.kind) {
    case 'gold_answer': return goldCorrect(base);
    case 'source_span': return spanCorrect(base);
    case 'structured_constraint': return structuredCorrect(base);
  }
}

export function mutantBundleCases(base: CorrectBase): MutantBundleCase[] {
  switch (base.oracle.kind) {
    case 'gold_answer': return goldMutants(base);
    case 'source_span': return spanMutants(base);
    case 'structured_constraint': return structuredMutants(base);
  }
}

export function allCorrectBundleCases(bases: CorrectBase[]): CorrectBundleCase[] {
  return bases.map(correctBundleCase).filter((c): c is CorrectBundleCase => c !== null);
}

export function allMutantBundleCases(bases: CorrectBase[]): MutantBundleCase[] {
  return bases.flatMap(mutantBundleCases);
}
