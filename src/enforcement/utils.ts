/**
 * Shared text utilities for the enforcement engine.
 * All functions are pure and deterministic — no LLM calls.
 */

/** Lowercase word tokenization — strips non-alphanumeric characters. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
}

/** Consecutive word pairs from a token array. */
export function bigrams(words: string[]): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < words.length - 1; i++) {
    result.add(`${words[i]} ${words[i + 1]}`);
  }
  return result;
}

/** Jaccard similarity on bigram sets of two strings. */
export function jaccardSimilarity(a: string, b: string): number {
  const bigramsA = bigrams(tokenize(a));
  const bigramsB = bigrams(tokenize(b));

  if (bigramsA.size === 0 && bigramsB.size === 0) return 1;
  if (bigramsA.size === 0 || bigramsB.size === 0) return 0;

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }
  const union = bigramsA.size + bigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Split text on sentence boundaries (., !, ?). */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/** Arithmetic mean. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Population standard deviation. */
export function std(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Coefficient of variation (std / mean). Returns 0 if mean is 0. */
export function coefficientOfVariation(values: number[]): number {
  const m = mean(values);
  if (m === 0) return 0;
  return std(values) / Math.abs(m);
}

/** Z-score of a value given a population mean and std. */
export function zScore(value: number, m: number, s: number): number {
  if (s === 0) return 0;
  return (value - m) / s;
}

/** Median of a numeric array. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Median Absolute Deviation — robust scale estimator.
 * MAD = median(|x_i - median(x)|)
 * Resistant to single-outlier inflation that breaks std on small N.
 */
export function mad(values: number[]): number {
  if (values.length === 0) return 0;
  const med = median(values);
  const deviations = values.map(v => Math.abs(v - med));
  return median(deviations);
}

/**
 * Modified Z-score using MAD instead of std.
 * Formula: 0.6745 * (x - median) / MAD
 * The 0.6745 factor makes it comparable to standard Z-scores
 * for normally distributed data.
 */
export function madZScore(value: number, med: number, madValue: number): number {
  if (madValue === 0) return 0;
  return 0.6745 * (value - med) / madValue;
}
