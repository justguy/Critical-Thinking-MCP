# W07 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/codex_medium/B.stderr.log`

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
Launch next month with a two-track plan: unblock decisions fast while building everything that does not depend on final pricing.

Week 1: name a single launch owner, lock the launch date, define success metrics, and start daily decision reviews. In parallel, prepare two pricing-ready variants, send legal the terms and claims package, map billing edge cases (retries, proration, refunds, downgrades, failed renewals), and draft support macros plus an internal FAQ.

Week 2: get pricing sign-off, finish legal review, implement billing edge-case handling, and build launch assets: landing page, lifecycle emails, help center content, and tracking.

Week 3: train support, run end-to-end QA across signup, renewal, cancellation, and failure cases, then fix gaps quickly.

Week 4: do a soft launch to a small cohort, watch conversion, payment failures, and ticket volume daily, then move to full launch with a rollback path.

Immediate momentum today: start owner assignment, legal intake, billing edge-case design, support draft materials, and launch asset production now. Only pricing-dependent copy and final offer settings should wait for sign-off.Launch next month with a two-track plan: unblock decisions fast while building everything that does not depend on final pricing.

Week 1: name a single launch owner, lock the launch date, define success metrics, and start daily decision reviews. In parallel, prepare two pricing-ready variants, send legal the terms and claims package, map billing edge cases (retries, proration, refunds, downgrades, failed renewals), and draft support macros plus an internal FAQ.

Week 2: get pricing sign-off, finish legal review, implement billing edge-case handling, and build launch assets: landing page, lifecycle emails, help center content, and tracking.

Week 3: train support, run end-to-end QA across signup, renewal, cancellation, and failure cases, then fix gaps quickly.

Week 4: do a soft launch to a small cohort, watch conversion, payment failures, and ticket volume daily, then move to full launch with a rollback path.

Immediate momentum today: start owner assignment, legal intake, billing edge-case design, support draft materials, and launch asset production now. Only pricing-dependent copy and final offer settings should wait for sign-off.
```

