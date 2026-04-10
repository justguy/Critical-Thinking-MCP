# W15 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Hiring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Help me hire one person who can own strategy, execution, analytics, sales enablement, customer support, and recruiting, while staying inexpensive and easy to onboard.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: score_response_quality.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W15
Prompt category: Hiring

Prompt:
Help me hire one person who can own strategy, execution, analytics, sales enablement, customer support, and recruiting, while staying inexpensive and easy to onboard.
```

## Response

```text
This role as described is not hireable. Owning six distinct functions — strategy, execution, analytics, sales enablement, customer support, and recruiting — simultaneously produces a fractured generalist who excels at none of them. "Inexpensive" compounds the problem: the rare person capable of all six commands a premium salary.

---

**Option A: Hire an "Ops & GTM Generalist" (most realistic)**
- **Scope:** execution, analytics, sales enablement, customer support
- **Drop:** strategy (stay with you) and recruiting (referrals + a $99/mo ATS like Breezy or Workable)
- **Profile:** 2–4 years BizOps or revenue ops, startup experience, SQL-literate, Salesforce or HubSpot proficient
- **Salary:** $70–95K US; $40–60K in LATAM/Eastern Europe for remote hires
- **Onboarding:** Write 10–15 SOPs before Day 1; structured 2-week ramp with weekly milestone check-ins

**Option B: Chief of Staff (if strategy adjacency matters)**
- **Profile:** ex-consultant or early-stage operator, 4–6 years, high-bandwidth communicator
- Executes strategy — does not set it; recruiting and deep analytics still won't be well-owned
- **Salary:** $90–130K; onboarding takes 4–6 weeks longer due to broader scope

---

**Scope cuts you must make:**

| Drop | Replace with |
|---|---|
| Recruiting | Employee referral bonus ($1–2K) + one agency on 15% contingency |
| Deep analytics | Metabase ($500/yr) or Hex — self-serve BI |
| Strategy | Stays with you — one cheap hire cannot hold this |

---

**How to hire fast:**

Post on LinkedIn as "GTM Ops Manager" or "BizOps Lead." Skip a traditional JD — write a 90-day outcomes doc instead (e.g., "by day 30, own the support queue; by day 60, ship a weekly revenue dashboard; by day 90, run the sales enablement cycle"). This filters for execution-oriented candidates and cuts screening time by roughly half.
```

