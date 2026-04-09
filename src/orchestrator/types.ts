/**
 * Orchestrator type definitions.
 *
 * Experimental internal layer. Not a public MCP tool surface.
 *
 * Strict structured contracts only — no prose rescue, no synthesized graphs.
 */

export type OrchestratorMode = 'routed' | 'shadow';

export type PolicyDecision = 'PASS' | 'WARN' | 'REVISE' | 'HUMAN_REVIEW';

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

export type FailureSource = 'routing' | 'schema' | 'deterministic_tool';

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
  steps: Array<{
    id: string;
    description: string;
    dependencies: string[];
    resources?: string[];
  }>;
}

export interface ConcurrencyContract {
  steps: string[];
  shared_resources?: string[];
  protections?: string[];
  delivery_model?: 'at_least_once' | 'at_most_once' | 'exactly_once';
  retry_behavior?: 'none' | 'automatic' | 'manual';
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

// ─── Shadow telemetry ─────────────────────────────────────────────────────

export interface ShadowOnlyFinding {
  tool: OrchestratorToolName;
  status: 'PASS' | 'ENFORCEMENT_FAIL';
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
  would_have_escalated: boolean;
}

// ─── Final orchestrator result ────────────────────────────────────────────

export interface OrchestratorResult {
  schema_version: 'orchestrator_v0';
  mode: OrchestratorMode;
  policy_decision: PolicyDecision;
  route_results: RouteOrFailure[];
  shadow_results: RouteOrFailure[];
  critique?: CritiquePacket;
  telemetry: ShadowTelemetry;
}
