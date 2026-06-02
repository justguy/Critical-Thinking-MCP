/**
 * Injected-defect SCORER (plan §10 "Block accounting").
 *
 * Measures the GATE's precision/recall on KNOWN PLANTED defects, independent of the
 * model's natural error rate (which is empirically ~0, killing methodology B). We
 * feed the gate two populations:
 *
 *   - MUTANTS  : verified known-WRONG answers (from benchmark/mutators.ts). The gate
 *                SHOULD block each one. A block here is a TRUE block.
 *   - CORRECT  : verified known-CORRECT bases. The gate should PASS each one. A
 *                block here is a FALSE block.
 *
 * Because both populations are constructed (not sampled from a model run), the
 * metrics are base-rate-independent: block_recall does not depend on how often the
 * model actually errs.
 *
 * METRICS (§10)
 *   block_recall          = blocked(mutated)   / total mutated
 *   false_block_rate      = blocked(correct)   / total correct
 *   block_precision       = TP / (TP + FP)
 *                           TP = blocked mutants, FP = blocked correct bases
 *   blocker_code_accuracy = (emitted §7 code == expected) / blocked mutants
 *
 * A high false_block_rate poisons precision even at high recall — that tradeoff is
 * exactly what this scorer surfaces.
 *
 * This module performs NO model calls and NO live-gate calls. The gate is injected
 * as a `GateUnderTest`; offline it is the oracle-backed stub, and the real gate is
 * wired in later (see gate_under_test.ts TODO).
 */

import type { Mutant } from './mutators.js';
import type { CorrectBase } from './mutators.js';
import type { GateUnderTest, GateBundle } from './gate_under_test.js';

export interface MutantOutcome {
  mutant_id: string;
  base_id: string;
  oracle_kind: Mutant['oracle_kind'];
  defect_class: Mutant['label']['defect_class'];
  expected_blocker_code: Mutant['label']['expected_blocker_code'];
  blocked: boolean;
  emitted_blocker_code: string | null;
  /** True iff blocked AND emitted code matches the expected §7 code. */
  code_correct: boolean;
}

export interface CorrectOutcome {
  base_id: string;
  oracle_kind: CorrectBase['oracle']['kind'];
  /** A block here is a FALSE block (the base is verified correct). */
  blocked: boolean;
  emitted_blocker_code: string | null;
}

export interface DefectScore {
  /** Population sizes. */
  total_mutated: number;
  total_correct: number;

  /** Block accounting (§10). */
  blocked_mutated: number;
  blocked_correct: number;

  /** blocked(mutated) / total mutated. NaN-safe: 0 when no mutants. */
  block_recall: number;
  /** blocked(correct) / total correct. 0 when no correct bases. */
  false_block_rate: number;
  /** TP / (TP + FP); 0 when nothing was blocked. */
  block_precision: number;

  /** (emitted code == expected) / blocked mutants; 0 when nothing blocked. */
  blocker_code_accuracy: number;

  /** Per-mutant and per-correct outcomes for transcripts/debugging. */
  mutant_outcomes: MutantOutcome[];
  correct_outcomes: CorrectOutcome[];

  /** Recall and code-accuracy broken down by §7 expected code. */
  by_blocker_code: Record<
    string,
    { mutants: number; blocked: number; code_correct: number; recall: number; code_accuracy: number }
  >;
}

function bundleOfMutant(m: Mutant): GateBundle {
  return { id: m.id, answer: m.mutated_answer, oracle: m.oracle };
}

function bundleOfBase(b: CorrectBase): GateBundle {
  return { id: b.id, answer: b.answer, oracle: b.oracle };
}

function ratio(num: number, denom: number): number {
  return denom === 0 ? 0 : num / denom;
}

/**
 * Score a gate against planted mutants and verified-correct bases.
 *
 * @param gate     the gate under test (offline: oracleStubGate; later: the real gate)
 * @param mutants  known-WRONG variants the gate SHOULD block
 * @param correct  verified-CORRECT bases the gate should PASS
 */
export function scoreGate(
  gate: GateUnderTest,
  mutants: Mutant[],
  correct: CorrectBase[],
): DefectScore {
  const mutant_outcomes: MutantOutcome[] = mutants.map((m) => {
    const decision = gate(bundleOfMutant(m));
    const code_correct =
      decision.blocked && decision.blocker_code === m.label.expected_blocker_code;
    return {
      mutant_id: m.id,
      base_id: m.base_id,
      oracle_kind: m.oracle_kind,
      defect_class: m.label.defect_class,
      expected_blocker_code: m.label.expected_blocker_code,
      blocked: decision.blocked,
      emitted_blocker_code: decision.blocker_code,
      code_correct,
    };
  });

  const correct_outcomes: CorrectOutcome[] = correct.map((b) => {
    const decision = gate(bundleOfBase(b));
    return {
      base_id: b.id,
      oracle_kind: b.oracle.kind,
      blocked: decision.blocked,
      emitted_blocker_code: decision.blocker_code,
    };
  });

  const blocked_mutated = mutant_outcomes.filter((o) => o.blocked).length;
  const blocked_correct = correct_outcomes.filter((o) => o.blocked).length;
  const code_correct_count = mutant_outcomes.filter((o) => o.code_correct).length;

  // TP = blocked mutants (true blocks); FP = blocked correct bases (false blocks).
  const tp = blocked_mutated;
  const fp = blocked_correct;

  const by_blocker_code: DefectScore['by_blocker_code'] = {};
  for (const o of mutant_outcomes) {
    const key = o.expected_blocker_code;
    const slot =
      by_blocker_code[key] ??
      (by_blocker_code[key] = { mutants: 0, blocked: 0, code_correct: 0, recall: 0, code_accuracy: 0 });
    slot.mutants++;
    if (o.blocked) slot.blocked++;
    if (o.code_correct) slot.code_correct++;
  }
  for (const slot of Object.values(by_blocker_code)) {
    slot.recall = ratio(slot.blocked, slot.mutants);
    slot.code_accuracy = ratio(slot.code_correct, slot.blocked);
  }

  return {
    total_mutated: mutants.length,
    total_correct: correct.length,
    blocked_mutated,
    blocked_correct,
    block_recall: ratio(blocked_mutated, mutants.length),
    false_block_rate: ratio(blocked_correct, correct.length),
    block_precision: ratio(tp, tp + fp),
    blocker_code_accuracy: ratio(code_correct_count, blocked_mutated),
    mutant_outcomes,
    correct_outcomes,
    by_blocker_code,
  };
}
