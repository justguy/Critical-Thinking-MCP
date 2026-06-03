/**
 * Phase 4 — STEP 6 (Amendment C, §10 PRIMARY endpoint H4): tests for the REPAIR
 * harness. NO model / CLI calls — every fixture is constructed inline and graded
 * with the deterministic oracle.
 *
 * Covers Deliverable 4's required cases:
 *   1. defectiveDraft produces an ORACLE-FLAGGED defect for EVERY HARD_CORPUS task.
 *   2. repairSeed includes the draft and is ARM-CORRECT (B/D mention finalize/tools;
 *      A is generic with NO field pointer; C references the checklist; the gate
 *      BLOCK reason / gold is never pre-injected).
 *   3. repairMetrics computes correctly on inline fixtures, including a new-defect case.
 */

import { describe, it, expect } from 'vitest';

import { HARD_CORPUS, type Phase4Task } from '../../benchmark/phase4/corpus.js';
import { defectiveDraft } from '../../benchmark/phase4/repair_drafts.js';
import { repairSeed } from '../../benchmark/phase4/repair_prompts.js';
import { repairMetrics, hasNewDefect, type RepairRow } from '../../benchmark/phase4/repair_metrics.js';
import { gradeArmAnswer } from '../../benchmark/phase4/grade_answer.js';
import type { ArmTranscript } from '../../benchmark/phase4/arm_adapter.js';
import type { Arm } from '../../benchmark/phase4/arms.js';

// ── Inline ArmTranscript carrying a draft, for grading (no model calls) ───────
function draftTranscript(task: Phase4Task, draft: string): ArmTranscript {
  const sentinel =
    task.oracle.kind === 'gold_answer'
      ? draft.match(/FINAL ANSWER:\s*(.+)\s*$/im)?.[1] ?? null
      : null;
  return {
    final_text: draft,
    final_answer_sentinel: sentinel,
    result_subtype: 'success',
    mcp_servers: [],
    advertised_ct_tools: [],
    tool_uses: [],
    tool_results: [],
    finalize_bindings: [],
    usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    num_turns: 1,
    total_cost_usd: null,
    permission_denials: [],
  };
}

// ════════════════════════════════════════════════════════════════════════════
// Deliverable 1 — defectiveDraft is a GENUINE oracle-flagged defect everywhere.
// ════════════════════════════════════════════════════════════════════════════

describe('defectiveDraft — a real planted defect for EVERY HARD_CORPUS task', () => {
  for (const task of HARD_CORPUS) {
    it(`${task.id} (${task.oracle.kind}) drafts an oracle DEFECT`, () => {
      const { draft, planted_defect } = defectiveDraft(task);
      expect(draft.length).toBeGreaterThan(0);
      expect(planted_defect.length).toBeGreaterThan(0);
      const verdict = gradeArmAnswer(task, draftTranscript(task, draft));
      // GENUINE defect: graded incorrect, with at least one high-sev defect.
      expect(verdict.correct).toBe(false);
      expect(verdict.high_sev_defects).toBeGreaterThan(0);
      // NOT a mere non-answer: the draft is a parseable, wrong answer.
      expect(verdict.reasons).not.toContain('no_answer');
    });
  }

  it('numeric draft asserts distractors[0] as the FINAL ANSWER value', () => {
    const t = HARD_CORPUS.find(x => x.oracle.kind === 'gold_answer')!;
    const { draft } = defectiveDraft(t);
    const distractor = (t.oracle as { distractors?: number[] }).distractors![0];
    expect(draft).toMatch(new RegExp(`FINAL ANSWER:\\s*${distractor}\\b`));
  });

  it('source_span draft asserts planted_unsupported[0] and omits the gold span', () => {
    const t = HARD_CORPUS.find(x => x.oracle.kind === 'source_span')!;
    const o = t.oracle as { planted_unsupported: string[]; gold_span: string };
    const { draft } = defectiveDraft(t);
    expect(draft.toLowerCase()).toContain(o.planted_unsupported[0].toLowerCase());
    const verdict = gradeArmAnswer(t, draftTranscript(t, draft));
    expect(verdict.reasons.some(r => r.startsWith('asserted_unsupported'))).toBe(true);
  });

  it('constraint draft violates EXACTLY ONE check (the forbidden enum)', () => {
    const t = HARD_CORPUS.find(x => x.oracle.kind === 'structured_constraint')!;
    const { draft } = defectiveDraft(t);
    const verdict = gradeArmAnswer(t, draftTranscript(t, draft));
    expect(verdict.correct).toBe(false);
    // Exactly one violated check (one high-sev defect), and it is an enum field.
    expect(verdict.high_sev_defects).toBe(1);
    const violated = verdict.reasons.filter(r => r.startsWith('violated:'));
    expect(violated).toHaveLength(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Deliverable 2 — repairSeed is arm-correct; draft included; gate reason NOT injected.
// ════════════════════════════════════════════════════════════════════════════

describe('repairSeed — arm-correct framing, draft embedded, no leaked gate reason', () => {
  const task = HARD_CORPUS.find(x => x.oracle.kind === 'gold_answer')!;
  const { draft } = defectiveDraft(task);
  const arms: Arm[] = ['A', 'B', 'C', 'D'];

  it('every arm embeds the task text and the exact draft', () => {
    for (const arm of arms) {
      const seed = repairSeed(arm, task.prompt, draft);
      expect(seed).toContain(task.prompt);
      expect(seed).toContain(draft);
    }
  });

  it('the task+draft head is byte-identical across arms (only framing differs)', () => {
    const head = `${task.prompt}\n\nA draft answer was produced:\n${draft}\n\n`;
    for (const arm of arms) {
      expect(repairSeed(arm, task.prompt, draft).startsWith(head)).toBe(true);
    }
  });

  it('B mentions finalize and re-finalizing on BLOCK', () => {
    const seed = repairSeed('B', task.prompt, draft);
    expect(seed).toMatch(/finalize_deliverable/);
    expect(seed).toMatch(/re-finalize/i);
    expect(seed).toMatch(/ct-mcp tools/i);
  });

  it('D references the ct-mcp tools but NOT finalize (no binding advertised)', () => {
    const seed = repairSeed('D', task.prompt, draft);
    expect(seed).toMatch(/ct-mcp tools/i);
    expect(seed).not.toMatch(/finalize/i);
  });

  it('A is GENERIC: flagged INCORRECT, no field pointer, no tools, no checklist', () => {
    const seed = repairSeed('A', task.prompt, draft);
    expect(seed).toMatch(/INCORRECT/);
    expect(seed).not.toMatch(/ct-mcp/i);
    expect(seed).not.toMatch(/finalize/i);
    expect(seed).not.toMatch(/checklist/i);
  });

  it('C references the checklist and self-review, not tools', () => {
    const seed = repairSeed('C', task.prompt, draft);
    expect(seed).toMatch(/checklist/i);
    expect(seed).toMatch(/self-review/i);
    expect(seed).not.toMatch(/ct-mcp/i);
    expect(seed).not.toMatch(/finalize/i);
  });

  it('no seed pre-injects the gold value or a named-field/gate BLOCK reason', () => {
    // The numeric gold and the violated-check id must NOT appear in any seed —
    // B/D EARN the structured feedback by using the tools; A/C never get it.
    const gold = String((task.oracle as { gold: number }).gold);
    for (const arm of arms) {
      const seed = repairSeed(arm, task.prompt, draft);
      // gold value not leaked (the draft asserts a DISTRACTOR, not the gold)
      expect(seed).not.toContain(`FINAL ANSWER: ${gold}`);
      // no structured gate vocabulary pre-injected
      expect(seed).not.toMatch(/blocking_issues|BLOCK reason|violated:|missing_gold_span/);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Deliverable 4 — repairMetrics on inline fixtures, incl. a new-defect case.
// ════════════════════════════════════════════════════════════════════════════

function row(p: Partial<RepairRow> & Pick<RepairRow, 'base' | 'arm'>): RepairRow {
  return {
    repair_success: false,
    changed_from_draft: true,
    planted_reasons: ['violated:enum'],
    final_reasons: [],
    multi_field: false,
    ...p,
  };
}

describe('hasNewDefect — a DIFFERENT oracle defect than the planted one', () => {
  it('false when the repair succeeded', () => {
    expect(hasNewDefect(row({ base: 'b1', arm: 'B', repair_success: true }))).toBe(false);
  });
  it('false when the only remaining reason is the planted one', () => {
    expect(
      hasNewDefect(row({ base: 'b1', arm: 'B', planted_reasons: ['violated:enum'], final_reasons: ['violated:enum'] })),
    ).toBe(false);
  });
  it('true when a NEW (different) defect reason appears in the final', () => {
    expect(
      hasNewDefect(
        row({ base: 'b1', arm: 'B', planted_reasons: ['violated:enum'], final_reasons: ['violated:price-bound'] }),
      ),
    ).toBe(true);
  });
});

describe('repairMetrics — per-arm rates, Wilson CI, and base-clustered bootstrap', () => {
  // Two bases, arms B and C. B repairs both; C repairs one and on the other
  // introduces a NEW (different) defect on a multi-field base.
  const rows: RepairRow[] = [
    row({ base: 'b1', arm: 'B', repair_success: true, final_reasons: [], multi_field: true }),
    row({ base: 'b2', arm: 'B', repair_success: true, final_reasons: [], multi_field: true }),
    row({ base: 'b1', arm: 'C', repair_success: true, final_reasons: [], multi_field: true }),
    row({
      base: 'b2',
      arm: 'C',
      repair_success: false,
      planted_reasons: ['violated:enum'],
      final_reasons: ['violated:price-bound'],
      multi_field: true,
    }),
  ];

  const report = repairMetrics(rows);

  it('per-arm repair_success_rate is correct', () => {
    expect(report.per_arm.B.repair_success_rate).toBe(1);
    expect(report.per_arm.C.repair_success_rate).toBe(0.5);
  });

  it('per-arm n and changed_from_draft_rate are correct', () => {
    expect(report.per_arm.B.n).toBe(2);
    expect(report.per_arm.C.changed_from_draft_rate).toBe(1);
  });

  it('new_defects_introduced_rate counts the NEW-defect multi-field case only', () => {
    // B introduced none; C introduced one (on b2), over 2 multi-field rows = 0.5.
    expect(report.per_arm.B.new_defects_introduced_rate).toBe(0);
    expect(report.per_arm.C.new_defects_introduced_rate).toBe(0.5);
    expect(report.per_arm.C.new_defects_n).toBe(2);
  });

  it('Wilson CI brackets the point estimate', () => {
    const [lo, hi] = report.per_arm.C.repair_success_ci;
    expect(lo).toBeLessThanOrEqual(0.5);
    expect(hi).toBeGreaterThanOrEqual(0.5);
  });

  it('headline per-arm repair_success bootstrap is over BASES (deterministic)', () => {
    const bs = report.per_arm.B.repair_success_bootstrap;
    expect(bs.point).toBe(1);
    expect(bs.iters).toBeGreaterThan(0);
    // Determinism: a second compute returns the identical CI (frozen seed).
    const again = repairMetrics(rows).per_arm.B.repair_success_bootstrap;
    expect(again.lower).toBe(bs.lower);
    expect(again.upper).toBe(bs.upper);
  });

  it('B-vs-C and B-vs-A diffs: bootstrap present when both arms exist, null otherwise', () => {
    expect(report.b_vs_c_diff).not.toBeNull();
    expect(report.b_vs_c_diff!.point).toBeCloseTo(0.5, 6); // 1.0 − 0.5
    // No arm-A rows in this fixture → the B-vs-A diff is null.
    expect(report.b_vs_a_diff).toBeNull();
  });
});
