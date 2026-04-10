# S04 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Migrations`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/opus_high/A.stderr.log`

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
# Zero-Downtime Postgres Schema Migration (200GB)

**Honest upfront:** Zero downtime + zero data loss + **no application changes** with a *completely new schema* is contradictory. A new schema means different table/column names, which means queries change. You need at least one of these escape valves:

## Realistic approach: Views as a compatibility layer

This is the closest you get to "no application changes":

### 1. Pre-Saturday: Set up the new schema alongside the old one

```sql
-- Create new schema tables in the same database
CREATE SCHEMA new_schema;
-- Build new tables there
CREATE TABLE new_schema.orders (...);
```

### 2. Backfill with logical replication or triggers

```sql
-- On each old table, add a trigger that writes to the new schema in real time
CREATE OR REPLACE FUNCTION sync_to_new_schema() RETURNS trigger AS $$
BEGIN
  INSERT INTO new_schema.orders (id, customer_id, ...)
  VALUES (NEW.old_id, NEW.old_customer_id, ...)
  ON CONFLICT (id) DO UPDATE SET ...;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill historical data in batches (not one giant transaction)
INSERT INTO new_schema.orders SELECT ... FROM public.orders
WHERE id BETWEEN $start AND $end;
```

### 3. Saturday cutover: Swap via views (the "no app changes" trick)

```sql
BEGIN;
  ALTER SCHEMA public RENAME TO old_schema;
  ALTER SCHEMA new_schema RENAME TO public;
  -- Create backward-compatible views in public for any legacy queries
  CREATE VIEW public.old_table_name AS
    SELECT new_col AS old_col, ... FROM public.new_table_name;
COMMIT;
```

The schema rename is near-instant. Views let old queries keep working.

### 4. Post-cutover

- Verify data counts match between old and new
- Monitor error logs aggressively for 24–48h
- Drop `old_schema` once validated

## Key risks to plan for

| Risk | Mitigation |
|---|---|
| Triggers add write latency | Benchmark trigger overhead before Saturday |
| Backfill takes too long | Run batched backfill days ahead, triggers catch new writes |
| Sequences/serials mismatch | `setval()` sequences after backfill to max(id)+1 |
| Foreign key ordering | Backfill parent tables before children |
| Views can't handle INSERT/UPDATE | Use `INSTEAD OF` triggers on views, or accept this as an app change |
| 200GB backfill pressure | Throttle batches, run during low-traffic hours |

## Alternative if schema is radically different

If the new schema is so different that views can't bridge it, you **will** need application changes. In that case, use **pglogical** or **Debezium** to stream CDC events into the new schema, and deploy the app change + schema swap atomically behind a feature flag or load balancer cutover.

**Bottom line:** Saturday is tight for 200GB. Start the backfill and trigger setup now (Monday–Thursday), validate Wednesday/Thursday, and Saturday becomes just the atomic schema rename — which takes milliseconds.
```

