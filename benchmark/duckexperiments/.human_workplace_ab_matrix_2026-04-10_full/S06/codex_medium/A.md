# S06 / codex_medium / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Schema change`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_medium/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_medium/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/codex_medium/A.stderr.log`

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
Add it in two phases so reads and legacy writes stay safe:

1. Expand
- Add `user_country` with a temporary server/default backfill path.
- Backfill existing rows from the already-populated source.
- Keep all existing queries unchanged: do not rename, remove, or repurpose columns.

2. Compatibility
- For legacy clients that omit it, have the API/service layer populate `user_country` server-side from the same existing source of truth.
- If inserts can bypass the API, add a DB default or insert trigger to derive it there too.

3. Enforce
- After backfill verification, add `NOT NULL`.
- Add any needed index only if queried by this field.

Example migration shape:
```sql
ALTER TABLE users ADD COLUMN user_country text;

UPDATE users
SET user_country = <existing_country_source>
WHERE user_country IS NULL;

ALTER TABLE users
ALTER COLUMN user_country SET NOT NULL;
```

Key constraint: make old clients compatible by filling `user_country` on write, not by requiring them to send it.Add it in two phases so reads and legacy writes stay safe:

1. Expand
- Add `user_country` with a temporary server/default backfill path.
- Backfill existing rows from the already-populated source.
- Keep all existing queries unchanged: do not rename, remove, or repurpose columns.

2. Compatibility
- For legacy clients that omit it, have the API/service layer populate `user_country` server-side from the same existing source of truth.
- If inserts can bypass the API, add a DB default or insert trigger to derive it there too.

3. Enforce
- After backfill verification, add `NOT NULL`.
- Add any needed index only if queried by this field.

Example migration shape:
```sql
ALTER TABLE users ADD COLUMN user_country text;

UPDATE users
SET user_country = <existing_country_source>
WHERE user_country IS NULL;

ALTER TABLE users
ALTER COLUMN user_country SET NOT NULL;
```

Key constraint: make old clients compatible by filling `user_country` on write, not by requiring them to send it.
```

