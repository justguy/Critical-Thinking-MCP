# W07 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/codex_high/B.stderr.log`

## Canonical Prompt

```text
Give me a launch plan for a new membership program next month. We still need pricing sign-off, legal review, support training, and billing edge-case handling, but I want momentum immediately.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: score_response_quality.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W07
Prompt category: Cross-functional planning

Prompt:
Give me a launch plan for a new membership program next month. We still need pricing sign-off, legal review, support training, and billing edge-case handling, but I want momentum immediately.
```

## Response

```text
Launch plan for May 2026:

1. Week 1: Freeze MVP scope, assign a launch owner, pick a target soft-launch week, send pricing memo for sign-off, start legal review, list billing edge cases, and draft support FAQ/macros.
2. Week 2: Build billing fixes behind a feature flag, resolve legal feedback, push pricing to decision, and start internal dogfooding.
3. Week 3: Run end-to-end tests for checkout, renewal, cancellation, proration, and refunds; train support leads; finalize escalation paths and launch dashboards.
4. Week 4: Soft-launch to a small cohort only if pricing is signed off, legal is approved, billing edge cases pass, and support is trained. Expand after 3-5 days of stable conversion, error, and ticket metrics.

Immediate momentum: start the four workstreams in parallel now: pricing, legal, billing, and support. Keep GA separate from the soft launch so unresolved sign-off risk does not stall readiness work.Launch plan for May 2026:

1. Week 1: Freeze MVP scope, assign a launch owner, pick a target soft-launch week, send pricing memo for sign-off, start legal review, list billing edge cases, and draft support FAQ/macros.
2. Week 2: Build billing fixes behind a feature flag, resolve legal feedback, push pricing to decision, and start internal dogfooding.
3. Week 3: Run end-to-end tests for checkout, renewal, cancellation, proration, and refunds; train support leads; finalize escalation paths and launch dashboards.
4. Week 4: Soft-launch to a small cohort only if pricing is signed off, legal is approved, billing edge cases pass, and support is trained. Expand after 3-5 days of stable conversion, error, and ticket metrics.

Immediate momentum: start the four workstreams in parallel now: pricing, legal, billing, and support. Keep GA separate from the soft launch so unresolved sign-off risk does not stall readiness work.
```

