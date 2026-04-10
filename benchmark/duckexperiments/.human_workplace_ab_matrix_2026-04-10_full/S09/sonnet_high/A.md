# S09 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/sonnet_high/A.stderr.log`

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
These three requirements have a fundamental tension that needs to be named upfront: **"always consistent" + "zero invalidation lag" + "90% load reduction" cannot all be simultaneously guaranteed in a distributed system**. Cache hits require data to live somewhere other than the DB; any write path that doesn't update both atomically has a consistency window. Here's how to get as close as possible honestly:

---

## Design: Synchronous Write-Through Cache

### Core invariant
The cache is **never the source of truth** — the DB is. The cache only holds data the DB has already committed.

### Write path (enforces zero lag)
```
write(key, value):
  1. db.begin_transaction()
  2. db.write(key, value)
  3. db.commit()          ← DB is authoritative at this point
  4. cache.delete(key)    ← synchronous, before returning to caller
```

After step 4, the cache either has the new value or is empty. There is no stale entry. The next read triggers a DB fetch and repopulates the cache. This is the **only** pattern that truly eliminates stale reads without distributed transactions.

**Do not** use async invalidation, TTL-based expiry, or fire-and-forget cache writes if you need zero lag. Those create windows.

### Read path
```
read(key):
  val = cache.get(key)
  if val is None:
    val = db.read(key)
    cache.set(key, val)  ← populate on miss, no TTL for immutable data
  return val
```

### Achieving 90% load reduction
This depends entirely on your **read:write ratio and access distribution**. 90% is realistic only if:
- Reads outnumber writes significantly (e.g., 20:1+)
- Access follows a power law (Pareto) — the top 10–20% of keys serve 80–90% of traffic
- You cache those hot keys aggressively with LRU eviction

If your workload is write-heavy or uniformly distributed, 90% is not achievable without accepting eventual consistency.

### Infrastructure
- **Redis Cluster** with `MULTI/EXEC` for atomic cache operations where needed
- **Lua scripts** on Redis for read-modify-write patterns (prevents race conditions on the cache side)
- **Connection pooling** in front of the DB for cache misses
- **CDC (Debezium/logical replication)** as a **reconciliation layer only** — not as the primary invalidation mechanism. It catches any invalidation failures (e.g., app crash between step 3 and 4 above).

### Handling the failure window (step 3→4 crash)
If the process crashes after DB commit but before cache delete:
- The cache holds stale data until the next write or CDC catches it (seconds to minutes lag)
- Mitigate with a short TTL (e.g., 30s) as a backstop — this trades load reduction for bounded staleness
- Or: write a Lua script that does cache invalidation inside the DB write via a trigger/stored proc to a Redis side-channel — reduces but doesn't eliminate the window

---

## What you're actually choosing between

| Approach | Consistency | Lag | Load reduction |
|---|---|---|---|
| Synchronous write-through (above) | Strong (with caveat) | ~0ms | High if read-heavy |
| Async CDC invalidation | Eventual | 50–500ms | High |
| TTL-based cache | Eventual | 0–TTL | High |
| Read replica + no cache | Strong | 0ms | Moderate |

The synchronous write-through design is the closest honest answer to your requirements. "Zero lag" and "always consistent" are only truly guaranteed if you treat the cache delete as part of the write transaction — which means accepting that cache misses temporarily increase DB load after every write.
```

