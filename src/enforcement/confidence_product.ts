/**
 * Dependency-weighted confidence product.
 *
 * Computes pairwise similarity between assumption descriptions to detect
 * correlated assumptions, then produces a dependency-weighted honest ceiling.
 */

import type { Assumption, ConfidenceProductResult, HedgeResult } from './types.js';
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
  // Collect ALL stated-certainty signals and return the MAX — an agent that says
  // "certain" once is making a high claim even amid hedges. Widening is purely
  // additive over the legacy patterns (which are preserved), so it can only RAISE
  // the detected confidence, never lower it.
  const candidates: number[] = [];

  // "X% confident" or "X percent confident"
  const pctMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*confident/i);
  if (pctMatch) candidates.push(parseFloat(pctMatch[1]) / 100);

  // "confidence: 0.X" or "confidence: X%"
  const colonMatch = text.match(/confidence\s*:\s*(\d+(?:\.\d+)?)\s*(%)?/i);
  if (colonMatch) {
    const val = parseFloat(colonMatch[1]);
    candidates.push(colonMatch[2] ? val / 100 : val > 1 ? val / 100 : val);
  }

  // "p = 0.9" / "probability of 0.9" / "probability: 0.9"
  const pMatch = text.match(/\b(?:p|probability)\s*(?:=|:|of)\s*(0?\.\d+|1(?:\.0+)?)\b/i);
  if (pMatch) candidates.push(parseFloat(pMatch[1]));

  // "9 out of 10" / "9/10"
  const outOf = text.match(/\b(\d{1,2})\s*(?:out of|\/)\s*10\b/i);
  if (outOf) {
    const n = parseInt(outOf[1], 10);
    if (n >= 0 && n <= 10) candidates.push(n / 10);
  }

  // Legacy qualitative phrases (preserved)
  const lower = text.toLowerCase();
  if (/very\s+confident/i.test(lower)) candidates.push(0.9);
  if (/fairly\s+confident/i.test(lower)) candidates.push(0.75);
  if (/somewhat\s+confident/i.test(lower)) candidates.push(0.5);

  // New phrases — strong, low-false-positive forms only (anchored or unambiguous)
  // to avoid firing on incidental prose like "this will probably help".
  // Polarity guard: don't read a HIGH affirmative confidence off a negated phrase
  // ("almost certainly NOT the cause") — that would feed a false confidence_hedge block.
  const NEG = "(?!\\s+(?:not|no|never|none|n['’]?t))";
  const STANCE = "(?:i\\s*a?m|i'm|we\\s*are|we're)\\s+(?:absolutely\\s+|completely\\s+|totally\\s+)?";
  if (new RegExp(STANCE + '(?:certain|positive|sure)\\b' + NEG, 'i').test(text)) candidates.push(0.97);
  if (new RegExp('\\balmost\\s+certain(?:ly)?\\b' + NEG, 'i').test(text)) candidates.push(0.9);
  if (new RegExp('\\bhighly\\s+(?:likely|confident)\\b' + NEG, 'i').test(text)) candidates.push(0.9);
  if (new RegExp(STANCE + 'confident\\b' + NEG, 'i').test(text)) candidates.push(0.8);

  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/**
 * Cross-check stated confidence against the response's own hedging. High claimed
 * certainty wrapped in heavy hedges is an internal contradiction. Consumes the
 * existing detectHedging output. WARNING at c≥0.8 + moderate/heavy hedging; BLOCK
 * only at c≥0.9 + heavy hedging (an unambiguous self-contradiction).
 */
export interface ConfidenceHedgeResult {
  contradiction: boolean;
  severity: 'none' | 'warning' | 'blocking';
}

export function checkConfidenceHedgeConsistency(
  claimedConfidence: number | null,
  hedge: HedgeResult,
): ConfidenceHedgeResult {
  if (claimedConfidence === null) return { contradiction: false, severity: 'none' };
  if (claimedConfidence >= 0.9 && hedge.severity === 'heavy') {
    return { contradiction: true, severity: 'blocking' };
  }
  if (claimedConfidence >= 0.8 && (hedge.severity === 'moderate' || hedge.severity === 'heavy')) {
    return { contradiction: true, severity: 'warning' };
  }
  return { contradiction: false, severity: 'none' };
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
