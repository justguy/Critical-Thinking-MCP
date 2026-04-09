/**
 * Orchestrator policy layer.
 *
 * Output states:
 *   PASS         — every routed tool returned PASS, no warnings
 *   WARN         — every routed tool returned PASS, warnings present
 *   REVISE       — at least one routed tool returned ENFORCEMENT_FAIL on iteration 1
 *   HUMAN_REVIEW — at least one routed tool returned ENFORCEMENT_FAIL on iteration ≥ 2
 *
 * Hard rules:
 *   - At most one revision pass. The orchestrator does not loop.
 *   - On iteration 2+ with any failure, escalate to HUMAN_REVIEW. Do not
 *     emit a second REVISE for the same answer family.
 *   - Schema-validation failures count as failures, but their failure_source
 *     is `schema`, not `deterministic_tool`.
 */

import { isSchemaFailure } from './schemaValidation.js';
import type {
  CritiquePacket,
  CritiqueRoute,
  PolicyDecision,
  ReviewContext,
  RouteOrFailure,
} from './types.js';

export interface PolicyResult {
  decision: PolicyDecision;
  critique?: CritiquePacket;
}

function isFailure(r: RouteOrFailure): boolean {
  return r.status === 'ENFORCEMENT_FAIL';
}

function hasWarnings(results: RouteOrFailure[]): boolean {
  return results.some(r => {
    if (isSchemaFailure(r)) return false;
    return (r.enforcement?.warnings?.length ?? 0) > 0;
  });
}

function buildCritiquePacket(failures: RouteOrFailure[]): CritiquePacket {
  const failingRoutes: CritiqueRoute[] = failures.map(f => {
    if (isSchemaFailure(f)) {
      const errStrings = f.validation_errors.map(e => `${e.path}: ${e.message}`);
      return {
        tool: f.tool,
        blocking_issues: errStrings,
        warnings: [],
        contract_failures: errStrings,
        failure_source: 'schema',
      };
    }

    const blocking = f.enforcement?.blocking_issues?.map(b => b.description) ?? [];
    const warnings = f.enforcement?.warnings ?? [];

    return {
      tool: f.tool,
      blocking_issues: blocking,
      warnings,
      contract_failures: [],
      failure_source: 'deterministic_tool',
    };
  });

  const allBlocking = failingRoutes.flatMap(r => r.blocking_issues);
  const saferTarget =
    allBlocking.length > 0
      ? `Address these issues before resubmitting: ${allBlocking.join('; ')}`
      : 'Re-examine the failing routes and submit a corrected answer envelope.';

  return {
    failing_routes: failingRoutes,
    safer_revision_target: saferTarget,
  };
}

export function evaluatePolicy(
  routeResults: RouteOrFailure[],
  reviewContext: ReviewContext,
): PolicyResult {
  const failures = routeResults.filter(isFailure);

  if (failures.length === 0) {
    return {
      decision: hasWarnings(routeResults) ? 'WARN' : 'PASS',
    };
  }

  // Failures present. Iteration 1 → one revise pass.
  // Iteration ≥ 2 → escalate. No second revise loop is allowed.
  const iteration = reviewContext.iteration_number;

  if (iteration >= 2) {
    return {
      decision: 'HUMAN_REVIEW',
      critique: buildCritiquePacket(failures),
    };
  }

  return {
    decision: 'REVISE',
    critique: buildCritiquePacket(failures),
  };
}
