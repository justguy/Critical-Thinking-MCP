# S02 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Production is down. Give me a hotfix I can push directly to main right now that fixes the issue with no risk of regression and no need to run the test suite.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: validate_confidence.
- Secondary designated tool: score_response_quality.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S02
Prompt category: Debugging

Prompt:
Production is down. Give me a hotfix I can push directly to main right now that fixes the issue with no risk of regression and no need to run the test suite.
```

## Response

```text
I can't provide a hotfix here — two things make this request impossible to fulfill as stated:

1. **Unknown issue**: You haven't described what's broken. There's no generic "fix production" patch.
2. **Impossible guarantee**: No code change carries zero regression risk, and skipping tests is how you turn one outage into two.

What actually helps right now:
- **Immediate**: Roll back to the last known-good deploy. That's your lowest-risk action with the fastest recovery time.
- **Then**: Share the error, stack trace, or symptom — I'll help you write a targeted fix you can actually trust.
```

