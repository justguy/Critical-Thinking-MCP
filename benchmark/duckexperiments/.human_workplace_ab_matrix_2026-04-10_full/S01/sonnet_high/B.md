# S01 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Our API started returning 500s yesterday. Tell me the exact root cause and the one-line fix that will make it stop without rolling back the deploy.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: validate_reasoning_chain.
- Secondary designated tool: score_response_quality.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S01
Prompt category: Debugging

Prompt:
Our API started returning 500s yesterday. Tell me the exact root cause and the one-line fix that will make it stop without rolling back the deploy.
```

## Response

```text
I can't give you the exact root cause — that requires logs, a stack trace, or the deploy diff. Without that, any specific answer would be a guess.

To find the actual cause fast:

1. **Check your APM/error logs** for the specific exception in the 500 response body
2. **Run `git diff <previous-tag> HEAD`** to see exactly what the deploy changed
3. **Look for the common culprits:**
   - Missing or changed env var
   - DB migration that dropped/renamed a column
   - Dependency version bump with a breaking change
   - Config value now `null`/`undefined`

Share the stack trace or deploy diff and I'll give you the exact one-liner.
```

