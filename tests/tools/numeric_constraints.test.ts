/**
 * trace_conclusion_numbers + check_answer_against_constraints + finalize numeric path.
 *
 * BLOCK only on unforgeable signals: re-derivation mismatch (numbers) and predicate
 * evaluation on supplied data + source-quote anchoring (constraints).
 */

import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleTraceConclusionNumbers } from '../../src/tools/trace_conclusion_numbers.js';
import { handleCheckAnswerAgainstConstraints } from '../../src/tools/check_answer_against_constraints.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';
import { handlePlanChecks } from '../../src/tools/plan_checks.js';

const engine = new EnforcementEngine();

describe('trace_conclusion_numbers', () => {
  it('correct sum derivation → PASS', () => {
    const out = handleTraceConclusionNumbers(
      { inputs: [120, 30], conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }] },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.traced_ratio).toBe(1);
  });

  it('fabricated derived value → ENFORCEMENT_FAIL', () => {
    const out = handleTraceConclusionNumbers(
      { inputs: [120, 30], conclusion_numbers: [{ value: 999, origin: 'derived', op: 'sum', input_refs: [0, 1] }] },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'number_provenance')).toBe(true);
  });

  it('literal that does not match its input → ENFORCEMENT_FAIL', () => {
    const out = handleTraceConclusionNumbers(
      { inputs: [42], conclusion_numbers: [{ value: 43, origin: 'literal', input_refs: [0] }] },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
  });

  it('out-of-range input_ref → ENFORCEMENT_FAIL', () => {
    const out = handleTraceConclusionNumbers(
      { inputs: [1, 2], conclusion_numbers: [{ value: 3, origin: 'derived', op: 'sum', input_refs: [0, 5] }] },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
  });

  it('pct_of derivation within tolerance → PASS', () => {
    const out = handleTraceConclusionNumbers(
      { inputs: [30, 120], conclusion_numbers: [{ value: 25, origin: 'derived', op: 'pct_of', input_refs: [0, 1] }] },
      engine,
    );
    expect(out.status).toBe('PASS');
  });

  it('untraced number in answer_text → WARNING but still PASS', () => {
    const out = handleTraceConclusionNumbers(
      {
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
        answer_text: 'Total is 150/mo, a 25% saving.',
      },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.untraced_answer_numbers).toContain('25');
    expect(out.enforcement?.warnings.length).toBeGreaterThan(0);
  });
});

describe('check_answer_against_constraints', () => {
  const base = {
    original_request_text: 'Return JSON with status and a price under 100.',
    constraints: [
      { field: 'price', op: '<', value: 100, source_quote: 'price under 100' },
      { field: 'status', op: '!=', value: '', source_quote: 'with status' },
    ],
  };

  it('satisfied answer → PASS', () => {
    const out = handleCheckAnswerAgainstConstraints(
      { ...base, answer: { status: 'ok', price: 80 } },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.satisfied_count).toBe(2);
  });

  it('violated numeric constraint → ENFORCEMENT_FAIL', () => {
    const out = handleCheckAnswerAgainstConstraints(
      { ...base, answer: { status: 'ok', price: 120 } },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.violations.some(v => v.field === 'price' && v.type === 'predicate_false')).toBe(true);
  });

  it('absent field → ENFORCEMENT_FAIL (field_absent)', () => {
    const out = handleCheckAnswerAgainstConstraints(
      { ...base, answer: { status: 'ok' } },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.violations.some(v => v.field === 'price' && v.type === 'field_absent')).toBe(true);
  });

  it('numeric bound not present in its source_quote → ENFORCEMENT_FAIL (unanchored_bound)', () => {
    const out = handleCheckAnswerAgainstConstraints(
      {
        original_request_text: 'price under 100',
        answer: { price: 80 },
        constraints: [{ field: 'price', op: '<', value: 100, source_quote: 'keep it cheap' }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.violations.some(v => v.type === 'unanchored_bound')).toBe(true);
  });

  it('missing required_field → ENFORCEMENT_FAIL', () => {
    const out = handleCheckAnswerAgainstConstraints(
      {
        answer: { price: 80 },
        constraints: [{ field: 'price', op: '<', value: 100, source_quote: 'price under 100' }],
        required_fields: ['status'],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.missing_required_fields).toContain('status');
  });

  it('"in" membership op works', () => {
    const out = handleCheckAnswerAgainstConstraints(
      {
        answer: { tier: 'gold' },
        constraints: [{ field: 'tier', op: 'in', value: ['gold', 'silver'] }],
      },
      engine,
    );
    expect(out.status).toBe('PASS');
  });
});

describe('regressions from adversarial review', () => {
  it('sub-unit ratio off by ~5% is BLOCKED (relative tolerance, not absolute window)', () => {
    const out = handleTraceConclusionNumbers(
      { inputs: [1, 10], conclusion_numbers: [{ value: 0.10499, origin: 'derived', op: 'ratio', input_refs: [0, 1] }] },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL'); // true ratio is 0.1
  });

  it('a literal claiming 0.004 against an input of 0 is BLOCKED', () => {
    const out = handleTraceConclusionNumbers(
      { inputs: [0], conclusion_numbers: [{ value: 0.004, origin: 'literal', input_refs: [0] }] },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
  });

  it('ratio with !=2 input_refs is rejected as a validation error', () => {
    expect(() =>
      handleTraceConclusionNumbers(
        { inputs: [10, 2, 0], conclusion_numbers: [{ value: 5, origin: 'derived', op: 'ratio', input_refs: [0, 1, 2] }] },
        engine,
      ),
    ).toThrow(/exactly 2 input_refs/);
  });

  it('literal declaring an op is rejected', () => {
    expect(() =>
      handleTraceConclusionNumbers(
        { inputs: [42], conclusion_numbers: [{ value: 42, origin: 'literal', op: 'sum', input_refs: [0] }] },
        engine,
      ),
    ).toThrow(/must not declare an "op"/);
  });

  it('"150.0" in answer does not false-warn against a declared 150', () => {
    const out = handleTraceConclusionNumbers(
      {
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
        answer_text: 'The total is 150.0 dollars.',
      },
      engine,
    );
    expect(out.untraced_answer_numbers).not.toContain('150.0');
  });

  it('numeric "in" list with a matching source_quote is NOT a false unanchored_bound block', () => {
    const out = handleCheckAnswerAgainstConstraints(
      {
        answer: { tier: 100 },
        original_request_text: 'choose 100 or 200',
        constraints: [{ field: 'tier', op: 'in', value: [100, 200], source_quote: 'choose 100 or 200' }],
      },
      engine,
    );
    expect(out.status).toBe('PASS');
  });

  it('== unifies number and numeric-string (100 == "100")', () => {
    const eq = handleCheckAnswerAgainstConstraints(
      { answer: { code: '100' }, constraints: [{ field: 'code', op: '==', value: 100 }] },
      engine,
    );
    expect(eq.status).toBe('PASS');
    const ne = handleCheckAnswerAgainstConstraints(
      { answer: { code: '100' }, constraints: [{ field: 'code', op: '!=', value: 100 }] },
      engine,
    );
    expect(ne.status).toBe('ENFORCEMENT_FAIL'); // "100" is NOT != 100
  });

  it('field name with no alphanumerics does not crash or mass-flag', () => {
    const out = handleCheckAnswerAgainstConstraints(
      {
        answer: { '___': 1, price: 80 },
        original_request_text: 'price under 100',
        constraints: [{ field: 'price', op: '<', value: 100, source_quote: 'price under 100' }],
      },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.flagged_uncovered_fields).not.toContain('___');
  });
});

describe('finalize_deliverable — numeric re-execution', () => {
  const numericContract = {
    contract_id: 'n1',
    contract_authority: 'host',
    profile_source: 'host_supplied',
    original_request_text: 'What is the monthly total of 120 and 30?',
    task_type: 'numeric_analysis',
    evidence_level: 'rederived',
    risk_level: 'low',
  };

  it('plan puts trace_conclusion_numbers in finalize_required at rederived', () => {
    const plan = handlePlanChecks({ contract: { task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'low' } });
    expect(plan.finalize_required).toContain('trace_conclusion_numbers');
  });

  it('re-runs number tracing inline → PASS when numbers reconcile', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: numericContract,
        answer_text: 'The monthly total is 150.',
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
      },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.re_executed).toContain('trace_conclusion_numbers');
  });

  it('BLOCKS when a required check has no supplied inputs', () => {
    const out = handleFinalizeDeliverable(
      { contract: numericContract, answer_text: 'The total is 150.' },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'finalize_missing_inputs')).toBe(true);
  });

  it('BLOCKS when the re-derived number does not reconcile', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: numericContract,
        answer_text: 'The total is 200.',
        inputs: [120, 30],
        conclusion_numbers: [{ value: 200, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
  });
});
