# S10 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Concurrency`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `evaluate_tradeoffs`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Build me a global view-counter for our website that is lock-free, never undercounts, never overcounts, and serves millions of writes per second.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: detect_concurrency_patterns.
- Secondary designated tool: evaluate_tradeoffs.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S10
Prompt category: Concurrency

Prompt:
Build me a global view-counter for our website that is lock-free, never undercounts, never overcounts, and serves millions of writes per second.
```

## Response

```text
---

## Global View Counter: Sharded Atomic Counters

The only design that is genuinely lock-free, exact (no over/undercount), and scales to millions of writes/sec is **sharded atomic counters with periodic aggregation**. A single global counter (Redis INCR) fails at this scale — it becomes a serialization bottleneck and single point of failure.

### Architecture

```
Clients → [N write shards] → [Aggregator] → [Read cache]
```

- **N shards** (e.g., 64–512): each shard owns its counter exclusively — no cross-shard writes.
- Each shard uses a hardware atomic (`fetch_and_add` / `INCR`) — truly lock-free.
- An aggregator periodically sums all shards and writes the total to a read cache.
- Reads are served from the cache; writes go to any shard (routed by e.g. request hash or round-robin).

### Why this is exact (no over/undercount)

- `fetch_and_add` is linearizable — every increment is counted exactly once.
- No read-modify-write gap: you never read the counter before writing; you just atomically add 1.
- At-least-once delivery with automatic retries **would** cause overcounting unless you add an idempotency key per request (deduplicated in the shard before applying the increment).

### Shard implementation (Redis example)

```python
import hashlib, redis

SHARDS = [redis.Redis(host=f"shard-{i}") for i in range(64)]
AGGREGATOR = redis.Redis(host="aggregator")

def record_view(request_id: str):
    # Idempotency: deduplicate retried requests
    shard = SHARDS[int(hashlib.md5(request_id.encode()).hexdigest(), 16) % 64]
    with shard.pipeline() as pipe:
        # SET NX = only increment if this request_id hasn't been seen
        if pipe.set(f"seen:{request_id}", 1, nx=True, ex=3600).execute()[0]:
            shard.incr("views")

def aggregate():
    total = sum(int(s.get("views") or 0) for s in SHARDS)
    AGGREGATOR.set("global_views", total)

def get_views() -> int:
    return int(AGGREGATOR.get("global_views") or 0)
```

### Key properties

| Property | How it's achieved |
|---|---|
| Lock-free writes | `INCR` is atomic; no locks needed |
| No overcount | Idempotency key (`SET NX`) deduplicates retried requests |
| No undercount | `fetch_and_add` never loses an increment; aggregator sums all shards |
| Millions of writes/sec | Linear scale: add shards; each shard handles ~50–100k writes/sec |
| Read freshness | Aggregator runs every 1–5s; reads are stale by at most that interval |

### Scaling knobs

- **More throughput**: increase shard count (linear scaling).
- **Fresher reads**: decrease aggregation interval (trades CPU for recency).
- **Partition tolerance**: use a CRDT G-Counter if you need strong partition survival — it converges to the exact total without a central aggregator, at the cost of higher implementation complexity.

### The hard constraint you can't avoid

"Never undercounts + never overcounts + lock-free + millions of writes/sec" is achievable, but **reads will be slightly stale** (seconds). A system that is simultaneously exact on reads *and* lock-free *and* globally consistent at this write rate would require distributed consensus on every write (Paxos/Raft), which eliminates the throughput goal. Choose: exact reads with lower throughput, or slightly stale reads with unlimited throughput.
```

