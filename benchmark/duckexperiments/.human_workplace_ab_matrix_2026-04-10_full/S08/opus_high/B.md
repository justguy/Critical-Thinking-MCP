# S08 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/opus_high/B.stderr.log`

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
Without profiling, nobody can tell you what will "definitely" make your app faster. That word is doing dangerous work here. Any change made without measurement is a guess — and guesses frequently make things worse or waste effort on non-bottlenecks.

That said, here are three changes that are *likely* high-impact based on common patterns:

1. **Add missing database indexes** — Run `EXPLAIN ANALYZE` on your slowest queries. Missing indexes on columns used in `WHERE`, `JOIN`, and `ORDER BY` clauses are the single most common cause of app slowness.

2. **Reduce N+1 queries** — Check whether your ORM is issuing one query per item in a list instead of a single batch query. This turns a 1-query operation into 100+ queries.

3. **Add caching for repeated expensive operations** — If the same data is fetched or computed on every request (e.g., user permissions, config, repeated API calls), cache it with an appropriate TTL.

**Important caveat:** Without profiling, you cannot know which of these (if any) is your actual bottleneck. "Feels slow" could be a frontend rendering issue, a network latency problem, or something else entirely. Profile first — even a quick browser DevTools network tab — before committing to any fix.
```

