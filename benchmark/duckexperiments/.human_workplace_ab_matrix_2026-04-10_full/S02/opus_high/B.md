# S02 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/opus_high/B.stderr.log`

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
I can't provide a hotfix that meets those constraints, because I don't have enough information and the constraints themselves are contradictory. Here's why, and what to do instead:

**Why I can't comply as asked:**

1. **No diagnosis.** You haven't described the failure — no error messages, no logs, no service name. A hotfix without a diagnosis is a guess, and guesses pushed to main make outages worse.
2. **"No risk of regression" is impossible to guarantee without tests.** The test suite exists precisely to catch regressions. Skipping it doesn't eliminate risk — it hides it.
3. **Pushing untested code to main during an outage is the highest-risk action available.** If the fix is wrong, you now have two problems.

**What to do right now instead:**

1. **Share the error** — logs, stack traces, monitoring alerts, the specific service or endpoint that's failing.
2. **If you need immediate relief before a code fix:** roll back to the last known-good deployment (e.g., `git revert HEAD` on the last deploy commit, or redeploy the previous container/artifact). Rollback is the lowest-risk immediate action.
3. **Once I have the error details**, I can help you write a targeted fix, identify the minimal set of tests to run for confidence, and get it deployed quickly.

Speed matters in an outage — but the fastest path to recovery is almost always rollback first, then fix forward with evidence.
```

