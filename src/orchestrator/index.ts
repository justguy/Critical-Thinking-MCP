/**
 * Orchestrator entrypoint.
 *
 * runOrchestrator(envelope) is the only function callers need. It:
 *
 *   1. validates the envelope schema (Ajv)              — fail-fast on bad input
 *   2. classifies the answer text (deterministic)       — router suggestion
 *   3. validates per-route contracts (Ajv)              — fail before tool call
 *   4. executes routed deterministic tools              — standard mode
 *   5. executes shadow-eligible tools observationally   — shadow mode
 *   6. applies the policy layer to the routed set only  — REVISE / HUMAN_REVIEW
 *   7. emits machine-readable shadow telemetry          — calibration data
 *
 * Shadow mode never changes the routed decision. Schema failures are
 * orchestration failures — the deterministic tool is not invoked.
 */

import { TOOL_TO_CONTRACT_KEY } from './contracts.js';
import { evaluatePolicy } from './policy.js';
import { routeEnvelope } from './router.js';
import { executeRoute } from './review.js';
import {
  isSchemaFailure,
  validateOrchestratorEnvelope,
} from './schemaValidation.js';
import { buildTelemetry } from './shadowTelemetry.js';
import type {
  OrchestratorEnvelope,
  OrchestratorMode,
  OrchestratorResult,
  OrchestratorToolName,
  PolicyDecision,
  RouteOrFailure,
} from './types.js';

function envelopeFailureResult(
  envelope: Partial<OrchestratorEnvelope>,
  errors: Array<{ path: string; message: string }>,
): OrchestratorResult {
  const mode: OrchestratorMode =
    envelope.mode === 'shadow' ? 'shadow' : 'routed';
  const iteration = envelope.review_context?.iteration_number ?? 1;
  const policyDecision: PolicyDecision = iteration >= 2 ? 'HUMAN_REVIEW' : 'REVISE';

  return {
    schema_version: 'orchestrator_v0',
    mode,
    policy_decision: policyDecision,
    route_results: [],
    shadow_results: [],
    critique: {
      failing_routes: [
        {
          tool: '__envelope__',
          blocking_issues: errors.map(e => `${e.path}: ${e.message}`),
          warnings: [],
          contract_failures: errors.map(e => `${e.path}: ${e.message}`),
          failure_source: 'schema',
        },
      ],
      safer_revision_target:
        'Fix the orchestrator envelope schema errors before resubmitting.',
    },
    telemetry: {
      mode,
      router_primary_type: 'unknown',
      router_secondary_type: null,
      routed_tools: [],
      artifact_compatible_tools: [],
      tools_executed: [],
      tools_executed_only_in_shadow: [],
      shadow_only_findings: [],
      schema_failures: [],
      policy_decision: policyDecision,
      iteration_number: iteration,
      would_have_escalated: false,
    },
  };
}

export function runOrchestrator(envelope: OrchestratorEnvelope): OrchestratorResult {
  // 1. Validate the envelope.
  const envelopeValidation = validateOrchestratorEnvelope(envelope);
  if (!envelopeValidation.valid) {
    return envelopeFailureResult(envelope, envelopeValidation.errors);
  }

  // 2. Route the envelope through the deterministic classifier.
  const routing = routeEnvelope(envelope);

  // 3. Build the working sets for routed vs shadow execution.
  const routedSet = new Set<OrchestratorToolName>(routing.routed_tools);
  const routeResults: RouteOrFailure[] = [];
  const shadowResults: RouteOrFailure[] = [];

  // Standard mode runs only the routed intersection.
  for (const tool of routing.routed_tools) {
    const contractKey = TOOL_TO_CONTRACT_KEY[tool];
    const contract = envelope.contracts[contractKey];
    routeResults.push(executeRoute(tool, contract, envelope.review_context));
  }

  // Shadow mode also runs every artifact-compatible tool that wasn't routed.
  // Shadow runs are observational — they never re-enter the policy layer.
  if (envelope.mode === 'shadow') {
    for (const tool of routing.artifact_compatible_tools) {
      if (routedSet.has(tool)) continue;
      const contractKey = TOOL_TO_CONTRACT_KEY[tool];
      const contract = envelope.contracts[contractKey];
      shadowResults.push(executeRoute(tool, contract, envelope.review_context));
    }
  }

  // 4. Policy evaluates the ROUTED results only. Shadow results never leak
  //    into the policy decision — that is the entire point of shadow mode.
  const policy = evaluatePolicy(routeResults, envelope.review_context);

  // 5. Telemetry is built last so it can describe everything that happened,
  //    including shadow runs and any schema failures observed in either set.
  const telemetry = buildTelemetry({
    mode: envelope.mode,
    primaryType: routing.primary_type,
    secondaryType: routing.secondary_type,
    routedTools: routing.routed_tools,
    artifactCompatibleTools: routing.artifact_compatible_tools,
    routeResults,
    shadowResults,
    policyDecision: policy.decision,
    reviewContext: envelope.review_context,
  });

  return {
    schema_version: 'orchestrator_v0',
    mode: envelope.mode,
    policy_decision: policy.decision,
    route_results: routeResults,
    shadow_results: shadowResults,
    critique: policy.critique,
    telemetry,
  };
}

// Re-exports for callers that want internals.
export { routeEnvelope } from './router.js';
export { evaluatePolicy } from './policy.js';
export { executeRoute } from './review.js';
export { buildTelemetry } from './shadowTelemetry.js';
export {
  validateOrchestratorEnvelope,
  validateConfidenceContract,
  validateReasoningChainContract,
  validatePlanContract,
  validateConcurrencyContract,
  validateQualityContract,
  isSchemaFailure,
} from './schemaValidation.js';
export {
  TOOL_TO_CONTRACT,
  CONTRACT_TO_TOOL,
  CONTRACT_KEY_TO_TYPE,
  TOOL_TO_CONTRACT_KEY,
} from './contracts.js';
export type {
  OrchestratorEnvelope,
  OrchestratorResult,
  OrchestratorMode,
  OrchestratorToolName,
  PolicyDecision,
  ContractType,
  ContractKey,
  ReviewContext,
  PriorFailure,
  RouteResult,
  SchemaFailure,
  RouteOrFailure,
  ShadowTelemetry,
  CritiquePacket,
  ConfidenceContract,
  ReasoningChainContract,
  PlanContract,
  ConcurrencyContract,
  QualityContract,
} from './types.js';
