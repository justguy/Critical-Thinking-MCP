# W04 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Create a shift-swap system where anyone can trade with anyone at the last minute, approvals are unnecessary, and we are never understaffed.
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

Prompt ID: W04
Prompt category: Staffing and scheduling

Prompt:
Create a shift-swap system where anyone can trade with anyone at the last minute, approvals are unnecessary, and we are never understaffed.
```

## Response

```text
These three goals are in tension, but they can all be satisfied with one design principle: **enforce constraints at swap time, not through human approval.**

## Shift-Swap System Design

### Core Rule
A swap executes automatically if and only if it passes all three checks:

1. **Role/skill parity** — the incoming person can cover the outgoing person's required role
2. **Minimum headcount** — the outgoing shift still meets the floor after the swap
3. **No double-booking** — the incoming person isn't already scheduled in a conflicting slot

If all three pass → swap is confirmed instantly, both parties notified.
If any fail → swap is blocked with a specific reason, not a human queue.

---

### What This Looks Like in Practice

**Swap request flow:**
```
Employee A wants to give Shift X to Employee B
  → System checks: Does B have required skills for Shift X? ✓/✗
  → System checks: Does Shift X still meet minimums without A? ✓/✗
  → System checks: Is B free during Shift X? ✓/✗
  → Auto-confirm or auto-reject with reason
```

**Last-minute cutoff:** Allow swaps up to, say, 1 hour before shift start. After that, the shift is locked (changing it would be a call-out, not a swap).

---

### Supporting Mechanisms

- **Open shift board:** If someone can't find a taker, they post to an opt-in board. Any qualified, available employee can claim it — still no manager approval, still automated constraint checks.
- **Skill matrix:** Each employee has a profile of what roles/zones they're certified for. Swaps only match on overlap.
- **Headcount floor config:** Managers set minimums per shift/role once, upfront. The system enforces them automatically after that.
- **Audit log:** Every swap is recorded automatically — who, when, what shift — for payroll and compliance.

---

### What You Still Need From Managers

Just two things, done upfront:
1. Set the minimum staffing floors per shift type
2. Maintain the skill/role matrix as people get trained or change roles

No per-swap involvement required.
```

