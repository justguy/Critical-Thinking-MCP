#!/usr/bin/env npx tsx

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONDITION_ORDER,
  FULL_PROMPT_IDS,
  PILOT_PROMPT_IDS,
  PROMPTS,
  RUN_PROFILES,
  type Condition,
} from './manifest.js';

type Provider = 'codex' | 'claude' | 'gemini';

interface ProfileConfig {
  enabled?: boolean;
  provider: Provider;
  model?: string;
  reasoningEffort?: string;
  effort?: string;
}

interface RunnerConfig {
  resultsRoot?: string;
  toolReviewHostProfile?: string;
  timeoutMs?: number;
  profiles?: Record<string, ProfileConfig>;
}

interface CliCommand {
  command: string;
  args: string[];
}

type RunCellOutcome = 'completed' | 'deferred';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');
const runnerConfigPath = join(__dirname, 'runner.config.json');

function loadRunnerConfig(): RunnerConfig {
  return JSON.parse(readFileSync(runnerConfigPath, 'utf-8')) as RunnerConfig;
}

function today(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseListArg(flag: string): string[] | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readFlag(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function buildCellDir(resultsRoot: string, runProfileId: string, promptId: string): string {
  return join(resultsRoot, runProfileId, promptId);
}

function buildArtifactPath(
  resultsRoot: string,
  runProfileId: string,
  promptId: string,
  condition: Condition,
): string {
  return join(buildCellDir(resultsRoot, runProfileId, promptId), `${condition}.md`);
}

function buildPrompt(
  runProfileId: string,
  promptId: string,
  condition: Condition,
  outputPath: string,
  options: {
    critiqueInitialPath?: string;
    toolReviewPath?: string;
    preserveFallbackDirectAnalysis?: boolean;
  } = {},
): string {
  const lines = [
    'Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.',
    '',
    `- run_profile_id: ${runProfileId}`,
    `- prompt_id: ${promptId}`,
    `- condition: ${condition}`,
    `- date: ${today()}`,
    `- output_path: ${outputPath}`,
  ];

  lines.push('');
  lines.push(
    'Do not modify repository files, runner code, prompts, configs, or docs. Your only write target is the final artifact at output_path.',
  );

  if (condition === 'tool_review' && options.critiqueInitialPath) {
    lines.push(`- critique_initial_path: ${options.critiqueInitialPath}`);
    lines.push(
      `- preserve_fallback_direct_analysis: ${options.preserveFallbackDirectAnalysis ? 'yes' : 'no'}`,
    );
  }

  if (condition === 'critique_revised') {
    if (options.critiqueInitialPath) {
      lines.push(`- critique_initial_path: ${options.critiqueInitialPath}`);
    }
    if (options.toolReviewPath) {
      lines.push(`- tool_review_path: ${options.toolReviewPath}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function readRequiredArtifact(path: string, label: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing required ${label}: ${path}`);
  }
  return readFileSync(path, 'utf-8').trim();
}

function extractCritiquePacket(toolReviewContent: string): string {
  const marker = '\ncritique_packet:\n';
  const index = toolReviewContent.indexOf(marker);
  if (index !== -1) {
    return toolReviewContent.slice(index + marker.length).trim();
  }

  const fallbackMatch = toolReviewContent.match(/critique_packet:\s*([\s\S]+)/);
  if (fallbackMatch) {
    return fallbackMatch[1].trim();
  }

  throw new Error('Unable to extract critique_packet from tool_review artifact.');
}

function buildResolvedPrompt(
  runProfileId: string,
  promptId: string,
  condition: Condition,
  outputPath: string,
  options: {
    critiqueInitialPath?: string;
    toolReviewPath?: string;
    preserveFallbackDirectAnalysis?: boolean;
  } = {},
): string {
  const runProfile = RUN_PROFILES[runProfileId];
  const promptSpec = PROMPTS[promptId];
  if (!runProfile) {
    throw new Error(`Unknown run profile: ${runProfileId}`);
  }
  if (!promptSpec) {
    throw new Error(`Unknown prompt id: ${promptId}`);
  }

  if (condition === 'tool_review') {
    const critiqueInitialAnswer = readRequiredArtifact(
      options.critiqueInitialPath ?? '',
      'critique_initial artifact',
    );

    return `You are running the tool-review step of a controlled reasoning experiment.

Your job is to review one existing answer using CT-MCP as critique support.
You are not the final judge of truth.
You must not answer the original prompt directly.

Experiment metadata:
- run_profile_id: ${runProfileId}
- model_slug: ${runProfile.modelSlug}
- prompt_id: ${promptId}
- prompt_category: ${promptSpec.category}
- reasoning_tier: ${runProfile.reasoningTier}
- model_string: ${runProfile.modelString}
- temperature: ${runProfile.temperature}
- date: ${today()}
- condition: tool_review
- primary_tool: ${promptSpec.primaryTool}
- secondary_tool: ${promptSpec.secondaryTool}
- output_path: ${outputPath}

Rules:
- Use the fixed MCP-enabled environment.
- Run the primary tool first if it clearly applies.
- Run the secondary tool only if it adds real leverage.
- Do not use more than two CT-MCP tools unless you explicitly record an exception.
- Do not modify repository files, runner code, prompts, configs, or docs.
- In particular, do not edit \`benchmark/duckexperiments/run_matrix.ts\`, \`benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md\`, or any source file.
- Preserve the original reasoning when shaping tool input.
- If shaping would become too interpretive, record weak fit and use score_response_quality only.
- If CT-MCP is not available in the current environment, do not treat that as weak fit.
- If CT-MCP is not available, prefer stopping and rerunning this cell in the correct MCP-enabled host.
- Only produce a fallback no-tool review artifact if explicitly allowed.
- preserve_fallback_direct_analysis: ${options.preserveFallbackDirectAnalysis ? 'yes' : 'no'}
- Do not inspect other experiment outputs.
- Do not read sibling result files or result directories.
- Write only your final result to \`${outputPath}\`.
- Create parent directories only if needed for \`${outputPath}\`.
- Overwrite \`${outputPath}\` if it already exists.
- Return the same content in your final response.

Original prompt:
${promptSpec.text}

Previous answer:
${critiqueInitialAnswer}

Tasks:
1. Shape the answer into structured CT-MCP input only as needed.
2. Run the designated tool or tools.
3. Summarize the findings faithfully.
4. Produce a critique packet in exactly the required format.
5. Record whether CT-MCP materially helped: yes, partial, no, or not_applicable.
6. Return the full raw CT-MCP output JSON and an extracted metric snapshot.

Required output format:

run_profile_id: ${runProfileId}
prompt_id: ${promptId}
condition: tool_review
review_outcome: [completed|environment_failure]
primary_tool_run: [tool name or none]
secondary_tool_run: [tool name or none]
actual_tools_fired: [comma-separated list]
tool_environment_status: [available|unavailable]
environment_issue: [none|ct_mcp_unavailable|other]
tool_help_rating: [yes|partial|no|not_applicable]
weak_fit: [yes|no]
structured_tool_input:
\`\`\`json
[paste the exact structured input used for the primary tool, or N/A]
\`\`\`
secondary_structured_tool_input:
\`\`\`json
[paste the exact structured input used for the secondary tool, or N/A]
\`\`\`
tool_output_summary:
[short faithful summary]

ct_metric_snapshot:
- status: ...
- context_used: ...
- ct_warning_count: ...
- ct_blocking_issue_count: ...
- corrective_prompt_present: yes|no
- primary_numeric_metrics: ...

raw_ct_mcp_output_json:
\`\`\`json
[paste the full raw JSON output from the primary tool, or N/A]
\`\`\`

secondary_raw_ct_mcp_output_json:
\`\`\`json
[paste the full raw JSON output from the secondary tool, or N/A]
\`\`\`

critique_packet:
Missed constraints:
- ...

Hidden assumptions:
- ...

Irrelevant or overweighted factors:
- ...

False certainty or impossible claim:
- ...

Safer revision target:
- ...
`;
  }

  let previousAnswer = '';
  let critiquePacket = '';
  if (condition === 'critique_revised') {
    previousAnswer = readRequiredArtifact(
      options.critiqueInitialPath ?? '',
      'critique_initial artifact',
    );
    const toolReviewContent = readRequiredArtifact(options.toolReviewPath ?? '', 'tool_review artifact');
    critiquePacket = extractCritiquePacket(toolReviewContent);
  }

  return `You are running one cell of a controlled reasoning experiment.

Your job is to produce exactly one response for the assigned condition.
Do not change the methodology.
Do not ask follow-up questions.
Do not add extra commentary outside the required output format.

Experiment metadata:
- run_profile_id: ${runProfileId}
- model_slug: ${runProfile.modelSlug}
- prompt_id: ${promptId}
- prompt_category: ${promptSpec.category}
- reasoning_tier: ${runProfile.reasoningTier}
- model_string: ${runProfile.modelString}
- temperature: ${runProfile.temperature}
- date: ${today()}
- condition: ${condition}
- output_path: ${outputPath}

Filesystem rules:
- Do not inspect other experiment outputs.
- Do not read sibling result files or result directories.
- Do not modify repository files, runner code, prompts, configs, or docs.
- In particular, do not edit \`benchmark/duckexperiments/run_matrix.ts\`, \`benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md\`, or any source file.
- Write only your final result to \`${outputPath}\`.
- Create parent directories only if needed for \`${outputPath}\`.
- Overwrite \`${outputPath}\` if it already exists.
- Return the same content in your final response.

Condition rules:
- If condition = baseline:
  Answer the prompt directly.
  Do not use tools.

- If condition = prompted:
  Before answering:
  1. State the most important missing information or assumptions.
  2. State any direct conflict, contradiction, or impossible guarantee in the request.
  3. Prefer a reversible next step when uncertainty is high.
  4. Avoid invented facts.
  5. Do not use tools.

- If condition = critique_initial:
  Answer the prompt directly as an initial draft for later critique.
  Do not use tools.

- If condition = critique_revised:
  Revise the earlier answer using only the supplied critique packet.
  Fix the reasoning defects directly.
  Do not add new goals.
  Do not use tools.
  Do not claim certainty you cannot justify.

Length rules:
- Keep the answer body under 120 words.
- End with exactly these three lines:
  Bottom line:
  Confidence (0-100):
  Key missing info or assumption:

Prompt:
${promptSpec.text}

If condition = critique_revised, use these additional inputs:

Previous answer:
${previousAnswer}

Critique packet:
${critiquePacket}

Required output format:

run_profile_id: ${runProfileId}
prompt_id: ${promptId}
condition: ${condition}
response:
[your answer here]
Bottom line:
[one line]
Confidence (0-100):
[number only]
Key missing info or assumption:
[one line]
`;
}

function buildGeminiResponsePrompt(
  runProfileId: string,
  promptId: string,
  condition: Exclude<Condition, 'tool_review'>,
  options: {
    critiqueInitialPath?: string;
    toolReviewPath?: string;
  } = {},
): string {
  const runProfile = RUN_PROFILES[runProfileId];
  const promptSpec = PROMPTS[promptId];
  if (!runProfile) {
    throw new Error(`Unknown run profile: ${runProfileId}`);
  }
  if (!promptSpec) {
    throw new Error(`Unknown prompt id: ${promptId}`);
  }

  let previousAnswer = '';
  let critiquePacket = '';
  if (condition === 'critique_revised') {
    previousAnswer = readRequiredArtifact(
      options.critiqueInitialPath ?? '',
      'critique_initial artifact',
    );
    const toolReviewContent = readRequiredArtifact(options.toolReviewPath ?? '', 'tool_review artifact');
    critiquePacket = extractCritiquePacket(toolReviewContent);
  }

  const conditionGuidance: Record<Exclude<Condition, 'tool_review'>, string> = {
    baseline: [
      'Condition: baseline',
      'Answer the prompt directly.',
      'Do not mention setup, contracts, files, or methodology.',
    ].join('\n'),
    prompted: [
      'Condition: prompted',
      'Before answering, state the most important missing information or assumptions.',
      'State any direct conflict, contradiction, or impossible guarantee in the request.',
      'Prefer a reversible next step when uncertainty is high.',
      'Avoid invented facts.',
      'Do not mention setup, contracts, files, or methodology.',
    ].join('\n'),
    critique_initial: [
      'Condition: critique_initial',
      'Answer the prompt directly as an initial draft for later critique.',
      'Do not mention setup, contracts, files, or methodology.',
    ].join('\n'),
    critique_revised: [
      'Condition: critique_revised',
      'Revise the earlier answer using only the supplied critique packet.',
      'Fix the reasoning defects directly.',
      'Do not add new goals.',
      'Do not claim certainty you cannot justify.',
      'Do not mention setup, contracts, files, or methodology.',
    ].join('\n'),
  };

  return `Answer one experiment prompt.

Return only the final answer in the exact output format below.
Do not describe your process.
Do not mention files, repositories, contracts, tools, configs, or saving output.

Metadata:
- run_profile_id: ${runProfileId}
- prompt_id: ${promptId}
- condition: ${condition}
- model_slug: ${runProfile.modelSlug}
- reasoning_tier: ${runProfile.reasoningTier}

${conditionGuidance[condition]}

Length rules:
- Keep the response body under 120 words.
- End with Bottom line, Confidence (0-100), and Key missing info or assumption.

Prompt:
${promptSpec.text}

${condition === 'critique_revised' ? `Previous answer:\n${previousAnswer}\n\nCritique packet:\n${critiquePacket}\n\n` : ''}Required output format:

run_profile_id: ${runProfileId}
prompt_id: ${promptId}
condition: ${condition}
response:
[your answer here]
Bottom line:
[one line]
Confidence (0-100):
[number only]
Key missing info or assumption:
[one line]
`;
}

function parseArtifactMeta(content: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const patterns = [
    'run_profile_id',
    'prompt_id',
    'condition',
    'review_outcome',
    'actual_tools_fired',
    'tool_environment_status',
    'environment_issue',
  ];

  for (const key of patterns) {
    const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (match) meta[key] = match[1].trim();
  }

  return meta;
}

function hasPromptEcho(content: string): boolean {
  return (
    content.includes('You are running one cell of a controlled reasoning experiment.') ||
    content.includes('You are running the tool-review step of a controlled reasoning experiment.') ||
    content.includes('Required output format:') ||
    content.includes('[your answer here]') ||
    content.includes('[number only]') ||
    content.includes('[one line]') ||
    content.includes('[tool name or none]')
  );
}

function isValidResponseArtifact(
  content: string,
  runProfileId: string,
  promptId: string,
  condition: Exclude<Condition, 'tool_review'>,
): boolean {
  const meta = parseArtifactMeta(content);
  if (meta.run_profile_id !== runProfileId) return false;
  if (meta.prompt_id !== promptId) return false;
  if (meta.condition !== condition) return false;
  if (hasPromptEcho(content)) return false;
  if (!/^response:\s*$/m.test(content)) return false;
  if (!/^Bottom line:/m.test(content)) return false;
  if (!/^Confidence \(0-100\):/m.test(content)) return false;
  if (!/^Key missing info or assumption:/m.test(content)) return false;

  const confidenceMatch = content.match(/Confidence \(0-100\):\s*(?:\n\s*)?(\d{1,3})\b/);
  if (!confidenceMatch) return false;
  const confidence = Number(confidenceMatch[1]);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) return false;

  return true;
}

function isValidToolReviewArtifact(
  content: string,
  runProfileId: string,
  promptId: string,
): boolean {
  const meta = parseArtifactMeta(content);
  if (meta.run_profile_id !== runProfileId) return false;
  if (meta.prompt_id !== promptId) return false;
  if (meta.condition !== 'tool_review') return false;
  if (hasPromptEcho(content)) return false;
  if (!/^review_outcome:\s*(completed|environment_failure)$/m.test(content)) return false;
  if (!/^tool_environment_status:\s*(available|unavailable)$/m.test(content)) return false;
  if (!/^tool_help_rating:\s*(yes|partial|no|not_applicable)$/m.test(content)) return false;
  if (!/^critique_packet:/m.test(content)) return false;
  return true;
}

function isValidArtifact(
  artifactPath: string,
  runProfileId: string,
  promptId: string,
  condition: Condition,
): boolean {
  if (!existsSync(artifactPath)) return false;
  const content = readFileSync(artifactPath, 'utf-8');
  if (condition === 'tool_review') {
    return isValidToolReviewArtifact(content, runProfileId, promptId);
  }
  return isValidResponseArtifact(
    content,
    runProfileId,
    promptId,
    condition as Exclude<Condition, 'tool_review'>,
  );
}

function normalizeStdoutToResponseArtifact(
  stdout: string,
  runProfileId: string,
  promptId: string,
  condition: Exclude<Condition, 'tool_review'>,
): string | null {
  const trimmed = stdout.trim();
  if (!trimmed || hasPromptEcho(trimmed)) return null;

  if (isValidResponseArtifact(trimmed, runProfileId, promptId, condition)) {
    return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`;
  }

  const bottomIndex = trimmed.indexOf('Bottom line:');
  if (bottomIndex === -1) return null;
  if (!trimmed.includes('Confidence (0-100):')) return null;
  if (!trimmed.includes('Key missing info or assumption:')) return null;

  const body = trimmed.slice(0, bottomIndex).trim();
  const footer = trimmed.slice(bottomIndex).trim();
  if (!body || !footer) return null;

  const candidate = [
    `run_profile_id: ${runProfileId}`,
    `prompt_id: ${promptId}`,
    `condition: ${condition}`,
    'response:',
    body,
    footer,
    '',
  ].join('\n');

  return isValidResponseArtifact(candidate, runProfileId, promptId, condition) ? candidate : null;
}

function isCompletedArtifact(
  artifactPath: string,
  runProfileId: string,
  promptId: string,
  condition: Condition,
): boolean {
  if (!isValidArtifact(artifactPath, runProfileId, promptId, condition)) return false;

  const content = readFileSync(artifactPath, 'utf-8');
  const meta = parseArtifactMeta(content);

  if (condition !== 'tool_review') return true;

  if (meta.tool_environment_status !== 'available') return false;
  const fired = (meta.actual_tools_fired ?? '').toLowerCase();
  if (!fired || fired === 'none') return false;
  if ((meta.review_outcome ?? 'completed') !== 'completed') return false;

  return true;
}

function nextMissingCondition(resultsRoot: string, runProfileId: string, promptId: string): Condition | null {
  return nextMissingConditionWithOverrides(resultsRoot, runProfileId, promptId, new Set<Condition>());
}

function nextMissingConditionWithOverrides(
  resultsRoot: string,
  runProfileId: string,
  promptId: string,
  assumedComplete: Set<Condition>,
): Condition | null {
  for (const condition of CONDITION_ORDER) {
    if (assumedComplete.has(condition)) continue;
    const artifactPath = buildArtifactPath(resultsRoot, runProfileId, promptId, condition);
    if (!isCompletedArtifact(artifactPath, runProfileId, promptId, condition)) {
      return condition;
    }
  }
  return null;
}

function buildCliCommand(
  provider: Provider,
  profileId: string,
  profileConfig: ProfileConfig,
  prompt: string,
  resultsRoot: string,
): CliCommand {
  const addDirArg = resolve(resultsRoot);

  if (provider === 'codex') {
    const args = [
      'exec',
      '--full-auto',
      '-C',
      repoRoot,
      '--add-dir',
      addDirArg,
      '--output-last-message',
      '/dev/stdout',
    ];
    if (profileConfig.model) {
      args.push('-m', profileConfig.model);
    }
    if (profileConfig.reasoningEffort) {
      args.push('-c', `model_reasoning_effort="${profileConfig.reasoningEffort}"`);
    }
    args.push(prompt);
    return { command: 'codex', args };
  }

  if (provider === 'claude') {
    const args = [
      '-p',
      '--output-format',
      'text',
      '--permission-mode',
      'bypassPermissions',
      '--add-dir',
      addDirArg,
      '--no-session-persistence',
    ];
    if (profileConfig.model) {
      args.push('--model', profileConfig.model);
    }
    if (profileConfig.effort) {
      args.push('--effort', profileConfig.effort);
    }
    args.push(prompt);
    return { command: 'claude', args };
  }

  const args = [
    '-p',
    prompt,
    '--output-format',
    'text',
    '--approval-mode',
    'yolo',
    '--include-directories',
    addDirArg,
  ];
  if (profileConfig.model) {
    args.push('-m', profileConfig.model);
  }
  return { command: 'gemini', args };
}

function isGeminiCapacityError(stderr: string): boolean {
  const text = stderr.toLowerCase();
  return (
    text.includes('model_capacity_exhausted') ||
    text.includes('no capacity available for model') ||
    text.includes('resource_exhausted') ||
    text.includes('retryablequotaerror') ||
    text.includes('you have exhausted your capacity on this model')
  );
}

function runCell(
  runProfileId: string,
  executorProfileId: string,
  promptId: string,
  condition: Condition,
  config: RunnerConfig,
  resultsRoot: string,
  dryRun: boolean,
): RunCellOutcome {
  const runProfile = RUN_PROFILES[runProfileId];
  const executorProfile = RUN_PROFILES[executorProfileId];
  const executorConfig = config.profiles?.[executorProfileId];

  if (!runProfile) {
    throw new Error(`Unknown run profile: ${runProfileId}`);
  }
  if (!executorProfile) {
    throw new Error(`Unknown executor profile: ${executorProfileId}`);
  }
  if (!executorConfig?.enabled) {
    throw new Error(`Executor profile is not enabled in runner.config.json: ${executorProfileId}`);
  }
  if (!PROMPTS[promptId]) {
    throw new Error(`Unknown prompt id: ${promptId}`);
  }

  const cellDir = buildCellDir(resultsRoot, runProfileId, promptId);
  ensureDir(cellDir);

  const outputPath = buildArtifactPath(resultsRoot, runProfileId, promptId, condition);
  const critiqueInitialPath = buildArtifactPath(resultsRoot, runProfileId, promptId, 'critique_initial');
  const toolReviewPath = buildArtifactPath(resultsRoot, runProfileId, promptId, 'tool_review');
  const invocationPath = join(cellDir, `${condition}.prompt.txt`);
  const stdoutPath = join(cellDir, `${condition}.stdout.log`);
  const stderrPath = join(cellDir, `${condition}.stderr.log`);
  const deferredPath = join(cellDir, `${condition}.deferred.txt`);

  const prompt = buildPrompt(runProfileId, promptId, condition, outputPath, {
    critiqueInitialPath,
    toolReviewPath,
    preserveFallbackDirectAnalysis: false,
  });
  const executionPrompt =
    executorProfile.provider === 'gemini'
      ? buildGeminiResponsePrompt(runProfileId, promptId, condition as Exclude<Condition, 'tool_review'>, {
          critiqueInitialPath,
          toolReviewPath,
        })
      : prompt;

  writeFileSync(invocationPath, executionPrompt, 'utf-8');

  const cli = buildCliCommand(
    executorProfile.provider,
    executorProfileId,
    executorConfig,
    executionPrompt,
    resultsRoot,
  );
  const summary = `${runProfileId} ${promptId} ${condition} via ${executorProfileId}`;

  if (dryRun) {
    console.log(`[dry-run] ${summary}`);
    console.log(`  command: ${cli.command} ${cli.args.map((a) => JSON.stringify(a)).join(' ')}`);
    console.log(`  output : ${outputPath}`);
    return 'completed';
  }

  console.log(`[run] ${summary}`);
  const result = spawnSync(cli.command, cli.args, {
    cwd: repoRoot,
    encoding: 'utf-8',
    timeout: config.timeoutMs ?? 900_000,
    maxBuffer: 10 * 1024 * 1024,
  });

  writeFileSync(stdoutPath, result.stdout ?? '', 'utf-8');
  writeFileSync(stderrPath, result.stderr ?? '', 'utf-8');

  const normalizedGeminiArtifact =
    executorProfile.provider === 'gemini' && condition !== 'tool_review'
      ? normalizeStdoutToResponseArtifact(
          result.stdout ?? '',
          runProfileId,
          promptId,
          condition as Exclude<Condition, 'tool_review'>,
        )
      : null;

  if (
    normalizedGeminiArtifact &&
    (!existsSync(outputPath) || !isValidArtifact(outputPath, runProfileId, promptId, condition))
  ) {
    writeFileSync(outputPath, normalizedGeminiArtifact, 'utf-8');
  }

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (existsSync(outputPath) && isValidArtifact(outputPath, runProfileId, promptId, condition)) {
      return 'completed';
    }

    if (
      executorProfile.provider === 'gemini' &&
      condition !== 'tool_review' &&
      isGeminiCapacityError(result.stderr ?? '')
    ) {
      const deferredNote = [
        `summary: ${summary}`,
        'status: deferred',
        'reason: gemini_model_capacity_exhausted',
        `model: ${executorConfig.model ?? 'unknown'}`,
        `stderr_path: ${stderrPath}`,
        `stdout_path: ${stdoutPath}`,
        'next_action: retry this prompt/profile later; the artifact was left incomplete on purpose',
      ].join('\n');
      writeFileSync(deferredPath, `${deferredNote}\n`, 'utf-8');
      console.log(`[deferred] ${summary} due to Gemini model capacity. Leaving it incomplete for later retry.`);
      return 'deferred';
    }

    throw new Error(`Cell failed (${summary}). See ${stderrPath}`);
  }

  if (!existsSync(outputPath)) {
    throw new Error(`Cell completed without writing artifact (${summary}). Expected ${outputPath}`);
  }

  if (!isValidArtifact(outputPath, runProfileId, promptId, condition)) {
    throw new Error(`Cell wrote an invalid artifact (${summary}). Check ${outputPath} and ${stdoutPath}.`);
  }

  if (condition === 'tool_review' && !isCompletedArtifact(outputPath, runProfileId, promptId, condition)) {
    throw new Error(
      `tool_review did not complete with live CT-MCP (${summary}). Check ${outputPath} and rerun in the fixed MCP-enabled host.`,
    );
  }

  return 'completed';
}

function selectedRunProfiles(config: RunnerConfig): string[] {
  const explicit = parseListArg('--profiles');
  if (explicit) return explicit;
  return Object.keys(RUN_PROFILES).filter((id) => config.profiles?.[id]?.enabled);
}

function selectedPromptIds(): string[] {
  const explicit = parseListArg('--prompts');
  if (explicit) return explicit;
  const phase = readFlag('--phase') ?? 'pilot';
  return phase === 'full' ? [...FULL_PROMPT_IDS] : [...PILOT_PROMPT_IDS];
}

function main(): void {
  const config = loadRunnerConfig();
  const resultsRoot = resolve(repoRoot, config.resultsRoot ?? 'benchmark/duckexperiments/results');
  const dryRun = hasFlag('--dry-run');
  const maxCells = Number(readFlag('--max-cells') ?? '0');
  const toolReviewHostProfile = readFlag('--tool-review-host') ?? config.toolReviewHostProfile ?? 'codex_thinking';
  const runProfiles = selectedRunProfiles(config);
  const promptIds = selectedPromptIds();

  ensureDir(resultsRoot);

  let cellsRun = 0;
  for (const runProfileId of runProfiles) {
    for (const promptId of promptIds) {
      const assumedComplete = new Set<Condition>();
      while (true) {
        const condition = nextMissingConditionWithOverrides(
          resultsRoot,
          runProfileId,
          promptId,
          assumedComplete,
        );
        if (!condition) break;

        const executorProfileId = condition === 'tool_review' ? toolReviewHostProfile : runProfileId;
        const outcome = runCell(runProfileId, executorProfileId, promptId, condition, config, resultsRoot, dryRun);
        cellsRun += 1;

        if (dryRun) {
          assumedComplete.add(condition);
        }

        if (outcome === 'deferred') {
          break;
        }

        if (maxCells > 0 && cellsRun >= maxCells) {
          console.log(`Stopped after ${cellsRun} cell(s) because --max-cells=${maxCells}.`);
          return;
        }
      }
    }
  }

  console.log(`Done. ${dryRun ? 'Planned' : 'Ran'} ${cellsRun} cell(s).`);
}

main();
