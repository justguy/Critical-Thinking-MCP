/**
 * Falsifiability checker.
 *
 * Every counter-argument must name a specific observable condition.
 * Markers: numerical thresholds, named components, observable outcomes
 * (error codes, crash conditions, measurable states).
 *
 * Score = measurable_args / total_args.  Passes if >= 0.5.
 */

import type { FalsifiabilityResult } from './types.js';
import { isMeasurable, isHighPrecisionMeasurable } from './markers.js';
import { jaccardSimilarity, tokenize } from './utils.js';

// `isMeasurable` is the union of HIGH+LOW precision markers (see markers.ts) — it
// preserves the legacy behavior of this checker. New BLOCK-bearing checks should use
// `isHighPrecisionMeasurable` instead to avoid the low-precision false-positive surface.

/**
 * Check falsifiability of a list of counter-arguments.
 */
export function checkFalsifiability(args: string[]): FalsifiabilityResult {
  if (args.length === 0) {
    return { score: 0, passes: false, unfalsifiable: [] };
  }

  const unfalsifiable: string[] = [];
  let measurableCount = 0;

  for (const arg of args) {
    if (isMeasurable(arg)) {
      measurableCount++;
    } else {
      unfalsifiable.push(arg);
    }
  }

  const score = measurableCount / args.length;
  return {
    score,
    passes: score >= 0.5,
    unfalsifiable,
  };
}

// ─── Tier-2: bind a falsification condition to its assumption ────────────────

const BIND_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'will',
  'would', 'can', 'could', 'should', 'may', 'might', 'must', 'do', 'does', 'did',
  'has', 'have', 'had', 'of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by',
  'as', 'it', 'its', 'this', 'that', 'these', 'those', 'and', 'or', 'not', 'if',
  'when', 'within', 'after', 'before', 'under', 'over', 'than', 'then', 'fails',
  'fail', 'wrong', 'confident', 'confidence', 'condition',
  // generic verbs that bind nothing specific (keep nouns out so real subjects still bind)
  'handles', 'handle', 'exceeds', 'exceed', 'returns', 'return', 'improves',
  'improve', 'uses', 'use', 'works', 'work', 'contains', 'contain',
]);

function identifierTokens(s: string): Set<string> {
  const ids = new Set<string>();
  for (const m of s.match(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g) ?? []) ids.add(m.toLowerCase()); // CamelCase
  for (const m of s.match(/\b\w+\.\w+(?:\.\w+)*\b/g) ?? []) ids.add(m.toLowerCase()); // dotted.path
  for (const m of s.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) ?? []) ids.add(m.toLowerCase()); // UPPER_SNAKE
  return ids;
}

function contentTokens(s: string): Set<string> {
  return new Set(tokenize(s).filter(t => t.length > 2 && !BIND_STOPWORDS.has(t)));
}

/**
 * A falsification condition is "bound" to its assumption iff it shares an identifier
 * token (CamelCase / dotted.path / UPPER_SNAKE) or a non-stopword content token with
 * the assumption description. Stops the "drop a free-floating 200ms into any
 * condition" trick — the agent must name WHAT is observed about the thing it assumed.
 */
export function isBoundToAssumption(description: string, condition: string): boolean {
  const descIds = identifierTokens(description);
  for (const id of identifierTokens(condition)) {
    if (descIds.has(id)) return true;
  }
  const descContent = contentTokens(description);
  for (const t of contentTokens(condition)) {
    if (descContent.has(t)) return true;
  }
  return false;
}

export interface BoundFalsifiability {
  description: string;
  condition: string;
  measurable: boolean; // HIGH-precision marker present
  bound: boolean; // shares subject with the assumption
}

/**
 * Per-assumption falsifiability that also checks subject-binding. Uses HIGH-precision
 * markers for `measurable` (only those are strong enough to anchor a real observation).
 */
export function checkFalsifiabilityBound(
  pairs: { description: string; condition: string }[],
): BoundFalsifiability[] {
  return pairs.map(p => ({
    description: p.description,
    condition: p.condition,
    measurable: isHighPrecisionMeasurable(p.condition),
    bound: isBoundToAssumption(p.description, p.condition),
  }));
}

// ─── Tier-2: tautology / bare-negation guard ────────────────────────────────

const COMPARATOR_WORDS =
  /[<>≤≥]=?\s*\d|\b(?:more|less|greater|fewer|under|over|exceeds?|below|above|at\s+least|at\s+most)\b/i;
const BARE_NEGATION =
  /\b(?:is|are|does|do|will|would|can|could)\s+(?:not|n['’]?t)\b|\b(?:cannot|can['’]?t|won['’]?t)\b|\bfails?\b.*\b(?:not\s+work|does\s*n['’]?t\s+work|is\s+(?:wrong|false|incorrect))\b/i;
const VAGUE_DEGREE =
  /\b(?:too\s+(?:slow|fast|high|low|big|small|much|many|large)|bad|poor|insufficient|inadequate|unacceptable)\b/i;

/**
 * A condition is tautological / non-directional when it carries NO measurable marker
 * AND no comparator AND it is either a bare negation, a vague-degree phrase, or a
 * near-restatement of the assumption (bigram-Jaccard > 0.85). Any threshold-bearing
 * condition is exempt, bounding false positives. WARNING-only signal.
 */
export function isTautological(description: string, condition: string): boolean {
  if (isMeasurable(condition) || COMPARATOR_WORDS.test(condition)) return false;
  if (VAGUE_DEGREE.test(condition)) return true;
  if (jaccardSimilarity(description, condition) > 0.85) return true;
  if (BARE_NEGATION.test(condition)) {
    // A negation is only tautological if it adds essentially NO new content vs the
    // assumption ("fails if it doesn't work"). A specific negative condition
    // ("the parser does not handle UTF-8 input") names a real, checkable behavior.
    const descContent = contentTokens(description);
    const novel = [...contentTokens(condition)].filter(t => !descContent.has(t));
    return novel.length <= 1;
  }
  return false;
}
