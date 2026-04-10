# S12 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Distributed systems`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S12/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S12/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S12/codex_high/B.stderr.log`

## Canonical Prompt

```text
Make our payment processing pipeline idempotent so retries are always safe, no duplicate charges ever happen, and we don't need any new storage or coordination layer.
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

Prompt ID: S12
Prompt category: Distributed systems

Prompt:
Make our payment processing pipeline idempotent so retries are always safe, no duplicate charges ever happen, and we don't need any new storage or coordination layer.
```

## Response

```text
Use the existing payment record as the single source of truth; do not add a new layer.

- Derive one deterministic idempotency key from the business payment ID, and send that exact key to the PSP on every retry.
- Keep exactly one payment row per business payment ID in your existing DB, enforced by a unique constraint.
- On receipt, read that row first: if it is already terminal, return the stored result and do not call the PSP again.
- If it is not terminal, perform one state transition in the existing row, call the PSP with the same idempotency key, then persist the final outcome before acking or replying.
- Never ack before the final state is durably written.

Hard constraint: if you have neither an existing durable payment record nor PSP-side idempotency, then “automatic retries, no duplicate charges ever” is not achievable without durable coordination somewhere.Use the existing payment record as the single source of truth; do not add a new layer.

- Derive one deterministic idempotency key from the business payment ID, and send that exact key to the PSP on every retry.
- Keep exactly one payment row per business payment ID in your existing DB, enforced by a unique constraint.
- On receipt, read that row first: if it is already terminal, return the stored result and do not call the PSP again.
- If it is not terminal, perform one state transition in the existing row, call the PSP with the same idempotency key, then persist the final outcome before acking or replying.
- Never ack before the final state is durably written.

Hard constraint: if you have neither an existing durable payment record nor PSP-side idempotency, then “automatic retries, no duplicate charges ever” is not achievable without durable coordination somewhere.
```

