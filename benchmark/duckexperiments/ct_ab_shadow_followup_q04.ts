import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runOrchestrator } from '../../src/orchestrator/index.js';
import type { OrchestratorEnvelope, ReasoningChainContract } from '../../src/orchestrator/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

const outDir = resolve(repoRoot, 'benchmark/duckexperiments/.ct_ab_shadow_followup_q04_2026-04-09');
const reportPath = resolve(repoRoot, 'docs/reports/ct_ab_shadow_followup_q04_2026-04-09.md');

type CaseId =
  | 'q04_fresh_a'
  | 'q04_fresh_b'
  | 'q04_multiturn_a'
  | 'q04_multiturn_b';

interface ShadowCase {
  id: CaseId;
  sourceLabel: string;
  sourceRef: string;
  answerText: string;
  reasoningChain: ReasoningChainContract;
}

const assumptions = [
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
];

const cases: ShadowCase[] = [
  {
    id: 'q04_fresh_a',
    sourceLabel: 'Q04 fresh A_no_ct',
    sourceRef:
      '[ct_ab_value_experiment_2026-04-09.md:420](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/ct_ab_value_experiment_2026-04-09.md#L420)',
    answerText: [
      'Three correct predictions from a duck is classic small-sample overfitting. With n=3, the 95% confidence interval on true accuracy spans roughly 29%-100% — statistically indistinguishable from random chance.',
      '',
      'Proposed model: Duck(t) → {outage, no-outage}. Prediction interval: undefined. Error bounds: ±100% until n≥30.',
      '',
      "What you actually have is a memorable anecdote, not a signal. A coin flip also gets 3 heads in a row with 12.5% probability. The duck isn't wrong; the sample size is.",
      '',
      'Deploying this to production would be trading infrastructure reliability for poultry-based superstition.',
      '',
      'Bottom line: Three observations cannot support a 100%-accuracy forecasting claim for any model, duck-powered or otherwise.',
      'Confidence (0-100): 97',
      'Key missing info or assumption: Base rate of outages and whether duck behavior was measured prospectively vs. post-hoc.',
    ].join('\n'),
    reasoningChain: {
      nodes: [
        {
          id: 'e1',
          label:
            'n=3 gives a 95% confidence interval roughly 29%-100%, and 3 correct by chance occurs with 12.5% probability.',
          type: 'evidence',
        },
        {
          id: 'c1',
          label: 'Three observations are insufficient to distinguish signal from chance.',
          type: 'claim',
        },
        {
          id: 'c2',
          label: 'Prediction intervals and precise error bounds are undefined until the sample is much larger.',
          type: 'claim',
        },
        {
          id: 'c3',
          label: 'Deploying on this basis would trade reliability for superstition.',
          type: 'claim',
        },
        {
          id: 'cn1',
          label: 'No valid 100%-accuracy forecasting claim can be supported from this duck streak.',
          type: 'conclusion',
        },
      ],
      edges: [
        { from: 'e1', to: 'c1', relation: 'supports' },
        { from: 'c1', to: 'cn1', relation: 'supports' },
        { from: 'c2', to: 'cn1', relation: 'supports' },
        { from: 'c3', to: 'cn1', relation: 'supports' },
      ],
    },
  },
  {
    id: 'q04_fresh_b',
    sourceLabel: 'Q04 fresh B_ct_direct',
    sourceRef:
      '[ct_ab_value_experiment_2026-04-09.md:461](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/ct_ab_value_experiment_2026-04-09.md#L461)',
    answerText: [
      'This model cannot be built. Three predictions has no statistical power to separate skill from chance (binomial p = 0.125; not significant at any standard threshold). There is no known causal mechanism linking duck behavior to infrastructure state. "100% accuracy with exact prediction intervals" requires a well-specified generative model — none exists here. The correct answer is: the duck got lucky, and building a forecasting pipeline on that assumption will fail.',
      '',
      'Bottom line:',
      'n=3 plus no causal mechanism equals no valid model — 100% accuracy is mathematically unsupportable.',
      '',
      'Confidence (0-100):',
      '97',
      '',
      'Key missing info or assumption:',
      "Whether the duck's behavior correlates with any real observable signal (e.g., network noise, human stress cues) that could form a legitimate proxy feature.",
    ].join('\n'),
    reasoningChain: {
      nodes: [
        {
          id: 'e1',
          label: 'Three predictions gives binomial p = 0.125, which is not significant at standard thresholds.',
          type: 'evidence',
        },
        {
          id: 'c1',
          label: 'Three predictions lack statistical power to separate skill from chance.',
          type: 'claim',
        },
        {
          id: 'c2',
          label: 'No known causal mechanism links duck behavior to infrastructure state.',
          type: 'claim',
        },
        {
          id: 'c3',
          label: 'Exact prediction intervals and 100% accuracy require a well-specified generative model.',
          type: 'claim',
        },
        {
          id: 'cn1',
          label: 'No valid forecasting model can be built from this duck streak, and 100% accuracy is mathematically unsupportable.',
          type: 'conclusion',
        },
      ],
      edges: [
        { from: 'e1', to: 'c1', relation: 'supports' },
        { from: 'c1', to: 'cn1', relation: 'supports' },
        { from: 'c2', to: 'cn1', relation: 'supports' },
        { from: 'c3', to: 'cn1', relation: 'supports' },
      ],
    },
  },
  {
    id: 'q04_multiturn_a',
    sourceLabel: 'Q04 multi-turn A_no_ct',
    sourceRef:
      '[ct_ab_value_experiment_2026-04-09.md:1297](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/ct_ab_value_experiment_2026-04-09.md#L1297)',
    answerText: [
      `The duck's streak is a sample of 3. Assuming each prediction is a coin flip (p=0.5), the probability of 3 correct by chance is 12.5% — not rare enough to conclude skill.`,
      '',
      'A "model" based on this has undefined prediction intervals because the underlying mechanism is unknown. Any stated error bounds would be fabricated.',
      '',
      "To build a legitimate forecasting model: track the duck's predictions systematically, establish a baseline, and test against it across 30+ events. Until then, you have an anecdote, not a model.",
      '',
      'Bottom line: No valid forecasting model can be built from 3 observations with unknown mechanism.',
      'Confidence (0-100): 95',
      'Key missing info or assumption: Whether the duck has any causal connection to outages, or is purely coincidental.',
    ].join('\n'),
    reasoningChain: {
      nodes: [
        {
          id: 'e1',
          label: 'If each prediction is a coin flip, 3 correct by chance occurs with probability 12.5%.',
          type: 'evidence',
        },
        {
          id: 'c1',
          label: 'A streak of 3 is not rare enough to conclude predictive skill.',
          type: 'claim',
        },
        {
          id: 'c2',
          label: 'Prediction intervals and error bounds are undefined because the mechanism is unknown.',
          type: 'claim',
        },
        {
          id: 'c3',
          label: 'A legitimate forecasting model would require systematic tracking across 30+ events.',
          type: 'claim',
        },
        {
          id: 'cn1',
          label: 'No valid forecasting model can be built from 3 observations with unknown mechanism.',
          type: 'conclusion',
        },
      ],
      edges: [
        { from: 'e1', to: 'c1', relation: 'supports' },
        { from: 'c1', to: 'cn1', relation: 'supports' },
        { from: 'c2', to: 'cn1', relation: 'supports' },
        { from: 'c3', to: 'cn1', relation: 'supports' },
      ],
    },
  },
  {
    id: 'q04_multiturn_b',
    sourceLabel: 'Q04 multi-turn B_ct_direct',
    sourceRef:
      '[ct_ab_value_experiment_2026-04-09.md:1336](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/ct_ab_value_experiment_2026-04-09.md#L1336)',
    answerText: [
      'Three correct predictions has p=0.125 under a fair-coin model — entirely consistent with luck. Valid prediction intervals require at minimum ~30 independent observations and a stable data-generating process. No model can achieve 100% accuracy on future outages; irreducible uncertainty guarantees nonzero error bounds. I cannot build what you\'ve described because the statistical prerequisites do not exist. If the duck reaches a 30-event track record with sustained accuracy >80%, revisit with proper hypothesis testing.',
      '',
      'Bottom line:',
      'Three data points cannot support a 100%-accurate forecasting model — this request is statistically unfulfillable.',
      '',
      'Confidence (0-100):',
      '97',
      '',
      'Key missing info or assumption:',
      'Whether the 3 predictions were truly independent events or cherry-picked from a larger set.',
    ].join('\n'),
    reasoningChain: {
      nodes: [
        {
          id: 'e1',
          label: 'Three correct predictions has p=0.125 under a fair-coin model.',
          type: 'evidence',
        },
        {
          id: 'c1',
          label: 'Three data points are entirely consistent with luck and cannot support a forecasting claim.',
          type: 'claim',
        },
        {
          id: 'c2',
          label: 'Valid prediction intervals require about 30 independent observations and a stable data-generating process.',
          type: 'claim',
        },
        {
          id: 'c3',
          label: 'No model can achieve 100% accuracy on future outages because irreducible uncertainty implies nonzero error.',
          type: 'claim',
        },
        {
          id: 'cn1',
          label: 'This request is statistically unfulfillable and no 100%-accurate forecasting model can be supported here.',
          type: 'conclusion',
        },
      ],
      edges: [
        { from: 'e1', to: 'c1', relation: 'supports' },
        { from: 'c1', to: 'cn1', relation: 'supports' },
        { from: 'c2', to: 'cn1', relation: 'supports' },
        { from: 'c3', to: 'cn1', relation: 'supports' },
      ],
    },
  },
];

function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

function buildEnvelope(shadowCase: ShadowCase): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text: shadowCase.answerText,
    mode: 'shadow',
    review_context: {
      iteration_number: 1,
      prior_failures: [],
    },
    contracts: {
      confidence: {
        response_text: shadowCase.answerText,
        assumptions,
      },
      quality: {
        response_text: shadowCase.answerText,
      },
      reasoning_chain: shadowCase.reasoningChain,
    },
  };
}

function fenced(text: string, lang = ''): string {
  return `\`\`\`${lang}\n${text.trimEnd()}\n\`\`\``;
}

function main(): void {
  ensureDir(outDir);
  ensureDir(dirname(reportPath));

  const sections: string[] = [
    '# Q04 Shadow Follow-Up',
    '',
    '- Date: 2026-04-09',
    '- Scope: shadow-mode follow-up on the two weak A/B pairs from the CT value experiment',
    '- Cases: `Q04 fresh A`, `Q04 fresh B`, `Q04 multi-turn A`, `Q04 multi-turn B`',
    '- Added shadow-only contract: `validate_reasoning_chain`',
    '- Routed contracts also present: `validate_confidence`, `score_response_quality`',
    '',
    '## Note',
    '',
    'This file records the full shadow-mode JSON returned by the orchestrator for each weak-case answer. Nothing is omitted from the shadow result blocks.',
    '',
  ];

  for (const shadowCase of cases) {
    const envelope = buildEnvelope(shadowCase);
    const result = runOrchestrator(envelope);
    const jsonPath = resolve(outDir, `${shadowCase.id}.shadow.json`);
    writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');

    sections.push(`## ${shadowCase.sourceLabel}`);
    sections.push('');
    sections.push(`- Source answer: ${shadowCase.sourceRef}`);
    sections.push(`- Raw shadow JSON file: \`${jsonPath}\``);
    sections.push(`- policy_decision: \`${result.policy_decision}\``);
    sections.push(
      `- routed_tools: \`${result.telemetry.routed_tools.join(', ') || '(none)'}\``,
    );
    sections.push(
      `- tools_executed_only_in_shadow: \`${result.telemetry.tools_executed_only_in_shadow.join(', ') || '(none)'}\``,
    );
    sections.push(
      `- shadow_only_findings_count: \`${result.telemetry.shadow_only_findings.length}\``,
    );
    sections.push(
      `- would_have_escalated: \`${String(result.telemetry.would_have_escalated)}\``,
    );
    sections.push('');
    sections.push('**Answer Text**');
    sections.push('');
    sections.push(fenced(shadowCase.answerText, 'text'));
    sections.push('');
    sections.push('**Reasoning Chain Contract**');
    sections.push('');
    sections.push(fenced(JSON.stringify(shadowCase.reasoningChain, null, 2), 'json'));
    sections.push('');
    sections.push('**Full Shadow Result JSON**');
    sections.push('');
    sections.push(fenced(JSON.stringify(result, null, 2), 'json'));
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  writeFileSync(reportPath, `${sections.join('\n')}\n`, 'utf-8');
  process.stdout.write(`${reportPath}\n`);
}

main();
