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
type PassStage = 'pre_draft' | 'initial' | 'revision';
type FinalOutcome = 'accepted' | 'human_review';
type SessionControl = 'new_ephemeral' | 'new_persisted' | 'continue';

interface ToolCallRecord {
  id: string;
  name: string;
  input: unknown;
  rawOutputText: string;
  output: unknown;
}

interface CalibrationLock {
  promptFamily: string;
  profileId: string;
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

interface RunRecord {
  round: RoundKind;
  arm: Arm;
  promptId: PromptId;
  sessionMode: SessionMode;
  sessionDepth: number;
  workdir: string;
  preDraftPass: PassRecord | null;
  initialPass: PassRecord;
  revisionRequest: RevisionRequest | null;
  revisionPass: PassRecord | null;
  finalPolicyDecision: string;
  finalOutcome: FinalOutcome;
  finalAcceptedResponseText: string | null;
  lastAttemptedResponseText: string | null;
  humanReviewReason: string | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

const reportPath = resolve(
  repoRoot,
  'docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-09.md',
);
const outDir = resolve(
  repoRoot,
  'benchmark/duckexperiments/.ct_ab_clean_live_enforced_prompt_classifier_2026-04-09',
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

function buildPreDraftPrompt(promptId: PromptId): string {
  const canonical = PROMPTS[promptId].text;
  return [
    'You are participating in a controlled A/B experiment.',
    '',
    'This pass captures the draft you are prepared to say before any CT review.',
    '',
    'Rules:',
    '- Do not use CT-MCP tools.',
    '- Do not use any other tools.',
    '- Do not ask follow-up questions.',
    '- Keep the answer under 120 words.',
    '- Return only the user-facing draft answer.',
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

function buildArgs(promptText: string, sessionControl: SessionControl): string[] {
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

  if (sessionControl === 'continue') {
    args.push('--continue');
  } else if (sessionControl === 'new_ephemeral') {
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

function calibrateRun(
  round: RoundKind,
  promptId: PromptId,
  sessionDepth: number,
  finalResponseText: string,
  toolCalls: ToolCallRecord[],
  reviewContext: ReviewContext,
  lockedCalibration: CalibrationLock | null,
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
      prompt_text: PROMPTS[promptId].text,
      ...(lockedCalibration
        ? {
            locked_prompt_family: lockedCalibration.promptFamily,
            locked_profile_id: lockedCalibration.profileId,
          }
        : {}),
      session_mode: round === 'multi_turn' ? 'multi_turn' : 'single_turn',
      session_depth: sessionDepth,
      db_path: calibrationDbPath,
    },
  });

  return { envelope, result };
}

function runClaudePass(input: {
  round: RoundKind;
  arm: Arm;
  promptId: PromptId;
  sessionDepth: number;
  stage: PassStage;
  workdir: string;
  sessionMode: SessionMode;
  sessionControl: SessionControl;
  promptText: string;
  reviewContext: ReviewContext | null;
  lockedCalibration?: CalibrationLock | null;
}): PassRecord {
  ensureDir(input.workdir);
  const args = buildArgs(input.promptText, input.sessionControl);
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
          input.sessionDepth,
          finalResponseText,
          toolCalls,
          input.reviewContext,
          input.lockedCalibration ?? null,
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

function runOne(
  round: RoundKind,
  arm: Arm,
  promptId: PromptId,
  workdir: string,
  sessionMode: SessionMode,
  sessionDepth: number,
): RunRecord {
  const initialReviewContext: ReviewContext = {
    iteration_number: 1,
    prior_failures: [],
  };
  const initialSessionControl: SessionControl =
    sessionMode === 'continued'
      ? 'continue'
      : round === 'multi_turn'
        ? 'new_persisted'
        : 'new_ephemeral';
  const persistentSessionStartControl: SessionControl =
    sessionMode === 'continued' ? 'continue' : 'new_persisted';

  const preDraftPass =
    arm === 'B'
      ? runClaudePass({
          round,
          arm,
          promptId,
          sessionDepth,
          stage: 'pre_draft',
          workdir,
          sessionMode,
          sessionControl: persistentSessionStartControl,
          promptText: buildPreDraftPrompt(promptId),
          reviewContext: null,
        })
      : null;

  const initialPass = runClaudePass({
    round,
    arm,
    promptId,
    sessionDepth,
    stage: 'initial',
    workdir,
    sessionMode,
    sessionControl: arm === 'B' ? 'continue' : initialSessionControl,
    promptText: buildInitialArmPrompt(promptId, arm),
    reviewContext: arm === 'B' ? initialReviewContext : null,
    lockedCalibration: null,
  });

  if (arm === 'A') {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      sessionDepth,
      workdir,
      preDraftPass: null,
      initialPass,
      revisionRequest: null,
      revisionPass: null,
      finalPolicyDecision: 'not_evaluated',
      finalOutcome: 'accepted',
      finalAcceptedResponseText: initialPass.finalResponseText,
      lastAttemptedResponseText: initialPass.finalResponseText,
      humanReviewReason: null,
    };
  }

  const initialCalibration = initialPass.calibrationResult;
  if (!initialCalibration) {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      sessionDepth,
      workdir,
      preDraftPass,
      initialPass,
      revisionRequest: null,
      revisionPass: null,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      lastAttemptedResponseText: initialPass.finalResponseText,
      humanReviewReason:
        'Initial CT-enabled pass produced no usable CT tool calls, so no calibration envelope could be built.',
    };
  }

  const revisionRequest =
    initialCalibration.policy_decision === 'REVISE'
      ? initialCalibration.revision_request ?? null
      : null;
  const lockedCalibration =
    initialCalibration.calibration?.prompt_family &&
    initialCalibration.calibration?.profile_id
      ? {
          promptFamily: initialCalibration.calibration.prompt_family,
          profileId: initialCalibration.calibration.profile_id,
        }
      : null;

  if (!revisionRequest) {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      sessionDepth,
      workdir,
      preDraftPass,
      initialPass,
      revisionRequest: null,
      revisionPass: null,
      finalPolicyDecision: initialCalibration.policy_decision,
      finalOutcome: 'accepted',
      finalAcceptedResponseText: initialPass.finalResponseText,
      lastAttemptedResponseText: initialPass.finalResponseText,
      humanReviewReason: null,
    };
  }

  const revisionPass = runClaudePass({
    round,
    arm,
    promptId,
    sessionDepth,
    stage: 'revision',
    workdir,
    sessionMode: 'continued',
    sessionControl: 'continue',
    promptText: buildRevisionPrompt(promptId, revisionRequest),
    reviewContext: revisionRequest.next_review_context,
    lockedCalibration,
  });

  const revisionCalibration = revisionPass.calibrationResult;
  if (!revisionCalibration) {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      sessionDepth,
      workdir,
      preDraftPass,
      initialPass,
      revisionRequest,
      revisionPass,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      lastAttemptedResponseText: revisionPass.finalResponseText,
      humanReviewReason:
        'Revision pass produced no usable CT tool calls, so the bounded rewrite could not be verified.',
    };
  }

  if (revisionCalibration.policy_decision === 'HUMAN_REVIEW') {
    return {
      round,
      arm,
      promptId,
      sessionMode,
      sessionDepth,
      workdir,
      preDraftPass,
      initialPass,
      revisionRequest,
      revisionPass,
      finalPolicyDecision: 'HUMAN_REVIEW',
      finalOutcome: 'human_review',
      finalAcceptedResponseText: null,
      lastAttemptedResponseText: revisionPass.finalResponseText,
      humanReviewReason:
        'The single allowed revision still failed the calibrated CT gate at iteration 2.',
    };
  }

  return {
    round,
    arm,
    promptId,
    sessionMode,
    sessionDepth,
    workdir,
    preDraftPass,
    initialPass,
    revisionRequest,
    revisionPass,
    finalPolicyDecision: revisionCalibration.policy_decision,
    finalOutcome: 'accepted',
    finalAcceptedResponseText: revisionPass.finalResponseText,
    lastAttemptedResponseText: revisionPass.finalResponseText,
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
    `- calibration_prompt_family_source: \`${result.calibration?.prompt_family_source ?? 'unknown'}\``,
    `- calibration_session_depth: \`${String(result.calibration?.session_depth ?? 'none')}\``,
    `- calibration_recorded_run_id: \`${String(result.calibration?.recorded_run_id ?? 'none')}\``,
    `- calibration_metric_gate_failures: \`${result.calibration?.metric_gate_failures.length ?? 0}\``,
  ];
}

function buildPassSection(pass: PassRecord, arm: Arm): string[] {
  const stageLabel =
    pass.stage === 'pre_draft'
      ? 'Pre-CT Draft Pass'
      : pass.stage === 'initial'
        ? 'Initial CT Pass'
        : 'Revision Pass';
  const sections: string[] = [
    `#### ${stageLabel}`,
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
  const preDraftChanged =
    run.preDraftPass !== null &&
    run.lastAttemptedResponseText !== null &&
    run.preDraftPass.finalResponseText !== run.lastAttemptedResponseText;
  const sections: string[] = [
    `### ${run.promptId} / ${run.arm} / ${run.sessionMode}`,
    '',
    `- round: \`${run.round}\``,
    `- session_depth: \`${run.sessionDepth}\``,
    `- workdir: \`${run.workdir}\``,
    `- final_policy_decision: \`${run.finalPolicyDecision}\``,
    `- final_outcome: \`${run.finalOutcome}\``,
    `- revision_triggered: \`${run.revisionPass ? 'yes' : 'no'}\``,
    ...(run.preDraftPass
      ? [`- pre_ct_draft_changed_after_ct: \`${preDraftChanged ? 'yes' : 'no'}\``]
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

  if (run.preDraftPass) {
    sections.push('**Pre-CT Draft Artifact**');
    sections.push('');
    sections.push(fenced(run.preDraftPass.finalResponseText, 'text'));
    sections.push('');
  }

  if (run.revisionRequest) {
    sections.push('**Deterministic Revision Request**');
    sections.push('');
    sections.push(fenced(JSON.stringify(run.revisionRequest, null, 2), 'json'));
    sections.push('');
  }

  if (run.preDraftPass) {
    sections.push(...buildPassSection(run.preDraftPass, run.arm));
  }
  sections.push(...buildPassSection(run.initialPass, run.arm));

  if (run.revisionPass) {
    sections.push(...buildPassSection(run.revisionPass, run.arm));
  }

  return sections;
}

function pairSummary(a: RunRecord, b: RunRecord): string[] {
  const preDraftChanged =
    b.preDraftPass !== null &&
    b.lastAttemptedResponseText !== null &&
    b.preDraftPass.finalResponseText !== b.lastAttemptedResponseText;
  return [
    `#### ${a.promptId}`,
    '',
    `- session_depth: \`${b.sessionDepth}\``,
    `- Arm A final response length: \`${a.finalAcceptedResponseText?.length ?? 0}\``,
    `- Arm B pre-CT draft captured: \`${b.preDraftPass ? 'yes' : 'no'}\``,
    `- Arm B pre-CT draft changed after CT: \`${preDraftChanged ? 'yes' : 'no'}\``,
    `- Arm B initial CT calls: \`${b.initialPass.toolCalls.map(call => call.name).join(', ') || 'none'}\``,
    `- Arm B initial calibration decision: \`${b.initialPass.calibrationResult?.policy_decision ?? 'not_run'}\``,
    `- Arm B inferred prompt family: \`${b.initialPass.calibrationResult?.calibration?.prompt_family ?? 'unknown'}\``,
    `- Arm B prompt family source: \`${b.initialPass.calibrationResult?.calibration?.prompt_family_source ?? 'unknown'}\``,
    `- Arm B revision triggered: \`${b.revisionPass ? 'yes' : 'no'}\``,
    `- Arm B revision calibration decision: \`${b.revisionPass?.calibrationResult?.policy_decision ?? 'not_run'}\``,
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
    '**B Pre-CT Draft**',
    '',
    b.preDraftPass
      ? fenced(b.preDraftPass.finalResponseText, 'text')
      : 'No pre-CT draft was captured.',
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
        1,
      ),
    );
    separateRuns.push(
      runOne(
        'separate_sessions',
        'B',
        promptId,
        resolve(outDir, 'workdirs', 'separate', promptId, 'B'),
        'fresh',
        1,
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
        i + 1,
      ),
    );
    multiTurnRuns.push(
      runOne(
        'multi_turn',
        'B',
        promptId,
        multiTurnBWorkdir,
        i === 0 ? 'fresh' : 'continued',
        i + 1,
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
  const preDraftChangedCount = bRuns.filter(
    run =>
      run.preDraftPass !== null &&
      run.lastAttemptedResponseText !== null &&
      run.preDraftPass.finalResponseText !== run.lastAttemptedResponseText,
  ).length;
  const finalPassCount = bRuns.filter(
    run => run.finalPolicyDecision === 'PASS',
  ).length;
  const finalWarnCount = bRuns.filter(
    run => run.finalPolicyDecision === 'WARN',
  ).length;

  const report: string[] = [
    '# Clean Live A/B CT Test With Prompt-Side Family Classification And Locked Revision Routing',
    '',
    '- Date: 2026-04-09',
    '- Model: Claude Sonnet (`--model sonnet --effort low`)',
    '- Capture mode: `claude -p --verbose --output-format stream-json`',
    '- Arm A: CT disallowed',
    '- Arm B: capture a no-tool pre-CT draft in-session, then require CT when answering',
    '- Prompt-side classifier: the B-side family/profile is inferred from the immutable user prompt on turn 1, then reused on revision turns without reclassification.',
    '- Enforcement rule: if the first B-side calibrated result is `REVISE`, feed the deterministic `revision_request.prompt` back to Claude exactly once, then rerun CT on the revised answer using the revision request review context.',
    '- Final B-side rule: if the second pass still fails at iteration 2, escalate to `HUMAN_REVIEW` and do not release the answer.',
    '- Calibration routing is now inferred from the user prompt when `prompt_text` is supplied, with answer-side inference retained only as fallback.',
    '- Calibration DB: `benchmark/duckexperiments/.ct_ab_clean_live_enforced_prompt_classifier_2026-04-09/ct_calibration.sqlite`',
    '- This report contains only real prompts, the pre-CT draft artifact, real CT tool inputs, real CT tool outputs, the orchestrator-produced revision request, and the final enforced release decision.',
    '',
    '## Headline Results',
    '',
    `- B runs total: \`${bRuns.length}\``,
    `- Initial B runs flagged for REVISE: \`${initialReviseCount}\``,
    `- B revision turns actually executed: \`${revisionTriggeredCount}\``,
    `- B revisions resolved to PASS/WARN and were released: \`${revisionResolvedCount}\``,
    `- B runs escalated to HUMAN_REVIEW: \`${humanReviewCount}\``,
    `- B runs where the pre-CT draft changed after CT: \`${preDraftChangedCount}\``,
    `- Final accepted B decisions: PASS=\`${finalPassCount}\`, WARN=\`${finalWarnCount}\``,
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
