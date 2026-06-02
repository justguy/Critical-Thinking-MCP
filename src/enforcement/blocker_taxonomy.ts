/**
 * Blocker taxonomy (DETERMINISTIC_VALUE_PLAN.md §7).
 *
 * Every BLOCK must carry exactly one taxonomy code so we can measure *which*
 * blockers create value. Internally the gate emits a fine-grained `mechanism`
 * string; this module maps each mechanism onto one of the nine §7 codes.
 *
 * Pure, deterministic, no LLM. The mapping is total over the mechanisms the
 * blocking gates actually emit; an unmapped mechanism throws so a new gate
 * cannot silently ship a BLOCK without a taxonomy code (the §7 invariant).
 */

import type { BlockingIssue } from './types.js';

/** The exactly-nine §7 blocker codes. */
export type BlockerTaxonomyCode =
  | 'NUMERIC_MISMATCH'
  | 'UNSUPPORTED_CLAIM'
  | 'MISSING_REQUIREMENT'
  | 'SOURCE_SPAN_MISMATCH'
  | 'CONSTRAINT_VIOLATION'
  | 'UNDECLARED_ASSUMPTION'
  | 'OPTION_COVERAGE_GAP'
  | 'PROFILE_DOWNGRADE'
  | 'FINAL_ANSWER_ARTIFACT_DRIFT';

export const BLOCKER_TAXONOMY_CODES: readonly BlockerTaxonomyCode[] = [
  'NUMERIC_MISMATCH',
  'UNSUPPORTED_CLAIM',
  'MISSING_REQUIREMENT',
  'SOURCE_SPAN_MISMATCH',
  'CONSTRAINT_VIOLATION',
  'UNDECLARED_ASSUMPTION',
  'OPTION_COVERAGE_GAP',
  'PROFILE_DOWNGRADE',
  'FINAL_ANSWER_ARTIFACT_DRIFT',
];

/**
 * mechanism → §7 code. Total over every mechanism a blocking gate emits.
 *
 * Numeric provenance / re-derivation failures and laundered/unanchored operands
 * are NUMERIC_MISMATCH (the number does not faithfully project the inputs).
 * A correctly-derived number that disagrees with the rendered answer is
 * FINAL_ANSWER_ARTIFACT_DRIFT (§5: rendered field ≠ source artifact).
 */
const MECHANISM_TO_CODE: Readonly<Record<string, BlockerTaxonomyCode>> = {
  // ── numeric re-derivation / provenance (NUMERIC_MISMATCH) ──
  number_provenance: 'NUMERIC_MISMATCH',
  number_derivation_dag: 'NUMERIC_MISMATCH',
  number_dag_flattened_input: 'NUMERIC_MISMATCH',
  number_input_anchor: 'NUMERIC_MISMATCH',
  number_conclusion_origin: 'NUMERIC_MISMATCH',
  number_derivation_arity: 'NUMERIC_MISMATCH',
  arithmetic_input_anchor: 'NUMERIC_MISMATCH',
  arithmetic_mismatch: 'NUMERIC_MISMATCH',

  // ── rendered answer disagrees with its source artifact (§5) ──
  number_answer_binding: 'FINAL_ANSWER_ARTIFACT_DRIFT',
  numeric_not_shipped: 'FINAL_ANSWER_ARTIFACT_DRIFT',
  final_answer_artifact_drift: 'FINAL_ANSWER_ARTIFACT_DRIFT',

  // ── grounding / claim support (UNSUPPORTED_CLAIM / SOURCE_SPAN_MISMATCH) ──
  finalize_grounding: 'UNSUPPORTED_CLAIM',
  finalize_claim_kind: 'UNSUPPORTED_CLAIM',
  finalize_claim_coverage: 'UNSUPPORTED_CLAIM',
  finalize_claim_binding: 'SOURCE_SPAN_MISMATCH',
  quote_grounding: 'SOURCE_SPAN_MISMATCH',

  // ── requirement coverage (MISSING_REQUIREMENT) ──
  finalize_missing_inputs: 'MISSING_REQUIREMENT',
  finalize_no_executor: 'MISSING_REQUIREMENT',
  requirement_coverage: 'MISSING_REQUIREMENT',
  must_include: 'MISSING_REQUIREMENT',
  structural_criterion: 'MISSING_REQUIREMENT',
  required_field: 'MISSING_REQUIREMENT',

  // ── host-grade trust (§3) / profile dodge (PROFILE_DOWNGRADE) ──
  // A proof-grade requirement backed only by tier-3..5 (model-authored) artifacts,
  // or a contract identity that drifted from the planned one (plan_token), is the
  // model passing proof-grade work on non-proof input / a dodged profile.
  host_grade_proof_required: 'PROFILE_DOWNGRADE',
  plan_token_mismatch: 'PROFILE_DOWNGRADE',

  // ── constraint / partition / freshness (CONSTRAINT_VIOLATION) ──
  must_not_include: 'CONSTRAINT_VIOLATION',
  constraint: 'CONSTRAINT_VIOLATION',
  partition_gap: 'CONSTRAINT_VIOLATION',
  partition_overlap: 'CONSTRAINT_VIOLATION',
  freshness: 'CONSTRAINT_VIOLATION',
};

/**
 * Resolve the §7 taxonomy code for an internal mechanism. Throws on an unmapped
 * mechanism — a blocking gate must never ship a BLOCK without a §7 code.
 */
export function taxonomyForMechanism(mechanism: string): BlockerTaxonomyCode {
  const code = MECHANISM_TO_CODE[mechanism];
  if (!code) {
    throw new Error(
      `No §7 taxonomy code mapped for blocking mechanism "${mechanism}". ` +
        'Every BLOCK path must carry a taxonomy code — add the mapping in blocker_taxonomy.ts.',
    );
  }
  return code;
}

/**
 * Stamp the §7 taxonomy code onto every blocking issue, in place, and return the
 * same array. Warnings are left untouched. Called once at each gate's return so
 * the §7 invariant ("every BLOCK carries exactly one code") holds by construction.
 */
export function stampTaxonomy(issues: BlockingIssue[]): BlockingIssue[] {
  for (const issue of issues) {
    if (issue.severity === 'blocking') {
      issue.taxonomy = taxonomyForMechanism(issue.mechanism);
    }
  }
  return issues;
}
