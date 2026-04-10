# S13 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Estimation`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `check_numeric_claims`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/sonnet_high/B.stderr.log`

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
There is no basis for an exact ship date or probability here. The required inputs are missing:

- **Scope**: "About a dozen unspecified widgets" has unknown complexity. A widget could be 1 day or 3 weeks of work.
- **Velocity**: No team velocity was provided — no points per sprint, cycle time, or historical throughput.
- **Team**: No team size or composition given.

Any specific date or percentage I produced would be fabricated. A number like "June 15, 70% confidence" would give false precision that could drive real decisions.

To actually estimate this:
1. Break each widget into stories with point estimates
2. Pull 3–6 sprints of historical velocity for the team
3. Run a Monte Carlo simulation over the velocity distribution
4. That yields a probability curve over completion dates — not a single date

I can help set up that process once the inputs exist.
```

