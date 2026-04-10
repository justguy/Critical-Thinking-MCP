# S08 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/sonnet_high/B.stderr.log`

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
**"Definitely" isn't achievable without profiling** — the honest confidence ceiling on any universal fix is ~13% given the number of ways each assumption can be wrong. That said, here are the three highest-probability wins:

1. **Add database indexes** on columns used in `WHERE`, `JOIN`, and `ORDER BY` clauses. Missing indexes are the single most common cause of unexplained slowness.

2. **Cache frequently-read, rarely-changed data** (Redis, in-memory, HTTP cache headers). Eliminates redundant DB/API round-trips.

3. **Move blocking I/O off the hot path** — file reads, external API calls, emails — to async handlers or background queues. Keeps request latency from being held hostage by slow dependencies.

These address the most statistically common bottlenecks. Any one of them may be irrelevant to your specific app. Profile before committing engineering time.
```

