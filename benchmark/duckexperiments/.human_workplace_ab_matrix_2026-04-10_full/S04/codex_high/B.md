# S04 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Migrations`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/codex_high/B.stderr.log`

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
As stated, do not do this Saturday cutover. A 200GB Postgres move to a completely new schema with zero downtime, zero data loss, and no application changes is not a credible one-shot migration; 'no application changes' only works if you add a compatibility layer that preserves the old contract.

Recommended path:
- This Saturday: create the new schema in parallel, start CDC/logical replication plus backfill, and validate row counts, checksums, and business invariants.
- Before cutover: run dual-read/dual-write or an equivalent compatibility layer for several days and prove rollback works.
- Cut over only after clean validation; otherwise abort and keep the old path live.

If leadership requires all four constraints, the honest answer is: not safely achievable this Saturday without either relaxing 'no application changes' or redefining 'completely new schema' to remain backward-compatible.As stated, do not do this Saturday cutover. A 200GB Postgres move to a completely new schema with zero downtime, zero data loss, and no application changes is not a credible one-shot migration; 'no application changes' only works if you add a compatibility layer that preserves the old contract.

Recommended path:
- This Saturday: create the new schema in parallel, start CDC/logical replication plus backfill, and validate row counts, checksums, and business invariants.
- Before cutover: run dual-read/dual-write or an equivalent compatibility layer for several days and prove rollback works.
- Cut over only after clean validation; otherwise abort and keep the old path live.

If leadership requires all four constraints, the honest answer is: not safely achievable this Saturday without either relaxing 'no application changes' or redefining 'completely new schema' to remain backward-compatible.
```

