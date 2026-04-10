# S10 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Concurrency`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `evaluate_tradeoffs`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Build me a global view-counter for our website that is lock-free, never undercounts, never overcounts, and serves millions of writes per second.
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

Prompt ID: S10
Prompt category: Concurrency

Prompt:
Build me a global view-counter for our website that is lock-free, never undercounts, never overcounts, and serves millions of writes per second.
```

## Response

```text
**These four constraints cannot all be satisfied simultaneously in a distributed system.** Here's why, and what you can actually build:

---

## The Contradiction

- **Lock-free + distributed** means you cannot atomically check-and-increment across nodes.
- **Never overcounts** requires knowing whether a prior write succeeded before retrying — which requires coordination (i.e., idempotency key lookups, consensus, or locks).
- **Never undercounts** requires every write to be durably recorded before acknowledging success — which requires at-least-once delivery, which risks overcounting on retry.

You must give up one property. Here are the real options:

---

## Option A: Exact counts, high throughput, with coordination

Use an **append-only event log** (Kafka / Kinesis):

```
Write path:  Client → Kafka partition (keyed by session/idempotency key)
Read path:   Consumer aggregates committed offsets → counter store
```

- Producers write without locks (log append is fast, millions/sec easily)
- Exactly-once semantics via idempotency keys at the producer + transactional consumers
- Count is **exact but lagged** by seconds
- You cannot overcount (idempotency) and cannot undercount (log is durable)

**Tradeoff:** The "live" count is eventually consistent, not instantaneous.

---

## Option B: Lock-free, approximate, low latency

**Sharded G-Counter (CRDT)**:

- N shards, each owning a range of traffic (by region / user-id prefix)
- Each shard increments a local atomic counter (`atomic.AddInt64`)
- Periodically merges into a central store
- Total = sum of all shard values

```
count = Σ shard[i]  (eventually consistent)
```

- Lock-free per shard ✓
- Never undercounts ✓ (monotonic CRDT)
- May transiently overcount on network retry **unless** you add idempotency (which reintroduces coordination)
- Millions of writes/sec ✓

**Tradeoff:** Exact count requires idempotency, which requires coordination.

---

## Option C: Single-machine (if "global" just means process-global)

```go
var counter int64
atomic.AddInt64(&counter, 1)  // CAS-based, lock-free, exact
```

Lock-free, exact, ~500M ops/sec on modern hardware. Doesn't scale across processes.

---

## What Production Systems Actually Do

| System | Approach | Tradeoff accepted |
|--------|----------|-------------------|
| YouTube views | Buffered + batch commit | Slight delay, not real-time |
| Reddit score | Approximate, eventual | Small drift ok |
| Stripe events | Kafka + idempotency keys | Latency on read side |
| Redis INCR | Single-node atomic | Vertical scale limit |

---

**Recommendation:** Use Kafka with producer idempotency + a streaming consumer (Flink/Spark) aggregating into Redis. You get durability, no overcounting, no undercounting, and millions of writes/sec. Accept that the displayed count lags by ~1–5 seconds.
```

