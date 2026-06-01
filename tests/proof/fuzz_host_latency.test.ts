/**
 * Deterministic fuzz + host-wrapper + latency proof tests.
 *
 * The fuzz corpus is generated from fixed seeds and stays inside each handler's
 * valid input contract except where a validation error is explicitly asserted.
 */

import { performance } from 'node:perf_hooks';

import { describe, expect, it } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { sha256Hex } from '../../src/enforcement/utils.js';
import { enforceDeliverable, type ContractSpec, type DeliverableArtifacts } from '../../src/host/enforcement_host.js';
import { handleCheckCasePartition } from '../../src/tools/check_case_partition.js';
import { handleCheckFreshness } from '../../src/tools/check_freshness.js';
import { handleTraceConclusionNumbers } from '../../src/tools/trace_conclusion_numbers.js';
import type { FinalizeOutput } from '../../src/tools/finalize_deliverable.js';

const DAY_MS = 86_400_000;
const DAY_SECONDS = 86_400;

const FUZZ_PARTITIONS = 120;
const FUZZ_TRACES = 144;
const FUZZ_FRESHNESS = 96;
const TYPICAL_LATENCY_CASES = 150;
const ADVERSARIAL_LATENCY_CASES = 30;
const TYPICAL_P95_BUDGET_MS = 50;
const ADVERSARIAL_P95_BUDGET_MS = 500;

const engine = new EnforcementEngine();

type NumericCase = {
  label: string;
  lo: number;
  hi: number;
  lo_inclusive?: boolean;
  hi_inclusive?: boolean;
};

type PartitionInput =
  | { domain: { type: 'numeric'; min: number; max: number }; cases: NumericCase[] }
  | { domain: { type: 'enum'; values: string[] }; cases: Array<{ label: string; members: string[] }> };

type TraceInput = {
  inputs: number[];
  conclusion_numbers: Array<{ value: number; origin: 'literal' | 'identity' | 'derived'; op?: string; input_refs: number[] }>;
  answer_text: string;
  strict_answer_numbers: boolean;
};

type FreshnessInput = {
  eval_time: { value: string; authority: 'host' | 'agent' };
  max_age_seconds: number;
  requires_dated_sources: boolean;
  sources: Array<{ id: string; published_at: string }>;
};

type LatencyCase = { name: string; run: () => void };

class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 0x1_0000_0000;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

function isoFromOffsetDays(baseIso: string, offsetDays: number): string {
  return new Date(Date.parse(baseIso) + offsetDays * DAY_MS).toISOString();
}

function numericPartition(rng: Rng, index: number): PartitionInput {
  const min = rng.int(-200, 20);
  const width = rng.int(20, 260);
  const max = min + width;
  const caseCount = rng.int(2, 7);
  const cuts = new Set<number>();
  while (cuts.size < caseCount - 1) {
    cuts.add(min + rng.int(1, width - 1));
  }
  const points = [min, ...[...cuts].sort((a, b) => a - b), max];
  const cases = points.slice(0, -1).map((lo, i) => ({
    label: `n${index}_${i}`,
    lo,
    hi: points[i + 1],
    hi_inclusive: i === points.length - 2,
  }));
  return { domain: { type: 'numeric', min, max }, cases };
}

function enumPartition(rng: Rng, index: number): PartitionInput {
  const valueCount = rng.int(3, 12);
  const bucketCount = rng.int(2, Math.min(5, valueCount));
  const values = Array.from({ length: valueCount }, (_, i) => `v${index}_${i}`);
  const cases = Array.from({ length: bucketCount }, (_, i) => ({ label: `e${index}_${i}`, members: [] as string[] }));
  for (let i = 0; i < values.length; i++) {
    cases[i % bucketCount].members.push(values[i]);
  }
  return { domain: { type: 'enum', values }, cases };
}

function partitionCorpus(count: number): PartitionInput[] {
  const rng = new Rng(0x5eed_cafe);
  return Array.from({ length: count }, (_, i) => (i % 3 === 0 ? enumPartition(rng, i) : numericPartition(rng, i)));
}

function traceCorpus(count: number): TraceInput[] {
  const rng = new Rng(0xdecafbad);
  const ops = ['sum', 'diff', 'product', 'ratio', 'pct_of', 'mean'] as const;
  return Array.from({ length: count }, (_, i) => {
    const op = ops[i % ops.length];
    const inputs = Array.from({ length: op === 'mean' || op === 'sum' ? 3 : 2 }, () => rng.int(1, 90));
    if (op === 'diff' && inputs[0] < inputs[1]) {
      [inputs[0], inputs[1]] = [inputs[1], inputs[0]];
    }
    let value: number;
    if (op === 'sum') value = inputs.reduce((sum, n) => sum + n, 0);
    else if (op === 'diff') value = inputs[0] - inputs[1];
    else if (op === 'product') value = inputs[0] * inputs[1];
    else if (op === 'ratio') value = inputs[0] / inputs[1];
    else if (op === 'pct_of') value = (inputs[0] / inputs[1]) * 100;
    else value = inputs.reduce((sum, n) => sum + n, 0) / inputs.length;

    return {
      inputs,
      conclusion_numbers: [{ value, origin: 'derived', op, input_refs: inputs.map((_, ref) => ref) }],
      answer_text: `Result is ${value}.`,
      strict_answer_numbers: true,
    };
  });
}

function freshnessCorpus(count: number): FreshnessInput[] {
  const rng = new Rng(0xf00d_2026);
  const evalIso = '2026-05-30T00:00:00.000Z';
  return Array.from({ length: count }, (_, i) => {
    const maxAgeDays = rng.int(7, 120);
    const sourceCount = rng.int(1, 4);
    const sources = Array.from({ length: sourceCount }, (_, j) => ({
      id: `s${i}_${j}`,
      published_at: isoFromOffsetDays(evalIso, -rng.int(0, maxAgeDays)),
    }));
    return {
      eval_time: { value: evalIso, authority: 'host' },
      max_age_seconds: maxAgeDays * DAY_SECONDS,
      requires_dated_sources: true,
      sources,
    };
  });
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.95)];
}

function measureP95(cases: LatencyCase[]): number {
  const timings: number[] = [];
  for (const c of cases) {
    const start = performance.now();
    c.run();
    timings.push(performance.now() - start);
  }
  return p95(timings);
}

function factualSpec(overrides: Partial<ContractSpec> = {}): ContractSpec {
  return {
    contract_id: 'proof-host-1',
    original_request_text: 'Is Redis single-threaded for command execution?',
    task_type: 'factual_qa',
    evidence_level: 'cited',
    risk_level: 'high',
    claims: [{ id: 'cl1', text: 'Redis executes commands single-threaded' }],
    ...overrides,
  };
}

function groundedArtifacts(answer_text = 'Redis executes commands single-threaded.'): DeliverableArtifacts {
  return {
    answer_text,
    sources: [{ id: 's1', text: 'Redis executes commands single-threaded for command execution.' }],
    claims: [
      {
        claim_id: 'cl1',
        claim_text: 'Redis executes commands single-threaded',
        source_id: 's1',
        quoted_span: 'Redis executes commands single-threaded',
        supporting_token: 'single-threaded',
        claim_kind: 'status',
      },
    ],
  };
}

function passingFinalize(answerText: string, contractStrength: FinalizeOutput['contract_strength']): FinalizeOutput {
  return {
    status: 'PASS',
    finalize_verdict: 'PASS',
    answer_text_hash: sha256Hex(answerText),
    answer_text_length: answerText.length,
    required_checks: [],
    re_executed: [],
    contract_strength: contractStrength,
    context_used: false,
  };
}

describe('deterministic fuzz corpus', () => {
  it(`does not crash or block on ${FUZZ_PARTITIONS} valid-ish MECE partitions`, () => {
    for (const input of partitionCorpus(FUZZ_PARTITIONS)) {
      expect(() => handleCheckCasePartition(input, engine)).not.toThrow();
      const out = handleCheckCasePartition(input, engine);
      expect(out.status).toBe('PASS');
      expect(out.is_mece).toBe(true);
    }
  });

  it(`does not crash or block on ${FUZZ_TRACES} valid-ish numeric tracing samples`, () => {
    for (const input of traceCorpus(FUZZ_TRACES)) {
      expect(() => handleTraceConclusionNumbers(input, engine)).not.toThrow();
      const out = handleTraceConclusionNumbers(input, engine);
      expect(out.status).toBe('PASS');
      expect(out.traced_ratio).toBe(1);
      expect(out.untraced_answer_numbers).toEqual([]);
    }
  });

  it(`does not crash or block on ${FUZZ_FRESHNESS} valid-ish freshness samples`, () => {
    for (const input of freshnessCorpus(FUZZ_FRESHNESS)) {
      expect(() => handleCheckFreshness(input, engine)).not.toThrow();
      const out = handleCheckFreshness(input, engine);
      expect(out.status).toBe('PASS');
      expect(out.results.every(result => result.status === 'fresh')).toBe(true);
    }
  });

  it('asserts validation errors only for intentionally malformed fuzz inputs', () => {
    expect(() =>
      handleCheckCasePartition({ domain: { type: 'numeric', min: Number.NaN, max: 10 }, cases: [{ label: 'a', lo: 0, hi: 5 }, { label: 'b', lo: 5, hi: 10 }] }, engine),
    ).toThrow(/domain\.min/);
    expect(() =>
      handleTraceConclusionNumbers({ inputs: [10, 2, 1], conclusion_numbers: [{ value: 5, origin: 'derived', op: 'ratio', input_refs: [0, 1, 2] }] }, engine),
    ).toThrow(/exactly 2 input_refs/);
    expect(() =>
      handleCheckFreshness({ eval_time: { value: '2026-05-30', authority: 'host' }, max_age_seconds: DAY_SECONDS, sources: [{ id: 's1', published_at: '2026-05-29T00:00:00Z' }] }, engine),
    ).toThrow(/fully-zoned/);
  });
});

describe('host-wrapper enforcement proof', () => {
  it('rejects gate blocks from finalize_deliverable', () => {
    const bad = groundedArtifacts('Redis uses multiple threads.');
    bad.claims![0].quoted_span = 'Redis uses multiple threads for command execution';
    const decision = enforceDeliverable(factualSpec({ claims: [{ id: 'cl1', text: 'Redis uses multiple threads' }] }), bad);

    expect(decision.decision).toBe('REJECT');
    expect(decision.reason).toBe('gate_block');
    expect(decision.finalize_verdict).toBe('BLOCK');
    expect(decision.blocking_issues.length).toBeGreaterThan(0);
  });

  it('rejects hash swaps after a PASS', () => {
    const decision = enforceDeliverable(factualSpec(), groundedArtifacts(), {
      surfaced_answer: 'Redis executes commands single-threaded. This extra shipped sentence was not checked.',
    });

    expect(decision.decision).toBe('REJECT');
    expect(decision.reason).toBe('hash_mismatch');
    expect(decision.surfaced_answer_hash).not.toBe(decision.answer_text_hash);
  });

  it('rejects missing artifacts for required checks', () => {
    const decision = enforceDeliverable(factualSpec(), { answer_text: 'Redis executes commands single-threaded.' });

    expect(decision.decision).toBe('REJECT');
    expect(decision.reason).toBe('gate_block');
    expect(decision.blocking_issues.some(issue => issue.mechanism === 'finalize_missing_inputs')).toBe(true);
  });

  it('authors the real finalize contract at the host boundary', () => {
    let capturedContract: Record<string, unknown> | null = null;
    const answer = 'Host checked answer.';
    const decision = enforceDeliverable(
      factualSpec({ evidence_level: 'none', risk_level: 'low', claims: [] }),
      { answer_text: answer },
      {
        finalize: input => {
          capturedContract = (input as { contract: Record<string, unknown> }).contract;
          return passingFinalize(answer, 'host_anchored');
        },
      },
    );

    expect(decision.decision).toBe('RELEASE');
    expect(capturedContract?.contract_authority).toBe('host');
    expect(capturedContract?.profile_source).toBe('host_supplied');
  });

  it('does not relabel weak agent-declared finalize output as host-authored', () => {
    const answer = 'Weak contract answer.';
    const decision = enforceDeliverable(
      factualSpec({ evidence_level: 'none', risk_level: 'low', claims: [] }),
      { answer_text: answer },
      { finalize: () => passingFinalize(answer, 'weak_agent_declared') },
    );

    expect(decision.contract_strength).toBe('weak_agent_declared');
    expect(decision.contract_strength).not.toBe('host_anchored');
  });
});

describe('latency proof budgets', () => {
  it(`keeps typical deterministic corpus p95 <= ${TYPICAL_P95_BUDGET_MS}ms`, () => {
    const partitions = partitionCorpus(50);
    const traces = traceCorpus(50);
    const freshness = freshnessCorpus(50);
    const cases: LatencyCase[] = [
      ...partitions.map((input, i) => ({ name: `partition-${i}`, run: () => { expect(handleCheckCasePartition(input, engine).status).toBe('PASS'); } })),
      ...traces.map((input, i) => ({ name: `trace-${i}`, run: () => { expect(handleTraceConclusionNumbers(input, engine).status).toBe('PASS'); } })),
      ...freshness.map((input, i) => ({ name: `freshness-${i}`, run: () => { expect(handleCheckFreshness(input, engine).status).toBe('PASS'); } })),
    ];

    expect(cases).toHaveLength(TYPICAL_LATENCY_CASES);
    const observed = measureP95(cases);
    console.info(`[proof-metrics] typical cases=${cases.length} p95_ms=${observed.toFixed(3)} budget_ms=${TYPICAL_P95_BUDGET_MS}`);
    expect(observed).toBeLessThanOrEqual(TYPICAL_P95_BUDGET_MS);
  });

  it(`keeps adversarial-large deterministic corpus p95 <= ${ADVERSARIAL_P95_BUDGET_MS}ms`, () => {
    const cases: LatencyCase[] = Array.from({ length: ADVERSARIAL_LATENCY_CASES }, (_, i) => {
      if (i % 3 === 0) {
        const values = Array.from({ length: 900 }, (_, j) => `v${i}_${j}`);
        const input: PartitionInput = {
          domain: { type: 'enum', values },
          cases: Array.from({ length: 9 }, (_, bucket) => ({
            label: `bucket-${bucket}`,
            members: values.filter((_, j) => j % 9 === bucket),
          })),
        };
        return { name: `large-partition-${i}`, run: () => { expect(handleCheckCasePartition(input, engine).status).toBe('PASS'); } };
      }
      if (i % 3 === 1) {
        const inputs = Array.from({ length: 400 }, (_, j) => j + 1);
        const value = inputs.reduce((sum, n) => sum + n, 0);
        const input: TraceInput = {
          inputs,
          conclusion_numbers: [{ value, origin: 'derived', op: 'sum', input_refs: inputs.map((_, ref) => ref) }],
          answer_text: `Result is ${value}.`,
          strict_answer_numbers: true,
        };
        return { name: `large-trace-${i}`, run: () => { expect(handleTraceConclusionNumbers(input, engine).status).toBe('PASS'); } };
      }
      const evalIso = '2026-05-30T00:00:00.000Z';
      const input: FreshnessInput = {
        eval_time: { value: evalIso, authority: 'host' },
        max_age_seconds: 365 * DAY_SECONDS,
        requires_dated_sources: true,
        sources: Array.from({ length: 600 }, (_, j) => ({ id: `s${i}_${j}`, published_at: isoFromOffsetDays(evalIso, -(j % 300)) })),
      };
      return { name: `large-freshness-${i}`, run: () => { expect(handleCheckFreshness(input, engine).status).toBe('PASS'); } };
    });

    const observed = measureP95(cases);
    console.info(`[proof-metrics] adversarial_large cases=${cases.length} p95_ms=${observed.toFixed(3)} budget_ms=${ADVERSARIAL_P95_BUDGET_MS}`);
    expect(observed).toBeLessThanOrEqual(ADVERSARIAL_P95_BUDGET_MS);
  });
});
