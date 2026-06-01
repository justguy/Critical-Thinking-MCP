/**
 * trace_conclusion_numbers + check_answer_against_constraints + finalize numeric path.
 *
 * BLOCK only on unforgeable signals: re-derivation mismatch (numbers) and predicate
 * evaluation on supplied data + source-quote anchoring (constraints).
 */

import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleTraceConclusionNumbers } from '../../src/tools/trace_conclusion_numbers.js';
import { handleVerifyArithmetic } from '../../src/tools/verify_arithmetic.js';
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

  it('strict answer number mode blocks untraced answer numbers', () => {
    const out = handleTraceConclusionNumbers(
      {
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
        answer_text: 'Total is 150/mo, a 25% saving.',
        strict_answer_numbers: true,
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'number_provenance')).toBe(true);
  });

  it('percent_change derivation → PASS', () => {
    const out = handleTraceConclusionNumbers(
      {
        inputs: [100, 125],
        conclusion_numbers: [{ value: 25, origin: 'derived', op: 'percent_change', input_refs: [0, 1] }],
      },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.results[0].recomputed).toBe(25);
  });
});

describe('numeric derivation DAG prototype', () => {
  it('passes a two-step savings derivation with final-answer binding', () => {
    const out = handleTraceConclusionNumbers(
      {
        answer_text: 'After a -30 savings and a 20 fee, the final total is 110.',
        numeric_derivation: {
          nodes: [
            { id: 'base', role: 'input', value: 120, unit: 'usd' },
            { id: 'savings', role: 'input', value: -30, unit: 'usd' },
            { id: 'fee', role: 'input', value: 20, unit: 'usd' },
            { id: 'discounted', role: 'intermediate', value: 90, unit: 'usd', op: 'sum', input_refs: ['base', 'savings'], formula: '120 + -30' },
            { id: 'final_total', role: 'final', value: 110, unit: 'usd', op: 'sum', input_refs: ['discounted', 'fee'], formula: '90 + 20' },
          ],
          final_refs: ['final_total'],
        },
      },
      engine,
    );

    expect(out.status).toBe('PASS');
    expect(out.derivation_graph?.final_answer_bound).toBe(true);
    expect(out.derivation_graph?.results.find(r => r.id === 'discounted')?.recomputed).toBe(90);
    expect(out.derivation_graph?.results.find(r => r.id === 'final_total')?.recomputed).toBe(110);
  });

  it('passes weighted average DAG derivation', () => {
    const out = handleTraceConclusionNumbers(
      {
        answer_text: 'The weighted average is 86.',
        numeric_derivation: {
          nodes: [
            { id: 'score_a', role: 'input', value: 100 },
            { id: 'score_b', role: 'input', value: 80 },
            { id: 'score_c', role: 'input', value: 60 },
            {
              id: 'weighted',
              role: 'final',
              value: 86,
              op: 'weighted_average',
              input_refs: ['score_a', 'score_b', 'score_c'],
              weights: [0.5, 0.3, 0.2],
              formula: '(100*0.5 + 80*0.3 + 60*0.2) / 1',
            },
          ],
          final_refs: ['weighted'],
        },
      },
      engine,
    );

    expect(out.status).toBe('PASS');
    expect(out.derivation_graph?.results.find(r => r.id === 'weighted')?.recomputed).toBe(86);
  });

  it('binds negative final numbers without dropping the sign', () => {
    const out = handleTraceConclusionNumbers(
      {
        answer_text: 'The net change is -20.',
        numeric_derivation: {
          nodes: [
            { id: 'before', role: 'input', value: 100 },
            { id: 'after', role: 'input', value: 80 },
            { id: 'net_change', role: 'final', value: -20, op: 'diff', input_refs: ['after', 'before'] },
          ],
          final_refs: ['net_change'],
        },
      },
      engine,
    );

    expect(out.status).toBe('PASS');
    expect(out.derivation_graph?.final_answer_bound).toBe(true);
  });

  it('verify_arithmetic supports percent_change', () => {
    const out = handleVerifyArithmetic(
      { claim_type: 'percent_change', values: [100, 125], claimed_result: 25 },
      engine,
    );
    expect(out.status).toBe('PASS');
    expect(out.computed_result).toBe(25);
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

  it('plan puts trace_conclusion_numbers and verify_arithmetic in finalize_required at rederived', () => {
    const plan = handlePlanChecks({ contract: { task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'low' } });
    expect(plan.finalize_required).toContain('trace_conclusion_numbers');
    expect(plan.finalize_required).toContain('verify_arithmetic');
  });

  it('re-runs number tracing inline → PASS when numbers reconcile', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: numericContract,
        answer_text: 'The monthly total is 150.',
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
        arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 150 }],
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

  it('BLOCKS when verify_arithmetic artifacts are missing', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: numericContract,
        answer_text: 'The monthly total is 150.',
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
      },
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
        arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 200 }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
  });

  it('BLOCKS when arithmetic check fails even if trace is self-consistent', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: numericContract,
        answer_text: 'The total is 200.',
        inputs: [120, 30, { value: 200, authority: 'host' }],
        conclusion_numbers: [{ value: 200, origin: 'derived', op: 'sum', input_refs: [2] }],
        arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 200 }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'arithmetic_mismatch')).toBe(true);
  });

  it('BLOCKS flattened derived output inserted into numeric inputs', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: numericContract,
        answer_text: '120 + 30 = 999.',
        inputs: [120, 30, 999],
        conclusion_numbers: [{ value: 999, origin: 'derived', op: 'sum', input_refs: [2] }],
        arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 999 }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'number_input_anchor')).toBe(true);
  });

  it('BLOCKS untraced extra answer numbers at finalize', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: numericContract,
        answer_text: 'The monthly total is 150 with 25% savings.',
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
        arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 150 }],
      },
      engine,
    );
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'number_provenance')).toBe(true);
  });

  it('accepts numeric_derivation as the trace artifact for a multi-step answer', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: {
          ...numericContract,
          original_request_text: 'Start with 120, apply -30 savings, and add 20.',
        },
        answer_text: 'After a -30 savings and a 20 fee, the final total is 110.',
        numeric_derivation: {
          nodes: [
            { id: 'base', role: 'input', value: 120, unit: 'usd' },
            { id: 'savings', role: 'input', value: -30, unit: 'usd' },
            { id: 'fee', role: 'input', value: 20, unit: 'usd' },
            { id: 'discounted', role: 'intermediate', value: 90, unit: 'usd', op: 'sum', input_refs: ['base', 'savings'] },
            { id: 'final_total', role: 'final', value: 110, unit: 'usd', op: 'sum', input_refs: ['discounted', 'fee'] },
          ],
          final_refs: ['final_total'],
        },
        arithmetic_checks: [{ claim_type: 'sum', values: [120, -30, 20], claimed_result: 110 }],
      },
      engine,
    );

    expect(out.status).toBe('PASS');
    expect(out.re_executed).toContain('trace_conclusion_numbers');
    expect(out.re_executed).toContain('verify_arithmetic');
  });

  it('BLOCKS flattened derived values inserted as raw numeric DAG inputs', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: numericContract,
        answer_text: 'The total is 150.',
        numeric_derivation: {
          nodes: [
            { id: 'a', role: 'input', value: 120 },
            { id: 'b', role: 'input', value: 30 },
            { id: 'flattened_total', role: 'input', value: 150 },
            { id: 'final_total', role: 'final', value: 150, op: 'identity', input_refs: ['flattened_total'] },
          ],
          final_refs: ['final_total'],
        },
        arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 150 }],
      },
      engine,
    );

    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'number_input_anchor')).toBe(true);
  });

  it('BLOCKS a self-consistent DAG that uses the wrong arithmetic method', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: {
          ...numericContract,
          original_request_text: 'Compute the weighted average of 100, 80, and 60 using weights 0.5, 0.3, and 0.2.',
        },
        answer_text: 'The weighted average is 80.',
        numeric_derivation: {
          nodes: [
            { id: 'score_a', role: 'input', value: 100 },
            { id: 'score_b', role: 'input', value: 80 },
            { id: 'score_c', role: 'input', value: 60 },
            { id: 'simple_mean', role: 'final', value: 80, op: 'mean', input_refs: ['score_a', 'score_b', 'score_c'] },
          ],
          final_refs: ['simple_mean'],
        },
        arithmetic_checks: [
          { claim_type: 'weighted_average', values: [100, 80, 60], weights: [0.5, 0.3, 0.2], claimed_result: 80 },
        ],
      },
      engine,
    );

    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'arithmetic_mismatch')).toBe(true);
  });
});

describe('plan_checks artifact templates', () => {
  it('emits finalize-ready numeric and arithmetic templates', () => {
    const plan = handlePlanChecks({
      contract: { task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'low' },
    });
    const traceTemplate = plan.artifact_templates.find(t => t.check === 'trace_conclusion_numbers');
    const arithmeticTemplate = plan.artifact_templates.find(t => t.check === 'verify_arithmetic');

    expect(traceTemplate?.applies_when).toBe('finalize_required');
    expect(arithmeticTemplate?.applies_when).toBe('finalize_required');
    expect(plan.finalize_checklist).toContain('trace_conclusion_numbers: provide inputs, conclusion_numbers');
    expect(plan.finalize_checklist).toContain('verify_arithmetic: provide arithmetic_checks');

    const traceExample = traceTemplate!.example as any;
    const arithmeticExample = arithmeticTemplate!.example as any;
    const finalized = handleFinalizeDeliverable(
      {
        contract: {
          contract_id: 'template-numeric',
          contract_authority: 'host',
          profile_source: 'host_supplied',
          original_request_text: 'What is the monthly total of 120 and 30?',
          task_type: 'numeric_analysis',
          evidence_level: 'rederived',
          risk_level: 'low',
          must_include: ['150'],
        },
        answer_text: 'The monthly total is 150.',
        inputs: traceExample.inputs,
        conclusion_numbers: traceExample.conclusion_numbers,
        arithmetic_checks: arithmeticExample.arithmetic_checks,
      },
      engine,
    );

    expect(finalized.finalize_verdict).toBe('PASS');
  });

  it('emits a constraint template for high-risk numeric work without making it mandatory', () => {
    const plan = handlePlanChecks({
      contract: { task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'high' },
    });
    const template = plan.artifact_templates.find(t => t.check === 'check_answer_against_constraints');

    expect(plan.finalize_required).not.toContain('check_answer_against_constraints');
    expect(plan.finalize_verify_if_present).toContain('check_answer_against_constraints');
    expect(template?.applies_when).toBe('finalize_verify_if_present');
    expect(template?.required_fields).toEqual(['constraints', 'structured_answer']);
  });
});
