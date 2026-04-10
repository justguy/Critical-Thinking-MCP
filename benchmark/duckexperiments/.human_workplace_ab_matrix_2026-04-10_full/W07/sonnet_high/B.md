# W07 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/sonnet_high/B.stderr.log`

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
**Membership Program Launch Plan — 4-Week Roadmap**

**Week 1 — Kickoff & Parallel Starts**
- Assign 1 DRI per open dependency: pricing, legal, engineering, support, marketing
- Submit terms and pricing structures to legal **today** — legal is the critical path (see below)
- Ship waitlist/teaser page and begin pre-launch content — no blocker, start immediately
- Engineering: enumerate all billing edge cases now (upgrades, downgrades, prorations, failed payments, refunds) — implementation waits on pricing, discovery does not
- Support: draft training materials from current product spec; mark all pricing-dependent fields as TBD

**Week 2 — Resolve Blockers**
- Pricing sign-off: target by end of Day 10; this gates billing implementation and training finalization
- Legal: target sign-off by end of Day 14; route any legal questions back same-day to avoid slippage
- Engineering: build test infrastructure and billing scaffolding while awaiting pricing confirmation

**Week 3 — Integration & QA**
- Implement billing logic for all confirmed edge cases
- Finalize support training with locked pricing + legal-approved terms
- Full QA regression on billing (target 0 critical billing bugs before soft launch)
- Internal dog-fooding + limited beta (10–50 users) for activation signal

**Week 4 — Launch**
- **Hard gate:** legal sign-off + pricing confirmed — no exceptions
- Day 1: Soft launch to waitlist/existing users; monitor billing error rate, support volume, activation rate
- Day 3–5: Full launch if soft launch metrics are clean

---

**Critical path:** Kickoff → Legal submission → Legal sign-off → Finalized support training → Soft launch → Full launch

**Risk flags:**
- Legal is the longest chain — submit Week 1, escalate any non-response by Day 7
- Pricing stall past Day 10 delays billing implementation and training — escalate immediately
- Billing edge cases must be enumerated before implementation, not after — start this Week 1
```

