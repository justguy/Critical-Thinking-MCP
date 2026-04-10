# S14 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Architecture`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/opus_high/B.stderr.log`

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
Your five requirements are in genuine tension. You cannot fully maximize all of them simultaneously — but you can get close by accepting one honest tradeoff.

## Recommended architecture: Managed monolith

**Compute:** Cloud Run (GCP), ECS Fargate (AWS), or Azure Container Apps — autoscaling, zero server management, pay-per-use.

**Database:** Managed PostgreSQL with multi-AZ failover (Cloud SQL, RDS, or Azure Database for PostgreSQL). This is the linchpin: PostgreSQL gives you ACID transactions and strong consistency out of the box, multi-AZ gives you HA with automatic failover (typically under 30 seconds), and the managed service eliminates patching, backups, and replication setup.

**Application:** A single deployable unit (monolith) in your team's strongest language. One repo, one CI pipeline, one deployment target.

## Why this wins on your criteria

| Requirement | How it's met |
|---|---|
| **High availability** | Multi-AZ database + autoscaling stateless compute. Typical SLA: 99.95%+ |
| **Strong consistency** | PostgreSQL serializable isolation. No eventual-consistency surprises |
| **Low cost** | Fargate/Cloud Run: ~$30-150/mo at moderate load. Managed Postgres: ~$50-200/mo for db.t3/t4 class. No idle K8s clusters |
| **Low ops burden** | Zero servers to patch. Managed backups, failover, scaling. CI/CD is one container push |
| **Junior-friendly** | SQL is universally taught. One codebase, no service mesh, no distributed tracing needed. `git push` deploys |

## The honest tradeoff

This architecture has a scaling ceiling. Somewhere around 10,000-50,000 requests/second sustained, you will need to either shard the database, add read replicas, or decompose into services. But the vast majority of new services never reach this threshold, and if you do reach it, you will have the revenue and team size to justify the migration.

## What to avoid

- **Microservices from day one:** Multiplies operational surface by the number of services. Juniors spend more time debugging network calls than writing features.
- **Kubernetes:** Powerful but heavy. K8s operational knowledge is a specialty in itself — not junior-friendly, not low-ops.
- **DynamoDB/NoSQL for relational data:** You lose strong consistency guarantees across items, and single-table design patterns are notoriously hard to learn and maintain.
- **Serverless-only (Lambda everywhere):** Cold starts, 15-minute execution limits, and function sprawl create hidden operational burden.

Start simple. Migrate to complexity only when measured load demands it.
```

