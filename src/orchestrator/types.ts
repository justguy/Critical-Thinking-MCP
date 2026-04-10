/**
 * Orchestrator type definitions.
 *
 * Experimental internal layer. Not a public MCP tool surface.
 *
 * Strict structured contracts only — no prose rescue, no synthesized graphs.
 */

export type OrchestratorMode = 'routed' | 'shadow';

export type PolicyDecision = 'PASS' | 'WARN' | 'REVISE' | 'HUMAN_REVIEW';

export type CalibrationSessionMode = 'single_turn' | 'multi_turn';
export type QuestionFamily =
  | 'refutation'
  | 'causal_refutation'
  | 'humor_forward'
  | 'forecasting'
  | 'causal'
  | 'operational_claim';
export type PromptFamilySource =
  | 'explicit'
  | 'prompt_inferred'
  | 'answer_inferred'
  | 'locked';

export type ContractType =
  | 'confidence_contract'
  | 'reasoning_chain_contract'
  | 'plan_contract'
  | 'concurrency_contract'
  | 'quality_contract';

export type OrchestratorToolName =
  | 'validate_confidence'
  | 'validate_reasoning_chain'
  | 'check_plan_validity'
  | 'detect_concurrency_patterns'
  | 'score_response_quality';

// Keys used inside the envelope.contracts object.
export type ContractKey =
  | 'confidence'
  | 'reasoning_chain'
  | 'plan'
  | 'concurrency'
  | 'quality';

export type FailureSource =
  | 'routing'
  | 'schema'
  | 'deterministic_tool'
  | 'calibration_policy'
  | 'cross_tool_invariant';

// ─── Review context ────────────────────────────────────────────────────────

export interface PriorFailure {
  tool: string;
  failure_type: string;
  blocking_issues: string[];
}

export interface ReviewContext {
  iteration_number: number;
  prior_failures: PriorFailure[];
}

// ─── Optional runtime calibration layer ────────────────────────────────────

export interface QualityMetricGates {
  min_overall_score?: number;
  min_substance_score?: number;
  min_specificity_score?: number;
  min_structure_score?: number;
  max_hedge_density?: number;
}

export interface ConfidenceMetricGates {
  max_gap?: number;
  min_falsifiability_score?: number;
  require_no_inflation?: boolean;
}

export interface ReasoningMetricGates {
  min_grounding_score?: number;
  max_cycle_count?: number;
  max_orphaned_conclusions?: number;
}

export interface PlanMetricGates {
  min_completeness_score?: number;
  max_circular_dependencies?: number;
  max_missing_prerequisites?: number;
  max_resource_conflicts?: number;
}

export interface ConcurrencyMetricGates {
  max_hazard_count?: number;
  max_critical_count?: number;
  require_protections?: boolean;
}

export interface ToolMetricGates {
  validate_confidence?: ConfidenceMetricGates;
  validate_reasoning_chain?: ReasoningMetricGates;
  check_plan_validity?: PlanMetricGates;
  detect_concurrency_patterns?: ConcurrencyMetricGates;
  score_response_quality?: QualityMetricGates;
}

export interface CalibrationProfile {
  profile_id: string;
  selectors: {
    model?: string;
    prompt_family?: string;
    session_mode?: CalibrationSessionMode;
  };
  warning_route_revision_threshold: number;
  metric_gates: ToolMetricGates;
  prune_raw_run_days?: number | null;
}

export interface CalibrationRuntimeContext {
  model: string;
  prompt_family?: string;
  locked_prompt_family?: string;
  prompt_text?: string;
  session_mode: CalibrationSessionMode;
  session_depth?: number;
  profile_id?: string;
  locked_profile_id?: string;
  db_path?: string;
  prune_raw_run_days?: number | null;
  turn_chain_id?: string;
  selected_metric_tool?: OrchestratorToolName;
  selected_metric_name?: string;
  selected_metric_value?: number;
  selected_metric_threshold?: number;
  delta_from_prior_turn?: number;
  released?: boolean;
}

export interface OrchestratorRuntimeOptions {
  calibration?: CalibrationRuntimeContext;
}

export interface CalibrationGateIssue {
  tool: OrchestratorToolName;
  metric_name: string;
  observed_value: number;
  required_value: number;
  comparator: '>=' | '<=';
  description: string;
}

// ─── Envelope and contract shapes ─────────────────────────────────────────

export interface OrchestratorEnvelope {
  schema_version: 'orchestrator_v0';
  answer_text: string;
  contracts: Partial<Record<ContractKey, unknown>>;
  mode: OrchestratorMode;
  review_context: ReviewContext;
}

export interface ConfidenceContract {
  response_text: string;
  assumptions: Array<{
    description: string;
    confidence: number;
    falsification_condition: string;
  }>;
}

export interface ReasoningChainContract {
  nodes: Array<{
    id: string;
    label: string;
    type: 'claim' | 'evidence' | 'conclusion' | 'assumption';
  }>;
  edges: Array<{
    from: string;
    to: string;
    relation: 'supports' | 'implies' | 'contradicts' | 'requires';
  }>;
}

export interface PlanContract {
  time_budget_hours?: number;
  steps: Array<{
    id: string;
    description: string;
    dependencies: string[];
    resources?: string[];
    duration_hours?: number;
  }>;
}

export interface CapacityModel {
  throughput_per_sec?: number;
  mean_latency_sec?: number;
  capacity_slots?: number;
  retry_count?: number;
  timeout_sec?: number;
  sla_sec?: number;
}

export interface ResourceAllocationTask {
  id: string;
  holds?: string[];
  waits_for?: string[];
}

export interface ResourceDescriptor {
  id: string;
  mode?: 'exclusive' | 'shared';
  preemptible?: boolean;
}

export interface ResourceAllocationGraph {
  tasks: ResourceAllocationTask[];
  resources?: ResourceDescriptor[];
}

export interface ConcurrencyContract {
  steps: string[];
  shared_resources?: string[];
  protections?: string[];
  delivery_model?: 'at_least_once' | 'at_most_once' | 'exactly_once';
  retry_behavior?: 'none' | 'automatic' | 'manual';
  capacity_model?: CapacityModel;
  resource_allocation?: ResourceAllocationGraph;
}

export interface QualityContract {
  response_text: string;
  claims?: string[];
  evidence?: string[];
}

// ─── Schema validation error envelope ─────────────────────────────────────

export interface ValidationError {
  path: string;
  message: string;
}

export interface SchemaFailure {
  tool: OrchestratorToolName;
  contract_type: ContractType;
  status: 'ENFORCEMENT_FAIL';
  failure_type: 'schema_validation_failure';
  validation_errors: ValidationError[];
}

// ─── Tool execution results ───────────────────────────────────────────────

export interface RouteResult {
  tool: OrchestratorToolName;
  contract_type: ContractType;
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  result: unknown;
  enforcement?: {
    blocking_issues: Array<{
      mechanism: string;
      description: string;
      severity: string;
    }>;
    warnings: string[];
    corrective_prompt: string;
  };
}

export type RouteOrFailure = RouteResult | SchemaFailure;

// ─── Critique packet (for REVISE / HUMAN_REVIEW) ─────────────────────────

export interface CritiqueRoute {
  tool: string;
  blocking_issues: string[];
  warnings: string[];
  contract_failures: string[];
  failure_source: FailureSource;
}

export interface CritiquePacket {
  failing_routes: CritiqueRoute[];
  safer_revision_target: string;
}

export interface RevisionRequest {
  strategy: 'bounded_single_revision';
  next_review_context: ReviewContext;
  safer_revision_target: string;
  prompt: string;
}

// ─── Shadow telemetry ─────────────────────────────────────────────────────

export interface ShadowOnlyFinding {
  tool: OrchestratorToolName;
  status: 'PASS' | 'WARN' | 'ENFORCEMENT_FAIL';
  summary: string;
}

export interface SchemaFailureSummary {
  tool: OrchestratorToolName;
  contract_type: ContractType;
  errors: string[];
}

export interface ShadowTelemetry {
  mode: OrchestratorMode;
  router_primary_type: string;
  router_secondary_type: string | null;
  routed_tools: OrchestratorToolName[];
  artifact_compatible_tools: OrchestratorToolName[];
  tools_executed: OrchestratorToolName[];
  tools_executed_only_in_shadow: OrchestratorToolName[];
  shadow_only_findings: ShadowOnlyFinding[];
  schema_failures: SchemaFailureSummary[];
  policy_decision: PolicyDecision;
  iteration_number: number;
  session_depth: number;
  would_have_escalated: boolean;
}

export interface CalibrationResultMetadata {
  profile_id: string;
  model: string;
  prompt_family: string;
  prompt_family_source: PromptFamilySource;
  session_mode: CalibrationSessionMode;
  session_depth: number;
  warning_route_revision_threshold: number;
  metric_gate_failures: CalibrationGateIssue[];
  recorded_run_id?: number;
}

export interface SharedVariableBinding {
  name: string;
  value: number;
  source_contract: ContractKey;
  source_path: string;
  unit?: string;
}

export interface CrossToolInvariantViolation {
  invariant_id: string;
  severity: 'blocking' | 'warning';
  description: string;
  variables: string[];
  source_contracts: ContractKey[];
  corrective_prompt: string;
}

export interface CrossToolContext {
  bindings: SharedVariableBinding[];
  violations: CrossToolInvariantViolation[];
}

// ─── Final orchestrator result ────────────────────────────────────────────

export interface OrchestratorResult {
  schema_version: 'orchestrator_v0';
  mode: OrchestratorMode;
  policy_decision: PolicyDecision;
  route_results: RouteOrFailure[];
  shadow_results: RouteOrFailure[];
  cross_tool_context?: CrossToolContext;
  critique?: CritiquePacket;
  revision_request?: RevisionRequest;
  telemetry: ShadowTelemetry;
  calibration?: CalibrationResultMetadata;
}
