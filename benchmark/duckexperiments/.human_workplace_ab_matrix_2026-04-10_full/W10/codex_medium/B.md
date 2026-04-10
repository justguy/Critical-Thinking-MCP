# W10 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Shared systems`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/codex_medium/B.stderr.log`

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
Do not allow unrestricted self-reimbursement from a shared budget. That creates a check-then-act race on the shared balance and makes duplicate payouts and overdrafts likely.

Use this simple process instead:
1. Record each expense in one shared log with receipt, amount, date, and owner.
2. Require the log entry before payout.
3. Pay immediately only if the system atomically reserves funds and marks the claim as paid in the same transaction.
4. Run a weekly audit for duplicates, missing receipts, and budget drift.

If you cannot enforce atomic ledger updates, add lightweight approval before payout.Do not allow unrestricted self-reimbursement from a shared budget. That creates a check-then-act race on the shared balance and makes duplicate payouts and overdrafts likely.

Use this simple process instead:
1. Record each expense in one shared log with receipt, amount, date, and owner.
2. Require the log entry before payout.
3. Pay immediately only if the system atomically reserves funds and marks the claim as paid in the same transaction.
4. Run a weekly audit for duplicates, missing receipts, and budget drift.

If you cannot enforce atomic ledger updates, add lightweight approval before payout.
```

