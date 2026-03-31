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

/**
 * Patterns that indicate a measurable / observable condition within an argument.
 */
const MEASURABILITY_MARKERS: RegExp[] = [
  // Numerical thresholds: "200 ms", "99.9%", "> 50", "≥ 3", etc.
  /\b\d+(?:\.\d+)?(?:\s*(?:%|ms|s|MB|GB|KB|req\/s|rpm|tps|rps|x))\b/i,
  // Comparators with numbers: "> 100", "< 0.5", ">= 3"
  /[<>≤≥]=?\s*\d+/,
  // Error codes / status codes: HTTP 503, ERR-401, E_TIMEOUT
  /\b(?:HTTP\s*)?\d{3}\b/,
  /\b[A-Z]{1,5}[-_]\d{2,6}\b/,
  /\bE_[A-Z_]+\b/,
  // Observable outcomes: "crash", "timeout", "OOM", "deadlock", "502", "panic"
  /\b(?:crash(?:es)?|timeout|oom|deadlock|panic|segfault|stack\s*overflow|memory\s*leak)\b/i,
  // Named components (CamelCase or dotted identifiers)
  /\b[A-Z][a-z]+(?:[A-Z][a-z]+){1,}\b/,   // CamelCase
  /\b\w+\.\w+\.\w+\b/,                     // dotted path  a.b.c
  // Version numbers
  /\bv?\d+\.\d+(?:\.\d+)?\b/,
  // File paths
  /(?:\/[\w.-]+){2,}/,
  // Time windows: "within 5 minutes", "after 30 seconds"
  /(?:within|after|before|under)\s+\d+\s+(?:seconds?|minutes?|hours?|days?|ms)/i,
];

/**
 * Return true if the argument text contains at least one measurability marker.
 */
function isMeasurable(arg: string): boolean {
  return MEASURABILITY_MARKERS.some(re => re.test(arg));
}

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
