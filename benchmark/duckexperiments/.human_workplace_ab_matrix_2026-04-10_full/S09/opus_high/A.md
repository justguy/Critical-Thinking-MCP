# S09 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S09/opus_high/A.stderr.log`

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
## The Honest Answer: This Is an Impossible Triangle

You cannot have **all three** simultaneously. Here's why, and what you can actually build.

### The Tension

| Property | Conflicts With |
|---|---|
| Always consistent | Reducing DB load — consistency requires checking the source of truth |
| Zero invalidation lag | Always consistent — you'd need synchronous cache updates on every write |
| 90% DB load reduction | Zero lag + consistency — validating freshness means hitting the DB |

If every read must be provably consistent with zero lag, you must check the DB on every read — which means no load reduction.

### What You Can Actually Build

**Option A: Write-through cache (consistency + low lag, ~70-80% load reduction)**

- All writes go through the cache layer, which updates cache and DB synchronously in the same transaction.
- Reads always hit cache first.
- Trade-off: Write latency increases slightly. Load reduction is good but not 90% because write paths still hit the DB and you need cache-miss fallthrough.

**Option B: CDC-based invalidation (consistency + high load reduction, near-zero lag)**

- Use Change Data Capture (Debezium, DynamoDB Streams, Postgres logical replication) to stream DB changes to cache.
- Invalidation lag is typically 10-50ms, not zero.
- Read-heavy workloads can hit 90%+ reduction.
- Trade-off: Small window of staleness. Operational complexity.

**Option C: Read-through + short TTL (high load reduction + simplicity, eventual consistency)**

- Cache reads with TTLs tuned per entity.
- Trade-off: Staleness bounded by TTL, not zero.

### Recommended Architecture (Best Practical Compromise)

```
Writes:  App → DB → CDC stream → Cache invalidation (async, ~10-50ms lag)
Reads:   App → Cache (hit?) → yes: return
                             → no:  DB → populate cache → return
```

- **Cache**: Redis/Dragonfly with per-entity TTLs as a safety net
- **Invalidation**: CDC (Debezium/pg logical replication) for near-real-time
- **Consistency guarantee**: Causal consistency via version stamps — each cached entry carries a monotonic version; if a client just performed a write, it can require `version >= N` and fall through to DB on stale hits

This gets you: **~85-95% load reduction, sub-100ms invalidation lag, causal consistency (not linearizable)**. That's the real engineering optimum. The specification as stated requires violating CAP/PACELC constraints — push back on "zero lag + always consistent + 90% reduction" as a requirements error before building anything.
```

