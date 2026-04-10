# S08 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_high/B.stderr.log`

## Canonical Prompt

```text
Our app feels slow. Without profiling, give me the top three changes that will definitely make it faster.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S08
Prompt category: Performance

Prompt:
Our app feels slow. Without profiling, give me the top three changes that will definitely make it faster.
```

## Response

```text
Nothing is guaranteed without profiling. If you have to act blind, do these three first:
1. Cut first-load and hot-screen work: less JS, defer non-critical code, virtualize large lists.
2. Cut network cost: fewer requests, smaller payloads, stronger caching, less refetching.
3. Cut repeated expensive work: cache derived data, precompute where possible, move heavy work off the main thread.

Those are the best blind bets, not guarantees.Nothing is guaranteed without profiling. If you have to act blind, do these three first:
1. Cut first-load and hot-screen work: less JS, defer non-critical code, virtualize large lists.
2. Cut network cost: fewer requests, smaller payloads, stronger caching, less refetching.
3. Cut repeated expensive work: cache derived data, precompute where possible, move heavy work off the main thread.

Those are the best blind bets, not guarantees.
```

