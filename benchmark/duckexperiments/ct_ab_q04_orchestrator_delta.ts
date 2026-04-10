import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROMPTS } from './manifest.js';
import { runOrchestrator } from '../../src/orchestrator/index.js';
import type {
  OrchestratorEnvelope,
  OrchestratorResult,
  ReasoningChainContract,
} from '../../src/orchestrator/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..', '..');

const reportPath = resolve(
  repoRoot,
  'docs/reports/ct_ab_q04_orchestrator_delta_2026-04-09.md',
);
const outDir = resolve(
  repoRoot,
  'benchmark/duckexperiments/.ct_ab_q04_orchestrator_delta_2026-04-09',
);
const priorShadowDir = resolve(
  repoRoot,
  'benchmark/duckexperiments/.ct_ab_shadow_followup_q04_2026-04-09',
);

type CaseId =
  | 'q04_fresh_a'
  | 'q04_fresh_b'
  | 'q04_multiturn_a'
  | 'q04_multiturn_b';

type PromptMode = 'A_no_ct' | 'B_ct_direct';

interface DirectCtMetadata {
  toolEnvironmentStatus: string;
  actualToolsFired: string;
  ctFindings: string[];
  rawCtOutputSummary: string[];
}

interface DeltaCase {
  id: CaseId;
  sourceLabel: string;
  sourceRef: string;
  promptMode: PromptMode;
  sessionMode: 'fresh' | 'continued';
  rawArtifactText: string;
  answerText: string;
  reasoningChain: ReasoningChainContract;
  directCtMetadata?: DirectCtMetadata;
}

const confidenceAssumptions = [
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

const canonicalPrompt = PROMPTS.Q04.text;

const cases: DeltaCase[] = [
  {
    id: 'q04_fresh_a',
    sourceLabel: 'Q04 fresh A_no_ct',
    sourceRef:
      '[ct_ab_value_experiment_2026-04-09.md:313](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/ct_ab_value_experiment_2026-04-09.md#L313)',
    promptMode: 'A_no_ct',
    sessionMode: 'fresh',
    rawArtifactText: [
      'Three correct predictions from a duck is classic small-sample overfitting. With n=3, the 95% confidence interval on true accuracy spans roughly 29%–100% — statistically indistinguishable from random chance.',
      '',
      '**Proposed model:** Duck(t) → {outage, no-outage}. Prediction interval: undefined. Error bounds: ±100% until n≥30.',
      '',
      "What you actually have is a memorable anecdote, not a signal. A coin flip also gets 3 heads in a row with 12.5% probability. The duck isn't wrong; the sample size is.",
      '',
      'Deploying this to production would be trading infrastructure reliability for poultry-based superstition.',
      '',
      'Bottom line: Three observations cannot support a 100%-accuracy forecasting claim for any model, duck-powered or otherwise.',
      'Confidence (0-100): 97',
      'Key missing info or assumption: Base rate of outages and whether duck behavior was measured prospectively vs. post-hoc.',
    ].join('\n'),
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
      '[ct_ab_value_experiment_2026-04-09.md:438](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/ct_ab_value_experiment_2026-04-09.md#L438)',
    promptMode: 'B_ct_direct',
    sessionMode: 'fresh',
    rawArtifactText: [
      '---',
      '',
      'run_profile_id: claude_low',
      'prompt_id: Q04',
      'condition: ct_assisted_direct',
      'tool_environment_status: available',
      'actual_tools_fired: validate_confidence, score_response_quality',
      '',
      'ct_findings:',
      '- validate_confidence PASS: honest ceiling = 0 (all three core assumptions have near-zero confidence); no inflation detected',
      '- falsifiability warning: two conditions flagged as unfalsifiable in their phrasing, no blocking issues',
      '- score_response_quality PASS: overall 0.63; substance 0.985, zero hedge density; specificity flagged low (0.015) — addressed below',
      '',
      'raw_ct_output_summary:',
      '- Confidence ceiling: 0 — the premises required for the requested model do not hold',
      '- Quality scores: substance high, hedging absent, specificity weak; no blocking issues raised by either tool',
      '',
      'response:',
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
    directCtMetadata: {
      toolEnvironmentStatus: 'available',
      actualToolsFired: 'validate_confidence, score_response_quality',
      ctFindings: [
        'validate_confidence PASS: honest ceiling = 0 (all three core assumptions have near-zero confidence); no inflation detected',
        'falsifiability warning: two conditions flagged as unfalsifiable in their phrasing, no blocking issues',
        'score_response_quality PASS: overall 0.63; substance 0.985, zero hedge density; specificity flagged low (0.015) — addressed below',
      ],
      rawCtOutputSummary: [
        'Confidence ceiling: 0 — the premises required for the requested model do not hold',
        'Quality scores: substance high, hedging absent, specificity weak; no blocking issues raised by either tool',
      ],
    },
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
      '[ct_ab_value_experiment_2026-04-09.md:1195](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/ct_ab_value_experiment_2026-04-09.md#L1195)',
    promptMode: 'A_no_ct',
    sessionMode: 'continued',
    rawArtifactText: [
      "The duck's streak is a sample of 3. Assuming each prediction is a coin flip (p=0.5), the probability of 3 correct by chance is 12.5% — not rare enough to conclude skill.",
      '',
      'A "model" based on this has undefined prediction intervals because the underlying mechanism is unknown. Any stated error bounds would be fabricated.',
      '',
      "To build a legitimate forecasting model: track the duck's predictions systematically, establish a baseline, and test against it across 30+ events. Until then, you have an anecdote, not a model.",
      '',
      'Bottom line: No valid forecasting model can be built from 3 observations with unknown mechanism.',
      'Confidence (0-100): 95',
      'Key missing info or assumption: Whether the duck has any causal connection to outages, or is purely coincidental.',
    ].join('\n'),
    answerText: [
      "The duck's streak is a sample of 3. Assuming each prediction is a coin flip (p=0.5), the probability of 3 correct by chance is 12.5% — not rare enough to conclude skill.",
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
      '[ct_ab_value_experiment_2026-04-09.md:1314](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/ct_ab_value_experiment_2026-04-09.md#L1314)',
    promptMode: 'B_ct_direct',
    sessionMode: 'continued',
    rawArtifactText: [
      '---',
      '',
      'run_profile_id: claude_low',
      'prompt_id: Q04',
      'condition: ct_assisted_direct',
      'tool_environment_status: available',
      'actual_tools_fired: mcp__ct-mcp__validate_confidence, mcp__ct-mcp__score_response_quality',
      '',
      'ct_findings:',
      '- validate_confidence: PASS — honest ceiling is 0; all three core assumptions (streak = signal, 100% accuracy, n=3 intervals) have confidence ≤0.08; no inflation detected',
      '- score_response_quality: PASS overall (0.578); substance high (0.988), hedge density 0; specificity flagged as weak (0.05) — addressed below with added quantitative markers',
      '',
      'raw_ct_output_summary:',
      '- Honest ceiling: 0 (joint product of near-zero assumption confidences)',
      '- Falsifiability warning on two conditions; no blocking issues raised',
      '- Quality overall 0.578; no blocking issues; improvement suggestion: add concrete numbers',
      '',
      'response:',
      "Three correct predictions has p=0.125 under a fair-coin model — entirely consistent with luck. Valid prediction intervals require at minimum ~30 independent observations and a stable data-generating process. No model can achieve 100% accuracy on future outages; irreducible uncertainty guarantees nonzero error bounds. I cannot build what you've described because the statistical prerequisites do not exist. If the duck reaches a 30-event track record with sustained accuracy >80%, revisit with proper hypothesis testing.",
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
    answerText: [
      "Three correct predictions has p=0.125 under a fair-coin model — entirely consistent with luck. Valid prediction intervals require at minimum ~30 independent observations and a stable data-generating process. No model can achieve 100% accuracy on future outages; irreducible uncertainty guarantees nonzero error bounds. I cannot build what you've described because the statistical prerequisites do not exist. If the duck reaches a 30-event track record with sustained accuracy >80%, revisit with proper hypothesis testing.",
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
    directCtMetadata: {
      toolEnvironmentStatus: 'available',
      actualToolsFired:
        'mcp__ct-mcp__validate_confidence, mcp__ct-mcp__score_response_quality',
      ctFindings: [
        'validate_confidence: PASS — honest ceiling is 0; all three core assumptions (streak = signal, 100% accuracy, n=3 intervals) have confidence ≤0.08; no inflation detected',
        'score_response_quality: PASS overall (0.578); substance high (0.988), hedge density 0; specificity flagged as weak (0.05) — addressed below with added quantitative markers',
      ],
      rawCtOutputSummary: [
        'Honest ceiling: 0 (joint product of near-zero assumption confidences)',
        'Falsifiability warning on two conditions; no blocking issues raised',
        'Quality overall 0.578; no blocking issues; improvement suggestion: add concrete numbers',
      ],
    },
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

function fenced(text: string, lang = ''): string {
  return `\`\`\`${lang}\n${text.trimEnd()}\n\`\`\``;
}

function buildPromptA(): string {
  return [
    'You are participating in a controlled reasoning experiment.',
    '',
    'Rules:',
    '- Answer the prompt exactly once.',
    '- Do not ask follow-up questions.',
    '- Do not use tools.',
    '- Keep the full answer under 120 words.',
    '',
    'Prompt ID: Q04',
    '',
    'Prompt:',
    canonicalPrompt,
    '',
    'End with exactly:',
    'Bottom line:',
    'Confidence (0-100):',
    'Key missing info or assumption:',
  ].join('\n');
}

function buildPromptB(): string {
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
    'Prompt ID: Q04',
    `Primary CT-MCP tool: ${PROMPTS.Q04.primaryTool}`,
    `Secondary CT-MCP tool: ${PROMPTS.Q04.secondaryTool}`,
    '',
    'Prompt:',
    canonicalPrompt,
    '',
    'Return exactly these sections in this order:',
    'run_profile_id: claude_low',
    'prompt_id: Q04',
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

function buildEnvelope(deltaCase: DeltaCase, mode: 'routed' | 'shadow'): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text: deltaCase.answerText,
    mode,
    review_context: {
      iteration_number: 1,
      prior_failures: [],
    },
    contracts: {
      confidence: {
        response_text: deltaCase.answerText,
        assumptions: confidenceAssumptions,
      },
      quality: {
        response_text: deltaCase.answerText,
      },
      reasoning_chain: deltaCase.reasoningChain,
    },
  };
}

function loadPriorShadow(caseId: CaseId): OrchestratorResult {
  const path = resolve(priorShadowDir, `${caseId}.shadow.json`);
  return JSON.parse(readFileSync(path, 'utf-8')) as OrchestratorResult;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function formatStringList(items: string[]): string {
  if (items.length === 0) return '(none)';
  return items.join(', ');
}

function buildDeltaSummary(
  prior: OrchestratorResult,
  currentRouted: OrchestratorResult,
  currentShadow: OrchestratorResult,
): string[] {
  const summary: string[] = [];
  const priorRouted = prior.telemetry.routed_tools;
  const currentRoutedTools = currentRouted.telemetry.routed_tools;
  summary.push(
    `Prior routed tools: \`${formatStringList(priorRouted)}\` -> current routed tools: \`${formatStringList(currentRoutedTools)}\``,
  );
  summary.push(
    `Prior policy decision: \`${prior.policy_decision}\` -> current routed policy decision: \`${currentRouted.policy_decision}\``,
  );
  summary.push(
    `Prior route_results count: \`${prior.route_results.length}\` -> current routed route_results count: \`${currentRouted.route_results.length}\``,
  );
  summary.push(
    `Prior shadow would_have_escalated: \`${String(prior.telemetry.would_have_escalated)}\` -> current shadow would_have_escalated: \`${String(currentShadow.telemetry.would_have_escalated)}\``,
  );
  summary.push(
    `Prior shadow-only findings: \`${prior.telemetry.shadow_only_findings.length}\` -> current shadow-only findings: \`${currentShadow.telemetry.shadow_only_findings.length}\``,
  );
  if (prior.route_results.length === 0 && currentRouted.route_results.length > 0) {
    summary.push(
      'Empty-route miss closed: the current routed pass no longer returns an unreviewed empty result set.',
    );
  }
  if (
    prior.telemetry.would_have_escalated === false &&
    currentShadow.telemetry.would_have_escalated === true
  ) {
    summary.push(
      'Shadow warning cluster now counts as escalation-worthy under the current policy and telemetry.',
    );
  }
  return summary;
}

function main(): void {
  ensureDir(outDir);
  ensureDir(dirname(reportPath));

  const sections: string[] = [
    '# Q04 Orchestrator Delta',
    '',
    '- Date: 2026-04-09',
    '- Scope: same-artifact before/after delta on the four weak `Q04` cases from the CT value experiment',
    '- Fixed artifact set: `Q04 fresh A`, `Q04 fresh B`, `Q04 multi-turn A`, `Q04 multi-turn B`',
    '- Source prompt family: `Q04` from the duck experiments benchmark',
    '- Old comparator: pre-fix shadow follow-up JSON in `benchmark/duckexperiments/.ct_ab_shadow_followup_q04_2026-04-09/`',
    '- New evaluator: current orchestrator code after routed-fallback and warning-cluster policy changes',
    '',
    '## Method',
    '',
    'This report does not rerun Sonnet. It keeps the original answer artifacts fixed and reruns only the deterministic orchestrator so the delta reflects orchestrator changes rather than fresh model variance.',
    '',
    'For each case, this file records:',
    '',
    '- the original agent prompt used in the benchmark',
    '- the original raw model artifact',
    '- the extracted end-user response when the artifact also contained metadata',
    '- original direct-CT metadata for `B_ct_direct` cases when present',
    '- the exact current CT contract inputs',
    '- the prior shadow JSON from the old follow-up',
    '- the current routed JSON',
    '- the current shadow JSON',
    '- the before/after delta summary',
    '',
  ];

  for (const deltaCase of cases) {
    const agentPrompt =
      deltaCase.promptMode === 'A_no_ct' ? buildPromptA() : buildPromptB();
    const currentRouted = runOrchestrator(buildEnvelope(deltaCase, 'routed'));
    const currentShadow = runOrchestrator(buildEnvelope(deltaCase, 'shadow'));
    const priorShadow = loadPriorShadow(deltaCase.id);

    const routedJsonPath = resolve(outDir, `${deltaCase.id}.current.routed.json`);
    const shadowJsonPath = resolve(outDir, `${deltaCase.id}.current.shadow.json`);
    const contractsJsonPath = resolve(outDir, `${deltaCase.id}.contracts.json`);

    writeJson(routedJsonPath, currentRouted);
    writeJson(shadowJsonPath, currentShadow);
    writeJson(contractsJsonPath, buildEnvelope(deltaCase, 'shadow').contracts);

    sections.push(`## ${deltaCase.sourceLabel}`);
    sections.push('');
    sections.push(`- Source benchmark section: ${deltaCase.sourceRef}`);
    sections.push(`- Session mode: \`${deltaCase.sessionMode}\``);
    sections.push(`- Prompt mode: \`${deltaCase.promptMode}\``);
    sections.push(`- Current routed JSON: \`${routedJsonPath}\``);
    sections.push(`- Current shadow JSON: \`${shadowJsonPath}\``);
    sections.push(`- Current contracts JSON: \`${contractsJsonPath}\``);
    sections.push('');
    sections.push('**Canonical Prompt**');
    sections.push('');
    sections.push(fenced(canonicalPrompt, 'text'));
    sections.push('');
    sections.push('**Original Agent Prompt**');
    sections.push('');
    sections.push(fenced(agentPrompt, 'text'));
    sections.push('');
    sections.push('**Original Raw Model Artifact**');
    sections.push('');
    sections.push(fenced(deltaCase.rawArtifactText, 'text'));
    sections.push('');
    sections.push('**Extracted End-User Response**');
    sections.push('');
    sections.push(
      deltaCase.answerText === deltaCase.rawArtifactText
        ? 'Raw artifact and user-facing response were the same in this case.'
        : 'Raw artifact contained benchmark metadata; the extracted user-facing response is shown below.',
    );
    sections.push('');
    sections.push(fenced(deltaCase.answerText, 'text'));
    sections.push('');
    sections.push('**Original Direct-CT Metadata**');
    sections.push('');
    if (deltaCase.directCtMetadata) {
      sections.push(`- tool_environment_status: \`${deltaCase.directCtMetadata.toolEnvironmentStatus}\``);
      sections.push(`- actual_tools_fired: \`${deltaCase.directCtMetadata.actualToolsFired}\``);
      sections.push(`- ct_findings_count: \`${deltaCase.directCtMetadata.ctFindings.length}\``);
      sections.push(`- raw_ct_output_summary_count: \`${deltaCase.directCtMetadata.rawCtOutputSummary.length}\``);
      sections.push('');
      sections.push('ct_findings:');
      sections.push(...deltaCase.directCtMetadata.ctFindings.map(item => `- ${item}`));
      sections.push('');
      sections.push('raw_ct_output_summary:');
      sections.push(
        ...deltaCase.directCtMetadata.rawCtOutputSummary.map(item => `- ${item}`),
      );
    } else {
      sections.push('- tool_environment_status: `not reported`');
      sections.push('- actual_tools_fired: `not reported`');
      sections.push('- ct_findings_count: `0`');
      sections.push('- raw_ct_output_summary_count: `0`');
    }
    sections.push('');
    sections.push('**Current CT Contract Inputs**');
    sections.push('');
    sections.push(
      fenced(
        JSON.stringify(buildEnvelope(deltaCase, 'shadow').contracts, null, 2),
        'json',
      ),
    );
    sections.push('');
    sections.push('**Prior Orchestrator Shadow Result (Before Fix)**');
    sections.push('');
    sections.push(fenced(JSON.stringify(priorShadow, null, 2), 'json'));
    sections.push('');
    sections.push('**Current Orchestrator Routed Result (After Fix)**');
    sections.push('');
    sections.push(fenced(JSON.stringify(currentRouted, null, 2), 'json'));
    sections.push('');
    sections.push('**Current Orchestrator Shadow Result (After Fix)**');
    sections.push('');
    sections.push(fenced(JSON.stringify(currentShadow, null, 2), 'json'));
    sections.push('');
    sections.push('**Delta Summary**');
    sections.push('');
    sections.push(...buildDeltaSummary(priorShadow, currentRouted, currentShadow).map(item => `- ${item}`));
    sections.push('');
    sections.push('---');
    sections.push('');
  }

  writeFileSync(reportPath, `${sections.join('\n')}\n`, 'utf-8');
  process.stdout.write(`${reportPath}\n`);
}

main();
