# S09 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/opus_high/B.stderr.log`

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
**The honest answer: you cannot have all three simultaneously.** "Always consistent + zero invalidation lag + 90% load reduction" is an impossible triangle — it violates fundamental consistency/availability/latency tradeoffs. Here's why, and what you *can* build:

---

## The Constraint Triangle

| Pick Two | You Sacrifice |
|---|---|
| Perfect consistency + zero lag | Write-through on every mutation means DB still handles all writes synchronously → ~50-60% load reduction max |
| Zero lag + 90% load reduction | Async invalidation at scale introduces a small staleness window (ms-range) |
| Perfect consistency + 90% load reduction | You need TTLs or periodic refresh, which means non-zero invalidation lag |

## Recommended: CDC-Based Invalidation (Best Realistic Tradeoff)

This gets you **near-zero lag (single-digit ms), strong practical consistency, and ~80-85% DB load reduction**:

```
┌──────────┐   read    ┌───────────┐  miss   ┌──────────┐
│   App    │──────────▶│   Redis   │────────▶│    DB    │
│          │◀──────────│  (cache)  │◀────────│          │
└──────────┘   hit     └───────────┘  fill   └──────────┘
                            ▲                      │
                            │ evict/update          │ WAL/binlog
                            │                      ▼
                       ┌───────────┐         ┌──────────┐
                       │ Invalidation│◀───────│ Debezium │
                       │  Consumer │         │  (CDC)   │
                       └───────────┘         └──────────┘
```

### Implementation Steps (Critical Path)

1. **CDC pipeline** — Deploy Debezium (or equivalent) on your DB's WAL/binlog to emit every committed write as a stream event.
2. **Cache cluster** — Redis with read-through: misses query DB, populate on return.
3. **Invalidation consumer** — Subscribes to CDC stream, evicts or updates cache entries within milliseconds of DB commit.
4. **Write-through for critical paths** — For operations where even ms-level staleness is unacceptable, synchronously update cache after DB write before returning to the caller.
5. **Circuit breaker** — If CDC lag exceeds a threshold (e.g., 50ms), affected keys fall back to direct DB reads. This preserves your consistency guarantee at the cost of temporary load increase.
6. **Safety-net TTL** — Short TTL (e.g., 60s) as a backstop so even if CDC misses an event, staleness is bounded.
7. **Load test** — Validate actual hit rate, DB load reduction, and p99 staleness; tune CDC consumer parallelism.

### What This Gets You

| Metric | Target | Realistic |
|---|---|---|
| Consistency | "Always" | **>99.99% of reads consistent**; ms-range window on remaining |
| Invalidation lag | Zero | **1-10ms typical** (CDC commit-to-eviction) |
| DB load reduction | 90% | **80-85% for read-heavy workloads** (90%+ if read:write > 20:1) |

### Where the Remaining Gap Lives

- The ~15-20% residual DB load comes from **writes** (they always hit the DB) and **cache misses on cold/long-tail keys**.
- The ms-range staleness window is the CDC propagation delay. It's not zero, but it's invisible to virtually all applications.
- If your workload is write-heavy (>30% writes), no cache architecture will hit 90% load reduction — the writes themselves are the load.

**Bottom line:** Don't design for an impossible spec. Design for the *tightest realistic bounds* on each constraint, and make the tradeoff boundaries explicit and observable via metrics.
```

