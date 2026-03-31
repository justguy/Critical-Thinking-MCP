/**
 * Two-step specificity scorer.
 *
 * Step 1: Technical marker density — counts file paths, version numbers,
 *         error codes, specific thresholds.
 * Step 2: Conditional specificity — strips numbers and component names,
 *         compares stripped text to original via Jaccard.  If >80% similar,
 *         the specifics are decorative ("structured vagueness").
 *
 * Both steps must pass for the text to be considered specific.
 */

import type { SpecificityResult } from './types.js';
import { tokenize, jaccardSimilarity } from './utils.js';

/** Regexes that identify technical markers in raw text. */
const TECHNICAL_MARKERS = [
  /(?:\/[\w.-]+){2,}/g,                           // file paths  /foo/bar/baz
  /\bv?\d+\.\d+(?:\.\d+)?(?:-[\w.]+)?\b/g,       // version numbers  v1.2.3
  /\b[A-Z]{1,5}[-_]?\d{2,6}\b/g,                  // error codes  ERR-4012, E503
  /\b\d+(?:\.\d+)?(?:\s*(?:%|ms|s|MB|GB|KB|req\/s|rpm|tps|rps))\b/gi,  // thresholds
  /\b(?:0\.\d+|1\.0)\b/g,                         // decimal thresholds
];

const DENSITY_THRESHOLDS: Record<string, number> = {
  assumption: 0.15,
  challenge: 0.20,
};

/**
 * Count unique technical terms that appear in the raw text.
 */
function countTechnicalTerms(text: string): Set<string> {
  const terms = new Set<string>();
  for (const re of TECHNICAL_MARKERS) {
    // reset lastIndex for global regexes
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      terms.add(m[0].toLowerCase());
    }
  }
  return terms;
}

/**
 * Strip all numbers and likely component / proper names from the text.
 * Component names are approximated as CamelCase or UPPER_CASE tokens.
 */
function stripSpecifics(text: string): string {
  return text
    .replace(/\d+(?:\.\d+)?/g, '')                        // numbers
    .replace(/\b[A-Z][a-zA-Z]+(?:[A-Z][a-zA-Z]+)+\b/g, '') // CamelCase
    .replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, '')               // UPPER_CASE
    .replace(/(?:\/[\w.-]+){2,}/g, '')                     // file paths
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Score the specificity of a piece of text.
 *
 * @param text    The text to evaluate.
 * @param context Whether this is an assumption or a challenge.
 */
export function scoreSpecificity(
  text: string,
  context: 'assumption' | 'challenge',
): SpecificityResult {
  const warnings: string[] = [];
  const words = tokenize(text);
  const totalWords = words.length;

  if (totalWords === 0) {
    return {
      score: 0,
      passes: false,
      marker_density: 0,
      conditional_passes: false,
      warnings: ['Empty text — cannot evaluate specificity.'],
    };
  }

  // Step 1 — Technical marker density
  const technicalTerms = countTechnicalTerms(text);
  const uniqueWords = new Set(words).size;
  const markerDensity =
    (technicalTerms.size / totalWords) * Math.log2(Math.max(2, uniqueWords));

  const densityThreshold = DENSITY_THRESHOLDS[context] ?? 0.15;
  const step1Passes = markerDensity >= densityThreshold;
  if (!step1Passes) {
    warnings.push(
      `Technical marker density ${markerDensity.toFixed(3)} below threshold ${densityThreshold} for ${context}.`,
    );
  }

  // Step 2 — Conditional specificity (anti–structured-vagueness)
  const stripped = stripSpecifics(text);
  const similarity = jaccardSimilarity(stripped, text);
  const conditionalPasses = similarity <= 0.80;
  if (!conditionalPasses) {
    warnings.push(
      `Stripped text is ${(similarity * 100).toFixed(1)}% similar to original — specifics may be decorative.`,
    );
  }

  const passes = step1Passes && conditionalPasses;
  const score = passes ? markerDensity : markerDensity * (1 - similarity);

  return {
    score,
    passes,
    marker_density: markerDensity,
    conditional_passes: conditionalPasses,
    warnings,
  };
}
