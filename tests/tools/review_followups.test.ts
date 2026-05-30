/**
 * Review follow-ups:
 *  - check_profile_downgrade (task-type dodge guard, warning-only)
 *  - finalize_deliverable folds profile-downgrade in as a WARNING (never blocks on it)
 *  - finalize_deliverable verifies a SUPPLIED case_partition (verify-if-present; blocks on non-MECE)
 *  - plan_checks lists check_case_partition as an optional consideration for reasoning
 *  - finalize_deliverable rejects the disproven 'tool_result' acceptance-criterion kind
 *  - check_answer_against_constraints is regex-injection / ReDoS safe on field names
 */

import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleCheckProfileDowngrade } from '../../src/tools/check_profile_downgrade.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';
import { handleCheckAnswerAgainstConstraints } from '../../src/tools/check_answer_against_constraints.js';
import { handlePlanChecks } from '../../src/tools/plan_checks.js';

const engine = new EnforcementEngine();

describe('check_profile_downgrade (warning-only)', () => {
  it('numeric task declared freeform → numeric downgrade warning', () => {
    const out = handleCheckProfileDowngrade({
      original_request_text: 'Calculate the percentage increase from 120 to 180.',
      declared_task_type: 'freeform',
      answer_text: 'The increase is 50%.',
    });
    expect(out.status).toBe('PASS');
    expect(out.suspected_downgrades).toContain('possible_numeric_profile_downgrade');
  });

  it('decision task declared freeform → decision downgrade warning', () => {
    const out = handleCheckProfileDowngrade({
      original_request_text: 'Which option should we choose?',
      declared_task_type: 'freeform',
      answer_text: 'You should choose option B because it scales better.',
    });
    expect(out.status).toBe('PASS');
    expect(out.suspected_downgrades).toContain('possible_decision_profile_downgrade');
  });

  it('correctly declared decision → no decision-downgrade flag', () => {
    const out = handleCheckProfileDowngrade({
      original_request_text: 'Which option should we choose?',
      declared_task_type: 'decision',
      answer_text: 'You should choose option B.',
    });
    expect(out.suspected_downgrades).not.toContain('possible_decision_profile_downgrade');
  });

  it('never blocks (status always PASS), even with multiple downgrades', () => {
    const out = handleCheckProfileDowngrade({
      original_request_text: 'Deploy the service and tell me which is best; what is the 50% threshold?',
      declared_task_type: 'freeform',
      answer_text: 'First deploy, then you should choose plan B; the cutoff is 50%.',
    });
    expect(out.status).toBe('PASS');
    expect(out.suspected_downgrades.length).toBeGreaterThan(1);
  });
});

describe('finalize_deliverable rejects tool_result acceptance-criterion kind', () => {
  const baseContract = (kind: string) => ({
    contract: {
      contract_id: 'x', contract_authority: 'host', profile_source: 'host_supplied',
      original_request_text: 'q', task_type: 'factual_qa', evidence_level: 'none', risk_level: 'low',
      acceptance_criteria: [{ id: 'ac1', text: 'criterion', kind }],
    },
    answer_text: 'an answer with enough length',
  });

  it("kind:'tool_result' → InvalidParams (no hash-as-proof)", () => {
    expect(() => handleFinalizeDeliverable(baseContract('tool_result'), engine)).toThrow(/tool_result|rejected|invalid/i);
  });
  it("unknown kind → InvalidParams", () => {
    expect(() => handleFinalizeDeliverable(baseContract('magic'), engine)).toThrow(/invalid|Must be one of/i);
  });
  it("kind:'inline_check' is accepted (re-execution model)", () => {
    expect(() => handleFinalizeDeliverable(baseContract('inline_check'), engine)).not.toThrow();
  });
});

describe('finalize_deliverable folds in profile-downgrade as a WARNING', () => {
  const downgradeContract = () => ({
    contract: {
      contract_id: 'd1', contract_authority: 'host', profile_source: 'host_supplied',
      original_request_text: 'Which option should we choose?',
      task_type: 'freeform', evidence_level: 'none', risk_level: 'low',
    },
    answer_text: 'You should choose option B because it scales better.',
  });

  it('surfaces a profile-downgrade warning but never blocks on it', () => {
    const out = handleFinalizeDeliverable(downgradeContract(), engine);
    expect(out.finalize_verdict).toBe('PASS');
    const warnings = out.enforcement?.warnings ?? [];
    expect(warnings.some(w => /profile_downgrade/.test(w))).toBe(true);
  });

  it('honestly-declared decision → no downgrade warning', () => {
    const contract = downgradeContract();
    contract.contract.task_type = 'decision';
    const out = handleFinalizeDeliverable(contract, engine);
    const warnings = out.enforcement?.warnings ?? [];
    expect(warnings.some(w => /profile_downgrade/.test(w))).toBe(false);
  });
});

describe('finalize_deliverable verifies a supplied case_partition (verify-if-present)', () => {
  const base = () => ({
    contract: {
      contract_id: 'p1', contract_authority: 'host', profile_source: 'host_supplied',
      original_request_text: 'Reason by cache state.', task_type: 'reasoning',
      evidence_level: 'none', risk_level: 'low',
    },
    answer_text: 'A reasoning answer that covers the cache states.',
  });

  it('absent case_partition → no obligation, PASS', () => {
    const out = handleFinalizeDeliverable(base(), engine);
    expect(out.finalize_verdict).toBe('PASS');
    expect(out.re_executed).not.toContain('check_case_partition');
  });

  it('MECE partition supplied → re-executed and PASS', () => {
    const out = handleFinalizeDeliverable(
      {
        ...base(),
        case_partition: {
          variable: 'cache_state',
          domain: { type: 'enum', values: ['warm', 'cold', 'evicting'] },
          cases: [{ label: 'hit', members: ['warm'] }, { label: 'miss', members: ['cold', 'evicting'] }],
        },
      },
      engine,
    );
    expect(out.finalize_verdict).toBe('PASS');
    expect(out.re_executed).toContain('check_case_partition');
  });

  it('non-MECE partition (gap) supplied → BLOCK', () => {
    const out = handleFinalizeDeliverable(
      {
        ...base(),
        case_partition: {
          variable: 'cpu_load',
          domain: { type: 'numeric', min: 0, max: 100 },
          cases: [{ label: 'low', lo: 0, hi: 40 }, { label: 'high', lo: 60, hi: 100, hi_inclusive: true }],
        },
      },
      engine,
    );
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(out.enforcement?.blocking_issues.some(i => i.mechanism === 'partition_gap')).toBe(true);
  });
});

describe('plan_checks lists check_case_partition as an optional consideration for reasoning', () => {
  it('reasoning profile includes case_partition in optional', () => {
    const plan = handlePlanChecks({ contract: { task_type: 'reasoning', evidence_level: 'none', risk_level: 'low' } });
    expect(plan.optional.map((o: { check: string }) => o.check)).toContain('check_case_partition');
    // It is advisory, never forced into the blocking gate.
    expect(plan.finalize_required).not.toContain('check_case_partition');
  });
});

describe('check_answer_against_constraints — regex safety on field names', () => {
  const dangerous = ['a+)+$', '(?<x>.*)', 'price|admin', '\\b.*\\b', '((((', '___'];
  it('field names with regex metacharacters do not crash or mass-flag', () => {
    for (const field of dangerous) {
      const out = handleCheckAnswerAgainstConstraints(
        {
          answer: { [field]: 1, price: 80 },
          original_request_text: 'price under 100',
          constraints: [{ field: 'price', op: '<', value: 100, source_quote: 'price under 100' }],
        },
        engine,
      );
      // No throw; the metachar field is never spuriously flagged as request-covered.
      expect(out.flagged_uncovered_fields).not.toContain(field);
    }
  });
});
