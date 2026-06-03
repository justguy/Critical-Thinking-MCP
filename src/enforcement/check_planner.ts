/**
 * plan_checks — deterministic check planner.
 *
 * Pure static lookup (task_type → check suite) plus a policy layer over
 * evidence_level / risk_level that decides blocking vs warning. The policy layer
 * may only RAISE TO BLOCKING the checks whose fail-signal is unforgeable
 * (within-request containment / re-derivation). It never blocks itself.
 *
 * No LLM, no network, no state. See docs/designs/robustness-additions.md (Part II).
 */

import type {
  ArtifactTemplate,
  DeliverableContract,
  EvidenceLevel,
  PlanResult,
  PlannedCheck,
  RiskLevel,
  TaskType,
} from './types.js';

/** Baseline suites per task type. `required`/`optional` are baselines; severity is set by policy. */
const PROFILE_MAP: Record<TaskType, { required: string[]; optional: string[] }> = {
  factual_qa: {
    required: ['check_quote_grounding', 'check_claim_coverage'],
    optional: ['check_freshness', 'validate_confidence', 'check_answer_against_constraints'],
  },
  numeric_analysis: {
    required: ['trace_conclusion_numbers', 'verify_arithmetic'],
    optional: ['check_numeric_claims', 'check_answer_against_constraints'],
  },
  planning: {
    required: ['check_plan_validity'],
    optional: ['validate_reasoning_chain', 'check_answer_against_constraints'],
  },
  decision: {
    required: ['evaluate_tradeoffs'],
    optional: ['validate_confidence', 'check_quote_grounding', 'check_answer_against_constraints'],
  },
  concurrency_design: {
    required: ['detect_concurrency_patterns'],
    optional: ['check_plan_validity'],
  },
  reasoning: {
    required: ['validate_reasoning_chain'],
    optional: ['validate_confidence', 'check_claim_coverage', 'check_case_partition'],
  },
  freeform: {
    required: ['score_response_quality'],
    optional: [],
  },
};

/**
 * Checks whose fail-signal is UNFORGEABLE (decided within one request). Only these
 * may be promoted to blocking by policy, and only these go into finalize_required.
 */
const UNFORGEABLE_CHECKS = new Set<string>([
  'check_quote_grounding',
  'trace_conclusion_numbers',
  'verify_arithmetic',
  'check_answer_against_constraints',
  'check_freshness',
]);

function templateForCheck(
  check: string,
  applies_when: ArtifactTemplate['applies_when'],
): ArtifactTemplate | null {
  switch (check) {
    case 'check_quote_grounding':
      return {
        check,
        applies_when,
        purpose: 'Prove each load-bearing factual claim against a quoted source span.',
        required_fields: ['sources', 'claims'],
        finalize_mapping: 'Copy sources[] and claims[] to finalize_deliverable.',
        example: {
          sources: [{
            id: 's1',
            text: 'Redis executes commands single-threaded.',
            origin: 'host_supplied',
            authority_tier: 'primary',
          }],
          claims: [{
            claim_id: 'c1',
            claim_text: 'Redis executes commands single-threaded',
            source_id: 's1',
            quoted_span: 'Redis executes commands single-threaded',
            supporting_token: 'single-threaded',
            claim_kind: 'status',
          }],
        },
      };
    case 'trace_conclusion_numbers':
      return {
        check,
        applies_when,
        purpose: 'Bind answer numbers to raw inputs or deterministic derivations.',
        required_fields: ['inputs', 'conclusion_numbers'],
        finalize_mapping: 'Copy inputs[] and conclusion_numbers[] to finalize_deliverable.',
        example: {
          inputs: [120, 30],
          conclusion_numbers: [{
            value: 150,
            origin: 'derived',
            op: 'sum',
            input_refs: [0, 1],
          }],
          answer_text: 'The monthly total is 150.',
        },
      };
    case 'verify_arithmetic':
      return {
        check,
        applies_when,
        purpose: 'Recompute arithmetic checks from supplied operands.',
        required_fields: ['arithmetic_checks'],
        finalize_mapping: 'Copy arithmetic_checks[] to finalize_deliverable.',
        example: {
          arithmetic_checks: [{
            claim_type: 'sum',
            values: [120, 30],
            claimed_result: 150,
          }],
        },
      };
    case 'check_answer_against_constraints':
      return {
        check,
        applies_when,
        purpose: 'Evaluate hard constraints against the structured answer.',
        required_fields: ['constraints', 'structured_answer'],
        finalize_mapping: 'Copy constraints[] and structured_answer to finalize_deliverable.',
        example: {
          constraints: [{
            field: 'price',
            op: '<',
            value: 100,
            source_quote: 'price under 100',
          }],
          structured_answer: {
            status: 'ok',
            price: 80,
          },
        },
      };
    case 'check_freshness':
      return {
        check,
        applies_when,
        purpose: 'Evaluate source freshness at a host-supplied evaluation time.',
        required_fields: ['eval_time', 'sources[].published_at|retrieved_at'],
        finalize_mapping: 'Copy eval_time and dated sources[] to finalize_deliverable.',
        example: {
          eval_time: '2026-06-01T00:00:00Z',
          sources: [{
            id: 's1',
            text: 'Current policy snapshot.',
            retrieved_at: '2026-05-31T00:00:00Z',
          }],
        },
      };
    case 'check_case_partition':
      return {
        check,
        applies_when,
        purpose: 'Show that case partitions are mutually exclusive and cover the stated scope.',
        required_fields: ['cases'],
        finalize_mapping: 'Case partitions are advisory today; keep cases in supporting artifacts.',
        example: {
          cases: [
            { id: 'success', condition: 'all required artifacts are valid' },
            { id: 'blocked', condition: 'one or more mandatory artifacts are missing or invalid' },
          ],
        },
      };
    default:
      return null;
  }
}

/**
 * task_type recommender. Maps a claim_classifier primary type to a deliverable
 * task_type — a SUGGESTION for which check profile (PROFILE_MAP) likely fits.
 *
 * Trust tier (§3): the recommendation is ADVISORY on its own. A model self-declaring
 * (or having inferred for it) a task_type is Tier 3–5 — it can be wrong or weakened,
 * so it is surfaced, never trusted. The mapping becomes DETERMINISTIC ONLY WHEN PAIRED
 * WITH HOST ENFORCEMENT: a host-authored contract that pins task_type makes the profile
 * binding; an agent-side recommendation does not. This is a Cat-3 prompt affordance — it
 * narrows the model toward the right profile, but enforcement strength comes from the host
 * contract, not from this function.
 */
export function inferTaskType(primaryType: string): TaskType {
  switch (primaryType) {
    case 'arithmetic':
      return 'numeric_analysis';
    case 'empirical':
    case 'forecast':
      return 'factual_qa';
    case 'tradeoff':
      return 'decision';
    case 'safety':
      return 'concurrency_design';
    case 'architectural':
      return 'reasoning';
    default:
      return 'freeform';
  }
}

function baseSeverity(check: string, evidence: EvidenceLevel): 'blocking' | 'warning' {
  if (!UNFORGEABLE_CHECKS.has(check)) return 'warning';
  // Grounding obligations harden as evidence_level rises.
  if (check === 'check_quote_grounding') {
    return evidence === 'cited' || evidence === 'rederived' ? 'blocking' : 'warning';
  }
  if (check === 'trace_conclusion_numbers') {
    return evidence === 'rederived' ? 'blocking' : 'warning';
  }
  if (check === 'verify_arithmetic') {
    return evidence === 'rederived' ? 'blocking' : 'warning';
  }
  return 'warning';
}

/**
 * Plan the deterministic check suite for a contract. Pure function.
 */
export function planChecks(contract: {
  task_type: TaskType;
  evidence_level: EvidenceLevel;
  risk_level: RiskLevel;
  freshness?: { max_age_seconds: number; requires_dated_sources: boolean };
}): PlanResult {
  const profile = PROFILE_MAP[contract.task_type] ?? PROFILE_MAP.freeform;

  const required: PlannedCheck[] = profile.required.map(check => {
    let severity = baseSeverity(check, contract.evidence_level);

    // risk_level promotes UNFORGEABLE required checks to blocking on the recommended path.
    if (
      (contract.risk_level === 'medium' || contract.risk_level === 'high') &&
      UNFORGEABLE_CHECKS.has(check)
    ) {
      severity = 'blocking';
    }

    return {
      check,
      severity_on_fail: severity,
      reason: `Required for task_type='${contract.task_type}' at evidence_level='${contract.evidence_level}', risk_level='${contract.risk_level}'.`,
    };
  });

  let optional = profile.optional.map(check => ({
    check,
    reason: `Optional for task_type='${contract.task_type}'.`,
  }));

  // freshness present in the contract → check_freshness is genuinely required; blocking iff dated
  // sources are required (a stale/future source is then an arithmetic fact, unforgeable, at the
  // caller-supplied eval time). Run this BEFORE the high-risk promotion so a contract-declared
  // freshness obligation stays mandatory rather than being shadowed as verify-if-present.
  if (contract.freshness && !required.some(r => r.check === 'check_freshness')) {
    required.push({
      check: 'check_freshness',
      severity_on_fail: contract.freshness.requires_dated_sources ? 'blocking' : 'warning',
      reason: `Contract declares a freshness window (max_age_seconds=${contract.freshness.max_age_seconds}).`,
    });
    optional = optional.filter(o => o.check !== 'check_freshness');
  }

  // high risk pulls unforgeable optional checks in for extra rigor — but as VERIFY-IF-PRESENT,
  // not mandatory artifacts. finalize re-executes them (and BLOCKS on failure) only when the
  // caller supplies their artifacts; missing artifacts are NOT a block, because a high-risk
  // deliverable may legitimately have no freshness/constraint dimension. (Promoting them to
  // mandatory caused a systematic high-risk false-block on tasks with no such dimension.)
  if (contract.risk_level === 'high') {
    const promote = profile.optional.filter(c => UNFORGEABLE_CHECKS.has(c));
    for (const check of promote) {
      if (required.some(r => r.check === check)) continue;
      required.push({
        check,
        severity_on_fail: 'verify_if_present',
        reason: `Verified-if-present because risk_level='high' — re-executed only if its artifacts are supplied; absence is not a block.`,
      });
    }
    optional = optional.filter(o => !promote.includes(o.check));
  }

  const finalize_required = required
    .filter(r => r.severity_on_fail === 'blocking' && UNFORGEABLE_CHECKS.has(r.check))
    .map(r => r.check);

  const finalize_verify_if_present = required
    .filter(r => r.severity_on_fail === 'verify_if_present' && UNFORGEABLE_CHECKS.has(r.check))
    .map(r => r.check);

  const templateChecks = new Map<string, ArtifactTemplate['applies_when']>();
  for (const check of finalize_required) templateChecks.set(check, 'finalize_required');
  for (const check of finalize_verify_if_present) templateChecks.set(check, 'finalize_verify_if_present');
  for (const check of optional.map(o => o.check)) {
    if (!templateChecks.has(check)) templateChecks.set(check, 'optional');
  }

  const artifact_templates = [...templateChecks.entries()]
    .map(([check, appliesWhen]) => templateForCheck(check, appliesWhen))
    .filter((template): template is ArtifactTemplate => template !== null);

  const finalize_checklist = artifact_templates
    .filter(template => template.applies_when === 'finalize_required')
    .map(template => `${template.check}: provide ${template.required_fields.join(', ')}`);

  return { required, optional, finalize_required, finalize_verify_if_present, artifact_templates, finalize_checklist };
}
