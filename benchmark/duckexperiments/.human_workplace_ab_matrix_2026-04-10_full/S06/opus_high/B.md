# S06 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Schema change`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/opus_high/B.stderr.log`

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
Here is a safe, zero-downtime migration plan in 6 steps:

**Step 1 — Add a nullable column with a DEFAULT**

```sql
ALTER TABLE users ADD COLUMN user_country VARCHAR(2) DEFAULT 'XX';
```

Use a sentinel default (or a real default like `'US'`) so the DDL is instant and non-locking on modern Postgres/MySQL. Existing queries are unaffected — `SELECT *` simply gains a column, and no `WHERE` or `JOIN` references it.

**Step 2 — Backfill from the already-populated source**

```sql
UPDATE users SET user_country = source_table.country
FROM source_table WHERE users.id = source_table.user_id
  AND users.user_country = 'XX';
```

Since you confirmed zero nulls in the source, this should reach 100% coverage. Validate: `SELECT COUNT(*) FROM users WHERE user_country = 'XX'` must return 0.

**Step 3 — Add NOT NULL constraint**

```sql
ALTER TABLE users ALTER COLUMN user_country SET NOT NULL;
```

Safe because every row is already populated. Existing queries remain untouched — they neither read nor filter on this column yet.

**Step 4 — Server-side default for legacy clients**

In your API layer, add middleware or a default resolver:

```python
if 'user_country' not in request.payload:
    request.payload['user_country'] = lookup_country(request.user_id)
```

Legacy clients never need to send the field. The server fills it transparently before validation or persistence.

**Step 5 — Update API schema for new clients**

Mark `user_country` as required in your OpenAPI/GraphQL/protobuf definition for new API versions. Legacy clients continue hitting the old version (or the same version, protected by the Step 4 default).

**Step 6 — Add validation constraint**

```sql
ALTER TABLE users ADD CONSTRAINT chk_country
  CHECK (user_country ~ '^[A-Z]{2}$');
```

Deploy in log-only mode first (application-level), then enforce at the DB level once no violations are observed.

**Why this ordering is safe:**

- Column starts nullable → no writes break.
- Backfill before `NOT NULL` → constraint never fails.
- Server-side default before schema enforcement → legacy clients never rejected.
- No existing query references `user_country`, so no `SELECT`, `WHERE`, or `JOIN` breaks at any step.
```

