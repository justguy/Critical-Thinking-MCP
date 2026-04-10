# S09 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/sonnet_high/B.stderr.log`

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
---

**The stated requirements are mutually exclusive.** A cache that is *always* consistent, has *zero* invalidation lag, *and* reduces DB load 90% cannot be simultaneously guaranteed — any caching layer introduces at least a two-system write path where partial failures break consistency. Here is the closest practical design and where each guarantee actually holds.

---

## Recommended Design: Write-Through Cache (Redis)

**Precondition that makes 90% reduction possible:** your workload must be read-heavy (≥10:1 read/write ratio). If it isn't, no cache achieves 90% reduction — the primary bottleneck is write throughput, not reads.

### Architecture

```
Client
  │
  ▼
App Layer  ──write──▶  DB (source of truth)
  │                         │
  │        write-through     │
  └──────▶ Redis Cache ◀─────┘ (TTL safety net)
  │
  │──read──▶ Redis Cache ──hit──▶ return
                         └──miss──▶ DB ──▶ backfill cache ──▶ return
```

### Implementation Steps

**1. Profile first**
Measure your read/write ratio and hot key distribution. If reads are not ≥10x writes, stop — the 90% target is not achievable with any cache.

**2. Write path (consistency is enforced here)**
```python
def write(key, value):
    db.write(key, value)          # DB first — on failure, cache is never updated
    cache.set(key, value, ttl=30) # Cache second — TTL bounds any failure window
```
Write DB first. If the cache write fails, the DB is still correct and TTL will expire the stale entry within your chosen bound. Never write cache first.

**3. Read path (load reduction is achieved here)**
```python
def read(key):
    val = cache.get(key)
    if val is None:
        val = db.read(key)
        cache.set(key, val, ttl=30)  # backfill
    return val
```

**4. Concurrent write safety**
Use a Redis Lua script or `MULTI/EXEC` if two writers can race on the same key:
```lua
-- Lua script: only update cache if DB version is newer
if redis.call('GET', version_key) < new_version then
    redis.call('SET', key, value, 'EX', 30)
end
```

**5. TTL as the safety net**
Set a TTL (e.g. 30s) on all cache entries. This bounds the inconsistency window for any write path you miss (migrations, admin scripts, direct DB writes). "Zero lag" becomes "bounded lag ≤ TTL" for unhandled paths.

**6. Monitor**
Track cache hit rate (target ≥90%), miss rate spikes (indicate new write paths bypassing cache), and do periodic consistency sampling (spot-check 0.1% of cache reads against DB).

---

## Where Each Guarantee Actually Holds

| Claim | Reality |
|---|---|
| **Always consistent** | Strong for write-your-own-reads. Other readers see eventual consistency with a bounded window (TTL, typically ≤30s). True "always" requires distributed transactions (2PC), which kills the performance you're caching for. |
| **Zero invalidation lag** | Zero lag *for the writing process* (cache is updated synchronously). Other processes see the update within one round-trip. The window is milliseconds in practice, not zero. |
| **90% DB load reduction** | Achievable only on read-heavy workloads. On a 10:1 read/write ratio, a 95%+ hit rate drops DB reads by ~90%. On a 2:1 ratio, you get ~45% reduction at best. |

---

## What to Reject

- **CDC (Debezium + Kafka):** Adds operational complexity and the lag it claims to solve (binlog consumption has latency; it spikes under write bursts). Use this only if you cannot touch the write path in the app layer.
- **"Always consistent" as a hard guarantee from a cache:** This requires the cache to be the source of truth, which means it's no longer a cache — it's your database.
```

