# Value Pilot — Pre-registration (decided BEFORE any run)

**Question:** does host-enforced ct-mcp (the `plan_checks → finalize_deliverable` spine) reduce
deliverable defects vs an unguarded baseline, at acceptable false-block / friction cost?

**Real, not mocked.** Tagent = Claude subagents (model **sonnet**, held constant across both arms).
Gate = the **actual branch MCP server** (`node dist/server.js`) driven over JSON-RPC by `gate.mjs`.
Grading = **objective** pre-specified checks in `tasks.json` (`grader.mjs`); no LLM judge as oracle.
n = 6 → directional, not definitive.

## Arms
- **A — baseline:** subagent gets the task (+ sources), returns an answer. Graded. No gate.
- **C — host-enforced:** subagent returns answer + structured artifacts (claims w/ quoted spans for
  factual; inputs + conclusion_numbers for numeric). Host (me) builds the contract, calls the real
  `finalize_deliverable`. On BLOCK, the `corrective_prompt` goes back for ONE revision. Final graded.

## Pre-registered metrics
1. **defect rate** per deliverable (objective checks) — primary.
2. **false-block rate** on clean-control tasks (C blocks a task with no defect) — primary cost.
3. **friction:** revisions needed; artifact-formatting blocks (vs deliverable-defect blocks).

## Tautology guard (decided up front)
A C-arm defect drop counts as value ONLY IF clean tasks aren't false-blocked and friction is bounded.
The win must not be purely "the gate blocked the exact token it checks."

## Honest predictions (so results can't be retrofitted)
- **N1/N2 (fabrication/arithmetic traps):** if baseline miscomputes, `trace_conclusion_numbers` should
  catch it in C → expected value.
- **N4 (weighted-vs-unweighted, GATE-LIMIT PROBE):** a naive answer (60) self-traces consistently
  (60 = mean of 90,60,30), so the gate will **NOT** catch a wrong *method*. **Expected: no gate value
  here.** Included precisely so the pilot can show a null result.
- **F1 (ungrounded-reset trap):** C should force the agent to drop the unsupported reset claim (no
  quotable span) → expected value, BUT graded by a proxy regex (flagged as proxy).
- **N3 / F2 (clean controls):** C should PASS without false-block. If it blocks → counts against value.
