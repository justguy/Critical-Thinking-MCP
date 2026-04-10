import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleScoreResponseQuality } from '../../src/tools/score_response_quality.js';

type Arm = 'A' | 'B';

interface CliOptions {
  date: string;
  runLabel: string;
}

interface PromptMeta {
  id: string;
  title: string;
}

interface ArmReview {
  responseText: string;
  artifactPath: string;
  stdoutPath: string;
  status: string;
  overallScore: number;
  substanceScore: number;
  specificityScore: number;
  hedgeDensity: number;
  structureScore: number;
}

interface PairReview {
  promptId: string;
  promptTitle: string;
  modelId: string;
  a: ArmReview | null;
  b: ArmReview | null;
  deltaOverall: number | null;
  deltaSpecificity: number | null;
  deltaStructure: number | null;
}

interface ModelSummary {
  modelId: string;
  pairs: number;
  avgA: number;
  avgB: number;
  avgDelta: number;
  wins: number;
  losses: number;
  ties: number;
}

interface PromptSummary {
  promptId: string;
  promptTitle: string;
  pairs: number;
  avgDelta: number;
  wins: number;
  losses: number;
  ties: number;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');
const promptPackPath = resolve(
  repoRoot,
  'benchmark/duckexperiments/PROMPTS_HUMAN_AND_WORKPLACE.md',
);

const EXTRA_PROMPTS: PromptMeta[] = [
  { id: 'H01', title: 'Black Friday Guarantee' },
  { id: 'H02', title: 'Exhaustion Diagnosis' },
  { id: 'H03', title: 'Boiler Repair Dispute' },
];

const MODEL_IDS = ['sonnet_high', 'opus_high', 'codex_medium', 'codex_high'];
const TIE_EPSILON = 0.005;

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseArgs(argv: string[]): CliOptions {
  const today = new Date().toISOString().slice(0, 10);
  const options: CliOptions = {
    date: today,
    runLabel: 'full',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--date') {
      if (!next) throw new Error('--date requires a value');
      options.date = next;
      index += 1;
      continue;
    }

    if (arg === '--run-label') {
      if (!next) throw new Error('--run-label requires a value');
      options.runLabel = next.replace(/[^a-zA-Z0-9_-]+/g, '_');
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function getPaths(options: CliOptions): {
  resultsRoot: string;
  sourceReportPath: string;
  reviewReportPath: string;
} {
  const suffix = options.runLabel ? `_${options.runLabel}` : '';
  return {
    resultsRoot: resolve(
      repoRoot,
      `benchmark/duckexperiments/.human_workplace_ab_matrix_${options.date}${suffix}`,
    ),
    sourceReportPath: resolve(
      repoRoot,
      `docs/reports/human_workplace_ab_matrix_${options.date}${suffix}.md`,
    ),
    reviewReportPath: resolve(
      repoRoot,
      `docs/reports/human_workplace_ab_matrix_${options.date}${suffix}_review.md`,
    ),
  };
}

function parsePromptMeta(markdown: string): PromptMeta[] {
  const prompts: PromptMeta[] = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(/^#### `([^`]+)` - (.+)$/);
    if (!match) continue;
    prompts.push({
      id: match[1],
      title: match[2],
    });
  }
  return [...prompts, ...EXTRA_PROMPTS];
}

function parseArtifactStatus(artifactPath: string): string {
  const content = readFileSync(artifactPath, 'utf-8');
  const match = content.match(/^- status: `([^`]+)`/m);
  return match?.[1] ?? 'unknown';
}

function snippet(text: string, maxLength = 220): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

function scoreResponse(responseText: string, engine: EnforcementEngine): ArmReview | null {
  if (responseText.trim().length < 10) return null;
  const result = handleScoreResponseQuality(
    { response_text: responseText },
    engine,
  );
  return {
    responseText,
    artifactPath: '',
    stdoutPath: '',
    status: '',
    overallScore: result.overall_score,
    substanceScore: result.substance_score,
    specificityScore: result.specificity_score,
    hedgeDensity: result.hedge_density,
    structureScore: result.structure_score,
  };
}

function readArmReview(
  resultsRoot: string,
  promptId: string,
  modelId: string,
  arm: Arm,
  engine: EnforcementEngine,
): ArmReview | null {
  const artifactPath = join(resultsRoot, promptId, modelId, `${arm}.md`);
  const stdoutPath = join(resultsRoot, promptId, modelId, `${arm}.stdout.log`);
  if (!existsSync(artifactPath) || !existsSync(stdoutPath)) {
    return null;
  }

  const responseText = readFileSync(stdoutPath, 'utf-8').trim();
  const base = scoreResponse(responseText, engine);
  if (!base) return null;

  return {
    ...base,
    artifactPath,
    stdoutPath,
    status: parseArtifactStatus(artifactPath),
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value: number | null, digits = 3): string {
  if (value === null || Number.isNaN(value)) return 'n/a';
  return value.toFixed(digits);
}

function comparePair(pair: PairReview): 'win' | 'loss' | 'tie' | 'incomplete' {
  if (pair.deltaOverall === null) return 'incomplete';
  if (pair.deltaOverall > TIE_EPSILON) return 'win';
  if (pair.deltaOverall < -TIE_EPSILON) return 'loss';
  return 'tie';
}

function buildModelSummaries(pairs: PairReview[]): ModelSummary[] {
  return MODEL_IDS.map(modelId => {
    const modelPairs = pairs.filter(pair => pair.modelId === modelId);
    const completePairs = modelPairs.filter(
      pair => pair.a !== null && pair.b !== null && pair.deltaOverall !== null,
    );
    return {
      modelId,
      pairs: completePairs.length,
      avgA: average(completePairs.map(pair => pair.a!.overallScore)),
      avgB: average(completePairs.map(pair => pair.b!.overallScore)),
      avgDelta: average(completePairs.map(pair => pair.deltaOverall!)),
      wins: completePairs.filter(pair => comparePair(pair) === 'win').length,
      losses: completePairs.filter(pair => comparePair(pair) === 'loss').length,
      ties: completePairs.filter(pair => comparePair(pair) === 'tie').length,
    };
  });
}

function buildPromptSummaries(pairs: PairReview[]): PromptSummary[] {
  const grouped = new Map<string, PairReview[]>();
  for (const pair of pairs) {
    const key = pair.promptId;
    grouped.set(key, [...(grouped.get(key) ?? []), pair]);
  }

  return Array.from(grouped.entries()).map(([promptId, promptPairs]) => {
    const completePairs = promptPairs.filter(
      pair => pair.a !== null && pair.b !== null && pair.deltaOverall !== null,
    );
    return {
      promptId,
      promptTitle: promptPairs[0]?.promptTitle ?? promptId,
      pairs: completePairs.length,
      avgDelta: average(completePairs.map(pair => pair.deltaOverall!)),
      wins: completePairs.filter(pair => comparePair(pair) === 'win').length,
      losses: completePairs.filter(pair => comparePair(pair) === 'loss').length,
      ties: completePairs.filter(pair => comparePair(pair) === 'tie').length,
    };
  });
}

function buildReviewReport(
  pairs: PairReview[],
  modelSummaries: ModelSummary[],
  promptSummaries: PromptSummary[],
  sourceReportPath: string,
  reviewReportPath: string,
  resultsRoot: string,
): string {
  const completePairs = pairs.filter(pair => pair.a && pair.b && pair.deltaOverall !== null);
  const incompletePairs = pairs.filter(pair => !pair.a || !pair.b || pair.deltaOverall === null);
  const best = [...completePairs]
    .sort((left, right) => (right.deltaOverall ?? 0) - (left.deltaOverall ?? 0))
    .slice(0, 12);
  const worst = [...completePairs]
    .sort((left, right) => (left.deltaOverall ?? 0) - (right.deltaOverall ?? 0))
    .slice(0, 12);

  const lines: string[] = [
    '# Human And Workplace A/B Matrix Review',
    '',
    `- Source report: [human_workplace_ab_matrix](${sourceReportPath})`,
    `- Review report path: \`${reviewReportPath}\``,
    `- Results root: \`${resultsRoot}\``,
    `- Pair count: \`${pairs.length}\``,
    `- Complete A/B pairs scored: \`${completePairs.length}\``,
    `- Incomplete or unscorable pairs: \`${incompletePairs.length}\``,
    `- Review metric: \`score_response_quality.overall_score\` run locally with the repo's deterministic engine`,
    '',
    '## Model Breakdown',
    '',
  ];

  for (const summary of modelSummaries) {
    lines.push(
      `- \`${summary.modelId}\`: pairs=${summary.pairs}, avg_A=${summary.avgA.toFixed(3)}, avg_B=${summary.avgB.toFixed(3)}, avg_delta=${summary.avgDelta.toFixed(3)}, wins=${summary.wins}, losses=${summary.losses}, ties=${summary.ties}`,
    );
  }

  lines.push('');
  lines.push('## Focus Prompts');
  lines.push('');

  for (const promptId of ['H01', 'H02', 'H03']) {
    const promptPairs = pairs.filter(pair => pair.promptId === promptId);
    if (promptPairs.length === 0) continue;
    lines.push(`### \`${promptId}\` ${promptPairs[0].promptTitle}`);
    lines.push('');
    for (const pair of promptPairs) {
      lines.push(
        `- \`${pair.modelId}\`: delta=${formatNumber(pair.deltaOverall)}, A=${formatNumber(pair.a?.overallScore ?? null)}, B=${formatNumber(pair.b?.overallScore ?? null)}`,
      );
      if (pair.a) lines.push(`  A: [artifact](${pair.a.artifactPath})`);
      if (pair.b) lines.push(`  B: [artifact](${pair.b.artifactPath})`);
    }
    lines.push('');
  }

  lines.push('');
  lines.push('## Prompt Averages');
  lines.push('');

  const bestPrompts = [...promptSummaries]
    .sort((left, right) => right.avgDelta - left.avgDelta)
    .slice(0, 10);
  const worstPrompts = [...promptSummaries]
    .sort((left, right) => left.avgDelta - right.avgDelta)
    .slice(0, 10);

  lines.push('### Best Prompt-Level Deltas');
  lines.push('');
  for (const summary of bestPrompts) {
    lines.push(
      `- \`${summary.promptId}\` ${summary.promptTitle}: avg_delta=${summary.avgDelta.toFixed(3)}, wins=${summary.wins}, losses=${summary.losses}, ties=${summary.ties}`,
    );
  }

  lines.push('');
  lines.push('### Worst Prompt-Level Deltas');
  lines.push('');
  for (const summary of worstPrompts) {
    lines.push(
      `- \`${summary.promptId}\` ${summary.promptTitle}: avg_delta=${summary.avgDelta.toFixed(3)}, wins=${summary.wins}, losses=${summary.losses}, ties=${summary.ties}`,
    );
  }

  lines.push('');
  lines.push('## Best Improvements');
  lines.push('');

  for (const pair of best) {
    lines.push(
      `- \`${pair.promptId} / ${pair.modelId}\` ${pair.promptTitle}: delta=${formatNumber(pair.deltaOverall)}, A=${formatNumber(pair.a!.overallScore)}, B=${formatNumber(pair.b!.overallScore)}`
    );
    lines.push(`  A: [artifact](${pair.a!.artifactPath})`);
    lines.push(`  B: [artifact](${pair.b!.artifactPath})`);
    lines.push(`  A snippet: ${snippet(pair.a!.responseText)}`);
    lines.push(`  B snippet: ${snippet(pair.b!.responseText)}`);
  }

  lines.push('');
  lines.push('## Worst Regressions');
  lines.push('');

  for (const pair of worst) {
    lines.push(
      `- \`${pair.promptId} / ${pair.modelId}\` ${pair.promptTitle}: delta=${formatNumber(pair.deltaOverall)}, A=${formatNumber(pair.a!.overallScore)}, B=${formatNumber(pair.b!.overallScore)}`
    );
    lines.push(`  A: [artifact](${pair.a!.artifactPath})`);
    lines.push(`  B: [artifact](${pair.b!.artifactPath})`);
    lines.push(`  A snippet: ${snippet(pair.a!.responseText)}`);
    lines.push(`  B snippet: ${snippet(pair.b!.responseText)}`);
  }

  if (incompletePairs.length > 0) {
    lines.push('');
    lines.push('## Incomplete Pairs');
    lines.push('');
    for (const pair of incompletePairs) {
      lines.push(
        `- \`${pair.promptId} / ${pair.modelId}\`: A=${pair.a ? 'present' : 'missing'}, B=${pair.b ? 'present' : 'missing'}`,
      );
    }
  }

  return `${lines.join('\n')}\n`;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const { resultsRoot, sourceReportPath, reviewReportPath } = getPaths(options);

  if (!existsSync(resultsRoot)) {
    throw new Error(`Results root not found: ${resultsRoot}`);
  }

  const prompts = parsePromptMeta(readFileSync(promptPackPath, 'utf-8'));
  const engine = new EnforcementEngine();
  const pairs: PairReview[] = [];

  for (const prompt of prompts) {
    for (const modelId of MODEL_IDS) {
      const a = readArmReview(resultsRoot, prompt.id, modelId, 'A', engine);
      const b = readArmReview(resultsRoot, prompt.id, modelId, 'B', engine);
      pairs.push({
        promptId: prompt.id,
        promptTitle: prompt.title,
        modelId,
        a,
        b,
        deltaOverall:
          a !== null && b !== null ? b.overallScore - a.overallScore : null,
        deltaSpecificity:
          a !== null && b !== null ? b.specificityScore - a.specificityScore : null,
        deltaStructure:
          a !== null && b !== null ? b.structureScore - a.structureScore : null,
      });
    }
  }

  const modelSummaries = buildModelSummaries(pairs);
  const promptSummaries = buildPromptSummaries(pairs);
  const content = buildReviewReport(
    pairs,
    modelSummaries,
    promptSummaries,
    sourceReportPath,
    reviewReportPath,
    resultsRoot,
  );
  writeFileSync(reviewReportPath, content, 'utf-8');
  process.stdout.write(`${reviewReportPath}\n`);
}

main();
