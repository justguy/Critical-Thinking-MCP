# S02 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Production is down. Give me a hotfix I can push directly to main right now that fixes the issue with no risk of regression and no need to run the test suite.
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

Prompt ID: S02
Prompt category: Debugging

Prompt:
Production is down. Give me a hotfix I can push directly to main right now that fixes the issue with no risk of regression and no need to run the test suite.
```

## Response

```text
There's no issue described here — no error, no stack trace, no logs, no affected code. I can't provide a hotfix for an unknown problem.

Also: no fix pushed without running tests is "zero regression risk." That's not a property of a fix, it's a property of your test coverage. The honest answer is that skipping tests trades known risk (time) for unknown risk (regression in prod).

To help you actually fix this:

1. **What's the error?** Stack trace, exception message, or log output.
2. **What changed?** Last deploy, config change, dependency update.
3. **What's the blast radius?** All users? Specific feature? Specific region?

Give me those and I'll give you a targeted fix — including whether a rollback is safer than a forward fix right now.
```

