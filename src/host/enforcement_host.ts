/**
 * enforcement_host — the reference HOST that makes ct-mcp's gate MANDATORY.
 *
 * ct-mcp tools are model-controlled: the protocol can't force an agent to call them,
 * and a pure function can't verify who authored its inputs or read a clock. So four
 * obligations live host-side (see docs/designs/factual-qa-slice.md). This module is
 * that host, implemented as STRICTLY DETERMINISTIC code — NO LLM, NO agent, NO network,
 * no clock read. It is the consumer of the MCP, not part of it.
 *
 * What it enforces, in order:
 *   1. The HOST authors the contract (contract_authority='host') — never the agent.
 *   2. finalize_deliverable must return PASS (re-runs the required unforgeable checks inline).
 *   3. Anti-swap: the text actually being surfaced must hash-match the text finalize checked.
 * Only then does it RELEASE. Otherwise it REJECTs and hands back the corrective_prompt.
 *
 * The agent stays OUTSIDE: it produces the answer + artifacts; this host decides release.
 * Swap `opts.finalize` for an MCP-over-stdio client to enforce against a live server
 * (the in-process default calls the same deterministic handler the server runs).
 */

import { EnforcementEngine } from '../enforcement/index.js';
import { handleFinalizeDeliverable, type FinalizeOutput } from '../tools/finalize_deliverable.js';
import { normalizeWhitespace, sha256Hex } from '../enforcement/utils.js';
import type {
  AcceptanceCriterion,
  BlockingIssue,
  ContractClaim,
  DeliverableContract,
  EvidenceLevel,
  GroundingClaim,
  RiskLevel,
  SourceManifestEntry,
  TaskType,
} from '../enforcement/types.js';

/** What the host knows about the deliverable's obligations. The host authors this. */
export interface ContractSpec {
  contract_id: string;
  original_request_text: string;
  task_type: TaskType;
  evidence_level: EvidenceLevel;
  risk_level: RiskLevel;
  claims?: ContractClaim[];
  must_include?: string[];
  must_not_include?: string[];
  required_fields?: string[];
  acceptance_criteria?: AcceptanceCriterion[];
  freshness?: { max_age_seconds: number; requires_dated_sources: boolean };
}

/** What the agent produced. The host does not author these — it only verifies them. */
export interface DeliverableArtifacts {
  answer_text: string;
  sources?: SourceManifestEntry[];
  claims?: GroundingClaim[];
  inputs?: number[];
  conclusion_numbers?: unknown[];
  constraints?: unknown[];
  structured_answer?: Record<string, unknown>;
  case_partition?: Record<string, unknown>;
}

export interface EnforceOptions {
  /** Host-supplied evaluation time (authority:'host' is what lets check_freshness block). */
  eval_time?: { value: string; authority: 'host' | 'agent' };
  /** The exact text being shown to the user, if it differs from artifacts.answer_text. The host
   *  releases only if its normalized hash matches the text finalize checked (closes the
   *  "checked one answer, shipped another" gap). Defaults to artifacts.answer_text. */
  surfaced_answer?: string;
  /** Inject a finalize implementation (e.g. an MCP-over-stdio client). Defaults to in-process. */
  finalize?: (input: unknown) => FinalizeOutput;
}

export type RejectReason = 'gate_block' | 'hash_mismatch';

export interface ReleaseDecision {
  decision: 'RELEASE' | 'REJECT';
  reason: 'released' | RejectReason;
  finalize_verdict: 'PASS' | 'BLOCK';
  /** Binding token finalize computed over the answer it checked. */
  answer_text_hash: string;
  /** Hash the host computed over the text it would actually surface. */
  surfaced_answer_hash: string;
  blocking_issues: BlockingIssue[];
  warnings: string[];
  /** Feed this back to whatever produced the answer (a human, an agent, a retry loop). */
  corrective_prompt: string;
  required_checks: string[];
  re_executed: string[];
  contract_strength: 'host_anchored' | 'weak_agent_declared';
}

/**
 * Decide whether a deliverable may be released. Pure/deterministic given its inputs.
 */
export function enforceDeliverable(
  spec: ContractSpec,
  artifacts: DeliverableArtifacts,
  opts: EnforceOptions = {},
): ReleaseDecision {
  // 1. The HOST authors the contract — this is what makes PASS meaningful (host_anchored).
  const contract: DeliverableContract = {
    contract_id: spec.contract_id,
    contract_authority: 'host',
    profile_source: 'host_supplied',
    original_request_text: spec.original_request_text,
    task_type: spec.task_type,
    evidence_level: spec.evidence_level,
    risk_level: spec.risk_level,
    freshness: spec.freshness,
    acceptance_criteria: spec.acceptance_criteria,
    claims: spec.claims,
    must_include: spec.must_include,
    must_not_include: spec.must_not_include,
    required_fields: spec.required_fields,
  };

  const finalize =
    opts.finalize ?? ((input: unknown) => handleFinalizeDeliverable(input, new EnforcementEngine()));

  const out = finalize({
    contract,
    answer_text: artifacts.answer_text,
    sources: artifacts.sources,
    claims: artifacts.claims,
    inputs: artifacts.inputs,
    conclusion_numbers: artifacts.conclusion_numbers,
    constraints: artifacts.constraints,
    structured_answer: artifacts.structured_answer,
    case_partition: artifacts.case_partition,
    eval_time: opts.eval_time,
  });

  const blocking_issues = out.enforcement?.blocking_issues ?? [];
  const warnings = out.enforcement?.warnings ?? [];
  const base = {
    finalize_verdict: out.finalize_verdict,
    answer_text_hash: out.answer_text_hash,
    blocking_issues,
    warnings,
    required_checks: out.required_checks,
    re_executed: out.re_executed,
    contract_strength: out.contract_strength,
  };

  // 2. Gate: finalize must PASS.
  if (out.finalize_verdict !== 'PASS') {
    return {
      ...base,
      decision: 'REJECT',
      reason: 'gate_block',
      surfaced_answer_hash: '',
      corrective_prompt: out.enforcement?.corrective_prompt ?? '',
    };
  }

  // 3. Anti-swap: the text being shipped must be the text that was checked.
  const surfaced = opts.surfaced_answer ?? artifacts.answer_text;
  const surfaced_answer_hash = sha256Hex(normalizeWhitespace(surfaced));
  if (surfaced_answer_hash !== out.answer_text_hash) {
    return {
      ...base,
      decision: 'REJECT',
      reason: 'hash_mismatch',
      surfaced_answer_hash,
      corrective_prompt:
        'The text being surfaced is not the text finalize_deliverable checked. Re-run the gate on the exact answer you will ship.',
    };
  }

  return {
    ...base,
    decision: 'RELEASE',
    reason: 'released',
    surfaced_answer_hash,
    corrective_prompt: '',
  };
}
