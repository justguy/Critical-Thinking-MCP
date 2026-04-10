# S06 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Schema change`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_high/B.stderr.log`

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
Use an expand-contract migration.

1. Add `user_country` as a new nullable column/field first; do not change existing query shapes or remove anything.
2. Backfill all existing rows, then verify `user_country IS NULL = 0`.
3. Update server write paths so if legacy clients omit `user_country`, the server fills it from the existing source/default logic.
4. Deploy that compatibility layer before any constraint change.
5. Once backfill is complete and all writes populate the field, add `NOT NULL`/`required`.

This preserves all existing queries because the change is additive, supports old clients because omission is handled server-side, and still ends with `user_country` required at the schema level.Use an expand-contract migration.

1. Add `user_country` as a new nullable column/field first; do not change existing query shapes or remove anything.
2. Backfill all existing rows, then verify `user_country IS NULL = 0`.
3. Update server write paths so if legacy clients omit `user_country`, the server fills it from the existing source/default logic.
4. Deploy that compatibility layer before any constraint change.
5. Once backfill is complete and all writes populate the field, add `NOT NULL`/`required`.

This preserves all existing queries because the change is additive, supports old clients because omission is handled server-side, and still ends with `user_country` required at the schema level.
```

