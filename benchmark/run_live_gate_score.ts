/**
 * LIVE GATE-SCORING RUN (dvp-p1a-run) — the FIRST real precision/recall on the
 * settled enforcement gate (plan §8 output-level mutation, §10 block accounting,
 * §7 taxonomy).
 *
 *   tsx benchmark/run_live_gate_score.ts
 *
 * It:
 *   1. Builds verified-CORRECT bases from the calibration corpus (real recorded
 *      answers; calibration_bases.ts), lifts each into the gate's native input
 *      (bundle_cases.ts), and plants known-wrong bundle mutations.
 *   2. GUARDRAILS (fail loud, never silently inflate metrics):
 *        - every CORRECT bundle case must pass the gate clean (no block); and
 *        - every MUTANT bundle case must be GENUINELY wrong at the bundle level
 *          (its planted defect structurally present) — asserted via a local
 *          oracle on the payload, independent of the gate.
 *   3. Scores realEnforcementGate over both populations and prints the §10 metrics
 *      with the by-§7-code breakdown.
 *   4. Writes a JSON transcript to benchmark/reports/live_gate_score.json.
 *
 * NO model/LLM/CLI calls. The gate is deterministic code; repair_success_rate
 * (needs model calls) is explicitly DEFERRED.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCorrectBases, basesProvenance } from './calibration_bases.js';
import {
  allCorrectBundleCases,
  allMutantBundleCases,
  type CorrectBundleCase,
  type MutantBundleCase,
} from './bundle_cases.js';
import { realEnforcementGate } from './gate_under_test.js';
import { scoreReal, type BundleDefectScore } from './bundle_defect_scorer.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Local, gate-INDEPENDENT check that a mutant payload genuinely carries its planted
 * defect (guardrail 2). This is NOT the gate — it asserts the manufactured wrongness
 * so a gate block is a real catch, not a fixture artifact.
 */
function isGenuinelyWrong(m: MutantBundleCase): { wrong: boolean; reason: string } {
  const p = m.payload;
  if (p.grounding) {
    // The strong claim's quoted_span must NOT be a verbatim substring of its source.
    const claim = p.grounding.claims[0];
    const src = p.grounding.sources.find((s) => s.id === claim.source_id);
    const present = !!src && src.text.toLowerCase().includes((claim.quoted_span ?? '').toLowerCase());
    return { wrong: !present, reason: present ? 'quoted_span IS in source (not wrong)' : 'quoted_span absent from source' };
  }
  if (p.constraintCheck) {
    // At least one constraint must be violated by the mutated answer object.
    const { answer, constraints } = p.constraintCheck;
    const violated = constraints.some((c) => !satisfies(answer[c.field], c.op, c.value));
    return { wrong: violated, reason: violated ? 'a constraint is violated' : 'all constraints satisfied (not wrong)' };
  }
  if (p.bundle) {
    if (p.bundle_gate === 'requirement_coverage') {
      const bound = new Set(p.bundle.final_answer_bindings.map((b) => b.field));
      const missing = p.bundle.requirements.some((r) => !bound.has(r.id));
      return { wrong: missing, reason: missing ? 'a requirement has no binding' : 'all requirements bound (not wrong)' };
    }
    // drift: a rendered number must be absent from its bound artifact text.
    const byId = new Map(p.bundle.artifacts.map((a) => [a.id, a]));
    let drift = false;
    for (const b of p.bundle.final_answer_bindings) {
      const art = b.artifact_id ? byId.get(b.artifact_id) : undefined;
      const aText = art?.text ?? '';
      const rNums = numbers(b.rendered_value ?? '');
      const aNums = new Set(numbers(aText));
      if (rNums.length > 0 && aNums.size > 0 && rNums.some((n) => !aNums.has(n))) drift = true;
    }
    return { wrong: drift, reason: drift ? 'rendered number absent from artifact' : 'no numeric drift (not wrong)' };
  }
  return { wrong: false, reason: 'empty payload' };
}

function satisfies(actual: unknown, op: string, expected: unknown): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (op === '<') return actual < expected;
    if (op === '<=') return actual <= expected;
    if (op === '>') return actual > expected;
    if (op === '>=') return actual >= expected;
  }
  if (op === '==') return actual === expected;
  if (op === '!=') return actual !== expected;
  if (op === 'in' && Array.isArray(expected)) return expected.includes(actual);
  if (op === 'not_in' && Array.isArray(expected)) return !expected.includes(actual);
  return false; // absent field / unhandled op ⇒ not satisfied
}

function numbers(text: string): string[] {
  return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map((t) => String(Number(t)));
}

function fmt(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

function main(): void {
  const basesTagged = buildCorrectBases();
  const provenance = basesProvenance(basesTagged);
  const bases = basesTagged.map(({ synthetic: _s, ...b }) => b);

  const correct: CorrectBundleCase[] = allCorrectBundleCases(bases);
  const mutants: MutantBundleCase[] = allMutantBundleCases(bases);

  // Bases that could not faithfully drive any gate (abstractive source spans with no
  // verbatim quote → a weak/interpretive claim, never blockable). Excluded honestly.
  const drivenBaseIds = new Set([...correct.map((c) => c.base_id), ...mutants.map((m) => m.base_id)]);
  const excludedBases = bases.filter((b) => !drivenBaseIds.has(b.id)).map((b) => ({ id: b.id, oracle_kind: b.oracle.kind }));

  // ── GUARDRAIL 1: every CORRECT bundle case passes the gate clean ──────────────
  const falsePositiveBases: Array<{ id: string; mechanism: string | null; code: string | null }> = [];
  for (const c of correct) {
    const d = realEnforcementGate(c.payload);
    if (d.blocked) falsePositiveBases.push({ id: c.id, mechanism: d.mechanism, code: d.blocker_code });
  }
  if (falsePositiveBases.length > 0) {
    console.error('GUARDRAIL-1 WARNING: correct bases the gate FALSE-BLOCKED (counted as false blocks, reported honestly):');
    for (const f of falsePositiveBases) console.error('   ', f.id, '→', f.code, `(${f.mechanism})`);
  }

  // ── GUARDRAIL 2: every MUTANT is genuinely wrong at the bundle level ──────────
  const notGenuinelyWrong: Array<{ id: string; reason: string }> = [];
  for (const m of mutants) {
    const { wrong, reason } = isGenuinelyWrong(m);
    if (!wrong) notGenuinelyWrong.push({ id: m.id, reason });
  }
  if (notGenuinelyWrong.length > 0) {
    console.error('GUARDRAIL-2 FAILURE: mutants that are NOT genuinely wrong (would inflate recall) — ABORTING:');
    for (const n of notGenuinelyWrong) console.error('   ', n.id, '—', n.reason);
    process.exitCode = 1;
    return;
  }

  // ── score the real gate ───────────────────────────────────────────────────────
  const score = scoreReal(mutants, correct);

  printReport(score, provenance, falsePositiveBases, excludedBases);
  writeTranscript(score, provenance, falsePositiveBases, excludedBases);
}

function printReport(
  score: BundleDefectScore,
  provenance: { total: number; recorded: number; synthetic: number },
  falseBlocks: Array<{ id: string; mechanism: string | null; code: string | null }>,
  excludedBases: Array<{ id: string; oracle_kind: string }>,
): void {
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  LIVE GATE-SCORING RUN — settled enforcement gate (deterministic)');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`  bases: ${provenance.total} (recorded=${provenance.recorded}, synthetic=${provenance.synthetic})`);
  console.log(`  correct cases: ${score.total_correct}   mutants: ${score.total_mutated}`);
  if (excludedBases.length > 0) {
    console.log(`  excluded bases (abstractive source span, not strong-groundable): ${excludedBases.length}`);
    for (const e of excludedBases) console.log(`    - ${e.id} (${e.oracle_kind})`);
  }
  console.log('  ── §10 block accounting ──────────────────────────────────────────');
  console.log(`  block_recall          : ${fmt(score.block_recall)}  (${score.blocked_mutated}/${score.total_mutated})`);
  console.log(`  false_block_rate      : ${fmt(score.false_block_rate)}  (${score.blocked_correct}/${score.total_correct})`);
  console.log(`  block_precision       : ${fmt(score.block_precision)}  (TP=${score.blocked_mutated}, FP=${score.blocked_correct})`);
  console.log(`  blocker_code_accuracy : ${fmt(score.blocker_code_accuracy)}  (emitted §7 code == C label)`);
  console.log('  ── by EXPECTED §7 code (C label) ─────────────────────────────────');
  for (const [code, s] of Object.entries(score.by_expected_code)) {
    console.log(`    ${code.padEnd(28)} recall ${fmt(s.recall)} (${s.blocked}/${s.mutants})  code_acc ${fmt(s.code_accuracy)} (${s.code_correct}/${s.blocked})`);
  }
  console.log('  ── by EMITTED §7 code (what the gate actually said) ──────────────');
  for (const [code, n] of Object.entries(score.by_emitted_code)) {
    console.log(`    ${code.padEnd(28)} ${n}`);
  }
  if (falseBlocks.length > 0) {
    console.log('  ── false blocks on correct bases ─────────────────────────────────');
    for (const f of falseBlocks) console.log(`    ${f.id} → ${f.code} (${f.mechanism})`);
  } else {
    console.log('  false blocks on correct bases: NONE');
  }
  console.log('══════════════════════════════════════════════════════════════════\n');
}

function writeTranscript(
  score: BundleDefectScore,
  provenance: { total: number; recorded: number; synthetic: number },
  falseBlocks: Array<{ id: string; mechanism: string | null; code: string | null }>,
  excludedBases: Array<{ id: string; oracle_kind: string }>,
): void {
  const reportsDir = join(HERE, 'reports');
  mkdirSync(reportsDir, { recursive: true });
  const path = join(reportsDir, 'live_gate_score.json');
  const transcript = {
    kind: 'live_gate_score',
    generated_at: new Date().toISOString(),
    note: 'FIRST real precision/recall on the settled deterministic gate. No model/CLI calls. repair_success_rate deferred (needs model).',
    bases_provenance: provenance,
    excluded_bases: excludedBases,
    metrics: {
      total_mutated: score.total_mutated,
      total_correct: score.total_correct,
      blocked_mutated: score.blocked_mutated,
      blocked_correct: score.blocked_correct,
      block_recall: score.block_recall,
      false_block_rate: score.false_block_rate,
      block_precision: score.block_precision,
      blocker_code_accuracy: score.blocker_code_accuracy,
    },
    by_expected_code: score.by_expected_code,
    by_emitted_code: score.by_emitted_code,
    false_blocks: falseBlocks,
    mutant_outcomes: score.mutant_outcomes,
    correct_outcomes: score.correct_outcomes,
  };
  writeFileSync(path, JSON.stringify(transcript, null, 2));
  console.log(`transcript written: ${path}`);
}

main();
