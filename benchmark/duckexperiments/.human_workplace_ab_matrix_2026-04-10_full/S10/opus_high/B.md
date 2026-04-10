# S10 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Concurrency`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `evaluate_tradeoffs`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S10/opus_high/B.stderr.log`

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
**You can't have all four properties simultaneously.** Here's why, and what to actually build:

## The Impossible Requirement

A single global counter that is lock-free, **never** undercounts, **never** overcounts, and handles millions of writes/sec on a distributed web backend is contradictory:

- **Never undercounts + never overcounts** = exactly-once counting, which requires coordination.
- **Lock-free + millions of writes/sec** = minimal coordination.
- On a single machine, an atomic `fetch-and-add` gives you exactly-once — but a single cache line tops out well below "millions of writes/sec" due to cache-line contention across cores.

## Recommended: Sharded Atomic Counters

The practical solution that gets you closest to all four goals:

```go
// Go example — same idea applies in C/C++/Rust/Java
import (
    "sync/atomic"
    "runtime"
)

// Pad each shard to its own cache line (64 bytes) to avoid false sharing
type paddedCounter struct {
    value int64
    _pad  [56]byte // 64 - 8 = 56 bytes padding
}

type ShardedCounter struct {
    shards []paddedCounter
}

func NewShardedCounter() *ShardedCounter {
    n := runtime.GOMAXPROCS(0) * 4 // over-shard to reduce contention
    return &ShardedCounter{shards: make([]paddedCounter, n)}
}

// Write path: lock-free, never loses an increment
func (c *ShardedCounter) Increment() {
    // Hash goroutine/thread to a shard — no lock, no CAS loop
    shard := fastThreadID() % uint64(len(c.shards))
    atomic.AddInt64(&c.shards[shard].value, 1)
}

// Read path: sum all shards
func (c *ShardedCounter) Count() int64 {
    var total int64
    for i := range c.shards {
        total += atomic.LoadInt64(&c.shards[i].value)
    }
    return total
}
```

### Why this works

| Property | Status |
|---|---|
| **Lock-free** | `atomic.AddInt64` is a single hardware instruction — no locks, no CAS retry loops |
| **Never undercounts** | Every `AddInt64` is guaranteed to apply; `Count()` reads all shards |
| **Never overcounts** | Each increment adds exactly 1 to exactly one shard |
| **Millions of writes/sec** | Shards on separate cache lines eliminate contention — scales linearly with cores |

### The honest caveat

`Count()` is **not linearizable** — while summing shards, concurrent increments may land on already-summed or not-yet-summed shards, so a reader can see a value that was momentarily "between" two real states. For a website view counter, this is irrelevant in practice. If you need a point-in-time snapshot, you must briefly pause writers (no longer fully lock-free) or accept the ~nanosecond-window approximation.

### Multi-server? Use a G-Counter CRDT

For a distributed fleet, each server keeps its own `ShardedCounter` and periodically publishes its total to a central store (Redis, DynamoDB). The global count is the sum of all server totals — a G-Counter CRDT that is mathematically guaranteed to converge without coordination. This adds slight read staleness but preserves the lock-free, no-undercount, no-overcount properties on each node.
```

