# S06 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Schema change`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/sonnet_high/B.stderr.log`

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
The requirements are contradictory as stated — a field cannot simultaneously be `NOT NULL` (required) and support clients that don't send it, unless you resolve this with a server-side default. Here is the safe migration path:

**Step 1 — Add the column as nullable with a default**
```sql
ALTER TABLE users
  ADD COLUMN user_country VARCHAR(2) NOT NULL DEFAULT 'XX';
```
Using `NOT NULL DEFAULT` works in Postgres 9.6+, MySQL 5.7+, SQLite 3.x: existing rows get the default immediately (Postgres 11+ rewrites in-place with no table lock), new rows from legacy clients also get the default. No null-safety issue, no downtime.

**Step 2 — Backfill real values where needed**
If rows already have country data in another column, backfill in batches before or after:
```sql
UPDATE users SET user_country = old_country_col
WHERE old_country_col IS NOT NULL AND user_country = 'XX';
```
Run in batches of 10,000 rows to avoid lock contention.

**Step 3 — Enforce a resolved value at the API layer**
In your API handler, treat `user_country` as optional in the request schema but always write a resolved value:
```python
country = request.get("user_country") or geoip_lookup(request.ip) or "XX"
```
Legacy clients (which omit the field) never trigger a DB constraint violation because the column default covers them.

**Step 4 — Existing queries are unaffected**
- `SELECT *` queries gain the column automatically.
- Explicit `SELECT col1, col2` queries see no change.
- `INSERT` statements that omit `user_country` receive the `DEFAULT`.
- Nothing breaks.

**Key invariants to maintain:**
- Keep the `DEFAULT` on the column permanently — dropping it later breaks legacy inserts.
- Do not add a `CHECK (user_country IS NOT NULL)` without the default, since that would break legacy inserts at write time.
- Add `CHECK (user_country IN ('US','GB',...))` or a FK constraint in a separate migration only after validating 100% of existing rows.
```

