/**
 * Step 8 — structural checks:
 *  #12 check_case_partition (MECE)
 *  #16 check_plan_validity failure-branch coverage (opt-in)
 *  #10 validate_reasoning_chain redundant evidence (opt-in)
 *  #11 validate_reasoning_chain premise-usage reconciliation (opt-in)
 *
 * All BLOCKs are unforgeable: interval/set math (#12), graph reachability/cycles
 * (#16, #11), vertex-disjoint max-flow (#10). All graph extensions are opt-in.
 */

import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleCheckCasePartition } from '../../src/tools/check_case_partition.js';
import { handleCheckPlanValidity } from '../../src/tools/check_plan_validity.js';
import { handleValidateReasoningChain } from '../../src/tools/validate_reasoning_chain.js';

const engine = new EnforcementEngine();
const part = (input: any) => handleCheckCasePartition(input, engine);

describe('#12 check_case_partition (numeric)', () => {
  const dom = { type: 'numeric' as const, min: 0, max: 100 };
  it('half-open tiling [0,50)+[50,100] is MECE', () => {
    const out = part({ domain: dom, cases: [{ label: 'low', lo: 0, hi: 50 }, { label: 'high', lo: 50, hi: 100, hi_inclusive: true }] });
    expect(out.status).toBe('PASS');
    expect(out.is_mece).toBe(true);
  });
  it('interior gap → BLOCK', () => {
    const out = part({ domain: dom, cases: [{ label: 'low', lo: 0, hi: 40 }, { label: 'high', lo: 50, hi: 100, hi_inclusive: true }] });
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.gaps.length).toBeGreaterThan(0);
  });
  it('overlap → BLOCK', () => {
    const out = part({ domain: dom, cases: [{ label: 'low', lo: 0, hi: 60 }, { label: 'high', lo: 50, hi: 100, hi_inclusive: true }] });
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.overlaps.length).toBeGreaterThan(0);
  });
  it('double-inclusive boundary is a point overlap → BLOCK', () => {
    const out = part({ domain: dom, cases: [{ label: 'low', lo: 0, hi: 50, hi_inclusive: true }, { label: 'high', lo: 50, hi: 100, hi_inclusive: true }] });
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.overlaps.some(o => o.includes('point overlap'))).toBe(true);
  });
  it('both-exclusive boundary is a point gap → BLOCK', () => {
    const out = part({ domain: dom, cases: [{ label: 'low', lo: 0, hi: 50 }, { label: 'high', lo: 50, hi: 100, lo_inclusive: false, hi_inclusive: true }] });
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.gaps.some(g => g.includes('point gap'))).toBe(true);
  });
  it('trailing gap vs domain → BLOCK', () => {
    const out = part({ domain: dom, cases: [{ label: 'low', lo: 0, hi: 50 }, { label: 'mid', lo: 50, hi: 90 }] });
    expect(out.status).toBe('ENFORCEMENT_FAIL');
  });
});

describe('#12 check_case_partition (enum)', () => {
  const dom = { type: 'enum' as const, values: ['warm', 'cold', 'evicting'] };
  it('full cover, no overlap → MECE', () => {
    const out = part({ domain: dom, cases: [{ label: 'hit', members: ['warm'] }, { label: 'miss', members: ['cold', 'evicting'] }] });
    expect(out.status).toBe('PASS');
  });
  it('uncovered member → BLOCK', () => {
    const out = part({ domain: dom, cases: [{ label: 'hit', members: ['warm'] }, { label: 'miss', members: ['cold'] }] });
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.gaps.some(g => g.includes('evicting'))).toBe(true);
  });
  it('member in two cases → BLOCK', () => {
    const out = part({ domain: dom, cases: [{ label: 'a', members: ['warm', 'cold'] }, { label: 'b', members: ['cold', 'evicting'] }] });
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.overlaps.length).toBeGreaterThan(0);
  });
  it('within-case duplicate member is harmless → PASS (regression)', () => {
    const out = part({ domain: dom, cases: [{ label: 'hit', members: ['warm', 'warm'] }, { label: 'miss', members: ['cold', 'evicting'] }] });
    expect(out.status).toBe('PASS');
  });
});

describe('#12 check_case_partition (input hygiene)', () => {
  it('NaN bound is rejected (determinism guard)', () => {
    expect(() => part({ domain: { type: 'numeric', min: 0, max: 100 }, cases: [{ label: 'a', lo: NaN, hi: 50 }, { label: 'b', lo: 50, hi: 100, hi_inclusive: true }] })).toThrow(/finite or/);
    expect(() => part({ domain: { type: 'numeric', min: NaN, max: 100 }, cases: [{ label: 'a', lo: 0, hi: 50 }, { label: 'b', lo: 50, hi: 100, hi_inclusive: true }] })).toThrow(/must be a number/);
  });
});

describe('#16 plan failure-branch coverage (opt-in)', () => {
  const effectStep = (id: string, on_failure?: any) => ({ id, description: `Deploy ${id} to prod`, dependencies: [], resources: [id], ...(on_failure ? { on_failure } : {}) });

  it('default (no flag) is unchanged — no failure-branch enforcement', () => {
    const out = handleCheckPlanValidity({ steps: [effectStep('s1'), { id: 's2', description: 'plan it', dependencies: ['s1'] }] }, engine);
    expect(out.status).toBe('PASS');
    expect(out.failure_branch_coverage).toBeUndefined();
  });
  it('effect-bearing step missing on_failure → BLOCK', () => {
    const out = handleCheckPlanValidity({ require_failure_branches: true, steps: [effectStep('s1'), { id: 's2', description: 'plan it', dependencies: ['s1'] }] }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'failure_branch')).toBe(true);
  });
  it('dangling on_failure target → BLOCK', () => {
    const out = handleCheckPlanValidity({ require_failure_branches: true, steps: [effectStep('s1', { action: 'goto', target: 'nope' }), { id: 's2', description: 'plan', dependencies: ['s1'] }] }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.description.includes('does not exist'))).toBe(true);
  });
  it('unbounded on_failure loop → WARNING (not a block — back-edges are normal control flow)', () => {
    const out = handleCheckPlanValidity({
      require_failure_branches: true,
      steps: [
        { id: 's1', description: 'Deploy A', dependencies: [], resources: ['a'], on_failure: { action: 'goto', target: 's2' } },
        { id: 's2', description: 'Deploy B', dependencies: [], resources: ['b'], on_failure: { action: 'goto', target: 's1' } },
      ],
    }, engine);
    expect(out.status).toBe('PASS');
    expect(out.enforcement?.warnings.some(w => w.includes('Unbounded on_failure loop'))).toBe(true);
  });
  it('bounded retry-to-earlier-step (max_attempts) → no loop warning, no block', () => {
    const out = handleCheckPlanValidity({
      require_failure_branches: true,
      steps: [
        { id: 's1', description: 'validate config', dependencies: [], resources: ['cfg'], on_failure: { action: 'abort', detect: 'exit code 1' } },
        { id: 's2', description: 'deploy service', dependencies: ['s1'], resources: ['srv'], on_failure: { action: 'goto', target: 's1', max_attempts: 3, detect: 'deploy latency exceeds 500ms' } },
      ],
    }, engine);
    expect(out.status).toBe('PASS');
    expect(out.enforcement?.warnings.some(w => w.includes('Unbounded on_failure loop')) ?? false).toBe(false);
  });
  it('in-place retry with no max_attempts → WARNING', () => {
    const out = handleCheckPlanValidity({
      require_failure_branches: true,
      steps: [
        { id: 's1', description: 'Deploy A', dependencies: [], resources: ['a'], on_failure: { action: 'retry', detect: 'error rate exceeds 5%' } },
        { id: 's2', description: 'document', dependencies: ['s1'] },
      ],
    }, engine);
    expect(out.status).toBe('PASS');
    expect(out.enforcement?.warnings.some(w => w.includes('unbounded retry'))).toBe(true);
  });
  it('fully covered effect step → PASS, coverage 1', () => {
    const out = handleCheckPlanValidity({
      require_failure_branches: true,
      steps: [
        { id: 's1', description: 'Deploy A', dependencies: [], resources: ['a'], on_failure: { action: 'abort', detect: 'request latency exceeds 500ms' } },
        { id: 's2', description: 'document the rollout', dependencies: ['s1'] },
      ],
    }, engine);
    expect(out.status).toBe('PASS');
    expect(out.failure_branch_coverage).toBe(1);
  });
});

describe('#10 redundant evidence (opt-in)', () => {
  it('two independent disjoint evidence paths → PASS', () => {
    const out = handleValidateReasoningChain({
      nodes: [
        { id: 'e1', label: 'load test A shows 180ms p99', type: 'evidence' },
        { id: 'e2', label: 'production metrics show stable throughput', type: 'evidence' },
        { id: 'c1', label: 'latency is acceptable', type: 'claim' },
        { id: 'c2', label: 'throughput is sufficient', type: 'claim' },
        { id: 'cn1', label: 'the service is ready', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'c1', relation: 'supports' },
        { from: 'c1', to: 'cn1', relation: 'implies' },
        { from: 'e2', to: 'c2', relation: 'supports' },
        { from: 'c2', to: 'cn1', relation: 'implies' },
      ],
      require_redundancy_for: ['cn1'],
    }, engine);
    expect(out.status).toBe('PASS');
  });
  it('single evidence path → BLOCK', () => {
    const out = handleValidateReasoningChain({
      nodes: [
        { id: 'e1', label: 'one benchmark', type: 'evidence' },
        { id: 'c1', label: 'latency is acceptable', type: 'claim' },
        { id: 'cn1', label: 'the service is ready', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'c1', relation: 'supports' },
        { from: 'c1', to: 'cn1', relation: 'implies' },
      ],
      require_redundancy_for: ['cn1'],
    }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'redundant_evidence')).toBe(true);
  });
  it('derived evidence is NOT an independent source (single root → BLOCK)', () => {
    // e2 is "evidence" but is itself derived from e1 → only one independent root.
    const out = handleValidateReasoningChain({
      nodes: [
        { id: 'e1', label: 'widget log shows the error', type: 'evidence' },
        { id: 'e2', label: 'summary derived from the log', type: 'evidence' },
        { id: 'cn1', label: 'the service is ready', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'cn1', relation: 'supports' },
        { from: 'e1', to: 'e2', relation: 'supports' },
        { from: 'e2', to: 'cn1', relation: 'supports' },
      ],
      require_redundancy_for: ['cn1'],
    }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'redundant_evidence')).toBe(true);
  });
  it('two distinct single-word evidence labels are independent → PASS (no empty-bigram false block)', () => {
    const out = handleValidateReasoningChain({
      nodes: [
        { id: 'e1', label: 'telemetry', type: 'evidence' },
        { id: 'e2', label: 'audit', type: 'evidence' },
        { id: 'cn1', label: 'the service is ready', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'cn1', relation: 'supports' },
        { from: 'e2', to: 'cn1', relation: 'supports' },
      ],
      require_redundancy_for: ['cn1'],
    }, engine);
    expect(out.status).toBe('PASS');
  });
  it('reordered duplicate evidence labels are caught as non-independent → BLOCK', () => {
    const out = handleValidateReasoningChain({
      nodes: [
        { id: 'e1', label: 'latency is 180', type: 'evidence' },
        { id: 'e2', label: '180 is latency', type: 'evidence' },
        { id: 'cn1', label: 'the service is ready', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'cn1', relation: 'supports' },
        { from: 'e2', to: 'cn1', relation: 'supports' },
      ],
      require_redundancy_for: ['cn1'],
    }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.description.includes('not independent'))).toBe(true);
  });
  it('two paths but near-duplicate evidence → BLOCK (not independent)', () => {
    const out = handleValidateReasoningChain({
      nodes: [
        { id: 'e1', label: 'the benchmark result of 180ms', type: 'evidence' },
        { id: 'e2', label: 'the benchmark result of 180ms', type: 'evidence' },
        { id: 'c1', label: 'latency claim one', type: 'claim' },
        { id: 'c2', label: 'latency claim two', type: 'claim' },
        { id: 'cn1', label: 'the service is ready', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'c1', relation: 'supports' },
        { from: 'c1', to: 'cn1', relation: 'implies' },
        { from: 'e2', to: 'c2', relation: 'supports' },
        { from: 'c2', to: 'cn1', relation: 'implies' },
      ],
      require_redundancy_for: ['cn1'],
    }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.description.includes('not independent'))).toBe(true);
  });
});

describe('#11 premise-usage reconciliation (opt-in)', () => {
  const graph = {
    nodes: [
      { id: 'e1', label: 'measured latency', type: 'evidence' as const },
      { id: 'a1', label: 'load stays nominal', type: 'assumption' as const },
      { id: 'cn1', label: 'the design holds', type: 'conclusion' as const },
    ],
    edges: [
      { from: 'e1', to: 'cn1', relation: 'supports' as const },
      { from: 'a1', to: 'cn1', relation: 'supports' as const },
    ],
  };

  it('correct declaration → no premise block', () => {
    const out = handleValidateReasoningChain({ ...graph, declared_support: [{ conclusion_id: 'cn1', premise_ids: ['e1', 'a1'] }] }, engine);
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'premise_usage') ?? false).toBe(false);
  });
  it('declared premise that is a real-but-unreachable node → phantom BLOCK', () => {
    const out = handleValidateReasoningChain({
      nodes: [...graph.nodes, { id: 'e9', label: 'unrelated evidence', type: 'evidence' as const }],
      edges: graph.edges,
      declared_support: [{ conclusion_id: 'cn1', premise_ids: ['e1', 'a1', 'e9'] }],
    }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.description.includes('phantom'))).toBe(true);
  });
  it('declared premise that is not a node at all → unknown-id BLOCK', () => {
    const out = handleValidateReasoningChain({ ...graph, declared_support: [{ conclusion_id: 'cn1', premise_ids: ['e1', 'a1', 'ghost'] }] }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'premise_usage' && b.description.includes('unknown id'))).toBe(true);
  });
  it('undeclared direct premise → BLOCK', () => {
    const out = handleValidateReasoningChain({ ...graph, declared_support: [{ conclusion_id: 'cn1', premise_ids: ['e1'] }] }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.description.includes('not declared'))).toBe(true);
  });
  it('a contradicting node is NOT a premise — declaring only the supporter passes (regression)', () => {
    const out = handleValidateReasoningChain({
      nodes: [
        { id: 'e1', label: 'supporting evidence', type: 'evidence' },
        { id: 'e2', label: 'contradicting evidence', type: 'evidence' },
        { id: 'cn1', label: 'the design holds', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'cn1', relation: 'supports' },
        { from: 'e2', to: 'cn1', relation: 'contradicts' },
      ],
      declared_support: [{ conclusion_id: 'cn1', premise_ids: ['e1'] }],
    }, engine);
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'premise_usage') ?? false).toBe(false);
  });
  it('transitive premise omission → WARNING only', () => {
    const out = handleValidateReasoningChain({
      nodes: [
        { id: 'e1', label: 'measured latency', type: 'evidence' },
        { id: 'c1', label: 'latency is fine', type: 'claim' },
        { id: 'cn1', label: 'the design holds', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'c1', relation: 'supports' },
        { from: 'c1', to: 'cn1', relation: 'implies' },
      ],
      declared_support: [{ conclusion_id: 'cn1', premise_ids: [] }],
    }, engine);
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'premise_usage') ?? false).toBe(false);
    expect(out.enforcement?.warnings.some(w => w.includes('transitively rests'))).toBe(true);
  });
});
