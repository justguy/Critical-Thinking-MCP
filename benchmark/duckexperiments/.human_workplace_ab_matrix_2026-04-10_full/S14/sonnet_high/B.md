# S14 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Architecture`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Recommend an architecture for our new service that is highly available, strongly consistent, low cost, low operational burden, and easy for junior engineers to maintain.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: evaluate_tradeoffs.
- Secondary designated tool: score_response_quality.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S14
Prompt category: Architecture

Prompt:
Recommend an architecture for our new service that is highly available, strongly consistent, low cost, low operational burden, and easy for junior engineers to maintain.
```

## Response

```text
**The requirements conflict — name it first**

"Highly available + strongly consistent + low cost" are in inherent tension. Synchronous replication (required for strong consistency across failures) costs money and adds latency. You can optimize for 3–4 of these properties cheaply; all 5 simultaneously requires accepting explicit tradeoffs.

---

**Recommended: Managed cloud-native stack**

| Layer | Choice | Why |
|---|---|---|
| Database | RDS PostgreSQL, Multi-AZ | ACID consistency, automated failover (~30s RTO), no DBA overhead |
| App tier | ECS Fargate (2+ tasks, multi-AZ) | No cluster management, auto-scaling, junior-friendly deploys |
| Load balancer | ALB with health checks | Automatic traffic cutover on instance failure |
| Secrets | AWS Secrets Manager | Managed rotation, no custom tooling |
| Observability | CloudWatch + RDS Performance Insights | Zero setup, sufficient signal for junior engineers |

---

**What you give up**

- **Cost**: Managed services carry a 20–40% premium over self-managed at equivalent specs. Multi-AZ RDS roughly doubles the DB line-item cost.
- **HA ceiling**: RDS Multi-AZ failover takes ~30 seconds. If your SLA requires <10s RTO, upgrade to Aurora Postgres — automated failover is ~15–20s, and the cluster handles read scaling — at higher cost.
- **Tuning**: Custom Postgres extensions and kernel parameters are not available without self-managed hosting.

---

**The one decision to make now**

If "highly available" means 99.99%+ with <30s RTO, budget for **Aurora Postgres Multi-AZ** instead of standard RDS. If 99.95% (standard RDS SLA) is acceptable, standard RDS Multi-AZ is cheaper and simpler — and the right default.

---

**What to avoid**

Self-managed Kubernetes + distributed DB (CockroachDB/Vitess) optimizes for raw compute cost while destroying every other goal: high operational burden, steep junior learning curve, and frequent incidents that erase the compute savings.
```

