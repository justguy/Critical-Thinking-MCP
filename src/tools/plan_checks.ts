/**
 * plan_checks — deterministic planner tool.
 *
 * Maps a deliverable_contract to the required/optional check suite and the
 * finalize_required subset. Pure lookup + policy; NEVER blocks (status always PASS).
 * It plans; finalize_deliverable does the blocking on unforgeable signals.
 *
 * No LLM calls.
 */

import { planChecks } from '../enforcement/check_planner.js';
import { computePlanToken } from '../enforcement/plan_token.js';
import type {
  DeliverableContract,
  EnforcementContext,
  EvidenceLevel,
  PlanResult,
  RiskLevel,
  TaskType,
} from '../enforcement/types.js';

const TASK_TYPES = new Set([
  'factual_qa',
  'numeric_analysis',
  'planning',
  'decision',
  'concurrency_design',
  'reasoning',
  'freeform',
]);
const EVIDENCE_LEVELS = new Set(['none', 'asserted', 'cited', 'rederived']);
const RISK_LEVELS = new Set(['low', 'medium', 'high']);

export interface PlanChecksOutput extends PlanResult {
  status: 'PASS';
  task_type: TaskType;
  context_used: boolean;
  /**
   * Deterministic contract-identity token (§3.1). Issued ONLY when a full
   * contract (with contract_id + original_request_text) is supplied. Copy it into
   * finalize_deliverable.plan_token; finalize recomputes it from the contract it
   * actually checks and BLOCKS if they disagree — binding the planned contract to
   * the finalized one even for a raw MCP client. Absent for a bare
   * task_type/evidence_level/risk_level probe (no contract to bind to).
   */
  plan_token?: string;
}

function validateInput(input: unknown): {
  task_type: TaskType;
  evidence_level: EvidenceLevel;
  risk_level: RiskLevel;
  freshness?: { max_age_seconds: number; requires_dated_sources: boolean };
} {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with a "contract" (or top-level task_type/evidence_level/risk_level).',
    );
  }
  const obj = input as Record<string, unknown>;
  const c = (obj.contract && typeof obj.contract === 'object' ? obj.contract : obj) as Record<
    string,
    unknown
  >;

  if (typeof c.task_type !== 'string' || !TASK_TYPES.has(c.task_type)) {
    throw new Error(
      `Invalid "task_type": "${String(c.task_type)}". Must be one of: ${[...TASK_TYPES].join(', ')}.`,
    );
  }
  if (typeof c.evidence_level !== 'string' || !EVIDENCE_LEVELS.has(c.evidence_level)) {
    throw new Error(
      `Invalid "evidence_level": "${String(c.evidence_level)}". Must be one of: ${[...EVIDENCE_LEVELS].join(', ')}.`,
    );
  }
  if (typeof c.risk_level !== 'string' || !RISK_LEVELS.has(c.risk_level)) {
    throw new Error(
      `Invalid "risk_level": "${String(c.risk_level)}". Must be one of: ${[...RISK_LEVELS].join(', ')}.`,
    );
  }

  const freshness =
    c.freshness && typeof c.freshness === 'object' && typeof (c.freshness as any).max_age_seconds === 'number'
      ? {
          max_age_seconds: (c.freshness as any).max_age_seconds as number,
          requires_dated_sources: (c.freshness as any).requires_dated_sources === true,
        }
      : undefined;

  return {
    task_type: c.task_type as TaskType,
    evidence_level: c.evidence_level as EvidenceLevel,
    risk_level: c.risk_level as RiskLevel,
    freshness,
  };
}

/**
 * Issue a plan_token ONLY when the caller supplied a full contract identity — a
 * contract_id + original_request_text. A bare profile probe
 * ({task_type, evidence_level, risk_level}) has no contract to bind to, so no token.
 */
function planTokenFor(input: unknown, profile: {
  task_type: TaskType;
  evidence_level: EvidenceLevel;
  risk_level: RiskLevel;
  freshness?: { max_age_seconds: number; requires_dated_sources: boolean };
}): string | undefined {
  if (input === null || typeof input !== 'object') return undefined;
  const obj = input as Record<string, unknown>;
  const c = (obj.contract && typeof obj.contract === 'object' ? obj.contract : obj) as Record<string, unknown>;
  if (typeof c.contract_id !== 'string' || c.contract_id.length === 0) return undefined;
  if (typeof c.original_request_text !== 'string' || c.original_request_text.length === 0) return undefined;

  // Build the obligation-bearing identity from the SAME fields finalize will hash.
  const contract = {
    contract_id: c.contract_id,
    contract_authority: c.contract_authority,
    profile_source: c.profile_source,
    original_request_text: c.original_request_text,
    task_type: profile.task_type,
    evidence_level: profile.evidence_level,
    risk_level: profile.risk_level,
    freshness: profile.freshness,
    claims: c.claims,
    must_include: c.must_include,
    must_not_include: c.must_not_include,
    required_fields: c.required_fields,
    constraints: c.constraints,
    acceptance_criteria: c.acceptance_criteria,
  } as DeliverableContract;
  return computePlanToken(contract);
}

export function handlePlanChecks(input: unknown): PlanChecksOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { task_type, evidence_level, risk_level, freshness } = validateInput(input);
  const plan = planChecks({ task_type, evidence_level, risk_level, freshness });
  const plan_token = planTokenFor(input, { task_type, evidence_level, risk_level, freshness });

  return {
    status: 'PASS',
    task_type,
    required: plan.required,
    optional: plan.optional,
    finalize_required: plan.finalize_required,
    finalize_verify_if_present: plan.finalize_verify_if_present,
    artifact_templates: plan.artifact_templates,
    finalize_checklist: plan.finalize_checklist,
    context_used: !!context,
    ...(plan_token ? { plan_token } : {}),
  };
}
