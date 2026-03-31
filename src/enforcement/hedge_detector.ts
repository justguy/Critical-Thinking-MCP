/**
 * Hedge phrase density detector.
 *
 * Scans text for hedge phrases, computes density as the ratio of hedged
 * sentences to total sentences, and classifies severity.
 */

import type { HedgeResult } from './types.js';
import { splitSentences } from './utils.js';

/**
 * Hedge phrases ordered from longest to shortest so that multi-word phrases
 * are matched before their single-word substrings.
 */
const HEDGE_PHRASES: string[] = [
  'could potentially',
  'may or may not',
  'generally speaking',
  'worth considering',
  'various factors',
  'to some extent',
  'in some cases',
  'it depends',
  'arguably',
  'possibly',
  'perhaps',
  'might',
];

/** Precompiled regexes — one per hedge phrase, word-boundary-aware. */
const HEDGE_REGEXES: RegExp[] = HEDGE_PHRASES.map(
  phrase => new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`, 'i'),
);

/**
 * Return true if the sentence contains at least one hedge phrase.
 */
function sentenceIsHedged(sentence: string): boolean {
  return HEDGE_REGEXES.some(re => re.test(sentence));
}

/**
 * Detect hedging in free text.
 *
 * @returns hedge_density, severity classification, and the hedged sentences.
 */
export function detectHedging(text: string): HedgeResult {
  const sentences = splitSentences(text);

  if (sentences.length === 0) {
    return { hedge_density: 0, severity: 'clean', hedged_sentences: [] };
  }

  const hedged: string[] = sentences.filter(sentenceIsHedged);
  const density = hedged.length / sentences.length;

  let severity: HedgeResult['severity'];
  if (density > 0.50) {
    severity = 'heavy';
  } else if (density >= 0.25) {
    severity = 'moderate';
  } else {
    severity = 'clean';
  }

  return {
    hedge_density: density,
    severity,
    hedged_sentences: hedged,
  };
}
