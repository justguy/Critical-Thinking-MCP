# W04 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/opus_high/B.stderr.log`

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
Here's a shift-swap system design that allows free trading while guaranteeing minimum staffing:

---

## Shift-Swap System

### Core principle
Replace manual approvals with **automated staffing-level enforcement**. Anyone can swap with anyone, instantly — but the system itself is the guardrail that prevents understaffing.

### How it works

1. **Define minimum staffing thresholds** — Set per-role, per-time-slot minimums (e.g., "Warehouse needs ≥ 3 pickers on Saturday AM"). This is the only configuration managers maintain.

2. **Open swap board** — Any employee posts a shift they want to trade. No restrictions on who can claim it.

3. **Claim & auto-validate** — When someone claims a swap, the system instantly checks: *would executing this trade drop any affected time slot below its staffing threshold?*
   - **Passes →** Execute the swap atomically (both reassignments in one transaction). Notify both employees and their managers.
   - **Fails →** Reject with a clear reason ("Saturday AM would drop to 2/3 required pickers"). The shift stays on the board for others to claim.

4. **Last-minute friendly** — No approval queue means no latency. Swaps can happen minutes before a shift starts, as long as coverage holds.

### Why this works without approvals

- The approval exists — it's just **automated and instant**. The staffing threshold *is* the policy, enforced computationally rather than by a manager checking a spreadsheet.
- Managers set the rules once; the system enforces them every time.
- Employees get autonomy and speed; the business gets guaranteed coverage.

### Key safeguards

| Risk | Mitigation |
|---|---|
| Two swaps race for the same slot | Execute swaps as atomic transactions with row-level locking on the roster |
| Cascading swaps leave a gap | Each swap is validated independently against *current* roster state at execution time |
| Someone swaps into overtime | Add optional overtime-hour cap as a second validation rule |
| Abuse / excessive swapping | Add optional swap-frequency limits per employee per period |

### What you actually need to build

- A `shift_roster` table with slot-level staffing counts
- A `staffing_thresholds` config table (role × time-slot → minimum headcount)
- A swap-request queue with claim logic
- One validation function: `can_swap(employee_a, shift_x, employee_b, shift_y) → bool`
- Atomic swap execution (single DB transaction for both reassignments)

This gives you a zero-approval, zero-understaffing swap system. The constraint isn't "who says yes" — it's "does the math work."
```

