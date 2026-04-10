# S06 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Schema change`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/sonnet_high/A.stderr.log`

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
These three requirements conflict. "Required" + "legacy clients don't send it" is a contradiction — you need a default.

**The correct approach:**

```sql
-- Step 1: Add nullable first (zero-downtime, existing queries unaffected)
ALTER TABLE users ADD COLUMN user_country TEXT;

-- Step 2: Backfill (if not already done)
UPDATE users SET user_country = <source> WHERE user_country IS NULL;

-- Step 3: Add NOT NULL + DEFAULT together
ALTER TABLE users ALTER COLUMN user_country SET DEFAULT 'unknown';
ALTER TABLE users ALTER COLUMN user_country SET NOT NULL;
```

**Why each constraint is satisfied:**

| Requirement | How it's met |
|---|---|
| No nulls | Backfill before adding NOT NULL |
| Legacy clients don't send it | `DEFAULT 'unknown'` fills it server-side |
| Existing queries unaffected | Adding a column is additive; named-column SELECTs are unchanged |

**The real tension to resolve:** "Required" means different things at different layers:
- **DB layer:** NOT NULL + DEFAULT — column always has a value, legacy clients safe
- **API layer:** New clients *should* provide it; enforce in request validation, not DB schema

If legacy clients must never break, you cannot enforce "required with no default" at the DB level. The default is mandatory. Name it something meaningful (`'unknown'`, `'legacy'`, `'US'`) based on your domain semantics.
```

