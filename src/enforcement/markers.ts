/**
 * Measurability markers, split by PRECISION.
 *
 * Rationale (docs/designs/robustness-additions.md → "precision-tier the markers"):
 * several markers are high-false-positive (bare 3-digit numbers fire on "step 503",
 * the version regex on "version 2.0", CamelCase on ordinary proper nouns, file-paths
 * on slashes). Propagating those into BLOCK paths multiplies the false-block surface.
 *
 * Rule: only HIGH-precision markers may drive a BLOCK; LOW-precision markers are for
 * WARNING-level signals only.
 *
 * Backward-compat: HIGH ∪ LOW is exactly the legacy MEASURABILITY_MARKERS set, so
 * `isMeasurable` (the union) preserves the existing falsifiability behavior.
 *
 * Pure, deterministic, no LLM.
 */

/** Precise, unit/threshold/code/outcome-bearing markers — safe for blocking. */
export const HIGH_PRECISION_MARKERS: RegExp[] = [
  // Numerical thresholds with units: "200 ms", "99.9%", "5 req/s"
  /\b\d+(?:\.\d+)?(?:\s*(?:%|ms|s|MB|GB|KB|req\/s|rpm|tps|rps|x))\b/i,
  // Comparators with numbers: "> 100", "< 0.5", ">= 3"
  /[<>≤≥]=?\s*\d+/,
  // Error / status codes: ERR-4012, E503-style identifiers
  /\b[A-Z]{1,5}[-_]\d{2,6}\b/,
  /\bE_[A-Z_]+\b/,
  // Observable failure outcomes
  /\b(?:crash(?:es)?|timeout|oom|deadlock|panic|segfault|stack\s*overflow|memory\s*leak)\b/i,
  // Time windows: "within 5 minutes", "after 30 seconds"
  /(?:within|after|before|under)\s+\d+\s+(?:seconds?|minutes?|hours?|days?|ms)/i,
];

/** Weak / ambiguous markers — usable for WARNINGS only, never to drive a block. */
export const LOW_PRECISION_MARKERS: RegExp[] = [
  // Bare 3-digit numbers (also matches "HTTP 503", but fires on "page 200" too)
  /\b(?:HTTP\s*)?\d{3}\b/,
  // CamelCase component names (also matches ordinary ProperNouns)
  /\b[A-Z][a-z]+(?:[A-Z][a-z]+){1,}\b/,
  // Dotted paths a.b.c
  /\b\w+\.\w+\.\w+\b/,
  // Version numbers (fires on "version 2.0")
  /\bv?\d+\.\d+(?:\.\d+)?\b/,
  // File paths
  /(?:\/[\w.-]+){2,}/,
];

export function isHighPrecisionMeasurable(text: string): boolean {
  return HIGH_PRECISION_MARKERS.some(re => re.test(text));
}

export function isLowPrecisionMeasurable(text: string): boolean {
  return LOW_PRECISION_MARKERS.some(re => re.test(text));
}

/** Legacy "is there any measurable marker" — union of both tiers. Behavior-preserving. */
export function isMeasurable(text: string): boolean {
  return isHighPrecisionMeasurable(text) || isLowPrecisionMeasurable(text);
}
