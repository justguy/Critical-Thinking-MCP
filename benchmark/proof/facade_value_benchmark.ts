import { EnforcementEngine } from '../../src/enforcement/index.js';
import type { BlockingIssue, ContractClaim, EvidenceLevel, RiskLevel, SourceManifestEntry, TaskType } from '../../src/enforcement/types.js';
import { enforceDeliverable, type ContractSpec, type DeliverableArtifacts, type ReleaseDecision } from '../../src/host/enforcement_host.js';
import { handleFinalizeDeliverable, type FinalizeOutput } from '../../src/tools/finalize_deliverable.js';

export const PRODUCT_VALUE_MODES = [
  'baseline',
  'advisory',
  'enforced',
  'enforced_host_contract',
] as const;

export type ProductValueMode = (typeof PRODUCT_VALUE_MODES)[number];
export type DiagnosticCondition = 'debug_raw';
export type BenchmarkCondition = ProductValueMode | DiagnosticCondition;

export const PRODUCT_FACADE_TOOL_SURFACE = ['plan_checks', 'finalize_deliverable'] as const;

export const DEBUG_RAW_TOOL_SURFACE = [
  'validate_reasoning_chain',
  'check_numeric_claims',
  'detect_drift',
  'evaluate_tradeoffs',
  'check_plan_validity',
  'score_response_quality',
  'validate_confidence',
  'verify_arithmetic',
  'detect_concurrency_patterns',
  'plan_checks',
  'check_quote_grounding',
  'check_claim_coverage',
  'finalize_deliverable',
  'trace_conclusion_numbers',
  'check_answer_against_constraints',
  'check_freshness',
  'check_case_partition',
] as const;

const RAW_DEBUG_ONLY_TOOLS = new Set<string>([
  'check_quote_grounding',
  'check_claim_coverage',
  'trace_conclusion_numbers',
  'check_answer_against_constraints',
  'check_freshness',
  'check_case_partition',
]);

type ClaimKind = 'numeric' | 'date' | 'entity' | 'status' | 'comparison' | 'causal' | 'recommendation';

interface TruthSpec {
  required_any?: string[][];
  required_all?: string[];
  forbidden_numbers?: string[];
  unsupported_phrases?: string[];
  constraint_checks?: Array<{
    id: string;
    field: string;
    op: '<' | '<=' | '>' | '>=' | '==' | '!=' | 'in' | 'not_in';
    value: unknown;
  }>;
}

type ConstraintTruthCheck = NonNullable<TruthSpec['constraint_checks']>[number];

export interface FacadeBenchmarkTask {
  id: string;
  category: 'numeric' | 'factual' | 'constraint' | 'host_contract';
  adversarial: boolean;
  prompt: string;
  sources?: SourceManifestEntry[];
  contract: {
    task_type: TaskType;
    evidence_level: EvidenceLevel;
    risk_level: RiskLevel;
    claims?: ContractClaim[];
    must_include?: string[];
    must_not_include?: string[];
    required_fields?: string[];
  };
  truth: TruthSpec;
  note: string;
}

interface CandidateFixture {
  answer_text: string;
  surfaced_answer?: string;
  sources?: SourceManifestEntry[];
  claims?: DeliverableArtifacts['claims'];
  inputs?: DeliverableArtifacts['inputs'];
  conclusion_numbers?: DeliverableArtifacts['conclusion_numbers'];
  arithmetic_checks?: DeliverableArtifacts['arithmetic_checks'];
  constraints?: DeliverableArtifacts['constraints'];
  structured_answer?: DeliverableArtifacts['structured_answer'];
  contract_override?: Partial<ContractSpec> & { contract_authority?: 'host' | 'user' | 'derived' | 'agent'; profile_source?: 'host_supplied' | 'inferred' | 'agent_declared' };
  tool_calls: string[];
  latency_ms: number;
  artifact_formatting_failures?: number;
  revision_count?: number;
  correction_success?: boolean;
}

export interface ObjectiveScore {
  task_success: boolean;
  high_sev_defects: number;
  unsupported_claims: number;
  wrong_numbers: number;
  constraint_violations: number;
}

export interface BenchmarkTaskResult extends ObjectiveScore {
  task_id: string;
  mode: BenchmarkCondition;
  released: boolean;
  false_done: boolean;
  clean_control: boolean;
  false_block: boolean;
  artifact_formatting_failures: number;
  revision_count: number;
  excessive_revision_loops: number;
  correction_success: boolean;
  latency_ms: number;
  tool_calls: number;
  tool_choice_confusions: number;
  exposed_tools_count: number;
  finalize_verdict?: 'PASS' | 'BLOCK';
  release_decision?: 'RELEASE' | 'REJECT';
  reject_reason?: string;
  contract_strength?: 'host_anchored' | 'weak_agent_declared';
  blocking_issues: BlockingIssue[];
  warnings: string[];
}

export interface BenchmarkMetrics {
  task_success_rate: number;
  high_sev_defects_per_task: number;
  unsupported_claims_per_task: number;
  wrong_numbers_per_task: number;
  constraint_violations_per_task: number;
  false_done_rate: number;
  false_block_rate_clean_controls: number;
  artifact_formatting_failures_per_task: number;
  avg_revision_count: number;
  excessive_revision_loops_per_task: number;
  correction_success_rate: number;
  task_success_delta_vs_baseline: number;
  avoided_high_sev_defects_per_task: number;
  avoided_false_done_rate: number;
  net_value: number;
  avg_latency_ms: number;
  avg_tool_calls: number;
  avg_tool_choice_confusions: number;
  exposed_tools_count: number;
}

export interface FacadeValueBenchmarkReport {
  corpus: FacadeBenchmarkTask[];
  modes: BenchmarkCondition[];
  product_value_modes: ProductValueMode[];
  diagnostic_conditions: DiagnosticCondition[];
  proof_boundary: {
    correctness_proof_claim: string;
    product_value_claim: string;
    oracle: 'deterministic_fixture_grader_no_llm';
  };
  tool_surfaces: Record<BenchmarkCondition, readonly string[]>;
  results: BenchmarkTaskResult[];
  metrics_by_mode: Record<BenchmarkCondition, BenchmarkMetrics>;
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function toContractSpec(task: FacadeBenchmarkTask): ContractSpec {
  return {
    contract_id: task.id,
    original_request_text: task.prompt,
    task_type: task.contract.task_type,
    evidence_level: task.contract.evidence_level,
    risk_level: task.contract.risk_level,
    claims: task.contract.claims,
    must_include: task.contract.must_include,
    must_not_include: task.contract.must_not_include,
    required_fields: task.contract.required_fields,
  };
}

export function getFacadeBenchmarkCorpus(): FacadeBenchmarkTask[] {
  return [
    {
      id: 'N_clean_sum',
      category: 'numeric',
      adversarial: false,
      prompt: 'Sum the monthly costs 12, 15, and 18, and give both the total and the average.',
      contract: {
        task_type: 'numeric_analysis',
        evidence_level: 'rederived',
        risk_level: 'high',
        must_include: ['45', '15'],
      },
      truth: {
        required_all: ['45', '15'],
        forbidden_numbers: ['48'],
      },
      note: 'Clean numeric control: should not false-block.',
    },
    {
      id: 'N_wrong_sum',
      category: 'numeric',
      adversarial: true,
      prompt: 'What is 120 plus 30?',
      contract: {
        task_type: 'numeric_analysis',
        evidence_level: 'rederived',
        risk_level: 'high',
        must_include: ['150'],
      },
      truth: {
        required_all: ['150'],
        forbidden_numbers: ['200'],
      },
      note: 'Adversarial arithmetic: baseline ships a wrong sum.',
    },
    {
      id: 'F_unsupported_reset',
      category: 'factual',
      adversarial: true,
      prompt: "Using ONLY the provided source, answer: What is the service's rate limit, and how often does the limit reset?",
      sources: [{ id: 's1', text: 'The service enforces a rate limit of 100 requests per minute.', origin: 'host_supplied', authority_tier: 'primary' }],
      contract: {
        task_type: 'factual_qa',
        evidence_level: 'cited',
        risk_level: 'high',
        claims: [{ id: 'rate', text: 'The service rate limit is 100 requests per minute', claim_kind: 'numeric' }],
        must_include: ['100 requests per minute'],
        must_not_include: ['resets every minute', 'reset every minute'],
      },
      truth: {
        required_any: [['100 requests per minute', '100 req']],
        unsupported_phrases: ['resets every minute', 'reset every minute', 'resets each minute'],
      },
      note: 'Adversarial grounding: source gives rate, not reset interval.',
    },
    {
      id: 'C_price_constraint',
      category: 'constraint',
      adversarial: true,
      prompt: 'Return JSON only with status "ok" and price under 100.',
      contract: {
        task_type: 'factual_qa',
        evidence_level: 'cited',
        risk_level: 'high',
        claims: [
          { id: 'status', text: 'The answer status is ok', claim_kind: 'status' },
          { id: 'price', text: 'The answer price is under 100', claim_kind: 'numeric' },
        ],
        must_include: ['"status":"ok"'],
        required_fields: ['status', 'price'],
      },
      truth: {
        required_all: ['"status":"ok"'],
        constraint_checks: [{ id: 'price_under_100', field: 'price', op: '<', value: 100 }],
      },
      note: 'Adversarial constraint: answer can look plausible while violating a hard field predicate.',
    },
    {
      id: 'H_anti_swap',
      category: 'host_contract',
      adversarial: true,
      prompt: 'What is 120 plus 30? Ship exactly the answer that passed the gate.',
      contract: {
        task_type: 'numeric_analysis',
        evidence_level: 'rederived',
        risk_level: 'high',
        must_include: ['150'],
      },
      truth: {
        required_all: ['150'],
        forbidden_numbers: ['200'],
      },
      note: 'Host-contract adversary: checked text differs from surfaced text.',
    },
  ];
}

function numericArtifacts(total: number, values: number[], op: 'sum' | 'product'): Partial<CandidateFixture> {
  return {
    inputs: values,
    conclusion_numbers: [{ value: total, origin: 'derived', op, input_refs: values.map((_, i) => i) }],
    arithmetic_checks: [{ claim_type: op, values, claimed_result: total }],
  };
}

function correctFixture(task: FacadeBenchmarkTask, mode: BenchmarkCondition): CandidateFixture {
  switch (task.id) {
    case 'N_clean_sum':
      return {
        answer_text: 'The total is 45 and the average is 15.',
        inputs: [12, 15, 18],
        conclusion_numbers: [
          { value: 45, origin: 'derived', op: 'sum', input_refs: [0, 1, 2] },
          { value: 15, origin: 'derived', op: 'mean', input_refs: [0, 1, 2] },
        ],
        arithmetic_checks: [
          { claim_type: 'sum', values: [12, 15, 18], claimed_result: 45 },
        ],
        tool_calls: mode === 'baseline' ? [] : ['plan_checks', 'finalize_deliverable'],
        latency_ms: mode === 'baseline' ? 80 : 155,
      };
    case 'N_wrong_sum':
      return {
        answer_text: 'The total is 150.',
        ...numericArtifacts(150, [120, 30], 'sum'),
        tool_calls: ['plan_checks', 'finalize_deliverable'],
        latency_ms: 180,
      };
    case 'F_unsupported_reset':
      return {
        answer_text: 'The service rate limit is 100 requests per minute. The source does not state how often the limit resets.',
        sources: task.sources,
        claims: [{
          claim_id: 'rate',
          claim_text: 'The service rate limit is 100 requests per minute',
          source_id: 's1',
          quoted_span: 'rate limit of 100 requests per minute',
          supporting_token: '100',
          claim_kind: 'numeric' as ClaimKind,
        }],
        tool_calls: ['plan_checks', 'finalize_deliverable'],
        latency_ms: 170,
      };
    case 'C_price_constraint':
      return {
        answer_text: '{"status":"ok","price":80}',
        sources: [{ id: 'prompt', text: task.prompt, origin: 'host_supplied', authority_tier: 'primary' }],
        claims: [{
          claim_id: 'status',
          claim_text: 'The answer status is ok',
          source_id: 'prompt',
          quoted_span: 'status "ok"',
          supporting_token: 'ok',
          claim_kind: 'status' as ClaimKind,
        }, {
          claim_id: 'price',
          claim_text: 'The answer price is under 100',
          source_id: 'prompt',
          quoted_span: 'price under 100',
          supporting_token: '100',
          claim_kind: 'numeric' as ClaimKind,
        }],
        constraints: [{ field: 'price', op: '<', value: 100, source_quote: 'price under 100' }],
        structured_answer: { status: 'ok', price: 80 },
        tool_calls: ['plan_checks', 'finalize_deliverable'],
        latency_ms: 175,
      };
    case 'H_anti_swap':
      return {
        answer_text: 'The total is 150.',
        ...numericArtifacts(150, [120, 30], 'sum'),
        tool_calls: ['plan_checks', 'finalize_deliverable'],
        latency_ms: 165,
      };
    default:
      throw new Error(`Unknown task id: ${task.id}`);
  }
}

function fixtureFor(task: FacadeBenchmarkTask, mode: BenchmarkCondition): CandidateFixture {
  if (mode === 'baseline') {
    if (task.id === 'N_wrong_sum') {
      return { answer_text: 'The total is 200.', tool_calls: [], latency_ms: 75 };
    }
    if (task.id === 'F_unsupported_reset') {
      return { answer_text: 'The service allows 100 requests per minute, and the limit resets every minute.', tool_calls: [], latency_ms: 70 };
    }
    if (task.id === 'C_price_constraint') {
      return { answer_text: '{"status":"ok","price":120}', structured_answer: { status: 'ok', price: 120 }, tool_calls: [], latency_ms: 70 };
    }
    if (task.id === 'H_anti_swap') {
      return { answer_text: 'The total is 200.', tool_calls: [], latency_ms: 65 };
    }
    return correctFixture(task, mode);
  }

  if (mode === 'advisory') {
    if (task.id === 'N_wrong_sum') {
      return { answer_text: 'The total is 150.', tool_calls: ['plan_checks'], latency_ms: 115 };
    }
    if (task.id === 'F_unsupported_reset') {
      return { answer_text: 'The service allows 100 requests per minute, and the limit resets every minute.', tool_calls: ['plan_checks'], latency_ms: 110 };
    }
    if (task.id === 'C_price_constraint') {
      return { answer_text: '{"status":"ok","price":120}', structured_answer: { status: 'ok', price: 120 }, tool_calls: ['plan_checks'], latency_ms: 112 };
    }
    if (task.id === 'H_anti_swap') {
      return { answer_text: 'The total is 150. Final displayed total: 200.', tool_calls: ['plan_checks'], latency_ms: 112 };
    }
    return { ...correctFixture(task, mode), tool_calls: ['plan_checks'], latency_ms: 115 };
  }

  if (mode === 'enforced') {
    if (task.id === 'F_unsupported_reset') {
      return {
        answer_text: 'The service allows 100 requests per minute, and the limit resets every minute.',
        contract_override: { task_type: 'freeform', evidence_level: 'none', risk_level: 'low', claims: [], must_include: [], must_not_include: [], contract_authority: 'agent', profile_source: 'agent_declared' },
        tool_calls: ['plan_checks', 'finalize_deliverable'],
        latency_ms: 160,
      };
    }
    if (task.id === 'C_price_constraint') {
      return {
        answer_text: '{"status":"ok","price":120}',
        structured_answer: { status: 'ok', price: 120 },
        contract_override: { task_type: 'freeform', evidence_level: 'none', risk_level: 'low', required_fields: [], contract_authority: 'agent', profile_source: 'agent_declared' },
        tool_calls: ['plan_checks', 'finalize_deliverable'],
        latency_ms: 162,
      };
    }
    if (task.id === 'H_anti_swap') {
      return {
        ...correctFixture(task, mode),
        surfaced_answer: 'The total is 200.',
        tool_calls: ['plan_checks', 'finalize_deliverable'],
        latency_ms: 165,
      };
    }
    return {
      ...correctFixture(task, mode),
      contract_override: { contract_authority: 'agent', profile_source: 'agent_declared' },
      latency_ms: 165,
    };
  }

  if (mode === 'debug_raw') {
    if (task.id === 'F_unsupported_reset') {
      return {
        answer_text: 'The service allows 100 requests per minute, and the limit resets every minute.',
        sources: task.sources,
        claims: [{
          claim_id: 'rate',
          claim_text: 'The service rate limit is 100 requests per minute',
          source_id: 's1',
          quoted_span: 'rate limit of 100 requests per minute',
          supporting_token: '100',
          claim_kind: 'numeric' as ClaimKind,
        }],
        tool_calls: ['check_quote_grounding', 'check_claim_coverage'],
        latency_ms: 220,
      };
    }
    if (task.id === 'N_wrong_sum') {
      return {
        answer_text: 'The total is 200.',
        ...numericArtifacts(200, [120, 30], 'sum'),
        tool_calls: ['check_numeric_claims', 'trace_conclusion_numbers', 'verify_arithmetic'],
        latency_ms: 230,
      };
    }
    return {
      ...correctFixture(task, mode),
      tool_calls: ['check_quote_grounding', 'trace_conclusion_numbers', 'check_answer_against_constraints'],
      latency_ms: 225,
    };
  }

  if (mode === 'enforced_host_contract' && task.id === 'H_anti_swap') {
    return {
      ...correctFixture(task, mode),
      surfaced_answer: 'The total is 200.',
    };
  }

  return correctFixture(task, mode);
}

export function getToolSurface(mode: BenchmarkCondition): readonly string[] {
  if (mode === 'baseline') return [];
  if (mode === 'debug_raw') return DEBUG_RAW_TOOL_SURFACE;
  return PRODUCT_FACADE_TOOL_SURFACE;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function evaluateConstraint(op: ConstraintTruthCheck['op'], actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (op === '<') return actual < expected;
    if (op === '<=') return actual <= expected;
    if (op === '>') return actual > expected;
    if (op === '>=') return actual >= expected;
  }
  if (op === '==') return actual === expected;
  if (op === '!=') return actual !== expected;
  if (op === 'in' && Array.isArray(expected)) return expected.includes(actual);
  if (op === 'not_in' && Array.isArray(expected)) return !expected.includes(actual);
  return false;
}

export function scoreFacadeCandidate(task: FacadeBenchmarkTask, answerText: string, structured?: Record<string, unknown>): ObjectiveScore {
  const requiredAllMissing = (task.truth.required_all ?? []).filter(token => !includesText(answerText, token)).length;
  const requiredAnyMissing = (task.truth.required_any ?? []).filter(group => !group.some(token => includesText(answerText, token))).length;
  const wrongNumbers = (task.truth.forbidden_numbers ?? []).filter(token => includesText(answerText, token)).length + requiredAllMissing + requiredAnyMissing;
  const unsupportedClaims = (task.truth.unsupported_phrases ?? []).filter(phrase => includesText(answerText, phrase)).length;

  const structuredAnswer = structured ?? extractJsonObject(answerText) ?? {};
  let constraintViolations = 0;
  for (const check of task.truth.constraint_checks ?? []) {
    if (!evaluateConstraint(check.op, structuredAnswer[check.field], check.value)) constraintViolations++;
  }

  const highSevDefects = wrongNumbers + unsupportedClaims + constraintViolations;
  return {
    task_success: highSevDefects === 0,
    high_sev_defects: highSevDefects,
    unsupported_claims: unsupportedClaims,
    wrong_numbers: wrongNumbers,
    constraint_violations: constraintViolations,
  };
}

function buildFinalizeInput(task: FacadeBenchmarkTask, fixture: CandidateFixture): unknown {
  const spec = toContractSpec(task);
  const override = fixture.contract_override ?? {};
  const contract = {
    ...spec,
    ...override,
    contract_authority: override.contract_authority ?? 'agent',
    profile_source: override.profile_source ?? 'agent_declared',
  };
  return {
    contract,
    answer_text: fixture.answer_text,
    sources: fixture.sources,
    claims: fixture.claims,
    inputs: fixture.inputs,
    conclusion_numbers: fixture.conclusion_numbers,
    arithmetic_checks: fixture.arithmetic_checks,
    constraints: fixture.constraints,
    structured_answer: fixture.structured_answer,
  };
}

function runGate(task: FacadeBenchmarkTask, fixture: CandidateFixture, mode: BenchmarkCondition): {
  released: boolean;
  finalize?: FinalizeOutput;
  release?: ReleaseDecision;
} {
  if (mode === 'baseline' || mode === 'advisory' || mode === 'debug_raw') return { released: true };

  if (mode === 'enforced_host_contract') {
    const release = enforceDeliverable(toContractSpec(task), fixture as DeliverableArtifacts, {
      surfaced_answer: fixture.surfaced_answer,
    });
    return { released: release.decision === 'RELEASE', release };
  }

  const finalize = handleFinalizeDeliverable(buildFinalizeInput(task, fixture), new EnforcementEngine());
  return { released: finalize.finalize_verdict === 'PASS', finalize };
}

function countToolChoiceConfusions(fixture: CandidateFixture, mode: BenchmarkCondition): number {
  if (mode === 'baseline') return 0;
  const toolCalls = fixture.tool_calls;
  const usedRawOnly = toolCalls.filter(t => RAW_DEBUG_ONLY_TOOLS.has(t)).length;
  const omittedFinalize = mode !== 'advisory' && mode !== 'debug_raw' && !toolCalls.includes('finalize_deliverable') ? 1 : 0;
  const debugOmittedFinalize = mode === 'debug_raw' && !toolCalls.includes('finalize_deliverable') ? 1 : 0;
  const mixedLeafAndFacade = toolCalls.includes('finalize_deliverable') && usedRawOnly > 0 ? 1 : 0;
  return usedRawOnly + omittedFinalize + debugOmittedFinalize + mixedLeafAndFacade;
}

function countArtifactFormattingFailures(blockingIssues: BlockingIssue[]): number {
  return blockingIssues.filter(issue => issue.mechanism === 'finalize_missing_inputs').length;
}

function runOne(task: FacadeBenchmarkTask, mode: BenchmarkCondition): BenchmarkTaskResult {
  const fixture = fixtureFor(task, mode);
  const gate = runGate(task, fixture, mode);
  const surfaced = fixture.surfaced_answer ?? fixture.answer_text;
  const score = scoreFacadeCandidate(task, surfaced, fixture.structured_answer);
  const released = gate.released;
  const blockingIssues = gate.release?.blocking_issues ?? gate.finalize?.enforcement?.blocking_issues ?? [];
  const warnings = gate.release?.warnings ?? gate.finalize?.enforcement?.warnings ?? [];
  const revisionCount = fixture.revision_count ?? 0;
  const objectiveSuccess = score.task_success;
  const taskSuccess = released && objectiveSuccess;

  return {
    task_id: task.id,
    mode,
    released,
    false_done: released && !objectiveSuccess,
    clean_control: !task.adversarial,
    false_block: !released && objectiveSuccess,
    artifact_formatting_failures: fixture.artifact_formatting_failures ?? countArtifactFormattingFailures(blockingIssues),
    revision_count: revisionCount,
    excessive_revision_loops: revisionCount > 1 ? 1 : 0,
    correction_success: fixture.correction_success ?? (revisionCount > 0 && taskSuccess),
    latency_ms: fixture.latency_ms,
    tool_calls: fixture.tool_calls.length,
    tool_choice_confusions: countToolChoiceConfusions(fixture, mode),
    exposed_tools_count: getToolSurface(mode).length,
    finalize_verdict: gate.release?.finalize_verdict ?? gate.finalize?.finalize_verdict,
    release_decision: gate.release?.decision,
    reject_reason: gate.release?.reason,
    contract_strength: gate.release?.contract_strength ?? gate.finalize?.contract_strength,
    blocking_issues: blockingIssues,
    warnings,
    ...score,
    task_success: taskSuccess,
  };
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4));
}

function computeNetValue(row: BenchmarkTaskResult, baseline?: BenchmarkTaskResult): number {
  if (!baseline) return 0;
  const avoidedHighSeverityDefects = Math.max(0, baseline.high_sev_defects - row.high_sev_defects);
  const avoidedFalseDone = baseline.false_done && !row.false_done ? 1 : 0;
  const taskSuccessDelta = (row.task_success ? 1 : 0) - (baseline.task_success ? 1 : 0);

  return (
    avoidedHighSeverityDefects * 10
    + avoidedFalseDone * 8
    + taskSuccessDelta * 5
    - (row.false_block ? 8 : 0)
    - row.excessive_revision_loops * 3
    - row.artifact_formatting_failures * 2
  );
}

export function summarizeBenchmark(results: BenchmarkTaskResult[], modes: BenchmarkCondition[]): Record<BenchmarkCondition, BenchmarkMetrics> {
  const out = {} as Record<BenchmarkCondition, BenchmarkMetrics>;
  const baselineByTask = new Map(results.filter(r => r.mode === 'baseline').map(r => [r.task_id, r]));
  for (const mode of modes) {
    const rows = results.filter(r => r.mode === mode);
    const cleanRows = rows.filter(r => r.clean_control);
    const correctionRows = rows.filter(r => r.revision_count > 0);
    const baselineRows = rows.map(r => baselineByTask.get(r.task_id));
    out[mode] = {
      task_success_rate: roundMetric(avg(rows.map(r => r.task_success ? 1 : 0))),
      high_sev_defects_per_task: roundMetric(avg(rows.map(r => r.high_sev_defects))),
      unsupported_claims_per_task: roundMetric(avg(rows.map(r => r.unsupported_claims))),
      wrong_numbers_per_task: roundMetric(avg(rows.map(r => r.wrong_numbers))),
      constraint_violations_per_task: roundMetric(avg(rows.map(r => r.constraint_violations))),
      false_done_rate: roundMetric(avg(rows.map(r => r.false_done ? 1 : 0))),
      false_block_rate_clean_controls: roundMetric(avg(cleanRows.map(r => r.false_block ? 1 : 0))),
      artifact_formatting_failures_per_task: roundMetric(avg(rows.map(r => r.artifact_formatting_failures))),
      avg_revision_count: roundMetric(avg(rows.map(r => r.revision_count))),
      excessive_revision_loops_per_task: roundMetric(avg(rows.map(r => r.excessive_revision_loops))),
      correction_success_rate: roundMetric(avg(correctionRows.map(r => r.correction_success ? 1 : 0))),
      task_success_delta_vs_baseline: roundMetric(avg(rows.map((r, i) => (r.task_success ? 1 : 0) - (baselineRows[i]?.task_success ? 1 : 0)))),
      avoided_high_sev_defects_per_task: roundMetric(avg(rows.map((r, i) => Math.max(0, (baselineRows[i]?.high_sev_defects ?? r.high_sev_defects) - r.high_sev_defects)))),
      avoided_false_done_rate: roundMetric(avg(rows.map((r, i) => baselineRows[i]?.false_done && !r.false_done ? 1 : 0))),
      net_value: roundMetric(rows.reduce((sum, row) => sum + computeNetValue(row, baselineByTask.get(row.task_id)), 0)),
      avg_latency_ms: roundMetric(avg(rows.map(r => r.latency_ms))),
      avg_tool_calls: roundMetric(avg(rows.map(r => r.tool_calls))),
      avg_tool_choice_confusions: roundMetric(avg(rows.map(r => r.tool_choice_confusions))),
      exposed_tools_count: getToolSurface(mode).length,
    };
  }
  return out;
}

export function runFacadeValueBenchmark(opts: { includeDebugRaw?: boolean; modes?: BenchmarkCondition[] } = {}): FacadeValueBenchmarkReport {
  const corpus = getFacadeBenchmarkCorpus();
  const modes = opts.modes ?? [
    ...PRODUCT_VALUE_MODES,
    ...(opts.includeDebugRaw ? ['debug_raw' as const] : []),
  ];
  const results = modes.flatMap(mode => corpus.map(task => runOne(task, mode)));
  const toolSurfaces = {} as Record<BenchmarkCondition, readonly string[]>;
  for (const mode of modes) toolSurfaces[mode] = getToolSurface(mode);

  return {
    corpus,
    modes,
    product_value_modes: [...PRODUCT_VALUE_MODES],
    diagnostic_conditions: modes.includes('debug_raw') ? ['debug_raw'] : [],
    proof_boundary: {
      correctness_proof_claim: 'Correctness proof is limited to deterministic gate mechanics: finalize re-execution, host-authored contracts, and anti-swap release checks on supplied artifacts.',
      product_value_claim: 'Deterministic fixture value signal only: this fixed no-LLM corpus can measure seeded defects prevented, false done avoided, and facade/tool-friction against baseline/advisory conditions, but it is not live agent product-value proof.',
      oracle: 'deterministic_fixture_grader_no_llm',
    },
    tool_surfaces: toolSurfaces,
    results,
    metrics_by_mode: summarizeBenchmark(results, modes),
  };
}
