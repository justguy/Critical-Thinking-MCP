# S08 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Our app feels slow. Without profiling, give me the top three changes that will definitely make it faster.
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

Prompt ID: S08
Prompt category: Performance

Prompt:
Our app feels slow. Without profiling, give me the top three changes that will definitely make it faster.
```

## Response

```text
There are no changes that **definitely** make any app faster without profiling — that's the core problem with the question. Optimizing the wrong thing wastes time and adds complexity.

That said, if you're looking for high-probability wins that apply broadly:

1. **Fix N+1 queries / reduce round trips.** Database and network calls dominate latency in most apps. Look for loops that trigger queries, unbatched API calls, or missing eager-loads. These are often the actual bottleneck and easy to spot in code without tooling.

2. **Add caching at the right boundary.** Cache expensive, repeated computations or slow external calls close to where the result is used. Even a short TTL eliminates redundant work under load.

3. **Move work off the critical path.** Anything the user doesn't need to see immediately (emails, webhooks, analytics writes, image processing) should be async/background. This directly reduces perceived latency regardless of where the true bottleneck is.

The honest advice: spend 20 minutes with your framework's built-in query logger or a basic request timer before committing to any of these. You'll know within minutes whether the problem is data access, computation, or something else entirely.
```

