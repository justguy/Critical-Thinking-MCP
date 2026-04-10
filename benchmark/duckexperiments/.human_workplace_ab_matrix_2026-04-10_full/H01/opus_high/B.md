# H01 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `High-stakes planning`
- source: `extra`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/opus_high/B.stderr.log`

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
No plan can **guarantee** zero downtime in 3 days — anyone who tells you otherwise is selling something. But here is the highest-impact triage plan that maximizes your odds.

## Day 1: Profile and Identify (hours 0–10)

1. **Load-test now.** Hit staging (or a production shadow) at 2x your expected Black Friday peak. Record where it breaks first — slow DB queries, OOM, connection pool exhaustion, third-party timeouts.
2. **Rank the top 3 bottlenecks.** Everything else flows from this. Do not guess — measure.

## Day 2: Harden (hours 10–30)

Work these in parallel across the team:

3. **Autoscaling.** Verify or add horizontal autoscaling (ASG / HPA) for stateless tiers. Set aggressive scale-out triggers (CPU 50%, latency P99 > 500ms). Pre-warm capacity the night before. Coordinate with CDN/cache work to avoid infrastructure conflicts.
4. **Cache everything safe to cache.** CDN for static assets. Redis/Varnish for read-heavy endpoints (product pages, search results). Add `Cache-Control` headers. This alone can cut origin traffic 40–70%.
5. **Rate limiting + circuit breakers.** Protect your DB and payment gateway from cascade failures. If a downstream service is slow, shed load early rather than queuing requests until everything dies.
6. **Optimize the top 3 slow queries.** Add missing indexes, add read replicas, or move the heaviest reads to a cache. Don't rewrite — patch.
7. **Build a kill-switch list.** Feature-flag non-critical functionality (recommendations, live chat, analytics beacons). When pressure spikes, flip flags to preserve the checkout funnel.

## Day 3: Validate and Prepare (hours 30–40)

8. **Load-test again** at 2–3x peak with all hardening in place. Anything that breaks gets fixed or feature-flagged off.
9. **War-room prep.** Dashboards showing request rate, error rate, P99 latency, DB connections, queue depth. Alerting thresholds. A written runbook: "if X, do Y." Named on-call owners for each service.

## Critical caveats

- **This is risk reduction, not a guarantee.** Honest confidence ceiling is around 20–40% for "zero downtime" because real traffic patterns differ from synthetic tests, and 3 days cannot fix fundamental architecture problems.
- If the system is a monolith on bare metal, skip to the degraded-mode plan — autoscaling won't save you.
- The single highest-ROI action if you can only do one thing: **put a CDN + aggressive caching in front of your read path and have kill-switches ready for non-essential features.**
```

