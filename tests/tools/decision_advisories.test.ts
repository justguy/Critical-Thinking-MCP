/**
 * Phase 3.3 — decision/reasoning gates, profile-scoped, ADVISORY until Phase 4.
 *
 * Every check here emits WARNINGS only — it must NEVER produce a blocking_issue and
 * NEVER flip status to ENFORCEMENT_FAIL. These tests assert exactly that, plus the
 * deterministic trigger of each predicate.
 *
 * Checks:
 *  evaluate_tradeoffs (decision profile):
 *   (a) status-quo-or-NA
 *   (b) dominated-option (only under the model's DECLARED scoring dimensions/weights)
 *   (c) anchored numbers
 *  validate_reasoning_chain:
 *   (a) require_competing_hypothesis (opt-in; diagnosis/causal)
 *   (b) rejected-option reversal condition (opt-in; decision/diagnosis) — structural
 */

import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleEvaluateTradeoffs } from '../../src/tools/evaluate_tradeoffs.js';
import { handleValidateReasoningChain } from '../../src/tools/validate_reasoning_chain.js';

const engine = new EnforcementEngine();
const tradeoff = (input: any) => handleEvaluateTradeoffs(input, engine);
const chain = (input: any) => handleValidateReasoningChain(input, engine);

// A minimal, well-separated two-option decision (not indeterminate).
const baseOptions = [
  { name: 'Migrate to service mesh', outcomes: [{ description: 'success', probability: 0.7, utility: 100 }, { description: 'failure', probability: 0.3, utility: -20 }] },
  { name: 'Patch the monolith', outcomes: [{ description: 'success', probability: 0.6, utility: 40 }, { description: 'failure', probability: 0.4, utility: 10 }] },
];

describe('evaluate_tradeoffs is non-blocking (Phase 3.3 stays ADVISORY)', () => {
  it('all advisories triggered → still PASS, zero blocking issues', () => {
    const out = tradeoff({ options: baseOptions });
    expect(out.status).toBe('PASS');
    expect(out.enforcement?.blocking_issues ?? []).toEqual([]);
    // every advisory present
    expect(out.decision_advisories.status_quo_or_na).toBeDefined();
    expect(out.decision_advisories.dominated_options).toBeDefined();
    expect(out.decision_advisories.unanchored_numbers).toBeDefined();
  });
});

describe('(a) status-quo-or-NA advisory (decision profile)', () => {
  it('no status-quo option and no not_applicable_because → triggers + warns', () => {
    const out = tradeoff({ options: baseOptions });
    expect(out.decision_advisories.status_quo_or_na.triggered).toBe(true);
    expect(out.enforcement?.warnings.some(w => w.includes('status-quo-or-NA'))).toBe(true);
    expect(out.status).toBe('PASS');
  });
  it('a "do nothing" option present → not triggered', () => {
    const out = tradeoff({
      options: [
        { name: 'Do nothing (keep current setup)', outcomes: [{ description: 'baseline', probability: 1, utility: 0 }] },
        ...baseOptions,
      ],
    });
    expect(out.decision_advisories.status_quo_or_na.triggered).toBe(false);
    expect(out.enforcement?.warnings.some(w => w.includes('status-quo-or-NA')) ?? false).toBe(false);
  });
  it('a "baseline" option (whole word) present → not triggered', () => {
    const out = tradeoff({
      options: [
        { name: 'Baseline', outcomes: [{ description: 'no change', probability: 1, utility: 0 }] },
        ...baseOptions,
      ],
    });
    expect(out.decision_advisories.status_quo_or_na.triggered).toBe(false);
  });
  it('explicit not_applicable_because → not triggered', () => {
    const out = tradeoff({ options: baseOptions, not_applicable_because: 'a launch decision has no status-quo; we must ship something' });
    expect(out.decision_advisories.status_quo_or_na.triggered).toBe(false);
    expect(out.decision_advisories.status_quo_or_na.detail).toContain('not applicable');
  });
  it('blank not_applicable_because does NOT satisfy the check', () => {
    const out = tradeoff({ options: baseOptions, not_applicable_because: '   ' });
    expect(out.decision_advisories.status_quo_or_na.triggered).toBe(true);
  });
});

describe('(b) dominated-option advisory (declared scoring only — never objective)', () => {
  it('no scoring model → not evaluated, not triggered, no false claim', () => {
    const out = tradeoff({ options: baseOptions });
    expect(out.decision_advisories.dominated_options.evaluated).toBe(false);
    expect(out.decision_advisories.dominated_options.triggered).toBe(false);
    expect(out.decision_advisories.dominated_options.detail).toContain('undecidable');
  });
  it('strict Pareto domination under declared dims → flags the dominated option (advisory)', () => {
    const out = tradeoff({
      options: baseOptions,
      scoring: {
        dimensions: [{ name: 'speed', direction: 'higher_better' }, { name: 'cost', direction: 'lower_better' }],
        scores: [
          { option: 'Migrate to service mesh', values: { speed: 9, cost: 3 } },
          { option: 'Patch the monolith', values: { speed: 5, cost: 7 } }, // worse speed, worse (higher) cost
        ],
      },
    });
    expect(out.decision_advisories.dominated_options.evaluated).toBe(true);
    expect(out.decision_advisories.dominated_options.triggered).toBe(true);
    expect(out.decision_advisories.dominated_options.dominated).toEqual([
      { option: 'Patch the monolith', dominated_by: 'Migrate to service mesh' },
    ]);
    // language guard: must NOT claim 'objectively dominated'
    const warn = out.enforcement!.warnings.find(w => w.includes('dominated-option'))!;
    expect(warn).toContain('DECLARED');
    expect(warn.toLowerCase()).not.toContain('objectively');
    expect(out.status).toBe('PASS');
  });
  it('a tradeoff (better on one dim, worse on another) is NOT dominated', () => {
    const out = tradeoff({
      options: baseOptions,
      scoring: {
        dimensions: [{ name: 'speed', direction: 'higher_better' }, { name: 'cost', direction: 'lower_better' }],
        scores: [
          { option: 'Migrate to service mesh', values: { speed: 9, cost: 8 } }, // faster but costlier
          { option: 'Patch the monolith', values: { speed: 5, cost: 3 } },       // slower but cheaper
        ],
      },
    });
    expect(out.decision_advisories.dominated_options.evaluated).toBe(true);
    expect(out.decision_advisories.dominated_options.triggered).toBe(false);
    expect(out.decision_advisories.dominated_options.dominated).toEqual([]);
  });
  it('weights are honored: a heavily-weighted dim can establish domination', () => {
    const out = tradeoff({
      options: baseOptions,
      scoring: {
        dimensions: [
          { name: 'speed', direction: 'higher_better', weight: 1 },
          { name: 'reliability', direction: 'higher_better', weight: 1 },
        ],
        scores: [
          { option: 'Migrate to service mesh', values: { speed: 5, reliability: 5 } },
          { option: 'Patch the monolith', values: { speed: 5, reliability: 4 } }, // tie speed, worse reliability
        ],
      },
    });
    expect(out.decision_advisories.dominated_options.triggered).toBe(true);
  });
  it('an option missing a declared dimension value is incomparable → not flagged', () => {
    const out = tradeoff({
      options: baseOptions,
      scoring: {
        dimensions: [{ name: 'speed' }, { name: 'cost', direction: 'lower_better' }],
        scores: [
          { option: 'Migrate to service mesh', values: { speed: 9, cost: 3 } },
          { option: 'Patch the monolith', values: { speed: 5 } }, // missing cost
        ],
      },
    });
    expect(out.decision_advisories.dominated_options.triggered).toBe(false);
  });
});

describe('(c) anchored-numbers advisory', () => {
  it('no anchors anywhere → triggered, counts all outcomes', () => {
    const out = tradeoff({ options: baseOptions });
    expect(out.decision_advisories.unanchored_numbers.triggered).toBe(true);
    expect(out.decision_advisories.unanchored_numbers.unanchored_count).toBe(4);
    expect(out.enforcement?.warnings.some(w => w.includes('anchored-numbers'))).toBe(true);
  });
  it('top-level anchored:true attestation → not triggered', () => {
    const out = tradeoff({ options: baseOptions, anchored: true });
    expect(out.decision_advisories.unanchored_numbers.triggered).toBe(false);
    expect(out.decision_advisories.unanchored_numbers.unanchored_count).toBe(0);
  });
  it('per-outcome anchor strings → only the unanchored ones are counted', () => {
    const out = tradeoff({
      options: [
        { name: 'A', outcomes: [{ description: 'win', probability: 0.5, utility: 10, anchor: 'q3 win rate' }, { description: 'lose', probability: 0.5, utility: -5 }] },
        { name: 'B', outcomes: [{ description: 'win', probability: 0.5, utility: 8, anchor: 'pilot data' }, { description: 'lose', probability: 0.5, utility: -3, anchor: 'churn report' }] },
      ],
    });
    expect(out.decision_advisories.unanchored_numbers.unanchored_count).toBe(1);
    expect(out.decision_advisories.unanchored_numbers.triggered).toBe(true);
  });
  it('anchors map keyed by option::description → resolves anchors', () => {
    const out = tradeoff({
      options: [
        { name: 'A', outcomes: [{ description: 'win', probability: 1, utility: 10 }] },
        { name: 'B', outcomes: [{ description: 'win', probability: 1, utility: 8 }] },
      ],
      anchors: { 'A::win': 'sales forecast', 'B::win': 'sales forecast' },
    });
    expect(out.decision_advisories.unanchored_numbers.unanchored_count).toBe(0);
    expect(out.decision_advisories.unanchored_numbers.triggered).toBe(false);
  });
});

describe('validate_reasoning_chain is non-blocking for Phase 3.3 advisories', () => {
  it('a triggered competing-hypothesis advisory never blocks', () => {
    const out = chain({
      nodes: [
        { id: 'e1', label: 'patient has fever', type: 'evidence' },
        { id: 'cn1', label: 'patient has the flu', type: 'conclusion' },
      ],
      edges: [{ from: 'e1', to: 'cn1', relation: 'supports' }],
      require_competing_hypothesis: true,
    });
    expect(out.status).toBe('PASS');
    expect(out.enforcement?.blocking_issues ?? []).toEqual([]);
    expect(out.reasoning_advisories?.competing_hypothesis?.triggered).toBe(true);
  });
});

describe('(a) require_competing_hypothesis (opt-in, profile-scoped)', () => {
  const oneSided = {
    nodes: [
      { id: 'e1', label: 'patient has fever', type: 'evidence' as const },
      { id: 'cn1', label: 'patient has the flu', type: 'conclusion' as const },
    ],
    edges: [{ from: 'e1', to: 'cn1', relation: 'supports' as const }],
  };

  it('NOT opt-in → check is absent entirely (profile-scoped off by default)', () => {
    const out = chain(oneSided);
    expect(out.reasoning_advisories?.competing_hypothesis).toBeUndefined();
    expect(out.enforcement?.warnings.some(w => w.includes('competing-hypothesis')) ?? false).toBe(false);
  });
  it('opt-in, one-sided (no contradicts, single conclusion) → triggers + warns', () => {
    const out = chain({ ...oneSided, require_competing_hypothesis: true });
    expect(out.reasoning_advisories?.competing_hypothesis?.triggered).toBe(true);
    expect(out.enforcement?.warnings.some(w => w.includes('competing-hypothesis'))).toBe(true);
  });
  it('opt-in, has a contradicts edge → not triggered', () => {
    const out = chain({
      nodes: [
        { id: 'e1', label: 'patient has fever', type: 'evidence' },
        { id: 'e2', label: 'rapid flu test is negative', type: 'evidence' },
        { id: 'cn1', label: 'patient has the flu', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'cn1', relation: 'supports' },
        { from: 'e2', to: 'cn1', relation: 'contradicts' },
      ],
      require_competing_hypothesis: true,
    });
    expect(out.reasoning_advisories?.competing_hypothesis?.triggered).toBe(false);
    expect(out.reasoning_advisories?.competing_hypothesis?.has_contradicts_edge).toBe(true);
  });
  it('opt-in, two alternative conclusions → not triggered', () => {
    const out = chain({
      nodes: [
        { id: 'e1', label: 'patient has fever', type: 'evidence' },
        { id: 'cn1', label: 'patient has the flu', type: 'conclusion' },
        { id: 'cn2', label: 'patient has a cold', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'cn1', relation: 'supports' },
        { from: 'e1', to: 'cn2', relation: 'supports' },
      ],
      require_competing_hypothesis: true,
    });
    expect(out.reasoning_advisories?.competing_hypothesis?.triggered).toBe(false);
    expect(out.reasoning_advisories?.competing_hypothesis?.conclusion_count).toBe(2);
  });
});

describe('(b) rejected-option reversal condition (opt-in, STRUCTURAL predicate)', () => {
  const decisionGraph = {
    nodes: [
      { id: 'e1', label: 'cost analysis', type: 'evidence' as const },
      { id: 'cn1', label: 'choose option A', type: 'conclusion' as const },
    ],
    edges: [{ from: 'e1', to: 'cn1', relation: 'supports' as const }],
  };

  it('no decision block → check absent (profile-scoped off)', () => {
    const out = chain(decisionGraph);
    expect(out.reasoning_advisories?.reversal_condition).toBeUndefined();
  });
  it('rejected finalists but NO reversal conditions → triggers for each', () => {
    const out = chain({
      ...decisionGraph,
      decision: { chosen_option_id: 'A', rejected_option_ids: ['B', 'C'] },
    });
    expect(out.reasoning_advisories?.reversal_condition?.triggered).toBe(true);
    expect(out.reasoning_advisories?.reversal_condition?.missing_reversal_for.sort()).toEqual(['B', 'C']);
    expect(out.enforcement?.warnings.some(w => w.includes('reversal condition'))).toBe(true);
    expect(out.status).toBe('PASS'); // advisory, never blocks
  });
  it('every rejected finalist has >=1 reversal condition → not triggered', () => {
    const out = chain({
      ...decisionGraph,
      decision: { chosen_option_id: 'A', rejected_option_ids: ['B', 'C'] },
      reversal_conditions: [
        { rejected_option_id: 'B', condition_text: 'if budget triples, B becomes preferred' },
        { rejected_option_id: 'C', condition_text: 'if regulatory deadline slips, C wins' },
      ],
    });
    expect(out.reasoning_advisories?.reversal_condition?.triggered).toBe(false);
    expect(out.reasoning_advisories?.reversal_condition?.missing_reversal_for).toEqual([]);
  });
  it('partial coverage → triggers only for the uncovered finalist', () => {
    const out = chain({
      ...decisionGraph,
      decision: { chosen_option_id: 'A', rejected_option_ids: ['B', 'C'] },
      reversal_conditions: [{ rejected_option_id: 'B', condition_text: 'if budget triples' }],
    });
    expect(out.reasoning_advisories?.reversal_condition?.missing_reversal_for).toEqual(['C']);
  });
  it('STRUCTURAL not similarity: an empty/whitespace condition_text does NOT cover', () => {
    const out = chain({
      ...decisionGraph,
      decision: { chosen_option_id: 'A', rejected_option_ids: ['B'] },
      reversal_conditions: [{ rejected_option_id: 'B', condition_text: '   ' }],
    });
    expect(out.reasoning_advisories?.reversal_condition?.triggered).toBe(true);
    expect(out.reasoning_advisories?.reversal_condition?.missing_reversal_for).toEqual(['B']);
  });
  it('STRUCTURAL not similarity: condition_text content is never compared — any non-empty string covers', () => {
    // A reversal condition that is textually unrelated to the option still counts: the predicate
    // is presence-counting over declared structure, NOT a relevance/steelman score.
    const out = chain({
      ...decisionGraph,
      decision: { chosen_option_id: 'A', rejected_option_ids: ['B'] },
      reversal_conditions: [{ rejected_option_id: 'B', condition_text: 'banana' }],
    });
    expect(out.reasoning_advisories?.reversal_condition?.triggered).toBe(false);
  });
  it('no rejected finalists → check is inert (not evaluated)', () => {
    const out = chain({
      ...decisionGraph,
      decision: { chosen_option_id: 'A', rejected_option_ids: [] },
    });
    expect(out.reasoning_advisories?.reversal_condition).toBeUndefined();
  });
});
