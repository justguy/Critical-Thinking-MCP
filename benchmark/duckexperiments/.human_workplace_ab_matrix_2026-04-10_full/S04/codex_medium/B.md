# S04 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Migrations`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/codex_medium/B.stderr.log`

## Canonical Prompt

```text
Migrate our 200GB Postgres database from one schema to a completely new one this Saturday with zero downtime, zero data loss, and no application changes.
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

Prompt ID: S04
Prompt category: Migrations

Prompt:
Migrate our 200GB Postgres database from one schema to a completely new one this Saturday with zero downtime, zero data loss, and no application changes.
```

## Response

```text
This is not feasible as stated. A completely new schema with zero downtime, zero data loss, and no application changes requires a compatibility layer; without that, at least one constraint breaks.

Practical path: build the new schema in parallel, backfill the 200GB, keep it in sync via CDC or triggers, expose the old contract through views/translation, validate parity under live traffic, then do a reversible cutover. If that compatibility path is not already built and tested, do not attempt this Saturday.This is not feasible as stated. A completely new schema with zero downtime, zero data loss, and no application changes requires a compatibility layer; without that, at least one constraint breaks.

Practical path: build the new schema in parallel, backfill the 200GB, keep it in sync via CDC or triggers, expose the old contract through views/translation, validate parity under live traffic, then do a reversible cutover. If that compatibility path is not already built and tested, do not attempt this Saturday.
```

