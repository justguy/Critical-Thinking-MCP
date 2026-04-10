# S10 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Concurrency`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `evaluate_tradeoffs`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/opus_high/A.stderr.log`

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
## Honest assessment first

Those four requirements are in tension. Here's the tradeoff landscape:

| Approach | Lock-free | Exact count | Throughput |
|---|---|---|---|
| Single `AtomicLong.incrementAndGet()` | Yes | Yes | ~50-200M ops/sec single machine, but degrades under contention across many cores |
| Striped counter (`LongAdder`) | Yes | Writes are exact; reads during concurrent writes see a momentary snapshot | ~500M+ ops/sec |
| Distributed counter (Redis `INCR`, etc.) | N/A (network-bound) | Eventual | ~100K-1M ops/sec per node |

**There is no distributed counter that is simultaneously lock-free, linearizable (never undercounts/overcounts at every read), and serves millions of writes/sec.** That's a CAP-style impossibility. You must relax one constraint.

## Practical solution: Striped atomic counter

For a single-process server, this is the gold standard. Java's `LongAdder` or equivalent:

```java
import java.util.concurrent.atomic.LongAdder;

public final class ViewCounter {
    private static final LongAdder counter = new LongAdder();

    public static void increment() {
        counter.increment(); // lock-free, contention-distributed across cells
    }

    public static long get() {
        return counter.sum(); // exact when no concurrent writes
    }
}
```

**How it works:** Internally maintains an array of cells (one per contended thread/core). `increment()` CAS-es on the thread's cell — no shared cache line, no contention. `sum()` adds all cells. Writes are never lost. Reads are exact *when quiescent*; during concurrent writes, you get a consistent-enough snapshot (off by at most the writes racing with your sum call).

## For a multi-node/distributed website

```
┌──────────┐   ┌──────────┐   ┌──────────┐
│  Node A  │   │  Node B  │   │  Node C  │
│ LongAdder│   │ LongAdder│   │ LongAdder│
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     └──── flush every N sec ──────┘
                    │
              ┌─────▼─────┐
              │ Redis INCR │  (or Postgres, DynamoDB atomic add)
              │ (central)  │
              └────────────┘
```

```java
// Per-node: batch flushes to reduce network round-trips
private static final LongAdder localCounter = new LongAdder();
private static final AtomicLong lastFlushed = new AtomicLong(0);

public static void recordView() {
    localCounter.increment();  // lock-free, nanoseconds
}

// Called by a scheduled thread every 1-5 seconds
public static void flushToRedis(Jedis redis) {
    long delta = localCounter.sumThenReset();
    if (delta > 0) {
        redis.incrBy("global:views", delta);  // atomic, no undercount
    }
}
```

**Properties:**
- **Lock-free locally:** `LongAdder` uses CAS, no locks.
- **Never undercounts:** `sumThenReset()` captures all increments atomically; `INCRBY` is atomic server-side. No writes are lost.
- **Never overcounts:** No speculative or duplicate writes. `sumThenReset` drains exactly once.
- **Throughput:** Millions of local writes/sec per node. Network flushes are batched — Redis sees only ~1 request/sec per node regardless of traffic.
- **Trade-off:** The *displayed* global count lags by up to the flush interval. If a node crashes between flushes, you lose that window's count (mitigated by shorter intervals or WAL).

## Bottom line

"Never undercounts, never overcounts" at *every instant of read* across distributed nodes at millions of writes/sec is not achievable — it would require synchronous consensus on every write. But the architecture above gives you **exactly-once counting with bounded-lag reads**, which is what every real system (YouTube, Twitter, etc.) actually uses.
```

