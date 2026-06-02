/**
 * Tests for the injected-defect SCORER and the GateUnderTest contract (plan §10).
 *
 * These prove the base-rate-independent block accounting is computed correctly,
 * using:
 *   - the oracle-backed STUB gate (a perfect gate by construction), and
 *   - hand-built IMPERFECT gates (misses, false blocks, wrong codes) to verify the
 *     scorer reports the right recall / false-block / precision / code accuracy.
 *
 * NO model calls, NO live enforcement gate.
 */

import { describe, it, expect } from 'vitest';

import { scoreGate } from '../../benchmark/defect_scorer.js';
import {
  oracleStubGate,
  type GateUnderTest,
} from '../../benchmark/gate_under_test.js';
import { mutateAll, type CorrectBase } from '../../benchmark/mutators.js';
import { buildCorrectBases } from '../../benchmark/calibration_bases.js';

const BASES: CorrectBase[] = buildCorrectBases();
const MUTANTS = mutateAll(BASES);

describe('oracle-backed stub gate (perfect by construction)', () => {
  const score = scoreGate(oracleStubGate, MUTANTS, BASES);

  it('blocks every mutant (recall = 1)', () => {
    expect(score.block_recall).toBe(1);
    expect(score.blocked_mutated).toBe(score.total_mutated);
  });

  it('blocks no correct base (false_block_rate = 0)', () => {
    expect(score.false_block_rate).toBe(0);
    expect(score.blocked_correct).toBe(0);
  });

  it('has perfect precision (no false blocks)', () => {
    expect(score.block_precision).toBe(1);
  });

  it('emits the expected §7 code for every mutant (code accuracy = 1)', () => {
    expect(score.blocker_code_accuracy).toBe(1);
  });

  it('breaks down recall by §7 code with full coverage', () => {
    for (const slot of Object.values(score.by_blocker_code)) {
      expect(slot.recall).toBe(1);
      expect(slot.code_accuracy).toBe(1);
    }
  });
});

describe('scorer arithmetic on an IMPERFECT gate', () => {
  // Build a tiny controlled population: 4 mutants, 2 correct bases.
  const oracleNum = { kind: 'gold_answer', gold: 10 } as const;
  const correct: CorrectBase[] = [
    { id: 'c1', oracle: oracleNum, answer: '10' },
    { id: 'c2', oracle: oracleNum, answer: '10' },
  ];
  // 4 synthetic mutants (we hand them to the scorer directly).
  const mutants = [
    mkMutant('m1', 'NUMERIC_MISMATCH'),
    mkMutant('m2', 'NUMERIC_MISMATCH'),
    mkMutant('m3', 'NUMERIC_MISMATCH'),
    mkMutant('m4', 'NUMERIC_MISMATCH'),
  ];

  // Gate: blocks m1,m2,m3 (misses m4 => recall 3/4); wrong code on m3; and
  // false-blocks c1 (=> false_block 1/2). TP=3, FP=1 => precision 3/4.
  const gate: GateUnderTest = (b) => {
    if (b.id === 'm1') return { blocked: true, blocker_code: 'NUMERIC_MISMATCH' };
    if (b.id === 'm2') return { blocked: true, blocker_code: 'NUMERIC_MISMATCH' };
    if (b.id === 'm3') return { blocked: true, blocker_code: 'CONSTRAINT_VIOLATION' }; // wrong code
    if (b.id === 'm4') return { blocked: false, blocker_code: null }; // miss
    if (b.id === 'c1') return { blocked: true, blocker_code: 'NUMERIC_MISMATCH' }; // false block
    return { blocked: false, blocker_code: null }; // c2 correctly passed
  };

  const score = scoreGate(gate, mutants, correct);

  it('block_recall = blocked(mutated)/total mutated = 3/4', () => {
    expect(score.block_recall).toBe(0.75);
  });

  it('false_block_rate = blocked(correct)/total correct = 1/2', () => {
    expect(score.false_block_rate).toBe(0.5);
  });

  it('block_precision = TP/(TP+FP) = 3/(3+1) = 0.75', () => {
    expect(score.block_precision).toBe(0.75);
  });

  it('blocker_code_accuracy = correct-code blocks / blocked mutants = 2/3', () => {
    expect(score.blocker_code_accuracy).toBeCloseTo(2 / 3, 10);
  });

  it('records per-mutant outcomes including the miss and the wrong code', () => {
    const byId = Object.fromEntries(score.mutant_outcomes.map((o) => [o.mutant_id, o]));
    expect(byId.m4.blocked).toBe(false);
    expect(byId.m3.blocked).toBe(true);
    expect(byId.m3.code_correct).toBe(false);
    expect(byId.m1.code_correct).toBe(true);
  });
});

describe('scorer edge cases', () => {
  it('is NaN-safe with empty populations', () => {
    const score = scoreGate(oracleStubGate, [], []);
    expect(score.block_recall).toBe(0);
    expect(score.false_block_rate).toBe(0);
    expect(score.block_precision).toBe(0);
    expect(score.blocker_code_accuracy).toBe(0);
  });

  it('precision is 0 when a gate blocks nothing', () => {
    const silent: GateUnderTest = () => ({ blocked: false, blocker_code: null });
    const score = scoreGate(silent, [mkMutant('m1', 'NUMERIC_MISMATCH')], []);
    expect(score.block_recall).toBe(0);
    expect(score.block_precision).toBe(0);
  });
});

// Build a minimal Mutant for scorer arithmetic tests (oracle is unused by the
// hand-built gate, but typed correctly).
function mkMutant(id: string, expected: 'NUMERIC_MISMATCH' | 'CONSTRAINT_VIOLATION') {
  return {
    id,
    base_id: id,
    oracle_kind: 'gold_answer' as const,
    oracle: { kind: 'gold_answer', gold: 0 } as const,
    base_answer: '0',
    mutated_answer: '999',
    label: {
      defect_class: 'unweighted_substitution' as const,
      mutated_field: 'final_answer',
      expected_blocker_code: expected,
    },
  };
}
