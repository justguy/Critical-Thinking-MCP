# S06 / codex_high / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Schema change`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_high/A.stderr.log`

## Canonical Prompt

```text
We need to add a required user_country field that is already populated everywhere with no nulls, supports legacy clients that don't send it, and never breaks any existing query.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Answer the prompt exactly once.
- Do not use CT-MCP tools.
- Do not use any other tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.

Return only the user-facing answer.

Prompt ID: S06
Prompt category: Schema change

Prompt:
We need to add a required user_country field that is already populated everywhere with no nulls, supports legacy clients that don't send it, and never breaks any existing query.
```

## Response

```text
Use an expand-then-enforce migration:

1. Add `user_country` with a safe server-side default for legacy writes.
   - DB: add column with a default value, but do not rename/remove anything existing.
   - API/service: if client omits `user_country`, derive/fill it on the server.

2. Backfill existing rows and verify.
   - Populate all historical rows.
   - Confirm `COUNT(*) WHERE user_country IS NULL = 0`.

3. Make it required at the storage boundary.
   - Add `NOT NULL` only after backfill and fallback logic are live.
   - Keep the server-side fallback so old clients still work.

4. Preserve query compatibility.
   - Do not change existing column names, query shapes, or filters.
   - Only add the new column; existing `SELECT *`, joins, and old predicates continue to work.
   - If any read path expects a value, expose `COALESCE(user_country, <default>)` until the constraint is enforced.

This gives you a required field in practice and in schema, supports legacy clients, and avoids breaking existing queries.Use an expand-then-enforce migration:

1. Add `user_country` with a safe server-side default for legacy writes.
   - DB: add column with a default value, but do not rename/remove anything existing.
   - API/service: if client omits `user_country`, derive/fill it on the server.

2. Backfill existing rows and verify.
   - Populate all historical rows.
   - Confirm `COUNT(*) WHERE user_country IS NULL = 0`.

3. Make it required at the storage boundary.
   - Add `NOT NULL` only after backfill and fallback logic are live.
   - Keep the server-side fallback so old clients still work.

4. Preserve query compatibility.
   - Do not change existing column names, query shapes, or filters.
   - Only add the new column; existing `SELECT *`, joins, and old predicates continue to work.
   - If any read path expects a value, expose `COALESCE(user_country, <default>)` until the constraint is enforced.

This gives you a required field in practice and in schema, supports legacy clients, and avoids breaking existing queries.
```

