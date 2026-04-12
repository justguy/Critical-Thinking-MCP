/**
 * validate_confidence — Confidence product ceiling enforcement.
 *
 * Applies dependency-weighted confidence product via engine.computeConfidenceProduct.
 * Checks falsifiability of assumptions via engine.checkFalsifiability.
 * Flags inflation when gap > 0.15.
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type {
  Assumption,
  BlockingIssue,
  ConfidenceProductResult,
  EnforcementContext,
  FalsifiabilityResult,
} from '../enforcement/types.js';

// ====== Output Types ======

export interface ConfidenceOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  honest_ceiling: number;
  claimed_confidence: number | null;
  gap: number;
  inflation_detected: boolean;
  dependency_weights: number[];
  falsifiability: FalsifiabilityResult;
  assumption_count: number;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

// ====== Validation ======

function validateInput(input: unknown): {
  assumptions: Assumption[];
  response_text: string;
} {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "assumptions" (array of at least 1) and "response_text" (string, min 10 chars). ' +
      'Each assumption requires: description (string), confidence (number 0-1). ' +
      'Optional: falsification_condition (string). If you cannot state a falsification_condition, set confidence to 0.3 or below.'
    );
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.assumptions)) {
    throw new Error(
      'Missing or invalid "assumptions" array. Provide at least 1 assumption, each with: description, confidence (0-1), optional falsification_condition.'
    );
  }

  const assumptions = obj.assumptions as unknown[];

  if (assumptions.length < 1) {
    throw new Error(
      'Need at least 1 assumption. Each requires: description (string), confidence (0-1).'
    );
  }

  for (let i = 0; i < assumptions.length; i++) {
    const a = assumptions[i] as Record<string, unknown>;
    if (!a || typeof a !== 'object') {
      throw new Error(
        `Assumption at index ${i} is not an object. Required fields: description (string), confidence (number 0-1).`
      );
    }
    if (typeof a.description !== 'string' || a.description.length === 0) {
      throw new Error(
        `Assumption at index ${i} is missing a valid "description" (string). Required fields: description, confidence.`
      );
    }
    if (typeof a.confidence !== 'number' || !isFinite(a.confidence)) {
      throw new Error(
        `Assumption at index ${i} has invalid "confidence" — must be a finite number between 0 and 1. Required fields: description, confidence.`
      );
    }
    if (a.confidence < 0 || a.confidence > 1) {
      throw new Error(
        `Assumption at index ${i} has confidence=${a.confidence}, which is outside the valid range [0, 1].`
      );
    }
    if (a.falsification_condition !== undefined && typeof a.falsification_condition !== 'string') {
      throw new Error(
        `Assumption at index ${i} has invalid "falsification_condition" — must be a string if provided.`
      );
    }
  }

  if (typeof obj.response_text !== 'string' || obj.response_text.length < 10) {
    throw new Error(
      `"response_text" must be a non-empty string of at least 10 characters. Got ${typeof obj.response_text === 'string' ? obj.response_text.length + ' chars' : typeof obj.response_text}.`
    );
  }

  return {
    assumptions: assumptions as Assumption[],
    response_text: obj.response_text,
  };
}

// ====== Handler ======

export function handleValidateConfidence(
  input: unknown,
  engine: EnforcementEngine,
): ConfidenceOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { assumptions, response_text } = validateInput(input);

  // Fix 2: Cap confidence when no falsification_condition
  // If an assumption lacks a falsification_condition and has confidence > 0.3,
  // create an adjusted copy with confidence capped at 0.3.
  const cappedWarnings: string[] = [];
  const adjustedAssumptions: Assumption[] = assumptions.map(a => {
    const lacksCondition = !a.falsification_condition || a.falsification_condition.length === 0;
    if (lacksCondition && a.confidence > 0.3) {
      cappedWarnings.push(
        `Assumption '${a.description.slice(0, 60)}' lacks falsification condition — confidence capped from ${a.confidence} to 0.3`,
      );
      return { ...a, confidence: 0.3 };
    }
    return a;
  });

  // Confidence product computation uses adjusted assumptions
  const cpResult: ConfidenceProductResult = engine.computeConfidenceProduct(
    adjustedAssumptions,
    response_text,
  );

  // Falsifiability check
  const falsificationConditions = assumptions
    .map(a => a.falsification_condition)
    .filter((fc): fc is string => typeof fc === 'string' && fc.length > 0);

  const falsifiabilityResult: FalsifiabilityResult = engine.checkFalsifiability(
    falsificationConditions,
  );

  // Enforcement
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  // Include capped-confidence warnings
  warnings.push(...cappedWarnings);

  // Fix 3: Unified mechanism name — use 'confidence_product', put "inflation detected" in description
  // Inflation detection: gap > 0.15 is blocking.
  // Do not attach claim_ref here: aggregate inflation is grounded in the product of all assumptions,
  // not one specific assumption.
  if (cpResult.inflation_detected && cpResult.gap > 0.15) {
    blockingIssues.push({
      mechanism: 'confidence_product',
      description:
        `Inflation detected — claimed confidence exceeds honest ceiling by ${cpResult.gap.toFixed(3)}. ` +
        `Honest ceiling: ${cpResult.honest_ceiling.toFixed(3)}, ` +
        `claimed: ${cpResult.claimed_confidence?.toFixed(3) ?? 'unknown'}. ` +
        `Reduce claimed confidence or strengthen assumptions.`,
      severity: 'blocking',
    });
  }

  // Fix 2 continued: If ANY assumption was capped and claimed confidence is high, make it blocking.
  // claim_ref: anchor to the first capped assumption index.
  if (cappedWarnings.length > 0 && cpResult.claimed_confidence !== null && cpResult.claimed_confidence > 0.7) {
    const firstCappedIndex = adjustedAssumptions.findIndex(
      (a, i) => {
        const orig = assumptions[i];
        return (
          (!orig.falsification_condition || orig.falsification_condition.length === 0) &&
          orig.confidence > 0.3
        );
      },
    );
    blockingIssues.push({
      mechanism: 'confidence_product',
      description:
        `${cappedWarnings.length} assumption(s) lack falsification conditions — confidence was capped to 0.3, ` +
        `but response claims high confidence (${cpResult.claimed_confidence.toFixed(3)}). ` +
        `Add falsification conditions or reduce claimed confidence.`,
      severity: 'blocking',
      ...(firstCappedIndex >= 0 ? { claim_ref: `assumption:${firstCappedIndex}` } : {}),
    });
  }

  // Fix 7: If more than half of assumptions lack falsification conditions AND claimed confidence > 0.7, blocking
  const unfalsifiableCount = assumptions.filter(
    a => !a.falsification_condition || a.falsification_condition.length === 0,
  ).length;
  if (
    unfalsifiableCount > assumptions.length / 2 &&
    cpResult.claimed_confidence !== null &&
    cpResult.claimed_confidence > 0.7
  ) {
    // Avoid duplicate if Fix 2 already added a similar blocking issue
    const alreadyBlocked = blockingIssues.some(
      b => b.mechanism === 'confidence_product' && b.description.includes('lack falsification conditions'),
    );
    if (!alreadyBlocked) {
      // claim_ref: first assumption that lacks a falsification condition
      const firstUnfalsifiableIndex = assumptions.findIndex(
        a => !a.falsification_condition || a.falsification_condition.length === 0,
      );
      blockingIssues.push({
        mechanism: 'confidence_product',
        description:
          'Majority of assumptions lack falsification conditions with high claimed confidence',
        severity: 'blocking',
        ...(firstUnfalsifiableIndex >= 0 ? { claim_ref: `assumption:${firstUnfalsifiableIndex}` } : {}),
      });
    }
  }

  // Per-assumption warnings for those without falsification_condition and original confidence > 0.3
  for (let i = 0; i < assumptions.length; i++) {
    const a = assumptions[i];
    if (
      (!a.falsification_condition || a.falsification_condition.length === 0) &&
      a.confidence > 0.3
    ) {
      warnings.push(
        `Assumption ${i} ("${a.description.slice(0, 60)}...") has confidence ${a.confidence} ` +
        `but no falsification_condition. Either add a concrete falsification condition or reduce confidence to 0.3 or below.`
      );
    }
  }

  // Low falsifiability score
  if (!falsifiabilityResult.passes) {
    warnings.push(
      `Falsifiability score: ${falsifiabilityResult.score.toFixed(2)}. ` +
      `Unfalsifiable conditions: ${falsifiabilityResult.unfalsifiable.join('; ') || 'none provided'}.`
    );
  }

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'validate_confidence', adjustedAssumptions, context)
    : '';

  const result: ConfidenceOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    honest_ceiling: Math.round(cpResult.honest_ceiling * 1000) / 1000,
    claimed_confidence: cpResult.claimed_confidence,
    gap: Math.round(cpResult.gap * 1000) / 1000,
    inflation_detected: cpResult.inflation_detected,
    dependency_weights: cpResult.dependency_weights,
    falsifiability: falsifiabilityResult,
    assumption_count: assumptions.length,
    context_used: !!context,
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
