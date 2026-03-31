/**
 * Layer B: Deterministic Scorer
 *
 * Scores 3 rubric dimensions from extracted features:
 *   - specificity (weight: 0.20)
 *   - logical_structure (weight: 0.15)
 *   - assumption_honesty (weight: 0.20)
 *
 * No LLM calls. Reproducible, rule-based scoring.
 */

import { extractFeatures, type ExtractedFeatures } from './extract_features.js';

export interface DeterministicScores {
  specificity: 0 | 1 | 2 | 3;
  logical_structure: 0 | 1 | 2 | 3;
  assumption_honesty: 0 | 1 | 2 | 3;
}

/**
 * Score specificity from extracted features.
 *
 * 0: No thresholds, no units, no component names, no conditionals
 * 1: Has some component names or general terms
 * 2: Has thresholds + units + component names
 * 3: Has thresholds + units + component names + conditional phrases (measurable conditions)
 */
function scoreSpecificity(features: ExtractedFeatures): 0 | 1 | 2 | 3 {
  const hasThresholds = features.thresholds > 0;
  const hasUnits = features.units > 0;
  const hasComponents = features.component_names.length > 0;
  const hasConditionals = features.conditional_phrases > 0;

  if (hasThresholds && hasUnits && hasComponents && hasConditionals) return 3;
  if (hasThresholds && hasComponents) return 2;
  if (hasComponents || hasUnits) return 1;
  return 0;
}

/**
 * Score logical structure from extracted features.
 *
 * 0: No structural markers (no claims, evidence, or conclusions)
 * 1: Has some markers but incomplete chain
 * 2: Has claim + evidence + conclusion markers
 * 3: Has all markers with low hedging (clear, grounded reasoning)
 */
function scoreLogicalStructure(features: ExtractedFeatures): 0 | 1 | 2 | 3 {
  const hasClaims = features.claim_markers > 0;
  const hasEvidence = features.evidence_markers > 0;
  const hasConclusions = features.conclusion_markers > 0;
  const lowHedging = features.hedge_phrases <= 2;

  const markerCount = [hasClaims, hasEvidence, hasConclusions].filter(Boolean).length;

  if (markerCount === 3 && lowHedging) return 3;
  if (markerCount >= 2) return 2;
  if (markerCount >= 1) return 1;
  return 0;
}

/**
 * Score assumption honesty from extracted features.
 *
 * 0: No explicit assumptions, no confidence mentions
 * 1: Has some assumptions but no confidence values
 * 2: Has explicit assumptions with confidence values
 * 3: Has assumptions + confidence + falsification conditions
 */
function scoreAssumptionHonesty(features: ExtractedFeatures): 0 | 1 | 2 | 3 {
  const hasAssumptions = features.explicit_assumptions > 0;
  const hasConfidence = features.confidence_mentions.length > 0;
  const hasFalsification = features.falsification_conditions > 0;

  if (hasAssumptions && hasConfidence && hasFalsification) return 3;
  if (hasAssumptions && hasConfidence) return 2;
  if (hasAssumptions) return 1;
  return 0;
}

/**
 * Score 3 deterministic dimensions from free-text response.
 */
export function scoreDeterministic(text: string): DeterministicScores {
  const features = extractFeatures(text);
  return {
    specificity: scoreSpecificity(features),
    logical_structure: scoreLogicalStructure(features),
    assumption_honesty: scoreAssumptionHonesty(features),
  };
}

/**
 * Score 3 deterministic dimensions from pre-extracted features.
 */
export function scoreDeterministicFromFeatures(features: ExtractedFeatures): DeterministicScores {
  return {
    specificity: scoreSpecificity(features),
    logical_structure: scoreLogicalStructure(features),
    assumption_honesty: scoreAssumptionHonesty(features),
  };
}
