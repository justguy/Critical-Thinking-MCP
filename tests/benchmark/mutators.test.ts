/**
 * GUARDRAIL TESTS for the injected-defect mutators (plan §8, §7).
 *
 * The whole methodology-C claim rests on one invariant: every mutant must be
 * GENUINELY oracle-WRONG, and every correct base genuinely oracle-CORRECT. If a
 * "mutant" still grades correct, then a future "the gate caught it" is an oracle
 * artifact, not a real catch. These tests prove the invariant deterministically,
 * with NO gate and NO model calls.
 *
 * Coverage:
 *   1. Every correct base is oracle-CORRECT.
 *   2. Every emitted mutant is oracle-WRONG (gradeWithOracle(...).correct === false).
 *   3. Per-oracle-kind defect-class coverage and expected §7 blocker codes.
 *   4. Mutator determinism (same input -> identical output).
 */

import { describe, it, expect } from 'vitest';

import { gradeWithOracle, type Oracle } from '../../benchmark/oracles.js';
import {
  mutateBase,
  mutateAll,
  isGenuinelyWrong,
  type CorrectBase,
  type Mutant,
} from '../../benchmark/mutators.js';
import { buildCorrectBases, basesProvenance } from '../../benchmark/calibration_bases.js';

// ── Bases ───────────────────────────────────────────────────────────────────
const BASES = buildCorrectBases();
const MUTANTS = mutateAll(BASES);

describe('correct bases', () => {
  it('builds a non-trivial number of bases from the calibration corpus', () => {
    // The calibration corpus has 47 tasks; we expect a base for (nearly) all of them.
    expect(BASES.length).toBeGreaterThanOrEqual(40);
  });

  it('every correct base is genuinely oracle-CORRECT', () => {
    const bad = BASES.filter((b) => gradeWithOracle(b.oracle, b.answer).correct !== true);
    expect(bad.map((b) => b.id)).toEqual([]);
  });

  it('reports honest provenance (recorded vs synthesized)', () => {
    const p = basesProvenance(BASES);
    expect(p.total).toBe(BASES.length);
    expect(p.recorded + p.synthetic).toBe(p.total);
    // Calibration JSONs exist, so at least some bases must be REAL recorded answers.
    expect(p.recorded).toBeGreaterThan(0);
  });
});

// ── The core invariant: every mutant is genuinely wrong ───────────────────────
describe('every mutant is genuinely oracle-WRONG', () => {
  it('produces a non-trivial number of mutants', () => {
    expect(MUTANTS.length).toBeGreaterThan(BASES.length); // multiple mutants per base
  });

  it('gradeWithOracle(mutant).correct === false for EVERY mutant', () => {
    const survivors = MUTANTS.filter((m) => !isGenuinelyWrong(m));
    // If any survive, surface their ids and the oracle verdict for debugging.
    expect(
      survivors.map((m) => ({
        id: m.id,
        verdict: gradeWithOracle(m.oracle, m.mutated_answer),
      })),
    ).toEqual([]);
  });

  it('every mutant differs from its (correct) base answer', () => {
    const unchanged = MUTANTS.filter((m) => m.mutated_answer === m.base_answer);
    expect(unchanged.map((m) => m.id)).toEqual([]);
  });
});

// ── Per-oracle-kind defect classes and expected §7 codes ──────────────────────
describe('gold_answer mutators', () => {
  const base: CorrectBase = {
    id: 'unit-gold',
    oracle: { kind: 'gold_answer', gold: 77, tolerance: 0.01, distractors: [76.25, 70] } as Oracle,
    answer: '77',
  };
  const mutants = mutateBase(base);

  it('emits unweighted_substitution, dropped_intermediate, boundary_off_by_one', () => {
    expect(mutants.map((m) => m.label.defect_class).sort()).toEqual(
      ['boundary_off_by_one', 'dropped_intermediate', 'unweighted_substitution'],
    );
  });

  it('all expect NUMERIC_MISMATCH', () => {
    expect(mutants.every((m) => m.label.expected_blocker_code === 'NUMERIC_MISMATCH')).toBe(true);
  });

  it('unweighted_substitution uses the first declared distractor', () => {
    const m = mutants.find((x) => x.label.defect_class === 'unweighted_substitution')!;
    expect(m.mutated_answer).toBe('76.25');
  });

  it('boundary_off_by_one is gold +/- 1 and outside tolerance', () => {
    const m = mutants.find((x) => x.label.defect_class === 'boundary_off_by_one')!;
    expect(m.mutated_answer).toBe('78'); // 77 + 1
  });

  it('every gold mutant is wrong even without declared distractors', () => {
    const noDistractors: CorrectBase = {
      id: 'unit-gold-nd',
      oracle: { kind: 'gold_answer', gold: 100 } as Oracle,
      answer: '100',
    };
    const ms = mutateBase(noDistractors);
    expect(ms.length).toBe(3);
    expect(ms.every(isGenuinelyWrong)).toBe(true);
  });
});

describe('source_span mutators', () => {
  const base: CorrectBase = {
    id: 'unit-span',
    oracle: {
      kind: 'source_span',
      source_text: 'The data center is located in Frankfurt.',
      gold_span: 'frankfurt',
      planted_unsupported: ['amsterdam', 'paris'],
    } as Oracle,
    answer: 'The data center is located in Frankfurt.',
  };
  const mutants = mutateBase(base);

  it('emits unsupported_fact and stripped_gold_span', () => {
    expect(mutants.map((m) => m.label.defect_class).sort()).toEqual(
      ['stripped_gold_span', 'unsupported_fact'],
    );
  });

  it('unsupported_fact expects UNSUPPORTED_CLAIM and asserts the planted fact', () => {
    const m = mutants.find((x) => x.label.defect_class === 'unsupported_fact')!;
    expect(m.label.expected_blocker_code).toBe('UNSUPPORTED_CLAIM');
    const v = gradeWithOracle(m.oracle, m.mutated_answer);
    expect(v.correct).toBe(false);
    expect(v.reasons.some((r) => r.startsWith('asserted_unsupported'))).toBe(true);
  });

  it('stripped_gold_span expects SOURCE_SPAN_MISMATCH and drops the gold span', () => {
    const m = mutants.find((x) => x.label.defect_class === 'stripped_gold_span')!;
    expect(m.label.expected_blocker_code).toBe('SOURCE_SPAN_MISMATCH');
    const v = gradeWithOracle(m.oracle, m.mutated_answer);
    expect(v.correct).toBe(false);
    expect(v.reasons).toContain('missing_gold_span');
    // and NOT a fabrication — the sole defect is the missing grounded fact.
    expect(v.reasons.some((r) => r.startsWith('asserted_unsupported'))).toBe(false);
  });

  it('strips a SINGLE-TOKEN gold span too (regression: "not" must not survive)', () => {
    const single: CorrectBase = {
      id: 'unit-span-single',
      oracle: {
        kind: 'source_span',
        source_text: 'Acme is a growing startup with offices in three cities.',
        gold_span: 'not',
        planted_unsupported: ['50 employees', 'about', 'approximately'],
      } as Oracle,
      answer: 'The source does not specify the number of employees.',
    };
    const ms = mutateBase(single);
    const strip = ms.find((x) => x.label.defect_class === 'stripped_gold_span')!;
    expect(gradeWithOracle(strip.oracle, strip.mutated_answer).correct).toBe(false);
  });
});

describe('structured_constraint mutators', () => {
  const base: CorrectBase = {
    id: 'unit-constr',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'replicas-min', field: 'replicas', op: '>=', value: 3 },
        { id: 'replicas-max', field: 'replicas', op: '<=', value: 5 },
        { id: 'timeout-min', field: 'timeout_ms', op: '>', value: 1000 },
        { id: 'no-legacy', field: 'use_legacy_auth', op: '==', value: false },
      ],
    } as Oracle,
    answer: '{"replicas": 4, "timeout_ms": 3000, "use_legacy_auth": false}',
  };
  const mutants = mutateBase(base);

  it('emits field_across_bound, dropped_required_field, flipped_must_not', () => {
    expect(mutants.map((m) => m.label.defect_class).sort()).toEqual(
      ['dropped_required_field', 'field_across_bound', 'flipped_must_not'],
    );
  });

  it('field_across_bound violates a numeric bound (CONSTRAINT_VIOLATION)', () => {
    const m = mutants.find((x) => x.label.defect_class === 'field_across_bound')!;
    expect(m.label.expected_blocker_code).toBe('CONSTRAINT_VIOLATION');
    expect(gradeWithOracle(m.oracle, m.mutated_answer).correct).toBe(false);
  });

  it('dropped_required_field removes the field (MISSING_REQUIREMENT)', () => {
    const m = mutants.find((x) => x.label.defect_class === 'dropped_required_field')!;
    expect(m.label.expected_blocker_code).toBe('MISSING_REQUIREMENT');
    const obj = JSON.parse(m.mutated_answer);
    expect(obj).not.toHaveProperty(m.label.mutated_field);
    expect(gradeWithOracle(m.oracle, m.mutated_answer).correct).toBe(false);
  });

  it('flipped_must_not flips the equality field (CONSTRAINT_VIOLATION)', () => {
    const m = mutants.find((x) => x.label.defect_class === 'flipped_must_not')!;
    expect(m.label.expected_blocker_code).toBe('CONSTRAINT_VIOLATION');
    const obj = JSON.parse(m.mutated_answer);
    // The must-not (use_legacy_auth == false) was flipped to true.
    expect(obj.use_legacy_auth).toBe(true);
    expect(gradeWithOracle(m.oracle, m.mutated_answer).correct).toBe(false);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────
describe('mutator determinism', () => {
  it('mutateBase is a pure function (identical output across calls)', () => {
    const base = BASES[0];
    expect(JSON.stringify(mutateBase(base))).toBe(JSON.stringify(mutateBase(base)));
  });

  it('mutateAll is order- and content-stable', () => {
    const a = mutateAll(BASES);
    const b = mutateAll(BASES);
    expect(a.map((m: Mutant) => m.id)).toEqual(b.map((m: Mutant) => m.id));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('mutant ids are unique', () => {
    const ids = MUTANTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
