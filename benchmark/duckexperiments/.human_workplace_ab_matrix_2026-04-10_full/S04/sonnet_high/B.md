# S04 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Migrations`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Migrate our 200GB Postgres database from one schema to a completely new one this Saturday with zero downtime, zero data loss, and no application changes.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S04
Prompt category: Migrations

Prompt:
Migrate our 200GB Postgres database from one schema to a completely new one this Saturday with zero downtime, zero data loss, and no application changes.
```

## Response

```text
This plan has an internal contradiction that will likely block you before Saturday.

**The core problem: "completely new schema" + "no application changes" are mutually exclusive unless you build a database-level compatibility shim.**

The only way to avoid application changes is to make the new schema invisible to the app — meaning old table names, column names, and types must appear unchanged at the SQL interface. You can achieve this with views + INSTEAD OF triggers in the old schema namespace, but this only works if:
- No column type coercions the app can't absorb transparently
- No row splits or merges (a 1-row → 2-row transformation can't be hidden in a view)
- No stored procedures or functions with hardcoded schema references
- All write paths are expressible as updatable views

If your schema is "completely new," it almost certainly violates at least one of these.

**Realistic zero-downtime approach (assuming the contradiction is resolvable):**

1. **Pre-work (needs days, not hours):**
   - Audit every query path the app uses against the schema diff
   - Build compatibility views + INSTEAD OF triggers
   - Backfill 200GB with batched INSERT...SELECT (at 100–300MB/s throughput plus transformation overhead: plan for 2–8+ hours just for the data move)
   - Run consistency verification (row counts, checksums)
   - Smoke test compatibility layer against real app traffic in staging

2. **Saturday cutover (atomic swap):**
   - Rename old tables to `_backup` suffixes
   - Promote views into the old schema namespace
   - App SQL hits views, views route to new tables — no visible change

3. **Rollback:** rename backup tables back, drop views

**Why Saturday is almost certainly not feasible:**
- Prep work (backfill + testing) realistically takes 3–5 days minimum for a 200GB database with non-trivial schema changes
- The compatibility layer must be fully tested before cutover — discovering an edge case mid-Saturday is a production incident
- "Zero data loss" requires confirming replication has fully caught up before the swap

**Before committing to Saturday, answer these:**
1. How different is the new schema? (Column renames only? Type changes? Table splits?)
2. Does the app use `SELECT *`, stored procedures, or CTEs that reference schema internals?
3. What is the actual tolerable downtime? (Even 30 seconds of lock contention during swap may be acceptable and dramatically simplifies the plan.)

The constraints as stated (zero downtime + zero data loss + no app changes + completely new schema + this Saturday) are not simultaneously achievable for a 200GB database without several days of preparation already completed. The honest probability of all assumptions holding is under 3%.
```

