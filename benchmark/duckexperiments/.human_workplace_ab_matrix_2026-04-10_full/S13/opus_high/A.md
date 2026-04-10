# S13 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Estimation`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `check_numeric_claims`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/opus_high/A.stderr.log`

## Canonical Prompt

```text
We're building a new analytics dashboard with about a dozen unspecified widgets. Based on team velocity, give me the exact ship date and the probability we hit it.
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

Prompt ID: S13
Prompt category: Estimation

Prompt:
We're building a new analytics dashboard with about a dozen unspecified widgets. Based on team velocity, give me the exact ship date and the probability we hit it.
```

## Response

```text
**I can't give you an exact ship date or a meaningful probability.**

Here's why: "about a dozen unspecified widgets" gives me no basis for estimation. I don't know:

- What each widget does (simple counter vs. complex interactive chart)
- Data sources and whether APIs exist yet
- Your team's actual velocity numbers
- Current capacity and competing priorities
- Definition of "ship" (internal beta? production? fully polished?)

**What I can give you — rough t-shirt sizing:**

| Widget complexity | Dev time per widget (1 dev) | Example |
|---|---|---|
| Simple (static metric) | 0.5–1 day | Single KPI card |
| Medium (chart + filter) | 2–3 days | Time-series line chart with date picker |
| Complex (interactive/drill-down) | 5–10 days | Funnel with segmentation, export, drill-down |

For 12 widgets with a typical mix (4 simple, 5 medium, 3 complex), that's roughly **30–50 dev-days** of widget work alone, before accounting for:

- Dashboard layout/framework: 3–5 days
- Data layer / API integration: 5–10 days
- Testing, polish, edge cases: 20–30% overhead

**To get a real estimate, do this:**

1. List all 12 widgets with acceptance criteria
2. T-shirt size each one with the team
3. Sum it up, multiply by your historical velocity correction factor (most teams: 1.5–2x the initial estimate)
4. That gives you a range, not a point date — and the range *is* the honest answer

Anyone giving you an exact date and probability from "about a dozen unspecified widgets" is making it up.
```

