# S13 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Estimation`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `check_numeric_claims`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/sonnet_high/A.stderr.log`

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
There's no basis for an exact date or probability here — "about a dozen unspecified widgets" and "team velocity" are placeholders, not inputs.

To give a real estimate you need:

- **Scope**: What are the widgets? Even rough complexity buckets (small/medium/large) matter enormously.
- **Velocity**: Actual measured throughput — story points per sprint, features per week, tickets per sprint. "Team velocity" without a number is not a velocity.
- **Team availability**: Headcount, part-time allocation, upcoming PTO, competing priorities.
- **Definition of done**: MVP with hardcoded data vs. production-ready with real data pipelines, auth, and error states are very different timelines.
- **Historical accuracy**: How often has this team's past estimates been right? That sets the confidence interval.

Any date I give without these inputs would be a random number dressed up as analysis. Provide the actuals and I can give you a grounded range with a real confidence level.
```

