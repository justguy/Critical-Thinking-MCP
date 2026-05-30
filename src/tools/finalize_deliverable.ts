/**
 * finalize_deliverable — the keystone gate. RE-EXECUTOR, not a hash verifier.
 *
 * Given the contract + answer_text + sources + grounding claims IN ONE CALL, it
 * re-runs the contract's finalize_required checks inline and PASSES only on
 * unforgeable, within-request signals:
 *   - check_quote_grounding re-runs; every contract.claim must have a grounding pass
 *     (this is the unforgeable coverage gate — NOT a trusted prior witness).
 *   - must_include strings present, must_not_include strings absent in answer_text.
 *   - numeric acceptance criteria: the bound value appears VERBATIM in answer_text.
 *   - a supplied case_partition is re-verified MECE inline (BLOCKS on overlap/gap;
 *     absent = no obligation — verify-if-present, not a mandatory required check).
 *   - check_profile_downgrade runs as a WARNING: the declared task_type vs the
 *     request/answer shape, so a profile dodge surfaces at the gate (never a sole block).
 *
 * It returns answer_text_hash purely as a BINDING TOKEN so the host can confirm the
 * surfaced answer is the one that was checked — never as proof a check ran.
 *
 * Honest limit: proves the contract's declared, machine-checkable obligations were
 * discharged this turn — NOT that the answer is true, and nothing about obligations
 * the agent never declared. Under-declaring weakens what PASS asserts. No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import { planChecks } from '../enforcement/check_planner.js';
import type {
  BlockingIssue,
  DeliverableContract,
  EnforcementContext,
  EvidenceLevel,
  GroundingClaim,
  RiskLevel,
  SourceManifestEntry,
  TaskType,
} from '../enforcement/types.js';
import { extractNumericTokens, normalizeWhitespace, sha256Hex } from '../enforcement/utils.js';
import { handleCheckQuoteGrounding } from './check_quote_grounding.js';
import { handleTraceConclusionNumbers } from './trace_conclusion_numbers.js';
import { handleCheckAnswerAgainstConstraints } from './check_answer_against_constraints.js';
import { handleCheckFreshness } from './check_freshness.js';
import { handleCheckCasePartition } from './check_case_partition.js';
import { handleCheckProfileDowngrade } from './check_profile_downgrade.js';

const TASK_TYPES = new Set([
  'factual_qa', 'numeric_analysis', 'planning', 'decision',
  'concurrency_design', 'reasoning', 'freeform',
]);
const EVIDENCE_LEVELS = new Set(['none', 'asserted', 'cited', 'rederived']);
const RISK_LEVELS = new Set(['low', 'medium', 'high']);

export interface FinalizeOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  finalize_verdict: 'PASS' | 'BLOCK';
  answer_text_hash: string;
  answer_text_length: number;
  required_checks: string[];
  re_executed: string[];
  contract_strength: 'host_anchored' | 'weak_agent_declared';
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

function validateContract(raw: unknown): DeliverableContract {
  if (raw === null || typeof raw !== 'object') {
    throw new Error('Missing "contract" object.');
  }
  const c = raw as Record<string, unknown>;
  if (typeof c.contract_id !== 'string') throw new Error('contract.contract_id must be a string.');
  if (typeof c.original_request_text !== 'string') {
    throw new Error('contract.original_request_text must be a string.');
  }
  if (typeof c.task_type !== 'string' || !TASK_TYPES.has(c.task_type)) {
    throw new Error(`contract.task_type is invalid: "${String(c.task_type)}".`);
  }
  if (typeof c.evidence_level !== 'string' || !EVIDENCE_LEVELS.has(c.evidence_level)) {
    throw new Error(`contract.evidence_level is invalid: "${String(c.evidence_level)}".`);
  }
  if (typeof c.risk_level !== 'string' || !RISK_LEVELS.has(c.risk_level)) {
    throw new Error(`contract.risk_level is invalid: "${String(c.risk_level)}".`);
  }
  // Reject the disproven hash-as-proof model: 'tool_result' (and any unknown kind) is invalid.
  // finalize RE-EXECUTES checks inline; it never trusts a caller-supplied prior tool-result.
  const VALID_KINDS = new Set(['numeric', 'structural', 'coverage', 'inline_check']);
  if (Array.isArray(c.acceptance_criteria)) {
    for (let i = 0; i < c.acceptance_criteria.length; i++) {
      const crit = c.acceptance_criteria[i] as Record<string, unknown>;
      if (!crit || typeof crit.kind !== 'string' || !VALID_KINDS.has(crit.kind)) {
        throw new Error(
          `contract.acceptance_criteria[${i}].kind is invalid: "${String(crit?.kind)}". ` +
            `Must be one of: numeric, structural, coverage, inline_check. ` +
            `('tool_result' is rejected — finalize re-executes checks; it does not trust prior tool-result hashes.)`,
        );
      }
    }
  }
  return c as unknown as DeliverableContract;
}

function validateInput(input: unknown): {
  contract: DeliverableContract;
  answer_text: string;
  sources: SourceManifestEntry[];
  claims: GroundingClaim[];
  inputs: number[] | null;
  conclusion_numbers: unknown[] | null;
  constraints: unknown[] | null;
  structured_answer: Record<string, unknown> | null;
  eval_time: unknown;
  case_partition: Record<string, unknown> | null;
} {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "contract", "answer_text", and the inputs for any finalize_required ' +
        'check (sources+claims for grounding; inputs+conclusion_numbers for number tracing; ' +
        'constraints+structured_answer for the constraint checker).',
    );
  }
  const obj = input as Record<string, unknown>;
  const contract = validateContract(obj.contract);
  if (typeof obj.answer_text !== 'string' || obj.answer_text.length < 1) {
    throw new Error('Missing "answer_text" (non-empty string).');
  }
  return {
    contract,
    answer_text: obj.answer_text,
    sources: Array.isArray(obj.sources) ? (obj.sources as SourceManifestEntry[]) : [],
    claims: Array.isArray(obj.claims) ? (obj.claims as GroundingClaim[]) : [],
    inputs: Array.isArray(obj.inputs) ? (obj.inputs as number[]) : null,
    conclusion_numbers: Array.isArray(obj.conclusion_numbers) ? (obj.conclusion_numbers as unknown[]) : null,
    constraints: Array.isArray(obj.constraints) ? (obj.constraints as unknown[]) : null,
    structured_answer:
      obj.structured_answer && typeof obj.structured_answer === 'object' && !Array.isArray(obj.structured_answer)
        ? (obj.structured_answer as Record<string, unknown>)
        : null,
    eval_time: obj.eval_time,
    case_partition:
      obj.case_partition && typeof obj.case_partition === 'object' && !Array.isArray(obj.case_partition)
        ? (obj.case_partition as Record<string, unknown>)
        : null,
  };
}

export function handleFinalizeDeliverable(
  input: unknown,
  engine: EnforcementEngine,
): FinalizeOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { contract, answer_text, sources, claims, inputs, conclusion_numbers, constraints, structured_answer, eval_time, case_partition } =
    validateInput(input);
  const nAnswer = normalizeWhitespace(answer_text);

  const plan = planChecks({
    task_type: contract.task_type as TaskType,
    evidence_level: contract.evidence_level as EvidenceLevel,
    risk_level: contract.risk_level as RiskLevel,
    freshness: contract.freshness,
  });

  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  // ── Re-execute every finalize_required check INLINE (the unforgeable gate) ─
  // Missing inputs for a required check is itself a BLOCK — you cannot release a
  // deliverable whose required check could not be re-verified this turn.
  const reExecuted: string[] = [];
  for (const check of plan.finalize_required) {
    switch (check) {
      case 'check_quote_grounding': {
        if (sources.length === 0 || claims.length === 0) {
          blockingIssues.push({
            mechanism: 'finalize_missing_inputs',
            description:
              'Required check_quote_grounding could not be re-executed: supply "sources" and "claims".',
            severity: 'blocking',
          });
          break;
        }
        const grounding = handleCheckQuoteGrounding({ sources, claims }, engine);
        const groundedIds = new Set(grounding.results.filter(r => r.grounded).map(r => r.claim_id));
        for (const claim of contract.claims ?? []) {
          if (!groundedIds.has(claim.id)) {
            blockingIssues.push({
              mechanism: 'finalize_grounding',
              description: `Contract claim "${claim.id}" has no passing grounding result on re-execution.`,
              severity: 'blocking',
            });
          }
        }
        for (const issue of grounding.enforcement?.blocking_issues ?? []) blockingIssues.push(issue);
        reExecuted.push(check);
        break;
      }
      case 'trace_conclusion_numbers': {
        if (!inputs || !conclusion_numbers) {
          blockingIssues.push({
            mechanism: 'finalize_missing_inputs',
            description:
              'Required trace_conclusion_numbers could not be re-executed: supply "inputs" and "conclusion_numbers".',
            severity: 'blocking',
          });
          break;
        }
        const trace = handleTraceConclusionNumbers({ inputs, conclusion_numbers, answer_text }, engine);
        for (const issue of trace.enforcement?.blocking_issues ?? []) blockingIssues.push(issue);
        reExecuted.push(check);
        break;
      }
      case 'check_answer_against_constraints': {
        if (!constraints || !structured_answer) {
          blockingIssues.push({
            mechanism: 'finalize_missing_inputs',
            description:
              'Required check_answer_against_constraints could not be re-executed: supply "constraints" and "structured_answer".',
            severity: 'blocking',
          });
          break;
        }
        const cc = handleCheckAnswerAgainstConstraints(
          {
            answer: structured_answer,
            constraints,
            original_request_text: contract.original_request_text,
            required_fields: contract.required_fields,
          },
          engine,
        );
        for (const issue of cc.enforcement?.blocking_issues ?? []) blockingIssues.push(issue);
        reExecuted.push(check);
        break;
      }
      case 'check_freshness': {
        if (!contract.freshness || !eval_time || sources.length === 0) {
          blockingIssues.push({
            mechanism: 'finalize_missing_inputs',
            description:
              'Required check_freshness could not be re-executed: supply "eval_time" and dated "sources".',
            severity: 'blocking',
          });
          break;
        }
        const fresh = handleCheckFreshness(
          {
            eval_time,
            sources,
            max_age_seconds: contract.freshness.max_age_seconds,
            requires_dated_sources: contract.freshness.requires_dated_sources,
          },
          engine,
        );
        for (const issue of fresh.enforcement?.blocking_issues ?? []) blockingIssues.push(issue);
        reExecuted.push(check);
        break;
      }
      default: {
        // A required check this build cannot re-execute inline (e.g. verify_arithmetic).
        warnings.push(
          `finalize_required check "${check}" was not re-executed (no inline re-executor in this build) — run it separately.`,
        );
      }
    }
  }

  // ── Conditional structural gate: a SUPPLIED case partition must be MECE ────
  // Verify-if-present (NOT a finalize_required check): absence means no obligation,
  // but a supplied partition that overlaps or leaves a gap BLOCKS — pure interval/set
  // arithmetic, unforgeable like the other gate signals.
  if (case_partition) {
    const partition = handleCheckCasePartition(case_partition, engine);
    for (const issue of partition.enforcement?.blocking_issues ?? []) blockingIssues.push(issue);
    reExecuted.push('check_case_partition');
  }

  // ── must_include / must_not_include (exact substring on answer_text) ──────
  for (const inc of contract.must_include ?? []) {
    if (!nAnswer.includes(normalizeWhitespace(inc))) {
      blockingIssues.push({
        mechanism: 'must_include',
        description: `Required string not present in answer_text: "${inc}".`,
        severity: 'blocking',
      });
    }
  }
  for (const exc of contract.must_not_include ?? []) {
    if (nAnswer.includes(normalizeWhitespace(exc))) {
      blockingIssues.push({
        mechanism: 'must_not_include',
        description: `Forbidden string present in answer_text: "${exc}".`,
        severity: 'blocking',
      });
    }
  }

  // ── acceptance criteria ───────────────────────────────────────────────────
  for (const crit of contract.acceptance_criteria ?? []) {
    if (crit.kind === 'numeric') {
      const bound = crit.bound ?? '';
      const boundNums = extractNumericTokens(bound);
      const answerNums = new Set(extractNumericTokens(nAnswer));
      const present = boundNums.length > 0 && boundNums.every(n => answerNums.has(n));
      if (!present) {
        blockingIssues.push({
          mechanism: 'numeric_not_shipped',
          description: `Numeric criterion "${crit.id}" value "${bound}" not present verbatim in answer_text.`,
          severity: 'blocking',
        });
      }
    } else if (crit.kind === 'structural') {
      const token = normalizeWhitespace(crit.bound ?? crit.text);
      if (token.length > 0 && !nAnswer.includes(token)) {
        blockingIssues.push({
          mechanism: 'structural_criterion',
          description: `Structural criterion "${crit.id}" token "${token}" not present in answer_text.`,
          severity: 'blocking',
        });
      }
    }
    // 'coverage' and 'inline_check' are satisfied by the grounding re-run above.

    // Restate-and-diff anchor: a source_quote should come from the original request.
    if (crit.source_quote && crit.source_quote.length > 0) {
      const nReq = normalizeWhitespace(contract.original_request_text);
      if (!nReq.includes(normalizeWhitespace(crit.source_quote))) {
        warnings.push(
          `Criterion "${crit.id}" source_quote is not a substring of original_request_text — unanchored obligation.`,
        );
      }
    }
  }

  // ── Anti-gaming WARNING: did the declared task_type understate the work? ───
  // The agent picks task_type, which drives the whole check profile; declaring a
  // weaker type (e.g. 'freeform' for a decision) is the easy dodge. Heuristic →
  // warning only, surfaced here so a host strict mode can act on it.
  if (contract.original_request_text.length > 0) {
    const downgrade = handleCheckProfileDowngrade({
      original_request_text: contract.original_request_text,
      declared_task_type: contract.task_type,
      answer_text,
    });
    for (const w of downgrade.enforcement?.warnings ?? []) warnings.push(w);
  }

  // ── contract strength (WARNING; authority is unverifiable by a pure fn) ────
  const weak =
    contract.contract_authority === 'agent' || contract.profile_source === 'agent_declared';
  if (weak) {
    warnings.push(
      'contract_strength=weak_agent_declared: PASS only proves the agent-declared contract was satisfied. ' +
        'For stronger guarantees the host should supply or derive the contract.',
    );
  }

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'finalize_deliverable', undefined, context)
    : '';

  const output: FinalizeOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    finalize_verdict: hasFail ? 'BLOCK' : 'PASS',
    answer_text_hash: sha256Hex(nAnswer),
    answer_text_length: answer_text.length,
    required_checks: plan.finalize_required,
    re_executed: reExecuted,
    contract_strength: weak ? 'weak_agent_declared' : 'host_anchored',
    context_used: !!context,
  };

  if (hasFail || warnings.length > 0) {
    output.enforcement = {
      blocking_issues: blockingIssues,
      warnings,
      corrective_prompt: correctivePrompt,
    };
  }

  return output;
}
