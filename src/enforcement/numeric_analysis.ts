/**
 * Numeric analysis — fabrication detection and outlier detection.
 *
 * Fabrication detection: four-signal approach
 *   1. Round-number ratio (divisible by 5 or 10)
 *   2. Spacing CV (coefficient of variation of sorted gaps)
 *   3. Precision CV (coefficient of variation of decimal places)
 *   4. Geometric ratio consistency (constant ratio between consecutive sorted values)
 *
 * Outlier detection: MAD-primary, Z-score secondary
 *   - MAD resists single-outlier std inflation on small N
 *   - Falls back to range-based detection when MAD=0 (identical majority)
 *   - Z-score as secondary for larger sets
 *
 * Deterministic. Stateless. No LLM calls.
 */

import type { FabricationResult, OutlierResult } from './types.js';
import {
  mean,
  std,
  zScore,
  coefficientOfVariation,
  median,
  mad,
  madZScore,
} from './utils.js';

// ─── Fabrication detection ─────────────────────────────────────────────────

function decimalPlaces(n: number): number {
  const s = String(n);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function detectFabrication(numbers: number[]): FabricationResult {
  if (numbers.length === 0) {
    return {
      round_number_ratio: 0,
      spacing_cv: 0,
      precision_cv: 0,
      geometric_regularity: 0,
      suspicion: 'low',
    };
  }

  // Signal 1 — round number ratio (divisible by 5 or 10)
  const roundCount = numbers.filter(n => n % 5 === 0).length;
  const round_number_ratio = roundCount / numbers.length;

  // Signal 2 — spacing CV (coefficient of variation of gaps between sorted values)
  const sorted = [...numbers].sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i] - sorted[i - 1]);
  }
  const spacing_cv = gaps.length > 0 ? coefficientOfVariation(gaps) : 0;

  // Signal 3 — precision CV (coefficient of variation of decimal places)
  const precisions = numbers.map(decimalPlaces);
  const precision_cv = precisions.length > 0 ? coefficientOfVariation(precisions) : 0;

  // Signal 4 — geometric ratio consistency
  let geometric_regularity = 0;
  if (sorted.length >= 3 && sorted[0] > 0) {
    const ratios: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i - 1] > 0) {
        ratios.push(sorted[i] / sorted[i - 1]);
      }
    }
    if (ratios.length >= 2) {
      const ratioCv = coefficientOfVariation(ratios);
      geometric_regularity = ratioCv < 0.15 ? 1 : ratioCv < 0.3 ? 0.5 : 0;
    }
  }

  // Suspicion classification — four-signal approach
  let suspiciousCount = 0;
  if (round_number_ratio > 0.6) suspiciousCount++;
  if (spacing_cv < 0.5) suspiciousCount++;
  if (precision_cv < 0.3) suspiciousCount++;
  if (geometric_regularity >= 0.5) suspiciousCount++;

  let suspicion: FabricationResult['suspicion'];
  if (suspiciousCount >= 3 || (round_number_ratio > 0.7 && spacing_cv < 0.3)) {
    suspicion = 'high';
  } else if (suspiciousCount === 2) {
    suspicion = 'moderate';
  } else {
    suspicion = 'low';
  }

  return { round_number_ratio, spacing_cv, precision_cv, geometric_regularity, suspicion };
}

// ─── Outlier detection ─────────────────────────────────────────────────────

export function findOutliers(numbers: number[]): OutlierResult[] {
  if (numbers.length < 3) return [];

  const outliers: OutlierResult[] = [];

  // Primary: MAD-based detection
  const med = median(numbers);
  const madValue = mad(numbers);

  if (madValue > 0) {
    const threshold = numbers.length < 10 ? 3.0 : 3.5;
    for (let i = 0; i < numbers.length; i++) {
      const mz = madZScore(numbers[i], med, madValue);
      if (Math.abs(mz) > threshold) {
        outliers.push({ value: numbers[i], z_score: mz, index: i });
      }
    }
  } else if (madValue === 0) {
    // MAD=0: majority identical. Use range-based fallback.
    const range = Math.max(...numbers) - Math.min(...numbers);
    if (range > 0) {
      for (let i = 0; i < numbers.length; i++) {
        const distFromMedian = Math.abs(numbers[i] - med);
        if (distFromMedian / range > 0.8) {
          outliers.push({ value: numbers[i], z_score: distFromMedian / range * 10, index: i });
        }
      }
    }
  }

  // Secondary: standard Z-score for larger sets where MAD didn't fire
  if (outliers.length === 0) {
    const m = mean(numbers);
    const s = std(numbers);
    if (s > 0) {
      for (let i = 0; i < numbers.length; i++) {
        const z = zScore(numbers[i], m, s);
        if (Math.abs(z) > 2.5) {
          outliers.push({ value: numbers[i], z_score: z, index: i });
        }
      }
    }
  }

  return outliers;
}

// ─── Monotonicity check ────────────────────────────────────────────────────

export interface MonotonicityResult {
  is_monotonic: boolean;
  direction: 'increasing' | 'decreasing' | 'neither';
  violations: { index: number; value: number; previous: number }[];
}

/**
 * Check whether a sequence is monotonically ordered.
 * Useful for percentiles, cumulative distributions, SLA tiers.
 */
export function checkMonotonicity(numbers: number[]): MonotonicityResult {
  if (numbers.length < 2) {
    return { is_monotonic: true, direction: 'neither', violations: [] };
  }

  const violations: { index: number; value: number; previous: number }[] = [];
  let increasing = true;
  let decreasing = true;

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] < numbers[i - 1]) {
      increasing = false;
      violations.push({ index: i, value: numbers[i], previous: numbers[i - 1] });
    }
    if (numbers[i] > numbers[i - 1]) {
      decreasing = false;
    }
  }

  const direction = increasing ? 'increasing' : decreasing ? 'decreasing' : 'neither';
  return { is_monotonic: increasing || decreasing, direction, violations };
}
