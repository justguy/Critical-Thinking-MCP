# S04 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Migrations`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/opus_high/B.stderr.log`

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
Migrating a 200GB Postgres database to a completely new schema with zero downtime, zero data loss, and no application changes is achievable but requires careful execution using a **view-swapping plus CDC (Change Data Capture)** approach. Here is the plan:

1. **Create new schema alongside old schema.** Deploy views/synonyms so the application's existing queries resolve to the old tables transparently.
2. **Set up CDC** (pglogical, Debezium, or trigger-based) from old-schema tables to new-schema tables with continuous transformation.
3. **Backfill** historical 200GB data from old to new schema while CDC captures ongoing writes.
4. **Validate:** row counts, checksums, referential integrity between old and new.
5. **Swap views** to point at new-schema tables. The application sees no change because it uses the same view/synonym names.
6. **Keep reverse CDC active** for a rollback window. Monitor error rates and latency.
7. After the rollback window passes cleanly, **drop old-schema tables** and replication infrastructure.

**Key caveats and honest constraints:**

- **This only works if your app uses unqualified or view-resolvable names.** If your ORM generates schema-qualified queries or inspects `pg_catalog` metadata, you *will* need app changes — there is no way around it.
- **"Completely new schema" matters.** If the new schema merges tables, changes cardinality, or alters column semantics, the transformation may not be expressible as a simple view, and reverse CDC for rollback may be impossible.
- **200GB is modest for Postgres, but CDC convergence depends on write rate.** Test the backfill plus catch-up phase in staging first. If replication lag does not converge, the cutover is not safe.
- **Zero data loss requires confirmed zero CDC lag at cutover.** Use a brief write-pause or fencing token — even if only for milliseconds — to guarantee this.

**Bottom line:** the approach is sound for straightforward schema evolutions (renames, splits, new columns, re-typing). For deep structural changes, "zero app changes" is likely not realistic — scope the schema diff first and be prepared to adjust.
```

