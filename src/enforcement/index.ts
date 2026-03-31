/**
 * EnforcementEngine — wraps all 8 deterministic mechanisms and provides
 * two-tier corrective prompt escalation.
 *
 * No LLM calls.  Every method is pure & deterministic.
 */

import type {
  Assumption,
  BlockingIssue,
  ConfidenceProductResult,
  ConsistencyInput,
  ConsistencyResult,
  EnforcementContext,
  FabricationResult,
  FalsifiabilityResult,
  HedgeResult,
  LoopGovernorEntry,
  LoopGovernorResult,
  OutlierResult,
  RevisionContrastResult,
  SpecificityResult,
  SteelmanResult,
} from './types.js';

import { computeConfidenceProduct as _computeConfidenceProduct } from './confidence_product.js';
import { scoreSpecificity as _scoreSpecificity } from './specificity_scorer.js';
import { checkConsistency as _checkConsistency } from './consistency_checker.js';
import { detectHedging as _detectHedging } from './hedge_detector.js';
import { checkFalsifiability as _checkFalsifiability } from './falsifiability_checker.js';
import { compareSteelman as _compareSteelman } from './steelman_similarity.js';
import { checkRevision as _checkRevision } from './revision_contrast.js';
import { checkLoop as _checkLoop } from './loop_governor.js';
// utils.js re-exported via export * below

import { detectFabrication as _detectFabrication, findOutliers as _findOutliers } from './numeric_analysis.js';
import { verifyArithmetic as _verifyArithmetic } from './arithmetic_verifier.js';
import { checkConcurrencyHazards as _checkConcurrencyHazards } from './concurrency_checker.js';
import { classifyClaim as _classifyClaim, classifyClaims as _classifyClaims } from './claim_classifier.js';
import { checkEntityGrounding as _checkEntityGrounding } from './entity_grounding.js';

// ─── Re-exports for convenience ─────────────────────────────────────────────
export { computeConfidenceProduct } from './confidence_product.js';
export { scoreSpecificity } from './specificity_scorer.js';
export { checkConsistency } from './consistency_checker.js';
export { detectHedging } from './hedge_detector.js';
export { checkFalsifiability } from './falsifiability_checker.js';
export { compareSteelman } from './steelman_similarity.js';
export { checkRevision } from './revision_contrast.js';
export { checkLoop } from './loop_governor.js';
export { detectFabrication, findOutliers } from './numeric_analysis.js';
export { verifyArithmetic } from './arithmetic_verifier.js';
export { checkConcurrencyHazards } from './concurrency_checker.js';
export { classifyClaim, classifyClaims } from './claim_classifier.js';
export { checkEntityGrounding } from './entity_grounding.js';
export * from './types.js';
export * from './utils.js';

// ─── Corrective prompt templates ────────────────────────────────────────────

const FIRST_FAILURE_PROMPTS: Record<string, string> = {
  confidence_product:
    "EVIDENCE CHAIN REQUIRED: For each assumption below confidence 0.7, answer: 'What single observable event would prove this wrong?' " +
    "Name a threshold, a component, a time window. If you cannot, state: 'No falsification condition — confidence ≤ 0.3.'",

  specificity:
    "Complete this sentence: 'This assumption is proven wrong if [specific event] occurs within [time window] given [condition].'",

  steelman:
    'Add one premise that is absent from the original, names a specific mechanism, and makes the argument harder to attack. Do not rephrase.',

  revision:
    'In 2-3 sentences: the component that handles this, the condition that triggers it, the specific outcome. No other changes.',
};

function schemaFillConfidenceProduct(assumptions?: Assumption[]): string {
  const header =
    'FILL IN THIS TEMPLATE — do not add explanation, fill the blanks only:';

  if (!assumptions || assumptions.length === 0) {
    return `${header}\n\n` +
      '- Observable failure event: ___\n' +
      '- Threshold: ___\n' +
      '- Time window: ___\n' +
      '- Revised confidence: ___';
  }

  const lowConf = assumptions.filter(a => a.confidence < 0.7);
  const targets = lowConf.length > 0 ? lowConf : assumptions;

  const blocks = targets.map(a =>
    `Assumption: "${a.description}" (current confidence: ${a.confidence})\n` +
    '  - Observable failure event: ___\n' +
    '  - Threshold: ___\n' +
    '  - Time window: ___\n' +
    '  - Revised confidence: ___',
  );

  return `${header}\n\n${blocks.join('\n\n')}`;
}

function schemaFillSpecificity(): string {
  return (
    'FILL IN THIS TEMPLATE — blanks only:\n\n' +
    'This assumption fails when [component] [action] within [time window] given [precondition].'
  );
}

function schemaFillFallback(): string {
  return (
    'Answer ONLY the numbered checklist below — one phrase per blank:\n\n' +
    '1. Component: ___\n' +
    '2. Condition: ___\n' +
    '3. Threshold: ___\n' +
    '4. Outcome: ___'
  );
}

// ─── EnforcementEngine ─────────────────────────────────────────────────────

export class EnforcementEngine {

  // ── Mechanism wrappers ──────────────────────────────────────────────────

  computeConfidenceProduct(
    assumptions: Assumption[],
    responseText?: string,
  ): ConfidenceProductResult {
    return _computeConfidenceProduct(assumptions, responseText);
  }

  scoreSpecificity(
    text: string,
    context: 'assumption' | 'challenge',
  ): SpecificityResult {
    return _scoreSpecificity(text, context);
  }

  checkConsistency(input: ConsistencyInput): ConsistencyResult {
    return _checkConsistency(input);
  }

  detectHedging(text: string): HedgeResult {
    return _detectHedging(text);
  }

  checkFalsifiability(args: string[]): FalsifiabilityResult {
    return _checkFalsifiability(args);
  }

  compareSteelman(original: string, steelman: string): SteelmanResult {
    return _compareSteelman(original, steelman);
  }

  checkRevision(gap: string, revision: string): RevisionContrastResult {
    return _checkRevision(gap, revision);
  }

  checkLoop(iterations: LoopGovernorEntry[]): LoopGovernorResult {
    return _checkLoop(iterations);
  }

  detectFabrication(numbers: number[]): FabricationResult {
    return _detectFabrication(numbers);
  }

  findOutliers(numbers: number[]): OutlierResult[] {
    return _findOutliers(numbers);
  }

  verifyArithmetic(numbers: number[], hint?: string) {
    return _verifyArithmetic(numbers, hint);
  }

  checkConcurrencyHazards(text: string) {
    return _checkConcurrencyHazards(text);
  }

  classifyClaim(text: string) {
    return _classifyClaim(text);
  }

  classifyClaims(claims: string[]) {
    return _classifyClaims(claims);
  }

  checkEntityGrounding(text: string) {
    return _checkEntityGrounding(text);
  }

  // ── Corrective prompt builder ──────────────────────────────────────────

  /**
   * Build a corrective prompt with two-tier escalation.
   *
   * First failure  → counter-factual forcing prompt
   * Second+ failure of the SAME mechanism → schema-fill template
   *
   * Stateless: the caller supplies prior failure counts via `context`.
   *
   * @param blocking      Blocking issues detected this round
   * @param warnings      Warning strings detected this round
   * @param toolName      The tool that triggered enforcement
   * @param assumptions   Optional assumptions (used for confidence templates)
   * @param context       Optional EnforcementContext with failure counts and iteration history
   */
  buildCorrectivePrompt(
    blocking: BlockingIssue[],
    warnings: string[],
    toolName: string,
    assumptions?: Assumption[],
    context?: EnforcementContext,
  ): string {
    if (blocking.length === 0 && warnings.length === 0) return '';

    const parts: string[] = [];

    // Header
    parts.push(`ENFORCEMENT FAILURE for tool "${toolName}":\n`);

    // Process blocking issues
    for (const issue of blocking) {
      const failCount = context?.failure_counts_by_mechanism?.[issue.mechanism] ?? 0;

      parts.push(`[BLOCKING] ${issue.mechanism}: ${issue.description}`);

      if (failCount === 0) {
        // First failure — counter-factual forcing
        const prompt = FIRST_FAILURE_PROMPTS[issue.mechanism];
        if (prompt) {
          parts.push(`\nCORRECTIVE ACTION:\n${prompt}`);
        }
      } else {
        // Second+ failure — schema-fill
        let template: string;
        switch (issue.mechanism) {
          case 'confidence_product':
            template = schemaFillConfidenceProduct(assumptions);
            break;
          case 'specificity':
            template = schemaFillSpecificity();
            break;
          default:
            template = schemaFillFallback();
        }
        parts.push(`\nESCALATED CORRECTIVE (attempt ${failCount + 1}):\n${template}`);
      }

      parts.push(''); // blank line separator
    }

    // Append warnings
    if (warnings.length > 0) {
      parts.push('WARNINGS:');
      for (const w of warnings) {
        parts.push(`  - ${w}`);
      }
    }

    return parts.join('\n').trim();
  }

  // ── Iteration stall detector ─────────────────────────────────────────

  /**
   * Lightweight check for iteration stall patterns.
   *
   * Returns stalled=true with a stall_type if:
   * - iteration_history has 3+ entries with >50% overlapping blocking mechanisms → capability_ceiling
   * - previous_response_hash matches current_response_hash → repeat
   *
   * @param context              Optional EnforcementContext with iteration history
   * @param currentResponseHash  Optional hash of the current response for repeat detection
   */
  checkIterationStall(
    context?: EnforcementContext,
    currentResponseHash?: string,
  ): { stalled: boolean; stall_type?: string; diagnosis?: string } {
    if (!context) return { stalled: false };

    // Check for repeat response via hash comparison
    if (
      currentResponseHash &&
      context.previous_response_hash &&
      currentResponseHash === context.previous_response_hash
    ) {
      return {
        stalled: true,
        stall_type: 'repeat',
        diagnosis: 'Current response hash matches previous response hash — identical output detected.',
      };
    }

    // Check for capability ceiling via overlapping blocking issues in iteration history
    const history = context.iteration_history;
    if (history && history.length >= 3) {
      // Look at the last 3 entries
      const recent = history.slice(-3);
      const mechanismSets = recent.map(
        entry => new Set(entry.blocking_issues ?? []),
      );

      // Compute pairwise overlap: for each pair, check if >50% of mechanisms overlap
      let significantOverlapCount = 0;
      const pairs = [
        [0, 1],
        [1, 2],
        [0, 2],
      ] as const;

      for (const [i, j] of pairs) {
        const setA = mechanismSets[i];
        const setB = mechanismSets[j];
        if (setA.size === 0 && setB.size === 0) continue;

        const union = new Set([...setA, ...setB]);
        let intersectionSize = 0;
        for (const m of setA) {
          if (setB.has(m)) intersectionSize++;
        }

        // Overlap ratio: intersection / smaller set size (Jaccard-like but against smaller)
        const smaller = Math.min(setA.size, setB.size);
        if (smaller > 0 && intersectionSize / smaller > 0.5) {
          significantOverlapCount++;
        }
      }

      // If at least 2 out of 3 pairs have significant overlap, it's a capability ceiling
      if (significantOverlapCount >= 2) {
        const allMechanisms = new Set(
          recent.flatMap(entry => entry.blocking_issues ?? []),
        );
        return {
          stalled: true,
          stall_type: 'capability_ceiling',
          diagnosis:
            `Last 3 iterations share overlapping blocking mechanisms: [${[...allMechanisms].join(', ')}]. ` +
            `The model may have reached a capability ceiling for these issues.`,
        };
      }
    }

    return { stalled: false };
  }
}
