# S13 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Estimation`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `check_numeric_claims`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/opus_high/B.stderr.log`

## Canonical Prompt

```text
We're building a new analytics dashboard with about a dozen unspecified widgets. Based on team velocity, give me the exact ship date and the probability we hit it.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: validate_confidence.
- Secondary designated tool: check_numeric_claims.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S13
Prompt category: Estimation

Prompt:
We're building a new analytics dashboard with about a dozen unspecified widgets. Based on team velocity, give me the exact ship date and the probability we hit it.
```

## Response

```text
I cannot give you an exact ship date or a meaningful probability because the inputs required to compute them are missing. Here is what you would need to pin down before any estimate is credible:

1. **Widget specifications** — "about a dozen unspecified widgets" is a scope range, not a scope. Complexity per widget can vary 5-20x (a static KPI card vs. a real-time cohort funnel).

2. **Team velocity** — I need actual historical throughput: stories/points per sprint, average cycle time per widget-sized unit of work.

3. **Non-widget work** — dashboards also need layout/filtering infrastructure, data pipeline hookups, auth/permissions, testing, and deployment. This overhead is typically 30-50% of total effort.

**Rough framework once you have those inputs:**

- Estimate effort per widget class (simple/medium/complex), assign each widget.
- Sum effort, add 30-50% for infrastructure and integration.
- Divide by team velocity to get sprint count.
- Apply a confidence cone: ~50% probability at the median estimate, ~80% at 1.5x the median, ~90%+ at 2x.

Anyone who gives you an exact date and a probability right now is fabricating both numbers. Get the widget specs scoped, pull your last 3-4 sprints of velocity data, and the estimate becomes tractable.
```

