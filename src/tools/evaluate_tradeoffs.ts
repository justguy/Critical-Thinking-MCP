/**
 * evaluate_tradeoffs — Expected Utility calculation.
 *
 * Computes EU = sum(probability * utility) for each option.
 * Ranks by EU descending. Returns INDETERMINATE when top-2 differ by < 0.05.
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { BlockingIssue, EnforcementContext, TradeoffOption } from '../enforcement/types.js';

// ====== Output Types ======

interface RankedOption {
  name: string;
  expected_utility: number;
  rank: number;
  outcomes: {
    description: string;
    probability: number;
    utility: number;
    weighted_utility: number;
  }[];
}

export interface TradeoffOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  ranked_options: RankedOption[];
  recommended: string | null;
  is_indeterminate: boolean;
  eu_spread: number;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

// ====== Validation ======

function validateInput(input: unknown): { options: TradeoffOption[] } {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with an "options" array of at least 2 options. ' +
      'Each option needs: name (string), outcomes (array of {description, probability, utility}).'
    );
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.options)) {
    throw new Error(
      'Missing or invalid "options" array. Provide at least 2 options, each with name and outcomes.'
    );
  }

  const options = obj.options as unknown[];

  if (options.length < 2) {
    throw new Error(
      `Need at least 2 options, got ${options.length}.`
    );
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i] as Record<string, unknown>;
    if (!opt || typeof opt !== 'object') {
      throw new Error(`Option at index ${i} is not an object.`);
    }

    if (typeof opt.name !== 'string' || opt.name.length === 0) {
      throw new Error(`Option at index ${i} is missing a valid "name" (string).`);
    }

    if (!Array.isArray(opt.outcomes) || opt.outcomes.length === 0) {
      throw new Error(`Option "${opt.name}" must have at least one outcome.`);
    }

    let probSum = 0;
    const outcomes = opt.outcomes as unknown[];
    for (let j = 0; j < outcomes.length; j++) {
      const o = outcomes[j] as Record<string, unknown>;
      if (!o || typeof o !== 'object') {
        throw new Error(`Outcome at index ${j} of option "${opt.name}" is not an object.`);
      }
      if (typeof o.description !== 'string') {
        throw new Error(
          `Outcome at index ${j} of option "${opt.name}" is missing "description" (string).`
        );
      }
      if (typeof o.probability !== 'number' || !isFinite(o.probability)) {
        throw new Error(
          `Outcome at index ${j} of option "${opt.name}" has invalid "probability" — must be a finite number.`
        );
      }
      if (typeof o.utility !== 'number' || !isFinite(o.utility)) {
        throw new Error(
          `Outcome at index ${j} of option "${opt.name}" has invalid "utility" — must be a finite number.`
        );
      }
      probSum += o.probability;
    }

    if (Math.abs(probSum - 1.0) > 0.01) {
      throw new Error(
        `Option "${opt.name}" outcome probabilities sum to ${probSum.toFixed(4)}, which is not within ±0.01 of 1.0.`
      );
    }
  }

  return { options: options as TradeoffOption[] };
}

// ====== Handler ======

export function handleEvaluateTradeoffs(
  input: unknown,
  engine: EnforcementEngine,
): TradeoffOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { options } = validateInput(input);

  // Compute EU for each option
  const scored: { name: string; eu: number; option: TradeoffOption }[] = options.map(opt => {
    const eu = opt.outcomes.reduce((sum, o) => sum + o.probability * o.utility, 0);
    return { name: opt.name, eu, option: opt };
  });

  // Sort descending by EU
  scored.sort((a, b) => b.eu - a.eu);

  // Check indeterminate — relative threshold: top-2 differ by < 5% of the larger EU
  const euSpread = scored.length >= 2 ? scored[0].eu - scored[1].eu : Infinity;
  const topEU = scored.length >= 2 ? Math.max(Math.abs(scored[0].eu), 1) : 1;
  const isIndeterminate = scored.length >= 2 && Math.abs(euSpread) / topEU < 0.05;

  const rankedOptions: RankedOption[] = scored.map((s, idx) => ({
    name: s.name,
    expected_utility: Math.round(s.eu * 10000) / 10000,
    rank: idx + 1,
    outcomes: s.option.outcomes.map(o => ({
      description: o.description,
      probability: o.probability,
      utility: o.utility,
      weighted_utility: Math.round(o.probability * o.utility * 10000) / 10000,
    })),
  }));

  const recommended = isIndeterminate ? null : scored[0].name;

  // Enforcement
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  if (isIndeterminate) {
    warnings.push(
      `Top two options ("${scored[0].name}" EU=${scored[0].eu.toFixed(4)} vs "${scored[1].name}" EU=${scored[1].eu.toFixed(4)}) ` +
      `differ by only ${Math.abs(euSpread).toFixed(4)} (${(Math.abs(euSpread) / topEU * 100).toFixed(1)}% relative) — below the 5% threshold. ` +
      `Result is INDETERMINATE. Consider additional criteria to differentiate.`
    );
  }

  const correctivePrompt =
    blockingIssues.length > 0
      ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'evaluate_tradeoffs', undefined, context)
      : '';

  const result: TradeoffOutput = {
    status: blockingIssues.length > 0 ? 'ENFORCEMENT_FAIL' : 'PASS',
    ranked_options: rankedOptions,
    recommended,
    is_indeterminate: isIndeterminate,
    eu_spread: Math.round(Math.abs(euSpread) * 10000) / 10000,
    context_used: !!context,
  };

  if (blockingIssues.length > 0 || warnings.length > 0) {
    result.enforcement = {
      blocking_issues: blockingIssues,
      warnings,
      corrective_prompt: correctivePrompt,
    };
  }

  return result;
}
