/**
 * Robustness proof corpus for deterministic correctness gates.
 *
 * These tests exercise real handlers plus EnforcementEngine. Expected outcomes
 * are computed from small independent helpers where the oracle is mechanical
 * (graph reachability, interval/set arithmetic, numeric derivation, plan cycles).
 */

import { describe, expect, it } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleCheckCasePartition } from '../../src/tools/check_case_partition.js';
import { handleCheckFreshness } from '../../src/tools/check_freshness.js';
import { handleCheckPlanValidity } from '../../src/tools/check_plan_validity.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';
import { handleTraceConclusionNumbers } from '../../src/tools/trace_conclusion_numbers.js';
import { handleValidateReasoningChain } from '../../src/tools/validate_reasoning_chain.js';

const engine = new EnforcementEngine();
const DAY = 86400;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function mechanisms(out: any): string[] {
  return (out.enforcement?.blocking_issues ?? []).map((issue: any) => issue.mechanism);
}

function expectGate(out: any, shouldBlock: boolean) {
  expect(out.status).toBe(shouldBlock ? 'ENFORCEMENT_FAIL' : 'PASS');
}

type PartitionInput = {
  domain: { type: 'numeric'; min?: number; max?: number } | { type: 'enum'; values: string[] };
  cases: Array<any>;
};

function expectedMece(input: PartitionInput): boolean {
  if (input.domain.type === 'enum') {
    const universe = new Set(input.domain.values);
    const seen = new Set<string>();
    for (const c of input.cases) {
      for (const member of new Set<string>(c.members ?? [])) {
        if (!universe.has(member) || seen.has(member)) return false;
        seen.add(member);
      }
    }
    return input.domain.values.every(member => seen.has(member));
  }

  const min = input.domain.min ?? -Infinity;
  const max = input.domain.max ?? Infinity;
  const intervals = input.cases
    .map(c => ({
      lo: c.lo ?? -Infinity,
      hi: c.hi ?? Infinity,
      loInc: c.lo_inclusive ?? true,
      hiInc: c.hi_inclusive ?? false,
    }))
    .sort((a, b) => (a.lo - b.lo) || (a.loInc === b.loInc ? 0 : a.loInc ? -1 : 1));

  if (intervals.length === 0) return false;
  for (const i of intervals) if (i.lo > i.hi || (i.lo === i.hi && !(i.loInc && i.hiInc))) return false;
  const first = intervals[0];
  if (first.lo > min || (first.lo === min && !first.loInc && min !== -Infinity)) return false;

  let reach = first.hi;
  let reachInc = first.hiInc;
  for (const i of intervals.slice(1)) {
    if (i.lo > reach) return false;
    if (i.lo === reach && reachInc === i.loInc) return false;
    if (i.lo < reach) return false;
    if (i.hi > reach || (i.hi === reach && i.hiInc && !reachInc)) {
      reach = i.hi;
      reachInc = i.hiInc;
    }
  }
  return !(reach < max || (reach === max && !reachInc && max !== Infinity));
}

type TraceInput = {
  inputs: number[];
  conclusion_numbers: Array<{ value: number; origin: string; op?: string; input_refs: number[] }>;
  answer_text?: string;
  strict_answer_numbers?: boolean;
  tolerance?: number;
};

function recompute(op: string, values: number[]): number | null {
  if (values.length === 0) return null;
  if (op === 'sum') return values.reduce((sum, value) => sum + value, 0);
  if (op === 'diff') return values.slice(1).reduce((diff, value) => diff - value, values[0]);
  if (op === 'product') return values.reduce((product, value) => product * value, 1);
  if (op === 'ratio') return values.length === 2 && values[1] !== 0 ? values[0] / values[1] : null;
  if (op === 'pct_of') return values.length === 2 && values[1] !== 0 ? (values[0] / values[1]) * 100 : null;
  if (op === 'mean') return values.reduce((sum, value) => sum + value, 0) / values.length;
  return null;
}

function closeEnough(actual: number, expected: number, tolerance = 0.005): boolean {
  return Math.abs(actual - expected) <= tolerance * Math.max(Math.abs(actual), Math.abs(expected)) + 1e-9;
}

function answerNumbers(text: string): number[] {
  return [...text.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map(match => Number(match[0].replace(/,/g, '')));
}

function expectedTracePass(input: TraceInput): boolean {
  const tolerance = input.tolerance ?? 0.005;
  for (const c of input.conclusion_numbers) {
    if (!c.input_refs.every(ref => Number.isInteger(ref) && ref >= 0 && ref < input.inputs.length)) return false;
    const values = c.input_refs.map(ref => input.inputs[ref]);
    const expected = c.origin === 'derived' ? recompute(c.op ?? '', values) : values.length === 1 ? values[0] : null;
    if (expected === null || !closeEnough(c.value, expected, tolerance)) return false;
  }
  if (input.strict_answer_numbers && input.answer_text) {
    const declared = input.conclusion_numbers.map(c => c.value);
    return answerNumbers(input.answer_text).every(n => declared.some(d => closeEnough(n, d, tolerance)));
  }
  return true;
}

type ReasoningNode = { id: string; label: string; type: 'evidence' | 'claim' | 'conclusion' | 'assumption' };
type ReasoningEdge = { from: string; to: string; relation: 'supports' | 'implies' | 'requires' | 'contradicts' };
type ReasoningInput = { nodes: ReasoningNode[]; edges: ReasoningEdge[]; require_redundancy_for?: string[] };

const SUPPORT = new Set(['supports', 'implies', 'requires']);

function tokenSet(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function lexicallyDistinct(a: string, b: string): boolean {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return a.trim().toLowerCase() !== b.trim().toLowerCase();
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection++;
  return intersection / (left.size + right.size - intersection) < 0.8;
}

function expectedRedundantEvidence(input: ReasoningInput, conclusionId: string): boolean {
  const incomingSupport = new Set(input.edges.filter(e => SUPPORT.has(e.relation)).map(e => e.to));
  const roots = input.nodes.filter(n => n.type === 'evidence' && !incomingSupport.has(n.id));
  const labels = new Map(input.nodes.map(n => [n.id, n.label]));
  const adj = new Map<string, string[]>();
  for (const e of input.edges) {
    if (!SUPPORT.has(e.relation)) continue;
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
  }

  const paths: string[][] = [];
  const walk = (path: string[]) => {
    const last = path[path.length - 1];
    if (last === conclusionId) {
      paths.push(path);
      return;
    }
    for (const next of adj.get(last) ?? []) {
      if (!path.includes(next)) walk([...path, next]);
    }
  };
  for (const root of roots) walk([root.id]);

  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const left = new Set(paths[i].filter(id => id !== conclusionId));
      const right = paths[j].filter(id => id !== conclusionId);
      if (right.some(id => left.has(id))) continue;
      if (lexicallyDistinct(labels.get(paths[i][0]) ?? '', labels.get(paths[j][0]) ?? '')) return true;
    }
  }
  return false;
}

type PlanInput = { steps: Array<{ id: string; dependencies: string[]; description: string; resources?: string[]; on_failure?: any }> };

function hasPlanCycle(input: PlanInput): boolean {
  const ids = new Set(input.steps.map(step => step.id));
  const adj = new Map(input.steps.map(step => [step.id, [] as string[]]));
  for (const step of input.steps) {
    for (const dep of step.dependencies) if (ids.has(dep)) adj.get(dep)!.push(step.id);
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    for (const next of adj.get(id) ?? []) if (dfs(next)) return true;
    visiting.delete(id);
    done.add(id);
    return false;
  };
  return [...ids].some(dfs);
}

function hasMissingPlanPrereq(input: PlanInput): boolean {
  const ids = new Set(input.steps.map(step => step.id));
  return input.steps.some(step => step.dependencies.some(dep => !ids.has(dep)));
}

describe('should_pass / should_block corpora for deterministic gates', () => {
  it.each([
    {
      name: 'numeric MECE partition',
      input: { domain: { type: 'numeric', min: 0, max: 100 }, cases: [{ label: 'low', lo: 0, hi: 50 }, { label: 'high', lo: 50, hi: 100, hi_inclusive: true }] },
    },
    {
      name: 'enum MECE partition',
      input: { domain: { type: 'enum', values: ['warm', 'cold', 'evicting'] }, cases: [{ label: 'hit', members: ['warm'] }, { label: 'miss', members: ['cold', 'evicting'] }] },
    },
    {
      name: 'numeric gap partition',
      input: { domain: { type: 'numeric', min: 0, max: 100 }, cases: [{ label: 'low', lo: 0, hi: 40 }, { label: 'high', lo: 50, hi: 100, hi_inclusive: true }] },
    },
    {
      name: 'enum overlap partition',
      input: { domain: { type: 'enum', values: ['warm', 'cold'] }, cases: [{ label: 'a', members: ['warm', 'cold'] }, { label: 'b', members: ['cold'] }] },
    },
  ])('MECE corpus: $name', ({ input }) => {
    const expectedPass = expectedMece(input as PartitionInput);
    const out = handleCheckCasePartition(input, engine);
    expect(out.is_mece).toBe(expectedPass);
    expectGate(out, !expectedPass);
  });

  it.each([
    {
      name: 'sum traces',
      input: { inputs: [120, 30], conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }], answer_text: 'Total is 150.', strict_answer_numbers: true },
    },
    {
      name: 'ratio traces',
      input: { inputs: [30, 120], conclusion_numbers: [{ value: 0.25, origin: 'derived', op: 'ratio', input_refs: [0, 1] }] },
    },
    {
      name: 'wrong sum blocks',
      input: { inputs: [120, 30], conclusion_numbers: [{ value: 151, origin: 'derived', op: 'sum', input_refs: [0, 1] }] },
    },
    {
      name: 'strict untraced answer number blocks',
      input: { inputs: [120, 30], conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }], answer_text: 'Total is 150 with 25 percent savings.', strict_answer_numbers: true },
    },
  ])('numeric tracing corpus: $name', ({ input }) => {
    const expectedPass = expectedTracePass(input as TraceInput);
    const out = handleTraceConclusionNumbers(input, engine);
    expectGate(out, !expectedPass);
  });

  it.each([
    {
      name: 'fresh host source',
      input: { eval_time: { value: '2026-05-30T00:00:00Z', authority: 'host' }, max_age_seconds: 30 * DAY, requires_dated_sources: true, sources: [{ id: 's1', published_at: '2026-05-20T00:00:00Z' }] },
      shouldBlock: false,
    },
    {
      name: 'stale host required source',
      input: { eval_time: { value: '2026-05-30T00:00:00Z', authority: 'host' }, max_age_seconds: 7 * DAY, requires_dated_sources: true, sources: [{ id: 's1', published_at: '2026-01-01T00:00:00Z' }] },
      shouldBlock: true,
    },
    {
      name: 'future host source',
      input: { eval_time: { value: '2026-05-30T00:00:00Z', authority: 'host' }, max_age_seconds: 365 * DAY, sources: [{ id: 's1', published_at: '2027-01-01T00:00:00Z' }] },
      shouldBlock: true,
    },
    {
      name: 'stale agent source warns only',
      input: { eval_time: { value: '2026-05-30T00:00:00Z', authority: 'agent' }, max_age_seconds: 7 * DAY, requires_dated_sources: true, sources: [{ id: 's1', published_at: '2026-01-01T00:00:00Z' }] },
      shouldBlock: false,
    },
  ])('freshness corpus: $name', ({ input, shouldBlock }) => {
    expectGate(handleCheckFreshness(input, engine), shouldBlock);
  });

  it.each([
    {
      name: 'linear plan',
      input: { steps: [{ id: 'a', description: 'Prepare release', dependencies: [] }, { id: 'b', description: 'Ship release', dependencies: ['a'] }] },
    },
    {
      name: 'dependency cycle',
      input: { steps: [{ id: 'a', description: 'Step A', dependencies: ['b'] }, { id: 'b', description: 'Step B', dependencies: ['a'] }] },
    },
    {
      name: 'missing prerequisite',
      input: { steps: [{ id: 'a', description: 'Step A', dependencies: ['missing'] }, { id: 'b', description: 'Step B', dependencies: ['a'] }] },
    },
  ])('plan validity corpus: $name', ({ input }) => {
    const shouldBlock = hasPlanCycle(input as PlanInput) || hasMissingPlanPrereq(input as PlanInput);
    const out = handleCheckPlanValidity(input, engine);
    expectGate(out, shouldBlock);
  });
});

describe('differential max-flow redundant evidence harness', () => {
  it.each([
    {
      name: 'two disjoint independent paths',
      graph: {
        nodes: [
          { id: 'e1', label: 'load test shows p99 at 180ms', type: 'evidence' },
          { id: 'e2', label: 'production telemetry shows low saturation', type: 'evidence' },
          { id: 'c1', label: 'latency is acceptable', type: 'claim' },
          { id: 'c2', label: 'capacity is acceptable', type: 'claim' },
          { id: 'cn', label: 'release can proceed', type: 'conclusion' },
        ],
        edges: [
          { from: 'e1', to: 'c1', relation: 'supports' },
          { from: 'c1', to: 'cn', relation: 'implies' },
          { from: 'e2', to: 'c2', relation: 'supports' },
          { from: 'c2', to: 'cn', relation: 'implies' },
        ],
        require_redundancy_for: ['cn'],
      },
    },
    {
      name: 'shared intermediate claim is not vertex-disjoint',
      graph: {
        nodes: [
          { id: 'e1', label: 'load test shows p99 at 180ms', type: 'evidence' },
          { id: 'e2', label: 'production telemetry shows low saturation', type: 'evidence' },
          { id: 'c1', label: 'readiness claim', type: 'claim' },
          { id: 'cn', label: 'release can proceed', type: 'conclusion' },
        ],
        edges: [
          { from: 'e1', to: 'c1', relation: 'supports' },
          { from: 'e2', to: 'c1', relation: 'supports' },
          { from: 'c1', to: 'cn', relation: 'implies' },
        ],
        require_redundancy_for: ['cn'],
      },
    },
    {
      name: 'near-duplicate evidence is not independent',
      graph: {
        nodes: [
          { id: 'e1', label: 'benchmark result latency 180ms', type: 'evidence' },
          { id: 'e2', label: 'latency 180ms benchmark result', type: 'evidence' },
          { id: 'cn', label: 'release can proceed', type: 'conclusion' },
        ],
        edges: [
          { from: 'e1', to: 'cn', relation: 'supports' },
          { from: 'e2', to: 'cn', relation: 'supports' },
        ],
        require_redundancy_for: ['cn'],
      },
    },
    {
      name: 'derived evidence leaves one independent root',
      graph: {
        nodes: [
          { id: 'e1', label: 'source log shows error rate below threshold', type: 'evidence' },
          { id: 'e2', label: 'summary derived from source log', type: 'evidence' },
          { id: 'cn', label: 'release can proceed', type: 'conclusion' },
        ],
        edges: [
          { from: 'e1', to: 'cn', relation: 'supports' },
          { from: 'e1', to: 'e2', relation: 'supports' },
          { from: 'e2', to: 'cn', relation: 'supports' },
        ],
        require_redundancy_for: ['cn'],
      },
    },
  ])('$name', ({ graph }) => {
    const expectedPass = expectedRedundantEvidence(graph as ReasoningInput, 'cn');
    const out = handleValidateReasoningChain(graph, engine);
    expectGate(out, !expectedPass);
    expect(mechanisms(out).includes('redundant_evidence')).toBe(!expectedPass);
  });
});

describe('finalize chokepoint bypass attempts', () => {
  const factualContract = {
    contract_id: 'fg',
    contract_authority: 'host',
    profile_source: 'host_supplied',
    original_request_text: 'Does the release use a write-ahead log?',
    task_type: 'factual_qa',
    evidence_level: 'cited',
    risk_level: 'low',
    claims: [{ id: 'c1', text: 'The release uses a write-ahead log', claim_kind: 'status' }],
    must_include: ['write-ahead log'],
  };
  const factualArtifacts = {
    answer_text: 'The release uses a write-ahead log.',
    sources: [{ id: 's1', text: 'The release uses a write-ahead log for recovery.' }],
    claims: [{ claim_id: 'c1', claim_text: 'The release uses a write-ahead log', source_id: 's1', quoted_span: 'The release uses a write-ahead log', supporting_token: 'write-ahead log', claim_kind: 'status' }],
  };
  const numericInput = {
    contract: {
      contract_id: 'ng',
      contract_authority: 'host',
      profile_source: 'host_supplied',
      original_request_text: 'What is the monthly total of 120 and 30?',
      task_type: 'numeric_analysis',
      evidence_level: 'rederived',
      risk_level: 'low',
    },
    answer_text: 'The monthly total is 150.',
    inputs: [120, 30],
    conclusion_numbers: [{ value: 150, origin: 'derived', op: 'sum', input_refs: [0, 1] }],
    arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 150 }],
  };

  it('passes a clean factual and numeric deliverable through the chokepoint', () => {
    expect(handleFinalizeDeliverable({ contract: factualContract, ...factualArtifacts }, engine).finalize_verdict).toBe('PASS');
    expect(handleFinalizeDeliverable(numericInput, engine).finalize_verdict).toBe('PASS');
  });

  it('rejects prior tool-result hashes as acceptance evidence', () => {
    expect(() =>
      handleFinalizeDeliverable(
        {
          contract: { ...factualContract, acceptance_criteria: [{ id: 'fake', kind: 'tool_result', text: 'prior PASS', bound: 'abc123' }] },
          ...factualArtifacts,
        },
        engine,
      ),
    ).toThrow(/tool_result/);
  });

  it.each([
    {
      name: 'missing required grounding artifacts',
      input: { contract: factualContract, answer_text: factualArtifacts.answer_text },
      mechanism: 'finalize_missing_inputs',
    },
    {
      name: 'claim id reused with swapped grounded text',
      input: {
        contract: factualContract,
        answer_text: factualArtifacts.answer_text,
        sources: [{ id: 's1', text: 'The release uses a redo log for recovery.' }],
        claims: [{ claim_id: 'c1', claim_text: 'The release uses a redo log', source_id: 's1', quoted_span: 'The release uses a redo log', supporting_token: 'redo log', claim_kind: 'status' }],
      },
      mechanism: 'finalize_claim_binding',
    },
    {
      name: 'required answer substring omitted',
      input: { contract: factualContract, ...factualArtifacts, answer_text: 'The release has durable recovery.' },
      mechanism: 'must_include',
    },
    {
      name: 'supplied case partition is not MECE',
      input: { contract: { ...factualContract, evidence_level: 'none' }, answer_text: 'Use warm and cold cases.', case_partition: { domain: { type: 'enum', values: ['warm', 'cold'] }, cases: [{ label: 'a', members: ['warm'] }, { label: 'b', members: ['warm'] }] } },
      mechanism: 'partition_gap',
    },
    {
      name: 'flattened derived number is laundered into inputs',
      input: { ...numericInput, answer_text: '120 + 30 = 999.', inputs: [120, 30, 999], conclusion_numbers: [{ value: 999, origin: 'derived', op: 'sum', input_refs: [2] }], arithmetic_checks: [{ claim_type: 'sum', values: [120, 30], claimed_result: 999 }] },
      mechanism: 'number_input_anchor',
    },
    {
      name: 'untraced answer number appears after trace passes',
      input: { ...numericInput, answer_text: 'The monthly total is 150 with 25 percent savings.' },
      mechanism: 'number_provenance',
    },
  ])('blocks bypass: $name', ({ input, mechanism }) => {
    const out = handleFinalizeDeliverable(input, engine);
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(mechanisms(out)).toContain(mechanism);
  });
});

describe('determinism checks', () => {
  it.each([
    {
      name: 'case partition',
      run: () => handleCheckCasePartition({ domain: { type: 'numeric', min: 0, max: 10 }, cases: [{ label: 'a', lo: 0, hi: 5 }, { label: 'b', lo: 5, hi: 10, hi_inclusive: true }] }, engine),
    },
    {
      name: 'numeric tracing',
      run: () => handleTraceConclusionNumbers({ inputs: [4, 5], conclusion_numbers: [{ value: 20, origin: 'derived', op: 'product', input_refs: [0, 1] }], answer_text: 'Result is 20.', strict_answer_numbers: true }, engine),
    },
    {
      name: 'plan validity',
      run: () => handleCheckPlanValidity({ steps: [{ id: 'a', description: 'Prepare', dependencies: [] }, { id: 'b', description: 'Ship', dependencies: ['a'] }] }, engine),
    },
    {
      name: 'reasoning chain',
      run: () => handleValidateReasoningChain({
        nodes: [
          { id: 'e1', label: 'telemetry says p99 below threshold', type: 'evidence' },
          { id: 'e2', label: 'audit says rollback path is ready', type: 'evidence' },
          { id: 'cn', label: 'release can proceed', type: 'conclusion' },
        ],
        edges: [{ from: 'e1', to: 'cn', relation: 'supports' }, { from: 'e2', to: 'cn', relation: 'supports' }],
        require_redundancy_for: ['cn'],
      }, engine),
    },
    {
      name: 'finalize',
      run: () => handleFinalizeDeliverable({
        contract: { contract_id: 'det', contract_authority: 'host', profile_source: 'host_supplied', original_request_text: 'What is 4 times 5?', task_type: 'numeric_analysis', evidence_level: 'rederived', risk_level: 'low' },
        answer_text: 'The product is 20.',
        inputs: [4, 5],
        conclusion_numbers: [{ value: 20, origin: 'derived', op: 'product', input_refs: [0, 1] }],
        arithmetic_checks: [{ claim_type: 'product', values: [4, 5], claimed_result: 20 }],
      }, engine),
    },
  ])('$name output is repeatable', ({ run }) => {
    const first = run();
    for (let i = 0; i < 5; i++) expect(clone(run())).toEqual(clone(first));
  });
});
