/**
 * check_numeric_claims — Multi-signal numeric analysis.
 *
 * Four analysis layers:
 * 1. Fabrication detection (round numbers, spacing CV, precision CV, geometric regularity)
 * 2. Outlier detection (MAD-primary for small N, Z-score secondary)
 * 3. Arithmetic verification (sum, product, compound growth, weighted average, ratio)
 * 4. Concurrency hazard scan (if context text provided)
 *
 * No LLM calls. Deterministic. Stateless.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type {
  BlockingIssue,
  EnforcementContext,
  FabricationResult,
  OutlierResult,
} from '../enforcement/types.js';
import type { ArithmeticResult } from '../enforcement/arithmetic_verifier.js';
import { checkMonotonicity, type MonotonicityResult } from '../enforcement/numeric_analysis.js';

// ====== Output Types ======

export interface NumericClaimsOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  fabrication: FabricationResult;
  outliers: OutlierResult[];
  arithmetic: ArithmeticResult;
  monotonicity?: MonotonicityResult;
  count: number;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

// ====== Validation ======

function validateInput(input: unknown): { numbers: number[]; description?: string } {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with a "numbers" array of at least 2 numbers. ' +
      'Optional field: "context" (string) to describe the data.'
    );
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.numbers)) {
    throw new Error(
      'Missing or invalid "numbers" field. Provide an array of at least 2 numbers.'
    );
  }

  const numbers = obj.numbers as unknown[];

  if (numbers.length < 2) {
    throw new Error(
      `Need at least 2 numbers, got ${numbers.length}. Provide an array of numeric values to check.`
    );
  }

  for (let i = 0; i < numbers.length; i++) {
    if (typeof numbers[i] !== 'number' || !isFinite(numbers[i] as number)) {
      throw new Error(
        `Element at index ${i} is not a valid finite number: ${String(numbers[i])}.`
      );
    }
  }

  // Accept both "context" (legacy/scenario compat) and "description" as the label field
  const description = typeof obj.description === 'string' ? obj.description
    : typeof obj.context === 'string' ? obj.context
    : undefined;

  return { numbers: numbers as number[], description };
}

// ====== Handler ======

export function handleCheckNumericClaims(
  input: unknown,
  engine: EnforcementEngine,
): NumericClaimsOutput {
  // EnforcementContext is always an object, never a string.
  // The "context" field in scenarios is a string label — handled separately.
  const obj = input as Record<string, unknown>;
  const enforcementContext = (typeof obj.context === 'object' && obj.context !== null)
    ? obj.context as EnforcementContext
    : undefined;
  const { numbers, description } = validateInput(input);

  // Layer 1: Fabrication detection (four-signal check)
  const fabrication = engine.detectFabrication(numbers);

  // Layer 2: Outlier detection (MAD-primary, Z-score secondary)
  const outliers = engine.findOutliers(numbers);

  // Layer 3: Arithmetic verification
  // Enable compound growth checks only when description mentions growth/interest/rate
  const growthHint = description && /\b(?:interest|growth|compound|rate|annual|year|period)\b/i.test(description)
    ? 'growth' : undefined;
  const arithmetic = engine.verifyArithmetic(numbers, growthHint);

  // Layer 4: Monotonicity check (for percentiles, SLA tiers, etc.)
  const isOrderedContext = description && /\b(?:percentile|p\d{2}|quantile|SLA|tier|cumulative|rank)\b/i.test(description);
  const monotonicity = isOrderedContext ? checkMonotonicity(numbers) : undefined;

  // Enforcement
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  if (fabrication.suspicion === 'high') {
    blockingIssues.push({
      mechanism: 'fabrication_detection',
      description:
        `High fabrication suspicion detected. ` +
        `Round-number ratio: ${fabrication.round_number_ratio.toFixed(2)}, ` +
        `spacing CV: ${fabrication.spacing_cv.toFixed(2)}, ` +
        `precision CV: ${fabrication.precision_cv.toFixed(2)}.` +
        (description ? ` Context: ${description}` : ''),
      severity: 'blocking',
    });
  } else if (fabrication.suspicion === 'moderate') {
    warnings.push(
      `Moderate fabrication suspicion. ` +
      `Round-number ratio: ${fabrication.round_number_ratio.toFixed(2)}, ` +
      `spacing CV: ${fabrication.spacing_cv.toFixed(2)}, ` +
      `precision CV: ${fabrication.precision_cv.toFixed(2)}.`
    );
  }

  if (outliers.length > 0) {
    warnings.push(
      `Found ${outliers.length} statistical outlier(s): ` +
      outliers.map(o => `value=${o.value} (z=${o.z_score.toFixed(2)}, index=${o.index})`).join(', ') +
      '. Verify these values are accurate.'
    );
  }

  // Arithmetic relationships found (informational, adds specificity)
  if (arithmetic.checks.length > 0) {
    const relationships = arithmetic.checks.map(c => c.relationship);
    warnings.push(
      `Detected ${arithmetic.checks.length} arithmetic relationship(s): ` +
      relationships.join('; ') + '.'
    );
  }

  if (!arithmetic.all_pass) {
    blockingIssues.push({
      mechanism: 'arithmetic_inconsistency',
      description: `Arithmetic inconsistencies: ${arithmetic.inconsistencies.join('; ')}`,
      severity: 'blocking',
    });
  }

  // Monotonicity violations
  if (monotonicity && !monotonicity.is_monotonic) {
    const viols = monotonicity.violations.map(
      v => `index ${v.index}: ${v.value} < previous ${v.previous}`
    ).join('; ');
    warnings.push(
      `Monotonicity violation: sequence should be ${monotonicity.direction || 'increasing'} ` +
      `but has ${monotonicity.violations.length} violation(s): ${viols}.`
    );
  }

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'check_numeric_claims', undefined, enforcementContext)
    : '';

  const result: NumericClaimsOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    fabrication,
    outliers,
    arithmetic,
    monotonicity,
    count: numbers.length,
    context_used: !!enforcementContext,
  };

  if (hasFail || warnings.length > 0) {
    result.enforcement = {
      blocking_issues: blockingIssues,
      warnings,
      corrective_prompt: correctivePrompt,
    };
  }

  return result;
}
