# H01 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `High-stakes planning`
- source: `extra`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/sonnet_high/A.stderr.log`

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
No plan is "guaranteed," but here's how to maximize survival odds in 72 hours:

## Day 1: Understand and protect

**Find the bottleneck first** — don't guess.
- Load test against a staging environment at 2x–5x expected peak traffic
- Profile the critical path: database, external APIs, compute
- Identify the single point most likely to fail

**Implement circuit breakers and timeouts** on every external dependency. If a payment provider goes slow, it shouldn't take down your app.

## Day 2: Scale and shed load

**Horizontal scaling** — add instances behind your load balancer. Autoscaling rules should trigger at 50% capacity, not 90%.

**Caching** — aggressively cache anything that doesn't need to be real-time:
- CDN for static assets (if not already)
- Redis/Memcached for database query results, session data, product catalog

**Database** — add read replicas and point read-heavy queries there. Add indexes for the top 3 slowest queries you found in load testing.

**Rate limiting** — cap requests per IP/user to protect against traffic spikes from bots or retry storms.

## Day 3: Reduce blast radius

**Feature flags** — put non-critical features (recommendations, analytics, reviews) behind flags you can disable instantly.

**Graceful degradation** — serve a simplified page if the system is overwhelmed rather than a 500 error.

**Queue writes** — anything that doesn't need to be synchronous (order confirmation emails, inventory updates) should go through a queue.

**Runbook ready** — document the exact steps to scale up, roll back, and disable features. Everyone on-call should have it open before traffic hits.

## The honest caveat

If the architecture has a fundamental flaw (no horizontal scaling path, single-instance database with no replicas), three days is not enough to fix it. In that case, your goal is **load shedding**: let some requests fail gracefully so the core purchase flow stays up. Prioritize checkout over everything else.
```

