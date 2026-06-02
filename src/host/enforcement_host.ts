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
 *   3. In strict_release mode, finalize_deliverable must confirm a host-anchored contract.
 *   4. Anti-swap: the text actually being surfaced must hash-match the text finalize checked.
 * Only then does it RELEASE. Otherwise it REJECTs and hands back the corrective_prompt.
 *
 * The agent stays OUTSIDE: it produces the answer + artifacts; this host decides release.
 * Swap `opts.finalize` for an MCP-over-stdio client to enforce against a live server
 * (the in-process default calls the same deterministic handler the server runs).
 */

import { EnforcementEngine } from '../enforcement/index.js';
import { handleFinalizeDeliverable, type FinalizeOutput } from '../tools/finalize_deliverable.js';
import { sha256Hex } from '../enforcement/utils.js';
import { enforceInputLimits } from '../enforcement/limits.js';
import { validateArtifactBundle } from '../enforcement/artifact_schema.js';
import { renderAnswer } from '../enforcement/answer_renderer.js';
import { evaluateHostGradeTrust, type HostAnchoredEvidence } from '../enforcement/host_grade_trust.js';
import { stampTaxonomy } from '../enforcement/blocker_taxonomy.js';
import type {
  AcceptanceCriterion,
  AnswerConstraint,
  ArtifactBundle,
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
  constraints?: AnswerConstraint[];
  acceptance_criteria?: AcceptanceCriterion[];
  freshness?: { max_age_seconds: number; requires_dated_sources: boolean };
}

/** What the agent produced. The host does not author these — it only verifies them. */
export interface DeliverableArtifacts {
  answer_text: string;
  sources?: SourceManifestEntry[];
  claims?: GroundingClaim[];
  inputs?: unknown[];
  conclusion_numbers?: unknown[];
  numeric_derivation?: unknown;
  arithmetic_checks?: unknown[];
  constraints?: unknown[];
  structured_answer?: Record<string, unknown>;
  case_partition?: Record<string, unknown>;
  /**
   * The bound artifact ledger (§5). When supplied with host proof_grade_requirements,
   * the host renders it and enforces the §3 host-grade trust rule. The agent
   * authors the bundle; it does NOT decide which requirements are proof-grade.
   */
  artifact_bundle?: ArtifactBundle;
}

export interface EnforceOptions {
  /** Host-supplied evaluation time (authority:'host' is what lets check_freshness block). */
  eval_time?: { value: string; authority: 'host' | 'agent' };
  /** The exact text being shown to the user, if it differs from artifacts.answer_text. The host
   *  releases only if its exact text hash matches the text finalize checked (closes the
   *  "checked one answer, shipped another" gap). Defaults to artifacts.answer_text. */
  surfaced_answer?: string;
  /** Inject a finalize implementation (e.g. an MCP-over-stdio client). Defaults to in-process. */
  finalize?: (input: unknown) => FinalizeOutput;
  /** Fail closed if finalize does not report a host-authored contract. */
  strict_release?: boolean;
  /**
   * Requirement ids the HOST declares MUST be backed by tier-1/2 (host-grade)
   * strong-grounded evidence (§3). Authored host-side so the model cannot dodge by
   * self-declaring a weaker profile. Enforced over artifacts.artifact_bundle; if no
   * bundle is supplied while this is non-empty, release is REJECTed (the host-grade
   * obligation could not be verified). Empty/omitted = no host-grade obligation.
   */
  proof_grade_requirements?: string[];
  /**
   * The HOST's authoritative evidence set (host-supplied sources / host-authored
   * artifacts). This is the ROOT OF TRUST for proof-grade: an agent's provenance
   * label (e.g. 'host_extracted') is a CLAIM verified against this, never a trusted
   * fact. A proof-grade requirement is satisfied only if a binding's artifact is
   * AUTHENTICATED here (quoted span verbatim-matches a host source, or the artifact
   * is in the host-authored set). Authored host-side, NOT in the agent's bundle.
   */
  host_evidence?: HostAnchoredEvidence;
}

export type RejectReason =
  | 'gate_block'
  | 'hash_mismatch'
  | 'contract_not_host_anchored'
  | 'host_grade_proof_missing';

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

function contractAuthorityIssue(contractStrength: unknown): BlockingIssue {
  return {
    mechanism: 'strict_host_contract_required',
    description:
      `Strict release requires finalize_deliverable to report contract_strength="host_anchored"; got "${String(contractStrength)}".`,
    severity: 'blocking',
  };
}

function strictReleasePrompt(issue: BlockingIssue): string {
  return `${issue.description} Supply the contract at the host boundary and re-run ct-enforce on the exact answer to ship.`;
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
    constraints: spec.constraints,
  };

  const finalize =
    opts.finalize ?? ((input: unknown) => handleFinalizeDeliverable(input, new EnforcementEngine()));

  const finalizeInput = {
    contract,
    answer_text: artifacts.answer_text,
    sources: artifacts.sources,
    claims: artifacts.claims,
    inputs: artifacts.inputs,
    conclusion_numbers: artifacts.conclusion_numbers,
    numeric_derivation: artifacts.numeric_derivation,
    arithmetic_checks: artifacts.arithmetic_checks,
    constraints: artifacts.constraints,
    structured_answer: artifacts.structured_answer,
    case_partition: artifacts.case_partition,
    eval_time: opts.eval_time,
  };

  if (!opts.finalize) enforceInputLimits(finalizeInput);
  const out = finalize(finalizeInput);

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

  if (opts.strict_release && out.contract_strength !== 'host_anchored') {
    const issue = contractAuthorityIssue(out.contract_strength);
    return {
      ...base,
      decision: 'REJECT',
      reason: 'contract_not_host_anchored',
      surfaced_answer_hash: '',
      blocking_issues: [...blocking_issues, issue],
      corrective_prompt: strictReleasePrompt(issue),
    };
  }

  // 3b. Host-grade trust (§3): a PASS that asserts proof may rest ONLY on tier-1/2
  // strong-grounded artifacts. The HOST owns proof_grade_requirements, so a model-
  // authored bundle cannot self-declare a weaker profile to dodge — it can only
  // fail to satisfy it (which BLOCKS). Runs over the agent-supplied artifact_bundle.
  const proofGradeReqs = opts.proof_grade_requirements ?? [];
  if (proofGradeReqs.length > 0) {
    if (!artifacts.artifact_bundle) {
      const issue: BlockingIssue = stampTaxonomy([
        {
          mechanism: 'host_grade_proof_required',
          description:
            `Host declared proof-grade requirements [${proofGradeReqs.join(', ')}] but no artifact_bundle was ` +
            'supplied to verify their backing tier. Supply the bound artifact ledger (§5) to release.',
          severity: 'blocking',
        },
      ])[0];
      return {
        ...base,
        decision: 'REJECT',
        reason: 'host_grade_proof_missing',
        surfaced_answer_hash: '',
        blocking_issues: [...blocking_issues, issue],
        corrective_prompt: issue.description,
      };
    }
    // Validate structure + referential integrity, then render and apply the §3 rule.
    const bundle = validateArtifactBundle(artifacts.artifact_bundle);
    renderAnswer(bundle); // §5 projection — the wiring point Phase 3.2 diffs for drift.
    const trust = evaluateHostGradeTrust(bundle, {
      proof_grade_requirements: proofGradeReqs,
      host_evidence: opts.host_evidence,
    });
    if (!trust.proof_grade_satisfied) {
      stampTaxonomy(trust.blocking_issues);
      return {
        ...base,
        decision: 'REJECT',
        reason: 'host_grade_proof_missing',
        surfaced_answer_hash: '',
        blocking_issues: [...blocking_issues, ...trust.blocking_issues],
        corrective_prompt: trust.blocking_issues.map(i => i.description).join(' '),
      };
    }
  }

  // 4. Anti-swap: the text being shipped must be the text that was checked.
  const surfaced = opts.surfaced_answer ?? artifacts.answer_text;
  const surfaced_answer_hash = sha256Hex(surfaced);
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
