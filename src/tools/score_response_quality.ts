/**
 * score_response_quality — Composite quality scoring across four dimensions.
 *
 * substance_score: Shannon entropy on word frequencies, normalized by log2(vocabulary_size).
 * specificity_score: from engine.scoreSpecificity.
 * hedge_density: from engine.detectHedging.
 * structure_score: claim->evidence->conclusion pattern detection.
 * overall_score: weighted average.
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { BlockingIssue, EnforcementContext } from '../enforcement/types.js';

// ====== Output Types ======

export interface ResponseQualityOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  overall_score: number;
  substance_score: number;
  specificity_score: number;
  hedge_density: number;
  structure_score: number;
  improvement_prompt: string;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

// ====== Validation ======

function validateInput(input: unknown): {
  response_text: string;
  claims?: string[];
  evidence?: string[];
} {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "response_text" (string, min 10 chars). ' +
      'Optional fields: "claims" (string[]), "evidence" (string[]).'
    );
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.response_text !== 'string' || obj.response_text.length < 10) {
    throw new Error(
      `"response_text" must be a non-empty string of at least 10 characters. Got ${typeof obj.response_text === 'string' ? obj.response_text.length + ' chars' : typeof obj.response_text}.`
    );
  }

  let claims: string[] | undefined;
  if (obj.claims !== undefined) {
    if (!Array.isArray(obj.claims)) {
      throw new Error('"claims" must be an array of strings.');
    }
    claims = obj.claims as string[];
  }

  let evidence: string[] | undefined;
  if (obj.evidence !== undefined) {
    if (!Array.isArray(obj.evidence)) {
      throw new Error('"evidence" must be an array of strings.');
    }
    evidence = obj.evidence as string[];
  }

  return { response_text: obj.response_text, claims, evidence };
}

// ====== Shannon Entropy ======

function computeSubstanceScore(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) return 0;

  // Word frequency map
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  const vocabSize = freq.size;
  if (vocabSize <= 1) return 0;

  // Shannon entropy: -sum(p * log2(p))
  const total = words.length;
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  // Normalize by log2(vocabulary_size)
  const maxEntropy = Math.log2(vocabSize);
  return maxEntropy === 0 ? 0 : Math.min(1, entropy / maxEntropy);
}

// ====== Structure Score ======

function computeStructureScore(
  text: string,
  claims?: string[],
  evidence?: string[],
): number {
  const lower = text.toLowerCase();

  // Detect claim markers
  const hasClaims =
    (claims && claims.length > 0) ||
    /\b(claim|assert|argue|contend|maintain|propose|suggest that|believe that)\b/i.test(lower);

  // Detect evidence markers
  const hasEvidence =
    (evidence && evidence.length > 0) ||
    /\b(evidence|data|study|research|experiment|survey|measure|observe|statistic|finding|result shows)\b/i.test(lower);

  // Detect conclusion markers
  const hasConclusions =
    /\b(therefore|thus|hence|consequently|in conclusion|conclude|as a result|it follows|we can see)\b/i.test(lower);

  return (hasClaims ? 0.33 : 0) + (hasEvidence ? 0.33 : 0) + (hasConclusions ? 0.34 : 0);
}

// ====== Improvement Prompt ======

function generateImprovementPrompt(
  scores: {
    substance: number;
    specificity: number;
    hedge: number;
    structure: number;
  },
): string {
  const hedgeScore = 1 - scores.hedge;
  const dimensions = [
    { name: 'substance', score: scores.substance, advice: 'Use more diverse and specific vocabulary. Avoid repeating the same words and phrases.' },
    { name: 'specificity', score: scores.specificity, advice: 'Add concrete details: names, numbers, dates, measurements, or specific conditions.' },
    { name: 'hedge_avoidance', score: hedgeScore, advice: 'Reduce hedging language (might, perhaps, possibly, could). Make definitive claims backed by evidence.' },
    { name: 'structure', score: scores.structure, advice: 'Organize response as: (1) clear claims, (2) supporting evidence, (3) explicit conclusions.' },
  ];

  dimensions.sort((a, b) => a.score - b.score);
  const weakest = dimensions[0];

  return `Your weakest dimension is "${weakest.name}" (score: ${weakest.score.toFixed(2)}). ${weakest.advice}`;
}

// ====== Handler ======

export function handleScoreResponseQuality(
  input: unknown,
  engine: EnforcementEngine,
): ResponseQualityOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { response_text, claims, evidence } = validateInput(input);

  // Substance score: Shannon entropy on word frequencies
  const substanceScore = computeSubstanceScore(response_text);

  // Specificity score
  const specResult = engine.scoreSpecificity(response_text, 'assumption');
  const specificityScore = specResult.score;

  // Hedge density
  const hedgeResult = engine.detectHedging(response_text);
  const hedgeDensity = hedgeResult.hedge_density;

  // Structure score
  const structureScore = computeStructureScore(response_text, claims, evidence);

  // Overall score: weighted average
  const overallScore =
    substanceScore * 0.3 +
    specificityScore * 0.3 +
    (1 - hedgeDensity) * 0.2 +
    structureScore * 0.2;

  // Improvement prompt
  const improvementPrompt = generateImprovementPrompt({
    substance: substanceScore,
    specificity: specificityScore,
    hedge: hedgeDensity,
    structure: structureScore,
  });

  // Enforcement
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  if (overallScore < 0.3) {
    blockingIssues.push({
      mechanism: 'quality_floor',
      description: `Overall quality score is ${overallScore.toFixed(2)}, below the 0.30 minimum threshold.`,
      severity: 'blocking',
    });
  }

  if (hedgeResult.severity === 'heavy') {
    warnings.push(
      `Heavy hedging detected (density: ${hedgeDensity.toFixed(2)}). ` +
      `Hedged sentences: ${hedgeResult.hedged_sentences.slice(0, 3).join(' | ')}`
    );
  }

  if (!specResult.passes) {
    warnings.push(
      `Low specificity (score: ${specificityScore.toFixed(2)}). Add concrete details and quantitative markers.`
    );
  }

  // Concurrency hazard scan on the response text
  const concurrency = engine.checkConcurrencyHazards(response_text);
  if (concurrency.critical_count > 0 && !concurrency.has_mitigation) {
    const hazardDescs = concurrency.hazards
      .filter(h => h.severity === 'critical')
      .map(h => h.description);
    warnings.push(
      `Concurrency hazard(s) described without mitigation: ${hazardDescs.join('; ')}.`
    );
  }

  // Entity grounding check
  const grounding = engine.checkEntityGrounding(response_text);
  if (grounding.ungrounded_count > 0) {
    const entityList = grounding.ungrounded_entities.map(e => `${e.entity} (${e.category})`).join(', ');
    warnings.push(
      `Ungrounded entities detected: ${entityList}. These claims cannot be verified from provided context.`
    );
  }

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'score_response_quality', undefined, context)
    : '';

  const result: ResponseQualityOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    overall_score: Math.round(overallScore * 1000) / 1000,
    substance_score: Math.round(substanceScore * 1000) / 1000,
    specificity_score: Math.round(specificityScore * 1000) / 1000,
    hedge_density: Math.round(hedgeDensity * 1000) / 1000,
    structure_score: Math.round(structureScore * 1000) / 1000,
    improvement_prompt: improvementPrompt,
    context_used: !!context,
  };

  if (hasFail || warnings.length > 0) {
    result.enforcement = {
      blocking_issues: blockingIssues,
      warnings,
      corrective_prompt: correctivePrompt,
    };
  }

  return result;
}
