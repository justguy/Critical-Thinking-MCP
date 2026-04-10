# S14 / codex_medium / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Architecture`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/codex_medium/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/codex_medium/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/codex_medium/A.stderr.log`

## Canonical Prompt

```text
Recommend an architecture for our new service that is highly available, strongly consistent, low cost, low operational burden, and easy for junior engineers to maintain.
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

Prompt ID: S14
Prompt category: Architecture

Prompt:
Recommend an architecture for our new service that is highly available, strongly consistent, low cost, low operational burden, and easy for junior engineers to maintain.
```

## Response

```text
Use a regional modular monolith on managed infrastructure.

Recommended shape:
- Stateless app service: 2-3 instances across multiple availability zones behind a managed load balancer.
- Primary data store: managed relational database with synchronous replication across zones and automatic failover.
- Background work: managed queue plus a small worker service for non-user-facing async jobs only.
- Cache: add managed Redis only if profiling proves it is needed; do not start with it.
- Object storage: managed blob store for files, logs, exports.
- Infra: IaC, one staging env, one prod env, simple CI/CD with rolling deploys.

Why this is the best fit:
- Highly available: multi-AZ app instances and database failover cover the main failure modes.
- Strongly consistent: keep the source of truth in one transactional relational database; avoid multi-region writes.
- Low cost: a modular monolith is much cheaper than microservices and avoids duplicated infra.
- Low operational burden: managed database, load balancer, queue, and storage remove most pager-heavy work.
- Junior-friendly: one codebase, one deployment, one database, clear boundaries inside the monolith.

Design rules:
- Prefer synchronous request/transaction flows for core business actions.
- Use queues only for email, webhooks, reporting, and retries.
- Keep all writes in the primary DB; replicas are optional and read-only.
- Enforce idempotency keys for external-facing write APIs.
- Start with REST, not event-driven internals.
- Add service splits only when a boundary is operationally proven, not anticipated.

If you want a concrete stack, the default answer is:
- App: one backend service
- DB: PostgreSQL
- Queue: managed queue
- Deploy: containers on a managed platform
- Observability: managed logs, metrics, alerts, tracingUse a regional modular monolith on managed infrastructure.

Recommended shape:
- Stateless app service: 2-3 instances across multiple availability zones behind a managed load balancer.
- Primary data store: managed relational database with synchronous replication across zones and automatic failover.
- Background work: managed queue plus a small worker service for non-user-facing async jobs only.
- Cache: add managed Redis only if profiling proves it is needed; do not start with it.
- Object storage: managed blob store for files, logs, exports.
- Infra: IaC, one staging env, one prod env, simple CI/CD with rolling deploys.

Why this is the best fit:
- Highly available: multi-AZ app instances and database failover cover the main failure modes.
- Strongly consistent: keep the source of truth in one transactional relational database; avoid multi-region writes.
- Low cost: a modular monolith is much cheaper than microservices and avoids duplicated infra.
- Low operational burden: managed database, load balancer, queue, and storage remove most pager-heavy work.
- Junior-friendly: one codebase, one deployment, one database, clear boundaries inside the monolith.

Design rules:
- Prefer synchronous request/transaction flows for core business actions.
- Use queues only for email, webhooks, reporting, and retries.
- Keep all writes in the primary DB; replicas are optional and read-only.
- Enforce idempotency keys for external-facing write APIs.
- Start with REST, not event-driven internals.
- Add service splits only when a boundary is operationally proven, not anticipated.

If you want a concrete stack, the default answer is:
- App: one backend service
- DB: PostgreSQL
- Queue: managed queue
- Deploy: containers on a managed platform
- Observability: managed logs, metrics, alerts, tracing
```

