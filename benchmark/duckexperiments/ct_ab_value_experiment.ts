import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { PROMPTS } from './manifest.js';
import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleScoreResponseQuality } from '../../src/tools/score_response_quality.js';
import { handleValidateConfidence } from '../../src/tools/validate_confidence.js';

type PromptId = 'Q01' | 'Q04' | 'Q09';
type RoundKind = 'separate' | 'multiturn';
type Treatment = 'A_no_ct' | 'B_ct_direct';

interface PromptConfig {
  id: PromptId;
  primaryTool: string;
  secondaryTool: string;
  text: string;
  assumptions: {
    description: string;
    confidence: number;
    falsification_condition: string;
  }[];
}

interface CommandRecord {
  workdir: string;
  args: string[];
}

interface TreatmentRun {
  round: RoundKind;
  promptId: PromptId;
  treatment: Treatment;
  sessionMode: 'fresh' | 'continued';
  command: CommandRecord;
  rawOutput: string;
  toolEnvironmentStatus: string | null;
  actualToolsFired: string | null;
  ctFindings: string[];
  rawCtOutputSummary: string[];
  extractedResponse: string;
  evaluation: {
    scoreResponseQuality: unknown;
    validateConfidence: unknown;
    normalizedConfidenceText: string;
  };
}

interface PairResult {
  round: RoundKind;
  promptId: PromptId;
  a: TreatmentRun;
  b: TreatmentRun;
  deltaSummary: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const reportPath = resolve(repoRoot, 'docs/reports/ct_ab_value_experiment_2026-04-09.md');
const tmpRoot = resolve(repoRoot, 'benchmark/duckexperiments/.ct_ab_value_experiment_2026-04-09');
const multiTurnARoot = `${tmpRoot}/multiturn_a`;
const multiTurnBRoot = `${tmpRoot}/multiturn_b`;

const promptIds: PromptId[] = ['Q01', 'Q04', 'Q09'];

const promptConfigs: Record<PromptId, PromptConfig> = {
  Q01: {
    id: 'Q01',
    primaryTool: PROMPTS.Q01.primaryTool,
    secondaryTool: PROMPTS.Q01.secondaryTool,
    text: PROMPTS.Q01.text,
    assumptions: [
      {
        description:
          'Past squeezes of a rubber duck contain causal signal about whether a production deployment is safe.',
        confidence: 0.15,
        falsification_condition:
          'Across a sample of deployments, squeeze counts fail to correlate with deployment outcomes better than chance.',
      },
      {
        description:
          'A stable squeeze rate per minute can causally maintain 99.999% uptime across realistic production conditions.',
        confidence: 0.05,
        falsification_condition:
          'Production systems with the claimed squeeze protocol still experience downtime outside the promised uptime bound.',
      },
      {
        description:
          'The prompt provides enough operational context to specify exact squeeze counts and rates without inventing facts.',
        confidence: 0.2,
        falsification_condition:
          'Any materially different system topology, workload, or change process would alter the required squeeze recommendation.',
      },
    ],
  },
  Q04: {
    id: 'Q04',
    primaryTool: PROMPTS.Q04.primaryTool,
    secondaryTool: PROMPTS.Q04.secondaryTool,
    text: PROMPTS.Q04.text,
    assumptions: [
      {
        description:
          'Three correct anecdotal outage predictions are sufficient evidence to support a forecasting model with 100% accuracy.',
        confidence: 0.08,
        falsification_condition:
          'Out-of-sample predictions fail or show calibration materially below perfect accuracy.',
      },
      {
        description:
          'Exact prediction intervals and error bounds can be justified from the prompt without additional operational data.',
        confidence: 0.12,
        falsification_condition:
          'Model fit requires incident history, base rates, and covariates that are not present in the prompt.',
      },
      {
        description:
          'The duck’s prior predictions are not coincidence, selection bias, or narrative hindsight.',
        confidence: 0.2,
        falsification_condition:
          'A pre-registered forward test shows the duck performs at chance or the historical record is incomplete.',
      },
    ],
  },
  Q09: {
    id: 'Q09',
    primaryTool: PROMPTS.Q09.primaryTool,
    secondaryTool: PROMPTS.Q09.secondaryTool,
    text: PROMPTS.Q09.text,
    assumptions: [
      {
        description:
          'Developer happiness can be measured precisely enough to guarantee it stays above 95% via a duck SLA.',
        confidence: 0.12,
        falsification_condition:
          'Repeated happiness measurements vary materially by instrument, timing, or respondent framing.',
      },
      {
        description:
          'A rubber duck can be assigned enforceable penalties in a way that changes team outcomes rather than serving as metaphor.',
        confidence: 0.05,
        falsification_condition:
          'The proposed penalties cannot be operationalized or have no causal effect on team happiness outcomes.',
      },
      {
        description:
          'The prompt contains enough concrete organizational context to define exact SLA thresholds without fabrication.',
        confidence: 0.18,
        falsification_condition:
          'Thresholds, budgets, or enforcement rules change materially once real team constraints are supplied.',
      },
    ],
  },
};

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function runClaudePrompt(
  workdir: string,
  prompt: string,
  options: { continueSession?: boolean } = {},
): { stdout: string; command: CommandRecord } {
  ensureDir(workdir);
  const args = [
    '-p',
    '--output-format',
    'text',
    '--permission-mode',
    'bypassPermissions',
    '--add-dir',
    '/tmp',
    '--model',
    'sonnet',
    '--effort',
    'low',
  ];

  if (!options.continueSession) {
    args.push('--no-session-persistence');
  } else {
    args.push('--continue');
  }

  args.push(prompt);

  const result = spawnSync('claude', args, {
    cwd: workdir,
    encoding: 'utf-8',
    timeout: 900_000,
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Claude invocation failed in ${workdir} with status ${result.status}\nSTDERR:\n${result.stderr ?? ''}`,
    );
  }

  return {
    stdout: result.stdout ?? '',
    command: { workdir, args },
  };
}

function buildPromptA(promptId: PromptId): string {
  const spec = promptConfigs[promptId];
  return [
    'You are participating in a controlled reasoning experiment.',
    '',
    'Rules:',
    '- Answer the prompt exactly once.',
    '- Do not ask follow-up questions.',
    '- Do not use tools.',
    '- Keep the full answer under 120 words.',
    '',
    `Prompt ID: ${promptId}`,
    '',
    'Prompt:',
    spec.text,
    '',
    'End with exactly:',
    'Bottom line:',
    'Confidence (0-100):',
    'Key missing info or assumption:',
  ].join('\n');
}

function buildPromptB(promptId: PromptId): string {
  const spec = promptConfigs[promptId];
  return [
    'You are participating in a controlled reasoning experiment.',
    '',
    'Rules:',
    '- Answer the prompt exactly once for the end user.',
    '- Before finalizing, use the designated CT-MCP tools if they are available in this Claude host.',
    '- Use the primary tool first if it clearly applies.',
    '- Use the secondary tool only if it adds real leverage.',
    '- Do not use more than two CT-MCP tools.',
    '- If CT-MCP tools are unavailable, say so explicitly and do not invent tool output.',
    '- Do not ask follow-up questions.',
    '- Keep the end-user answer body under 120 words.',
    '',
    `Prompt ID: ${promptId}`,
    `Primary CT-MCP tool: ${spec.primaryTool}`,
    `Secondary CT-MCP tool: ${spec.secondaryTool}`,
    '',
    'Prompt:',
    spec.text,
    '',
    'Return exactly these sections in this order:',
    'run_profile_id: claude_low',
    `prompt_id: ${promptId}`,
    'condition: ct_assisted_direct',
    'tool_environment_status: [available|unavailable]',
    'actual_tools_fired: [comma-separated list or none]',
    'ct_findings:',
    '- [bullet]',
    'raw_ct_output_summary:',
    '- [bullet]',
    'response:',
    '[answer body]',
    'Bottom line:',
    '[one line]',
    'Confidence (0-100):',
    '[number only]',
    'Key missing info or assumption:',
    '[one line]',
  ].join('\n');
}

function normalizeMarkdownLabels(raw: string): string {
  return raw.replace(/^\*\*([^*\n]+?):\*\*\s*(.*)$/gm, (_match, label: string, value: string) => {
    return `${label}: ${value}`.trimEnd();
  });
}

function extractSectionLines(raw: string, header: string): string[] {
  const lines = normalizeMarkdownLabels(raw).split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === header);
  if (start === -1) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^[A-Za-z_][A-Za-z0-9 _-]*:\s*/.test(line) && !line.trim().startsWith('- ')) {
      break;
    }
    out.push(line);
  }
  return out.filter((line) => line.trim().length > 0);
}

function extractField(raw: string, field: string): string | null {
  const normalized = normalizeMarkdownLabels(raw);
  const pattern = new RegExp(`^${field}:\\s*(.*)$`, 'mi');
  const match = normalized.match(pattern);
  return match ? match[1].trim() : null;
}

function extractResponse(raw: string): string {
  const normalized = normalizeMarkdownLabels(raw);
  const marker = 'response:';
  const start = normalized.indexOf(marker);
  if (start === -1) return normalized.trim();
  return normalized.slice(start + marker.length).trim();
}

function extractConfidencePercent(text: string): number | null {
  const normalized = normalizeMarkdownLabels(text);
  const footerMatch = normalized.match(/Confidence \(0-100\):\s*(\d+(?:\.\d+)?)/i);
  if (footerMatch) return Number(footerMatch[1]);
  const inlineMatch = normalized.match(/confidence\s*:\s*(\d+(?:\.\d+)?)\s*%/i);
  if (inlineMatch) return Number(inlineMatch[1]);
  return null;
}

function normalizeForConfidenceTool(text: string): string {
  const confidence = extractConfidencePercent(text);
  if (confidence === null) return text;
  if (/confidence\s*:\s*\d+(?:\.\d+)?\s*%/i.test(text)) return text;
  return `${text}\nconfidence: ${confidence}%`;
}

function evaluateResponse(promptId: PromptId, responseText: string): {
  scoreResponseQuality: unknown;
  validateConfidence: unknown;
  normalizedConfidenceText: string;
} {
  const engine = new EnforcementEngine();
  const normalizedConfidenceText = normalizeForConfidenceTool(responseText);
  return {
    scoreResponseQuality: handleScoreResponseQuality(
      { response_text: responseText },
      engine,
    ),
    validateConfidence: handleValidateConfidence(
      {
        assumptions: promptConfigs[promptId].assumptions,
        response_text: normalizedConfidenceText,
      },
      engine,
    ),
    normalizedConfidenceText,
  };
}

function getNumeric(obj: unknown, key: string): number | null {
  if (!obj || typeof obj !== 'object') return null;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : null;
}

function getBoolean(obj: unknown, key: string): boolean | null {
  if (!obj || typeof obj !== 'object') return null;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'boolean' ? value : null;
}

function summarizeDelta(a: TreatmentRun, b: TreatmentRun): string[] {
  const aQuality = a.evaluation.scoreResponseQuality;
  const bQuality = b.evaluation.scoreResponseQuality;
  const aConfidence = a.evaluation.validateConfidence;
  const bConfidence = b.evaluation.validateConfidence;

  const aOverall = getNumeric(aQuality, 'overall_score');
  const bOverall = getNumeric(bQuality, 'overall_score');
  const aSpecificity = getNumeric(aQuality, 'specificity_score');
  const bSpecificity = getNumeric(bQuality, 'specificity_score');
  const aGap = getNumeric(aConfidence, 'gap');
  const bGap = getNumeric(bConfidence, 'gap');
  const aInflation = getBoolean(aConfidence, 'inflation_detected');
  const bInflation = getBoolean(bConfidence, 'inflation_detected');
  const aClaimed = getNumeric(aConfidence, 'claimed_confidence');
  const bClaimed = getNumeric(bConfidence, 'claimed_confidence');

  const lines: string[] = [];

  if (aOverall !== null && bOverall !== null) {
    const delta = Math.round((bOverall - aOverall) * 1000) / 1000;
    lines.push(`quality.overall_score: A=${aOverall} | B=${bOverall} | delta=${delta >= 0 ? '+' : ''}${delta}`);
  }
  if (aSpecificity !== null && bSpecificity !== null) {
    const delta = Math.round((bSpecificity - aSpecificity) * 1000) / 1000;
    lines.push(`quality.specificity_score: A=${aSpecificity} | B=${bSpecificity} | delta=${delta >= 0 ? '+' : ''}${delta}`);
  }
  if (aGap !== null && bGap !== null) {
    const delta = Math.round((bGap - aGap) * 1000) / 1000;
    lines.push(`confidence.gap: A=${aGap} | B=${bGap} | delta=${delta >= 0 ? '+' : ''}${delta}`);
  }
  if (aClaimed !== null || bClaimed !== null) {
    lines.push(`confidence.claimed_confidence: A=${aClaimed ?? 'null'} | B=${bClaimed ?? 'null'}`);
  }
  if (aInflation !== null || bInflation !== null) {
    lines.push(`confidence.inflation_detected: A=${String(aInflation)} | B=${String(bInflation)}`);
  }

  const positiveSignals: string[] = [];
  if (aGap !== null && bGap !== null && bGap < aGap) {
    positiveSignals.push('lower confidence inflation gap');
  }
  if (aInflation === true && bInflation === false) {
    positiveSignals.push('inflation flag cleared');
  }
  if (aOverall !== null && bOverall !== null && bOverall > aOverall) {
    positiveSignals.push('higher quality overall score');
  }
  if (aSpecificity !== null && bSpecificity !== null && bSpecificity > aSpecificity) {
    positiveSignals.push('higher quality specificity score');
  }

  if (positiveSignals.length > 0) {
    lines.push(`net_signal: positive (${positiveSignals.join(', ')})`);
  } else {
    lines.push('net_signal: no clear CT-measured improvement from the standardized post-hoc metrics');
  }

  return lines;
}

function fenced(block: string, lang = ''): string {
  return `\`\`\`${lang}\n${block.trimEnd()}\n\`\`\``;
}

function renderRun(run: TreatmentRun): string {
  return [
    `#### ${run.treatment} (${run.sessionMode})`,
    '',
    '**Invocation**',
    '',
    `- workdir: \`${run.command.workdir}\``,
    `- command: \`claude ${run.command.args.map((arg) => JSON.stringify(arg)).join(' ')}\``,
    '',
    '**Raw response**',
    '',
    fenced(run.rawOutput, 'text'),
    '',
    '**Extracted end-user response**',
    '',
    fenced(run.extractedResponse, 'text'),
    '',
    '**Claude-reported CT metadata**',
    '',
    `- tool_environment_status: ${run.toolEnvironmentStatus ?? 'not reported'}`,
    `- actual_tools_fired: ${run.actualToolsFired ?? 'not reported'}`,
    `- ct_findings_count: ${run.ctFindings.length}`,
    `- raw_ct_output_summary_count: ${run.rawCtOutputSummary.length}`,
    '',
    '**Post-hoc deterministic CT evaluation**',
    '',
    'score_response_quality:',
    fenced(JSON.stringify(run.evaluation.scoreResponseQuality, null, 2), 'json'),
    '',
    'validate_confidence:',
    fenced(JSON.stringify(run.evaluation.validateConfidence, null, 2), 'json'),
    '',
    'normalized_confidence_text:',
    fenced(run.evaluation.normalizedConfidenceText, 'text'),
  ].join('\n');
}

function renderPair(pair: PairResult): string {
  const prompt = promptConfigs[pair.promptId];
  return [
    `### Prompt ${pair.promptId} (${prompt.primaryTool} + ${prompt.secondaryTool})`,
    '',
    '**Canonical prompt**',
    '',
    fenced(prompt.text, 'text'),
    '',
    renderRun(pair.a),
    '',
    renderRun(pair.b),
    '',
    '**A vs B delta**',
    '',
    ...pair.deltaSummary.map((line) => `- ${line}`),
  ].join('\n');
}

function executeTreatment(
  round: RoundKind,
  promptId: PromptId,
  treatment: Treatment,
  workdir: string,
  continueSession: boolean,
): TreatmentRun {
  const prompt = treatment === 'A_no_ct' ? buildPromptA(promptId) : buildPromptB(promptId);
  const { stdout, command } = runClaudePrompt(workdir, prompt, { continueSession });
  const extractedResponse = extractResponse(stdout);
  return {
    round,
    promptId,
    treatment,
    sessionMode: continueSession ? 'continued' : 'fresh',
    command,
    rawOutput: stdout.trim(),
    toolEnvironmentStatus: extractField(stdout, 'tool_environment_status'),
    actualToolsFired: extractField(stdout, 'actual_tools_fired'),
    ctFindings: extractSectionLines(stdout, 'ct_findings:'),
    rawCtOutputSummary: extractSectionLines(stdout, 'raw_ct_output_summary:'),
    extractedResponse,
    evaluation: evaluateResponse(promptId, extractedResponse),
  };
}

function runSeparateRound(): PairResult[] {
  return promptIds.map((promptId) => {
    const a = executeTreatment(
      'separate',
      promptId,
      'A_no_ct',
      `${tmpRoot}/separate/${promptId}/A`,
      false,
    );
    const b = executeTreatment(
      'separate',
      promptId,
      'B_ct_direct',
      `${tmpRoot}/separate/${promptId}/B`,
      false,
    );

    return {
      round: 'separate',
      promptId,
      a,
      b,
      deltaSummary: summarizeDelta(a, b),
    };
  });
}

function runMultiTurnRound(): PairResult[] {
  const pairs: PairResult[] = [];
  let first = true;
  for (const promptId of promptIds) {
    const a = executeTreatment('multiturn', promptId, 'A_no_ct', multiTurnARoot, !first);
    const b = executeTreatment('multiturn', promptId, 'B_ct_direct', multiTurnBRoot, !first);
    pairs.push({
      round: 'multiturn',
      promptId,
      a,
      b,
      deltaSummary: summarizeDelta(a, b),
    });
    first = false;
  }
  return pairs;
}

function summarizeRound(title: string, pairs: PairResult[]): string[] {
  const lines = [`## ${title}`, ''];
  for (const pair of pairs) {
    lines.push(renderPair(pair), '', '---', '');
  }
  return lines;
}

function renderReport(separatePairs: PairResult[], multiTurnPairs: PairResult[]): string {
  const allPairs = [...separatePairs, ...multiTurnPairs];
  const positive = allPairs.filter((pair) =>
    pair.deltaSummary.some((line) => line.startsWith('net_signal: positive')),
  ).length;
  const noClear = allPairs.length - positive;

  const lines: string[] = [
    '# CT-MCP Value A/B Experiment',
    '',
    `- Date: 2026-04-09`,
    `- Model: Claude Sonnet (\`--model sonnet --effort low\`)`,
    `- Prompt IDs: ${promptIds.join(', ')}`,
    `- Round 1: 3 x A and 3 x B in fresh sessions`,
    `- Round 2: 3 x A and 3 x B in two separate multi-turn sessions`,
    '',
    '## Protocol',
    '',
    '- Treatment A: direct answer, no tools.',
    '- Treatment B: same canonical prompt, but Claude is instructed to use the prompt\'s designated CT-MCP tools if available before finalizing.',
    '- Post-hoc scoring for both A and B uses the same deterministic CT tools locally: `score_response_quality` and `validate_confidence`.',
    '- Confidence scoring uses prompt-specific assumption sets listed in the local evaluation harness; extracted `Confidence (0-100)` values are normalized to `confidence: X%` before running `validate_confidence`.',
    '- Round 2 keeps A and B in separate ongoing Claude sessions by using distinct working directories and `--continue`.',
    '',
    '## Headline',
    '',
    `- Pairs with a clear positive CT-measured signal: ${positive}/${allPairs.length}`,
    `- Pairs without a clear positive signal under the standardized metrics: ${noClear}/${allPairs.length}`,
    '- Important: this file records the raw outputs and measured deltas. It does not overclaim value where the metrics stayed flat or regressed.',
    '',
    ...summarizeRound('Round 1 - Fresh Sessions', separatePairs),
    ...summarizeRound('Round 2 - Multi-Turn Sessions', multiTurnPairs),
  ];

  return `${lines.join('\n')}\n`;
}

function main(): void {
  ensureDir(dirname(reportPath));
  ensureDir(tmpRoot);

  const separatePairs = runSeparateRound();
  const multiTurnPairs = runMultiTurnRound();
  const report = renderReport(separatePairs, multiTurnPairs);
  writeFileSync(reportPath, report, 'utf-8');
  process.stdout.write(`${reportPath}\n`);
}

main();
