/**
 * trace_conclusion_numbers — every output number must trace to a supplied input.
 *
 * The agent lists each number in its conclusion with a declared derivation:
 *   - literal / identity: equals inputs[input_refs[0]]
 *   - derived: recompute from op over inputs[input_refs] (sum/diff/product/ratio/pct_of/mean)
 * The tool RE-DERIVES each number and checks it reconciles. This is unforgeable: a
 * fabricated number won't reconcile against the separately-supplied input array.
 *
 * v2.1 omission guard: auto-extract numbers from answer_text and flag any that were
 * not declared (WARNING, after stop-listing ordinals/section/version/figure markers).
 * finalize_deliverable calls this in strict mode, where undeclared answer numbers BLOCK.
 *
 * BLOCK (unforgeable): a declared number that fails derivation, or an out-of-range ref.
 * WARNING: a number in answer_text that was never declared.
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { BlockingIssue, EnforcementContext } from '../enforcement/types.js';
import {
  evaluateNumericDerivationArtifact,
  type NumericDerivationEvaluation,
} from '../enforcement/numeric_analysis.js';
import { stampTaxonomy } from '../enforcement/blocker_taxonomy.js';

const VALID_ORIGINS = new Set(['literal', 'identity', 'derived']);
const VALID_OPS = new Set(['sum', 'diff', 'product', 'ratio', 'pct_of', 'mean', 'percent_change']);
const DEFAULT_TOL = 0.005;

interface ConclusionNumber {
  value: number;
  origin: 'literal' | 'identity' | 'derived';
  op?: string;
  input_refs: number[];
}

export interface TraceResult {
  value: number;
  origin: string;
  traced: boolean;
  recomputed: number | null;
  reason: string | null;
}

export interface TraceOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  traced_ratio: number;
  results: TraceResult[];
  untraced_answer_numbers: string[];
  derivation_graph?: NumericDerivationEvaluation;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

function validateInput(input: unknown): {
  inputs: number[];
  conclusion_numbers: ConclusionNumber[];
  numeric_derivation: unknown | null;
  answer_text: string | null;
  tolerance: number;
  strict_answer_numbers: boolean;
} {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "inputs" (number[]) and "conclusion_numbers" ' +
        '(array of {value, origin, op?, input_refs}) or "numeric_derivation".',
    );
  }
  const obj = input as Record<string, unknown>;
  const numeric_derivation = obj.numeric_derivation ?? null;
  const hasGraph = numeric_derivation !== null;
  const hasInputs = Array.isArray(obj.inputs);
  const hasConclusions = Array.isArray(obj.conclusion_numbers);

  if (!hasGraph && (!hasInputs || !hasConclusions)) {
    throw new Error('Missing "inputs" and "conclusion_numbers" (or supply "numeric_derivation").');
  }
  if (hasConclusions && !hasInputs) {
    throw new Error('"conclusion_numbers" requires "inputs".');
  }
  if (obj.inputs !== undefined && (!hasInputs || (obj.inputs as unknown[]).length < 1)) {
    throw new Error('Missing "inputs" (array of at least 1 number).');
  }
  const inputs = hasInputs ? (obj.inputs as unknown[]) : [];
  for (let i = 0; i < inputs.length; i++) {
    if (typeof inputs[i] !== 'number' || !isFinite(inputs[i] as number)) {
      throw new Error(`inputs[${i}] is not a finite number.`);
    }
  }
  if (obj.conclusion_numbers !== undefined && (!hasConclusions || (obj.conclusion_numbers as unknown[]).length < 1)) {
    throw new Error('Missing "conclusion_numbers" (array of at least 1 entry).');
  }
  const conclusionNumbers = hasConclusions ? (obj.conclusion_numbers as unknown[]) : [];
  for (let i = 0; i < conclusionNumbers.length; i++) {
    const c = conclusionNumbers[i] as Record<string, unknown>;
    if (!c || typeof c !== 'object') throw new Error(`conclusion_numbers[${i}] is not an object.`);
    if (typeof c.value !== 'number' || !isFinite(c.value)) {
      throw new Error(`conclusion_numbers[${i}].value must be a finite number.`);
    }
    if (typeof c.origin !== 'string' || !VALID_ORIGINS.has(c.origin)) {
      throw new Error(`conclusion_numbers[${i}].origin must be one of: literal, identity, derived.`);
    }
    if (!Array.isArray(c.input_refs)) {
      throw new Error(`conclusion_numbers[${i}].input_refs must be an array of input indices.`);
    }
    if (c.origin === 'derived') {
      if (typeof c.op !== 'string' || !VALID_OPS.has(c.op)) {
        throw new Error(
          `conclusion_numbers[${i}] is derived but "op" is invalid. Must be one of: ${[...VALID_OPS].join(', ')}.`,
        );
      }
      // ratio/pct_of must reference exactly two inputs, else extra refs go unused (a laundering vector).
      if ((c.op === 'ratio' || c.op === 'pct_of' || c.op === 'percent_change') && (c.input_refs as unknown[]).length !== 2) {
        throw new Error(`conclusion_numbers[${i}] op "${c.op}" requires exactly 2 input_refs.`);
      }
    } else {
      // literal/identity: op is meaningless and only one ref is read — forbid ambiguity.
      if (c.op !== undefined) {
        throw new Error(`conclusion_numbers[${i}] origin "${c.origin}" must not declare an "op".`);
      }
      if ((c.input_refs as unknown[]).length !== 1) {
        throw new Error(`conclusion_numbers[${i}] origin "${c.origin}" requires exactly 1 input_ref.`);
      }
    }
  }

  const tolerance = typeof obj.tolerance === 'number' && obj.tolerance >= 0 ? obj.tolerance : DEFAULT_TOL;
  const answer_text = typeof obj.answer_text === 'string' ? obj.answer_text : null;
  const strict_answer_numbers = obj.strict_answer_numbers === true;

  return {
    inputs: inputs as number[],
    conclusion_numbers: conclusionNumbers as ConclusionNumber[],
    numeric_derivation,
    answer_text,
    tolerance,
    strict_answer_numbers,
  };
}

function relativeClose(a: number, b: number, tol: number): boolean {
  // True relative tolerance against the larger magnitude, plus a tiny absolute
  // epsilon so genuine zeros compare exactly. (A `Math.max(1, |b|)` denominator
  // would silently turn this into a loose ±tol ABSOLUTE window for |value| ≤ 1,
  // letting sub-unit ratios/fractions be ~5–24% off and still "trace".)
  const eps = 1e-9;
  return Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b)) + eps;
}

function recompute(op: string, vals: number[]): number | null {
  if (vals.length === 0) return null;
  switch (op) {
    case 'sum':
      return vals.reduce((s, v) => s + v, 0);
    case 'mean':
      return vals.reduce((s, v) => s + v, 0) / vals.length;
    case 'product':
      return vals.reduce((p, v) => p * v, 1);
    case 'diff':
      return vals.slice(1).reduce((d, v) => d - v, vals[0]);
    case 'ratio':
      return vals.length >= 2 && vals[1] !== 0 ? vals[0] / vals[1] : null;
    case 'pct_of':
      return vals.length >= 2 && vals[1] !== 0 ? (vals[0] / vals[1]) * 100 : null;
    case 'percent_change':
      return vals.length >= 2 && vals[0] !== 0 ? ((vals[1] - vals[0]) / vals[0]) * 100 : null;
    default:
      return null;
  }
}

// Numbers that are almost never analysis outputs — skip in the omission warning.
// Short tokens (p/no/v/note) require a trailing period so plain prose like "no 5" isn't swallowed.
const STOPLISTED = /\b(?:step|section|sec|figure|fig|chapter|ch|page|item|part|version)\s*$|\b(?:p|no|v|note)\.\s*$/i;
const YEAR = /^(?:19|20)\d{2}$/;
const ORDINALish = /\d(?:st|nd|rd|th)$/i;

function extractAnswerNumbers(text: string): string[] {
  const out: string[] = [];
  const re = /-?\d[\d,]*(?:\.\d+)?(?:st|nd|rd|th)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    if (STOPLISTED.test(before) || ORDINALish.test(raw)) continue;
    const norm = raw.replace(/,/g, '');
    if (YEAR.test(norm)) continue;
    out.push(norm);
  }
  return [...new Set(out)];
}

export function handleTraceConclusionNumbers(
  input: unknown,
  engine: EnforcementEngine,
): TraceOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { inputs, conclusion_numbers, numeric_derivation, answer_text, tolerance, strict_answer_numbers } = validateInput(input);

  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];
  const results: TraceResult[] = [];

  const refsValid = (refs: number[]): boolean =>
    refs.length > 0 && refs.every(r => Number.isInteger(r) && r >= 0 && r < inputs.length);

  for (let i = 0; i < conclusion_numbers.length; i++) {
    const c = conclusion_numbers[i];
    let traced = false;
    let recomputed: number | null = null;
    let reason: string | null = null;

    if (!refsValid(c.input_refs)) {
      reason = `input_refs out of range for inputs of length ${inputs.length}`;
    } else if (c.origin === 'literal' || c.origin === 'identity') {
      recomputed = inputs[c.input_refs[0]];
      traced = relativeClose(c.value, recomputed, tolerance);
      if (!traced) reason = `value does not match inputs[${c.input_refs[0]}]=${recomputed}`;
    } else {
      const vals = c.input_refs.map(r => inputs[r]);
      recomputed = recompute(c.op as string, vals);
      if (recomputed === null) {
        reason = `cannot recompute op "${c.op}" (e.g. divide-by-zero or too few refs)`;
      } else {
        traced = relativeClose(c.value, recomputed, tolerance);
        if (!traced) reason = `recomputed ${c.op}(${vals.join(', ')})=${recomputed} ≠ claimed ${c.value}`;
      }
    }

    results.push({ value: c.value, origin: c.origin, traced, recomputed, reason });

    if (!traced) {
      blockingIssues.push({
        mechanism: 'number_provenance',
        description: `Conclusion number ${c.value} (${c.origin}) failed derivation: ${reason}.`,
        severity: 'blocking',
      });
    }
  }

  const derivationGraph = numeric_derivation
    ? evaluateNumericDerivationArtifact(numeric_derivation, { answerText: answer_text, tolerance })
    : undefined;
  if (derivationGraph) {
    for (const issue of derivationGraph.blocking_issues) blockingIssues.push(issue);
    for (const warning of derivationGraph.warnings) warnings.push(warning);
  }

  // Omission guard (WARNING): numbers in the answer not among the declared conclusion numbers.
  let untraced: string[] = [];
  if (answer_text) {
    // Compare numerically so "150" / "150.0" / "150.00" don't false-warn against a declared 150.
    const declared = [
      ...conclusion_numbers.map(c => c.value),
      ...(derivationGraph?.results.map(result => result.value) ?? []),
      // A magnitude-bound signed final ("20% decrease" for value -20) renders the
      // unsigned magnitude in the answer; account for it so the omission guard
      // does not re-flag the very number that legitimately bound.
      ...(derivationGraph?.results
        .filter(result => result.magnitude_bound)
        .map(result => Math.abs(result.value)) ?? []),
    ];
    untraced = extractAnswerNumbers(answer_text).filter(s => {
      const n = Number(s);
      return isFinite(n) && !declared.some(d => relativeClose(n, d, tolerance));
    });
    if (untraced.length > 0) {
      const message =
        `${untraced.length} number(s) appear in answer_text but were not declared/traced: ` +
        untraced.slice(0, 8).join(', ') + (untraced.length > 8 ? ' …' : '') +
        '. Declare and trace them, or confirm they are non-analytical.';
      if (strict_answer_numbers) {
        blockingIssues.push({ mechanism: 'number_provenance', description: message, severity: 'blocking' });
      } else {
        warnings.push(message);
      }
    }
  }

  const graphResults = derivationGraph?.results ?? [];
  const tracedCount = results.filter(r => r.traced).length + graphResults.filter(r => r.traced).length;
  const resultCount = results.length + graphResults.length;
  const tracedRatio = resultCount === 0 ? 1 : tracedCount / resultCount;

  stampTaxonomy(blockingIssues);
  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'trace_conclusion_numbers', undefined, context)
    : '';

  const output: TraceOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    traced_ratio: Math.round(tracedRatio * 1000) / 1000,
    results,
    untraced_answer_numbers: untraced,
    ...(derivationGraph ? { derivation_graph: derivationGraph } : {}),
    context_used: !!context,
  };

  if (hasFail || warnings.length > 0) {
    output.enforcement = { blocking_issues: blockingIssues, warnings, corrective_prompt: correctivePrompt };
  }

  return output;
}
