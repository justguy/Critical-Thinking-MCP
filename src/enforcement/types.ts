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
