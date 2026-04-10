# S09 / codex_high / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/codex_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/codex_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/codex_high/A.stderr.log`

## Canonical Prompt

```text
Design a cache layer in front of our database that is always consistent with the source of truth, has zero invalidation lag, and reduces DB load by 90%.
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

Prompt ID: S09
Prompt category: Performance

Prompt:
Design a cache layer in front of our database that is always consistent with the source of truth, has zero invalidation lag, and reduces DB load by 90%.
```

## Response

```text
You can’t generally guarantee all three at once with a separate cache:

- `always consistent with DB`
- `zero invalidation lag`
- `90% less DB load`

A separate cache is either stale sometimes, or it forces coordination that makes the DB/cache pair effectively one system.

Practical design that gets closest:

1. Make the cache the read source and the DB the durable backing store, but route all writes through a single write path.
2. On write:
   - start one transaction
   - write DB
   - write cache with the new version/value inside the same commit boundary, or publish the commit through a linearizable log consumed synchronously by cache owners
   - acknowledge only after both are durably committed
3. On read:
   - serve only from cache
   - use versioned values / CAS tokens to prevent reordering
   - on cache miss, load from DB once, populate cache, then serve
4. Shard by key and use single-flight request coalescing to avoid stampedes.
5. For strong consistency across nodes, use a linearizable store/log for ownership and ordering.

Reality check: if you truly need zero lag and strict consistency, the “cache” must participate in the write commit, which increases write latency and operational complexity. If you also want 90% DB load reduction, the cleanest answer is usually: use a replicated KV/read model as the system of record for hot reads, with the DB as durability/audit storage, not a loosely coupled cache.You can’t generally guarantee all three at once with a separate cache:

- `always consistent with DB`
- `zero invalidation lag`
- `90% less DB load`

A separate cache is either stale sometimes, or it forces coordination that makes the DB/cache pair effectively one system.

Practical design that gets closest:

1. Make the cache the read source and the DB the durable backing store, but route all writes through a single write path.
2. On write:
   - start one transaction
   - write DB
   - write cache with the new version/value inside the same commit boundary, or publish the commit through a linearizable log consumed synchronously by cache owners
   - acknowledge only after both are durably committed
3. On read:
   - serve only from cache
   - use versioned values / CAS tokens to prevent reordering
   - on cache miss, load from DB once, populate cache, then serve
4. Shard by key and use single-flight request coalescing to avoid stampedes.
5. For strong consistency across nodes, use a linearizable store/log for ownership and ordering.

Reality check: if you truly need zero lag and strict consistency, the “cache” must participate in the write commit, which increases write latency and operational complexity. If you also want 90% DB load reduction, the cleanest answer is usually: use a replicated KV/read model as the system of record for hot reads, with the DB as durability/audit storage, not a loosely coupled cache.
```

