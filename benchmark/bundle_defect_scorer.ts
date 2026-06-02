/**
 * BUNDLE-LEVEL injected-defect scorer for the LIVE gate-scoring run (plan §10).
 *
 * Mirrors defect_scorer.ts (block_recall / false_block_rate / block_precision /
 * blocker_code_accuracy + by-§7-code breakdown) but over the REAL gate's native
 * input (bundle / grounding / constraint payloads) instead of answer text. The gate
 * under test is realEnforcementGate (gate_under_test.ts), which drives the ACTUAL
 * settled §9 Cat-1 gates + the contract constraint gate.
 *
 *   MUTANTS : known-WRONG bundle variants. A block is a TRUE block.
 *   CORRECT : verified-correct bundle cases. A block is a FALSE block.
 *
 * NO model/LLM calls (the gate is deterministic code).
 */

import type { CorrectBundleCase, MutantBundleCase } from './bundle_cases.js';
import { realEnforcementGate, type RealGate } from './gate_under_test.js';

export interface BundleMutantOutcome {
  id: string;
  base_id: string;
  oracle_kind: MutantBundleCase['oracle_kind'];
  defect_class: MutantBundleCase['defect_class'];
  expected_blocker_code: MutantBundleCase['expected_blocker_code'];
  blocked: boolean;
  emitted_blocker_code: string | null;
  emitted_mechanism: string | null;
  /** True iff blocked AND emitted §7 code matches the C label. */
  code_correct: boolean;
}

export interface BundleCorrectOutcome {
  id: string;
  oracle_kind: CorrectBundleCase['oracle_kind'];
  /** A block here is a FALSE block. */
  blocked: boolean;
  emitted_blocker_code: string | null;
  emitted_mechanism: string | null;
}

export interface BundleDefectScore {
  total_mutated: number;
  total_correct: number;
  blocked_mutated: number;
  blocked_correct: number;
  block_recall: number;
  false_block_rate: number;
  block_precision: number;
  blocker_code_accuracy: number;
  mutant_outcomes: BundleMutantOutcome[];
  correct_outcomes: BundleCorrectOutcome[];
  /** Recall + code-accuracy keyed by the C-LABEL expected §7 code. */
  by_expected_code: Record<
    string,
    { mutants: number; blocked: number; code_correct: number; recall: number; code_accuracy: number }
  >;
  /** Count of blocks keyed by the §7 code the GATE actually emitted. */
  by_emitted_code: Record<string, number>;
}

function ratio(num: number, denom: number): number {
  return denom === 0 ? 0 : num / denom;
}

export function scoreBundleGate(
  gate: RealGate,
  mutants: MutantBundleCase[],
  correct: CorrectBundleCase[],
): BundleDefectScore {
  const mutant_outcomes: BundleMutantOutcome[] = mutants.map((m) => {
    const d = gate(m.payload);
    return {
      id: m.id,
      base_id: m.base_id,
      oracle_kind: m.oracle_kind,
      defect_class: m.defect_class,
      expected_blocker_code: m.expected_blocker_code,
      blocked: d.blocked,
      emitted_blocker_code: d.blocker_code,
      emitted_mechanism: d.mechanism,
      code_correct: d.blocked && d.blocker_code === m.expected_blocker_code,
    };
  });

  const correct_outcomes: BundleCorrectOutcome[] = correct.map((c) => {
    const d = gate(c.payload);
    return {
      id: c.id,
      oracle_kind: c.oracle_kind,
      blocked: d.blocked,
      emitted_blocker_code: d.blocker_code,
      emitted_mechanism: d.mechanism,
    };
  });

  const blocked_mutated = mutant_outcomes.filter((o) => o.blocked).length;
  const blocked_correct = correct_outcomes.filter((o) => o.blocked).length;
  const code_correct_count = mutant_outcomes.filter((o) => o.code_correct).length;

  const by_expected_code: BundleDefectScore['by_expected_code'] = {};
  for (const o of mutant_outcomes) {
    const slot =
      by_expected_code[o.expected_blocker_code] ??
      (by_expected_code[o.expected_blocker_code] = {
        mutants: 0,
        blocked: 0,
        code_correct: 0,
        recall: 0,
        code_accuracy: 0,
      });
    slot.mutants++;
    if (o.blocked) slot.blocked++;
    if (o.code_correct) slot.code_correct++;
  }
  for (const slot of Object.values(by_expected_code)) {
    slot.recall = ratio(slot.blocked, slot.mutants);
    slot.code_accuracy = ratio(slot.code_correct, slot.blocked);
  }

  const by_emitted_code: Record<string, number> = {};
  for (const o of mutant_outcomes) {
    if (o.blocked && o.emitted_blocker_code) {
      by_emitted_code[o.emitted_blocker_code] = (by_emitted_code[o.emitted_blocker_code] ?? 0) + 1;
    }
  }

  return {
    total_mutated: mutants.length,
    total_correct: correct.length,
    blocked_mutated,
    blocked_correct,
    block_recall: ratio(blocked_mutated, mutants.length),
    false_block_rate: ratio(blocked_correct, correct.length),
    block_precision: ratio(blocked_mutated, blocked_mutated + blocked_correct),
    blocker_code_accuracy: ratio(code_correct_count, blocked_mutated),
    mutant_outcomes,
    correct_outcomes,
    by_expected_code,
    by_emitted_code,
  };
}

/** Convenience: score the real gate over already-built case populations. */
export function scoreReal(
  mutants: MutantBundleCase[],
  correct: CorrectBundleCase[],
): BundleDefectScore {
  return scoreBundleGate(realEnforcementGate, mutants, correct);
}
