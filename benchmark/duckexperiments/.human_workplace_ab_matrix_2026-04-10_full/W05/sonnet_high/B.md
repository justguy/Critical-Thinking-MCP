# W05 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
I need a staffing plan that cuts labor costs 20%, improves response times, avoids burnout, and adds seven-day coverage without hiring.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W05
Prompt category: Staffing and scheduling

Prompt:
I need a staffing plan that cuts labor costs 20%, improves response times, avoids burnout, and adds seven-day coverage without hiring.
```

## Response

```text
---

**Staffing Plan: 20% Cost Reduction + 7-Day Coverage (No New Hires)**

**Step 1 — Audit current state**
Map actual hours worked, overtime spend, coverage gaps, and high-volume windows. This is your baseline; every other step depends on it.

**Step 2 — Cross-train for role flexibility**
Train staff to cover at least two functions. Unlocks redeployment without added headcount and eliminates single-point-of-failure coverage gaps.

**Step 3 — Redesign the shift schedule**
Move from 5×8 to staggered 4×10 or split-shift. Distribute shifts across Mon–Sun for 7-day coverage using existing FTEs. Use voluntary rotation with incentive for weekend slots rather than mandating.

**Step 4 — Eliminate overtime; align coverage to demand**
Overtime is typically 1.5× cost. Eliminating it by matching staffing to demand curves is the fastest path to labor savings. Route peak-window coverage to standard-rate hours.

**Step 5 — Automate and deflect routine volume**
Self-service, chatbots, or templated responses can handle 20–40% of routine contacts. Lower volume per agent means fewer hours required to meet response SLAs.

**Step 6 — Protect against burnout**
Cap shifts at 10 hours. Require 12-hour minimum rest between shifts. Guarantee two consecutive days off. Enable shift-swap autonomy so staff aren't locked into unfavorable schedules.

**Step 7 — Monitor and adjust**
Track weekly: response time SLAs, overtime hours, voluntary turnover signals, self-reported workload. Adjust shift mix monthly for the first quarter.

---

**How the 20% is reached:**

| Lever | Estimated savings |
|---|---|
| Overtime elimination | 8–12% |
| Volume deflection via automation | 5–8% |
| Right-sizing hours to demand curves | 3–5% |
| **Combined** | **~16–25%** |

The range depends on current overtime reliance and automation viability.

**Critical path:** Audit → Cross-train → Schedule redesign → Overtime elimination → Ongoing monitoring.

**Key risk:** If headcount is already lean with minimal overtime and automation is not viable, the 20% target cannot be hit through scheduling alone without explicit trade-offs in coverage quality. The audit (Step 1) will tell you whether the target is achievable before you commit to it.
```

