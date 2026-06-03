/**
 * Phase 4 — STEP 6, Deliverable 3: the PILOT REPAIR runner (the now-headline §10
 * PRIMARY endpoint H4, Amendment C). LIVE-PILOT SCRIPT — runnable with:
 *
 *   node --import tsx benchmark/phase4/repair_run.ts --bases 3 --arms A,B,C,D --model haiku
 *
 * DO NOT execute it in the build chunk; a SEPARATE step runs the live pilot.
 *
 * For a configurable subset of bases × the 4 arms it seeds the repair (the SAME
 * defective draft per base; arm-specific feedback framing) and records the
 * outcome. The repair regimes (§5 retry/repair policy):
 *   • B/D — the in-session multi-turn gate loop does the repair within ONE runArm
 *     call: the model finalizes, sees the server's BLOCK, fixes the named
 *     artifact, and re-finalizes up to the turn cap. The structured BLOCK reason
 *     reaches B/D NATURALLY through the tool round-trips — it is NEVER pre-injected
 *     into the seed (repair_prompts.ts).
 *   • A/C — up to 2 prompt-driven re-prompt ROUNDS (3 attempts total), threading
 *     the prior answer. A's re-prompt stays GENERIC ("still incorrect"); C's asks
 *     it to self-review again. Neither ever receives the gate reason or the gold.
 *
 * Per (base, arm) it records the RepairRow grading signals (repair_metrics.ts)
 * plus pilot diagnostics (attempts/turns, finalize RELEASE for B, the final
 * answer). Rows are saved to repair_run.json.
 *
 * Caps are GENEROUS (this is the live pilot): maxAssistantTurns ~12, wallClockMs
 * 240000. Args: --bases N (default 2) --arms A,B,C,D --model haiku --concurrency N.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HARD_CORPUS, type Phase4Task } from './corpus.js';
import { armConfig, type Arm } from './arms.js';
import { runArm, type ArmTranscript, type RunArmResult } from './arm_adapter.js';
import { gradeArmAnswer } from './grade_answer.js';
import { defectiveDraft } from './repair_drafts.js';
import { repairSeed } from './repair_prompts.js';
import type { RepairRow } from './repair_metrics.js';

// ── Generous live-pilot caps (§4: this is the feasibility pilot) ─────────────
const CAPS = {
  maxAssistantTurns: 12,
  maxOutputTokens: 40_000,
  wallClockMs: 240_000,
  maxBudgetUsd: 1.0,
};

const ALL_ARMS: Arm[] = ['A', 'B', 'C', 'D'];

// ── A base task is multi-field when ≥2 oracle checks can each carry a defect ──
function isMultiField(task: Phase4Task): boolean {
  if (task.oracle.kind === 'structured_constraint') return task.oracle.checks.length > 1;
  // numeric/source bases carry a single graded value → not multi-field for the
  // new-defect denominator (§6 restricts new_defects to multi-field bases).
  return false;
}

/**
 * A deterministic signature of the graded answer, so `changed_from_draft` can be
 * computed WITHOUT a model call: numeric → the FINAL ANSWER sentinel / last
 * number; constraint → the extracted JSON object string; source_span → the final
 * prose. Compared against the same signature of the seeded draft.
 */
function answerText(task: Phase4Task, transcript: ArmTranscript): string {
  if (task.oracle.kind === 'gold_answer') {
    const s = transcript.final_answer_sentinel;
    return (s != null && s.trim() !== '' ? s : transcript.final_text).trim();
  }
  return transcript.final_text.trim();
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Grade a transcript and return the RepairRow grading signals for one attempt. */
function grade(task: Phase4Task, transcript: ArmTranscript, draft: string) {
  const verdict = gradeArmAnswer(task, transcript);
  const finalAns = answerText(task, transcript);
  return {
    repair_success: verdict.correct,
    final_reasons: verdict.reasons,
    changed_from_draft: norm(finalAns) !== norm(draft) && finalAns !== '',
    final_text: transcript.final_text,
  };
}

/** B has reached a finalize RELEASE iff some finalize binding PASSED with a hash. */
function releaseReached(transcript: ArmTranscript): boolean {
  return transcript.finalize_bindings.some(b => b.verdict === 'PASS' && b.answer_text_hash != null);
}

interface PilotRow extends RepairRow {
  model: string;
  attempts: number;
  num_turns: number | null;
  truncated_by: RunArmResult['truncated_by'];
  release_reached: boolean;
  finalize_calls: number;
  planted_defect: string;
  final_text: string;
  error: boolean;
  error_detail?: string;
}

/**
 * Run ONE (base, arm) repair. B/D do the whole repair in ONE in-session runArm
 * call (the gate loop is internal). A/C do up to 2 re-prompt rounds, threading
 * the prior answer, stopping early on success.
 */
async function runOne(task: Phase4Task, arm: Arm, model: string): Promise<PilotRow> {
  const { draft, planted_defect } = defectiveDraft(task);
  const plantedVerdict = gradeArmAnswer(task, fakeDraftTranscript(task, draft));
  const planted_reasons = plantedVerdict.reasons;
  const multi_field = isMultiField(task);

  const baseRow = {
    base: task.id,
    arm,
    model,
    planted_reasons,
    planted_defect,
    multi_field,
  };

  if (arm === 'B' || arm === 'D') {
    // In-session gate loop: one runArm call repairs within the turn cap.
    const seed = repairSeed(arm, task.prompt, draft);
    const res = await runArm(armConfig(arm, { task: seed, model, caps: CAPS }));
    if (res.error) {
      return {
        ...baseRow,
        repair_success: false,
        changed_from_draft: false,
        final_reasons: ['adapter_error'],
        attempts: 1,
        num_turns: res.transcript.num_turns,
        truncated_by: res.truncated_by,
        release_reached: false,
        finalize_calls: 0,
        final_text: res.transcript.final_text,
        error: true,
        error_detail: res.error_detail,
      };
    }
    const g = grade(task, res.transcript, draft);
    return {
      ...baseRow,
      repair_success: g.repair_success,
      changed_from_draft: g.changed_from_draft,
      final_reasons: g.final_reasons,
      attempts: res.transcript.num_turns ?? 1,
      num_turns: res.transcript.num_turns,
      truncated_by: res.truncated_by,
      release_reached: arm === 'B' && releaseReached(res.transcript),
      finalize_calls: res.transcript.tool_uses.filter(u => u.name.includes('finalize_deliverable')).length,
      final_text: g.final_text,
      error: false,
    };
  }

  // A/C: up to 2 re-prompt rounds (3 attempts), threading the prior answer.
  let priorAnswer = '';
  let last: { g: ReturnType<typeof grade>; res: RunArmResult } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const seed =
      attempt === 0
        ? repairSeed(arm, task.prompt, draft)
        : reprompt(arm, task.prompt, draft, priorAnswer);
    const res = await runArm(armConfig(arm, { task: seed, model, caps: CAPS }));
    if (res.error) {
      return {
        ...baseRow,
        repair_success: false,
        changed_from_draft: false,
        final_reasons: ['adapter_error'],
        attempts: attempt + 1,
        num_turns: res.transcript.num_turns,
        truncated_by: res.truncated_by,
        release_reached: false,
        finalize_calls: 0,
        final_text: res.transcript.final_text,
        error: true,
        error_detail: res.error_detail,
      };
    }
    const g = grade(task, res.transcript, draft);
    last = { g, res };
    priorAnswer = g.final_text;
    if (g.repair_success) {
      return {
        ...baseRow,
        repair_success: true,
        changed_from_draft: g.changed_from_draft,
        final_reasons: g.final_reasons,
        attempts: attempt + 1,
        num_turns: res.transcript.num_turns,
        truncated_by: res.truncated_by,
        release_reached: false,
        finalize_calls: 0,
        final_text: g.final_text,
        error: false,
      };
    }
  }
  const { g, res } = last!;
  return {
    ...baseRow,
    repair_success: g.repair_success,
    changed_from_draft: g.changed_from_draft,
    final_reasons: g.final_reasons,
    attempts: 3,
    num_turns: res.transcript.num_turns,
    truncated_by: res.truncated_by,
    release_reached: false,
    finalize_calls: 0,
    final_text: g.final_text,
    error: false,
  };
}

/**
 * The A/C re-prompt for a follow-up round. Threads the model's PRIOR answer but
 * keeps the feedback framing arm-correct and GENERIC — A/C never receive the gate
 * reason or the gold value (the parity that makes B/D's structured feedback the
 * manipulation under test).
 */
function reprompt(arm: Arm, task: string, draft: string, prior: string): string {
  const head =
    `${task}\n\nA draft answer was produced:\n${draft}\n\n` +
    `Your previous corrected answer was:\n${prior}\n\nThat answer is still INCORRECT. `;
  return arm === 'C'
    ? head + 'Apply your checklist, self-review it again, and produce a corrected final answer.'
    : head + 'Produce a corrected final answer.';
}

/** Build a transcript carrying ONLY the seeded draft, to grade the planted defect. */
function fakeDraftTranscript(task: Phase4Task, draft: string): ArmTranscript {
  const sentinel =
    task.oracle.kind === 'gold_answer' ? (draft.match(/FINAL ANSWER:\s*(.+)\s*$/im)?.[1] ?? null) : null;
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

// ── arg parsing ──────────────────────────────────────────────────────────────
interface Args {
  bases: number;
  arms: Arm[];
  model: string;
  concurrency: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const armsArg = get('--arms');
  const arms = armsArg
    ? (armsArg.split(',').map(a => a.trim().toUpperCase()).filter(a => ALL_ARMS.includes(a as Arm)) as Arm[])
    : ALL_ARMS;
  return {
    bases: Number(get('--bases') ?? 2),
    arms: arms.length > 0 ? arms : ALL_ARMS,
    model: get('--model') ?? 'haiku',
    concurrency: Number(get('--concurrency') ?? 1),
  };
}

/** Run tasks with a bounded concurrency pool, preserving completion order. */
async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<PilotRow>): Promise<PilotRow[]> {
  const out: PilotRow[] = [];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const idx = next++;
      out.push(await fn(items[idx]));
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  // Select N bases SPANNING the three oracle kinds (round-robin) so the pilot
  // covers numeric/RAG/constraint, not just the numeric-first corpus head.
  const byKind: Record<string, Phase4Task[]> = { gold_answer: [], source_span: [], structured_constraint: [] };
  for (const t of HARD_CORPUS) byKind[t.oracle.kind]?.push(t);
  const order = ['gold_answer', 'source_span', 'structured_constraint'];
  const bases: Phase4Task[] = [];
  for (let i = 0; bases.length < args.bases && i < HARD_CORPUS.length; i++) {
    const pool = byKind[order[i % order.length]];
    const pick = pool[Math.floor(i / order.length)];
    if (pick) bases.push(pick);
  }
  const jobs: Array<{ task: Phase4Task; arm: Arm }> = [];
  for (const task of bases) {
    for (const arm of args.arms) jobs.push({ task, arm });
  }
  process.stderr.write(
    `[repair_run] ${bases.length} bases × ${args.arms.join('/')} = ${jobs.length} cells; model=${args.model} concurrency=${args.concurrency}\n`,
  );

  const rows = await runPool(jobs, args.concurrency, async ({ task, arm }) => {
    process.stderr.write(`[repair_run] ${task.id} arm ${arm} ...\n`);
    const row = await runOne(task, arm, args.model);
    process.stderr.write(
      `[repair_run] ${task.id} ${arm}: success=${row.repair_success} changed=${row.changed_from_draft} release=${row.release_reached} attempts=${row.attempts}\n`,
    );
    return row;
  });

  const outPath = fileURLToPath(new URL('./repair_run.json', import.meta.url));
  const summary = {
    config: args,
    caps: CAPS,
    generated_at: new Date().toISOString(),
    rows,
  };
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  process.stdout.write(`\n[repair_run] wrote ${rows.length} rows → ${outPath}\n`);
}

// Only run the live pilot on DIRECT execution — guard against an import spawning
// claude CLI calls (flagged by the repair-harness verify pass).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => {
    process.stderr.write(`[repair_run] FATAL: ${e instanceof Error ? e.stack : String(e)}\n`);
    process.exit(1);
  });
}
