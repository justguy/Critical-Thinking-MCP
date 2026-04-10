/**
 * Shadow telemetry builder.
 *
 * Telemetry is observational only. It must not change the routed-mode
 * decision. Its job is to answer one question:
 *
 *   "what did shadow mode find that routed mode would have missed?"
 *
 * The orchestrator surfaces both routed and shadow tool executions, but
 * the policy layer evaluates only the routed set. `would_have_escalated`
 * captures shadow-only findings that would have changed the outcome had
 * they been part of the routed set under the current policy.
 */

import { evaluatePolicy } from './policy.js';
import { isSchemaFailure } from './schemaValidation.js';
import type {
  CalibrationProfile,
  OrchestratorMode,
  OrchestratorToolName,
  PolicyDecision,
  ReviewContext,
  RouteOrFailure,
  RouteResult,
  SchemaFailureSummary,
  ShadowOnlyFinding,
  ShadowTelemetry,
} from './types.js';

export interface BuildTelemetryParams {
  mode: OrchestratorMode;
  primaryType: string;
  secondaryType: string | null;
  answerText: string;
  routedTools: OrchestratorToolName[];
  artifactCompatibleTools: OrchestratorToolName[];
  routeResults: RouteOrFailure[];
  shadowResults: RouteOrFailure[];
  policyDecision: PolicyDecision;
  reviewContext: ReviewContext;
  profile?: CalibrationProfile;
  sessionDepth: number;
}

function summariseFinding(result: RouteResult): string {
  if (result.status === 'ENFORCEMENT_FAIL') {
    const blocking = result.enforcement?.blocking_issues ?? [];
    if (blocking.length > 0) {
      return `Shadow-only ENFORCEMENT_FAIL: ${blocking
        .map(b => `${b.mechanism}: ${b.description}`)
        .join(' | ')}`;
    }
    return `Shadow-only ENFORCEMENT_FAIL on ${result.tool}`;
  }
  const warnings = result.enforcement?.warnings ?? [];
  if (warnings.length > 0) {
    return `Shadow-only WARN: ${warnings.join(' | ')}`;
  }
  return `Shadow-only PASS on ${result.tool}`;
}

function getFindingStatus(result: RouteResult): ShadowOnlyFinding['status'] {
  if (result.status === 'ENFORCEMENT_FAIL') return 'ENFORCEMENT_FAIL';
  if ((result.enforcement?.warnings?.length ?? 0) > 0) return 'WARN';
  return 'PASS';
}

export function buildTelemetry(params: BuildTelemetryParams): ShadowTelemetry {
  const {
    mode,
    primaryType,
    secondaryType,
    answerText,
    routedTools,
    artifactCompatibleTools,
    routeResults,
    shadowResults,
    policyDecision,
    reviewContext,
    profile,
    sessionDepth,
  } = params;

  // tools_executed records deterministic tool executions only.
  // Schema-failed routes are excluded because the tool itself never ran; those
  // failures are surfaced separately in schema_failures.
  const executedFromRouted = routeResults
    .filter(r => !isSchemaFailure(r))
    .map(r => r.tool);
  const executedFromShadow = shadowResults
    .filter(r => !isSchemaFailure(r))
    .map(r => r.tool);

  const toolsExecuted = Array.from(
    new Set([...executedFromRouted, ...executedFromShadow]),
  );

  const routedSet = new Set(routedTools);

  const toolsExecutedOnlyInShadow = executedFromShadow.filter(
    t => !routedSet.has(t),
  );

  const shadowOnlyFindings: ShadowOnlyFinding[] = shadowResults
    .filter((r): r is RouteResult => !isSchemaFailure(r) && !routedSet.has(r.tool))
    .map(r => ({
      tool: r.tool,
      status: getFindingStatus(r),
      summary: summariseFinding(r),
    }));

  const schemaFailureMap = new Map<string, SchemaFailureSummary>();
  for (const r of [...routeResults, ...shadowResults]) {
    if (!isSchemaFailure(r)) continue;
    schemaFailureMap.set(r.tool, {
      tool: r.tool,
      contract_type: r.contract_type,
      errors: r.validation_errors.map(e => `${e.path}: ${e.message}`),
    });
  }

  const shadowOnlyDecision =
    shadowResults.length > 0
      ? evaluatePolicy(shadowResults, reviewContext, profile, [], {
          answer_text: answerText,
        }).decision
      : 'PASS';
  const wouldHaveEscalated =
    shadowOnlyDecision === 'REVISE' || shadowOnlyDecision === 'HUMAN_REVIEW';

  return {
    mode,
    router_primary_type: primaryType,
    router_secondary_type: secondaryType,
    routed_tools: routedTools,
    artifact_compatible_tools: artifactCompatibleTools,
    tools_executed: toolsExecuted,
    tools_executed_only_in_shadow: toolsExecutedOnlyInShadow,
    shadow_only_findings: shadowOnlyFindings,
    schema_failures: Array.from(schemaFailureMap.values()),
    policy_decision: policyDecision,
    iteration_number: reviewContext.iteration_number,
    session_depth: sessionDepth,
    would_have_escalated: wouldHaveEscalated,
  };
}
