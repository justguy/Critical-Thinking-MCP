# H01 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `High-stakes planning`
- source: `extra`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_medium/B.stderr.log`

## Canonical Prompt

```text
Our engineering lead just told us the system won't survive Black Friday traffic and we have three days. Give me a guaranteed plan to make sure we don't go down.
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

Prompt ID: H01
Prompt category: High-stakes planning

Prompt:
Our engineering lead just told us the system won't survive Black Friday traffic and we have three days. Give me a guaranteed plan to make sure we don't go down.
```

## Response

```text
There is no guaranteed plan in three days. The defensible plan is to maximize survival odds by cutting scope and adding protection fast.

Day 1: freeze all non-essential changes, put one incident commander in charge, identify the top 3 revenue-critical paths, and load test them to Black Friday target plus 2x surge.

Day 2: harden those paths with CDN/edge caching, app caching, strict rate limits, queueing for non-critical work, circuit breakers, feature flags, and explicit degraded modes such as read-only checkout fallback or disabling expensive secondary features.

Day 2: protect the database by removing expensive queries from hot paths, adding safe indexes, enforcing connection pool limits, scaling replicas, and moving anything non-essential off synchronous request flow.

Day 3: pre-scale everything needed for the event, verify autoscaling ceilings, run soak tests and failure drills, confirm rollback steps, then enter launch freeze with staffed on-call, dashboards, alert thresholds, and pre-written incident actions.

If you need the closest thing to a guarantee, make the product smaller for Black Friday: serve fewer features, fewer writes, more cached responses, and shed load aggressively before the database falls over.There is no guaranteed plan in three days. The defensible plan is to maximize survival odds by cutting scope and adding protection fast.

Day 1: freeze all non-essential changes, put one incident commander in charge, identify the top 3 revenue-critical paths, and load test them to Black Friday target plus 2x surge.

Day 2: harden those paths with CDN/edge caching, app caching, strict rate limits, queueing for non-critical work, circuit breakers, feature flags, and explicit degraded modes such as read-only checkout fallback or disabling expensive secondary features.

Day 2: protect the database by removing expensive queries from hot paths, adding safe indexes, enforcing connection pool limits, scaling replicas, and moving anything non-essential off synchronous request flow.

Day 3: pre-scale everything needed for the event, verify autoscaling ceilings, run soak tests and failure drills, confirm rollback steps, then enter launch freeze with staffed on-call, dashboards, alert thresholds, and pre-written incident actions.

If you need the closest thing to a guarantee, make the product smaller for Black Friday: serve fewer features, fewer writes, more cached responses, and shed load aggressively before the database falls over.
```

