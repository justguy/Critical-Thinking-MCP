/**
 * Cross-field consistency checker.
 *
 * Validates internal consistency of a structured critical-thinking response:
 *   - weakest_assumption must have the lowest confidence score
 *   - if verdict is 'robust', challenges must engage stated strengths
 *   - structural contradictions are blocking; questionable items are warnings
 */

import type {
  ConsistencyInput,
  ConsistencyResult,
  ConsistencyViolation,
} from './types.js';
import { jaccardSimilarity, tokenize } from './utils.js';

/**
 * Check whether any challenge text overlaps with at least one strength text
 * (Jaccard similarity > 0.2 means there is topical engagement).
 */
function challengeEngagesStrengths(
  challenges: string[],
  strengths: string[],
): boolean {
  for (const ch of challenges) {
    for (const st of strengths) {
      if (jaccardSimilarity(ch, st) > 0.2) return true;
    }
  }
  return false;
}

/**
 * Check internal consistency of a structured response.
 */
export function checkConsistency(input: ConsistencyInput): ConsistencyResult {
  const violations: ConsistencyViolation[] = [];

  // Check 1 — weakest_assumption must have the lowest confidence
  if (input.weakest_assumption && input.all_assumptions && input.all_assumptions.length > 0) {
    const weakestName = input.weakest_assumption.name.toLowerCase();
    const weakestConf = input.weakest_assumption.confidence;

    // Find the actual minimum confidence among all assumptions
    let actualMin = Infinity;
    let actualMinDesc = '';
    for (const a of input.all_assumptions) {
      if (a.confidence < actualMin) {
        actualMin = a.confidence;
        actualMinDesc = a.description;
      }
    }

    // The stated weakest assumption must match (or be close to) the actual minimum
    // Find the assumption that matches the weakest_assumption name
    const matchingAssumption = input.all_assumptions.find(a => {
      const descLower = a.description.toLowerCase();
      return descLower.includes(weakestName) || weakestName.includes(descLower) ||
        jaccardSimilarity(descLower, weakestName) > 0.5;
    });

    if (matchingAssumption) {
      if (matchingAssumption.confidence > actualMin + 0.01) {
        violations.push({
          field: 'weakest_assumption',
          description:
            `Stated weakest assumption "${input.weakest_assumption.name}" has confidence ${matchingAssumption.confidence.toFixed(2)}, ` +
            `but "${actualMinDesc}" has lower confidence ${actualMin.toFixed(2)}.`,
          severity: 'blocking',
        });
      }
    } else if (weakestConf > actualMin + 0.01) {
      // If we cannot match by name, fall back to comparing stated confidence
      violations.push({
        field: 'weakest_assumption',
        description:
          `Stated weakest assumption confidence (${weakestConf.toFixed(2)}) is higher than ` +
          `actual minimum confidence (${actualMin.toFixed(2)}).`,
        severity: 'blocking',
      });
    }
  }

  // Check 2 — robust verdict requires challenges that engage strengths
  if (
    input.verdict?.toLowerCase() === 'robust' &&
    input.challenges &&
    input.challenges.length > 0 &&
    input.strengths &&
    input.strengths.length > 0
  ) {
    const engages = challengeEngagesStrengths(input.challenges, input.strengths);
    if (!engages) {
      violations.push({
        field: 'verdict',
        description:
          'Verdict is "robust" but none of the challenges engage the stated strengths. ' +
          'Challenges should address the strongest aspects, not ignore them.',
        severity: 'warning',
      });
    }
  }

  // Check 3 — if verdict is robust but there are very low confidence assumptions, flag
  if (
    input.verdict?.toLowerCase() === 'robust' &&
    input.all_assumptions &&
    input.all_assumptions.some(a => a.confidence < 0.5)
  ) {
    const lowConf = input.all_assumptions.filter(a => a.confidence < 0.5);
    violations.push({
      field: 'verdict',
      description:
        `Verdict is "robust" but ${lowConf.length} assumption(s) have confidence below 0.5. ` +
        'A robust verdict requires reasonably confident assumptions.',
      severity: 'warning',
    });
  }

  return {
    consistent: violations.every(v => v.severity !== 'blocking'),
    violations,
  };
}
