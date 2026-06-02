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

import type {
  BlockingIssue,
  FabricationResult,
  NumericDerivationArtifact,
  NumericDerivationNode,
  NumericDerivationOp,
  OutlierResult,
} from './types.js';
import {
  mean,
  std,
  zScore,
  coefficientOfVariation,
  median,
  mad,
  madZScore,
  extractNumericTokens,
} from './utils.js';

// ─── Numeric derivation DAG evaluation ─────────────────────────────────────

const DERIVATION_OPS: ReadonlySet<NumericDerivationOp> = new Set([
  'literal',
  'identity',
  'sum',
  'diff',
  'product',
  'ratio',
  'pct_of',
  'mean',
  'weighted_average',
  'percent_change',
]);

const DEFAULT_DERIVATION_TOLERANCE = 0.005;

export interface NumericDerivationNodeResult {
  id: string;
  role: 'input' | 'intermediate' | 'final';
  value: number;
  unit?: string;
  op?: NumericDerivationOp;
  input_refs: string[];
  weights?: number[];
  formula?: string;
  traced: boolean;
  recomputed: number | null;
  reason: string | null;
  answer_bound?: boolean;
  /** True when this final node bound to the unsigned magnitude of a signed value (§ magnitude_binding). */
  magnitude_bound?: boolean;
}

export interface NumericDerivationEvaluation {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  traced_ratio: number;
  results: NumericDerivationNodeResult[];
  final_node_ids: string[];
  final_answer_bound: boolean;
  blocking_issues: BlockingIssue[];
  warnings: string[];
}

export interface NumericDerivationOptions {
  answerText?: string | null;
  tolerance?: number;
}

function numericDerivationIssue(description: string, mechanism = 'number_derivation_dag'): BlockingIssue {
  return { mechanism, description, severity: 'blocking' };
}

function closeRelative(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance * Math.max(Math.abs(a), Math.abs(b)) + 1e-9;
}

function computeDerivationOp(
  op: NumericDerivationOp,
  values: number[],
  weights?: number[],
): number | null {
  if (values.length === 0) return null;
  switch (op) {
    case 'literal':
    case 'identity':
      return values.length === 1 ? values[0] : null;
    case 'sum':
      return values.reduce((sum, value) => sum + value, 0);
    case 'diff':
      return values.slice(1).reduce((diff, value) => diff - value, values[0]);
    case 'product':
      return values.reduce((product, value) => product * value, 1);
    case 'ratio':
      return values.length === 2 && values[1] !== 0 ? values[0] / values[1] : null;
    case 'pct_of':
      return values.length === 2 && values[1] !== 0 ? (values[0] / values[1]) * 100 : null;
    case 'mean':
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case 'weighted_average': {
      if (!weights || weights.length !== values.length) return null;
      const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
      if (weightSum === 0) return null;
      const total = values.reduce((sum, value, i) => sum + value * weights[i], 0);
      return total / weightSum;
    }
    case 'percent_change':
      return values.length === 2 && values[0] !== 0 ? ((values[1] - values[0]) / values[0]) * 100 : null;
  }
}

function textContainsNumber(text: string, value: number, tolerance: number): boolean {
  return extractNumericTokens(text).some(match => {
    const parsed = Number(match);
    return isFinite(parsed) && closeRelative(parsed, value, tolerance);
  });
}

function validateNode(raw: unknown, index: number): NumericDerivationNode {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`numeric_derivation.nodes[${index}] must be an object.`);
  }
  const node = raw as Record<string, unknown>;
  if (typeof node.id !== 'string' || node.id.length === 0) {
    throw new Error(`numeric_derivation.nodes[${index}].id must be a non-empty string.`);
  }
  if (node.role !== 'input' && node.role !== 'intermediate' && node.role !== 'final') {
    throw new Error(`numeric_derivation.nodes[${index}].role must be input, intermediate, or final.`);
  }
  if (typeof node.value !== 'number' || !isFinite(node.value)) {
    throw new Error(`numeric_derivation.nodes[${index}].value must be a finite number.`);
  }
  if (node.unit !== undefined && typeof node.unit !== 'string') {
    throw new Error(`numeric_derivation.nodes[${index}].unit must be a string when supplied.`);
  }
  if (node.op !== undefined && (typeof node.op !== 'string' || !DERIVATION_OPS.has(node.op as NumericDerivationOp))) {
    throw new Error(
      `numeric_derivation.nodes[${index}].op must be one of: ${[...DERIVATION_OPS].join(', ')}.`,
    );
  }
  if (
    node.input_refs !== undefined &&
    (!Array.isArray(node.input_refs) || !node.input_refs.every(ref => typeof ref === 'string' && ref.length > 0))
  ) {
    throw new Error(`numeric_derivation.nodes[${index}].input_refs must be an array of node ids.`);
  }
  if (
    node.weights !== undefined &&
    (!Array.isArray(node.weights) || !node.weights.every(weight => typeof weight === 'number' && isFinite(weight)))
  ) {
    throw new Error(`numeric_derivation.nodes[${index}].weights must be an array of finite numbers.`);
  }
  if (node.formula !== undefined && typeof node.formula !== 'string') {
    throw new Error(`numeric_derivation.nodes[${index}].formula must be a string when supplied.`);
  }
  if (node.answer_text_quote !== undefined && typeof node.answer_text_quote !== 'string') {
    throw new Error(`numeric_derivation.nodes[${index}].answer_text_quote must be a string when supplied.`);
  }
  if (node.unit_constant !== undefined && typeof node.unit_constant !== 'boolean') {
    throw new Error(`numeric_derivation.nodes[${index}].unit_constant must be a boolean when supplied.`);
  }
  if (node.magnitude_binding !== undefined && typeof node.magnitude_binding !== 'boolean') {
    throw new Error(`numeric_derivation.nodes[${index}].magnitude_binding must be a boolean when supplied.`);
  }

  return {
    id: node.id,
    role: node.role,
    value: node.value,
    unit: node.unit as string | undefined,
    op: node.op as NumericDerivationOp | undefined,
    input_refs: node.input_refs as string[] | undefined,
    weights: node.weights as number[] | undefined,
    formula: node.formula as string | undefined,
    answer_text_quote: node.answer_text_quote as string | undefined,
    unit_constant: node.unit_constant as boolean | undefined,
    magnitude_binding: node.magnitude_binding as boolean | undefined,
  };
}

// Direction words for magnitude_binding on signed percent_change finals.
const DECREASE_WORDS = /\b(decrease|decreased|decline|declined|fell|fall|drop|dropped|down|lower|reduction|reduced|less)\b/i;
const INCREASE_WORDS = /\b(increase|increased|rose|rise|grew|grow|growth|up|higher|gain|gained|more)\b/i;

export function validateNumericDerivationArtifact(input: unknown): NumericDerivationArtifact {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('numeric_derivation must be an object.');
  }
  const raw = input as Record<string, unknown>;
  if (raw.kind !== undefined && raw.kind !== 'numeric_derivation_dag') {
    throw new Error('numeric_derivation.kind must be "numeric_derivation_dag" when supplied.');
  }
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    throw new Error('numeric_derivation.nodes must be a non-empty array.');
  }
  const nodes = raw.nodes.map(validateNode);
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) throw new Error(`numeric_derivation.nodes contains duplicate id "${node.id}".`);
    ids.add(node.id);
  }
  if (
    raw.final_refs !== undefined &&
    (!Array.isArray(raw.final_refs) || !raw.final_refs.every(ref => typeof ref === 'string' && ref.length > 0))
  ) {
    throw new Error('numeric_derivation.final_refs must be an array of node ids.');
  }
  const finalRefs = (raw.final_refs as string[] | undefined) ?? nodes.filter(node => node.role === 'final').map(node => node.id);
  if (finalRefs.length === 0) {
    throw new Error('numeric_derivation must declare at least one final node or final_refs entry.');
  }
  for (const ref of finalRefs) {
    if (!ids.has(ref)) throw new Error(`numeric_derivation.final_refs references unknown node "${ref}".`);
  }
  return { kind: 'numeric_derivation_dag', nodes, final_refs: finalRefs };
}

export function evaluateNumericDerivationArtifact(
  input: unknown,
  options: NumericDerivationOptions = {},
): NumericDerivationEvaluation {
  const artifact = validateNumericDerivationArtifact(input);
  const tolerance = options.tolerance ?? DEFAULT_DERIVATION_TOLERANCE;
  const answerText = options.answerText ?? null;
  const byId = new Map<string, NumericDerivationNode>(artifact.nodes.map(node => [node.id, node]));
  const resultById = new Map<string, NumericDerivationNodeResult>();
  const visiting = new Set<string>();

  const computeNode = (id: string): NumericDerivationNodeResult => {
    const existing = resultById.get(id);
    if (existing) return existing;

    const node = byId.get(id);
    if (!node) {
      return {
        id,
        role: 'intermediate',
        value: Number.NaN,
        input_refs: [],
        traced: false,
        recomputed: null,
        reason: `unknown node ref "${id}"`,
      };
    }
    if (visiting.has(id)) {
      const result: NumericDerivationNodeResult = {
        id: node.id,
        role: node.role,
        value: node.value,
        unit: node.unit,
        op: node.op,
        input_refs: node.input_refs ?? [],
        weights: node.weights,
        formula: node.formula,
        traced: false,
        recomputed: null,
        reason: `cycle detected at node "${id}"`,
      };
      resultById.set(id, result);
      return result;
    }

    visiting.add(id);
    let traced = false;
    let recomputed: number | null = null;
    let reason: string | null = null;
    const refs = node.input_refs ?? [];

    if (node.role === 'input') {
      recomputed = node.value;
      if (refs.length > 0 || (node.op !== undefined && node.op !== 'literal' && node.op !== 'identity')) {
        reason = `raw input node "${node.id}" declares derivation fields; derived values must be intermediate or final nodes`;
      } else {
        traced = true;
      }
    } else if (!node.op) {
      reason = `derived node "${node.id}" is missing op`;
    } else if (refs.length === 0) {
      reason = `derived node "${node.id}" must reference at least one input node`;
    } else if (node.op === 'weighted_average' && (!node.weights || node.weights.length !== refs.length)) {
      reason = `weighted_average node "${node.id}" requires weights matching input_refs`;
    } else {
      const refValues: number[] = [];
      for (const ref of refs) {
        const refResult = computeNode(ref);
        if (!refResult.traced || refResult.recomputed === null) {
          reason = `dependency "${ref}" failed derivation`;
          break;
        }
        refValues.push(refResult.recomputed);
      }
      if (!reason) {
        recomputed = computeDerivationOp(node.op, refValues, node.weights);
        if (recomputed === null || !isFinite(recomputed)) {
          reason = `cannot recompute op "${node.op}" for node "${node.id}"`;
        } else {
          traced = closeRelative(node.value, recomputed, tolerance);
          if (!traced) reason = `recomputed ${node.op}=${recomputed} does not match claimed ${node.value}`;
        }
      }
    }

    visiting.delete(id);
    const result: NumericDerivationNodeResult = {
      id: node.id,
      role: node.role,
      value: node.value,
      unit: node.unit,
      op: node.op,
      input_refs: refs,
      weights: node.weights,
      formula: node.formula,
      traced,
      recomputed,
      reason,
    };
    resultById.set(id, result);
    return result;
  };

  for (const node of artifact.nodes) computeNode(node.id);

  const results = artifact.nodes.map(node => resultById.get(node.id)!);
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];
  for (const result of results) {
    if (!result.traced) {
      const mechanism = result.role === 'input' ? 'number_dag_flattened_input' : 'number_derivation_dag';
      blockingIssues.push(numericDerivationIssue(`Numeric DAG node "${result.id}" failed: ${result.reason}.`, mechanism));
    }
  }

  const finalNodeIds = artifact.final_refs ?? [];
  let finalAnswerBound = answerText !== null;
  if (answerText !== null) {
    for (const finalId of finalNodeIds) {
      const node = byId.get(finalId)!;
      const result = resultById.get(finalId)!;
      let answerBound = false;
      // Opt-in magnitude binding for a signed percent_change final: the answer may
      // state the unsigned magnitude ("20% decrease") provided the bound quote
      // carries a direction word agreeing with the sign. The magnitude itself must
      // still match, so a wrong number (e.g. 25) does not bind.
      const magnitudeOk =
        node.magnitude_binding === true &&
        node.op === 'percent_change' &&
        typeof node.answer_text_quote === 'string' &&
        answerText.includes(node.answer_text_quote) &&
        textContainsNumber(node.answer_text_quote, Math.abs(node.value), tolerance) &&
        ((node.value < 0 && DECREASE_WORDS.test(node.answer_text_quote)) ||
          (node.value > 0 && INCREASE_WORDS.test(node.answer_text_quote)));
      if (magnitudeOk) {
        answerBound = true;
        result.magnitude_bound = true;
      } else if (node.answer_text_quote) {
        answerBound = answerText.includes(node.answer_text_quote) && textContainsNumber(node.answer_text_quote, node.value, tolerance);
      } else {
        answerBound = textContainsNumber(answerText, node.value, tolerance);
      }
      result.answer_bound = answerBound;
      if (!answerBound) {
        finalAnswerBound = false;
        blockingIssues.push(numericDerivationIssue(
          `Final numeric node "${finalId}" (${node.value}${node.unit ? ` ${node.unit}` : ''}) is not bound to answer_text.`,
          'number_answer_binding',
        ));
      }
    }
  }

  const tracedCount = results.filter(result => result.traced).length;
  const tracedRatio = results.length === 0 ? 1 : tracedCount / results.length;

  return {
    status: blockingIssues.length > 0 ? 'ENFORCEMENT_FAIL' : 'PASS',
    traced_ratio: Math.round(tracedRatio * 1000) / 1000,
    results,
    final_node_ids: finalNodeIds,
    final_answer_bound: finalAnswerBound,
    blocking_issues: blockingIssues,
    warnings,
  };
}

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
