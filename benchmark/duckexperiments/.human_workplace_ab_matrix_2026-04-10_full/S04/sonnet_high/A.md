# S04 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Migrations`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Migrate our 200GB Postgres database from one schema to a completely new one this Saturday with zero downtime, zero data loss, and no application changes.
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

Prompt ID: S04
Prompt category: Migrations

Prompt:
Migrate our 200GB Postgres database from one schema to a completely new one this Saturday with zero downtime, zero data loss, and no application changes.
```

## Response

```text
This is achievable with a **logical replication + view layer** approach. Here's the playbook:

## Strategy: Dual-write with logical replication

### Phase 1: Prep (before Saturday)

1. **Enable logical replication** on the source DB:
   ```sql
   ALTER SYSTEM SET wal_level = logical;
   -- Restart required; do this days in advance
   ```

2. **Create the new schema** on the target DB (same Postgres instance or a replica).

3. **Set up pglogical or native logical replication** to stream changes from old schema → new schema with a custom transform layer (a replication slot + apply worker or a tool like [pglogical](https://github.com/2ndQuadrant/pglogical) or Debezium).

4. **Write a schema mapping layer** — views or a thin proxy (PgBouncer + stored procs) that make the new schema look identical to the old one. This is what eliminates app changes.

### Phase 2: Migration night (Saturday)

5. **Seed the new schema** from a base dump + replay WAL from the replication slot:
   ```bash
   pg_dump --schema=old_schema | transform_and_load.sh | psql new_db
   ```

6. **Let replication catch up** — monitor lag until it's < 1 second.

7. **Cut over** (seconds of lag, not downtime):
   - Briefly set `old_schema` tables to `READ ONLY` (or revoke writes for 2–5 seconds)
   - Confirm replication slot lag = 0
   - Reroute the connection pool (PgBouncer `PAUSE` → update config → `RESUME`) to point at the new schema
   - Drop the read-only lock

8. **Keep replication running in reverse** (new → old) for 24 hours as a rollback path.

### The "no app changes" contract

Use **search_path manipulation** so the app never knows the schema name changed:
```sql
-- New schema named identically, or:
ALTER ROLE app_user SET search_path = new_schema, public;
-- Or use views in the old schema namespace pointing to new schema tables
CREATE VIEW old_schema.users AS SELECT * FROM new_schema.users;
```

## Key risks to mitigate beforehand

| Risk | Mitigation |
|------|-----------|
| 200GB initial seed takes too long | Run seed Wednesday; replicate delta |
| Schema mismatch breaks replication | Test transform logic on a clone first |
| Sequences out of sync | Advance new sequences past old max values |
| Foreign key constraints differ | Disable FKs during seed, re-enable after |
| Replication slot bloat | Monitor `pg_replication_slots` lag closely |

## Hard prerequisite

This **requires a Postgres restart** to enable `wal_level = logical` if not already set. Check now:
```sql
SHOW wal_level;
```
If it's not `logical`, you need that restart before Saturday — that's your only mandatory downtime window (seconds if using PgBouncer with connection queuing).
```

