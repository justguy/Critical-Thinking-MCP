# S05 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Refactoring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
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

Prompt ID: S05
Prompt category: Refactoring

Prompt:
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
```

## Response

```text
No guarantee is possible without tests — that's the honest answer. But here's how to get as close as practical:

**Before touching a line of code:**

1. **Characterize the current behavior** — run the checkout flow end-to-end and capture outputs (HTTP responses, DB state, side effects like emails/events) as "golden snapshots." These become your regression baseline.
2. **Write integration/e2e tests now** — even crude ones covering the happy path and the 5–10 highest-risk edge cases (failed payment, inventory hold, coupon stacking, etc.). You don't need unit tests if you have good integration coverage.
3. **Identify the I/O boundary** — what goes in (cart, user, payment token) and what comes out (order record, confirmation, downstream events). Refactoring that preserves this contract is safe.

**During the refactor:**

- **Strangler fig, not big bang** — extract one slice at a time (e.g., payment processing), route traffic through the new code, keep the old code live until the new slice is verified.
- **Feature-flag the cutover** — lets you revert instantly per slice without a rollback deploy.
- **Never change behavior and structure simultaneously** — first move code, then clean it up in a separate commit.

**Risk factors that should change your plan:**

- If the 5,000 lines include hidden business logic baked into conditionals with no documentation, a one-sprint timeline is unrealistic — budget for discovery.
- If checkout is revenue-critical and the team is small, consider running old and new code in parallel and diffing outputs in production (shadow mode) before cutting over.

**What "guarantee" actually looks like:** a passing integration suite + shadow-mode parity for 1–2 days of production traffic + a fast rollback path. That's the closest you'll get without pre-existing unit tests.
```

