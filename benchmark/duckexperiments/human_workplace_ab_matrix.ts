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

  if (result.errorSummary) {
    content.push('## Error');
    content.push('');
    content.push(fenced(result.errorSummary, 'text'));
    content.push('');
  }

  writeFileSync(result.artifactPath, `${content.join('\n')}\n`, 'utf-8');
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

  writeFileSync(promptPath, agentPrompt, 'utf-8');

  const cli = buildCommand(model, agentPrompt, resultsRoot);

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
      const result: RunResult = {
        prompt,
        model,
        arm,
        artifactPath,
        stdoutPath,
        stderrPath,
        promptPath,
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
      };
      writeArtifact(result, agentPrompt);
      resolveRun(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      stderr += `${stderr ? '\n' : ''}Timed out after ${TIMEOUT_MS}ms`;
      try {
        child.kill('SIGKILL');
      } catch {
        // Ignore kill errors — finalize below.
      }
      timeoutFinalize = setTimeout(() => {
        finalize(null);
      }, 1000);
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
