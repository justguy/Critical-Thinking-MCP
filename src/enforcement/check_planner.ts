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

/** Map a claim_classifier primary type to a deliverable task type. */
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

  // high risk pulls the first unforgeable optional check into required.
  const optional = profile.optional.map(check => ({
    check,
    reason: `Optional for task_type='${contract.task_type}'.`,
  }));

  if (contract.risk_level === 'high') {
    const promote = profile.optional.find(c => UNFORGEABLE_CHECKS.has(c));
    if (promote && !required.some(r => r.check === promote)) {
      required.push({
        check: promote,
        severity_on_fail: 'blocking',
        reason: `Promoted from optional → required because risk_level='high'.`,
      });
    }
  }

  // freshness present → check_freshness is required; blocking iff dated sources are required
  // (a stale/future source is then an arithmetic fact, unforgeable, at the caller-supplied eval time).
  if (contract.freshness && !required.some(r => r.check === 'check_freshness')) {
    required.push({
      check: 'check_freshness',
      severity_on_fail: contract.freshness.requires_dated_sources ? 'blocking' : 'warning',
      reason: `Contract declares a freshness window (max_age_seconds=${contract.freshness.max_age_seconds}).`,
    });
  }

  const finalize_required = required
    .filter(r => r.severity_on_fail === 'blocking' && UNFORGEABLE_CHECKS.has(r.check))
    .map(r => r.check);

  return { required, optional, finalize_required };
}
