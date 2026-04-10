import type {
  CalibrationGateIssue,
  CalibrationProfile,
  CalibrationRuntimeContext,
  OrchestratorResult,
  OrchestratorToolName,
  RouteOrFailure,
  RouteResult,
} from './types.js';
import { isSchemaFailure } from './schemaValidation.js';

export interface CalibrationMetricObservation {
  scope: 'routed' | 'shadow' | 'summary';
  tool: OrchestratorToolName | '__summary__';
  metric_name: string;
  metric_value: number;
}

const DEFAULT_CALIBRATION_PROFILES: CalibrationProfile[] = [
  {
    profile_id: 'default.unscoped.v1',
    selectors: {},
    warning_route_revision_threshold: 2,
    metric_gates: {},
    prune_raw_run_days: 30,
  },
  {
    profile_id: 'sonnet.default.v1',
    selectors: { model: 'sonnet' },
    warning_route_revision_threshold: 2,
    metric_gates: {
      validate_confidence: {
        require_no_inflation: true,
        max_gap: 0.15,
      },
      score_response_quality: {
        min_overall_score: 0.45,
      },
    },
    prune_raw_run_days: 30,
  },
  {
    profile_id: 'claude-sonnet-4-6.default.v1',
    selectors: { model: 'claude-sonnet-4-6' },
    warning_route_revision_threshold: 2,
    metric_gates: {
      validate_confidence: {
        require_no_inflation: true,
        max_gap: 0.15,
      },
      score_response_quality: {
        min_overall_score: 0.45,
      },
    },
    prune_raw_run_days: 30,
  },
  {
    profile_id: 'claude-sonnet-4-6.forecasting.v1',
    selectors: {
      model: 'claude-sonnet-4-6',
      prompt_family: 'forecasting',
    },
    warning_route_revision_threshold: 1,
    metric_gates: {
      validate_confidence: {
        require_no_inflation: true,
        max_gap: 0.1,
        min_falsifiability_score: 0.6,
      },
      validate_reasoning_chain: {
        min_grounding_score: 0.5,
      },
      score_response_quality: {
        min_overall_score: 0.5,
        min_specificity_score: 0.015,
      },
    },
    prune_raw_run_days: 30,
  },
  {
    profile_id: 'claude-sonnet-4-6.humor_forward.v1',
    selectors: {
      model: 'claude-sonnet-4-6',
      prompt_family: 'humor_forward',
    },
    warning_route_revision_threshold: 1,
    metric_gates: {
      validate_confidence: {
        require_no_inflation: true,
      },
      score_response_quality: {
        min_overall_score: 0.45,
        min_structure_score: 0.25,
      },
    },
    prune_raw_run_days: 30,
  },
  {
    profile_id: 'claude-sonnet-4-6.absurd_sla.v1',
    selectors: {
      model: 'claude-sonnet-4-6',
      prompt_family: 'absurd_sla',
    },
    warning_route_revision_threshold: 1,
    metric_gates: {
      validate_confidence: {
        require_no_inflation: true,
      },
      score_response_quality: {
        min_overall_score: 0.45,
        min_structure_score: 0.25,
      },
    },
    prune_raw_run_days: 30,
  },
  {
    profile_id: 'claude-sonnet-4-6.refutation.v1',
    selectors: {
      model: 'claude-sonnet-4-6',
      prompt_family: 'refutation',
    },
    warning_route_revision_threshold: 1,
    metric_gates: {
      validate_reasoning_chain: {
        min_grounding_score: 0.5,
      },
      score_response_quality: {
        min_overall_score: 0.45,
      },
    },
    prune_raw_run_days: 30,
  },
  {
    profile_id: 'claude-sonnet-4-6.causal_refutation.v1',
    selectors: {
      model: 'claude-sonnet-4-6',
      prompt_family: 'causal_refutation',
    },
    warning_route_revision_threshold: 2,
    metric_gates: {
      validate_confidence: {
        require_no_inflation: true,
      },
      score_response_quality: {
        min_overall_score: 0.45,
        min_structure_score: 0.1,
      },
    },
    prune_raw_run_days: 30,
  },
  {
    profile_id: 'claude-sonnet-4-6.causal.v1',
    selectors: {
      model: 'claude-sonnet-4-6',
      prompt_family: 'causal',
    },
    warning_route_revision_threshold: 1,
    metric_gates: {
      validate_reasoning_chain: {
        min_grounding_score: 0.55,
      },
      score_response_quality: {
        min_overall_score: 0.45,
        min_structure_score: 0.25,
      },
    },
    prune_raw_run_days: 30,
  },
  {
    profile_id: 'claude-sonnet-4-6.operational_claim.v1',
    selectors: {
      model: 'claude-sonnet-4-6',
      prompt_family: 'operational_claim',
    },
    warning_route_revision_threshold: 2,
    metric_gates: {
      validate_confidence: {
        require_no_inflation: true,
        max_gap: 0.15,
      },
      score_response_quality: {
        min_overall_score: 0.45,
      },
    },
    prune_raw_run_days: 30,
  },
];

function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}

function scoreProfileMatch(
  profile: CalibrationProfile,
  runtime: CalibrationRuntimeContext,
): number {
  let score = 0;
  const model = normaliseKey(runtime.model);
  const promptFamily = runtime.prompt_family
    ? normaliseKey(runtime.prompt_family)
    : null;
  const sessionMode = runtime.session_mode;

  if (profile.selectors.model) {
    if (normaliseKey(profile.selectors.model) !== model) return -1;
    score += 4;
  }
  if (profile.selectors.prompt_family) {
    if (!promptFamily) return -1;
    if (normaliseKey(profile.selectors.prompt_family) !== promptFamily) return -1;
    score += 2;
  }
  if (profile.selectors.session_mode) {
    if (profile.selectors.session_mode !== sessionMode) return -1;
    score += 1;
  }
  return score;
}

export function resolveCalibrationProfile(
  runtime: CalibrationRuntimeContext,
): CalibrationProfile {
  if (runtime.profile_id) {
    const explicit = DEFAULT_CALIBRATION_PROFILES.find(
      p => p.profile_id === runtime.profile_id,
    );
    if (explicit) return explicit;
  }

  let best = DEFAULT_CALIBRATION_PROFILES[0];
  let bestScore = -1;
  for (const profile of DEFAULT_CALIBRATION_PROFILES) {
    const score = scoreProfileMatch(profile, runtime);
    if (score > bestScore) {
      best = profile;
      bestScore = score;
    }
  }
  return best;
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toBooleanNumber(value: unknown): number | null {
  return typeof value === 'boolean' ? (value ? 1 : 0) : null;
}

function toArrayLength(value: unknown): number | null {
  return Array.isArray(value) ? value.length : null;
}

function pushIfNumber(
  observations: CalibrationMetricObservation[],
  scope: CalibrationMetricObservation['scope'],
  tool: CalibrationMetricObservation['tool'],
  metricName: string,
  value: number | null,
): void {
  if (value === null) return;
  observations.push({
    scope,
    tool,
    metric_name: metricName,
    metric_value: value,
  });
}

function collectRouteMetrics(
  observations: CalibrationMetricObservation[],
  scope: 'routed' | 'shadow',
  route: RouteResult,
): void {
  const result = route.result as Record<string, unknown> | null;
  const enforcement = route.enforcement;

  pushIfNumber(
    observations,
    scope,
    route.tool,
    'warning_count',
    enforcement?.warnings.length ?? 0,
  );
  pushIfNumber(
    observations,
    scope,
    route.tool,
    'blocking_issue_count',
    enforcement?.blocking_issues.length ?? 0,
  );

  if (!result) return;

  switch (route.tool) {
    case 'validate_confidence':
      pushIfNumber(observations, scope, route.tool, 'honest_ceiling', toNumber(result.honest_ceiling));
      pushIfNumber(observations, scope, route.tool, 'claimed_confidence', toNumber(result.claimed_confidence));
      pushIfNumber(observations, scope, route.tool, 'gap', toNumber(result.gap));
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'inflation_detected',
        toBooleanNumber(result.inflation_detected),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'falsifiability_score',
        toNumber((result.falsifiability as Record<string, unknown> | undefined)?.score),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'assumption_count',
        toNumber(result.assumption_count),
      );
      break;

    case 'validate_reasoning_chain':
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'grounding_score',
        toNumber(result.grounding_score),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'cycle_count',
        toArrayLength(result.cycles),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'orphaned_conclusion_count',
        toArrayLength(result.orphaned_conclusions),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'node_count',
        toNumber(result.node_count),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'edge_count',
        toNumber(result.edge_count),
      );
      break;

    case 'check_plan_validity':
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'completeness_score',
        toNumber(result.completeness_score),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'circular_dependency_count',
        toArrayLength(result.circular_dependencies),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'missing_prerequisite_count',
        toArrayLength(result.missing_prerequisites),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'resource_conflict_count',
        toArrayLength(result.resource_conflicts),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'critical_path_length',
        toArrayLength(result.critical_path),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'step_count',
        toNumber(result.step_count),
      );
      break;

    case 'detect_concurrency_patterns':
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'hazard_count',
        toNumber(result.hazard_count),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'critical_count',
        toNumber(result.critical_count),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'has_protections',
        toBooleanNumber(result.has_protections),
      );
      break;

    case 'score_response_quality':
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'overall_score',
        toNumber(result.overall_score),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'substance_score',
        toNumber(result.substance_score),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'specificity_score',
        toNumber(result.specificity_score),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'hedge_density',
        toNumber(result.hedge_density),
      );
      pushIfNumber(
        observations,
        scope,
        route.tool,
        'structure_score',
        toNumber(result.structure_score),
      );
      break;
  }
}

export function collectCalibrationMetricObservations(
  result: OrchestratorResult,
): CalibrationMetricObservation[] {
  const observations: CalibrationMetricObservation[] = [];

  for (const route of result.route_results) {
    if (isSchemaFailure(route)) continue;
    collectRouteMetrics(observations, 'routed', route);
  }

  for (const route of result.shadow_results) {
    if (isSchemaFailure(route)) continue;
    collectRouteMetrics(observations, 'shadow', route);
  }

  pushIfNumber(observations, 'summary', '__summary__', 'routed_tool_count', result.telemetry.routed_tools.length);
  pushIfNumber(
    observations,
    'summary',
    '__summary__',
    'shadow_tool_count',
    result.telemetry.tools_executed_only_in_shadow.length,
  );
  pushIfNumber(
    observations,
    'summary',
    '__summary__',
    'schema_failure_count',
    result.telemetry.schema_failures.length,
  );
  pushIfNumber(
    observations,
    'summary',
    '__summary__',
    'would_have_escalated',
    result.telemetry.would_have_escalated ? 1 : 0,
  );
  pushIfNumber(
    observations,
    'summary',
    '__summary__',
    'metric_gate_failure_count',
    result.calibration?.metric_gate_failures.length ?? 0,
  );

  return observations;
}

export function normaliseToolCombo(result: OrchestratorResult): string {
  const tools = [...result.telemetry.tools_executed].sort();
  return tools.length > 0 ? tools.join('+') : 'none';
}

function makeIssue(
  tool: OrchestratorToolName,
  metricName: string,
  observedValue: number,
  requiredValue: number,
  comparator: '>=' | '<=',
): CalibrationGateIssue {
  return {
    tool,
    metric_name: metricName,
    observed_value: observedValue,
    required_value: requiredValue,
    comparator,
    description:
      comparator === '>='
        ? `Calibration gate requires ${tool}.${metricName} >= ${requiredValue}; observed ${observedValue}.`
        : `Calibration gate requires ${tool}.${metricName} <= ${requiredValue}; observed ${observedValue}.`,
  };
}

function pushMinGateIssue(
  issues: CalibrationGateIssue[],
  tool: OrchestratorToolName,
  metricName: string,
  observedValue: number | null,
  minValue: number | undefined,
): void {
  if (observedValue === null || minValue === undefined) return;
  if (observedValue < minValue) {
    issues.push(makeIssue(tool, metricName, observedValue, minValue, '>='));
  }
}

function pushMaxGateIssue(
  issues: CalibrationGateIssue[],
  tool: OrchestratorToolName,
  metricName: string,
  observedValue: number | null,
  maxValue: number | undefined,
): void {
  if (observedValue === null || maxValue === undefined) return;
  if (observedValue > maxValue) {
    issues.push(makeIssue(tool, metricName, observedValue, maxValue, '<='));
  }
}

function evaluateRouteAgainstProfile(
  issues: CalibrationGateIssue[],
  route: RouteResult,
  profile: CalibrationProfile,
): void {
  const result = route.result as Record<string, unknown> | null;
  if (!result) return;

  switch (route.tool) {
    case 'validate_confidence': {
      const gates = profile.metric_gates.validate_confidence;
      if (!gates) return;
      pushMaxGateIssue(issues, route.tool, 'gap', toNumber(result.gap), gates.max_gap);
      pushMinGateIssue(
        issues,
        route.tool,
        'falsifiability_score',
        toNumber((result.falsifiability as Record<string, unknown> | undefined)?.score),
        gates.min_falsifiability_score,
      );
      if (gates.require_no_inflation && result.inflation_detected === true) {
        issues.push(
          makeIssue(route.tool, 'inflation_detected', 1, 0, '<='),
        );
      }
      return;
    }

    case 'validate_reasoning_chain': {
      const gates = profile.metric_gates.validate_reasoning_chain;
      if (!gates) return;
      pushMinGateIssue(
        issues,
        route.tool,
        'grounding_score',
        toNumber(result.grounding_score),
        gates.min_grounding_score,
      );
      pushMaxGateIssue(
        issues,
        route.tool,
        'cycle_count',
        toArrayLength(result.cycles),
        gates.max_cycle_count,
      );
      pushMaxGateIssue(
        issues,
        route.tool,
        'orphaned_conclusion_count',
        toArrayLength(result.orphaned_conclusions),
        gates.max_orphaned_conclusions,
      );
      return;
    }

    case 'check_plan_validity': {
      const gates = profile.metric_gates.check_plan_validity;
      if (!gates) return;
      pushMinGateIssue(
        issues,
        route.tool,
        'completeness_score',
        toNumber(result.completeness_score),
        gates.min_completeness_score,
      );
      pushMaxGateIssue(
        issues,
        route.tool,
        'circular_dependency_count',
        toArrayLength(result.circular_dependencies),
        gates.max_circular_dependencies,
      );
      pushMaxGateIssue(
        issues,
        route.tool,
        'missing_prerequisite_count',
        toArrayLength(result.missing_prerequisites),
        gates.max_missing_prerequisites,
      );
      pushMaxGateIssue(
        issues,
        route.tool,
        'resource_conflict_count',
        toArrayLength(result.resource_conflicts),
        gates.max_resource_conflicts,
      );
      return;
    }

    case 'detect_concurrency_patterns': {
      const gates = profile.metric_gates.detect_concurrency_patterns;
      if (!gates) return;
      pushMaxGateIssue(
        issues,
        route.tool,
        'hazard_count',
        toNumber(result.hazard_count),
        gates.max_hazard_count,
      );
      pushMaxGateIssue(
        issues,
        route.tool,
        'critical_count',
        toNumber(result.critical_count),
        gates.max_critical_count,
      );
      if (gates.require_protections && result.has_protections === false) {
        issues.push(
          makeIssue(route.tool, 'has_protections', 0, 1, '>='),
        );
      }
      return;
    }

    case 'score_response_quality': {
      const gates = profile.metric_gates.score_response_quality;
      if (!gates) return;
      pushMinGateIssue(
        issues,
        route.tool,
        'overall_score',
        toNumber(result.overall_score),
        gates.min_overall_score,
      );
      pushMinGateIssue(
        issues,
        route.tool,
        'substance_score',
        toNumber(result.substance_score),
        gates.min_substance_score,
      );
      pushMinGateIssue(
        issues,
        route.tool,
        'specificity_score',
        toNumber(result.specificity_score),
        gates.min_specificity_score,
      );
      pushMinGateIssue(
        issues,
        route.tool,
        'structure_score',
        toNumber(result.structure_score),
        gates.min_structure_score,
      );
      pushMaxGateIssue(
        issues,
        route.tool,
        'hedge_density',
        toNumber(result.hedge_density),
        gates.max_hedge_density,
      );
      return;
    }
  }
}

export function evaluateCalibrationGates(
  routeResults: RouteOrFailure[],
  profile?: CalibrationProfile,
): CalibrationGateIssue[] {
  if (!profile) return [];

  const issues: CalibrationGateIssue[] = [];
  for (const route of routeResults) {
    if (isSchemaFailure(route)) continue;
    evaluateRouteAgainstProfile(issues, route, profile);
  }
  return issues;
}
