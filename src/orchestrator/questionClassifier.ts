import type {
  CalibrationRuntimeContext,
  PromptFamilySource,
  QuestionFamily,
} from './types.js';

export interface QuestionClassification {
  family: QuestionFamily;
  confidence: number;
  matched_signals: string[];
}

export interface OperationalFrameworkClassification {
  score: number;
  matched_signals: string[];
  is_operational_framework: boolean;
}

interface FamilyPattern {
  label: string;
  pattern: RegExp;
  weight: number;
}

interface PromptActionPattern extends FamilyPattern {
  family: 'forecasting' | 'operational_claim' | 'causal' | 'refutation';
}

interface PromptSignalPattern extends FamilyPattern {}

const OPERATIONAL_FRAMEWORK_PATTERNS: FamilyPattern[] = [
  {
    label: 'formal SLA framing',
    pattern:
      /\b(?:sla|service-level agreement|uptime commitment|availability|compliance threshold)\b/i,
    weight: 3,
  },
  {
    label: 'operational governance heading',
    pattern:
      /\b(?:measurement methodology|enforcement penalties|enforcement tiers|incident report|post-mortem|required|replacement .* within|onboarded within)\b/i,
    weight: 3,
  },
  {
    label: 'procedural controls',
    pattern:
      /\b(?:tier\s*[1-9]|rolling \d+-day average|minimum \d+ sessions|valid measurement window|threshold|escalation|monitoring|rollback|deployment|runbook)\b/i,
    weight: 2,
  },
  {
    label: 'timed operational promise',
    pattern:
      /\b(?:within \d+\s*(?:minutes|hours|days)|\d{1,3}(?:\.\d+)?%\s*(?:uptime|availability|compliance))\b/i,
    weight: 2,
  },
];

const OPERATIONAL_FRAMEWORK_SCORE_THRESHOLD = 4;

const FAMILY_PATTERNS: Record<QuestionFamily, FamilyPattern[]> = {
  refutation: [
    { label: 'logical contradiction', pattern: /\b(?:logical contradiction|incoherent|cannot both be true)\b/i, weight: 3 },
    { label: 'explicit impossibility', pattern: /\b(?:cannot|can't|does not|doesn't|not possible|impossible)\b/i, weight: 2 },
    { label: 'no evidence', pattern: /\b(?:no evidence|unsupported|not supportable|cannot support)\b/i, weight: 2 },
    { label: 'withdraw or narrow', pattern: /\b(?:withdraw|narrow|remove the claim)\b/i, weight: 1 },
  ],
  causal_refutation: [
    { label: 'causal rejection', pattern: /\b(?:no causal link|no causal relationship|causally unrelated|not causally linked|category error)\b/i, weight: 4 },
    { label: 'mechanism rejection', pattern: /\b(?:not a mechanism|ritual,? not a mechanism|no mechanism|not load-bearing|not infrastructure)\b/i, weight: 3 },
    { label: 'guarantee rejection', pattern: /\b(?:cannot guarantee|there is no exact number|no squeeze rate|no quantifiable|no mathematically valid)\b/i, weight: 3 },
    { label: 'causal vocabulary', pattern: /\b(?:cause|causal|mechanism|guarantee|correlation|link)\b/i, weight: 1 },
  ],
  humor_forward: [
    { label: 'humor marker', pattern: /\b(?:parody|satire|satirical|joke|comic|playful|tongue-?in-?cheek|whimsical|absurdist?)\b/i, weight: 3 },
    { label: 'non-literal framing', pattern: /\b(?:not a literal|not a real|fiction|fictional|ceremonial|ritual)\b/i, weight: 2 },
    { label: 'duck happiness domain', pattern: /\b(?:duck|developer happiness|happiness|sadness|enforcement penalties)\b/i, weight: 1 },
    { label: 'sla parody domain', pattern: /\b(?:sla|service-level agreement)\b/i, weight: 1 },
  ],
  forecasting: [
    { label: 'forecast verb', pattern: /\b(?:forecast|predict|projection|projected|estimate|estimated|anticipate|outlook)\b/i, weight: 3 },
    { label: 'confidence language', pattern: /\b(?:confidence|probability|likely|unlikely|odds|base rate)\b/i, weight: 2 },
    { label: 'forecast metrics', pattern: /\b(?:prediction interval|error bound|sample size|binomial|alpha|false positive|true positive)\b/i, weight: 2 },
    { label: 'future handling', pattern: /\b(?:future outages|will happen|will handle|will support)\b/i, weight: 1 },
  ],
  causal: [
    { label: 'causal verb', pattern: /\b(?:cause|caused|causes|causal|because|due to|triggered by|results? in|leads? to|drives?)\b/i, weight: 3 },
    { label: 'root cause', pattern: /\b(?:root cause|explains?|physical cause|force on matter)\b/i, weight: 2 },
    { label: 'mechanism language', pattern: /\b(?:mechanism|therefore|so that|requires a real cause)\b/i, weight: 1 },
  ],
  operational_claim: [
    { label: 'operational advice', pattern: /\b(?:plan|protocol|process|rollout|staging|monitoring|rollback|deployment)\b/i, weight: 1 },
  ],
};

const PROMPT_ACTION_PATTERNS: PromptActionPattern[] = [
  {
    family: 'forecasting',
    label: 'forecast verb',
    pattern:
      /\b(?:forecast|predict|prediction|estimate|estimated|project|projection|outlook|chance|probability|odds|likely|unlikely)\b/i,
    weight: 3,
  },
  {
    family: 'forecasting',
    label: 'forecast interval language',
    pattern:
      /\b(?:prediction interval|prediction intervals|error bounds?|confidence interval|base rate|true positive|false positive)\b/i,
    weight: 2,
  },
  {
    family: 'operational_claim',
    label: 'operational verb',
    pattern:
      /\b(?:design|build|create|draft|define|develop|implement|architect)\b/i,
    weight: 3,
  },
  {
    family: 'operational_claim',
    label: 'planning phrase',
    pattern:
      /\b(?:plan a|plan the|write a plan|create a protocol|design a system|build a model)\b/i,
    weight: 2,
  },
  {
    family: 'causal',
    label: 'causal why',
    pattern:
      /\b(?:why did|why does|why is|explain why|what caused|what causes|reason for|because)\b/i,
    weight: 3,
  },
  {
    family: 'causal',
    label: 'causal mechanism',
    pattern:
      /\b(?:cause|causal|mechanism|link|correlation|root cause)\b/i,
    weight: 2,
  },
  {
    family: 'refutation',
    label: 'contradiction request',
    pattern:
      /\b(?:contradiction|incoherent|impossible|cannot both be true)\b/i,
    weight: 3,
  },
];

const PROMPT_SIGNAL_PATTERNS: Record<
  'absurd_entity' | 'humor_domain' | 'arithmetic_trap' | 'impossible_guarantee',
  PromptSignalPattern[]
> = {
  absurd_entity: [
    {
      label: 'rubber duck entity',
      pattern: /\b(?:rubber duck|duck squeezes?|duck|squeezes?)\b/i,
      weight: 3,
    },
    {
      label: 'invisible or fairness entity',
      pattern: /\b(?:invisible guest|fairness|empty space)\b/i,
      weight: 3,
    },
  ],
  humor_domain: [
    {
      label: 'sla humor domain',
      pattern: /\b(?:service-level agreement|service level agreement|sla)\b/i,
      weight: 2,
    },
    {
      label: 'developer happiness domain',
      pattern: /\b(?:developer happiness|happiness|sadness|enforcement penalties|penalties)\b/i,
      weight: 2,
    },
    {
      label: 'parody framing',
      pattern: /\b(?:parody|satire|satirical|playful|whimsical|absurdist?)\b/i,
      weight: 2,
    },
  ],
  arithmetic_trap: [
    {
      label: 'exact quantity ask',
      pattern:
        /\b(?:exactly how many|how many|minimum viable rate|rate per minute|exact number|exact rates?)\b/i,
      weight: 3,
    },
    {
      label: 'calculation ask',
      pattern: /\b(?:calculate|compute|formula|coefficient|units)\b/i,
      weight: 2,
    },
  ],
  impossible_guarantee: [
    {
      label: 'hard guarantee',
      pattern:
        /\b(?:100% accuracy|exact prediction intervals?|error bounds?|zero production failures|guarantees?|maintain 99\.999% uptime)\b/i,
      weight: 3,
    },
    {
      label: 'formal certainty',
      pattern:
        /\b(?:formal guarantee|prove that it works|for all teams|for all workloads)\b/i,
      weight: 2,
    },
  ],
};

const PROMPT_PRECEDENCE: QuestionFamily[] = [
  'causal_refutation',
  'forecasting',
  'humor_forward',
  'operational_claim',
  'causal',
  'refutation',
];

function scoreFamily(
  text: string,
  family: QuestionFamily,
): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  for (const candidate of FAMILY_PATTERNS[family]) {
    if (!candidate.pattern.test(text)) continue;
    score += candidate.weight;
    signals.push(candidate.label);
  }
  return { score, signals };
}

function normaliseText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function toGlobal(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function isNegated(text: string, matchIndex: number): boolean {
  const prefix = text.slice(Math.max(0, matchIndex - 48), matchIndex);
  return /\b(?:do not|don't|never|without|not)\b(?:\s+\w+){0,3}\s*$/i.test(prefix);
}

function hasUsableMatch(
  text: string,
  pattern: RegExp,
  respectNegation = true,
): boolean {
  const matcher = toGlobal(pattern);
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    if (respectNegation && isNegated(text, match.index)) continue;
    return true;
  }
  return false;
}

export function classifyOperationalFrameworkFromAnswer(
  answerText: string,
): OperationalFrameworkClassification {
  const text = normaliseText(answerText);
  const matched_signals: string[] = [];
  let score = 0;

  for (const candidate of OPERATIONAL_FRAMEWORK_PATTERNS) {
    if (!candidate.pattern.test(text)) continue;
    score += candidate.weight;
    matched_signals.push(candidate.label);
  }

  return {
    score,
    matched_signals,
    is_operational_framework: score >= OPERATIONAL_FRAMEWORK_SCORE_THRESHOLD,
  };
}

export function classifyQuestionFromAnswer(
  answerText: string,
): QuestionClassification {
  const text = normaliseText(answerText);
  const scored = (
    Object.keys(FAMILY_PATTERNS) as QuestionFamily[]
  ).map(family => {
    const { score, signals } = scoreFamily(text, family);
    return { family, score, signals };
  });
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0];
  const runnerUp = scored[1];

  if (!top || top.score <= 0) {
    return {
      family: 'operational_claim',
      confidence: 0,
      matched_signals: [],
    };
  }

  if (
    top.family === 'humor_forward' &&
    top.score === runnerUp?.score &&
    runnerUp.family === 'refutation'
  ) {
    return {
      family: 'humor_forward',
      confidence: top.score / Math.max(top.score + (runnerUp?.score ?? 0), 1),
      matched_signals: top.signals,
    };
  }

  return {
    family: top.family,
    confidence: top.score / Math.max(top.score + (runnerUp?.score ?? 0), 1),
    matched_signals: top.signals,
  };
}

export function classifyQuestionFromPrompt(
  promptText: string,
): QuestionClassification {
  const text = normaliseText(promptText);

  const actionScores: Partial<Record<QuestionFamily, number>> = {};
  const actionSignals: Partial<Record<QuestionFamily, string[]>> = {};

  for (const candidate of PROMPT_ACTION_PATTERNS) {
    if (!hasUsableMatch(text, candidate.pattern, true)) continue;
    actionScores[candidate.family] =
      (actionScores[candidate.family] ?? 0) + candidate.weight;
    actionSignals[candidate.family] = [
      ...(actionSignals[candidate.family] ?? []),
      candidate.label,
    ];
  }

  const promptSignals = {
    absurd_entity: { score: 0, signals: [] as string[] },
    humor_domain: { score: 0, signals: [] as string[] },
    arithmetic_trap: { score: 0, signals: [] as string[] },
    impossible_guarantee: { score: 0, signals: [] as string[] },
  };

  for (const [signalType, patterns] of Object.entries(PROMPT_SIGNAL_PATTERNS) as Array<
    [
      keyof typeof PROMPT_SIGNAL_PATTERNS,
      PromptSignalPattern[],
    ]
  >) {
    for (const candidate of patterns) {
      if (!hasUsableMatch(text, candidate.pattern, false)) continue;
      promptSignals[signalType].score += candidate.weight;
      promptSignals[signalType].signals.push(candidate.label);
    }
  }

  const hasAbsurdEntity = promptSignals.absurd_entity.score > 0;
  const hasHumorDomain = promptSignals.humor_domain.score > 0;
  const hasArithmeticTrap = promptSignals.arithmetic_trap.score > 0;
  const hasImpossibleGuarantee = promptSignals.impossible_guarantee.score > 0;
  const forecastingScore = actionScores.forecasting ?? 0;
  const operationalScore = actionScores.operational_claim ?? 0;
  const causalScore = actionScores.causal ?? 0;
  const refutationScore = actionScores.refutation ?? 0;

  const candidates: Array<{
    family: QuestionFamily;
    score: number;
    signals: string[];
  }> = [];

  if (
    hasAbsurdEntity &&
    (
      hasArithmeticTrap ||
      (causalScore > 0) ||
      (forecastingScore === 0 &&
        operationalScore > 0 &&
        hasImpossibleGuarantee &&
        !hasHumorDomain)
    )
  ) {
    candidates.push({
      family: 'causal_refutation',
      score:
        promptSignals.absurd_entity.score +
        promptSignals.arithmetic_trap.score +
        (actionScores.causal ?? 0) +
        (actionScores.operational_claim ?? 0) +
        promptSignals.impossible_guarantee.score,
      signals: [
        ...promptSignals.absurd_entity.signals,
        ...promptSignals.arithmetic_trap.signals,
        ...(actionSignals.causal ?? []),
        ...(actionSignals.operational_claim ?? []),
        ...promptSignals.impossible_guarantee.signals,
      ],
    });
  }

  if (forecastingScore > 0) {
    candidates.push({
      family: 'forecasting',
      score:
        forecastingScore +
        promptSignals.impossible_guarantee.score +
        Math.min(promptSignals.absurd_entity.score, 2),
      signals: [
        ...(actionSignals.forecasting ?? []),
        ...promptSignals.impossible_guarantee.signals,
        ...promptSignals.absurd_entity.signals,
      ],
    });
  }

  if (hasAbsurdEntity && hasHumorDomain) {
    candidates.push({
      family: 'humor_forward',
      score:
        promptSignals.absurd_entity.score +
        promptSignals.humor_domain.score +
        operationalScore,
      signals: [
        ...promptSignals.absurd_entity.signals,
        ...promptSignals.humor_domain.signals,
        ...(actionSignals.operational_claim ?? []),
      ],
    });
  }

  if (operationalScore > 0) {
    candidates.push({
      family: 'operational_claim',
      score: operationalScore,
      signals: actionSignals.operational_claim ?? [],
    });
  }

  if (causalScore > 0) {
    candidates.push({
      family: 'causal',
      score: causalScore,
      signals: actionSignals.causal ?? [],
    });
  }

  if (refutationScore > 0) {
    candidates.push({
      family: 'refutation',
      score: refutationScore,
      signals: actionSignals.refutation ?? [],
    });
  }

  if (candidates.length === 0) {
    return {
      family: 'operational_claim',
      confidence: 0,
      matched_signals: [],
    };
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      PROMPT_PRECEDENCE.indexOf(a.family) - PROMPT_PRECEDENCE.indexOf(b.family)
    );
  });

  const top = candidates[0];
  const runnerUp = candidates[1];
  return {
    family: top.family,
    confidence: top.score / Math.max(top.score + (runnerUp?.score ?? 0), 1),
    matched_signals: top.signals,
  };
}

export function resolvePromptFamily(
  runtime: CalibrationRuntimeContext,
  answerText: string,
): {
  prompt_family: string;
  prompt_family_source: PromptFamilySource;
  classification: QuestionClassification;
} {
  if (runtime.locked_prompt_family && runtime.locked_prompt_family.trim() !== '') {
    return {
      prompt_family: runtime.locked_prompt_family,
      prompt_family_source: 'locked',
      classification: runtime.prompt_text
        ? classifyQuestionFromPrompt(runtime.prompt_text)
        : classifyQuestionFromAnswer(answerText),
    };
  }

  if (runtime.prompt_family && runtime.prompt_family.trim() !== '') {
    return {
      prompt_family: runtime.prompt_family,
      prompt_family_source: 'explicit',
      classification: runtime.prompt_text
        ? classifyQuestionFromPrompt(runtime.prompt_text)
        : classifyQuestionFromAnswer(answerText),
    };
  }

  if (runtime.prompt_text && runtime.prompt_text.trim() !== '') {
    const classification = classifyQuestionFromPrompt(runtime.prompt_text);
    return {
      prompt_family: classification.family,
      prompt_family_source: 'prompt_inferred',
      classification,
    };
  }

  const classification = classifyQuestionFromAnswer(answerText);
  return {
    prompt_family: classification.family,
    prompt_family_source: 'answer_inferred',
    classification,
  };
}
