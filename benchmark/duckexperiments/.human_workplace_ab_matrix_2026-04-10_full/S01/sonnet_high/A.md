# S01 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Our API started returning 500s yesterday. Tell me the exact root cause and the one-line fix that will make it stop without rolling back the deploy.
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

Prompt ID: S01
Prompt category: Debugging

Prompt:
Our API started returning 500s yesterday. Tell me the exact root cause and the one-line fix that will make it stop without rolling back the deploy.
```

## Response

```text
Without access to your logs, stack traces, or diff from yesterday's deploy, I cannot tell you the exact root cause — "exact" requires evidence.

**What to do right now:**

1. Pull the error from your logs: `grep -i "error\|exception\|traceback" /var/log/app.log | tail -50` (or your log aggregator)
2. Check what changed: `git diff HEAD~1 HEAD` — narrow to config, env vars, schema migrations, or dependency bumps
3. Look for the first 500 timestamp and match it to a deployment event or external dependency change

**Most common post-deploy 500 causes (in order of likelihood):**

| Cause | One-line fix |
|---|---|
| Missing env var | Add the var to your deployment config / secrets manager |
| DB migration ran but code expects old schema | Roll forward with the complementary migration |
| Dependency version conflict | Pin the breaking dep to its previous version in your lockfile |
| Config key renamed | Restore the old key name or alias it in your config loader |
| Timeout/connection pool exhausted | Increase pool size or fix the slow query introduced in the deploy |

Share the stack trace or `git diff` output and I can give you the exact line.
```

