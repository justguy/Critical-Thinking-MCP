# S09 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Performance`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/codex_medium/B.stderr.log`

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
You cannot generally get all three at once with an external cache: always consistent, zero invalidation lag, and 90% DB load reduction. The workable design is to make the “cache” a DB-owned read model updated in the same transaction as the write path, then serve hot reads from that projection. That gives consistency and zero lag because there is no separate invalidation step.

Practical design:
- Single write path: every write commits to the source-of-truth tables and the read model atomically.
- Read model/materialized view: denormalized, query-shaped data for hot reads.
- Read router: send only hot, stable read patterns to the read model; everything else goes to the primary DB.
- No independent external cache for correctness-critical reads.

If you truly require 90% DB offload, the requirement to relax is usually “source of truth is only the primary tables,” because the read model becomes part of the database system rather than a separate cache.You cannot generally get all three at once with an external cache: always consistent, zero invalidation lag, and 90% DB load reduction. The workable design is to make the “cache” a DB-owned read model updated in the same transaction as the write path, then serve hot reads from that projection. That gives consistency and zero lag because there is no separate invalidation step.

Practical design:
- Single write path: every write commits to the source-of-truth tables and the read model atomically.
- Read model/materialized view: denormalized, query-shaped data for hot reads.
- Read router: send only hot, stable read patterns to the read model; everything else goes to the primary DB.
- No independent external cache for correctness-critical reads.

If you truly require 90% DB offload, the requirement to relax is usually “source of truth is only the primary tables,” because the read model becomes part of the database system rather than a separate cache.
```

