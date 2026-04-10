# S04 / codex_medium / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Migrations`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/codex_medium/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/codex_medium/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/codex_medium/A.stderr.log`

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
You can’t satisfy all four constraints at once: a completely new schema, `zero downtime`, `zero data loss`, and `no application changes` are mutually incompatible unless the new schema is exposed behind a compatibility layer that preserves the old contract.

Practical plan for Saturday:

1. Keep the application-facing schema/API unchanged.
2. Build the new schema in parallel.
3. Set up dual-write or CDC replication from old tables to new tables.
4. Backfill historical data while production stays live.
5. Add compatibility objects in Postgres:
   - `VIEW`s matching old table names
   - `INSTEAD OF` / rewrite triggers where writes must map to new tables
6. Validate row counts, checksums, constraints, and replay lag until fully caught up.
7. Cut over by swapping names/search paths or replacing old tables with compatibility views in a short metadata transaction.
8. Keep rollback ready by preserving old tables and reverse sync until confidence is high.

What to avoid:
- Big-bang `ALTER TABLE`/dump-restore on 200GB
- “Zero downtime” claims without compatibility testing
- Cutting over without continuous validation and rollback

If “completely new schema” also means different application read/write semantics, then `no application changes` is not realistic. The only viable path is compatibility-first migration.You can’t satisfy all four constraints at once: a completely new schema, `zero downtime`, `zero data loss`, and `no application changes` are mutually incompatible unless the new schema is exposed behind a compatibility layer that preserves the old contract.

Practical plan for Saturday:

1. Keep the application-facing schema/API unchanged.
2. Build the new schema in parallel.
3. Set up dual-write or CDC replication from old tables to new tables.
4. Backfill historical data while production stays live.
5. Add compatibility objects in Postgres:
   - `VIEW`s matching old table names
   - `INSTEAD OF` / rewrite triggers where writes must map to new tables
6. Validate row counts, checksums, constraints, and replay lag until fully caught up.
7. Cut over by swapping names/search paths or replacing old tables with compatibility views in a short metadata transaction.
8. Keep rollback ready by preserving old tables and reverse sync until confidence is high.

What to avoid:
- Big-bang `ALTER TABLE`/dump-restore on 200GB
- “Zero downtime” claims without compatibility testing
- Cutting over without continuous validation and rollback

If “completely new schema” also means different application read/write semantics, then `no application changes` is not realistic. The only viable path is compatibility-first migration.
```

