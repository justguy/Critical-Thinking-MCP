/**
 * Phase 4 — STEP 6, Deliverable 2: the ARM-SPECIFIC repair seed prompts.
 *
 * The repair experiment (Amendment C, §10 PRIMARY endpoint H4) seeds each arm
 * with the SAME defective draft (repair_drafts.ts) and lets it repair. The
 * TASK text + the defective draft are IDENTICAL across arms — the ONLY thing
 * that differs is the FEEDBACK FRAMING, which is the declared mediator
 * `repair_feedback_richness` (§5 retry/repair policy):
 *
 *   B : "verify with the ct-mcp tools and finalize (if it BLOCKs, fix the named
 *       artifact and re-finalize)." Uses BIND_SYS (armConfig B). The gate's
 *       structured BLOCK reason reaches B NATURALLY when the model calls
 *       finalize_deliverable and the server returns it — it is NOT pre-injected.
 *   D : "verify with the ct-mcp tools and produce a corrected answer." Uses
 *       NOBIND_SYS (armConfig D, no finalize advertised). The per-artifact gates
 *       still surface BLOCK reasons through the tool round-trips, naturally.
 *   A : GENERIC — "a draft was produced; it was flagged INCORRECT; produce a
 *       corrected final answer." NO field pointer, NO structured reason. Uses
 *       SHARED_COT_SYS (armConfig A).
 *   C : "apply your checklist, self-review the draft, and produce a corrected
 *       final answer." Uses CHECKLIST_SYS (armConfig C).
 *
 * CRITICAL (the whole point of the ablation): B/D EARN the structured gate
 * feedback by USING THE TOOLS; A/C do not get it. So we MUST NOT pre-inject the
 * gate's BLOCK reason / the named field / the gold value into ANY seed prompt.
 * The seeds only frame HOW to fix the draft, never WHAT the defect is.
 *
 * Pure string assembly. NO model / CLI calls.
 */

import type { Arm } from './arms.js';

/**
 * Build the repair seed for one arm, given the task text and the defective draft.
 * The task + draft are byte-identical across arms; only the trailing framing
 * sentence (the declared mediator) differs.
 */
export function repairSeed(arm: Arm, task: string, draft: string): string {
  const head = `${task}\n\nA draft answer was produced:\n${draft}\n\n`;
  switch (arm) {
    case 'B':
      return (
        head +
        'Verify it using the ct-mcp tools and finalize a CORRECT deliverable: call ' +
        'finalize_deliverable; if it BLOCKs, fix the named artifact and re-finalize until it ' +
        'PASSES.'
      );
    case 'D':
      return head + 'Verify it using the ct-mcp tools and produce a corrected answer.';
    case 'A':
      // GENERIC: no field pointer, no structured reason — just "it was wrong".
      return head + 'It was flagged as INCORRECT. Produce a corrected final answer.';
    case 'C':
      return (
        head +
        'Apply your checklist, self-review it, and produce a corrected final answer.'
      );
    default: {
      const exhaustive: never = arm;
      throw new Error(`repairSeed: unknown arm "${String(exhaustive)}".`);
    }
  }
}
