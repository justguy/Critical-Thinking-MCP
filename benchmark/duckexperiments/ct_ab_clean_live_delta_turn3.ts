import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildRevisionRequest,
  collectCalibrationMetricObservations,
  getHistoricalTurn3Stats,
  runOrchestrator,
} from '../../src/orchestrator/index.js';
import type {
  CalibrationGateIssue,
  ContractKey,
  OrchestratorEnvelope,
  OrchestratorResult,
  OrchestratorToolName,
  ReviewContext,
  RevisionRequest,
} from '../../src/orchestrator/index.js';
import { PROMPTS } from './manifest.js';

type PromptId = 'Q01' | 'Q04' | 'Q09';
type RoundKind = 'separate_sessions' | 'multi_turn';
type Arm = 'A' | 'B';
type SessionMode = 'fresh' | 'continued';
type PassStage = 'initial' | 'revision_1' | 'revision_2';
type FinalOutcome = 'accepted' | 'human_review';

interface ToolCallRecord {
  id: string;
  name: string;
  input: unknown;
  rawOutputText: string;
  output: unknown;
}

interface SelectedMetric {
  tool: OrchestratorToolName;
  metric_name: string;
  observed_value: number;
  threshold: number;
  comparator: '>=' | '<=';
  normalized_shortfall: number;
  description: string;
}

interface Turn3Decision {
  considered: boolean;
  allowed: boolean;
  reason: string;
  initial_selected_metric: SelectedMetric | null;
  turn2_selected_metric: SelectedMetric | null;
  delta_from_turn1_to_turn2: number | null;
  remaining_gap_after_turn2: number | null;
  historical_stats: ReturnType<typeof getHistoricalTurn3Stats> | null;
}

interface PassRecord {
  stage: PassStage;
  promptText: string;
  args: string[];
  rawStreamPath: string;
  rawStream: string;
  finalResponseText: string;
  toolCalls: ToolCallRecord[];
  resultEvent: unknown;
  calibrationEnvelope: OrchestratorEnvelope | null;
  calibrationResult: OrchestratorResult | null;
  reviewContextUsed: ReviewContext | null;
  selectedMetric: SelectedMetric | null;
  deltaFromPriorTurn: number | null;
}

interface RunRecord {
  round: RoundKind;
  arm: Arm;
  promptId: PromptId;
  sessionMode: SessionMode;
  workdir: string;
  passes: PassRecord[];
  revisionRequests: RevisionRequest[];
  turn3Decision: Turn3Decision | null;
  finalPolicyDecision: string;
  finalOutcome: FinalOutcome;
  finalAcceptedResponseText: string | null;
  humanReviewReason: string | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

const reportPath = resolve(
  repoRoot,
  'docs/reports/ct_ab_clean_live_delta_turn3_2026-04-09.md',
);
const outDir = resolve(
  repoRoot,
  'benchmark/duckexperiments/.ct_ab_clean_live_delta_turn3_2026-04-09',
);
const calibrationDbPath = resolve(outDir, 'ct_calibration.sqlite');

const promptIds: PromptId[] = ['Q01', 'Q04', 'Q09'];
const MODEL_ID = 'claude-sonnet-4-6';
const TURN3_EPSILON = 0.02;
const TURN3_NEAR_MISS_GAP = 0.15;
const TURN3_MIN_HISTORY = 2;
const TURN3_MIN_SUCCESS_RATE = 0.35;

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function fenced(text: string, lang = ''): string {
  return `\`\`\`${lang}\n${text.trimEnd()}\n\`\`\``;
}

function designatedTools(
  promptId: PromptId,
): { primary: string; secondary: string } {
  return {
    primary: PROMPTS[promptId].primaryTool,
    secondary: PROMPTS[promptId].secondaryTool,
  };
}

function promptFamily(promptId: PromptId): string {
  switch (promptId) {
    case 'Q04':
      return 'forecasting';
    case 'Q09':
      return 'absurd_sla';
    default:
      return 'operational_claim';
  }
}

function calibrationSessionMode(round: RoundKind): 'single_turn' | 'multi_turn' {
  return round === 'multi_turn' ? 'multi_turn' : 'single_turn';
}

function buildInitialArmPrompt(promptId: PromptId, arm: Arm): string {
  const canonical = PROMPTS[promptId].text;
  if (arm === 'A') {
    return [
      'You are participating in a controlled A/B experiment.',
      '',
      'Rules:',
      '- Answer the prompt exactly once.',
      '- Do not use CT-MCP tools.',
      '- Do not use any other tools.',
      '- Do not ask follow-up questions.',
      '- Keep the answer under 120 words.',
      '',
      'Return only the user-facing answer.',
      '',
      `Prompt ID: ${promptId}`,
      '',
      'Prompt:',
      canonical,
    ].join('\n');
  }

  const { primary, secondary } = designatedTools(promptId);
  return [
    'You are participating in a controlled A/B experiment.',
    '',
    'Rules:',
    '- Before answering, you must call the designated CT-MCP tools if they are available in this host.',
    `- Primary designated tool: ${primary}.`,
    `- Secondary designated tool: ${secondary}.`,
    '- Use the primary tool first.',
    '- Use the secondary tool as well unless it is unavailable.',
    '- Do not use any non-CT tools.',
    '- Do not ask follow-up questions.',
    '- Keep the final answer under 120 words.',
    '- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.',
    '',
    'Return only the user-facing answer. Do not narrate tool usage.',
    '',
    `Prompt ID: ${promptId}`,
    '',
    'Prompt:',
    canonical,
  ].join('\n');
}

function buildRevisionPrompt(
  promptId: PromptId,
  revisionRequest: RevisionRequest,
  revisionNumber: 1 | 2,
): string {
  const { primary, secondary } = designatedTools(promptId);
  const banner =
    revisionNumber === 1
      ? 'This is the first allowed revision turn after deterministic CT review.'
      : 'This is the second and final allowed revision turn after deterministic CT review.';

  return [
    'You are participating in a controlled A/B experiment.',
    '',
    banner,
    '',
    'Rules:',
    '- Before answering, you must call the designated CT-MCP tools if they are available in this host.',
    `- Primary designated tool: ${primary}.`,
    `- Secondary designated tool: ${secondary}.`,
    '- Use the primary tool first.',
    '- Use the secondary tool as well unless it is unavailable.',
    '- Do not use any non-CT tools.',
    '- Do not ask follow-up questions.',
    '- Keep the final answer under 120 words.',
    '- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.',
    '- If the original claim cannot be supported safely, narrow or withdraw it instead of inventing detail.',
    ...(revisionNumber === 2
      ? ['- This is the last allowed model rewrite. If you cannot close the metric gap, make the limitation explicit instead of pretending it is fixed.']
      : []),
    '',
    'Return only the revised user-facing answer. Do not narrate tool usage.',
    '',
    'Deterministic revision request:',
    revisionRequest.prompt,
    '',
    'Next review context after this revision:',
    JSON.stringify(revisionRequest.next_review_context, null, 2),
  ].join('\n');
}

function buildArgs(promptText: string, sessionMode: SessionMode): string[] {
  const args = [
    '-p',
    '--verbose',
    '--output-format',
    'stream-json',
    '--permission-mode',
    'bypassPermissions',
    '--add-dir',
    '/tmp',
    '--model',
    'sonnet',
    '--effort',
    'low',
  ];

  if (sessionMode === 'continued') {
    args.push('--continue');
  } else {
    args.push('--no-session-persistence');
  }

  args.push(promptText);
  return args;
}

function parseJsonLines(raw: string): unknown[] {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function parseToolCalls(events: unknown[]): ToolCallRecord[] {
  const calls = new Map<string, ToolCallRecord>();

  for (const event of events) {
    const typed = event as Record<string, unknown>;
    if (typed.type === 'assistant') {
      const message = typed.message as Record<string, unknown> | undefined;
      const content =
        (message?.content as Array<Record<string, unknown>> | undefined) ?? [];
      for (const item of content) {
        if (item.type !== 'tool_use') continue;
        const id = String(item.id);
        calls.set(id, {
          id,
          name: String(item.name),
          input: item.input,
          rawOutputText: '',
          output: null,
        });
      }
    }

    if (typed.type === 'user') {
      const message = typed.message as Record<string, unknown> | undefined;
      const content =
        (message?.content as Array<Record<string, unknown>> | undefined) ?? [];
      for (const item of content) {
        if (item.type !== 'tool_result') continue;
        const toolUseId = String(item.tool_use_id);
        const contentParts =
          (item.content as Array<Record<string, unknown>> | undefined) ?? [];
        const textPart = contentParts.find(part => part.type === 'text');
        if (!textPart) continue;
        const rawOutputText = String(textPart.text ?? '');
        const call = calls.get(toolUseId);
        if (!call) continue;
        let output: unknown = rawOutputText;
        try {
          output = JSON.parse(rawOutputText);
        } catch {
          output = rawOutputText;
        }
        call.rawOutputText = rawOutputText;
        call.output = output;
      }
    }
  }

  return Array.from(calls.values());
}

function extractFinalResponse(events: unknown[]): string {
  const resultEvent = events.find(event => {
    const typed = event as Record<string, unknown>;
    return typed.type === 'result';
  }) as Record<string, unknown> | undefined;

  if (resultEvent && typeof resultEvent.result === 'string') {
    return resultEvent.result;
  }

  const assistantTextChunks: string[] = [];
  for (const event of events) {
    const typed = event as Record<string, unknown>;
    if (typed.type !== 'assistant') continue;
    const message = typed.message as Record<string, unknown> | undefined;
    const content =
      (message?.content as Array<Record<string, unknown>> | undefined) ?? [];
    for (const item of content) {
      if (item.type === 'text' && typeof item.text === 'string') {
        assistantTextChunks.push(item.text);
      }
    }
  }
  return assistantTextChunks.join('\n').trim();
}

function extractResultEvent(events: unknown[]): unknown {
  return (
    events.find(event => {
      const typed = event as Record<string, unknown>;
      return typed.type === 'result';
    }) ?? null
  );
}

function stripContext(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const obj = value as Record<string, unknown>;
  const { context: _context, ...rest } = obj;
  return rest;
}

function toolNameToContractKey(toolName: string): ContractKey | null {
  switch (toolName) {
    case 'mcp__ct-mcp__validate_confidence':
      return 'confidence';
    case 'mcp__ct-mcp__validate_reasoning_chain':
      return 'reasoning_chain';
    case 'mcp__ct-mcp__check_plan_validity':
      return 'plan';
    case 'mcp__ct-mcp__detect_concurrency_patterns':
      return 'concurrency';
    case 'mcp__ct-mcp__score_response_quality':
      return 'quality';
    default:
      return null;
  }
}

function buildCalibrationEnvelope(run: {
  finalResponseText: string;
  toolCalls: ToolCallRecord[];
  reviewContext: ReviewContext;
}): OrchestratorEnvelope | null {
  const contracts: Partial<Record<ContractKey, unknown>> = {};

  for (const toolCall of run.toolCalls) {
    const key = toolNameToContractKey(toolCall.name);
    if (!key) continue;
    contracts[key] = stripContext(toolCall.input);
  }

  if (Object.keys(contracts).length === 0) {
    return null;
  }

  return {
    schema_version: 'orchestrator_v0',
    answer_text: run.finalResponseText,
    contracts,
    mode: 'routed',
    review_context: run.reviewContext,
  };
}

function shortfall(
  comparator: '>=' | '<=',
  observedValue: number,
  threshold: number,
): number {
  return comparator === '>='
    ? Math.max(0, threshold - observedValue)
    : Math.max(0, observedValue - threshold);
}

function normalizedShortfall(
  comparator: '>=' | '<=',
  observedValue: number,
  threshold: number,
): number {
  const denominator = Math.max(Math.abs(threshold), 1);
  return shortfall(comparator, observedValue, threshold) / denominator;
}

function selectedMetricFromIssue(issue: CalibrationGateIssue): SelectedMetric {
  return {
    tool: issue.tool,
    metric_name: issue.metric_name,
    observed_value: issue.observed_value,
    threshold: issue.required_value,
    comparator: issue.comparator,
    normalized_shortfall: normalizedShortfall(
      issue.comparator,
      issue.observed_value,
      issue.required_value,
    ),
    description: issue.description,
  };
}

function selectPrimaryMetric(
  result: OrchestratorResult | null,
): SelectedMetric | null {
  const issues = result?.calibration?.metric_gate_failures ?? [];
  if (issues.length === 0) return null;

  let best: SelectedMetric | null = null;
  for (const issue of issues) {
    const candidate = selectedMetricFromIssue(issue);
    if (!best || candidate.normalized_shortfall > best.normalized_shortfall) {
      best = candidate;
    }
  }
  return best;
}

function materializeMetricForResult(
  result: OrchestratorResult | null,
  reference: SelectedMetric | null,
): SelectedMetric | null {
  if (!result || !reference) return null;

  const currentIssue = (result.calibration?.metric_gate_failures ?? []).find(
    issue =>
      issue.tool === reference.tool &&
      issue.metric_name === reference.metric_name,
  );
  if (currentIssue) {
    return selectedMetricFromIssue(currentIssue);
  }

  const observation = collectCalibrationMetricObservations(result).find(
    metric =>
      metric.scope === 'routed' &&
      metric.tool === reference.tool &&
      metric.metric_name === reference.metric_name,
  );
  if (!observation) {
    return null;
  }

  return {
    tool: reference.tool,
    metric_name: reference.metric_name,
    observed_value: observation.metric_value,
    threshold: reference.threshold,
    comparator: reference.comparator,
    normalized_shortfall: normalizedShortfall(
      reference.comparator,
      observation.metric_value,
      reference.threshold,
    ),
    description: reference.description,
  };
}

function hasHardFailure(result: OrchestratorResult): boolean {
  return result.route_results.some(route => route.status === 'ENFORCEMENT_FAIL');
}

function stableMetricFailureSet(
  result: OrchestratorResult,
  target: SelectedMetric,
): boolean {
  const issues = result.calibration?.metric_gate_failures ?? [];
  if (issues.length === 0) return false;
  return issues.every(
    issue =>
      issue.tool === target.tool && issue.metric_name === target.metric_name,
  );
}

function evaluateTurn3Decision(input: {
  round: RoundKind;
  promptId: PromptId;
  turn2Result: OrchestratorResult;
  initialMetric: SelectedMetric | null;
  turn2Metric: SelectedMetric | null;
}): Turn3Decision {
  if (!input.initialMetric) {
    return {
      considered: true,
      allowed: false,
      reason: 'No calibration metric gate failure was selected from turn 1.',
      initial_selected_metric: null,
      turn2_selected_metric: null,
      delta_from_turn1_to_turn2: null,
      remaining_gap_after_turn2: null,
      historical_stats: null,
    };
  }

  if (hasHardFailure(input.turn2Result)) {
    return {
      considered: true,
      allowed: false,
      reason: 'Turn 2 still has deterministic or schema enforcement failures.',
      initial_selected_metric: input.initialMetric,
      turn2_selected_metric: input.turn2Metric,
      delta_from_turn1_to_turn2: null,
      remaining_gap_after_turn2: null,
      historical_stats: null,
    };
  }

  if (!input.turn2Metric) {
    return {
      considered: true,
      allowed: false,
      reason:
        'Turn 2 no longer exposes the selected metric as a measurable routed observation.',
      initial_selected_metric: input.initialMetric,
      turn2_selected_metric: null,
      delta_from_turn1_to_turn2: null,
      remaining_gap_after_turn2: null,
      historical_stats: null,
    };
  }

  if (!stableMetricFailureSet(input.turn2Result, input.initialMetric)) {
    return {
      considered: true,
      allowed: false,
      reason:
        'Turn 2 failure set changed or expanded beyond the original selected metric.',
      initial_selected_metric: input.initialMetric,
      turn2_selected_metric: input.turn2Metric,
      delta_from_turn1_to_turn2:
        input.initialMetric.normalized_shortfall -
        input.turn2Metric.normalized_shortfall,
      remaining_gap_after_turn2: input.turn2Metric.normalized_shortfall,
      historical_stats: null,
    };
  }

  const delta =
    input.initialMetric.normalized_shortfall -
    input.turn2Metric.normalized_shortfall;
  const remainingGap = input.turn2Metric.normalized_shortfall;
  const historical = getHistoricalTurn3Stats({
    db_path: calibrationDbPath,
    model: MODEL_ID,
    prompt_family: promptFamily(input.promptId),
    session_mode: calibrationSessionMode(input.round),
    selected_metric_tool: input.initialMetric.tool,
    selected_metric_name: input.initialMetric.metric_name,
  });

  if (delta <= 0) {
    return {
      considered: true,
      allowed: false,
      reason: `Turn 2 did not improve the selected metric. Observed delta ${delta.toFixed(3)}.`,
      initial_selected_metric: input.initialMetric,
      turn2_selected_metric: input.turn2Metric,
      delta_from_turn1_to_turn2: delta,
      remaining_gap_after_turn2: remainingGap,
      historical_stats: historical,
    };
  }

  if (delta < TURN3_EPSILON) {
    return {
      considered: true,
      allowed: false,
      reason: `Turn 2 improved the selected metric, but only by ${delta.toFixed(3)} which is below epsilon ${TURN3_EPSILON.toFixed(3)}.`,
      initial_selected_metric: input.initialMetric,
      turn2_selected_metric: input.turn2Metric,
      delta_from_turn1_to_turn2: delta,
      remaining_gap_after_turn2: remainingGap,
      historical_stats: historical,
    };
  }

  if (remainingGap > TURN3_NEAR_MISS_GAP) {
    return {
      considered: true,
      allowed: false,
      reason: `Turn 2 is still too far from threshold. Remaining normalized gap ${remainingGap.toFixed(3)} exceeds near-miss limit ${TURN3_NEAR_MISS_GAP.toFixed(3)}.`,
      initial_selected_metric: input.initialMetric,
      turn2_selected_metric: input.turn2Metric,
      delta_from_turn1_to_turn2: delta,
      remaining_gap_after_turn2: remainingGap,
      historical_stats: historical,
    };
  }

  if (
    historical.sample_count >= TURN3_MIN_HISTORY &&
    historical.success_rate < TURN3_MIN_SUCCESS_RATE
  ) {
    return {
      considered: true,
      allowed: false,
      reason: `Historical turn-3 success for this model/family/metric is ${historical.success_rate.toFixed(3)} across ${historical.sample_count} samples, below floor ${TURN3_MIN_SUCCESS_RATE.toFixed(3)}.`,
      initial_selected_metric: input.initialMetric,
      turn2_selected_metric: input.turn2Metric,
      delta_from_turn1_to_turn2: delta,
      remaining_gap_after_turn2: remainingGap,
      historical_stats: historical,
    };
  }

  return {
    considered: true,
    allowed: true,
    reason:
      historical.sample_count >= TURN3_MIN_HISTORY
        ? `Turn 2 is a near-miss and model-history supports one more rewrite. Historical success rate ${historical.success_rate.toFixed(3)} across ${historical.sample_count} samples.`
        : 'Turn 2 is a near-miss with positive delta. History is still sparse, so the gate falls back to live improvement plus gap size.',
    initial_selected_metric: input.initialMetric,
    turn2_selected_metric: input.turn2Metric,
    delta_from_turn1_to_turn2: delta,
    remaining_gap_after_turn2: remainingGap,
    historical_stats: historical,
  };
}

function runClaudePass(input: {
  round: RoundKind;
  arm: Arm;
  promptId: PromptId;
  stage: PassStage;
  workdir: string;
  sessionMode: SessionMode;
  promptText: string;
  reviewContext: ReviewContext | null;
}): PassRecord {
  ensureDir(input.workdir);
  const args = buildArgs(input.promptText, input.sessionMode);
  const result = spawnSync('claude', args, {
    cwd: input.workdir,
    encoding: 'utf-8',
    timeout: 900_000,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Claude invocation failed for ${input.round}/${input.arm}/${input.promptId}/${input.stage} with status ${result.status}\nSTDERR:\n${result.stderr ?? ''}\nSTDOUT:\n${result.stdout ?? ''}`,
    );
  }

  const rawStream = result.stdout ?? '';
  const events = parseJsonLines(rawStream);
  const rawStreamPath = resolve(
    outDir,
    input.round,
    input.arm,
    `${input.promptId}.${input.stage}.${input.sessionMode}.stream.jsonl`,
  );
  ensureDir(dirname(rawStreamPath));
  writeFileSync(rawStreamPath, rawStream, 'utf-8');

  return {
    stage: input.stage,
    promptText: input.promptText,
    args,
    rawStreamPath,
    rawStream,
    finalResponseText: extractFinalResponse(events),
    toolCalls: parseToolCalls(events),
    resultEvent: extractResultEvent(events),
    calibrationEnvelope: null,
    calibrationResult: null,
    reviewContextUsed: input.reviewContext,
    selectedMetric: null,
    deltaFromPriorTurn: null,
  };
}

function calibratePass(
  pass: PassRecord,
  input: {
    round: RoundKind;
    promptId: PromptId;
    turnChainId: string;
    referenceMetric?: SelectedMetric | null;
  },
): PassRecord {
  if (!pass.reviewContextUsed) {
    return pass;
  }

  const envelope = buildCalibrationEnvelope({
    finalResponseText: pass.finalResponseText,
    toolCalls: pass.toolCalls,
    reviewContext: pass.reviewContextUsed,
  });
  if (!envelope) {
    return {
      ...pass,
      calibrationEnvelope: null,
      calibrationResult: null,
      selectedMetric: null,
      deltaFromPriorTurn: null,
    };
  }

  const runtimeBase = {
    model: MODEL_ID,
    prompt_family: promptFamily(input.promptId),
    session_mode: calibrationSessionMode(input.round),
  } as const;

  const evaluated = runOrchestrator(envelope, {
    calibration: runtimeBase,
  });
  const selectedMetric = input.referenceMetric
    ? materializeMetricForResult(evaluated, input.referenceMetric)
    : selectPrimaryMetric(evaluated);
  const deltaFromPriorTurn =
    input.referenceMetric && selectedMetric
      ? input.referenceMetric.normalized_shortfall -
        selectedMetric.normalized_shortfall
      : null;
  const released =
    evaluated.policy_decision === 'PASS' || evaluated.policy_decision === 'WARN';

  const recorded = runOrchestrator(envelope, {
    calibration: {
      ...runtimeBase,
      db_path: calibrationDbPath,
      turn_chain_id: input.turnChainId,
      selected_metric_tool: selectedMetric?.tool,
      selected_metric_name: selectedMetric?.metric_name,
      selected_metric_value: selectedMetric?.observed_value,
      selected_metric_threshold: selectedMetric?.threshold,
      delta_from_prior_turn: deltaFromPriorTurn ?? undefined,
      released,
    },
  });

  return {
    ...pass,
    calibrationEnvelope: envelope,
    calibrationResult: recorded,
    selectedMetric,
    deltaFromPriorTurn,
  };
}

function runOne(
  round: RoundKind,
  arm: Arm,
  promptId: PromptId,
  workdir: string,
  sessionMode: SessionMode,
): RunRecord {
  const turnChainId = `${round}.${promptId}.${arm}.${Date.now()}`;
  const passes: PassRecord[] = [];
  const revisionRequests: RevisionRequest[] = [];

  const initialPass = runClaudePass({
    round,
    arm,
    promptId,
    stage: 'initial',
    workdir,
    sessionMode,
    promptText: buildInitialArmPrompt(promptId, arm),
    reviewContext:
      arm === 'B'
        ? {
            iteration_number: 1,
            prior_failures: [],
          }
        : null,
  });

  if (arm === 'A') {
    passes.push(initialPass);
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision: null,
      finalPolicyDecision: 'not_evaluated',
      finalOutcome: 'accepted',
      finalAcceptedResponseText: initialPass.finalResponseText,
      humanReviewReason: null,
    };
  }

  const calibratedInitial = calibratePass(initialPass, {
    round,
    promptId,
    turnChainId,
  });
  passes.push(calibratedInitial);

  if (!calibratedInitial.calibrationResult) {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision: null,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason:
        'Initial CT-enabled pass produced no usable CT tool calls, so no calibration envelope could be built.',
    };
  }

  if (calibratedInitial.calibrationResult.policy_decision !== 'REVISE') {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision: null,
      finalPolicyDecision: calibratedInitial.calibrationResult.policy_decision,
      finalOutcome: 'accepted',
      finalAcceptedResponseText: calibratedInitial.finalResponseText,
      humanReviewReason: null,
    };
  }

  const revisionRequest1 =
    calibratedInitial.calibrationResult.revision_request ?? null;
  if (!revisionRequest1) {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision: null,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason:
        'Turn 1 required revision but did not produce a deterministic revision request.',
    };
  }
  revisionRequests.push(revisionRequest1);

  const revisionPass1 = calibratePass(
    runClaudePass({
      round,
      arm,
      promptId,
      stage: 'revision_1',
      workdir,
      sessionMode: 'continued',
      promptText: buildRevisionPrompt(promptId, revisionRequest1, 1),
      reviewContext: revisionRequest1.next_review_context,
    }),
    {
      round,
      promptId,
      turnChainId,
      referenceMetric: calibratedInitial.selectedMetric,
    },
  );
  passes.push(revisionPass1);

  if (!revisionPass1.calibrationResult) {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision: null,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason:
        'Turn 2 produced no usable CT tool calls, so the bounded rewrite could not be verified.',
    };
  }

  if (revisionPass1.calibrationResult.policy_decision !== 'HUMAN_REVIEW') {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision: null,
      finalPolicyDecision: revisionPass1.calibrationResult.policy_decision,
      finalOutcome: 'accepted',
      finalAcceptedResponseText: revisionPass1.finalResponseText,
      humanReviewReason: null,
    };
  }

  const turn3Decision = evaluateTurn3Decision({
    round,
    promptId,
    turn2Result: revisionPass1.calibrationResult,
    initialMetric: calibratedInitial.selectedMetric,
    turn2Metric: revisionPass1.selectedMetric,
  });

  if (!turn3Decision.allowed) {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason: `Turn 3 gate denied another rewrite. ${turn3Decision.reason}`,
    };
  }

  const revisionRequest2 = buildRevisionRequest(
    revisionPass1.finalResponseText,
    revisionPass1.calibrationResult.critique,
    revisionPass1.reviewContextUsed ?? revisionRequest1.next_review_context,
  );
  if (!revisionRequest2) {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason:
        'Turn 3 was allowed but a deterministic second revision request could not be built.',
    };
  }
  revisionRequests.push(revisionRequest2);

  const revisionPass2 = calibratePass(
    runClaudePass({
      round,
      arm,
      promptId,
      stage: 'revision_2',
      workdir,
      sessionMode: 'continued',
      promptText: buildRevisionPrompt(promptId, revisionRequest2, 2),
      reviewContext: revisionRequest2.next_review_context,
    }),
    {
      round,
      promptId,
      turnChainId,
      referenceMetric: revisionPass1.selectedMetric ?? calibratedInitial.selectedMetric,
    },
  );
  passes.push(revisionPass2);

  if (!revisionPass2.calibrationResult) {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason:
        'Turn 3 produced no usable CT tool calls, so the final bounded rewrite could not be verified.',
    };
  }

  if (revisionPass2.calibrationResult.policy_decision === 'HUMAN_REVIEW') {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      passes,
      revisionRequests,
      turn3Decision,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason:
        'The second and final bounded rewrite still failed the calibrated CT gate.',
    };
  }

  return {
    round,
    arm,
    promptId,
    sessionMode,
    workdir,
    passes,
    revisionRequests,
    turn3Decision,
    finalPolicyDecision: revisionPass2.calibrationResult.policy_decision,
    finalOutcome: 'accepted',
    finalAcceptedResponseText: revisionPass2.finalResponseText,
    humanReviewReason: null,
  };
}

function toolMetricsSummary(toolCall: ToolCallRecord): string[] {
  if (!toolCall.output || typeof toolCall.output !== 'object') {
    return ['- output was not valid JSON'];
  }
  const obj = toolCall.output as Record<string, unknown>;
  const lines: string[] = [];
  const scalarKeys = [
    'status',
    'overall_score',
    'substance_score',
    'specificity_score',
    'structure_score',
    'hedge_density',
    'honest_ceiling',
    'claimed_confidence',
    'gap',
    'inflation_detected',
    'assumption_count',
    'falsifiability_score',
    'grounding_score',
    'completeness_score',
    'hazard_count',
    'critical_count',
    'context_used',
  ];
  for (const key of scalarKeys) {
    if (key in obj) {
      lines.push(`- ${key}: \`${String(obj[key])}\``);
    }
  }
  const enforcement = obj.enforcement as Record<string, unknown> | undefined;
  const warnings = Array.isArray(enforcement?.warnings) ? enforcement.warnings : [];
  const blocking = Array.isArray(enforcement?.blocking_issues)
    ? enforcement.blocking_issues
    : [];
  lines.push(`- warning_count: \`${warnings.length}\``);
  lines.push(`- blocking_issue_count: \`${blocking.length}\``);
  return lines;
}

function calibrationSummary(pass: PassRecord, arm: Arm): string[] {
  if (arm === 'A') {
    return ['- calibration_result: `not_run`'];
  }

  const result = pass.calibrationResult;
  if (!result) {
    return ['- calibration_result: `not_run`'];
  }

  return [
    `- calibration_policy_decision: \`${result.policy_decision}\``,
    `- calibration_profile_id: \`${result.calibration?.profile_id ?? 'unknown'}\``,
    `- calibration_prompt_family: \`${result.calibration?.prompt_family ?? 'unknown'}\``,
    `- calibration_recorded_run_id: \`${String(result.calibration?.recorded_run_id ?? 'none')}\``,
    `- calibration_metric_gate_failures: \`${result.calibration?.metric_gate_failures.length ?? 0}\``,
    ...(pass.selectedMetric
      ? [
          `- selected_metric: \`${pass.selectedMetric.tool}.${pass.selectedMetric.metric_name}\``,
          `- selected_metric_observed: \`${pass.selectedMetric.observed_value}\``,
          `- selected_metric_threshold: \`${pass.selectedMetric.threshold}\``,
          `- selected_metric_normalized_shortfall: \`${pass.selectedMetric.normalized_shortfall}\``,
        ]
      : []),
    ...(pass.deltaFromPriorTurn !== null
      ? [`- delta_from_prior_turn: \`${pass.deltaFromPriorTurn}\``]
      : []),
  ];
}

function buildPassSection(pass: PassRecord, arm: Arm): string[] {
  const labelByStage: Record<PassStage, string> = {
    initial: 'Initial Pass',
    revision_1: 'Revision Pass 1',
    revision_2: 'Revision Pass 2',
  };

  const sections: string[] = [
    `#### ${labelByStage[pass.stage]}`,
    '',
    `- stage: \`${pass.stage}\``,
    `- raw_stream_path: \`${pass.rawStreamPath}\``,
    `- actual_ct_tools_fired: \`${pass.toolCalls.map(call => call.name).join(', ') || 'none'}\``,
    ...(pass.reviewContextUsed
      ? [
          `- review_context_iteration: \`${pass.reviewContextUsed.iteration_number}\``,
          `- review_context_prior_failures: \`${pass.reviewContextUsed.prior_failures.length}\``,
        ]
      : []),
    ...calibrationSummary(pass, arm),
    '',
    '**Agent Prompt**',
    '',
    fenced(pass.promptText, 'text'),
    '',
    '**Final User-Facing Response**',
    '',
    fenced(pass.finalResponseText, 'text'),
    '',
    '**Claude Invocation Args**',
    '',
    fenced(JSON.stringify(pass.args, null, 2), 'json'),
    '',
    '**Result Event**',
    '',
    fenced(JSON.stringify(pass.resultEvent, null, 2), 'json'),
    '',
    '**CT Call Records**',
    '',
  ];

  if (pass.toolCalls.length === 0) {
    sections.push('No CT tool calls were made in this pass.');
  } else {
    pass.toolCalls.forEach((toolCall, index) => {
      sections.push(`##### Tool Call ${index + 1}: ${toolCall.name}`);
      sections.push('');
      sections.push('**Tool Input**');
      sections.push('');
      sections.push(fenced(JSON.stringify(toolCall.input, null, 2), 'json'));
      sections.push('');
      sections.push('**Tool Output**');
      sections.push('');
      sections.push(fenced(toolCall.rawOutputText, 'json'));
      sections.push('');
      sections.push('**CT Metrics Snapshot**');
      sections.push('');
      sections.push(...toolMetricsSummary(toolCall));
      sections.push('');
    });
  }

  if (pass.calibrationEnvelope) {
    sections.push('**Calibration Envelope (Built Only From Real CT Inputs)**');
    sections.push('');
    sections.push(fenced(JSON.stringify(pass.calibrationEnvelope, null, 2), 'json'));
    sections.push('');
  }

  if (pass.calibrationResult) {
    sections.push('**Orchestrator Calibration Result**');
    sections.push('');
    sections.push(fenced(JSON.stringify(pass.calibrationResult, null, 2), 'json'));
    sections.push('');
  }

  sections.push('**Raw Stream JSONL**');
  sections.push('');
  sections.push(fenced(pass.rawStream, 'json'));
  sections.push('');

  return sections;
}

function buildRunSection(run: RunRecord): string[] {
  const sections: string[] = [
    `### ${run.promptId} / ${run.arm} / ${run.sessionMode}`,
    '',
    `- round: \`${run.round}\``,
    `- workdir: \`${run.workdir}\``,
    `- final_policy_decision: \`${run.finalPolicyDecision}\``,
    `- final_outcome: \`${run.finalOutcome}\``,
    `- total_passes: \`${run.passes.length}\``,
    ...(run.turn3Decision
      ? [
          `- turn3_considered: \`${run.turn3Decision.considered ? 'yes' : 'no'}\``,
          `- turn3_allowed: \`${run.turn3Decision.allowed ? 'yes' : 'no'}\``,
          `- turn3_reason: ${run.turn3Decision.reason}`,
          ...(run.turn3Decision.delta_from_turn1_to_turn2 !== null
            ? [
                `- turn3_delta_turn1_to_turn2: \`${run.turn3Decision.delta_from_turn1_to_turn2}\``,
                `- turn3_remaining_gap_after_turn2: \`${run.turn3Decision.remaining_gap_after_turn2}\``,
              ]
            : []),
          ...(run.turn3Decision.historical_stats
            ? [
                `- turn3_history_sample_count: \`${run.turn3Decision.historical_stats.sample_count}\``,
                `- turn3_history_success_rate: \`${run.turn3Decision.historical_stats.success_rate}\``,
              ]
            : []),
        ]
      : []),
    ...(run.humanReviewReason
      ? [`- human_review_reason: ${run.humanReviewReason}`]
      : []),
    '',
    '**Released User-Facing Response**',
    '',
    run.finalAcceptedResponseText
      ? fenced(run.finalAcceptedResponseText, 'text')
      : 'No response was released. The run escalated to `HUMAN_REVIEW`.',
    '',
  ];

  if (run.revisionRequests.length > 0) {
    run.revisionRequests.forEach((revisionRequest, index) => {
      sections.push(`**Deterministic Revision Request ${index + 1}**`);
      sections.push('');
      sections.push(fenced(JSON.stringify(revisionRequest, null, 2), 'json'));
      sections.push('');
    });
  }

  run.passes.forEach(pass => {
    sections.push(...buildPassSection(pass, run.arm));
  });

  return sections;
}

function pairSummary(a: RunRecord, b: RunRecord): string[] {
  const initialB = b.passes[0];
  const turn2 = b.passes.find(pass => pass.stage === 'revision_1');
  const turn3 = b.passes.find(pass => pass.stage === 'revision_2');

  return [
    `#### ${a.promptId}`,
    '',
    `- Arm A final response length: \`${a.finalAcceptedResponseText?.length ?? 0}\``,
    `- Arm B initial CT calls: \`${initialB.toolCalls.map(call => call.name).join(', ') || 'none'}\``,
    `- Arm B initial calibration decision: \`${initialB.calibrationResult?.policy_decision ?? 'not_run'}\``,
    `- Arm B turn 2 executed: \`${turn2 ? 'yes' : 'no'}\``,
    `- Arm B turn 2 calibration decision: \`${turn2?.calibrationResult?.policy_decision ?? 'not_run'}\``,
    `- Arm B turn 3 considered: \`${b.turn3Decision ? 'yes' : 'no'}\``,
    `- Arm B turn 3 allowed: \`${b.turn3Decision?.allowed ? 'yes' : 'no'}\``,
    ...(b.turn3Decision
      ? [
          `- Arm B turn 3 gate reason: ${b.turn3Decision.reason}`,
          ...(b.turn3Decision.delta_from_turn1_to_turn2 !== null
            ? [
                `- Arm B delta turn1->turn2: \`${b.turn3Decision.delta_from_turn1_to_turn2}\``,
                `- Arm B remaining gap after turn 2: \`${b.turn3Decision.remaining_gap_after_turn2}\``,
              ]
            : []),
        ]
      : []),
    `- Arm B turn 3 executed: \`${turn3 ? 'yes' : 'no'}\``,
    `- Arm B final enforced outcome: \`${b.finalOutcome}\``,
    `- Arm B final policy decision: \`${b.finalPolicyDecision}\``,
    ...(b.humanReviewReason
      ? [`- Arm B human review reason: ${b.humanReviewReason}`]
      : []),
    '',
    '**A Released Response**',
    '',
    fenced(a.finalAcceptedResponseText ?? '', 'text'),
    '',
    '**B Released Response**',
    '',
    b.finalAcceptedResponseText
      ? fenced(b.finalAcceptedResponseText, 'text')
      : 'No response released. Escalated to `HUMAN_REVIEW`.',
    '',
  ];
}

function main(): void {
  ensureDir(outDir);
  ensureDir(dirname(reportPath));

  const separateRuns: RunRecord[] = [];
  for (const promptId of promptIds) {
    separateRuns.push(
      runOne(
        'separate_sessions',
        'A',
        promptId,
        resolve(outDir, 'workdirs', 'separate', promptId, 'A'),
        'fresh',
      ),
    );
    separateRuns.push(
      runOne(
        'separate_sessions',
        'B',
        promptId,
        resolve(outDir, 'workdirs', 'separate', promptId, 'B'),
        'fresh',
      ),
    );
  }

  const multiTurnRuns: RunRecord[] = [];
  const multiTurnAWorkdir = resolve(outDir, 'workdirs', 'multi_turn', 'A');
  const multiTurnBWorkdir = resolve(outDir, 'workdirs', 'multi_turn', 'B');
  for (let i = 0; i < promptIds.length; i++) {
    const promptId = promptIds[i];
    multiTurnRuns.push(
      runOne(
        'multi_turn',
        'A',
        promptId,
        multiTurnAWorkdir,
        i === 0 ? 'fresh' : 'continued',
      ),
    );
    multiTurnRuns.push(
      runOne(
        'multi_turn',
        'B',
        promptId,
        multiTurnBWorkdir,
        i === 0 ? 'fresh' : 'continued',
      ),
    );
  }

  const allRuns = [...separateRuns, ...multiTurnRuns];
  const bRuns = allRuns.filter(run => run.arm === 'B');
  const initialReviseCount = bRuns.filter(
    run => run.passes[0].calibrationResult?.policy_decision === 'REVISE',
  ).length;
  const turn2ExecutedCount = bRuns.filter(
    run => run.passes.some(pass => pass.stage === 'revision_1'),
  ).length;
  const turn2HumanReviewCount = bRuns.filter(
    run => run.passes.find(pass => pass.stage === 'revision_1')?.calibrationResult
      ?.policy_decision === 'HUMAN_REVIEW',
  ).length;
  const turn3ConsideredCount = bRuns.filter(
    run => run.turn3Decision?.considered,
  ).length;
  const turn3AllowedCount = bRuns.filter(
    run => run.turn3Decision?.allowed,
  ).length;
  const turn3ExecutedCount = bRuns.filter(
    run => run.passes.some(pass => pass.stage === 'revision_2'),
  ).length;
  const releasedAfterTurn2Count = bRuns.filter(
    run =>
      run.finalOutcome === 'accepted' &&
      run.passes.length === 2 &&
      run.passes[1]?.stage === 'revision_1',
  ).length;
  const releasedAfterTurn3Count = bRuns.filter(
    run =>
      run.finalOutcome === 'accepted' &&
      run.passes.length === 3 &&
      run.passes[2]?.stage === 'revision_2',
  ).length;
  const humanReviewCount = bRuns.filter(
    run => run.finalOutcome === 'human_review',
  ).length;
  const finalPassCount = bRuns.filter(
    run => run.finalPolicyDecision === 'PASS',
  ).length;
  const finalWarnCount = bRuns.filter(
    run => run.finalPolicyDecision === 'WARN',
  ).length;

  const separatePairs = promptIds.map(promptId => ({
    a: separateRuns.find(run => run.promptId === promptId && run.arm === 'A')!,
    b: separateRuns.find(run => run.promptId === promptId && run.arm === 'B')!,
  }));
  const multiPairs = promptIds.map(promptId => ({
    a: multiTurnRuns.find(run => run.promptId === promptId && run.arm === 'A')!,
    b: multiTurnRuns.find(run => run.promptId === promptId && run.arm === 'B')!,
  }));

  const reportLines: string[] = [
    '# Clean Live A/B CT Test With Delta-Gated Turn 3',
    '',
    '- Date: 2026-04-09',
    '- Model: Claude Sonnet (`--model sonnet --effort low`)',
    '- Capture mode: `claude -p --verbose --output-format stream-json`',
    '- Arm A: CT disallowed',
    '- Arm B: CT explicitly required when available',
    '- Enforcement rule: if the first B-side calibrated result is `REVISE`, feed the deterministic `revision_request.prompt` back to Claude once.',
    '- Turn-3 rule: only allow a second rewrite if turn 2 lands `HUMAN_REVIEW`, the same selected metric improved from turn 1 to turn 2 by at least the configured epsilon, the remaining normalized gap is within the near-miss threshold, and the model/family historical turn-3 success rate does not veto the attempt.',
    `- Turn-3 epsilon: \`${TURN3_EPSILON}\``,
    `- Turn-3 near-miss gap: \`${TURN3_NEAR_MISS_GAP}\``,
    `- Turn-3 history floor: \`${TURN3_MIN_SUCCESS_RATE}\` after \`${TURN3_MIN_HISTORY}\` prior turn-3 samples`,
    `- Calibration DB: \`${calibrationDbPath}\``,
    '- This report contains only real prompts, real model outputs, real CT tool inputs, real CT tool outputs, orchestrator-produced revision requests, and the final enforced release decision.',
    '',
    '## Headline Results',
    '',
    `- B runs total: \`${bRuns.length}\``,
    `- Initial B runs flagged for REVISE: \`${initialReviseCount}\``,
    `- Turn 2 executions: \`${turn2ExecutedCount}\``,
    `- Turn 2 HUMAN_REVIEW outcomes: \`${turn2HumanReviewCount}\``,
    `- Turn 3 considered: \`${turn3ConsideredCount}\``,
    `- Turn 3 allowed: \`${turn3AllowedCount}\``,
    `- Turn 3 actually executed: \`${turn3ExecutedCount}\``,
    `- Accepted after turn 2: \`${releasedAfterTurn2Count}\``,
    `- Accepted after turn 3: \`${releasedAfterTurn3Count}\``,
    `- Final HUMAN_REVIEW outcomes: \`${humanReviewCount}\``,
    `- Final accepted B decisions: PASS=\`${finalPassCount}\`, WARN=\`${finalWarnCount}\``,
    '',
    '## Round Summaries',
    '',
    '### Separate Sessions',
    '',
  ];

  for (const pair of separatePairs) {
    reportLines.push(...pairSummary(pair.a, pair.b));
  }

  reportLines.push('### Multi-Turn', '');
  for (const pair of multiPairs) {
    reportLines.push(...pairSummary(pair.a, pair.b));
  }

  reportLines.push('## Full Run Records', '');
  for (const run of allRuns) {
    reportLines.push(...buildRunSection(run));
  }

  writeFileSync(reportPath, `${reportLines.join('\n')}\n`, 'utf-8');
  console.log(reportPath);
}

main();
