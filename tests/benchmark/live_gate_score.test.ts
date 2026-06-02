/**
 * Guardrails for the LIVE gate-scoring run (dvp-p1a-run).
 *
 * These lock the two invariants that keep the precision/recall HONEST:
 *   1. Every CORRECT bundle case passes the REAL gate clean (no false block) — so
 *      false_block_rate measures the gate, not a mis-built fixture.
 *   2. Every MUTANT bundle case is GENUINELY wrong at the bundle level and the REAL
 *      gate blocks it — so block_recall is a real catch, not an artifact.
 * Plus the §10 metric shape and the §7-code breakdown that the run reports.
 *
 * NO model/LLM/CLI calls — the gate is deterministic code.
 */

import { describe, it, expect } from 'vitest';

import { buildCorrectBases } from '../../benchmark/calibration_bases.js';
import {
  allCorrectBundleCases,
  allMutantBundleCases,
} from '../../benchmark/bundle_cases.js';
import { realEnforcementGate } from '../../benchmark/gate_under_test.js';
import { scoreReal } from '../../benchmark/bundle_defect_scorer.js';

const BASES = buildCorrectBases().map(({ synthetic: _s, ...b }) => b);
const CORRECT = allCorrectBundleCases(BASES);
const MUTANTS = allMutantBundleCases(BASES);

describe('live gate-scoring guardrails', () => {
  it('builds a non-empty correct + mutant population from real bases', () => {
    expect(CORRECT.length).toBeGreaterThan(0);
    expect(MUTANTS.length).toBeGreaterThan(0);
  });

  it('GUARDRAIL 1: the real gate passes EVERY correct bundle case clean', () => {
    const falseBlocks = CORRECT.filter((c) => realEnforcementGate(c.payload).blocked);
    expect(falseBlocks.map((c) => c.id)).toEqual([]);
  });

  it('GUARDRAIL 2: the real gate blocks EVERY mutant bundle case', () => {
    const misses = MUTANTS.filter((m) => !realEnforcementGate(m.payload).blocked);
    expect(misses.map((m) => m.id)).toEqual([]);
  });

  it('every mutant block carries exactly one §7 taxonomy code', () => {
    for (const m of MUTANTS) {
      const d = realEnforcementGate(m.payload);
      expect(d.blocked).toBe(true);
      expect(d.blocker_code).not.toBeNull();
    }
  });
});

describe('live gate-scoring metrics (§10)', () => {
  const score = scoreReal(MUTANTS, CORRECT);

  it('reports perfect recall and zero false blocks on this population', () => {
    expect(score.block_recall).toBe(1);
    expect(score.false_block_rate).toBe(0);
    expect(score.block_precision).toBe(1);
  });

  it('exercises exactly the 4 §7 codes the settled bundle gate emits', () => {
    expect(new Set(Object.keys(score.by_emitted_code))).toEqual(
      new Set([
        'FINAL_ANSWER_ARTIFACT_DRIFT',
        'SOURCE_SPAN_MISMATCH',
        'CONSTRAINT_VIOLATION',
        'MISSING_REQUIREMENT',
      ]),
    );
  });

  it('honest code-accuracy: gold→drift and unsupported→span-mismatch are code mismatches', () => {
    // gold_answer mutants are LABELED NUMERIC_MISMATCH but the bundle surface is DRIFT.
    expect(score.by_expected_code.NUMERIC_MISMATCH.recall).toBe(1);
    expect(score.by_expected_code.NUMERIC_MISMATCH.code_accuracy).toBe(0);
    // unsupported_fact is LABELED UNSUPPORTED_CLAIM but the strong-grounding gate emits
    // SOURCE_SPAN_MISMATCH (it does not distinguish fabrication from a wrong span).
    expect(score.by_expected_code.UNSUPPORTED_CLAIM.recall).toBe(1);
    expect(score.by_expected_code.UNSUPPORTED_CLAIM.code_accuracy).toBe(0);
    // The three codes the bundle gate emits natively match their C label exactly.
    expect(score.by_expected_code.SOURCE_SPAN_MISMATCH.code_accuracy).toBe(1);
    expect(score.by_expected_code.CONSTRAINT_VIOLATION.code_accuracy).toBe(1);
    expect(score.by_expected_code.MISSING_REQUIREMENT.code_accuracy).toBe(1);
  });
});
