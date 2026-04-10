# S05 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Refactoring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S05
Prompt category: Refactoring

Prompt:
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
```

## Response

```text
A guarantee of no regressions requires a test safety net **before** touching the code. Here is a realistic plan:

**Before any refactoring (Sprint 0):**
1. Map all entry points, public interfaces, side effects, and external dependencies
2. Write characterization tests (golden master / approval tests) — record current outputs for real production-traffic paths; you do not need to understand the code, just capture it
3. Set up a parallel-run harness to diff outputs between old and new code at the module boundary

**Refactoring approach:**
- Use the **strangler fig pattern**: extract one subsystem at a time, run characterization tests after each extraction
- Do not do a big-bang rewrite of all 5,000 lines in one sprint

**Honest timeline:**
One sprint is not enough. Realistic split:
- Sprint 0: build safety net + design clean architecture boundaries
- Sprints 1–4: incremental extraction, one seam at a time

**What you cannot have:**
A hard guarantee of zero regressions without a test harness. The characterization tests + parallel diffing bring risk close to zero, but "guarantee" is not achievable without them — and certainly not in a single sprint big-bang rewrite.

**Bottom line:** The guarantee comes from the safety net you build first, not from the act of refactoring. Skip the tests, lose the guarantee.
```

