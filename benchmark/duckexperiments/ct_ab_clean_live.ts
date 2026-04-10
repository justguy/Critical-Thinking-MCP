import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PROMPTS } from './manifest.js';

type PromptId = 'Q01' | 'Q04' | 'Q09';
type RoundKind = 'separate_sessions' | 'multi_turn';
type Arm = 'A' | 'B';

interface ToolCallRecord {
  id: string;
  name: string;
  input: unknown;
  rawOutputText: string;
  output: unknown;
}

interface RunRecord {
  round: RoundKind;
  arm: Arm;
  promptId: PromptId;
  sessionMode: 'fresh' | 'continued';
  workdir: string;
  args: string[];
  promptText: string;
  rawStreamPath: string;
  rawStream: string;
  finalResponseText: string;
  toolCalls: ToolCallRecord[];
  resultEvent: unknown;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

const reportPath = resolve(
  repoRoot,
  'docs/reports/ct_ab_clean_live_2026-04-09.md',
);
const outDir = resolve(
  repoRoot,
  'benchmark/duckexperiments/.ct_ab_clean_live_2026-04-09',
);

const promptIds: PromptId[] = ['Q01', 'Q04', 'Q09'];

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function fenced(text: string, lang = ''): string {
  return `\`\`\`${lang}\n${text.trimEnd()}\n\`\`\``;
}

function designatedTools(promptId: PromptId): { primary: string; secondary: string } {
  return {
    primary: PROMPTS[promptId].primaryTool,
    secondary: PROMPTS[promptId].secondaryTool,
  };
}

function buildArmPrompt(promptId: PromptId, arm: Arm): string {
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
    '',
    'Return only the user-facing answer. Do not narrate tool usage.',
    '',
    `Prompt ID: ${promptId}`,
    '',
    'Prompt:',
    canonical,
  ].join('\n');
}

function buildArgs(promptText: string, arm: Arm, sessionMode: 'fresh' | 'continued'): string[] {
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
      const content = (message?.content as Array<Record<string, unknown>> | undefined) ?? [];
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
      const content = (message?.content as Array<Record<string, unknown>> | undefined) ?? [];
      for (const item of content) {
        if (item.type !== 'tool_result') continue;
        const toolUseId = String(item.tool_use_id);
        const contentParts = (item.content as Array<Record<string, unknown>> | undefined) ?? [];
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
    const content = (message?.content as Array<Record<string, unknown>> | undefined) ?? [];
    for (const item of content) {
      if (item.type === 'text' && typeof item.text === 'string') {
        assistantTextChunks.push(item.text);
      }
    }
  }
  return assistantTextChunks.join('\n').trim();
}

function extractResultEvent(events: unknown[]): unknown {
  return events.find(event => {
    const typed = event as Record<string, unknown>;
    return typed.type === 'result';
  }) ?? null;
}

function runOne(
  round: RoundKind,
  arm: Arm,
  promptId: PromptId,
  workdir: string,
  sessionMode: 'fresh' | 'continued',
): RunRecord {
  ensureDir(workdir);
  const promptText = buildArmPrompt(promptId, arm);
  const args = buildArgs(promptText, arm, sessionMode);
  const result = spawnSync('claude', args, {
    cwd: workdir,
    encoding: 'utf-8',
    timeout: 900_000,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Claude invocation failed for ${round}/${arm}/${promptId} with status ${result.status}\nSTDERR:\n${result.stderr ?? ''}\nSTDOUT:\n${result.stdout ?? ''}`,
    );
  }

  const rawStream = result.stdout ?? '';
  const events = parseJsonLines(rawStream);
  const rawStreamPath = resolve(
    outDir,
    round,
    arm,
    `${promptId}.${sessionMode}.stream.jsonl`,
  );
  ensureDir(dirname(rawStreamPath));
  writeFileSync(rawStreamPath, rawStream, 'utf-8');

  return {
    round,
    arm,
    promptId,
    sessionMode,
    workdir,
    args,
    promptText,
    rawStreamPath,
    rawStream,
    finalResponseText: extractFinalResponse(events),
    toolCalls: parseToolCalls(events),
    resultEvent: extractResultEvent(events),
  };
}

function toolMetricsSummary(toolCall: ToolCallRecord): string[] {
  if (!toolCall.output || typeof toolCall.output !== 'object') {
    return ['- output was not valid JSON'];
  }
  const obj = toolCall.output as Record<string, unknown>;
  const lines: string[] = [];
  if ('status' in obj) lines.push(`- status: \`${String(obj.status)}\``);
  if ('overall_score' in obj) lines.push(`- overall_score: \`${String(obj.overall_score)}\``);
  if ('honest_ceiling' in obj) lines.push(`- honest_ceiling: \`${String(obj.honest_ceiling)}\``);
  if ('claimed_confidence' in obj) lines.push(`- claimed_confidence: \`${String(obj.claimed_confidence)}\``);
  if ('gap' in obj) lines.push(`- gap: \`${String(obj.gap)}\``);
  if ('inflation_detected' in obj) lines.push(`- inflation_detected: \`${String(obj.inflation_detected)}\``);
  if ('assumption_count' in obj) lines.push(`- assumption_count: \`${String(obj.assumption_count)}\``);
  if ('context_used' in obj) lines.push(`- context_used: \`${String(obj.context_used)}\``);
  const enforcement = obj.enforcement as Record<string, unknown> | undefined;
  const warnings = Array.isArray(enforcement?.warnings) ? enforcement?.warnings : [];
  const blocking = Array.isArray(enforcement?.blocking_issues)
    ? enforcement?.blocking_issues
    : [];
  lines.push(`- warning_count: \`${warnings.length}\``);
  lines.push(`- blocking_issue_count: \`${blocking.length}\``);
  return lines;
}

function buildSection(run: RunRecord): string[] {
  const sections: string[] = [
    `### ${run.promptId} / ${run.arm} / ${run.sessionMode}`,
    '',
    `- round: \`${run.round}\``,
    `- workdir: \`${run.workdir}\``,
    `- raw_stream_path: \`${run.rawStreamPath}\``,
    `- actual_ct_tools_fired: \`${run.toolCalls.map(call => call.name).join(', ') || 'none'}\``,
    '',
    '**Agent Prompt**',
    '',
    fenced(run.promptText, 'text'),
    '',
    '**Final User-Facing Response**',
    '',
    fenced(run.finalResponseText, 'text'),
    '',
    '**Claude Invocation Args**',
    '',
    fenced(JSON.stringify(run.args, null, 2), 'json'),
    '',
    '**Result Event**',
    '',
    fenced(JSON.stringify(run.resultEvent, null, 2), 'json'),
    '',
    '**CT Call Records**',
    '',
  ];

  if (run.toolCalls.length === 0) {
    sections.push('No CT tool calls were made in this run.');
  } else {
    run.toolCalls.forEach((toolCall, index) => {
      sections.push(`#### Tool Call ${index + 1}: ${toolCall.name}`);
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

  sections.push('**Raw Stream JSONL**');
  sections.push('');
  sections.push(fenced(run.rawStream, 'json'));
  sections.push('');

  return sections;
}

function pairSummary(a: RunRecord, b: RunRecord): string[] {
  return [
    `#### ${a.promptId}`,
    '',
    `- Arm A final response length: \`${a.finalResponseText.length}\``,
    `- Arm B final response length: \`${b.finalResponseText.length}\``,
    `- Arm A CT calls: \`${a.toolCalls.length}\``,
    `- Arm B CT calls: \`${b.toolCalls.map(call => call.name).join(', ') || 'none'}\``,
    '',
    '**A Final Response**',
    '',
    fenced(a.finalResponseText, 'text'),
    '',
    '**B Final Response**',
    '',
    fenced(b.finalResponseText, 'text'),
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

  const report: string[] = [
    '# Clean Live A/B CT Test',
    '',
    '- Date: 2026-04-09',
    '- Model: Claude Sonnet (`--model sonnet --effort low`)',
    '- Capture mode: `claude -p --verbose --output-format stream-json`',
    '- Arm A: CT disallowed',
    '- Arm B: CT explicitly required when available',
    '- Round 1: separate sessions (`Q01`, `Q04`, `Q09`)',
    '- Round 2: multi-turn session per arm (`Q01` -> `Q04` -> `Q09`)',
    '- This report contains only real prompts, real model outputs, real CT tool inputs, and real CT tool outputs captured from the Claude event stream.',
    '',
    '## Round Summaries',
    '',
    '### Separate Sessions',
    '',
  ];

  for (const promptId of promptIds) {
    const a = separateRuns.find(run => run.promptId === promptId && run.arm === 'A')!;
    const b = separateRuns.find(run => run.promptId === promptId && run.arm === 'B')!;
    report.push(...pairSummary(a, b));
  }

  report.push('### Multi-Turn');
  report.push('');
  for (const promptId of promptIds) {
    const a = multiTurnRuns.find(run => run.promptId === promptId && run.arm === 'A')!;
    const b = multiTurnRuns.find(run => run.promptId === promptId && run.arm === 'B')!;
    report.push(...pairSummary(a, b));
  }

  report.push('## Full Run Records');
  report.push('');
  for (const run of allRuns) {
    report.push(...buildSection(run));
    report.push('---');
    report.push('');
  }

  writeFileSync(reportPath, `${report.join('\n')}\n`, 'utf-8');
  process.stdout.write(`${reportPath}\n`);
}

main();
