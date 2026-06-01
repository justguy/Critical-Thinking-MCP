/**
 * check_answer_against_constraints — restate-and-diff.
 *
 * The agent restates the question's hard constraints as machine-checkable
 * predicates {field, op, value, source_quote} AND supplies its answer as
 * structured key→value data. The tool evaluates every predicate against the
 * answer data deterministically.
 *
 * BLOCK (within-request, evaluated on supplied data):
 *   - a constraint whose predicate is false (the answer violates a restated rule)
 *   - a constraint field absent from the answer
 *   - a numeric constraint whose bound is NOT present in its own source_quote
 *     (forces the constraint to be honestly derived from a quote, not invented)
 *   - a contract required_field missing from the answer
 * WARNING:
 *   - source_quote not a substring of original_request_text (unanchored obligation)
 *   - an answer field whose name appears in the request but no constraint covers it
 *     (heuristic anti-omission; field-name detection in prose is noisy → warning only)
 *
 * Honest limit: the agent authors both the constraints and the answer, so the strong
 * anchor is the source_quote ⊂ original_request_text tie-back, not the predicate alone.
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { AnswerConstraint, BlockingIssue, EnforcementContext } from '../enforcement/types.js';
import { extractNumericTokens, normalizeWhitespace } from '../enforcement/utils.js';

const COMPARISON_OPS = new Set(['<', '<=', '>', '>=']);
const VALID_OPS = new Set(['<', '<=', '>', '>=', '==', '!=', 'in', 'not_in', 'subset_of']);

export interface Violation {
  field: string;
  op: string;
  expected: unknown;
  actual: unknown;
  type: 'field_absent' | 'type_mismatch' | 'predicate_false' | 'unanchored_bound';
}

export interface ConstraintsOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  violations: Violation[];
  missing_required_fields: string[];
  flagged_uncovered_fields: string[];
  satisfied_count: number;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

function validateInput(input: unknown): {
  answer: Record<string, unknown>;
  constraints: AnswerConstraint[];
  original_request_text: string | null;
  required_fields: string[];
} {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "answer" (object) and "constraints" (array of {field, op, value}).',
    );
  }
  const obj = input as Record<string, unknown>;

  if (!obj.answer || typeof obj.answer !== 'object' || Array.isArray(obj.answer)) {
    throw new Error('Missing "answer" object (structured key→value data).');
  }

  // required_fields may come from a contract or top-level.
  const contract = (obj.contract && typeof obj.contract === 'object' ? obj.contract : {}) as Record<string, unknown>;
  const requiredRaw = Array.isArray(obj.required_fields)
    ? obj.required_fields
    : Array.isArray(contract.required_fields)
      ? contract.required_fields
      : [];
  const required_fields = (requiredRaw as unknown[]).filter((x): x is string => typeof x === 'string');

  if ('constraints' in obj && !Array.isArray(obj.constraints)) {
    throw new Error('"constraints" must be an array when supplied.');
  }
  const constraints = Array.isArray(obj.constraints) ? obj.constraints : [];
  if (constraints.length < 1 && required_fields.length < 1) {
    throw new Error('Missing "constraints" (array of at least 1 {field, op, value}) or "required_fields".');
  }
  for (let i = 0; i < constraints.length; i++) {
    const c = constraints[i] as Record<string, unknown>;
    if (!c || typeof c.field !== 'string' || c.field.length === 0) {
      throw new Error(`constraints[${i}].field must be a non-empty string.`);
    }
    if (typeof c.op !== 'string' || !VALID_OPS.has(c.op)) {
      throw new Error(`constraints[${i}].op is invalid. Must be one of: ${[...VALID_OPS].join(', ')}.`);
    }
    if (!('value' in c)) {
      throw new Error(`constraints[${i}] is missing "value".`);
    }
  }

  const original_request_text =
    typeof obj.original_request_text === 'string'
      ? obj.original_request_text
      : typeof contract.original_request_text === 'string'
        ? (contract.original_request_text as string)
        : null;

  return {
    answer: obj.answer as Record<string, unknown>,
    constraints: constraints as AnswerConstraint[],
    original_request_text,
    required_fields,
  };
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  // Decimal only — avoid Number() surprises like "0x10"→16, "1e3"→1000, "Infinity".
  if (typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return null;
}

function normScalar(v: unknown): string | number {
  // Coerce numeric-looking strings so 100 and "100" unify across ==/!=/in/subset_of.
  const n = toNumber(v);
  if (n !== null) return n;
  return String(v).trim().toLowerCase();
}

/** Evaluate one predicate. Returns null if satisfied, or a violation type if not. */
function evaluate(c: AnswerConstraint, actual: unknown): Violation['type'] | null {
  if (COMPARISON_OPS.has(c.op)) {
    const a = toNumber(actual);
    const b = toNumber(c.value);
    if (a === null || b === null) return 'type_mismatch';
    switch (c.op) {
      case '<': return a < b ? null : 'predicate_false';
      case '<=': return a <= b ? null : 'predicate_false';
      case '>': return a > b ? null : 'predicate_false';
      case '>=': return a >= b ? null : 'predicate_false';
    }
  }
  if (c.op === '==') return normScalar(actual) === normScalar(c.value) ? null : 'predicate_false';
  if (c.op === '!=') return normScalar(actual) !== normScalar(c.value) ? null : 'predicate_false';
  if (c.op === 'in' || c.op === 'not_in') {
    if (!Array.isArray(c.value)) return 'type_mismatch';
    const set = new Set(c.value.map(normScalar));
    const member = set.has(normScalar(actual));
    return (c.op === 'in' ? member : !member) ? null : 'predicate_false';
  }
  if (c.op === 'subset_of') {
    if (!Array.isArray(c.value) || !Array.isArray(actual)) return 'type_mismatch';
    const set = new Set(c.value.map(normScalar));
    return actual.every(x => set.has(normScalar(x))) ? null : 'predicate_false';
  }
  return 'type_mismatch';
}

export function handleCheckAnswerAgainstConstraints(
  input: unknown,
  engine: EnforcementEngine,
): ConstraintsOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { answer, constraints, original_request_text, required_fields } = validateInput(input);

  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];
  const violations: Violation[] = [];
  let satisfied = 0;

  const nRequest = original_request_text ? normalizeWhitespace(original_request_text) : null;

  for (const c of constraints) {
    const present = Object.prototype.hasOwnProperty.call(answer, c.field);

    if (!present) {
      violations.push({ field: c.field, op: c.op, expected: c.value, actual: undefined, type: 'field_absent' });
      blockingIssues.push({
        mechanism: 'constraint',
        description: `Constraint field "${c.field}" is absent from the answer.`,
        severity: 'blocking',
      });
      continue;
    }

    const actual = answer[c.field];
    const violationType = evaluate(c, actual);
    if (violationType) {
      violations.push({ field: c.field, op: c.op, expected: c.value, actual, type: violationType });
      blockingIssues.push({
        mechanism: 'constraint',
        description: `Constraint violated: ${c.field} ${c.op} ${JSON.stringify(c.value)} — actual ${JSON.stringify(actual)} (${violationType}).`,
        severity: 'blocking',
      });
    } else {
      satisfied++;
    }

    // Anchor: a numeric bound must appear verbatim in its own source_quote.
    // Extract per-array-element so [100,200] yields ["100","200"], not "100200".
    const boundNums = Array.isArray(c.value)
      ? (c.value as unknown[]).flatMap(v => extractNumericTokens(String(v)))
      : extractNumericTokens(String(c.value));
    if (boundNums.length > 0) {
      if (!c.source_quote || c.source_quote.length === 0) {
        warnings.push(`Constraint on "${c.field}" has a numeric bound but no source_quote to anchor it.`);
      } else {
        const quoteNums = new Set(extractNumericTokens(c.source_quote));
        if (!boundNums.every(n => quoteNums.has(n))) {
          violations.push({ field: c.field, op: c.op, expected: c.value, actual: c.source_quote, type: 'unanchored_bound' });
          blockingIssues.push({
            mechanism: 'constraint',
            description: `Constraint bound ${JSON.stringify(c.value)} for "${c.field}" does not appear in its source_quote — constraint not honestly derived.`,
            severity: 'blocking',
          });
        }
      }
    }

    // Restate anchor: source_quote should be a substring of the original request.
    if (c.source_quote && nRequest && !nRequest.includes(normalizeWhitespace(c.source_quote))) {
      warnings.push(`Constraint on "${c.field}": source_quote is not a substring of original_request_text (unanchored).`);
    }
  }

  // Required fields (clean BLOCK): each must be present in the answer.
  const missingRequired: string[] = [];
  for (const f of required_fields) {
    if (!Object.prototype.hasOwnProperty.call(answer, f)) {
      missingRequired.push(f);
      blockingIssues.push({
        mechanism: 'required_field',
        description: `Required field "${f}" is absent from the answer.`,
        severity: 'blocking',
      });
    }
  }

  // Flagged-but-uncovered (WARNING, heuristic): answer fields named in the request with no constraint.
  const constrainedFields = new Set(constraints.map(c => c.field.toLowerCase()));
  const flaggedUncovered: string[] = [];
  if (nRequest) {
    const reqWords = nRequest.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    for (const field of Object.keys(answer)) {
      const fl = field.toLowerCase();
      const stripped = fl.replace(/[^a-z0-9]/g, '');
      if (stripped.length === 0) continue; // guard: empty → "\b\b" matches everything
      if (constrainedFields.has(fl)) continue;
      if (new RegExp(`\\b${stripped}\\b`).test(reqWords)) {
        flaggedUncovered.push(field);
      }
    }
    if (flaggedUncovered.length > 0) {
      warnings.push(
        `Answer field(s) named in the request but covered by no constraint: ${flaggedUncovered.join(', ')}.`,
      );
    }
  }

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'check_answer_against_constraints', undefined, context)
    : '';

  const output: ConstraintsOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    violations,
    missing_required_fields: missingRequired,
    flagged_uncovered_fields: flaggedUncovered,
    satisfied_count: satisfied,
    context_used: !!context,
  };

  if (hasFail || warnings.length > 0) {
    output.enforcement = { blocking_issues: blockingIssues, warnings, corrective_prompt: correctivePrompt };
  }

  return output;
}
