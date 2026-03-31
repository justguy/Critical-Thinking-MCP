/**
 * Steelman similarity checker.
 *
 * Two checks:
 *   A (anti-paraphrase): similarity > 0.85 = paraphrase → block
 *   B (anti-strawman):   similarity < 0.3 AND no new specific premises → strawman → block
 *
 * "New specific premises" = sentences in steelman absent from original that
 * contain conditional structure (when/if/given) or specific technical markers.
 */

import type { SteelmanResult } from './types.js';
import { jaccardSimilarity, splitSentences } from './utils.js';

const PARAPHRASE_THRESHOLD = 0.85;
const STRAWMAN_THRESHOLD = 0.3;

/** Regexes identifying conditional structure or technical markers. */
const CONDITIONAL_MARKERS = /\b(?:when|if|given|provided|assuming|unless)\b/i;
const TECHNICAL_MARKERS = [
  /\bv?\d+\.\d+(?:\.\d+)?\b/,          // version
  /\b\d+(?:\.\d+)?\s*(?:%|ms|s|MB|GB|KB)\b/i, // thresholds
  /(?:\/[\w.-]+){2,}/,                  // file paths
  /\b[A-Z]{1,5}[-_]?\d{2,6}\b/,        // error codes
  /\b[A-Z][a-z]+(?:[A-Z][a-z]+){1,}\b/, // CamelCase components
];

/**
 * Return true if a sentence qualifies as a "new specific premise" —
 * contains conditional structure or at least one technical marker.
 */
function isSpecificPremise(sentence: string): boolean {
  if (CONDITIONAL_MARKERS.test(sentence)) return true;
  return TECHNICAL_MARKERS.some(re => re.test(sentence));
}

/**
 * Find sentences in `steelman` that are not close paraphrases of any
 * sentence in `original` (Jaccard < 0.5 against every original sentence).
 */
function findNewSentences(
  originalSentences: string[],
  steelmanSentences: string[],
): string[] {
  return steelmanSentences.filter(sSent => {
    return originalSentences.every(
      oSent => jaccardSimilarity(oSent, sSent) < 0.5,
    );
  });
}

/**
 * Compare a steelman to the original argument.
 */
export function compareSteelman(
  original: string,
  steelman: string,
): SteelmanResult {
  const similarity = jaccardSimilarity(original, steelman);
  const is_paraphrase = similarity > PARAPHRASE_THRESHOLD;

  // Anti-strawman: check for new specific premises
  const origSentences = splitSentences(original);
  const steelSentences = splitSentences(steelman);
  const newSentences = findNewSentences(origSentences, steelSentences);
  const newSpecific = newSentences.filter(isSpecificPremise);
  const hasNewPremises = newSpecific.length > 0;

  const is_strawman = similarity < STRAWMAN_THRESHOLD && !hasNewPremises;
  const has_genuine_extension = !is_paraphrase && !is_strawman && hasNewPremises;

  return {
    similarity,
    is_paraphrase,
    is_strawman,
    has_genuine_extension,
  };
}
