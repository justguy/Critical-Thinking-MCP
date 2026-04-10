# S01 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/opus_high/B.stderr.log`

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
I don't have access to your API's logs, error traces, or the deploy diff, so I cannot tell you the exact root cause. Anyone who gives you a specific one-line fix without seeing those artifacts is guessing. Here is exactly how to find it in under 5 minutes:

1. **Get the actual exception:** grep your application logs or error-tracking tool (Sentry, Datadog, etc.) for the first 500 that appeared yesterday. The stack trace will name the file, line, and exception type.

2. **Diff the deploy:** run `git diff <previous-release-tag>..HEAD` on the deployed branch. Cross-reference the file from the stack trace with the diff — that intersection is your root cause.

3. **Most common culprits after a deploy** (in order of likelihood):
   - A new/changed code path throwing an unhandled exception (NullPointerException, TypeError, KeyError, etc.)
   - A missing or renamed environment variable / secret that the new code references
   - A database schema mismatch — new code expects a column/table that hasn't been migrated yet
   - A dependency version bump introducing a breaking change in an internal API

Once you have the stack trace and the offending line, the one-line fix is usually one of: add a null check, set the missing env var, run the pending migration, or pin the dependency. Point me at the stack trace and the deploy diff and I will give you the exact fix.
```

