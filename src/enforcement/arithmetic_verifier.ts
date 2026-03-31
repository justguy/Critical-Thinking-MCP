/**
 * Arithmetic / formula verifier.
 *
 * Checks whether numeric claims are internally consistent with
 * stated relationships. Does NOT check fabrication — that's the
 * fabrication detector's job.
 *
 * Targets: sum, product, power/growth, weighted average, ratio,
 * percentage, and FTE/capacity formulas.
 *
 * Deterministic. Stateless. No LLM calls.
 */

export interface ArithmeticCheck {
  relationship: string;
  expected: number;
  actual: number;
  passes: boolean;
  tolerance: number;
}

export interface ArithmeticResult {
  checks: ArithmeticCheck[];
  all_pass: boolean;
  inconsistencies: string[];
}

// ─── Pattern detectors ─────────────────────────────────────────────────────

const TOLERANCE = 0.005; // 0.5% relative tolerance — tight enough to avoid false matches

function approxEqual(a: number, b: number, tol: number = TOLERANCE): boolean {
  if (a === 0 && b === 0) return true;
  if (a === 0 || b === 0) return Math.abs(a - b) < 1;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b)) <= tol;
}

/** Check if any number is the sum of others, or close to it (near-miss = inconsistency). */
function checkSums(numbers: number[]): ArithmeticCheck[] {
  const checks: ArithmeticCheck[] = [];
  if (numbers.length < 3) return checks;

  for (let i = 0; i < numbers.length; i++) {
    const target = numbers[i];
    const rest = numbers.filter((_, j) => j !== i);

    // Check if target is sum of all others
    const sum = rest.reduce((a, b) => a + b, 0);
    if (approxEqual(target, sum)) {
      checks.push({
        relationship: `sum(others) = ${target}`,
        expected: sum,
        actual: target,
        passes: true,
        tolerance: TOLERANCE,
      });
    } else if (target > 0 && sum > 0) {
      // Near-miss: target looks like it could be a total but doesn't match
      // Only flag if the target is the largest number (likely a claimed total)
      // and the error is within 20% (close enough to be a plausible mistake)
      const isLargest = rest.every(r => target >= r);
      const relError = Math.abs(target - sum) / Math.max(target, sum);
      if (isLargest && relError < 0.20 && relError > TOLERANCE) {
        checks.push({
          relationship: `sum(others) = ${sum}, claimed ${target}`,
          expected: sum,
          actual: target,
          passes: false,
          tolerance: TOLERANCE,
        });
      }
    }
  }
  return checks;
}

/** Check if any number is the product of a subset of others. */
function checkProducts(numbers: number[]): ArithmeticCheck[] {
  const checks: ArithmeticCheck[] = [];
  if (numbers.length < 3) return checks;

  for (let i = 0; i < numbers.length; i++) {
    const target = numbers[i];
    const rest = numbers.filter((_, j) => j !== i);

    // Check pairwise products
    for (let j = 0; j < rest.length; j++) {
      for (let k = j + 1; k < rest.length; k++) {
        const product = rest[j] * rest[k];
        if (approxEqual(target, product) && target > 1) {
          checks.push({
            relationship: `${rest[j]} × ${rest[k]} = ${target}`,
            expected: product,
            actual: target,
            passes: true,
            tolerance: TOLERANCE,
          });
        }
      }
    }
  }
  return checks;
}

/** Check compound growth: principal × (1 + rate)^periods = future_value. */
function checkCompoundGrowth(numbers: number[]): ArithmeticCheck[] {
  const checks: ArithmeticCheck[] = [];
  if (numbers.length < 2) return checks;

  // Only check pairs where ratio > 1.1 (meaningful growth)
  // Keep only the best (lowest-rate) match per principal/future pair
  for (let i = 0; i < numbers.length; i++) {
    for (let j = 0; j < numbers.length; j++) {
      if (i === j) continue;
      const principal = numbers[i];
      const future = numbers[j];
      if (principal <= 0 || future / principal <= 1.1) continue;

      let bestMatch: ArithmeticCheck | null = null;

      for (const rate of [0.03, 0.04, 0.05, 0.06, 0.07, 0.08, 0.10, 0.12, 0.15]) {
        for (let periods = 2; periods <= 20; periods++) {
          const expected = principal * Math.pow(1 + rate, periods);
          if (approxEqual(future, expected)) {
            if (!bestMatch) {
              bestMatch = {
                relationship: `${principal} × (1 + ${rate})^${periods} = ${future}`,
                expected: Math.round(expected * 100) / 100,
                actual: future,
                passes: true,
                tolerance: TOLERANCE,
              };
            }
            break;
          }
        }
        if (bestMatch) break; // take first (lowest) rate match
      }

      if (bestMatch) checks.push(bestMatch);
    }
  }
  return checks;
}

/** Check weighted average / FTE formulas: a + b*weight = result. */
function checkWeightedCombinations(numbers: number[]): ArithmeticCheck[] {
  const checks: ArithmeticCheck[] = [];
  if (numbers.length < 4 || numbers.length > 10) return checks;

  // Look for a + b*c = d patterns — cap at first 3 matches to avoid noise
  for (let i = 0; i < numbers.length && checks.length < 3; i++) {
    for (let j = 0; j < numbers.length && checks.length < 3; j++) {
      if (j === i) continue;
      for (let k = 0; k < numbers.length && checks.length < 3; k++) {
        if (k === i || k === j) continue;
        const product = numbers[j] * numbers[k];
        const result = numbers[i] + product;
        if (result <= 0) continue;
        for (let l = 0; l < numbers.length; l++) {
          if (l === i || l === j || l === k) continue;
          if (approxEqual(numbers[l], result)) {
            checks.push({
              relationship: `${numbers[i]} + ${numbers[j]} × ${numbers[k]} = ${numbers[l]}`,
              expected: result,
              actual: numbers[l],
              passes: true,
              tolerance: TOLERANCE,
            });
            break;
          }
        }
      }
    }
  }
  return checks;
}

/** Check weighted sums: find numbers that look like weights (sum to ~1.0) and a claimed total. */
/** Check weighted sums: find numbers that look like weights (sum to ~1.0) and a claimed total. */
function checkWeightedSums(numbers: number[]): ArithmeticCheck[] {
  if (numbers.length < 5) return [];

  const weights = numbers.filter(n => n > 0 && n < 1);
  const values = numbers.filter(n => n >= 1);

  if (weights.length < 2 || values.length < weights.length) return [];

  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1.0) > 0.05) return [];

  const sortedWeights = [...weights].sort((a, b) => b - a);
  if (sortedWeights.length > 4 || values.length < sortedWeights.length + 1) return [];

  // Collect all matches, then only report near-misses if no exact match exists
  const exact: ArithmeticCheck[] = [];
  const nearMiss: ArithmeticCheck[] = [];

  for (const claimedResult of values) {
    const remaining = values.filter(v => v !== claimedResult);
    if (remaining.length < sortedWeights.length) continue;

    const paired = remaining.slice(0, sortedWeights.length);
    const wSum = paired.reduce((acc, v, idx) => acc + v * sortedWeights[idx], 0);
    const terms = paired.map((v, idx) => `${v}×${sortedWeights[idx]}`).join(' + ');

    if (approxEqual(claimedResult, wSum)) {
      exact.push({
        relationship: `${terms} = ${wSum.toFixed(2)} (claimed ${claimedResult})`,
        expected: Math.round(wSum * 100) / 100,
        actual: claimedResult,
        passes: true,
        tolerance: TOLERANCE,
      });
    } else {
      const relError = Math.abs(claimedResult - wSum) / Math.max(claimedResult, wSum);
      if (relError < 0.03 && relError > TOLERANCE) {
        nearMiss.push({
          relationship: `${terms} = ${wSum.toFixed(2)}, claimed ${claimedResult}`,
          expected: Math.round(wSum * 100) / 100,
          actual: claimedResult,
          passes: false,
          tolerance: TOLERANCE,
        });
      }
    }
  }

  // Only report near-misses if no exact match found — avoids false positives
  return exact.length > 0 ? exact : nearMiss;
}

/** Check simple ratios/percentages between pairs. */
function checkRatios(numbers: number[]): ArithmeticCheck[] {
  const checks: ArithmeticCheck[] = [];
  if (numbers.length < 2) return checks;

  for (let i = 0; i < numbers.length; i++) {
    for (let j = 0; j < numbers.length; j++) {
      if (i === j || numbers[j] === 0) continue;
      const ratio = numbers[i] / numbers[j];
      // Check if the ratio itself appears in the numbers (as percentage or multiplier)
      for (let k = 0; k < numbers.length; k++) {
        if (k === i || k === j) continue;
        if (approxEqual(numbers[k], ratio) || approxEqual(numbers[k], ratio * 100)) {
          checks.push({
            relationship: `${numbers[i]} / ${numbers[j]} = ${numbers[k]}`,
            expected: ratio,
            actual: numbers[k] > 1 ? numbers[k] / 100 : numbers[k],
            passes: true,
            tolerance: TOLERANCE,
          });
        }
      }
    }
  }
  return checks;
}

/**
 * Verify arithmetic relationships among a set of numbers.
 *
 * Compound growth checks are off by default — they produce false
 * positives on arbitrary number pairs. Enable with hint='growth'
 * when the context mentions interest, growth rates, or compounding.
 *
 * Returns all detected relationships and whether they hold.
 */
export function verifyArithmetic(numbers: number[], hint?: string): ArithmeticResult {
  if (numbers.length < 2) {
    return { checks: [], all_pass: true, inconsistencies: [] };
  }

  const allChecks: ArithmeticCheck[] = [
    ...checkSums(numbers),
    ...checkProducts(numbers),
    ...(hint === 'growth' ? checkCompoundGrowth(numbers) : []),
    ...checkWeightedCombinations(numbers),
    ...checkWeightedSums(numbers),
    ...checkRatios(numbers),
  ];

  // Deduplicate by relationship string
  const seen = new Set<string>();
  const checks = allChecks.filter(c => {
    if (seen.has(c.relationship)) return false;
    seen.add(c.relationship);
    return true;
  });

  const inconsistencies = checks
    .filter(c => !c.passes)
    .map(c => `${c.relationship}: expected ${c.expected}, got ${c.actual}`);

  return {
    checks,
    all_pass: inconsistencies.length === 0,
    inconsistencies,
  };
}
