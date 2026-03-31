/**
 * Hybrid Rubric Scorer
 *
 * Combines deterministic scoring (3 dimensions) with LLM-as-judge scoring
 * (3 dimensions) to produce a full 6-dimension rubric score for any response.
 *
 * Used by the benchmark runner to score baseline and prompted LLM responses.
 * CT-MCP responses are scored differently — from enforcement engine output.
 */

export { extractFeatures, type ExtractedFeatures } from './extract_features.js';
export { scoreDeterministic, scoreDeterministicFromFeatures, type DeterministicScores } from './deterministic_score.js';
export { scoreWithJudge, parseJudgeOutput, type JudgeScores, type JudgeInput, JUDGE_SYSTEM_PROMPT } from './judge_score.js';

import { scoreDeterministic, type DeterministicScores } from './deterministic_score.js';
import { scoreWithJudge, type JudgeScores, type JudgeInput } from './judge_score.js';

export interface FullRubricScore {
  correctness: 0 | 1 | 2 | 3;
  specificity: 0 | 1 | 2 | 3;
  assumption_honesty: 0 | 1 | 2 | 3;
  logical_structure: 0 | 1 | 2 | 3;
  tradeoff_quality: 0 | 1 | 2 | 3;
  safety_readiness: 0 | 1 | 2 | 3;
}

const WEIGHTS: Record<keyof FullRubricScore, number> = {
  correctness: 0.25,
  specificity: 0.20,
  assumption_honesty: 0.20,
  logical_structure: 0.15,
  tradeoff_quality: 0.10,
  safety_readiness: 0.10,
};

/**
 * Compute normalized quality_score (0-1) from full rubric scores.
 */
export function normalizeScore(scores: FullRubricScore): number {
  let total = 0;
  for (const [dim, weight] of Object.entries(WEIGHTS)) {
    total += (scores[dim as keyof FullRubricScore] / 3) * weight;
  }
  return Math.round(total * 1000) / 1000;
}

/**
 * Score a free-text response using the hybrid rubric.
 *
 * 1. Extract features and score 3 deterministic dimensions
 * 2. Score 3 semantic dimensions with LLM-as-judge
 * 3. Combine and normalize
 */
export async function scoreHybrid(
  responseText: string,
  judgeInput: JudgeInput,
): Promise<{ scores: FullRubricScore; quality_score: number }> {
  const deterministic: DeterministicScores = scoreDeterministic(responseText);
  const judge: JudgeScores = await scoreWithJudge(judgeInput);

  const scores: FullRubricScore = {
    correctness: judge.correctness,
    specificity: deterministic.specificity,
    assumption_honesty: deterministic.assumption_honesty,
    logical_structure: deterministic.logical_structure,
    tradeoff_quality: judge.tradeoff_quality,
    safety_readiness: judge.safety_readiness,
  };

  return {
    scores,
    quality_score: normalizeScore(scores),
  };
}
