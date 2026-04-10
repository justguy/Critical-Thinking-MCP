# W05 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/opus_high/B.stderr.log`

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
Here is a staffing plan that targets 20% labor cost reduction, faster response times, burnout prevention, and seven-day coverage — all without new hires.

## Phase 1 — Diagnose (Week 1–2)
- **Audit** every role's hours, tasks, peak windows, and idle time across all 7 days.
- **Identify waste:** duplicated coverage, low-value meetings, and automatable tasks.

## Phase 2 — Restructure (Week 3–6)
- **Shift redesign:** Replace fixed 5×8 schedules with staggered 4×10 or compressed rotations. This naturally extends coverage to 7 days using the same headcount — weekend shifts are staffed by weekday-off rotations.
- **Cross-train staff:** Pair complementary roles so each person covers at least one adjacent function. This creates flexibility to fill gaps without overtime.
- **Automate the bottom 20%:** Deploy self-service portals, canned responses, or workflow automation for repetitive, rules-based volume. This is where most of the cost savings come from.

## Phase 3 — Optimize Flow (Week 5–7)
- **Tiered response model:** Route urgent items to on-shift senior staff immediately; batch non-urgent work into next-cycle queues. This cuts context-switching (the biggest hidden response-time killer) and lets staff work in focused blocks.

## Phase 4 — Protect People (Ongoing)
- **Burnout guardrails:** Cap consecutive working days at 4, enforce minimum 2 consecutive days off per rotation, monitor weekly hours.
- These constraints are non-negotiable inputs to the scheduling algorithm, not afterthoughts.

## Phase 5 — Validate and Scale (Week 7–12)
- Pilot one team for 4 weeks. Track: labor cost delta, p50/p95 response time, employee satisfaction scores.
- Only roll out org-wide after the pilot proves the model on all three metrics.

## Where the 20% comes from (illustrative)
| Source | Savings |
|---|---|
| Automating repetitive volume | ~8–10% |
| Eliminating overtime via better shift coverage | ~5–7% |
| Removing duplicated coverage & low-value meetings | ~3–5% |

## Key tensions to watch
- **4×10 shifts may not suit every role** (e.g., customer-facing roles with strict 8-hour SLAs) — you may need a hybrid model.
- **Cross-training has a short-term productivity dip** — plan for it during the pilot.
- **If headcount is already razor-thin**, the burnout guardrails and 7-day coverage may fight each other — the Phase 1 audit will reveal whether the math works before you commit.
```

