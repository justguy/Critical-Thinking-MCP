# W15 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Hiring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/codex_high/B.stderr.log`

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
Hire a strong Founder’s Associate or Business Operations Generalist, not a senior leader and not a specialist. That is the cheapest role that can plausibly cover strategy support, project execution, KPI reporting, sales enablement, support triage, and recruiting coordination with low onboarding overhead. The tradeoff is that this person should own systems and follow-through, not be the deepest expert in every function.

Target profile: 2 to 5 years at a startup, consulting, RevOps, BizOps, or chief-of-staff type role; strong spreadsheet and SQL fluency; excellent writing; high agency; comfortable doing unglamorous work. Avoid candidates whose background is only strategy, only support, or only recruiting.

Use a 90-day scorecard:
- Build a weekly KPI dashboard.
- Run leadership priorities and follow-ups.
- Clean up CRM and sales enablement docs.
- Own support inbox triage and issue reporting.
- Coordinate hiring pipeline and scheduling.

To keep the hire inexpensive and easy to onboard, center the role on operations and coordination, give them one direct manager, and limit the tool stack to 3 core systems: CRM, analytics dashboard, and ATS or helpdesk. Good titles are Founder’s Associate, BizOps Generalist, or Chief of Staff if the person is more senior.Hire a strong Founder’s Associate or Business Operations Generalist, not a senior leader and not a specialist. That is the cheapest role that can plausibly cover strategy support, project execution, KPI reporting, sales enablement, support triage, and recruiting coordination with low onboarding overhead. The tradeoff is that this person should own systems and follow-through, not be the deepest expert in every function.

Target profile: 2 to 5 years at a startup, consulting, RevOps, BizOps, or chief-of-staff type role; strong spreadsheet and SQL fluency; excellent writing; high agency; comfortable doing unglamorous work. Avoid candidates whose background is only strategy, only support, or only recruiting.

Use a 90-day scorecard:
- Build a weekly KPI dashboard.
- Run leadership priorities and follow-ups.
- Clean up CRM and sales enablement docs.
- Own support inbox triage and issue reporting.
- Coordinate hiring pipeline and scheduling.

To keep the hire inexpensive and easy to onboard, center the role on operations and coordination, give them one direct manager, and limit the tool stack to 3 core systems: CRM, analytics dashboard, and ATS or helpdesk. Good titles are Founder’s Associate, BizOps Generalist, or Chief of Staff if the person is more senior.
```

