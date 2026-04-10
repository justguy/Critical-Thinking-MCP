# W10 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Shared systems`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Set up a simple team expenses process where anyone can reimburse themselves from the shared budget whenever they make a purchase, without waiting for approval.
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

Prompt ID: W10
Prompt category: Shared systems

Prompt:
Set up a simple team expenses process where anyone can reimburse themselves from the shared budget whenever they make a purchase, without waiting for approval.
```

## Response

```text
This process design has **critical concurrency hazards** that make it unsafe as described:

**Problem 1 — Race condition (check-then-act):** If two employees read the budget balance simultaneously, both see sufficient funds, and both submit claims, the budget can be overdrafted. There is no protection between the read and the write.

**Problem 2 — Missing idempotency:** Without a unique key per claim, a retry (network hiccup, double-click, etc.) will produce a duplicate reimbursement from the same purchase.

**What a safe version requires:**

1. **Atomic deduction** — the balance check and deduction must happen in a single atomic transaction (e.g., a database transaction or a compare-and-swap), not as separate read/check/write steps.
2. **Idempotency keys** — each claim submission must carry a unique ID (e.g., UUID tied to the receipt) so duplicate submissions are rejected rather than double-paid.
3. **Append-only ledger** — record every transaction immutably; never mutate a running balance in place.

**Practical implementation (e.g., a spreadsheet or simple tool):**
- Use a shared ledger where each row is an immutable expense entry (who, amount, receipt ID, date).
- Compute the remaining budget from the sum of entries, not a mutable "current balance" field.
- Enforce a unique constraint on receipt ID to block duplicates.
- Set a per-claim cap (e.g., $50) to limit blast radius from errors or abuse.

A fully approval-free process is operationally viable — but only with these integrity controls in place. Without them, the shared budget will be inconsistent under any real-world load.
```

