/**
 * Regression: the high-risk false-block.
 *
 * Previously, risk_level='high' promoted the first unforgeable OPTIONAL check
 * (check_freshness for factual_qa, check_answer_against_constraints for numeric_analysis)
 * into finalize_required as MANDATORY. finalize then blocked on its missing artifacts —
 * even for tasks with no freshness/constraint dimension — so every legitimate high-risk
 * deliverable false-blocked. Fix: the promotion is now VERIFY-IF-PRESENT (re-executed and
 * blocking on failure only if its artifacts are supplied; absent artifacts never block),
 * while a CONTRACT-declared freshness obligation stays mandatory.
 */

import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handlePlanChecks } from '../../src/tools/plan_checks.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';

const engine = new EnforcementEngine();

describe('high-risk promotion is verify-if-present (false-block fix)', () => {
  it('plan: factual_qa/high → check_freshness is verify-if-present, NOT finalize_required', () => {
    const plan = handlePlanChecks({ contract: { task_type: 'factual_qa', evidence_level: 'cited', risk_level: 'high' } });
    expect(plan.finalize_verify_if_present).toContain('check_freshness');
    expect(plan.finalize_required).not.toContain('check_freshness');
  });

  it('plan: numeric_analysis/high → constraints check is verify-if-present, NOT finalize_required', () => {
    const plan = handlePlanChecks({ contract: { task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'high' } });
    expect(plan.finalize_verify_if_present).toContain('check_answer_against_constraints');
    expect(plan.finalize_required).not.toContain('check_answer_against_constraints');
  });

  it('plan: contract-declared freshness stays MANDATORY at high risk (not shadowed)', () => {
    const plan = handlePlanChecks({
      contract: { task_type: 'factual_qa', evidence_level: 'cited', risk_level: 'high', freshness: { max_age_seconds: 86400, requires_dated_sources: true } },
    });
    expect(plan.finalize_required).toContain('check_freshness');
    expect(plan.finalize_verify_if_present).not.toContain('check_freshness');
  });

  it('finalize: high-risk grounded factual with NO freshness artifacts → PASS (was a false-block)', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: {
          contract_id: 'c', contract_authority: 'host', profile_source: 'host_supplied',
          original_request_text: 'Is Redis single-threaded?', task_type: 'factual_qa', evidence_level: 'cited', risk_level: 'high',
          claims: [{ id: 'cl1', text: 'Redis executes commands single-threaded' }],
        },
        answer_text: 'Redis executes commands single-threaded.',
        sources: [{ id: 's1', text: 'Redis is single-threaded for command execution.' }],
        claims: [{ claim_id: 'cl1', claim_text: 'Redis executes commands single-threaded', source_id: 's1', quoted_span: 'Redis is single-threaded for command execution', supporting_token: 'single-threaded', claim_kind: 'status' }],
      },
      engine,
    );
    expect(out.finalize_verdict).toBe('PASS');
  });

  it('finalize: high-risk numeric with correct trace and NO constraints → PASS (was a false-block)', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: { contract_id: 'c', contract_authority: 'host', profile_source: 'host_supplied', original_request_text: 'What is 120 plus 30?', task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'high' },
        answer_text: 'The total is 150.',
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
      },
      engine,
    );
    expect(out.finalize_verdict).toBe('PASS');
  });

  it('RIGOR preserved: high-risk numeric WITH a supplied VIOLATING constraint → BLOCK', () => {
    const out = handleFinalizeDeliverable(
      {
        contract: { contract_id: 'c', contract_authority: 'host', profile_source: 'host_supplied', original_request_text: 'Return a price under 100.', task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'high' },
        answer_text: 'The total is 150.',
        inputs: [120, 30],
        conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
        constraints: [{ field: 'price', op: '<', value: 100, source_quote: 'price under 100' }],
        structured_answer: { price: 150 },
      },
      engine,
    );
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(out.re_executed).toContain('check_answer_against_constraints');
  });
});
