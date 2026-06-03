/**
 * Phase 4 — Amendment A5 live probe (FEASIBILITY/CALIBRATION, not scored).
 *
 * Question: with the worked-example BIND_SYS, can Haiku reach a finalize RELEASE
 * (finalize_verdict PASS + answer_text_hash) on a CORRECT answer within budget?
 * Tasks are NEW credit-weighted averages (not the worked-example numbers) to test
 * transfer of the taught pattern, not memorization. Caps are GENEROUS so we can
 * MEASURE turns-to-RELEASE (which calibrates the real cap per Amendment A2).
 *
 * Run: node --import tsx benchmark/phase4/a5_probe.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { armConfig } from './arms.js';
import { runArm, billedTokens } from './arm_adapter.js';

const TASKS = [
  {
    id: 'wavg-1',
    gold: '80.63',
    task: 'A student took three courses graded on a CREDIT-WEIGHTED average. Course 1: 4 credits, grade 90. Course 2: 3 credits, grade 75. Course 3: 1 credit, grade 60. Compute the credit-weighted average grade, rounded to two decimals.',
  },
  {
    id: 'wavg-2',
    gold: '87.30',
    task: 'A student took three courses graded on a CREDIT-WEIGHTED average. Course 1: 2 credits, grade 88. Course 2: 5 credits, grade 92. Course 3: 3 credits, grade 79. Compute the credit-weighted average grade, rounded to two decimals.',
  },
];

const CAPS = { maxAssistantTurns: 15, maxOutputTokens: 40_000, wallClockMs: 240_000, maxBudgetUsd: 0.8 };

const reports: any[] = [];
for (const tk of TASKS) {
  process.stderr.write(`\n[a5] running arm B on ${tk.id} (gold ${tk.gold})...\n`);
  const opts = armConfig('B', { task: tk.task, model: 'haiku', caps: CAPS });
  const res = await runArm(opts);
  const t = res.transcript;
  const passBindings = t.finalize_bindings.filter(b => b.verdict === 'PASS' && b.answer_text_hash);
  const released = passBindings.length > 0;
  const finalizeCalls = t.tool_uses.filter(u => u.name.includes('finalize_deliverable')).length;
  const rep = {
    id: tk.id,
    gold: tk.gold,
    RELEASE_reached: released,
    finalize_verdicts: t.finalize_bindings.map(b => b.verdict),
    finalize_calls: finalizeCalls,
    num_turns: t.num_turns,
    truncated_by: res.truncated_by,
    sentinel: t.final_answer_sentinel,
    sentinel_matches_gold: (t.final_answer_sentinel ?? '').replace(/[^0-9.]/g, '') === tk.gold,
    billed_tokens: Math.round(billedTokens(t.usage)),
    raw_usage: t.usage,
    total_cost_usd: t.total_cost_usd,
    permission_denials: t.permission_denials,
    exit_code: res.exit_code,
    error: res.error,
    error_detail: res.error_detail,
  };
  reports.push(rep);
  const rawPath = fileURLToPath(new URL(`./a5_probe_${tk.id}_raw.jsonl`, import.meta.url));
  writeFileSync(rawPath, res.raw);
  process.stderr.write(`[a5] ${tk.id}: RELEASE=${released} turns=${t.num_turns} finalize_calls=${finalizeCalls} sentinel=${t.final_answer_sentinel} truncated_by=${res.truncated_by}\n`);
}

const summary = {
  a5_question: 'Can Haiku reach a finalize RELEASE on a correct answer within budget, given the worked-example BIND_SYS?',
  tasks: reports.length,
  released_count: reports.filter(r => r.RELEASE_reached).length,
  released_AND_correct: reports.filter(r => r.RELEASE_reached && r.sentinel_matches_gold).length,
  reports,
};
const outPath = fileURLToPath(new URL('./a5_probe_summary.json', import.meta.url));
writeFileSync(outPath, JSON.stringify(summary, null, 2));
process.stdout.write('\n' + JSON.stringify(summary, null, 2) + '\n');
