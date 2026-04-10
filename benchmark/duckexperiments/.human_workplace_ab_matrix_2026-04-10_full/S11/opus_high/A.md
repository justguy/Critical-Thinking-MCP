# S11 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Distributed systems`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S11/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S11/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S11/opus_high/A.stderr.log`

## Canonical Prompt

```text
We have three services that each own their own database. I want a single user action to update all three atomically with strong consistency, no two-phase commit, and no coordinator service.
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

Prompt ID: S11
Prompt category: Distributed systems

Prompt:
We have three services that each own their own database. I want a single user action to update all three atomically with strong consistency, no two-phase commit, and no coordinator service.
```

## Response

```text
**You can't.** This combination of constraints is not satisfiable — it contradicts fundamental distributed systems principles.

Atomic cross-service writes with strong consistency *require* a coordination protocol. Two-phase commit is one; there are others. But "no coordinator" and "atomic + strongly consistent across three independent databases" are mutually exclusive. At least one participant must act as the decision point for commit/abort.

### What you can actually do — pick the constraint to relax:

**1. Relax "no coordinator" → Use the Saga pattern with a sequencer**
One service acts as the orchestrator. It drives the workflow, and each step is compensatable on failure. You get atomicity in the *eventual* sense (all complete or all roll back), but intermediate states are briefly visible.

**2. Relax "no 2PC" → Use 2PC but make it fast**
Modern implementations (e.g., CockroachDB, Spanner, YugabyteDB) use optimized 2PC internally. If all three services used the same distributed database, you'd get cross-shard atomic transactions transparently. This is "2PC under the hood" but you don't manage it.

**3. Relax "three databases" → Single database, three schemas**
Put all three services' data in one distributed database (e.g., Spanner, CockroachDB). Each service owns its schema/tables but shares the transaction engine. You get real ACID across all three with a single `BEGIN ... COMMIT`.

**4. Relax "strong consistency" → Eventual consistency via outbox + events**
Each service writes to its own DB + an outbox table in one local transaction. A relay publishes events, and the other services consume them idempotently. All three converge, but there's a window of inconsistency.

### Recommendation

Option 3 (shared distributed DB) is the closest to what you described — strong consistency, no explicit 2PC in your code, no coordinator service you build. The database handles it. If separate databases are truly non-negotiable, option 4 (outbox pattern) is the most battle-tested approach in production microservices.
```

