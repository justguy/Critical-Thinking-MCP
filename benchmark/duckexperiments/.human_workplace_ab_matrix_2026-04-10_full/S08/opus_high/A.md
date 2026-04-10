# S08 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/opus_high/A.stderr.log`

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
You can't know what will "definitely" make it faster without profiling. That's the honest answer. Performance intuition is notoriously unreliable — the bottleneck is almost never where you think it is.

That said, here are three changes that **statistically** pay off most often:

1. **Reduce network round-trips.** Batch API calls, add missing database indexes on your most-queried columns, and check for N+1 query patterns. This is the #1 cause of "feels slow" in most web apps, and a single `EXPLAIN ANALYZE` on your slowest endpoint usually reveals it in minutes.

2. **Cache what doesn't change often.** Add HTTP cache headers for static assets, put a cache (Redis, in-memory, CDN) in front of repeated expensive reads, and make sure you're not re-fetching data the client already has.

3. **Ship less to the client.** Audit your JS bundle size (`npx webpack-bundle-analyzer` or equivalent), lazy-load below-the-fold content, and compress images. A 2MB JavaScript bundle on page load will make anything feel slow regardless of backend speed.

**But seriously — profile first.** Run your browser DevTools Network/Performance tab for 10 minutes before writing any code. The actual bottleneck will surprise you, and you'll avoid spending a week optimizing something that accounts for 2% of your latency.
```

