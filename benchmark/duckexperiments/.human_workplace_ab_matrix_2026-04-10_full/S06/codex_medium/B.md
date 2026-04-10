# S06 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Schema change`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_medium/B.stderr.log`

## Canonical Prompt

```text
We need to add a required user_country field that is already populated everywhere with no nulls, supports legacy clients that don't send it, and never breaks any existing query.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: score_response_quality.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S06
Prompt category: Schema change

Prompt:
We need to add a required user_country field that is already populated everywhere with no nulls, supports legacy clients that don't send it, and never breaks any existing query.
```

## Response

```text
Use a two-phase additive migration: add `user_country` first as nullable with a DB default or server-side fallback so legacy clients that omit it still write successfully, then backfill and verify there are no nulls, update write paths to always populate it, and only after that enforce `NOT NULL`. Keep all query behavior unchanged by making the field additive only: do not change existing select lists, filters, joins, or required inputs, and expose `user_country` as optional-to-read but required-at-rest.Use a two-phase additive migration: add `user_country` first as nullable with a DB default or server-side fallback so legacy clients that omit it still write successfully, then backfill and verify there are no nulls, update write paths to always populate it, and only after that enforce `NOT NULL`. Keep all query behavior unchanged by making the field additive only: do not change existing select lists, filters, joins, or required inputs, and expose `user_country` as optional-to-read but required-at-rest.
```

