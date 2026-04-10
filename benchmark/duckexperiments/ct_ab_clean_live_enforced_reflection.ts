import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runOrchestrator } from '../../src/orchestrator/index.js';
import type {
  ContractKey,
  OrchestratorEnvelope,
  OrchestratorResult,
  ReviewContext,
  RevisionRequest,
} from '../../src/orchestrator/index.js';
import { PROMPTS } from './manifest.js';

type PromptId = 'Q01' | 'Q04' | 'Q09';
type RoundKind = 'separate_sessions' | 'multi_turn';
type Arm = 'A' | 'B';
type SessionMode = 'fresh' | 'continued';
type PassStage = 'initial' | 'revision';
type FinalOutcome = 'accepted' | 'human_review';

interface ReflectionPayload {
  changed: boolean | null;
  why: string | null;
  what_changed: string | null;
  ct_effect_summary: string | null;
}

interface ToolCallRecord {
  id: string;
  name: string;
  input: unknown;
  rawOutputText: string;
  output: unknown;
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
}

interface ReflectionRecord {
  promptText: string;
  args: string[];
  rawStreamPath: string;
  rawStream: string;
  finalResponseText: string;
  toolCalls: ToolCallRecord[];
  resultEvent: unknown;
  parsed: ReflectionPayload | null;
}

interface RunRecord {
  round: RoundKind;
  arm: Arm;
  promptId: PromptId;
  sessionMode: SessionMode;
  workdir: string;
  initialPass: PassRecord;
  revisionRequest: RevisionRequest | null;
  revisionPass: PassRecord | null;
  finalPolicyDecision: string;
  finalOutcome: FinalOutcome;
  finalAcceptedResponseText: string | null;
  humanReviewReason: string | null;
  reflection: ReflectionRecord | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

const reportPath = resolve(
  repoRoot,
  'docs/reports/ct_ab_clean_live_enforced_reflection_fixed_2026-04-09.md',
);
const outDir = resolve(
  repoRoot,
  'benchmark/duckexperiments/.ct_ab_clean_live_enforced_reflection_fixed_2026-04-09',
);
const calibrationDbPath = resolve(outDir, 'ct_calibration.sqlite');

const promptIds: PromptId[] = ['Q01', 'Q04', 'Q09'];

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
): string {
  const { primary, secondary } = designatedTools(promptId);
  return [
    'You are participating in a controlled A/B experiment.',
    '',
    'This is the single allowed revision turn after deterministic CT review.',
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
    '- This is the final allowed model revision for this prompt.',
    '- If the original claim cannot be supported safely, narrow or withdraw it instead of inventing detail.',
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

function buildReflectionPrompt(input: {
  finalOutcome: FinalOutcome;
  lastAnswerText: string | null;
  ctToolNames: string[];
  revisionTriggered: boolean;
}): string {
  return [
    'You are still inside the same A/B experiment session.',
    '',
    'Reflect on the immediately preceding answer-turn in this same session, not on this reflection turn.',
    input.finalOutcome === 'human_review'
      ? '- The answer was not released because the run escalated to HUMAN_REVIEW.'
      : '- The answer was the final released answer for this run.',
    input.revisionTriggered
      ? '- That answer came after one deterministic revision turn.'
      : '- That answer came directly from the initial CT-reviewed turn.',
    '- The reflection turn itself uses no tools. Ignore that fact and focus on the preceding answer-turn.',
    `- CT tools actually called before that answer: ${input.ctToolNames.join(', ') || 'none'}.`,
    '- Previous answer text is included below so you know which answer you are judging.',
    '- Do not use any tools.',
    '- Do not revise the answer again.',
    '- Answer in JSON only.',
    '- Use exactly these keys:',
    '  "changed": boolean',
    '  "why": string',
    '  "what_changed": string',
    '  "ct_effect_summary": string',
    '- Set "changed" to true only if CT-MCP feedback materially changed the answer compared with what you were prepared to say before CT-MCP calls in this run.',
    '- If changed is false, explain why the answer did not materially change.',
    '- Keep each string concise and specific to this run only.',
    '',
    'Previous answer text:',
    input.lastAnswerText ?? '(no answer text available)',
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

function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fencedMatch) {
    candidates.push(fencedMatch[1].trim());
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore and try next candidate
    }
  }

  return null;
}

function parseReflectionPayload(text: string): ReflectionPayload | null {
  const parsed = parseJsonObject(text);
  if (!parsed) return null;

  const changedValue = parsed.changed;
  const changed = typeof changedValue === 'boolean' ? changedValue : null;
  const toStringOrNull = (value: unknown): string | null =>
    typeof value === 'string' ? value : null;

  return {
    changed,
    why: toStringOrNull(parsed.why),
    what_changed: toStringOrNull(parsed.what_changed),
    ct_effect_summary: toStringOrNull(parsed.ct_effect_summary),
  };
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

function calibrateRun(
  round: RoundKind,
  promptId: PromptId,
  finalResponseText: string,
  toolCalls: ToolCallRecord[],
  reviewContext: ReviewContext,
): { envelope: OrchestratorEnvelope | null; result: OrchestratorResult | null } {
  const envelope = buildCalibrationEnvelope({
    finalResponseText,
    toolCalls,
    reviewContext,
  });

  if (!envelope) {
    return { envelope: null, result: null };
  }

  const result = runOrchestrator(envelope, {
    calibration: {
      model: 'claude-sonnet-4-6',
      prompt_family: promptFamily(promptId),
      session_mode: round === 'multi_turn' ? 'multi_turn' : 'single_turn',
      db_path: calibrationDbPath,
    },
  });

  return { envelope, result };
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

  const toolCalls = parseToolCalls(events);
  const finalResponseText = extractFinalResponse(events);
  const calibration =
    input.arm === 'B' && input.reviewContext
      ? calibrateRun(
          input.round,
          input.promptId,
          finalResponseText,
          toolCalls,
          input.reviewContext,
        )
      : { envelope: null, result: null };

  return {
    stage: input.stage,
    promptText: input.promptText,
    args,
    rawStreamPath,
    rawStream,
    finalResponseText,
    toolCalls,
    resultEvent: extractResultEvent(events),
    calibrationEnvelope: calibration.envelope,
    calibrationResult: calibration.result,
    reviewContextUsed: input.reviewContext,
  };
}

function runReflectionPass(input: {
  round: RoundKind;
  promptId: PromptId;
  workdir: string;
  finalOutcome: FinalOutcome;
  lastAnswerText: string | null;
  ctToolNames: string[];
  revisionTriggered: boolean;
}): ReflectionRecord {
  ensureDir(input.workdir);
  const promptText = buildReflectionPrompt({
    finalOutcome: input.finalOutcome,
    lastAnswerText: input.lastAnswerText,
    ctToolNames: input.ctToolNames,
    revisionTriggered: input.revisionTriggered,
  });
  const args = buildArgs(promptText, 'continued');
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
      `Claude reflection invocation failed for ${input.round}/${input.promptId} with status ${result.status}\nSTDERR:\n${result.stderr ?? ''}\nSTDOUT:\n${result.stdout ?? ''}`,
    );
  }

  const rawStream = result.stdout ?? '';
  const events = parseJsonLines(rawStream);
  const rawStreamPath = resolve(
    outDir,
    input.round,
    'B',
    `${input.promptId}.reflection.stream.jsonl`,
  );
  ensureDir(dirname(rawStreamPath));
  writeFileSync(rawStreamPath, rawStream, 'utf-8');

  const finalResponseText = extractFinalResponse(events);

  return {
    promptText,
    args,
    rawStreamPath,
    rawStream,
    finalResponseText,
    toolCalls: parseToolCalls(events),
    resultEvent: extractResultEvent(events),
    parsed: parseReflectionPayload(finalResponseText),
  };
}

function runOne(
  round: RoundKind,
  arm: Arm,
  promptId: PromptId,
  workdir: string,
  sessionMode: SessionMode,
): RunRecord {
  const initialReviewContext: ReviewContext = {
    iteration_number: 1,
    prior_failures: [],
  };
  const initialPass = runClaudePass({
    round,
    arm,
    promptId,
    stage: 'initial',
    workdir,
    sessionMode,
    promptText: buildInitialArmPrompt(promptId, arm),
    reviewContext: arm === 'B' ? initialReviewContext : null,
  });

  if (arm === 'A') {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      initialPass,
      revisionRequest: null,
      revisionPass: null,
      finalPolicyDecision: 'not_evaluated',
      finalOutcome: 'accepted',
      finalAcceptedResponseText: initialPass.finalResponseText,
      humanReviewReason: null,
      reflection: null,
    };
  }

  const initialCalibration = initialPass.calibrationResult;
  if (!initialCalibration) {
    const reflection = runReflectionPass({
      round,
      promptId,
      workdir,
      finalOutcome: 'human_review',
      lastAnswerText: initialPass.finalResponseText,
      ctToolNames: initialPass.toolCalls.map(call => call.name),
      revisionTriggered: false,
    });
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      initialPass,
      revisionRequest: null,
      revisionPass: null,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason:
        'Initial CT-enabled pass produced no usable CT tool calls, so no calibration envelope could be built.',
      reflection,
    };
  }

  const revisionRequest =
    initialCalibration.policy_decision === 'REVISE'
      ? initialCalibration.revision_request ?? null
      : null;

  if (!revisionRequest) {
    const reflection = runReflectionPass({
      round,
      promptId,
      workdir,
      finalOutcome: 'accepted',
      lastAnswerText: initialPass.finalResponseText,
      ctToolNames: initialPass.toolCalls.map(call => call.name),
      revisionTriggered: false,
    });
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      initialPass,
      revisionRequest: null,
      revisionPass: null,
      finalPolicyDecision: initialCalibration.policy_decision,
      finalOutcome: 'accepted',
      finalAcceptedResponseText: initialPass.finalResponseText,
      humanReviewReason: null,
      reflection,
    };
  }

  const revisionPass = runClaudePass({
    round,
    arm,
    promptId,
    stage: 'revision',
    workdir,
    sessionMode: 'continued',
    promptText: buildRevisionPrompt(promptId, revisionRequest),
    reviewContext: revisionRequest.next_review_context,
  });

  const revisionCalibration = revisionPass.calibrationResult;
  if (!revisionCalibration) {
    const reflection = runReflectionPass({
      round,
      promptId,
      workdir,
      finalOutcome: 'human_review',
      lastAnswerText: revisionPass.finalResponseText,
      ctToolNames: revisionPass.toolCalls.map(call => call.name),
      revisionTriggered: true,
    });
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      initialPass,
      revisionRequest,
      revisionPass,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason:
        'Revision pass produced no usable CT tool calls, so the bounded rewrite could not be verified.',
      reflection,
    };
  }

  if (revisionCalibration.policy_decision === 'HUMAN_REVIEW') {
    const reflection = runReflectionPass({
      round,
      promptId,
      workdir,
      finalOutcome: 'human_review',
      lastAnswerText: revisionPass.finalResponseText,
      ctToolNames: revisionPass.toolCalls.map(call => call.name),
      revisionTriggered: true,
    });
    return {
      round,
      arm,
      promptId,
      sessionMode,
      workdir,
      initialPass,
      revisionRequest,
      revisionPass,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      humanReviewReason:
        'The single allowed revision still failed the calibrated CT gate at iteration 2.',
      reflection,
    };
  }

  const reflection = runReflectionPass({
    round,
    promptId,
    workdir,
    finalOutcome: 'accepted',
    lastAnswerText: revisionPass.finalResponseText,
    ctToolNames: revisionPass.toolCalls.map(call => call.name),
    revisionTriggered: true,
  });
  return {
    round,
    arm,
    promptId,
    sessionMode,
    workdir,
    initialPass,
    revisionRequest,
    revisionPass,
    finalPolicyDecision: revisionCalibration.policy_decision,
    finalOutcome: 'accepted',
    finalAcceptedResponseText: revisionPass.finalResponseText,
    humanReviewReason: null,
    reflection,
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
  ];
}

function buildPassSection(pass: PassRecord, arm: Arm): string[] {
  const sections: string[] = [
    `#### ${pass.stage === 'initial' ? 'Initial Pass' : 'Revision Pass'}`,
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

function buildReflectionSection(reflection: ReflectionRecord | null): string[] {
  if (!reflection) {
    return [];
  }

  return [
    '#### Reflection Step',
    '',
    `- raw_stream_path: \`${reflection.rawStreamPath}\``,
    `- reflection_tool_calls: \`${reflection.toolCalls.map(call => call.name).join(', ') || 'none'}\``,
    `- parsed_changed: \`${String(reflection.parsed?.changed ?? 'unknown')}\``,
    `- parsed_why_present: \`${reflection.parsed?.why ? 'yes' : 'no'}\``,
    '',
    '**Reflection Prompt**',
    '',
    fenced(reflection.promptText, 'text'),
    '',
    '**Reflection Response**',
    '',
    fenced(reflection.finalResponseText, 'json'),
    '',
    '**Parsed Reflection Payload**',
    '',
    fenced(JSON.stringify(reflection.parsed, null, 2), 'json'),
    '',
    '**Reflection Result Event**',
    '',
    fenced(JSON.stringify(reflection.resultEvent, null, 2), 'json'),
    '',
    '**Reflection Raw Stream JSONL**',
    '',
    fenced(reflection.rawStream, 'json'),
    '',
  ];
}

function buildRunSection(run: RunRecord): string[] {
  const sections: string[] = [
    `### ${run.promptId} / ${run.arm} / ${run.sessionMode}`,
    '',
    `- round: \`${run.round}\``,
    `- workdir: \`${run.workdir}\``,
    `- final_policy_decision: \`${run.finalPolicyDecision}\``,
    `- final_outcome: \`${run.finalOutcome}\``,
    `- revision_triggered: \`${run.revisionPass ? 'yes' : 'no'}\``,
    ...(run.reflection
      ? [`- reflection_changed: \`${String(run.reflection.parsed?.changed ?? 'unknown')}\``]
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

  if (run.revisionRequest) {
    sections.push('**Deterministic Revision Request**');
    sections.push('');
    sections.push(fenced(JSON.stringify(run.revisionRequest, null, 2), 'json'));
    sections.push('');
  }

  sections.push(...buildPassSection(run.initialPass, run.arm));

  if (run.revisionPass) {
    sections.push(...buildPassSection(run.revisionPass, run.arm));
  }

  sections.push(...buildReflectionSection(run.reflection));

  return sections;
}

function pairSummary(a: RunRecord, b: RunRecord): string[] {
  return [
    `#### ${a.promptId}`,
    '',
    `- Arm A final response length: \`${a.finalAcceptedResponseText?.length ?? 0}\``,
    `- Arm B initial CT calls: \`${b.initialPass.toolCalls.map(call => call.name).join(', ') || 'none'}\``,
    `- Arm B initial calibration decision: \`${b.initialPass.calibrationResult?.policy_decision ?? 'not_run'}\``,
    `- Arm B revision triggered: \`${b.revisionPass ? 'yes' : 'no'}\``,
    `- Arm B revision calibration decision: \`${b.revisionPass?.calibrationResult?.policy_decision ?? 'not_run'}\``,
    `- Arm B final enforced outcome: \`${b.finalOutcome}\``,
    `- Arm B final policy decision: \`${b.finalPolicyDecision}\``,
    `- Arm B reflection changed: \`${String(b.reflection?.parsed?.changed ?? 'unknown')}\``,
    ...(b.reflection?.parsed?.why
      ? [`- Arm B reflection why: ${b.reflection.parsed.why}`]
      : []),
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
    run => run.initialPass.calibrationResult?.policy_decision === 'REVISE',
  ).length;
  const revisionTriggeredCount = bRuns.filter(run => run.revisionPass !== null).length;
  const revisionResolvedCount = bRuns.filter(
    run => run.revisionPass !== null && run.finalOutcome === 'accepted',
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
  const reflectionChangedCount = bRuns.filter(
    run => run.reflection?.parsed?.changed === true,
  ).length;
  const reflectionUnchangedCount = bRuns.filter(
    run => run.reflection?.parsed?.changed === false,
  ).length;
  const reflectionUnknownCount = bRuns.filter(
    run => run.reflection?.parsed?.changed == null,
  ).length;

  const report: string[] = [
    '# Clean Live A/B CT Test With Enforced Single Revision And B-Side Reflection',
    '',
    '- Date: 2026-04-09',
    '- Model: Claude Sonnet (`--model sonnet --effort low`)',
    '- Capture mode: `claude -p --verbose --output-format stream-json`',
    '- Arm A: CT disallowed',
    '- Arm B: CT explicitly required when available',
    '- Enforcement rule: if the first B-side calibrated result is `REVISE`, feed the deterministic `revision_request.prompt` back to Claude exactly once, then rerun CT on the revised answer using the revision request review context.',
    '- Final B-side rule: if the second pass still fails at iteration 2, escalate to `HUMAN_REVIEW` and do not release the answer.',
    '- Extra B-side step: after the final accepted answer or final failed attempt, ask the model in the same session whether CT-MCP materially changed the answer and why. The reflection is recorded raw and parsed as structured JSON.',
    '- Multi-turn note: for Arm B, the reflection turn becomes part of the session history before the next prompt in the multi-turn round.',
    '- Calibration DB: `benchmark/duckexperiments/.ct_ab_clean_live_enforced_reflection_fixed_2026-04-09/ct_calibration.sqlite`',
    '- This report contains only real prompts, real model outputs, real CT tool inputs, real CT tool outputs, the orchestrator-produced revision request, the B-side reflection prompt and response, and the final enforced release decision.',
    '',
    '## Headline Results',
    '',
    `- B runs total: \`${bRuns.length}\``,
    `- Initial B runs flagged for REVISE: \`${initialReviseCount}\``,
    `- B revision turns actually executed: \`${revisionTriggeredCount}\``,
    `- B revisions resolved to PASS/WARN and were released: \`${revisionResolvedCount}\``,
    `- B runs escalated to HUMAN_REVIEW: \`${humanReviewCount}\``,
    `- Final accepted B decisions: PASS=\`${finalPassCount}\`, WARN=\`${finalWarnCount}\``,
    `- B reflections reporting material change: \`${reflectionChangedCount}\``,
    `- B reflections reporting no material change: \`${reflectionUnchangedCount}\``,
    `- B reflections that did not parse cleanly: \`${reflectionUnknownCount}\``,
    '',
    '## Round Summaries',
    '',
    '### Separate Sessions',
    '',
  ];

  for (const promptId of promptIds) {
    const a = separateRuns.find(
      run => run.promptId === promptId && run.arm === 'A',
    )!;
    const b = separateRuns.find(
      run => run.promptId === promptId && run.arm === 'B',
    )!;
    report.push(...pairSummary(a, b));
  }

  report.push('### Multi-Turn');
  report.push('');
  for (const promptId of promptIds) {
    const a = multiTurnRuns.find(
      run => run.promptId === promptId && run.arm === 'A',
    )!;
    const b = multiTurnRuns.find(
      run => run.promptId === promptId && run.arm === 'B',
    )!;
    report.push(...pairSummary(a, b));
  }

  report.push('## Full Run Records');
  report.push('');
  for (const run of allRuns) {
    report.push(...buildRunSection(run));
    report.push('---');
    report.push('');
  }

  writeFileSync(reportPath, `${report.join('\n')}\n`, 'utf-8');
  process.stdout.write(`${reportPath}\n`);
}

main();
