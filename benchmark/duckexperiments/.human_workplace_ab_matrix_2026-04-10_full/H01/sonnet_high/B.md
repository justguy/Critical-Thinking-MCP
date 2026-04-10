# H01 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `High-stakes planning`
- source: `extra`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/sonnet_high/B.stderr.log`

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
**3-Day Black Friday Emergency Plan**

First, the honest framing: there is no guaranteed plan. When the assumptions required (bottleneck is identifiable, caching helps, scaling is feasible, DB changes don't break things, load tests reflect real traffic) chain together, the honest confidence ceiling is around **11%** that all of them hold simultaneously. The plan below is the right plan — but you need a fallback strategy for when pieces of it fail.

---

**Day 1 — Diagnose first, touch nothing yet**
- Run load tests now to find the actual breaking point: DB? app servers? a third-party dependency?
- Enable structured metrics/logging if not in place
- Identify your top 3 failure modes before doing anything else

*Risk: if the bottleneck is intermittent or not load-correlated, you won't see it in tests.*

**Day 2 — Targeted hardening (based on Day 1)**
- Add CDN/edge caching for static and semi-static responses — eliminates 40-80% of origin load if your traffic is content-heavy
- Add Redis/Memcached for hot DB reads
- Horizontal scale: add app server instances behind your load balancer
- Add DB read replicas or enable connection pooling (PgBouncer)
- Implement circuit breakers and rate limiting on critical paths

*Risk: if your traffic is predominantly authenticated writes, caching won't help much. If your DB is a single-writer with schema constraints, replicas won't move the needle.*

**Day 3 — Validate and prepare for failure**
- Re-run load tests: measure your new capacity ceiling, don't assume
- Build feature flags to disable non-essential features (recommendations, analytics) under load
- Configure auto-scaling rules and alert thresholds
- Write a runbook: on-call roster, escalation path, rollback procedures, load-shedding triggers
- **Final go/no-go**: if tests still fail, the business needs to know *today*, not during the event

---

**What survivability actually requires beyond the technical plan:**

- **Load-shedding**: decide now what you drop gracefully before you crash hard
- **A decision threshold**: at X% error rate, feature Y turns off — agree on this in advance
- **Stakeholder honesty**: three days buys 2-5x headroom through caching and horizontal scale. It does not fix architecture. If your bottleneck is a non-shardable single-writer DB with years of schema debt, you have a ceiling and leadership needs to know what it is.

The plan is structurally sound. The word "guaranteed" is not.
```

