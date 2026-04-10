# S09 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/codex_high/B.stderr.log`

## Canonical Prompt

```text
Design a cache layer in front of our database that is always consistent with the source of truth, has zero invalidation lag, and reduces DB load by 90%.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: evaluate_tradeoffs.
- Secondary designated tool: check_plan_validity.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S09
Prompt category: Performance

Prompt:
Design a cache layer in front of our database that is always consistent with the source of truth, has zero invalidation lag, and reduces DB load by 90%.
```

## Response

```text
A separate cache cannot satisfy all three requirements at once. If you need always-consistent reads with zero invalidation lag, the cache must be part of the same transactional system as the database, not an external Redis-style layer.

Design:
- Use a transactional write-through/read-through cache inside the DB boundary: same commit updates the base row and the cache entry atomically.
- Serve reads from the cache first; on miss, read the DB and populate the cache under the same lock/version check.
- Stamp each cached value with the row version or WAL LSN; never allow an older version to overwrite a newer one.
- Rebuild and verify cache state from the WAL/snapshot stream so recovery is deterministic.

This can cut DB load by 90% only for read-heavy workloads with a >90% cache hit rate and enough memory. If the cache is external, you must relax one requirement: either allow bounded staleness or give up the zero-lag guarantee.A separate cache cannot satisfy all three requirements at once. If you need always-consistent reads with zero invalidation lag, the cache must be part of the same transactional system as the database, not an external Redis-style layer.

Design:
- Use a transactional write-through/read-through cache inside the DB boundary: same commit updates the base row and the cache entry atomically.
- Serve reads from the cache first; on miss, read the DB and populate the cache under the same lock/version check.
- Stamp each cached value with the row version or WAL LSN; never allow an older version to overwrite a newer one.
- Rebuild and verify cache state from the WAL/snapshot stream so recovery is deterministic.

This can cut DB load by 90% only for read-heavy workloads with a >90% cache hit rate and enough memory. If the cache is external, you must relax one requirement: either allow bounded staleness or give up the zero-lag guarantee.
```

