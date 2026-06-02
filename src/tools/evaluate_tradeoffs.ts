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

/**
 * Phase 3.3 (Cat-2) decision advisories. ADVISORY until Phase 4 proves them — they
 * populate `warnings`, never `blocking_issues`, and never flip `status`. Each carries
 * a `triggered` flag and the evidence used so the signal is auditable. Profile scope:
 * evaluate_tradeoffs IS the `decision` profile, so the §9 row `status-quo-or-NA = req
 * (advisory until Phase 4)` for Decision applies to every invocation.
 */
interface DecisionAdvisories {
  /** (a) status-quo-or-NA: no 'do nothing / status quo' option and no not_applicable_because. */
  status_quo_or_na: { triggered: boolean; detail: string };
  /**
   * (b) dominated-option: an option strictly dominated under the MODEL'S DECLARED
   * scoring dimensions/weights (opt-in `scoring`). Never claims 'objectively dominated'.
   * `evaluated` is false when no scoring model was declared — domination is then
   * undecidable and NOT flagged.
   */
  dominated_options: {
    triggered: boolean;
    evaluated: boolean;
    dominated: { option: string; dominated_by: string }[];
    detail: string;
  };
  /** (c) anchored numbers: probabilities/utilities lack a declared anchor/source. */
  unanchored_numbers: { triggered: boolean; unanchored_count: number; detail: string };
}

export interface TradeoffOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  ranked_options: RankedOption[];
  recommended: string | null;
  is_indeterminate: boolean;
  eu_spread: number;
  context_used: boolean;
  /** Phase 3.3 advisory signals (decision profile). Always present; never blocks. */
  decision_advisories: DecisionAdvisories;
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

// ====== Phase 3.3 advisory checks (Cat-2, decision profile, non-blocking) ======

/**
 * A purely lexical status-quo recognizer over an option name. Deterministic: matches
 * whole-word "baseline" or one of a small fixed phrase set ("do nothing", "status quo",
 * "no change", "no action", "keep current", "stay the course"). It is intentionally
 * narrow — a miss only downgrades to a WARNING (advisory), never blocks a correct answer.
 */
function looksLikeStatusQuo(name: string): boolean {
  const n = name.toLowerCase();
  const phrases = [
    'do nothing',
    'status quo',
    'status-quo',
    'no change',
    'no action',
    'keep current',
    'keep the current',
    'stay the course',
    'leave as is',
    'leave as-is',
  ];
  if (phrases.some(p => n.includes(p))) return true;
  return /\bbaseline\b/.test(n);
}

/**
 * (b) Dominated-option flag under the MODEL'S DECLARED scoring dimensions/weights.
 *
 * Opt-in `scoring` shape (all model-declared, never invented here):
 *   scoring: {
 *     dimensions: { name: string; weight?: number; direction?: 'higher_better'|'lower_better' }[],
 *     scores: { option: string; values: Record<dimensionName, number> }[]
 *   }
 *
 * Strict domination predicate (deterministic, weight-aware): option A is dominated by
 * option B iff, after orienting every dimension to "higher is better" and multiplying by
 * its declared (non-negative) weight, B is >= A on EVERY dimension AND strictly > on at
 * least one. This is Pareto-domination under the declared model — NOT an objective claim.
 * If no scoring model is declared, domination is undecidable and we DO NOT flag anything.
 */
function computeDeclaredDomination(
  scoring: unknown,
  optionNames: string[],
): { evaluated: boolean; dominated: { option: string; dominated_by: string }[] } {
  if (scoring === null || typeof scoring !== 'object') {
    return { evaluated: false, dominated: [] };
  }
  const s = scoring as Record<string, unknown>;
  if (!Array.isArray(s.dimensions) || !Array.isArray(s.scores)) {
    return { evaluated: false, dominated: [] };
  }

  // Build oriented, weighted dimension list. A missing weight defaults to 1; a negative
  // weight is ignored (treated as 0) so a declared model can't smuggle in sign flips.
  const dims: { name: string; weight: number; sign: 1 | -1 }[] = [];
  for (const d of s.dimensions as unknown[]) {
    const dd = d as Record<string, unknown>;
    if (typeof dd?.name !== 'string') continue;
    const weight = typeof dd.weight === 'number' && isFinite(dd.weight) && dd.weight > 0 ? dd.weight : 1;
    const sign: 1 | -1 = dd.direction === 'lower_better' ? -1 : 1;
    dims.push({ name: dd.name, weight, sign });
  }
  if (dims.length === 0) return { evaluated: false, dominated: [] };

  // Build per-option oriented*weighted vectors. An option missing a declared dimension
  // value is incomparable → it cannot dominate and cannot be dominated.
  const vectors = new Map<string, number[]>();
  for (const sc of s.scores as unknown[]) {
    const o = sc as Record<string, unknown>;
    if (typeof o?.option !== 'string' || !optionNames.includes(o.option)) continue;
    const values = o.values as Record<string, unknown> | undefined;
    if (!values || typeof values !== 'object') continue;
    const vec: number[] = [];
    let complete = true;
    for (const dim of dims) {
      const v = (values as Record<string, unknown>)[dim.name];
      if (typeof v !== 'number' || !isFinite(v)) { complete = false; break; }
      vec.push(v * dim.sign * dim.weight);
    }
    if (complete) vectors.set(o.option, vec);
  }

  const dominated: { option: string; dominated_by: string }[] = [];
  const names = [...vectors.keys()];
  for (const a of names) {
    for (const b of names) {
      if (a === b) continue;
      const va = vectors.get(a)!;
      const vb = vectors.get(b)!;
      let geAll = true;
      let gtSome = false;
      for (let k = 0; k < va.length; k++) {
        if (vb[k] < va[k]) { geAll = false; break; }
        if (vb[k] > va[k]) gtSome = true;
      }
      if (geAll && gtSome) {
        dominated.push({ option: a, dominated_by: b });
        break; // one dominator is enough to flag A
      }
    }
  }
  return { evaluated: true, dominated };
}

/**
 * (c) Anchored-numbers advisory. A probability/utility is "anchored" when the model
 * declares where the number came from: an `anchor` (string) on the outcome, an
 * `anchors` map keyed by "option::outcomeDescription", or a top-level `anchored: true`
 * attestation. Deterministic structural check — we count outcomes lacking any anchor.
 */
function countUnanchoredOutcomes(input: Record<string, unknown>, options: TradeoffOption[]): number {
  if (input.anchored === true) return 0;
  const anchorsMap = (input.anchors && typeof input.anchors === 'object')
    ? (input.anchors as Record<string, unknown>)
    : undefined;
  let unanchored = 0;
  const rawOptions = Array.isArray(input.options) ? (input.options as unknown[]) : [];
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const rawOpt = rawOptions[i] as Record<string, unknown> | undefined;
    const rawOutcomes = Array.isArray(rawOpt?.outcomes) ? (rawOpt!.outcomes as unknown[]) : [];
    for (let j = 0; j < opt.outcomes.length; j++) {
      const rawOutcome = rawOutcomes[j] as Record<string, unknown> | undefined;
      const hasOutcomeAnchor =
        typeof rawOutcome?.anchor === 'string' && (rawOutcome.anchor as string).trim().length > 0;
      const key = `${opt.name}::${opt.outcomes[j].description}`;
      const hasMapAnchor =
        !!anchorsMap &&
        typeof anchorsMap[key] === 'string' &&
        (anchorsMap[key] as string).trim().length > 0;
      if (!hasOutcomeAnchor && !hasMapAnchor) unanchored++;
    }
  }
  return unanchored;
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

  // ── Phase 3.3 decision advisories (Cat-2, ADVISORY — warnings only, never block) ──
  const inputObj = (input ?? {}) as Record<string, unknown>;

  // (a) status-quo-or-NA — decision profile (this tool IS the decision profile)
  const naReason =
    typeof inputObj.not_applicable_because === 'string' &&
    inputObj.not_applicable_because.trim().length > 0
      ? inputObj.not_applicable_because.trim()
      : null;
  const hasStatusQuo = options.some(o => looksLikeStatusQuo(o.name));
  const statusQuoTriggered = !hasStatusQuo && !naReason;
  const statusQuoAdvisory: DecisionAdvisories['status_quo_or_na'] = {
    triggered: statusQuoTriggered,
    detail: hasStatusQuo
      ? 'A status-quo / do-nothing option is present.'
      : naReason
        ? `Status-quo baseline declared not applicable: ${naReason}`
        : 'No status-quo / do-nothing option found and no not_applicable_because supplied.',
  };
  if (statusQuoTriggered) {
    warnings.push(
      'ADVISORY (status-quo-or-NA): no "do nothing / status quo" option is present and no ' +
      'not_applicable_because was supplied. A robust decision should compare against the baseline ' +
      'of taking no action, or explicitly state why that baseline does not apply.'
    );
  }

  // (b) dominated-option flag — ONLY under the model's declared scoring dimensions/weights
  const domination = computeDeclaredDomination(
    inputObj.scoring,
    options.map(o => o.name),
  );
  const dominatedAdvisory: DecisionAdvisories['dominated_options'] = {
    triggered: domination.dominated.length > 0,
    evaluated: domination.evaluated,
    dominated: domination.dominated,
    detail: !domination.evaluated
      ? 'No declared scoring model supplied — domination is undecidable and was not evaluated.'
      : domination.dominated.length === 0
        ? 'No option is strictly dominated under the declared scoring dimensions/weights.'
        : `Under the DECLARED scoring dimensions/weights, ${domination.dominated.length} option(s) are strictly dominated.`,
  };
  for (const d of domination.dominated) {
    warnings.push(
      `ADVISORY (dominated-option): under the MODEL'S DECLARED scoring dimensions/weights, ` +
      `"${d.option}" is strictly dominated by "${d.dominated_by}" (no better on any declared dimension, ` +
      `worse on at least one). This is domination under the declared model only — NOT an objective claim.`
    );
  }

  // (c) anchored numbers — warn when probabilities/utilities are unanchored
  const unanchoredCount = countUnanchoredOutcomes(inputObj, options);
  const totalOutcomes = options.reduce((sum, o) => sum + o.outcomes.length, 0);
  const unanchoredAdvisory: DecisionAdvisories['unanchored_numbers'] = {
    triggered: unanchoredCount > 0,
    unanchored_count: unanchoredCount,
    detail: unanchoredCount === 0
      ? 'All outcome probabilities/utilities carry a declared anchor/source.'
      : `${unanchoredCount} of ${totalOutcomes} outcomes have unanchored probability/utility values.`,
  };
  if (unanchoredCount > 0) {
    warnings.push(
      `ADVISORY (anchored-numbers): ${unanchoredCount} of ${totalOutcomes} outcome ` +
      `probabilities/utilities are unanchored (no anchor/source declared). Unanchored numbers ` +
      `are assumptions, not evidence — declare where each probability and utility comes from.`
    );
  }

  const decisionAdvisories: DecisionAdvisories = {
    status_quo_or_na: statusQuoAdvisory,
    dominated_options: dominatedAdvisory,
    unanchored_numbers: unanchoredAdvisory,
  };

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
    decision_advisories: decisionAdvisories,
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
