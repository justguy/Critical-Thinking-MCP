/**
 * Orchestrator policy layer.
 *
 * Output states:
 *   PASS         — every routed tool returned PASS, no warnings
 *   WARN         — every routed tool returned PASS, warnings present
 *   REVISE       — routed failures, or clustered routed warnings, on iteration 1
 *   HUMAN_REVIEW — routed failures, or clustered routed warnings, on iteration ≥ 2
 *
 * Hard rules:
 *   - At most one revision pass. The orchestrator does not loop.
 *   - On iteration 2+ with any failure, escalate to HUMAN_REVIEW. Do not
 *     emit a second REVISE for the same answer family.
 *   - Schema-validation failures count as failures, but their failure_source
 *     is `schema`, not `deterministic_tool`.
 */

import { isSchemaFailure } from './schemaValidation.js';
import { evaluateCalibrationGates } from './calibration.js';
import type {
  CalibrationGateIssue,
  CalibrationProfile,
  CritiquePacket,
  CritiqueRoute,
  CrossToolInvariantViolation,
  PolicyDecision,
  ReviewContext,
  RouteOrFailure,
} from './types.js';

export interface PolicyResult {
  decision: PolicyDecision;
  critique?: CritiquePacket;
  calibration_gate_failures?: CalibrationGateIssue[];
}

const WARNING_ROUTE_REVISION_THRESHOLD = 2;

function isFailure(r: RouteOrFailure): boolean {
  return r.status === 'ENFORCEMENT_FAIL';
}

function getWarningRoutes(results: RouteOrFailure[]): RouteOrFailure[] {
  return results.filter(r => {
    if (isSchemaFailure(r)) return false;
    return (r.enforcement?.warnings?.length ?? 0) > 0;
  });
}

function buildCritiquePacket(
  problemRoutes: RouteOrFailure[],
  calibrationGateFailures: CalibrationGateIssue[] = [],
  crossToolViolations: CrossToolInvariantViolation[] = [],
): CritiquePacket {
  const failingRoutes: CritiqueRoute[] = problemRoutes.map(f => {
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

  for (const gateFailure of calibrationGateFailures) {
    failingRoutes.push({
      tool: gateFailure.tool,
      blocking_issues: [gateFailure.description],
      warnings: [],
      contract_failures: [],
      failure_source: 'calibration_policy',
    });
  }

  for (const violation of crossToolViolations) {
    failingRoutes.push({
      tool: '__cross_tool__',
      blocking_issues:
        violation.severity === 'blocking' ? [violation.description] : [],
      warnings: violation.severity === 'warning' ? [violation.description] : [],
      contract_failures: [],
      failure_source: 'cross_tool_invariant',
    });
  }

  const allBlocking = failingRoutes.flatMap(r => r.blocking_issues);
  const allWarnings = failingRoutes.flatMap(r => r.warnings);
  const saferTarget =
    allBlocking.length > 0
      ? `Address these issues before resubmitting: ${allBlocking.join('; ')}`
      : allWarnings.length > 0
        ? `Address these warnings before resubmitting: ${allWarnings.join('; ')}`
        : 'Re-examine the failing routes and submit a corrected answer envelope.';

  return {
    failing_routes: failingRoutes,
    safer_revision_target: saferTarget,
  };
}

export function evaluatePolicy(
  routeResults: RouteOrFailure[],
  reviewContext: ReviewContext,
  profile?: CalibrationProfile,
  crossToolViolations: CrossToolInvariantViolation[] = [],
): PolicyResult {
  const failures = routeResults.filter(isFailure);
  const warningRoutes = getWarningRoutes(routeResults);
  const blockingCrossToolViolations = crossToolViolations.filter(
    violation => violation.severity === 'blocking',
  );
  const warningThreshold =
    profile?.warning_route_revision_threshold ??
    WARNING_ROUTE_REVISION_THRESHOLD;
  const warningClusterNeedsRevision =
    warningRoutes.length >= warningThreshold;
  const calibrationGateFailures = evaluateCalibrationGates(
    routeResults,
    profile,
  );

  const iteration = reviewContext.iteration_number;
  const shouldRevise =
    failures.length > 0 ||
    warningClusterNeedsRevision ||
    calibrationGateFailures.length > 0 ||
    blockingCrossToolViolations.length > 0;
  const problemRoutes =
    failures.length > 0 ? failures : warningClusterNeedsRevision ? warningRoutes : [];

  if (
    iteration >= 2 &&
    failures.length === 0 &&
    calibrationGateFailures.length === 0 &&
    blockingCrossToolViolations.length === 0 &&
    warningRoutes.length === 1
  ) {
    return {
      decision: 'WARN',
      calibration_gate_failures: [],
    };
  }

  if (shouldRevise && iteration >= 2) {
    return {
      decision: 'HUMAN_REVIEW',
      critique: buildCritiquePacket(
        problemRoutes,
        calibrationGateFailures,
        blockingCrossToolViolations,
      ),
      calibration_gate_failures: calibrationGateFailures,
    };
  }

  if (shouldRevise) {
    return {
      decision: 'REVISE',
      critique: buildCritiquePacket(
        problemRoutes,
        calibrationGateFailures,
        blockingCrossToolViolations,
      ),
      calibration_gate_failures: calibrationGateFailures,
    };
  }

  return {
    decision: warningRoutes.length > 0 ? 'WARN' : 'PASS',
    calibration_gate_failures: [],
  };
}
