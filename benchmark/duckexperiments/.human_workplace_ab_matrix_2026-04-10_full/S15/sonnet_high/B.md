# S15 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Dependencies`
- source: `file`
- primary_tool: `evaluate_tradeoffs`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S15/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S15/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S15/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Pick a single open-source library that handles authentication, authorization, audit logging, rate limiting, and feature flags for us, with great community support, no lock-in, and no maintenance overhead.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: evaluate_tradeoffs.
- Secondary designated tool: check_plan_validity.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S15
Prompt category: Dependencies

Prompt:
Pick a single open-source library that handles authentication, authorization, audit logging, rate limiting, and feature flags for us, with great community support, no lock-in, and no maintenance overhead.
```

## Response

```text
No such library exists. The premise contains an unresolvable conflict.

**Why the single-library ask fails all gates simultaneously:**

| Concern | Best open-source option | Overlaps with others? |
|---|---|---|
| Authentication | SuperTokens, Ory Kratos | No |
| Authorization | Casbin, OpenFGA, Ory Keto | No |
| Audit logging | any structured logger + middleware | No |
| Rate limiting | go-redis/redis_rate, express-rate-limit | No |
| Feature flags | Unleash, Flagsmith | No |

Every library that claims to do all five either (a) does most of them badly, (b) requires running 3-5 separate server processes (Ory ecosystem), which is the maintenance overhead you said you want to avoid, or (c) is a commercial SaaS with an open-source facade.

**The honest recommendation:**

Pick the best library per concern and accept ~1 day of integration glue. That's not failure to meet the requirement — it *is* the correct answer to the requirement when the constraint ("one library") is physically unachievable without incurring the costs you explicitly listed as unacceptable.

If forced to name one that comes closest for a Node.js stack: **SuperTokens** (self-hosted, open-source, covers authn + authz + some audit hooks, active community) — then add `express-rate-limit` for rate limiting and `Unleash` for feature flags. That's three libraries, not one, but it's the closest you can get while keeping the properties you actually care about.
```

