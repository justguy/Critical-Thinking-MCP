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

import { evaluateCalibrationGates } from './calibration.js';
import { classifyOperationalFrameworkFromAnswer } from './questionClassifier.js';
import { isSchemaFailure } from './schemaValidation.js';
import type {
  CalibrationGateIssue,
  CalibrationProfile,
  CritiquePacket,
  CritiqueRoute,
  CrossToolInvariantViolation,
  PolicyDecision,
  QuestionFamily,
  ReviewContext,
  RouteOrFailure,
} from './types.js';

export interface PolicyResult {
  decision: PolicyDecision;
  critique?: CritiquePacket;
  calibration_gate_failures?: CalibrationGateIssue[];
}

export interface PolicyEvaluationContext {
  answer_text?: string;
  answer_family?: QuestionFamily;
  answer_family_confidence?: number;
  answer_family_signals?: string[];
}

const WARNING_ROUTE_REVISION_THRESHOLD = 2;
const CRITIQUE_FORMATTING_OVERRIDE =
  'Do not apologize. Do not output conversational filler. Output only the requested JSON structure.';
const ANTI_YAP_SCOPE_CAP =
  'CRITIQUE OVERRIDE: You must output the corrected response in under 150 words. Do NOT apologize. Do NOT explain your reasoning. State the refusal or the corrected logic directly and stop.';
const ANTI_YAP_MAX_WORDS = 150;
const REVISION_BLOAT_RATIO_LIMIT = 1.2;
const INVALID_PREMISE_PROMPT_FAMILIES = new Set([
  'absurd_sla',
  'forecasting',
  'humor_forward',
]);
const CONTEXT_SWITCH_LENIENT_PROMPT_FAMILIES = new Set([
  'forecasting',
  'humor_forward',
]);

function isFailure(r: RouteOrFailure): boolean {
  return r.status === 'ENFORCEMENT_FAIL';
}

function getWarningRoutes(results: RouteOrFailure[]): RouteOrFailure[] {
  return results.filter(r => {
    if (isSchemaFailure(r)) return false;
    return (r.enforcement?.warnings?.length ?? 0) > 0;
  });
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(trimmed);
  }

  return deduped;
}

function normalisePromptFamily(promptFamily?: string): string | undefined {
  const trimmed = promptFamily?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isInvalidPremisePromptFamily(promptFamily?: string): boolean {
  const normalised = normalisePromptFamily(promptFamily);
  return normalised ? INVALID_PREMISE_PROMPT_FAMILIES.has(normalised) : false;
}

function isContextSwitchLenientPromptFamily(promptFamily?: string): boolean {
  const normalised = normalisePromptFamily(promptFamily);
  return normalised
    ? CONTEXT_SWITCH_LENIENT_PROMPT_FAMILIES.has(normalised)
    : false;
}

function buildFalsifiabilityDirective(): string {
  return 'CRITIQUE: Your assumptions cannot be falsified. You MUST provide at least one condition under which this architecture or claim would fail.';
}

function buildSpecificityDirective(promptFamily?: string): string {
  if (isInvalidPremisePromptFamily(promptFamily)) {
    return 'CRITIQUE: You are explaining an impossible or unserious premise. Do not add invented details. You MUST explicitly state why the premise is logically invalid and narrow to the remaining supportable claim.';
  }

  return 'CRITIQUE: The answer is too vague. You MUST add supportable specifics such as named mechanisms, conditions, measurements, or decision boundaries.';
}

function buildStructureDirective(): string {
  return 'CRITIQUE: The answer lacks clear claim-evidence-conclusion structure. Rewrite it so each conclusion is explicitly tied to supporting evidence or constraints.';
}

function buildGroundingDirective(): string {
  return 'CRITIQUE: Your conclusions are not traceable to evidence. Link each conclusion to specific evidence nodes or remove it.';
}

function buildContextSwitchPenaltyDirective(): string {
  return 'CRITIQUE: You shifted into a fictional operational framework. Do not invent SLAs, uptime commitments, enforcement tiers, or measurement protocols for a non-literal or unsupported premise. State directly that the premise is unserious or unsupported, then keep only any residual supportable claim.';
}

function buildOrphanDirective(): string {
  return 'CRITIQUE: At least one conclusion is unsupported. Every conclusion MUST be backed by evidence or an explicit prior claim, or be removed.';
}

function buildCycleDirective(cyclePath?: string): string {
  return cyclePath
    ? `CRITIQUE: Your logic loops. You stated ${cyclePath}. Break the circular dependency so the reasoning flows one-way from evidence to conclusion.`
    : 'CRITIQUE: Your logic contains a circular dependency. Break the cycle so the reasoning flows one-way from evidence to conclusion.';
}

function buildContradictionDirective(): string {
  return 'CRITIQUE: Your reasoning contains grounded contradictions. Remove or rewrite the conflicting claims so the conclusion set is internally consistent.';
}

function buildPlanPrerequisiteDirective(): string {
  return 'CRITIQUE: Your plan skips prerequisites. Insert the missing prerequisite steps before any dependent action.';
}

function buildPlanConflictDirective(): string {
  return 'CRITIQUE: Your plan has conflicting use of shared resources. Sequence or isolate those steps before execution.';
}

function buildPlanCompletenessDirective(): string {
  return 'CRITIQUE: Your rollout plan is incomplete. Add the missing gating, dependency, and validation steps before execution begins.';
}

function buildConcurrencyDirective(): string {
  return 'CRITIQUE: Your operation still exposes a concurrency hazard. Add the required coordination primitive, idempotency guard, or transaction boundary before claiming safety.';
}

function buildConfidenceDirective(): string {
  return 'CRITIQUE: Your claimed confidence is not supported by the evidence. Lower the claim or add explicit evidence and falsification conditions that justify it.';
}

function parseCyclePaths(description: string): string[] {
  const marker = description.indexOf('cycle(s):');
  if (marker === -1) return [];

  return description
    .slice(marker + 'cycle(s):'.length)
    .split(';')
    .map(value => value.trim())
    .filter(Boolean);
}

function extractCyclePaths(route: RouteOrFailure): string[] {
  if (!isSchemaFailure(route)) {
    const result = route.result as { cycles?: Array<{ path?: string[] }> };
    if (Array.isArray(result?.cycles)) {
      const paths = result.cycles
        .map(cycle => (Array.isArray(cycle?.path) ? cycle.path.join(' -> ') : ''))
        .filter(Boolean);
      if (paths.length > 0) return paths;
    }

    return dedupeStrings(
      (route.enforcement?.blocking_issues ?? []).flatMap(issue =>
        parseCyclePaths(issue.description),
      ),
    );
  }

  return [];
}

function buildSchemaDirectives(route: RouteOrFailure): string[] {
  if (!isSchemaFailure(route)) return [];

  const errors = route.validation_errors.map(error => `${error.path}: ${error.message}`);
  const directives: string[] = [];

  if (errors.some(error => /falsification_condition/i.test(error))) {
    directives.push(buildFalsifiabilityDirective());
  }

  if (errors.some(error => /nodes|edges/i.test(error))) {
    directives.push(
      'CRITIQUE: Your reasoning contract is malformed. Rebuild the node and edge graph so every referenced node exists and the structure validates.',
    );
  }

  if (directives.length === 0) {
    directives.push(
      'CRITIQUE: Fix the contract schema errors before resubmitting. Do not preserve any field that still fails validation.',
    );
  }

  return dedupeStrings(directives);
}

function buildRouteDirectives(
  route: RouteOrFailure,
  promptFamily?: string,
): string[] {
  if (isSchemaFailure(route)) {
    return buildSchemaDirectives(route);
  }

  const directives: string[] = [];
  const issueTexts = [
    ...(route.enforcement?.blocking_issues ?? []).map(issue => issue.description),
    ...(route.enforcement?.warnings ?? []),
  ];

  if (
    route.tool === 'validate_confidence' &&
    issueTexts.some(text => /falsifiability|unfalsifiable/i.test(text))
  ) {
    directives.push(buildFalsifiabilityDirective());
  }

  if (
    route.tool === 'validate_confidence' &&
    issueTexts.some(text => /inflation|gap/i.test(text))
  ) {
    directives.push(buildConfidenceDirective());
  }

  if (
    route.tool === 'score_response_quality' &&
    issueTexts.some(text => /specificity/i.test(text))
  ) {
    directives.push(buildSpecificityDirective(promptFamily));
  }

  if (
    route.tool === 'score_response_quality' &&
    issueTexts.some(text => /structure/i.test(text))
  ) {
    directives.push(buildStructureDirective());
  }

  if (
    route.tool === 'score_response_quality' &&
    issueTexts.some(text => /overall score/i.test(text))
  ) {
    directives.push(buildStructureDirective());
  }

  if (
    route.tool === 'validate_reasoning_chain' &&
    issueTexts.some(text => /grounding score/i.test(text))
  ) {
    directives.push(buildGroundingDirective());
  }

  if (
    route.tool === 'validate_reasoning_chain' &&
    issueTexts.some(text => /orphan/i.test(text))
  ) {
    directives.push(buildOrphanDirective());
  }

  if (
    route.tool === 'validate_reasoning_chain' &&
    issueTexts.some(text => /contradiction/i.test(text))
  ) {
    directives.push(buildContradictionDirective());
  }

  if (
    route.tool === 'validate_reasoning_chain' &&
    issueTexts.some(text => /circular reasoning cycle|cycle_detection|logic loops/i.test(text))
  ) {
    const cyclePaths = extractCyclePaths(route);
    if (cyclePaths.length === 0) {
      directives.push(buildCycleDirective());
    } else {
      directives.push(...cyclePaths.map(path => buildCycleDirective(path)));
    }
  }

  if (route.tool === 'check_plan_validity') {
    if (issueTexts.some(text => /circular dependency/i.test(text))) {
      const cyclePaths = dedupeStrings(
        issueTexts.flatMap(text =>
          /cycle\(s\):/i.test(text) ? parseCyclePaths(text) : [],
        ),
      );

      if (cyclePaths.length === 0) {
        directives.push(buildCycleDirective());
      } else {
        directives.push(...cyclePaths.map(path => buildCycleDirective(path)));
      }
    }

    if (issueTexts.some(text => /missing prerequisite/i.test(text))) {
      directives.push(buildPlanPrerequisiteDirective());
    }

    if (issueTexts.some(text => /resource conflict/i.test(text))) {
      directives.push(buildPlanConflictDirective());
    }

    if (issueTexts.some(text => /completeness/i.test(text))) {
      directives.push(buildPlanCompletenessDirective());
    }
  }

  if (
    route.tool === 'detect_concurrency_patterns' &&
    issueTexts.some(text => /hazard|check-then-act|read-modify-write|idempotency|ordering/i.test(text))
  ) {
    directives.push(buildConcurrencyDirective());
  }

  if (directives.length === 0 && issueTexts.length > 0) {
    directives.push(
      `CRITIQUE: Resolve the structural issue reported by ${route.tool}. Remove or rewrite any claim that remains unsupported after the fix.`,
    );
  }

  return dedupeStrings(directives);
}

function buildCalibrationDirectives(
  gateFailure: CalibrationGateIssue,
  promptFamily?: string,
): string[] {
  switch (gateFailure.metric_name) {
    case 'fictional_operational_framework':
      return [buildContextSwitchPenaltyDirective()];
    case 'falsifiability_score':
      return [buildFalsifiabilityDirective()];
    case 'specificity_score':
      return [buildSpecificityDirective(promptFamily)];
    case 'structure_score':
      return [buildStructureDirective()];
    case 'overall_score':
      return [buildStructureDirective()];
    case 'grounding_score':
      return [buildGroundingDirective()];
    case 'cycle_count':
      return [buildCycleDirective()];
    case 'orphaned_conclusions':
      return [buildOrphanDirective()];
    case 'gap':
      return [buildConfidenceDirective()];
    case 'completeness_score':
      return [buildPlanCompletenessDirective()];
    case 'missing_prerequisites':
      return [buildPlanPrerequisiteDirective()];
    case 'resource_conflicts':
      return [buildPlanConflictDirective()];
    case 'hazard_count':
    case 'critical_count':
      return [buildConcurrencyDirective()];
    default:
      return [
        `CRITIQUE: The ${gateFailure.tool}.${gateFailure.metric_name} gate failed. Rewrite the answer so the underlying structural issue is corrected, not merely restated.`,
      ];
  }
}

function buildCrossToolDirectives(
  violation: CrossToolInvariantViolation,
): string[] {
  return [
    `CRITIQUE: Resolve the cross-tool inconsistency: ${violation.description}. Return only the claims that remain consistent across the enforced checks.`,
  ];
}

function hasStructuralLoop(route: RouteOrFailure): boolean {
  if (isSchemaFailure(route)) return false;

  return [
    ...(route.enforcement?.blocking_issues ?? []).map(issue => issue.description),
    ...(route.enforcement?.warnings ?? []),
  ].some(text => /circular reasoning cycle|circular dependency|logic loops/i.test(text));
}

function shouldApplyAntiYapScopeCap(
  promptFamily: string | undefined,
  problemRoutes: RouteOrFailure[],
  allDirectives: string[],
): boolean {
  if (isInvalidPremisePromptFamily(promptFamily)) {
    return true;
  }

  if (problemRoutes.some(route => hasStructuralLoop(route))) {
    return true;
  }

  return allDirectives.some(directive =>
    /logic loops|circular dependency/i.test(directive),
  );
}

function buildContextSwitchPenaltyIssue(
  promptFamily: string,
  signals: string[],
): CalibrationGateIssue {
  return {
    tool: 'score_response_quality',
    metric_name: 'fictional_operational_framework',
    observed_value: 1,
    required_value: 0,
    comparator: '<=',
    description:
      signals.length > 0
        ? `Context-switch penalty: ${promptFamily} answer drifted into a fictional operational framework (${signals.join(', ')}).`
        : `Context-switch penalty: ${promptFamily} answer drifted into a fictional operational framework.`,
  };
}

function detectContextSwitchPenalty(
  routeResults: RouteOrFailure[],
  profile?: CalibrationProfile,
  evaluationContext?: PolicyEvaluationContext,
): CalibrationGateIssue[] {
  const promptFamily = profile?.selectors.prompt_family;
  const normalisedPromptFamily = normalisePromptFamily(promptFamily);
  if (!normalisedPromptFamily) return [];
  if (!isContextSwitchLenientPromptFamily(normalisedPromptFamily)) return [];

  const operationalShape = evaluationContext?.answer_text
    ? classifyOperationalFrameworkFromAnswer(evaluationContext.answer_text)
    : null;
  const answerFamily = normalisePromptFamily(evaluationContext?.answer_family);
  const driftedToOperationalFamily = answerFamily === 'operational_claim';
  const extractedOperationalPlan = routeResults.some(
    route => !isSchemaFailure(route) && route.tool === 'check_plan_validity',
  );
  const operationalFrameworkDetected =
    operationalShape?.is_operational_framework === true ||
    driftedToOperationalFamily ||
    extractedOperationalPlan;

  if (!operationalFrameworkDetected) return [];

  const signals = dedupeStrings([
    ...(operationalShape?.matched_signals ?? []),
    ...(driftedToOperationalFamily
      ? ['answer-family drift to operational_claim']
      : []),
    ...(extractedOperationalPlan
      ? ['plan contract extracted under lenient profile']
      : []),
  ]);

  return [buildContextSwitchPenaltyIssue(normalisedPromptFamily, signals)];
}

function buildCritiquePacket(
  problemRoutes: RouteOrFailure[],
  calibrationGateFailures: CalibrationGateIssue[] = [],
  crossToolViolations: CrossToolInvariantViolation[] = [],
  promptFamily?: string,
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
        structural_directives: buildRouteDirectives(f, promptFamily),
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
        structural_directives: buildRouteDirectives(f, promptFamily),
      };
    });

  for (const gateFailure of calibrationGateFailures) {
    failingRoutes.push({
      tool: gateFailure.tool,
      blocking_issues: [gateFailure.description],
      warnings: [],
      contract_failures: [],
      failure_source: 'calibration_policy',
      structural_directives: buildCalibrationDirectives(gateFailure, promptFamily),
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
      structural_directives: buildCrossToolDirectives(violation),
    });
  }

  const allDirectives = dedupeStrings(
    failingRoutes.flatMap(route => route.structural_directives),
  );
  const antiYapScopeCap = shouldApplyAntiYapScopeCap(
    promptFamily,
    problemRoutes,
    allDirectives,
  )
    ? ANTI_YAP_SCOPE_CAP
    : null;
  const allBlocking = failingRoutes.flatMap(r => r.blocking_issues);
  const allWarnings = failingRoutes.flatMap(r => r.warnings);
  const saferTarget =
    allDirectives.length > 0
      ? [allDirectives.join(' '), antiYapScopeCap].filter(Boolean).join(' ')
      : allBlocking.length > 0
        ? [`Address these issues before resubmitting: ${allBlocking.join('; ')}`, antiYapScopeCap]
            .filter(Boolean)
            .join(' ')
      : allWarnings.length > 0
        ? [`Address these warnings before resubmitting: ${allWarnings.join('; ')}`, antiYapScopeCap]
            .filter(Boolean)
            .join(' ')
        : 'Re-examine the failing routes and submit a corrected answer envelope.';

  return {
    failing_routes: failingRoutes,
    safer_revision_target: saferTarget,
    formatting_override: CRITIQUE_FORMATTING_OVERRIDE,
    ...(antiYapScopeCap
      ? {
          max_words: ANTI_YAP_MAX_WORDS,
          max_bloat_ratio: REVISION_BLOAT_RATIO_LIMIT,
        }
      : {}),
  };
}

export function evaluatePolicy(
  routeResults: RouteOrFailure[],
  reviewContext: ReviewContext,
  profile?: CalibrationProfile,
  crossToolViolations: CrossToolInvariantViolation[] = [],
  evaluationContext?: PolicyEvaluationContext,
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
  const calibrationGateFailures = [
    ...evaluateCalibrationGates(routeResults, profile),
    ...detectContextSwitchPenalty(routeResults, profile, evaluationContext),
  ];

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
        profile?.selectors.prompt_family,
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
        profile?.selectors.prompt_family,
      ),
      calibration_gate_failures: calibrationGateFailures,
    };
  }

  return {
    decision: warningRoutes.length > 0 ? 'WARN' : 'PASS',
    calibration_gate_failures: [],
  };
}
