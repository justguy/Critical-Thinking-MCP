/**
 * types.ts — Phalanx integration contract types.
 *
 * These mirror the Normalized Adapter Output Contract and Input Contract
 * defined in CT_MCP_REQUIREMENTS.md. No `any`; all boundaries use `unknown`
 * and narrow explicitly.
 */

// ====== Claim Graph (validate_reasoning_chain payload) ======

export type ClaimNodeType = 'claim' | 'evidence' | 'conclusion' | 'assumption';
export type ClaimEdgeRelation = 'supports' | 'implies' | 'contradicts' | 'requires';

export interface ClaimNode {
  id: string;
  label: string;
  type: ClaimNodeType;
}

export interface ClaimEdge {
  from: string;
  to: string;
  relation: ClaimEdgeRelation;
}

export interface ClaimGraph {
  nodes: ClaimNode[];
  edges: ClaimEdge[];
}

// ====== Plan Steps (check_plan_validity payload) ======

export interface PlanStep {
  id: string;
  description: string;
  dependencies: string[];
  resources?: string[];
}

export interface PlanSteps {
  steps: PlanStep[];
}

// ====== Confidence Assumptions (validate_confidence payload) ======

export interface ConfidenceAssumption {
  description: string;
  confidence: number;
  falsification_condition?: string;
}

export interface ConfidenceAssumptions {
  assumptions: ConfidenceAssumption[];
  response_text: string;
}

// ====== Concurrency Description (detect_concurrency_patterns payload) ======

export interface ConcurrencyDescription {
  steps: string[];
  shared_resources?: string[];
  protections?: string[];
  delivery_model?: 'at_least_once' | 'at_most_once' | 'exactly_once';
  retry_behavior?: 'none' | 'automatic' | 'manual';
}

// ====== PhalanxCtCall — input from Phalanx to CT-MCP ======

export type PhalanxPhase =
  | 'planning'
  | 'blueprint_convergence'
  | 'execution_retry'
  | 'verification'
  | 'closeout';

export interface PhalanxCtCallPayload {
  claims?: ClaimGraph;
  steps?: PlanSteps;
  assumptions?: ConfidenceAssumptions;
  operations?: ConcurrencyDescription;
}

export interface PhalanxCtCall {
  call_id: string;
  phase: PhalanxPhase;
  piece_id: string | null;
  run_id: string;
  payload: PhalanxCtCallPayload;
}

// ====== CtObjection — individual finding ======

export type ObjectionSeverity = 'blocking' | 'warning' | 'info';

export interface CtObjection {
  objection_id: string;
  mechanism: string;
  severity: ObjectionSeverity;
  claim_ref?: string;
  message: string;
  evidence: Record<string, unknown>;
}

// ====== CtVerdict — output from CT-MCP to Phalanx ======

export type Verdict = 'PASS' | 'WARN' | 'BLOCK';

export interface CtVerdict {
  call_id: string;
  verdict: Verdict;
  objections: CtObjection[];
  elapsed_ms: number;
  mechanism_versions: Record<string, string>;
}

// ====== Error types ======

export class PhalanxContractInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhalanxContractInputError';
  }
}
