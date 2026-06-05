/**
 * Phase 5 — scenario well-formedness + GROUND-TRUTH independence.
 *
 * Pre-registration: PHASE5_PREREGISTRATION.md §5 (the tests assert every satisfying
 * deliverable is GENUINELY contract-satisfying and every violating one GENUINELY
 * violates — INDEPENDENT of the gate). This file checks:
 *   1. shape: every host_contract + deliverable is a VALID ct-enforce input (the
 *      shapes src/host/cli.ts accepts), and
 *   2. ground-truth independence: a pure predicate (gradeAgainstContract — which
 *      NEVER calls ct-enforce) confirms each satisfying deliverable meets the
 *      contract and each violating one breaks EXACTLY its labeled requirement.
 *
 * NO model / claude-CLI calls. NO ct-enforce here — the gate-agreement test lives
 * in phase5_gate.test.ts.
 */

import { describe, it, expect } from 'vitest';

import { PHASE5_SCENARIOS, type DeliverableType } from '../../benchmark/phase5/scenarios.js';
import { gradeAgainstContract } from '../../benchmark/phase5/ground_truth.js';

const TASK_TYPES = new Set([
  'factual_qa',
  'numeric_analysis',
  'planning',
  'decision',
  'concurrency_design',
  'reasoning',
  'freeform',
]);
const EVIDENCE_LEVELS = new Set(['none', 'asserted', 'cited', 'rederived']);
const RISK_LEVELS = new Set(['low', 'medium', 'high']);
const DELIVERABLE_TYPES: Set<DeliverableType> = new Set([
  'financial_summary',
  'rag_customer_answer',
  'config_spec',
  'compliance_format',
]);

/** Maps a scenario's violation_kind onto the ground-truth failure-class prefix. */
const KIND_PREFIX: Record<string, string> = {
  missing_must_include: 'missing_must_include',
  unreconciled_total: 'unreconciled_total',
  missing_required_field: 'missing_required_field',
  ungrounded_claim: 'ungrounded_claim',
  asserted_excluded_fact: 'asserted_excluded_fact',
  broken_constraint: 'broken_constraint',
  stale_source: 'stale_source',
};

describe('Phase 5 corpus — size + uniqueness', () => {
  it('has 12–16 scenarios with unique ids and contract_ids', () => {
    expect(PHASE5_SCENARIOS.length).toBeGreaterThanOrEqual(12);
    expect(PHASE5_SCENARIOS.length).toBeLessThanOrEqual(16);
    const ids = PHASE5_SCENARIOS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const cids = PHASE5_SCENARIOS.map(s => s.host_contract.contract_id);
    expect(new Set(cids).size).toBe(cids.length);
  });

  it('spans all four deliverable types', () => {
    const seen = new Set(PHASE5_SCENARIOS.map(s => s.deliverable_type));
    for (const t of DELIVERABLE_TYPES) expect(seen.has(t)).toBe(true);
  });

  it('every scenario carries >= 1 violating deliverable', () => {
    for (const s of PHASE5_SCENARIOS) {
      expect(s.violating.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Phase 5 corpus — valid ct-enforce input shape', () => {
  for (const s of PHASE5_SCENARIOS) {
    it(`${s.id}: host_contract + deliverables are valid ct-enforce input`, () => {
      const c = s.host_contract;
      expect(typeof c.contract_id).toBe('string');
      expect(typeof c.original_request_text).toBe('string');
      expect(TASK_TYPES.has(c.task_type)).toBe(true);
      expect(EVIDENCE_LEVELS.has(c.evidence_level)).toBe(true);
      expect(RISK_LEVELS.has(c.risk_level)).toBe(true);
      expect(DELIVERABLE_TYPES.has(s.deliverable_type)).toBe(true);

      const all = [s.satisfying, ...s.violating.map(v => v.artifacts)];
      for (const a of all) {
        expect(typeof a.answer_text).toBe('string');
        expect(a.answer_text.length).toBeGreaterThan(0);
      }
      // Freshness scenarios must carry a host eval_time.
      if (c.freshness) {
        expect(s.eval_time).toBeDefined();
        expect(s.eval_time!.authority).toBe('host');
      }
    });
  }
});

describe('Phase 5 corpus — GROUND-TRUTH independence (no ct-enforce)', () => {
  for (const s of PHASE5_SCENARIOS) {
    it(`${s.id}: satisfying deliverable GENUINELY meets the contract`, () => {
      const verdict = gradeAgainstContract(s.host_contract, s.satisfying, s.eval_time);
      expect(verdict.satisfies, `failures: ${verdict.failures.join(', ')}`).toBe(true);
      expect(verdict.failures).toEqual([]);
    });

    for (const v of s.violating) {
      it(`${s.id}: violating "${v.violation_label}" GENUINELY breaks its labeled requirement`, () => {
        const verdict = gradeAgainstContract(s.host_contract, v.artifacts, s.eval_time);
        expect(verdict.satisfies).toBe(false);
        // The recorded violation_kind must be among the failure classes the
        // independent predicate found (the label is honest, not the only failure).
        const prefix = KIND_PREFIX[v.violation_kind];
        expect(prefix, `unknown violation_kind ${v.violation_kind}`).toBeDefined();
        const matched = verdict.failures.some(f => f.startsWith(prefix));
        expect(
          matched,
          `expected a ${prefix} failure; got [${verdict.failures.join(', ')}]`,
        ).toBe(true);
      });
    }
  }
});
