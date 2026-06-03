/**
 * Phase 4 — FROZEN §7 blocker-code label map (prereg §6 "Diagnostics",
 * §9 invariant 7, DETERMINISTIC_VALUE_PLAN.md §7).
 *
 * This maps each defect MECHANISM a Phase-4 task can exhibit onto the §7
 * blocker code the gate is EXPECTED to emit for that defect. It is frozen
 * BEFORE any model call so `blocker_code_accuracy` (the emitted-vs-expected
 * routing diagnostic) is scored against a fixed target, never relabeled after
 * seeing the codes the gate actually emits.
 *
 * ── Routing rules (frozen, per prereg §6 / §9.7) ────────────────────────────
 *  • Numeric provenance failure  → 'NUMERIC_MISMATCH' (the RECOMPUTE path: the
 *    declared leaf inputs / chained ops do not project to the rendered number).
 *  • Numeric drift               → 'FINAL_ANSWER_ARTIFACT_DRIFT' ONLY when the
 *    declared derivation is VALID but the rendered/surfaced number differs from
 *    it (§5 rendered-field ≠ source-artifact). This is the binding-eligible
 *    drift that B catches and D cannot.
 *  • Unsupported fact (laundered distractor / fabricated cadence/value)
 *                                → 'UNSUPPORTED_CLAIM'.
 *  • Stripped / missing gold span (the controlling fact absent from the answer)
 *                                → 'SOURCE_SPAN_MISMATCH'.
 *  • Missing required field / requirement coverage gap
 *                                → 'MISSING_REQUIREMENT'.
 *  • Constraint breach (out-of-bound numeric, forbidden enum)
 *                                → 'CONSTRAINT_VIOLATION'.
 *
 * ── REPORTED diagnostic, NOT a relabel ──────────────────────────────────────
 * The known emitted-vs-expected routing gap (`live_gate_score` = 27.4%
 * blocker_code_accuracy in the existing renderer-unit harness) is a REPORTED
 * diagnostic per prereg §6/§10, not a reason to move any expected code here.
 * If the live gate emits a code other than the one below, that is a labeling-
 * alignment finding — the map is NOT edited post-hoc to match emitted codes.
 *
 * Pure data + a couple of pure lookups. No model / CLI calls.
 */

import type { BlockerTaxonomyCode } from '../../src/enforcement/blocker_taxonomy.js';

/**
 * The defect mechanisms a Phase-4 HARD_CORPUS task can carry. These are the
 * AUTHORING-level defect classes (what a defective model does), distinct from
 * the gate's fine-grained internal `mechanism` strings in blocker_taxonomy.ts.
 */
export type Phase4DefectMechanism =
  // ── numeric family ──
  /** Declared leaf inputs / chained ops don't recompute to the answer
   *  (wrong method, dropped step, flattened input). RECOMPUTE path. */
  | 'numeric_provenance_failure'
  /** Derivation is internally valid but the SURFACED number differs from it
   *  (the final-answer ↔ artifact drift binding is meant to catch). */
  | 'final_answer_artifact_drift'
  // ── factual_qa / RAG family ──
  /** A planted distractor fact (conflicting number / superseded value) is
   *  asserted as if true — laundered fabrication. */
  | 'unsupported_fact'
  /** The verbatim controlling fact (gold_span) is absent from the answer. */
  | 'stripped_gold_span'
  // ── constraint family ──
  /** A required field / requirement is missing from the structured answer. */
  | 'missing_required_field'
  /** A simultaneous bound or forbidden-enum constraint is breached. */
  | 'constraint_breach';

/**
 * FROZEN map: defect mechanism → expected §7 blocker code.
 * Total over Phase4DefectMechanism. Frozen pre-run (prereg §9.7).
 */
export const FROZEN_LABEL_MAP: Readonly<Record<Phase4DefectMechanism, BlockerTaxonomyCode>> = {
  numeric_provenance_failure: 'NUMERIC_MISMATCH',
  final_answer_artifact_drift: 'FINAL_ANSWER_ARTIFACT_DRIFT',
  unsupported_fact: 'UNSUPPORTED_CLAIM',
  stripped_gold_span: 'SOURCE_SPAN_MISMATCH',
  missing_required_field: 'MISSING_REQUIREMENT',
  constraint_breach: 'CONSTRAINT_VIOLATION',
};

/**
 * Map an oracle KIND + the observed defect mechanism to the expected §7 code.
 * Used by the scoring layer to compute `blocker_code_accuracy` against the
 * frozen target. Pure lookup.
 */
export function expectedBlockerCode(mechanism: Phase4DefectMechanism): BlockerTaxonomyCode {
  return FROZEN_LABEL_MAP[mechanism];
}

/**
 * The known emitted-vs-expected routing gap on the existing renderer-unit
 * harness, recorded here as a REPORTED diagnostic (prereg §6). Not used to
 * relabel; carried so the freeze hash binds the acknowledged gap.
 */
export const REPORTED_ROUTING_GAP = {
  source: 'live_gate_score (renderer/diff unit harness on hand-edited JSON)',
  blocker_code_accuracy: 0.274,
  note:
    'FROZEN before the run. A gap between this and the live gate emission is a ' +
    'labeling-alignment diagnostic, not a reason to relabel FROZEN_LABEL_MAP.',
} as const;
