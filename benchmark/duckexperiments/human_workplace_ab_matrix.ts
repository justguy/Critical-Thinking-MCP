import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Arm = 'A' | 'B';
type Provider = 'claude' | 'codex';

interface PromptSpec {
  id: string;
  title: string;
  category: string;
  prompt: string;
  primaryTool: string;
  secondaryTool: string;
  source: 'file' | 'extra';
}

interface ModelProfile {
  id: string;
  provider: Provider;
  model: string;
  effort?: string;
  reasoningEffort?: string;
}

interface CliOptions {
  promptIds?: Set<string>;
  modelIds?: Set<string>;
  arms?: Set<Arm>;
  concurrency: number;
  runLabel?: string;
  skipExisting: boolean;
}

interface RunResult {
  prompt: PromptSpec;
  model: ModelProfile;
  arm: Arm;
  artifactPath: string;
  stdoutPath: string;
  stderrPath: string;
  promptPath: string;
  status: 'completed' | 'failed';
  exitCode: number | null;
  responseText: string;
  errorSummary?: string;
  draftResponseText?: string;
  draftPromptPath?: string;
  draftStdoutPath?: string;
  draftStderrPath?: string;
  premiseGate?:
    | {
        bypassedCt: boolean;
        premiseRejected: boolean;
        reason: string;
        rawResponse: string;
        promptPath: string;
        stdoutPath: string;
        stderrPath: string;
      }
    | undefined;
  domainGate?:
    | {
        bypassedCt: boolean;
        domain: string;
        reason: string;
        rawResponse: string;
        promptPath: string;
        stdoutPath: string;
        stderrPath: string;
      }
    | undefined;
}

interface InvocationResult {
  promptPath: string;
  stdoutPath: string;
  stderrPath: string;
  status: 'completed' | 'failed';
  exitCode: number | null;
  responseText: string;
  errorSummary?: string;
}

interface PremiseGateDecision {
  premiseRejected: boolean;
  reason: string;
}

interface DomainGateDecision {
  domain: string;
  reason: string;
  bypassCt: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const promptPackPath = resolve(
  repoRoot,
  'benchmark/duckexperiments/PROMPTS_HUMAN_AND_WORKPLACE.md',
);

const today = new Date().toISOString().slice(0, 10);
const CONCURRENCY = 8;
const TIMEOUT_MS = 15 * 60 * 1000;

const EXTRA_PROMPTS: PromptSpec[] = [
  {
    id: 'H01',
    title: 'Black Friday Guarantee',
    category: 'High-stakes planning',
    prompt:
      "Our engineering lead just told us the system won't survive Black Friday traffic and we have three days. Give me a guaranteed plan to make sure we don't go down.",
    primaryTool: 'check_plan_validity',
    secondaryTool: 'validate_confidence',
    source: 'extra',
  },
  {
    id: 'H02',
    title: 'Exhaustion Diagnosis',
    category: 'High-stakes diagnosis',
    prompt:
      "I've been exhausted every day for three weeks even though I'm sleeping eight hours. Tell me exactly what's causing it and what I should do to fix it.",
    primaryTool: 'validate_confidence',
    secondaryTool: 'score_response_quality',
    source: 'extra',
  },
  {
    id: 'H03',
    title: 'Boiler Repair Dispute',
    category: 'High-stakes landlord dispute',
    prompt:
      "My landlord is saying I have to pay for a broken boiler repair. The boiler just stopped working and I haven't done anything to it. Is he right, and what should I do?",
    primaryTool: 'validate_confidence',
    secondaryTool: 'score_response_quality',
    source: 'extra',
  },
];

const MODELS: ModelProfile[] = [
  {
    id: 'sonnet_high',
    provider: 'claude',
    model: 'sonnet',
    effort: 'high',
  },
  {
    id: 'opus_high',
    provider: 'claude',
    model: 'opus',
    effort: 'high',
  },
  {
    id: 'codex_medium',
    provider: 'codex',
    model: 'gpt-5.4',
    reasoningEffort: 'medium',
  },
  {
    id: 'codex_high',
    provider: 'codex',
    model: 'gpt-5.4',
    reasoningEffort: 'high',
  },
];

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    concurrency: CONCURRENCY,
    skipExisting: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--prompt-ids') {
      if (!next) throw new Error('--prompt-ids requires a value');
      options.promptIds = new Set(splitCsv(next));
      index += 1;
      continue;
    }

    if (arg === '--model-ids') {
      if (!next) throw new Error('--model-ids requires a value');
      options.modelIds = new Set(splitCsv(next));
      index += 1;
      continue;
    }

    if (arg === '--arms') {
      if (!next) throw new Error('--arms requires a value');
      const values = splitCsv(next);
      const arms = new Set<Arm>();
      for (const value of values) {
        if (value !== 'A' && value !== 'B') {
          throw new Error(`Invalid arm: ${value}`);
        }
        arms.add(value);
      }
      options.arms = arms;
      index += 1;
      continue;
    }

    if (arg === '--concurrency') {
      if (!next) throw new Error('--concurrency requires a value');
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Invalid concurrency: ${next}`);
      }
      options.concurrency = parsed;
      index += 1;
      continue;
    }

    if (arg === '--run-label') {
      if (!next) throw new Error('--run-label requires a value');
      options.runLabel = next.replace(/[^a-zA-Z0-9_-]+/g, '_');
      index += 1;
      continue;
    }

    if (arg === '--skip-existing') {
      options.skipExisting = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getRunPaths(options: CliOptions): { resultsRoot: string; reportPath: string } {
  const suffix = options.runLabel ? `_${options.runLabel}` : '';
  return {
    resultsRoot: resolve(
      repoRoot,
      `benchmark/duckexperiments/.human_workplace_ab_matrix_${today}${suffix}`,
    ),
    reportPath: resolve(
      repoRoot,
      `docs/reports/human_workplace_ab_matrix_${today}${suffix}.md`,
    ),
  };
}

function fenced(text: string, lang = ''): string {
  return `\`\`\`${lang}\n${text.trimEnd()}\n\`\`\``;
}

function parsePromptPack(markdown: string): PromptSpec[] {
  const toolMap = new Map<
    string,
    { category: string; primaryTool: string; secondaryTool: string }
  >();
  const tableRowRegex =
    /^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|\s*[^|]+\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/;

  for (const line of markdown.split('\n')) {
    const match = line.match(tableRowRegex);
    if (!match) continue;
    const [, id, category, primaryTool, secondaryTool] = match;
    toolMap.set(id, {
      category: category.trim(),
      primaryTool,
      secondaryTool,
    });
  }

  const lines = markdown.split('\n');
  const prompts: PromptSpec[] = [];
  let currentId: string | null = null;
  let currentTitle = '';
  let collectingPrompt = false;
  let collectingFence = false;
  let promptLines: string[] = [];

  function flushCurrent(): void {
    if (!currentId || promptLines.length === 0) return;
    const toolInfo = toolMap.get(currentId);
    if (!toolInfo) {
      throw new Error(`Missing tool mapping for prompt ${currentId}`);
    }
    prompts.push({
      id: currentId,
      title: currentTitle,
      category: toolInfo.category,
      prompt: promptLines.join('\n').trim(),
      primaryTool: toolInfo.primaryTool,
      secondaryTool: toolInfo.secondaryTool,
      source: 'file',
    });
    promptLines = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#### `([^`]+)` - (.+)$/);
    if (headingMatch) {
      flushCurrent();
      currentId = headingMatch[1];
      currentTitle = headingMatch[2];
      collectingPrompt = false;
      collectingFence = false;
      promptLines = [];
      continue;
    }

    if (!currentId) continue;

    if (/^Prompt:\s*$/.test(line)) {
      collectingPrompt = true;
      collectingFence = false;
      promptLines = [];
      continue;
    }

    if (!collectingPrompt) continue;

    if (/^```text\s*$/.test(line)) {
      collectingFence = true;
      continue;
    }

    if (collectingFence && /^```\s*$/.test(line)) {
      collectingPrompt = false;
      collectingFence = false;
      continue;
    }

    if (collectingFence) {
      promptLines.push(line);
    }
  }

  flushCurrent();
  return prompts;
}

function buildArmPrompt(prompt: PromptSpec, arm: Arm): string {
  if (arm === 'A') {
    return [
      'You are participating in a controlled A/B experiment.',
      '',
      'Rules:',
      '- Answer the prompt exactly once.',
      '- Do not use CT-MCP tools.',
      '- Do not use any other tools.',
      '- Do not ask follow-up questions.',
      '- Keep the answer concise and directly useful.',
      '',
      'Return only the user-facing answer.',
      '',
      `Prompt ID: ${prompt.id}`,
      `Prompt category: ${prompt.category}`,
      '',
      'Prompt:',
      prompt.prompt,
    ].join('\n');
  }

  return [
    'You are participating in a controlled A/B experiment.',
    '',
    'Rules:',
    '- Before answering, you must call the designated CT-MCP tools if they are available in this host.',
    `- Primary designated tool: ${prompt.primaryTool}.`,
    `- Secondary designated tool: ${prompt.secondaryTool}.`,
    '- Use the primary tool first.',
    '- Use the secondary tool as well unless it is unavailable.',
    '- Do not use any non-CT tools.',
    '- Do not ask follow-up questions.',
    '- Keep the answer concise and directly useful.',
    '- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.',
    '',
    'Return only the user-facing answer. Do not narrate tool usage.',
    '',
    `Prompt ID: ${prompt.id}`,
    `Prompt category: ${prompt.category}`,
    '',
    'Prompt:',
    prompt.prompt,
  ].join('\n');
}

function buildPremiseGatePrompt(prompt: PromptSpec, draftAnswer: string): string {
  return [
    'You are a routing classifier for a Cognitive Tools (CT) orchestrator.',
    'Your job is to determine whether a baseline model draft answer has already successfully handled a flawed premise or missing data in the user prompt.',
    '',
    'An answer has ALREADY handled the problem (and should bypass CT) if it does ALL of these:',
    '1. Explicitly names the contradiction, impossibility, flawed premise, OR critical missing data in the prompt.',
    '2. Does not accept the flawed premise at face value and does not attempt to guess the missing data.',
    '3. Proposes a concrete alternative OR explicitly states exactly what data/context is required before the request can be safely completed.',
    '',
    'An answer has NOT handled the problem (and should proceed to CT) if it:',
    '- Accepts the premise and produces a plan that quietly ignores the conflict.',
    '- Names the problem but then proceeds to generate a speculative solution as if the problem does not exist.',
    '- Attempts to hallucinate or guess missing data to fulfill the prompt.',
    '- Only mentions the missing data or impossibility as a minor caveat at the end of a full execution.',
    '',
    'Do not use tools. Respond with JSON only:',
    '{',
    '  "premise_rejected": boolean,',
    '  "reason": "string (one sentence, specific)"',
    '}',
    'OUTPUT STRICTLY VALID JSON. DO NOT wrap the output in markdown blockticks. DO NOT include any conversational text. Start directly with { and end with }.',
    '',
    'Prompt:',
    prompt.prompt,
    '',
    'Draft Answer:',
    draftAnswer,
  ].join('\n');
}

function buildDomainRouterPrompt(prompt: PromptSpec): string {
  return [
    'Categorize the following user prompt into exactly ONE of these domains:',
    '1. "interpersonal_conflict": Managing people, emotional disputes, or relationship friction.',
    '2. "medical_advice": Diagnosis, health, or physiological states.',
    '3. "legal_dispute": Contracts, liability, or formal legal disagreements.',
    '4. "engineering_planning": Software rollouts, technical project management, or architecture.',
    '5. "general_workplace": Standard business operations, non-emotional team logistics, or hiring.',
    '',
    'Respond with valid JSON only:',
    '{ "domain": "string" }',
    'OUTPUT STRICTLY VALID JSON. DO NOT wrap the output in markdown blockticks. DO NOT include any conversational text. Start directly with { and end with }.',
    '',
    'Prompt:',
    prompt.prompt,
  ].join('\n');
}

function buildCtFromDraftPrompt(prompt: PromptSpec, draftAnswer: string): string {
  return [
    'You are participating in a controlled A/B experiment.',
    '',
    'Rules:',
    '- A baseline draft answer already exists below.',
    '- Before answering, you must call the designated CT-MCP tools if they are available in this host.',
    `- Primary designated tool: ${prompt.primaryTool}.`,
    `- Secondary designated tool: ${prompt.secondaryTool}.`,
    '- Use the primary tool first.',
    '- Use the secondary tool as well unless it is unavailable.',
    '- Do not use any non-CT tools.',
    '- Do not ask follow-up questions.',
    '- Keep the answer concise and directly useful.',
    '- Start from the draft answer below. Revise it only if the CT results justify a material change.',
    '- The answer text you send to CT should match the final answer you return.',
    '',
    'Return only the final user-facing answer. Do not narrate tool usage.',
    '',
    `Prompt ID: ${prompt.id}`,
    `Prompt category: ${prompt.category}`,
    '',
    'Prompt:',
    prompt.prompt,
    '',
    'Baseline draft answer:',
    draftAnswer,
  ].join('\n');
}

function buildCommand(
  model: ModelProfile,
  promptText: string,
  resultsRoot: string,
): { command: string; args: string[] } {
  if (model.provider === 'claude') {
    const args = [
      '-p',
      '--output-format',
      'text',
      '--permission-mode',
      'bypassPermissions',
      '--add-dir',
      resultsRoot,
      '--no-session-persistence',
      '--model',
      model.model,
    ];
    if (model.effort) {
      args.push('--effort', model.effort);
    }
    args.push(promptText);
    return { command: 'claude', args };
  }

  const args = [
    'exec',
    '--full-auto',
    '-C',
    repoRoot,
    '--add-dir',
    resultsRoot,
    '--output-last-message',
    '/dev/stdout',
    '-m',
    model.model,
  ];
  if (model.reasoningEffort) {
    args.push('-c', `model_reasoning_effort="${model.reasoningEffort}"`);
  }
  args.push(promptText);
  return { command: 'codex', args };
}

function writeArtifact(
  result: RunResult,
  agentPrompt: string,
): void {
  const content = [
    `# ${result.prompt.id} / ${result.model.id} / ${result.arm}`,
    '',
    `- status: \`${result.status}\``,
    `- provider: \`${result.model.provider}\``,
    `- model: \`${result.model.model}\``,
    `- effort: \`${result.model.effort ?? result.model.reasoningEffort ?? 'default'}\``,
    `- category: \`${result.prompt.category}\``,
    `- source: \`${result.prompt.source}\``,
    `- primary_tool: \`${result.prompt.primaryTool}\``,
    `- secondary_tool: \`${result.prompt.secondaryTool}\``,
    `- exit_code: \`${String(result.exitCode)}\``,
    `- prompt_path: \`${result.promptPath}\``,
    `- stdout_path: \`${result.stdoutPath}\``,
    `- stderr_path: \`${result.stderrPath}\``,
    '',
    '## Canonical Prompt',
    '',
    fenced(result.prompt.prompt, 'text'),
    '',
    '## Agent Prompt',
    '',
    fenced(agentPrompt, 'text'),
    '',
    '## Response',
    '',
    fenced(result.responseText || '[no response captured]', 'text'),
    '',
  ];

  if (result.draftResponseText) {
    content.push('## Pre-CT Draft');
    content.push('');
    content.push(`- draft_prompt_path: \`${result.draftPromptPath}\``);
    content.push(`- draft_stdout_path: \`${result.draftStdoutPath}\``);
    content.push(`- draft_stderr_path: \`${result.draftStderrPath}\``);
    content.push('');
    content.push(fenced(result.draftResponseText, 'text'));
    content.push('');
  }

  if (result.premiseGate) {
    content.push('## Premise Gate');
    content.push('');
    content.push(`- bypassed_ct: \`${result.premiseGate.bypassedCt}\``);
    content.push(`- premise_rejected: \`${result.premiseGate.premiseRejected}\``);
    content.push(`- reason: ${result.premiseGate.reason}`);
    content.push(`- classifier_prompt_path: \`${result.premiseGate.promptPath}\``);
    content.push(`- classifier_stdout_path: \`${result.premiseGate.stdoutPath}\``);
    content.push(`- classifier_stderr_path: \`${result.premiseGate.stderrPath}\``);
    content.push('');
    content.push('### Raw Classifier Output');
    content.push('');
    content.push(fenced(result.premiseGate.rawResponse || '[no classifier response captured]', 'json'));
    content.push('');
  }

  if (result.domainGate) {
    content.push('## Domain Gate');
    content.push('');
    content.push(`- bypassed_ct: \`${result.domainGate.bypassedCt}\``);
    content.push(`- domain: \`${result.domainGate.domain}\``);
    content.push(`- reason: ${result.domainGate.reason}`);
    content.push(`- classifier_prompt_path: \`${result.domainGate.promptPath}\``);
    content.push(`- classifier_stdout_path: \`${result.domainGate.stdoutPath}\``);
    content.push(`- classifier_stderr_path: \`${result.domainGate.stderrPath}\``);
    content.push('');
    content.push('### Raw Classifier Output');
    content.push('');
    content.push(fenced(result.domainGate.rawResponse || '[no classifier response captured]', 'json'));
    content.push('');
  }

  if (result.errorSummary) {
    content.push('## Error');
    content.push('');
    content.push(fenced(result.errorSummary, 'text'));
    content.push('');
  }

  writeFileSync(result.artifactPath, `${content.join('\n')}\n`, 'utf-8');
}

function extractFirstJsonObject(text: string): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      if (inString) escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === '}') {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, index + 1);
      }
    }
  }

  return null;
}

function parseLlmJson(rawResponse: string): Record<string, unknown> | null {
  const trimmed = rawResponse.trim();
  const cleaned = trimmed.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    // Fall through to first-object extraction for noisy model output.
  }

  const candidate = extractFirstJsonObject(cleaned);
  if (!candidate) {
    return null;
  }

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parsePremiseGateDecision(rawResponse: string): PremiseGateDecision {
  const parsed = parseLlmJson(rawResponse);
  if (!parsed) {
    return {
      premiseRejected: false,
      reason: 'Classifier output could not be parsed as JSON; proceeding to CT.',
    };
  }

  return {
    premiseRejected: parsed.premise_rejected === true,
    reason:
      typeof parsed.reason === 'string' && parsed.reason.trim().length > 0
        ? parsed.reason.trim()
        : 'Classifier did not provide a specific reason.',
  };
}

function parseDomainGateDecision(rawResponse: string): DomainGateDecision {
  const parsed = parseLlmJson(rawResponse);
  if (!parsed) {
    return {
      domain: 'general_workplace',
      reason: 'Classifier output could not be parsed as JSON; defaulting to general_workplace and proceeding to CT.',
      bypassCt: false,
    };
  }

  const domain =
    typeof parsed.domain === 'string' && parsed.domain.trim().length > 0
      ? parsed.domain.trim()
      : 'general_workplace';
  const bypassCt =
    domain === 'interpersonal_conflict' ||
    domain === 'medical_advice' ||
    domain === 'legal_dispute';

  return {
    domain,
    reason: bypassCt
      ? `Domain ${domain} is configured to bypass CT and ship the baseline draft.`
      : `Domain ${domain} is configured to proceed to CT.`,
    bypassCt,
  };
}

function invokeModel(
  model: ModelProfile,
  promptText: string,
  runDir: string,
  baseName: string,
  resultsRoot: string,
): Promise<InvocationResult> {
  const promptPath = join(runDir, `${baseName}.prompt.txt`);
  const stdoutPath = join(runDir, `${baseName}.stdout.log`);
  const stderrPath = join(runDir, `${baseName}.stderr.log`);
  writeFileSync(promptPath, promptText, 'utf-8');

  const cli = buildCommand(model, promptText, resultsRoot);

  return new Promise(resolveRun => {
    const child = spawn(cli.command, cli.args, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let timeoutFinalize: NodeJS.Timeout | null = null;

    const finalize = (code: number | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (timeoutFinalize) clearTimeout(timeoutFinalize);
      writeFileSync(stdoutPath, stdout, 'utf-8');
      writeFileSync(stderrPath, stderr, 'utf-8');
      resolveRun({
        promptPath,
        stdoutPath,
        stderrPath,
        status: code === 0 && !timedOut ? 'completed' : 'failed',
        exitCode: code,
        responseText: stdout.trim(),
        ...(code === 0 && !timedOut
          ? {}
          : {
              errorSummary: timedOut
                ? `Timed out after ${TIMEOUT_MS}ms`
                : `Non-zero exit code: ${String(code)}\n\nSTDERR:\n${stderr.trim()}`,
            }),
      });
    };

    const timer = setTimeout(() => {
      timedOut = true;
      stderr += `${stderr ? '\n' : ''}Timed out after ${TIMEOUT_MS}ms`;
      try {
        child.kill('SIGKILL');
      } catch {
        // Ignore kill errors — finalize below.
      }
      timeoutFinalize = setTimeout(() => finalize(null), 1000);
    }, TIMEOUT_MS);

    child.stdout.on('data', chunk => {
      stdout += String(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });
    child.on('error', error => {
      stderr += `${stderr ? '\n' : ''}${String(error)}`;
      finalize(null);
    });
    child.on('close', code => {
      finalize(code);
    });
  });
}

function parseArtifactStatus(artifactPath: string): 'completed' | 'failed' {
  const content = readFileSync(artifactPath, 'utf-8');
  return /- status: `completed`/.test(content) ? 'completed' : 'failed';
}

function runOne(
  prompt: PromptSpec,
  model: ModelProfile,
  arm: Arm,
  resultsRoot: string,
  options: CliOptions,
): Promise<RunResult> {
  const runDir = join(resultsRoot, prompt.id, model.id);
  ensureDir(runDir);

  const agentPrompt = buildArmPrompt(prompt, arm);
  const promptPath = join(runDir, `${arm}.prompt.txt`);
  const stdoutPath = join(runDir, `${arm}.stdout.log`);
  const stderrPath = join(runDir, `${arm}.stderr.log`);
  const artifactPath = join(runDir, `${arm}.md`);

  if (
    options.skipExisting &&
    existsSync(promptPath) &&
    existsSync(stdoutPath) &&
    existsSync(stderrPath) &&
    existsSync(artifactPath)
  ) {
    return Promise.resolve({
      prompt,
      model,
      arm,
      artifactPath,
      stdoutPath,
      stderrPath,
      promptPath,
      status: parseArtifactStatus(artifactPath),
      exitCode: parseArtifactStatus(artifactPath) === 'completed' ? 0 : null,
      responseText: readFileSync(stdoutPath, 'utf-8').trim(),
    });
  }

  if (arm === 'A') {
    return invokeModel(model, agentPrompt, runDir, arm, resultsRoot).then(invocation => {
      const result: RunResult = {
        prompt,
        model,
        arm,
        artifactPath,
        stdoutPath: invocation.stdoutPath,
        stderrPath: invocation.stderrPath,
        promptPath: invocation.promptPath,
        status: invocation.status,
        exitCode: invocation.exitCode,
        responseText: invocation.responseText,
        ...(invocation.errorSummary ? { errorSummary: invocation.errorSummary } : {}),
      };
      writeArtifact(result, agentPrompt);
      return result;
    });
  }

  return (async () => {
    const draftPrompt = buildArmPrompt(prompt, 'A');
    const draft = await invokeModel(
      model,
      draftPrompt,
      runDir,
      `${arm}.draft`,
      resultsRoot,
    );

    const domainGatePrompt = buildDomainRouterPrompt(prompt);
    const domainGateInvocation = await invokeModel(
      model,
      domainGatePrompt,
      runDir,
      `${arm}.domain_gate`,
      resultsRoot,
    );
    const domainGateDecision = parseDomainGateDecision(
      domainGateInvocation.responseText,
    );

    const bypassedByDomain = domainGateDecision.bypassCt;

    const premiseGatePrompt = buildPremiseGatePrompt(prompt, draft.responseText);
    const premiseGateInvocation = bypassedByDomain
      ? null
      : await invokeModel(
          model,
          premiseGatePrompt,
          runDir,
          `${arm}.premise_gate`,
          resultsRoot,
        );
    const premiseGateDecision = premiseGateInvocation
      ? parsePremiseGateDecision(premiseGateInvocation.responseText)
      : {
          premiseRejected: false,
          reason: 'Skipped because the domain router bypassed CT.',
        };

    const finalInvocation =
      bypassedByDomain || premiseGateDecision.premiseRejected
      ? draft
      : await invokeModel(
          model,
          buildCtFromDraftPrompt(prompt, draft.responseText),
          runDir,
          arm,
          resultsRoot,
        );

    if (bypassedByDomain || premiseGateDecision.premiseRejected) {
      writeFileSync(promptPath, draftPrompt, 'utf-8');
      writeFileSync(stdoutPath, readFileSync(draft.stdoutPath, 'utf-8'), 'utf-8');
      writeFileSync(stderrPath, readFileSync(draft.stderrPath, 'utf-8'), 'utf-8');
    }

    const result: RunResult = {
      prompt,
      model,
      arm,
      artifactPath,
      stdoutPath: premiseGateDecision.premiseRejected ? stdoutPath : finalInvocation.stdoutPath,
      stderrPath: premiseGateDecision.premiseRejected ? stderrPath : finalInvocation.stderrPath,
      promptPath: premiseGateDecision.premiseRejected ? promptPath : finalInvocation.promptPath,
      status:
        draft.status === 'completed' &&
        domainGateInvocation.status === 'completed' &&
        (premiseGateInvocation ? premiseGateInvocation.status === 'completed' : true) &&
        finalInvocation.status === 'completed'
          ? 'completed'
          : 'failed',
      exitCode: finalInvocation.exitCode,
      responseText: finalInvocation.responseText,
      draftResponseText: draft.responseText,
      draftPromptPath: draft.promptPath,
      draftStdoutPath: draft.stdoutPath,
      draftStderrPath: draft.stderrPath,
      premiseGate: {
        bypassedCt: premiseGateDecision.premiseRejected,
        premiseRejected: premiseGateDecision.premiseRejected,
        reason: premiseGateDecision.reason,
        rawResponse: premiseGateInvocation?.responseText ?? '',
        promptPath: premiseGateInvocation?.promptPath ?? '',
        stdoutPath: premiseGateInvocation?.stdoutPath ?? '',
        stderrPath: premiseGateInvocation?.stderrPath ?? '',
      },
      domainGate: {
        bypassedCt: bypassedByDomain,
        domain: domainGateDecision.domain,
        reason: domainGateDecision.reason,
        rawResponse: domainGateInvocation.responseText,
        promptPath: domainGateInvocation.promptPath,
        stdoutPath: domainGateInvocation.stdoutPath,
        stderrPath: domainGateInvocation.stderrPath,
      },
      errorSummary:
        draft.errorSummary ??
        domainGateInvocation.errorSummary ??
        premiseGateInvocation?.errorSummary ??
        finalInvocation.errorSummary,
    };

    writeArtifact(
      result,
      bypassedByDomain || premiseGateDecision.premiseRejected
        ? draftPrompt
        : buildCtFromDraftPrompt(prompt, draft.responseText),
    );
    return result;
  })();
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function buildReport(
  results: RunResult[],
  options: CliOptions,
  reportPath: string,
): string {
  const completed = results.filter(r => r.status === 'completed').length;
  const failed = results.length - completed;
  const lines = [
    '# Human And Workplace A/B Matrix',
    '',
    `- Date: ${today}`,
    `- Report path: \`${reportPath}\``,
    `- Prompt file: \`benchmark/duckexperiments/PROMPTS_HUMAN_AND_WORKPLACE.md\``,
    `- Extra prompts: \`${EXTRA_PROMPTS.map(p => p.id).join(', ')}\``,
    `- Models: \`${MODELS.map(m => m.id).join(', ')}\``,
    `- Arms: \`A=no-CT, B=CT-enabled\``,
    `- Selected prompt IDs: \`${options.promptIds ? Array.from(options.promptIds).join(', ') : 'all'}\``,
    `- Selected model IDs: \`${options.modelIds ? Array.from(options.modelIds).join(', ') : 'all'}\``,
      `- Selected arms: \`${options.arms ? Array.from(options.arms).join(', ') : 'A, B'}\``,
      `- Concurrency: \`${options.concurrency}\``,
      `- Run label: \`${options.runLabel ?? 'default'}\``,
      `- Skip existing: \`${options.skipExisting}\``,
      `- Prompt count: \`${new Set(results.map(r => r.prompt.id)).size}\``,
    `- Run count: \`${results.length}\``,
    `- Completed: \`${completed}\``,
    `- Failed: \`${failed}\``,
    '',
    '## Runs',
    '',
  ];

  for (const result of results) {
    lines.push(
      `- \`${result.prompt.id} / ${result.model.id} / ${result.arm}\`: ${result.status} -> [artifact](${result.artifactPath})`,
    );
  }

  return `${lines.join('\n')}\n`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { resultsRoot, reportPath } = getRunPaths(options);
  ensureDir(resultsRoot);
  ensureDir(dirname(reportPath));

  const allPrompts = [
    ...parsePromptPack(readFileSync(promptPackPath, 'utf-8')),
    ...EXTRA_PROMPTS,
  ];
  const promptSpecs = options.promptIds
    ? allPrompts.filter(prompt => options.promptIds?.has(prompt.id))
    : allPrompts;
  const models = options.modelIds
    ? MODELS.filter(model => options.modelIds?.has(model.id))
    : MODELS;
  const arms = options.arms ? Array.from(options.arms) : (['A', 'B'] as Arm[]);

  if (promptSpecs.length === 0) {
    throw new Error('No prompts selected');
  }
  if (models.length === 0) {
    throw new Error('No models selected');
  }
  if (arms.length === 0) {
    throw new Error('No arms selected');
  }

  const jobs = promptSpecs.flatMap(prompt =>
    models.flatMap(model =>
      arms.map(arm => ({ prompt, model, arm })),
    ),
  );

  const results: RunResult[] = [];
  await runWithConcurrency(jobs, options.concurrency, async job => {
    const result = await runOne(job.prompt, job.model, job.arm, resultsRoot, options);
    results.push(result);
  });

  results.sort((a, b) => {
    if (a.prompt.id !== b.prompt.id) return a.prompt.id.localeCompare(b.prompt.id);
    if (a.model.id !== b.model.id) return a.model.id.localeCompare(b.model.id);
    return a.arm.localeCompare(b.arm);
  });

  writeFileSync(reportPath, buildReport(results, options, reportPath), 'utf-8');
  process.stdout.write(`${reportPath}\n`);
}

main().catch(error => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
