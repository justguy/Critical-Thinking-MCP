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
  AnswerConstraint,
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
import { handleCheckClaimCoverage } from './check_claim_coverage.js';
import { handleTraceConclusionNumbers } from './trace_conclusion_numbers.js';
import { handleVerifyArithmetic } from './verify_arithmetic.js';
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
const CONTRACT_AUTHORITIES = new Set(['host', 'user', 'derived', 'agent']);
const PROFILE_SOURCES = new Set(['host_supplied', 'inferred', 'agent_declared']);
const CONSTRAINT_OPS = new Set(['<', '<=', '>', '>=', '==', '!=', 'in', 'not_in', 'subset_of']);

type NumericInput = number | {
  value: number;
  authority?: 'host' | 'source' | 'agent' | 'derived';
  source_quote?: string;
};

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
  if ('contract_authority' in c && (typeof c.contract_authority !== 'string' || !CONTRACT_AUTHORITIES.has(c.contract_authority))) {
    throw new Error(`contract.contract_authority is invalid: "${String(c.contract_authority)}".`);
  }
  if ('profile_source' in c && (typeof c.profile_source !== 'string' || !PROFILE_SOURCES.has(c.profile_source))) {
    throw new Error(`contract.profile_source is invalid: "${String(c.profile_source)}".`);
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
  if (Array.isArray(c.constraints)) {
    for (let i = 0; i < c.constraints.length; i++) {
      const constraint = c.constraints[i] as Record<string, unknown>;
      if (!constraint || typeof constraint.field !== 'string' || constraint.field.length === 0) {
        throw new Error(`contract.constraints[${i}].field must be a non-empty string.`);
      }
      if (typeof constraint.op !== 'string' || !CONSTRAINT_OPS.has(constraint.op)) {
        throw new Error(`contract.constraints[${i}].op is invalid. Must be one of: ${[...CONSTRAINT_OPS].join(', ')}.`);
      }
      if (!('value' in constraint)) {
        throw new Error(`contract.constraints[${i}] is missing "value".`);
      }
    }
  } else if ('constraints' in c && c.constraints !== undefined) {
    throw new Error('contract.constraints must be an array when supplied.');
  }
  return c as unknown as DeliverableContract;
}

function validateInput(input: unknown): {
  contract: DeliverableContract;
  answer_text: string;
  sources: SourceManifestEntry[];
  claims: GroundingClaim[];
  inputs: NumericInput[] | null;
  conclusion_numbers: unknown[] | null;
  numeric_derivation: unknown | null;
  constraints: unknown[] | null;
  structured_answer: Record<string, unknown> | null;
  arithmetic_checks: unknown[] | null;
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
    inputs: Array.isArray(obj.inputs) ? (obj.inputs as NumericInput[]) : null,
    conclusion_numbers: Array.isArray(obj.conclusion_numbers) ? (obj.conclusion_numbers as unknown[]) : null,
    numeric_derivation: obj.numeric_derivation ?? null,
    arithmetic_checks: Array.isArray(obj.arithmetic_checks) ? (obj.arithmetic_checks as unknown[]) : null,
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

interface ReExecCtx {
  contract: DeliverableContract;
  answer_text: string;
  sources: SourceManifestEntry[];
  claims: GroundingClaim[];
  inputs: NumericInput[] | null;
  conclusion_numbers: unknown[] | null;
  numeric_derivation: unknown | null;
  constraints: unknown[] | null;
  structured_answer: Record<string, unknown> | null;
  arithmetic_checks: unknown[] | null;
  eval_time: unknown;
}

function numericKey(value: number): string {
  return String(Number(value));
}

function numericKeysInText(text: string): Set<string> {
  return new Set(extractNumericTokens(text).map(t => numericKey(Number(t))).filter(k => k !== 'NaN'));
}

function normalizeNumericInputs(inputs: NumericInput[]): { values: number[]; records: NumericInput[] } | null {
  const values: number[] = [];
  for (const input of inputs) {
    const value = typeof input === 'number' ? input : input?.value;
    if (typeof value !== 'number' || !isFinite(value)) return null;
    values.push(value);
  }
  return { values, records: inputs };
}

function hasAnchoredQuote(quote: string, ctx: ReExecCtx): boolean {
  const nQuote = normalizeWhitespace(quote);
  if (nQuote.length === 0) return false;
  if (normalizeWhitespace(ctx.contract.original_request_text).includes(nQuote)) return true;
  return ctx.sources.some(source =>
    source.origin !== 'agent_supplied' &&
    typeof source.text === 'string' &&
    normalizeWhitespace(source.text).includes(nQuote),
  );
}

function valueAnchoredInText(value: number, text: string): boolean {
  return numericKeysInText(text).has(numericKey(value));
}

function valueAnchoredInSources(value: number, ctx: ReExecCtx): boolean {
  return ctx.sources.some(source =>
    source.origin !== 'agent_supplied' &&
    typeof source.text === 'string' &&
    valueAnchoredInText(value, source.text),
  );
}

function validateNumericInputAnchors(ctx: ReExecCtx, inputs: NumericInput[]): BlockingIssue[] {
  const issues: BlockingIssue[] = [];
  const requestNums = numericKeysInText(ctx.contract.original_request_text);
  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    const value = typeof input === 'number' ? input : input.value;
    const key = numericKey(value);
    if (requestNums.has(key)) continue;
    if (valueAnchoredInSources(value, ctx)) continue;
    if (
      typeof input !== 'number' &&
      input.source_quote &&
      valueAnchoredInText(value, input.source_quote) &&
      hasAnchoredQuote(input.source_quote, ctx)
    ) continue;
    issues.push({
      mechanism: 'number_input_anchor',
      description: `Numeric input ${i} (${value}) is not anchored in original_request_text or a host/source quote; do not flatten derived outputs into inputs.`,
      severity: 'blocking',
    });
  }
  return issues;
}

function validateNumericDerivationInputAnchors(ctx: ReExecCtx): BlockingIssue[] {
  const issues: BlockingIssue[] = [];
  const artifact = ctx.numeric_derivation;
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) return issues;
  const nodes = (artifact as Record<string, unknown>).nodes;
  if (!Array.isArray(nodes)) return issues;

  const requestNums = numericKeysInText(ctx.contract.original_request_text);
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
    const raw = node as Record<string, unknown>;
    if (raw.role !== 'input' || typeof raw.value !== 'number' || !isFinite(raw.value)) continue;
    const key = numericKey(raw.value);
    if (requestNums.has(key)) continue;
    if (valueAnchoredInSources(raw.value, ctx)) continue;
    issues.push({
      mechanism: 'number_input_anchor',
      description: `Numeric DAG input "${String(raw.id ?? '?')}" (${raw.value}) is not anchored in original_request_text or a host/source quote; do not flatten derived outputs into raw input nodes.`,
      severity: 'blocking',
    });
  }
  return issues;
}

function validateDerivedConclusions(conclusionNumbers: unknown[]): BlockingIssue[] {
  const issues: BlockingIssue[] = [];
  for (let i = 0; i < conclusionNumbers.length; i++) {
    const c = conclusionNumbers[i] as Record<string, unknown>;
    if (c && typeof c === 'object' && c.origin !== 'derived') {
      issues.push({
        mechanism: 'number_conclusion_origin',
        description: `Numeric conclusion ${i} uses origin "${String(c.origin)}"; computed numeric deliverables must declare derived conclusions, not literal/identity outputs.`,
        severity: 'blocking',
      });
    }
    if (
      c &&
      typeof c === 'object' &&
      c.origin === 'derived' &&
      Array.isArray(c.input_refs) &&
      c.input_refs.length < 2
    ) {
      issues.push({
        mechanism: 'number_derivation_arity',
        description: `Numeric conclusion ${i} is marked derived but references fewer than 2 inputs.`,
        severity: 'blocking',
      });
    }
  }
  return issues;
}

function validateArithmeticInputAnchors(ctx: ReExecCtx, arithmeticInput: unknown): BlockingIssue[] {
  const issues: BlockingIssue[] = [];
  if (!arithmeticInput || typeof arithmeticInput !== 'object' || Array.isArray(arithmeticInput)) return issues;
  const obj = arithmeticInput as Record<string, unknown>;
  const operands: Array<{ path: string; value: number }> = [];
  if (Array.isArray(obj.values)) {
    for (let i = 0; i < obj.values.length; i++) {
      if (typeof obj.values[i] === 'number' && isFinite(obj.values[i] as number)) {
        operands.push({ path: `values[${i}]`, value: obj.values[i] as number });
      }
    }
  }
  if (Array.isArray(obj.weights)) {
    for (let i = 0; i < obj.weights.length; i++) {
      if (typeof obj.weights[i] === 'number' && isFinite(obj.weights[i] as number)) {
        operands.push({ path: `weights[${i}]`, value: obj.weights[i] as number });
      }
    }
  }
  for (const key of ['part', 'whole', 'rate', 'periods']) {
    if (typeof obj[key] === 'number' && isFinite(obj[key] as number)) {
      operands.push({ path: key, value: obj[key] as number });
    }
  }

  const requestNums = numericKeysInText(ctx.contract.original_request_text);
  for (const operand of operands) {
    const key = numericKey(operand.value);
    if (requestNums.has(key) || valueAnchoredInSources(operand.value, ctx)) continue;
    issues.push({
      mechanism: 'arithmetic_input_anchor',
      description: `Arithmetic operand ${operand.path} (${operand.value}) is not anchored in original_request_text or supplied non-agent sources.`,
      severity: 'blocking',
    });
  }
  return issues;
}

function contractConstraints(ctx: ReExecCtx): AnswerConstraint[] | null {
  return Array.isArray(ctx.contract.constraints) && ctx.contract.constraints.length > 0
    ? ctx.contract.constraints
    : null;
}

function constraintInputsForCheck(ctx: ReExecCtx): AnswerConstraint[] | unknown[] | null {
  return contractConstraints(ctx) ?? ctx.constraints;
}

function hasStructuredObligation(ctx: ReExecCtx): boolean {
  return (
    (contractConstraints(ctx)?.length ?? 0) > 0 ||
    (ctx.contract.required_fields?.length ?? 0) > 0 ||
    (ctx.constraints?.length ?? 0) > 0
  );
}

/**
 * Re-execute one gate check inline. Returns:
 *   - 'ran'         → executed; `issues` are its blocking results.
 *   - 'missing'     → its artifacts were not supplied (`hint` names which).
 *   - 'no_executor' → this build has no inline re-executor for it (e.g. verify_arithmetic).
 * The CALLER decides what 'missing' means: a BLOCK for a mandatory finalize_required check,
 * a harmless skip for a verify-if-present check.
 */
function reExecuteCheck(
  check: string,
  ctx: ReExecCtx,
  engine: EnforcementEngine,
): { kind: 'ran' | 'missing' | 'no_executor'; issues: BlockingIssue[]; warnings: string[]; hint?: string } {
  const issues: BlockingIssue[] = [];
  const warnings: string[] = [];
  switch (check) {
    case 'check_quote_grounding': {
      if (ctx.sources.length === 0 || ctx.claims.length === 0) {
        return { kind: 'missing', issues, warnings, hint: 'Required check_quote_grounding could not be re-executed: supply "sources" and "claims".' };
      }
      const grounding = handleCheckQuoteGrounding({ sources: ctx.sources, claims: ctx.claims }, engine);
      const groundedClaims = ctx.claims
        .map((groundingClaim, i) => ({ groundingClaim, result: grounding.results[i] }))
        .filter(({ result }) => result?.grounded);
      const contractIds = new Set<string>();
      for (const claim of ctx.contract.claims ?? []) {
        if (contractIds.has(claim.id)) {
          issues.push({
            mechanism: 'finalize_claim_binding',
            description: `Duplicate contract claim id "${claim.id}" supplied; claim ids must be unique.`,
            severity: 'blocking',
          });
          continue;
        }
        contractIds.add(claim.id);
        const sameId = groundedClaims.filter(({ groundingClaim }) => groundingClaim.claim_id === claim.id);
        if (sameId.length === 0) {
          issues.push({
            mechanism: 'finalize_grounding',
            description: `Contract claim "${claim.id}" has no passing grounding result on re-execution.`,
            severity: 'blocking',
          });
          continue;
        }
        const sameText = sameId.filter(
          ({ groundingClaim }) => normalizeWhitespace(groundingClaim.claim_text) === normalizeWhitespace(claim.text),
        );
        if (sameText.length === 0) {
          issues.push({
            mechanism: 'finalize_claim_binding',
            description: `Contract claim "${claim.id}" has no passing grounding result bound to the same claim_text.`,
            severity: 'blocking',
          });
          continue;
        }
        if (claim.claim_kind && !sameText.some(({ groundingClaim }) => groundingClaim.claim_kind === claim.claim_kind)) {
          issues.push({
            mechanism: 'finalize_claim_kind',
            description: `Contract claim "${claim.id}" has no passing grounding result bound to claim_kind="${claim.claim_kind}".`,
            severity: 'blocking',
          });
        }
        if (sameText.every(({ result }) => result.support_strength === 'weak')) {
          issues.push({
            mechanism: 'finalize_claim_kind',
            description: `Contract claim "${claim.id}" has only weak grounding support; causal/recommendation proximity is not enough for a factual gate.`,
            severity: 'blocking',
          });
        }
      }
      for (const issue of grounding.enforcement?.blocking_issues ?? []) issues.push(issue);
      for (const warning of grounding.enforcement?.warnings ?? []) warnings.push(warning);
      const coverage = handleCheckClaimCoverage({
        claims: ctx.contract.claims ?? [],
        grounding_results: grounding.results,
        answer_text: ctx.answer_text,
      });
      for (const warning of coverage.enforcement?.warnings ?? []) warnings.push(warning);
      if (
        ctx.contract.task_type === 'factual_qa' &&
        (ctx.contract.evidence_level === 'cited' || ctx.contract.evidence_level === 'rederived')
      ) {
        for (const unaccounted of coverage.auto_detected_unaccounted_claims) {
          issues.push({
            mechanism: 'finalize_claim_coverage',
            description: `Answer contains claim-like span "${unaccounted.span}" (${unaccounted.reason}) not covered by a contract claim.`,
            severity: 'blocking',
          });
        }
      }
      return { kind: 'ran', issues, warnings };
    }
    case 'trace_conclusion_numbers': {
      const hasFlatTrace = !!ctx.inputs && !!ctx.conclusion_numbers;
      if (!hasFlatTrace && !ctx.numeric_derivation) {
        return { kind: 'missing', issues, warnings, hint: 'Required trace_conclusion_numbers could not be re-executed: supply "inputs" and "conclusion_numbers", or "numeric_derivation".' };
      }
      const traceInput: Record<string, unknown> = {
        answer_text: ctx.answer_text,
        strict_answer_numbers: true,
      };
      if (hasFlatTrace) {
        const normalizedInputs = normalizeNumericInputs(ctx.inputs!);
        if (!normalizedInputs) {
          issues.push({
            mechanism: 'number_provenance',
            description: 'Numeric inputs must be finite numbers or objects with a finite numeric "value".',
            severity: 'blocking',
          });
          return { kind: 'ran', issues, warnings };
        }
        if (ctx.contract.task_type === 'numeric_analysis') {
          for (const issue of validateNumericInputAnchors(ctx, normalizedInputs.records)) issues.push(issue);
          for (const issue of validateDerivedConclusions(ctx.conclusion_numbers!)) issues.push(issue);
        }
        traceInput.inputs = normalizedInputs.values;
        traceInput.conclusion_numbers = ctx.conclusion_numbers;
      }
      if (ctx.numeric_derivation) {
        if (ctx.contract.task_type === 'numeric_analysis') {
          for (const issue of validateNumericDerivationInputAnchors(ctx)) issues.push(issue);
        }
        traceInput.numeric_derivation = ctx.numeric_derivation;
      }
      const trace = handleTraceConclusionNumbers(traceInput, engine);
      for (const issue of trace.enforcement?.blocking_issues ?? []) issues.push(issue);
      for (const warning of trace.enforcement?.warnings ?? []) warnings.push(warning);
      return { kind: 'ran', issues, warnings };
    }
    case 'verify_arithmetic': {
      if (!ctx.arithmetic_checks || ctx.arithmetic_checks.length === 0) {
        return { kind: 'missing', issues, warnings, hint: 'Required verify_arithmetic could not be re-executed: supply "arithmetic_checks".' };
      }
      for (const arithmeticInput of ctx.arithmetic_checks) {
        for (const issue of validateArithmeticInputAnchors(ctx, arithmeticInput)) issues.push(issue);
        const arithmetic = handleVerifyArithmetic(arithmeticInput, engine);
        for (const issue of arithmetic.enforcement?.blocking_issues ?? []) issues.push(issue);
        for (const warning of arithmetic.enforcement?.warnings ?? []) warnings.push(warning);
      }
      return { kind: 'ran', issues, warnings };
    }
    case 'check_answer_against_constraints': {
      const constraintsForCheck = constraintInputsForCheck(ctx);
      if (!ctx.structured_answer || !hasStructuredObligation(ctx)) {
        return { kind: 'missing', issues, warnings, hint: 'Required check_answer_against_constraints could not be re-executed: supply "structured_answer" and either contract "constraints", artifact "constraints", or contract "required_fields".' };
      }
      const cc = handleCheckAnswerAgainstConstraints(
        {
          answer: ctx.structured_answer,
          constraints: constraintsForCheck ?? [],
          original_request_text: ctx.contract.original_request_text,
          required_fields: ctx.contract.required_fields,
        },
        engine,
      );
      for (const issue of cc.enforcement?.blocking_issues ?? []) issues.push(issue);
      for (const warning of cc.enforcement?.warnings ?? []) warnings.push(warning);
      return { kind: 'ran', issues, warnings };
    }
    case 'check_freshness': {
      if (!ctx.contract.freshness || !ctx.eval_time || ctx.sources.length === 0) {
        return { kind: 'missing', issues, warnings, hint: 'Required check_freshness could not be re-executed: supply "eval_time" and dated "sources".' };
      }
      const fresh = handleCheckFreshness(
        {
          eval_time: ctx.eval_time,
          sources: ctx.sources,
          max_age_seconds: ctx.contract.freshness.max_age_seconds,
          requires_dated_sources: ctx.contract.freshness.requires_dated_sources,
        },
        engine,
      );
      for (const issue of fresh.enforcement?.blocking_issues ?? []) issues.push(issue);
      for (const warning of fresh.enforcement?.warnings ?? []) warnings.push(warning);
      return { kind: 'ran', issues, warnings };
    }
    default:
      // A check this build cannot re-execute inline (e.g. verify_arithmetic).
      return { kind: 'no_executor', issues, warnings };
  }
}

export function handleFinalizeDeliverable(
  input: unknown,
  engine: EnforcementEngine,
): FinalizeOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { contract, answer_text, sources, claims, inputs, conclusion_numbers, numeric_derivation, constraints, structured_answer, arithmetic_checks, eval_time, case_partition } =
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
  const mandatoryChecks = [...plan.finalize_required];
  if (
    ((contract.constraints?.length ?? 0) > 0 || (contract.required_fields?.length ?? 0) > 0) &&
    !mandatoryChecks.includes('check_answer_against_constraints')
  ) {
    mandatoryChecks.push('check_answer_against_constraints');
  }

  // ── Re-execute the gate checks INLINE (the unforgeable gate) ───────────────
  const reExecuted: string[] = [];
  const reExecCtx: ReExecCtx = { contract, answer_text, sources, claims, inputs, conclusion_numbers, numeric_derivation, constraints, structured_answer, arithmetic_checks, eval_time };

  // Mandatory (finalize_required): missing artifacts is itself a BLOCK — you cannot release a
  // deliverable whose core required check could not be re-verified this turn.
  for (const check of mandatoryChecks) {
    const r = reExecuteCheck(check, reExecCtx, engine);
    if (r.kind === 'missing') {
      blockingIssues.push({ mechanism: 'finalize_missing_inputs', description: r.hint!, severity: 'blocking' });
    } else if (r.kind === 'no_executor') {
      blockingIssues.push({
        mechanism: 'finalize_no_executor',
        description: `Required check "${check}" was not re-executed because this build has no inline executor.`,
        severity: 'blocking',
      });
    } else {
      for (const issue of r.issues) blockingIssues.push(issue);
      for (const warning of r.warnings) warnings.push(warning);
      reExecuted.push(check);
    }
  }

  // Verify-if-present (finalize_verify_if_present): checks risk policy pulled in for extra rigor
  // (e.g. freshness/constraints promoted at high risk). Re-execute and BLOCK on failure ONLY if the
  // artifacts were supplied; a MISSING artifact is NOT a block — the deliverable may legitimately
  // have no such dimension. This is what prevents the high-risk false-block.
  for (const check of plan.finalize_verify_if_present) {
    if (mandatoryChecks.includes(check)) continue;
    const r = reExecuteCheck(check, reExecCtx, engine);
    if (r.kind === 'ran') {
      for (const issue of r.issues) blockingIssues.push(issue);
      for (const warning of r.warnings) warnings.push(warning);
      reExecuted.push(check);
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
  const hostAnchored = (
    (contract.contract_authority === 'host' || contract.contract_authority === 'user' || contract.contract_authority === 'derived') &&
    (contract.profile_source === 'host_supplied' || contract.profile_source === 'inferred')
  );
  const weak = !hostAnchored;
  if (weak) {
    warnings.push(
      `contract_strength=weak_agent_declared: PASS only proves the declared contract was satisfied; ` +
        `contract_authority=${String(contract.contract_authority)} profile_source=${String(contract.profile_source)}. ` +
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
    answer_text_hash: sha256Hex(answer_text),
    answer_text_length: answer_text.length,
    required_checks: mandatoryChecks,
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
