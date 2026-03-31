/**
 * verify_arithmetic — Deterministic arithmetic relationship verification.
 *
 * Verifies that a claimed result matches the computation defined by
 * structured input. Does NOT detect suspicious patterns — that's
 * check_numeric_claims. This tool answers: "is the math correct?"
 *
 * Supported claim types:
 * - sum: sum(values) == claimed_result
 * - weighted_average: sum(values[i] * weights[i]) == claimed_result
 * - percentage: (part / whole) * 100 == claimed_result
 * - growth: principal * (1 + rate)^periods == claimed_result
 * - product: product(values) == claimed_result
 *
 * Deterministic. Stateless. No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { BlockingIssue, EnforcementContext } from '../enforcement/types.js';

// ====== Types ======

export type ClaimType = 'sum' | 'weighted_average' | 'percentage' | 'growth' | 'product';

export interface ArithmeticInput {
  claim_type: ClaimType;
  values: number[];
  weights?: number[];
  claimed_result: number;
  tolerance?: number;
  // growth-specific
  rate?: number;
  periods?: number;
  // percentage-specific
  part?: number;
  whole?: number;
}

export interface ArithmeticOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  claim_type: ClaimType;
  computed_result: number;
  claimed_result: number;
  difference: number;
  within_tolerance: boolean;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

// ====== Validation ======

function validateInput(input: unknown): ArithmeticInput {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "claim_type", "values" (or "part"/"whole"), and "claimed_result". ' +
      'Supported claim_type: "sum", "weighted_average", "percentage", "growth", "product".'
    );
  }

  const obj = input as Record<string, unknown>;
  const validTypes: ClaimType[] = ['sum', 'weighted_average', 'percentage', 'growth', 'product'];

  if (!validTypes.includes(obj.claim_type as ClaimType)) {
    throw new Error(
      `Invalid claim_type "${obj.claim_type}". Must be one of: ${validTypes.join(', ')}.`
    );
  }

  const claimType = obj.claim_type as ClaimType;

  if (typeof obj.claimed_result !== 'number' || !isFinite(obj.claimed_result)) {
    throw new Error('claimed_result must be a finite number.');
  }

  if (claimType === 'percentage') {
    if (typeof obj.part !== 'number' || typeof obj.whole !== 'number') {
      throw new Error('percentage claim_type requires "part" and "whole" (numbers).');
    }
    if (obj.whole === 0) {
      throw new Error('whole cannot be zero for percentage calculation.');
    }
    return {
      claim_type: claimType,
      values: [],
      claimed_result: obj.claimed_result as number,
      tolerance: typeof obj.tolerance === 'number' ? obj.tolerance : undefined,
      part: obj.part as number,
      whole: obj.whole as number,
    };
  }

  if (claimType === 'growth') {
    if (typeof obj.rate !== 'number' || typeof obj.periods !== 'number') {
      throw new Error('growth claim_type requires "rate" and "periods" (numbers).');
    }
    if (!Array.isArray(obj.values) || obj.values.length < 1) {
      throw new Error('growth claim_type requires "values" with at least the principal.');
    }
    return {
      claim_type: claimType,
      values: obj.values as number[],
      claimed_result: obj.claimed_result as number,
      tolerance: typeof obj.tolerance === 'number' ? obj.tolerance : undefined,
      rate: obj.rate as number,
      periods: obj.periods as number,
    };
  }

  if (!Array.isArray(obj.values) || obj.values.length < 2) {
    throw new Error(`${claimType} claim_type requires "values" array with at least 2 numbers.`);
  }

  for (let i = 0; i < (obj.values as unknown[]).length; i++) {
    if (typeof (obj.values as unknown[])[i] !== 'number') {
      throw new Error(`values[${i}] is not a number.`);
    }
  }

  if (claimType === 'weighted_average') {
    if (!Array.isArray(obj.weights) || obj.weights.length !== (obj.values as unknown[]).length) {
      throw new Error('weighted_average requires "weights" array same length as "values".');
    }
  }

  return {
    claim_type: claimType,
    values: obj.values as number[],
    weights: Array.isArray(obj.weights) ? obj.weights as number[] : undefined,
    claimed_result: obj.claimed_result as number,
    tolerance: typeof obj.tolerance === 'number' ? obj.tolerance : undefined,
  };
}

// ====== Computation ======

function compute(input: ArithmeticInput): number {
  switch (input.claim_type) {
    case 'sum':
      return input.values.reduce((a, b) => a + b, 0);

    case 'weighted_average': {
      const weights = input.weights!;
      const wSum = weights.reduce((a, b) => a + b, 0);
      const total = input.values.reduce((acc, v, i) => acc + v * weights[i], 0);
      return wSum > 0 ? total / wSum : 0;
    }

    case 'percentage':
      return (input.part! / input.whole!) * 100;

    case 'growth':
      return input.values[0] * Math.pow(1 + input.rate!, input.periods!);

    case 'product':
      return input.values.reduce((a, b) => a * b, 1);
  }
}

// ====== Handler ======

export function handleVerifyArithmetic(
  input: unknown,
  engine: EnforcementEngine,
): ArithmeticOutput {
  const enforcementContext = (input as Record<string, unknown>)?.context as EnforcementContext | undefined;
  const parsed = validateInput(input);

  const computed = compute(parsed);
  const rounded = Math.round(computed * 1e9) / 1e9; // preserve precision
  const difference = Math.abs(rounded - parsed.claimed_result);

  // Strict by default: exact match to declared precision
  // If caller provides tolerance, use it; otherwise match to 2 decimal places
  const tolerance = parsed.tolerance ?? 0;
  const withinTolerance = tolerance > 0
    ? (parsed.claimed_result !== 0
        ? difference / Math.abs(parsed.claimed_result) <= tolerance
        : difference <= tolerance)
    : Math.abs(Math.round(computed * 100) / 100 - parsed.claimed_result) < 0.005;

  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  if (!withinTolerance) {
    blockingIssues.push({
      mechanism: 'arithmetic_mismatch',
      description:
        `${parsed.claim_type} verification failed. ` +
        `Computed: ${rounded}, claimed: ${parsed.claimed_result}, ` +
        `difference: ${difference.toFixed(4)}. ` +
        `Does not match to declared precision.`,
      severity: 'blocking',
    });
  }

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? `Recompute the ${parsed.claim_type} using the stated values. ` +
      `Show each term explicitly. ` +
      `Expected result: ${rounded}.`
    : '';

  return {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    claim_type: parsed.claim_type,
    computed_result: rounded,
    claimed_result: parsed.claimed_result,
    difference: Math.round(difference * 10000) / 10000,
    within_tolerance: withinTolerance,
    context_used: !!enforcementContext,
    ...(hasFail || warnings.length > 0 ? {
      enforcement: {
        blocking_issues: blockingIssues,
        warnings,
        corrective_prompt: correctivePrompt,
      },
    } : {}),
  };
}
