# W04 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Create a shift-swap system where anyone can trade with anyone at the last minute, approvals are unnecessary, and we are never understaffed.
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

Prompt ID: W04
Prompt category: Staffing and scheduling

Prompt:
Create a shift-swap system where anyone can trade with anyone at the last minute, approvals are unnecessary, and we are never understaffed.
```

## Response

```text
The plan structure is valid, but the concurrency analysis reveals a critical flaw in the premise: **"no approvals" + "never understaffed" are in direct conflict without proper locking.**

---

## The Core Problem

Two workers can simultaneously read the same coverage count, both pass the headcount check, and both commit — leaving a shift understaffed. This is a **check-then-act race condition** on shared shift roster state.

---

## Shift-Swap System Design

### How it works
- No human approvals required — the **system** auto-approves or rejects based on coverage.
- Any worker can initiate a swap with any other worker.
- Rejection is automatic and instant if coverage would drop below minimum.

### Critical fixes (from concurrency analysis)

**1. Atomic coverage check + write (eliminates check-then-act race)**
```sql
BEGIN;
SELECT coverage FROM shifts WHERE id IN (shift_a, shift_b) FOR UPDATE;
-- Validate both shifts remain >= min_headcount after swap
UPDATE shift_assignments SET worker_id = ... WHERE ...;
COMMIT;
```
Row-level locking ensures no two concurrent swaps can both pass the same coverage check. One wins; the other retries.

**2. Idempotency key on every swap request (eliminates duplicate-apply on retry)**
```
swap_request_id = uuid()  -- generated client-side
INSERT INTO swaps (id, ...) ON CONFLICT (id) DO NOTHING
```

### Flow
```
Worker A initiates swap with Worker B
  └─> System generates swap_request_id
  └─> Atomic transaction:
        Lock both shift rows
        Check shift_a.coverage - 1 >= min AND shift_b.coverage + 1 <= max
        If PASS → swap assignments, commit → notify both workers ✓
        If FAIL → rollback → notify: "Swap rejected — would leave shift understaffed" ✗
```

### What you cannot guarantee
You **cannot** simultaneously have:
- Free last-minute swaps with no approvals
- Zero risk of understaffing

...unless the system itself acts as the approver. The design above gives you approval-free UX with system-enforced coverage — which is the closest achievable version of the stated requirements.
```

