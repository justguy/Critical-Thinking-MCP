# S06 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Schema change`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/opus_high/A.stderr.log`

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
## Adding a Required `user_country` Field Safely

These requirements are in tension — here's how to resolve them:

### Database Layer

```sql
-- Safe: column is NOT NULL with a default so existing rows and INSERT-without-column both work
ALTER TABLE users ADD COLUMN user_country VARCHAR(2) NOT NULL DEFAULT 'US';

-- If data is already populated, backfill first in a separate migration:
-- 1. ADD COLUMN user_country VARCHAR(2) NULL;
-- 2. UPDATE users SET user_country = <source> WHERE user_country IS NULL;
-- 3. ALTER COLUMN user_country SET NOT NULL;
```

The `DEFAULT` clause is what protects legacy clients — any INSERT that omits the column gets the default value instead of failing.

### Application / API Layer

```python
# In your schema/model, make it required but with a default
class User(BaseModel):
    user_country: str = "US"  # Required in schema, defaulted for legacy clients
```

**For REST/GraphQL APIs:** Make the field optional in the *input* schema but required in the *output* schema:

```python
# Write DTO — legacy clients can omit it
class CreateUserRequest(BaseModel):
    name: str
    user_country: str = "US"  # defaults if absent

# Read DTO — always present in responses
class UserResponse(BaseModel):
    name: str
    user_country: str  # no default, always returned
```

### Why This Doesn't Break Queries

| Concern | Mitigation |
|---|---|
| `SELECT *` queries | New column appears but doesn't break result parsing |
| `INSERT` without the column | `DEFAULT` fills it in |
| Legacy clients reading responses | Extra field is ignored by well-behaved clients |
| Legacy clients writing | Default applies; no validation failure |
| `NOT NULL` constraint | Default + backfill means no nulls ever exist |

### Deployment Order

1. **Migrate**: Add column as `NULL`, no default
2. **Backfill**: Populate from existing data source
3. **Constrain**: Set `NOT NULL` + `DEFAULT` for future inserts
4. **Deploy app code**: Start reading/writing the field explicitly
5. **Later**: Remove the default once all clients send the field (optional)

Steps 1-3 can collapse into a single `ADD COLUMN ... NOT NULL DEFAULT 'US'` if the table is small enough that the lock is acceptable and the default value is correct for all existing rows. For large tables, do it in phases to avoid long locks.
```

