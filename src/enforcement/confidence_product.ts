/**
 * Dependency-weighted confidence product.
 *
 * Computes pairwise similarity between assumption descriptions to detect
 * correlated assumptions, then produces a dependency-weighted honest ceiling.
 */

import type { Assumption, ConfidenceProductResult } from './types.js';
import { jaccardSimilarity } from './utils.js';

const CORRELATION_THRESHOLD = 0.5;
const INFLATION_GAP_THRESHOLD = 0.15;

/**
 * Extract a claimed confidence value from free-text response.
 * Patterns recognised:
 *   "X% confident"          → X / 100
 *   "confidence: 0.X"       → 0.X
 *   "confidence: X%"        → X / 100
 *   "very confident"        → 0.9
 *   "fairly confident"      → 0.75
 *   "somewhat confident"    → 0.5
 */
function extractClaimedConfidence(text: string): number | null {
  // "X% confident" or "X percent confident"
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*confident/i);
  if (pctMatch) return parseFloat(pctMatch[1]) / 100;

  // "confidence: 0.X" or "confidence: X%"
  const colonMatch = text.match(/confidence\s*:\s*(\d+(?:\.\d+)?)\s*(%)?/i);
  if (colonMatch) {
    const val = parseFloat(colonMatch[1]);
    return colonMatch[2] ? val / 100 : (val > 1 ? val / 100 : val);
  }

  // Qualitative phrases (checked in order of specificity)
  const lower = text.toLowerCase();
  if (/very\s+confident/i.test(lower)) return 0.9;
  if (/fairly\s+confident/i.test(lower)) return 0.75;
  if (/somewhat\s+confident/i.test(lower)) return 0.5;

  return null;
}

/**
 * Compute the dependency-weighted confidence product for a set of assumptions.
 *
 * - Pairwise bigram-Jaccard similarity detects correlated assumptions.
 * - k_i = number of correlated others + 1 (including self).
 * - honest_ceiling = ∏ c_i^(1/k_i).
 * - If responseText is provided, extract claimed confidence and flag inflation.
 */
export function computeConfidenceProduct(
  assumptions: Assumption[],
  responseText?: string,
): ConfidenceProductResult {
  const n = assumptions.length;

  if (n === 0) {
    return {
      honest_ceiling: 1,
      claimed_confidence: null,
      gap: 0,
      inflation_detected: false,
      dependency_weights: [],
    };
  }

  // Build pairwise similarity and compute k_i
  const correlationCounts = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = jaccardSimilarity(
        assumptions[i].description,
        assumptions[j].description,
      );
      if (sim > CORRELATION_THRESHOLD) {
        correlationCounts[i]++;
        correlationCounts[j]++;
      }
    }
  }

  const k = correlationCounts.map(c => c + 1); // k_i = correlated_others + 1 (self)
  const weights = k.map(ki => 1 / ki);

  // honest_ceiling = ∏ c_i^(1/k_i)
  let honest_ceiling = 1;
  for (let i = 0; i < n; i++) {
    const c = Math.max(0, Math.min(1, assumptions[i].confidence));
    honest_ceiling *= Math.pow(c, weights[i]);
  }

  // Claimed confidence extraction
  const claimed_confidence = responseText
    ? extractClaimedConfidence(responseText)
    : null;

  const gap =
    claimed_confidence !== null ? claimed_confidence - honest_ceiling : 0;
  const inflation_detected = gap > INFLATION_GAP_THRESHOLD;

  return {
    honest_ceiling,
    claimed_confidence,
    gap,
    inflation_detected,
    dependency_weights: weights,
  };
}
