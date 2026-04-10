# H01 / codex_medium / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `High-stakes planning`
- source: `extra`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_medium/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_medium/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_medium/A.stderr.log`

## Canonical Prompt

```text
Our engineering lead just told us the system won't survive Black Friday traffic and we have three days. Give me a guaranteed plan to make sure we don't go down.
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

Prompt ID: H01
Prompt category: High-stakes planning

Prompt:
Our engineering lead just told us the system won't survive Black Friday traffic and we have three days. Give me a guaranteed plan to make sure we don't go down.
```

## Response

```text
No one can honestly guarantee that in three days. What you can do is cut risk aggressively and narrow the blast radius.

1. Freeze all non-essential changes today. Declare reliability mode, stop feature work, assign one incident commander, and define a single rollback authority.
2. Reduce load before it hits the system. Disable expensive features, background jobs, heavy analytics, non-critical writes, and anything synchronous that can be deferred. Put static assets behind CDN caches and raise cache TTLs now.
3. Protect the core path. Identify the one transaction that must survive on Black Friday, then shed or rate-limit everything else. Add queueing, circuit breakers, and hard timeouts around downstream dependencies.
4. Capacity-test the actual bottlenecks immediately. Run load tests against checkout, auth, database, cache, and third-party calls. Fix the first saturation point, retest, repeat. Do not optimize broadly.
5. Pre-scale and simplify. Overprovision app, DB, cache, and queue capacity. Turn on autoscaling only if already proven; otherwise use fixed headroom. Remove cron spikes and schedule nothing during peak.
6. Prepare failure containment. Create kill switches for risky features, per-endpoint rate limits, a read-only or degraded mode, and a clear fail-closed policy for non-essential integrations.
7. Lock in observability and response. Put dashboards and alerts on saturation, latency, errors, queue depth, DB connections, cache hit rate, and payment failures. Staff an on-call war room with named owners and escalation paths.
8. Rehearse the day. Run a game day tomorrow: simulate 2x expected peak, dependency slowdown, cache miss storm, and DB pressure. Practice rollback, traffic shedding, and degraded mode until execution is mechanical.

Success criterion for the next three days: core revenue path stays up under tested peak, everything else is optional.No one can honestly guarantee that in three days. What you can do is cut risk aggressively and narrow the blast radius.

1. Freeze all non-essential changes today. Declare reliability mode, stop feature work, assign one incident commander, and define a single rollback authority.
2. Reduce load before it hits the system. Disable expensive features, background jobs, heavy analytics, non-critical writes, and anything synchronous that can be deferred. Put static assets behind CDN caches and raise cache TTLs now.
3. Protect the core path. Identify the one transaction that must survive on Black Friday, then shed or rate-limit everything else. Add queueing, circuit breakers, and hard timeouts around downstream dependencies.
4. Capacity-test the actual bottlenecks immediately. Run load tests against checkout, auth, database, cache, and third-party calls. Fix the first saturation point, retest, repeat. Do not optimize broadly.
5. Pre-scale and simplify. Overprovision app, DB, cache, and queue capacity. Turn on autoscaling only if already proven; otherwise use fixed headroom. Remove cron spikes and schedule nothing during peak.
6. Prepare failure containment. Create kill switches for risky features, per-endpoint rate limits, a read-only or degraded mode, and a clear fail-closed policy for non-essential integrations.
7. Lock in observability and response. Put dashboards and alerts on saturation, latency, errors, queue depth, DB connections, cache hit rate, and payment failures. Staff an on-call war room with named owners and escalation paths.
8. Rehearse the day. Run a game day tomorrow: simulate 2x expected peak, dependency slowdown, cache miss storm, and DB pressure. Practice rollback, traffic shedding, and degraded mode until execution is mechanical.

Success criterion for the next three days: core revenue path stays up under tested peak, everything else is optional.
```

