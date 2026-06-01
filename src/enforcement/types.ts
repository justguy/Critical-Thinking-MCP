// ====== Graph Types ======

export interface GraphNode {
  id: string;
  label: string;
  type: 'claim' | 'evidence' | 'conclusion' | 'assumption';
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: 'supports' | 'implies' | 'contradicts' | 'requires';
}

// ====== Assumption Types ======

export interface Assumption {
  description: string;
  confidence: number;
  falsification_condition?: string;
}

// ====== Enforcement Core Types ======

export interface BlockingIssue {
  mechanism: string;
  description: string;
  severity: 'blocking' | 'warning';
}

export interface EnforcementResult {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  enforcement_score: number;
  blocking_issues: BlockingIssue[];
  warnings: string[];
  corrective_prompt: string;
}

// ====== Mechanism Results ======

export interface ConfidenceProductResult {
  honest_ceiling: number;
  claimed_confidence: number | null;
  gap: number;
  inflation_detected: boolean;
  dependency_weights: number[];
}

export interface SpecificityResult {
  score: number;
  passes: boolean;
  marker_density: number;
  conditional_passes: boolean;
  warnings: string[];
}

export interface ConsistencyViolation {
  field: string;
  description: string;
  severity: 'blocking' | 'warning';
}

export interface ConsistencyResult {
  consistent: boolean;
  violations: ConsistencyViolation[];
}

export interface HedgeResult {
  hedge_density: number;
  severity: 'clean' | 'moderate' | 'heavy';
  hedged_sentences: string[];
}

export interface FalsifiabilityResult {
  score: number;
  passes: boolean;
  unfalsifiable: string[];
}

export interface SteelmanResult {
  similarity: number;
  is_paraphrase: boolean;
  is_strawman: boolean;
  has_genuine_extension: boolean;
}

export interface RevisionContrastResult {
  gap_terms_present: boolean;
  resolution_quality: number;
  verdict: 'resolved' | 'mentioned_only' | 'padded' | 'missing';
}

export interface LoopGovernorEntry {
  gap_text: string;
  score?: number;
}

export interface LoopGovernorResult {
  stalled: boolean;
  stall_type?: 'knowledge_gap' | 'scope_gap' | 'capability_ceiling';
  stall_diagnosis?: string;
  best_iteration?: number;
  reframe_prompt?: string;
  iterations_remaining: number;
}

export interface FabricationResult {
  round_number_ratio: number;
  spacing_cv: number;
  precision_cv: number;
  geometric_regularity: number;
  suspicion: 'low' | 'moderate' | 'high';
}

export interface OutlierResult {
  value: number;
  z_score: number;
  index: number;
}

// ====== Numeric Derivation DAG Types ======

export type NumericDerivationOp =
  | 'literal'
  | 'identity'
  | 'sum'
  | 'diff'
  | 'product'
  | 'ratio'
  | 'pct_of'
  | 'mean'
  | 'weighted_average'
  | 'percent_change';

export interface NumericDerivationNode {
  /** Stable node id used by input_refs/final_refs. */
  id: string;
  /** raw input = external operand; intermediate/final = rederived from input_refs. */
  role: 'input' | 'intermediate' | 'final';
  value: number;
  unit?: string;
  op?: NumericDerivationOp;
  input_refs?: string[];
  /** Required for weighted_average; same order and length as input_refs. */
  weights?: number[];
  /** Human-readable formula string, carried through for audit/binding output. */
  formula?: string;
  /** Optional exact answer span that must contain this final value when answer_text is supplied. */
  answer_text_quote?: string;
}

export interface NumericDerivationArtifact {
  kind?: 'numeric_derivation_dag';
  nodes: NumericDerivationNode[];
  /** Optional explicit finals. If absent, nodes with role='final' are the final numbers. */
  final_refs?: string[];
}

// ====== Caller-Supplied Context (optional, enables iterative behavior) ======

export interface EnforcementContext {
  /** Current iteration number (1-based). Omit or 1 for first pass. */
  iteration_number?: number;
  /** Mechanism names that produced blocking issues in prior iterations. */
  prior_blocking_issues?: string[];
  /** Warning strings from prior iterations. */
  prior_warnings?: string[];
  /** Mechanism → count of prior failures. Drives corrective prompt escalation. */
  failure_counts_by_mechanism?: Record<string, number>;
  /** Full text of the previous response (for stall/drift detection). */
  previous_response_text?: string;
  /** Hash of previous response (lightweight stall detection). */
  previous_response_hash?: string;
  /** The corrective prompt returned in the prior iteration. */
  prior_corrective_prompt?: string;
  /** History of prior iterations for loop governor stall detection. */
  iteration_history?: Array<{
    iteration_number: number;
    blocking_issues?: string[];
    warnings?: string[];
    response_hash?: string;
    gap_summary?: string[];
  }>;
  /** Caller metadata — not used for enforcement logic, only for traceability. */
  run_metadata?: {
    session_id?: string;
    thread_id?: string;
    scenario_id?: string;
    condition?: string;
  };
}

// ====== Consistency Check Input ======

export interface ConsistencyInput {
  weakest_assumption?: { name: string; confidence: number };
  all_assumptions?: Assumption[];
  verdict?: string;
  challenges?: string[];
  strengths?: string[];
}

// ====== Plan Types ======

export interface PlanStep {
  id: string;
  description: string;
  dependencies: string[];
  resources?: string[];
}

// ====== Tradeoff Types ======

export interface TradeoffOption {
  name: string;
  outcomes: {
    description: string;
    probability: number;
    utility: number;
  }[];
}

// ====== Deliverable-centric types (factual-QA slice) ======
//
// These power the deliverable_contract spine, the plan_checks planner, and the
// re-executing finalize_deliverable gate. Every consumer is a pure deterministic
// function; nothing here introduces server state, keys, or an LLM. Per the design
// catalog (docs/designs/robustness-additions.md, Part II): the only honest BLOCK
// signals are WITHIN-REQUEST (verbatim containment, re-derivation, interval/graph
// math). Self-declared fields (authority, claim list, contract criteria) are WARNING.

export type TaskType =
  | 'factual_qa'
  | 'numeric_analysis'
  | 'planning'
  | 'decision'
  | 'concurrency_design'
  | 'reasoning'
  | 'freeform';

export type EvidenceLevel = 'none' | 'asserted' | 'cited' | 'rederived';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface AcceptanceCriterion {
  id: string;
  text: string;
  /** 'inline_check' = finalize RECOMPUTES this now; NOT "trust a prior tool result". */
  kind: 'numeric' | 'structural' | 'coverage' | 'inline_check';
  /** For numeric/structural: the exact value/token that must appear verbatim in answer_text. */
  bound?: string;
  /** Restate-and-diff anchor: should be a substring of contract.original_request_text. */
  source_quote?: string;
}

export interface ContractClaim {
  id: string;
  text: string;
  claim_kind?: ClaimKind;
}

export interface AnswerConstraint {
  field: string;
  op: '<' | '<=' | '>' | '>=' | '==' | '!=' | 'in' | 'not_in' | 'subset_of';
  value: unknown;
  source_quote?: string;
}

export interface DeliverableContract {
  contract_id: string;
  /** Who authored the obligations. Only meaningful if the HOST populates it (unverifiable by a pure fn). */
  contract_authority: 'host' | 'user' | 'derived' | 'agent';
  profile_source: 'host_supplied' | 'inferred' | 'agent_declared';
  /** The external ask — the anchor that acceptance_criteria.source_quote must come from. */
  original_request_text: string;
  task_type: TaskType;
  evidence_level: EvidenceLevel;
  risk_level: RiskLevel;
  /** Present only for time-sensitive deliverables. Drives check_freshness. */
  freshness?: { max_age_seconds: number; requires_dated_sources: boolean };
  acceptance_criteria?: AcceptanceCriterion[];
  /** The load-bearing factual claims the deliverable rests on. */
  claims?: ContractClaim[];
  /** Exact-substring gates on answer_text (unforgeable). */
  must_include?: string[];
  must_not_include?: string[];
  /** Field names that must appear in a structured answer (used by the constraint checker). */
  required_fields?: string[];
  /** Host/user/derived structured predicates that must hold when present. */
  constraints?: AnswerConstraint[];
}

export interface SourceManifestEntry {
  id: string;
  text: string;
  /** Provenance — only meaningful when the HOST sets it; surfaced, never gates. */
  origin?: 'host_supplied' | 'user_supplied' | 'agent_supplied' | 'retrieved_by_host';
  authority_tier?: 'primary' | 'official' | 'secondary' | 'unknown';
  retrieved_at?: string; // ISO-8601 UTC
  published_at?: string; // ISO-8601 UTC
}

export type ClaimKind =
  | 'numeric'
  | 'date'
  | 'entity'
  | 'status'
  | 'comparison'
  | 'causal'
  | 'recommendation';

export interface GroundingClaim {
  claim_id: string;
  claim_text: string;
  source_id: string;
  quoted_span: string;
  supporting_token: string;
  claim_kind: ClaimKind;
}

// ====== Planner output ======

export interface PlannedCheck {
  check: string;
  /**
   * 'blocking'          → a failing result blocks, and finalize treats absent artifacts as a block.
   * 'verify_if_present' → finalize re-runs it (blocking on failure) ONLY if its artifacts are
   *                       supplied; absent artifacts are NOT a block (e.g. a high-risk-promoted
   *                       optional check the deliverable may not need).
   * 'warning'           → never blocks.
   */
  severity_on_fail: 'blocking' | 'verify_if_present' | 'warning';
  reason: string;
}

export interface ArtifactTemplate {
  check: string;
  applies_when: 'finalize_required' | 'finalize_verify_if_present' | 'optional';
  purpose: string;
  required_fields: string[];
  finalize_mapping: string;
  example: Record<string, unknown>;
}

export interface PlanResult {
  required: PlannedCheck[];
  optional: { check: string; reason: string }[];
  /** The subset of required checks whose fail-signal is unforgeable AND mandatory — finalize re-runs
   *  these and blocks if their artifacts are missing. */
  finalize_required: string[];
  /** Unforgeable checks finalize re-runs only if their artifacts are supplied (block on failure,
   *  never on absence). */
  finalize_verify_if_present: string[];
  /** Minimal artifact examples the agent can copy into finalize_deliverable inputs. */
  artifact_templates: ArtifactTemplate[];
  /** Human-readable checklist of artifacts required before finalize_deliverable can release. */
  finalize_checklist: string[];
}
