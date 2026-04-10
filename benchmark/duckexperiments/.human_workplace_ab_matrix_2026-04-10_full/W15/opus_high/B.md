# W15 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Hiring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/opus_high/B.stderr.log`

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
You can't meaningfully hire one person to *own* six distinct functions at depth. What you can hire is a generalist operator — sometimes called a "Chief of Staff" or "Business Operations Associate" — who triages across all six areas while you remain the actual decision-maker.

**Realistic candidate profile:**
- 2–4 years experience in ops, consulting, or a startup generalist role
- Comfortable with CRM tools (HubSpot/Salesforce), spreadsheets, and basic SQL or BI dashboards
- Strong written communication (they'll draft strategy docs, support replies, and recruiting outreach)
- Salary range: $55K–$80K in the US, or $15–$30/hr for a contractor/offshore hire

**Tier your six functions so the hire knows what to focus on:**

| Priority | Functions | Cadence |
|----------|-----------|---------|
| Tier 1 | Customer support, analytics dashboards | Daily |
| Tier 2 | Sales enablement (collateral, CRM hygiene), recruiting pipeline | Weekly |
| Tier 3 | Strategy documents, execution planning | Monthly/quarterly |

**Make onboarding cheap and fast:**
- Pre-build one-page SOPs for each function (response templates for support, a recruiting scorecard, a sales deck update checklist)
- Give them a single dashboard that surfaces the 5–8 KPIs they're responsible for
- Set a 30-day milestone: they should be running Tier 1 independently within the first month

**Set an escape hatch so you don't burn them out:**
Define trigger metrics for when a function must spin off to a specialist — e.g., support volume exceeds 50 tickets/week, or you have more than 10 open roles simultaneously. A generalist covering six functions is a temporary scaling strategy, not an org chart.

**Where to source:**
- AngelList/Wellfound for startup-minded generalists
- LinkedIn with the title "Business Operations" or "Chief of Staff"
- Fractional/contract marketplaces (Upwork, Toptal) if you want to test before committing

This approach gets you one affordable hire who keeps all six plates spinning, with clear prioritization so nothing critical drops and a defined plan for when you outgrow the model.
```

