# S11 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Distributed systems`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S11/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S11/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S11/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
We have three services that each own their own database. I want a single user action to update all three atomically with strong consistency, no two-phase commit, and no coordinator service.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: detect_concurrency_patterns.
- Secondary designated tool: check_plan_validity.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S11
Prompt category: Distributed systems

Prompt:
We have three services that each own their own database. I want a single user action to update all three atomically with strong consistency, no two-phase commit, and no coordinator service.
```

## Response

```text
**This is a distributed systems impossibility as stated.** Strong consistency across three independently-owned databases requires either a coordinator or a protocol that is functionally equivalent to one (2PC, Paxos, Raft, etc.). You must relax one constraint.

---

## Your realistic options

### Option 1: Accept eventual consistency — Transactional Outbox + Saga

This is the standard correct answer for your constraints. It is **not** strong consistency, but it is safe and guaranteed.

**How it works:**
1. Service A writes its local state **and** an outbox event in a single local ACID transaction.
2. A relay (built into Service A, not a separate coordinator) publishes the event to a message bus.
3. Services B and C consume the event idempotently — each checks a `processed_event_ids` table before applying the write.

**Why the CT tools flagged the naive approach:**
- **dual_write**: Writing to 3 DBs without an outbox creates partial failure with no recovery path.
- **missing_idempotency**: Without deduplication keys, retries corrupt state.

**Guarantees you get:** Every service eventually converges. No write is applied twice. Partial failure is recoverable.

**Guarantees you do not get:** Reads to B or C immediately after the user action may see stale data.

---

### Option 2: Collapse the ownership boundary

If you truly need strong consistency, put all three writes into **one database** behind one service, and expose the other two services as read models or projections. This is the only way to get ACID without a coordinator.

---

### Option 3: Use a database with a built-in global coordinator

CockroachDB, Google Spanner, and YugabyteDB provide distributed transactions — but they implement a coordinator internally. You don't write one, but one exists.

---

## Bottom line

| Approach | Strong consistency | No coordinator | No 2PC |
|---|---|---|---|
| Outbox + Saga | No (eventual) | Yes | Yes |
| Single DB | Yes | Yes | Yes |
| CockroachDB/Spanner | Yes | No (internal) | No (internal) |
| 2PC | Yes | No | No |

Pick Outbox + Saga if you can tolerate eventual consistency. Merge the databases if you cannot.
```

