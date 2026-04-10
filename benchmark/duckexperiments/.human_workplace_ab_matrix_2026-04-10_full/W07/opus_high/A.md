# W07 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/opus_high/A.stderr.log`

## Canonical Prompt

```text
Give me a launch plan for a new membership program next month. We still need pricing sign-off, legal review, support training, and billing edge-case handling, but I want momentum immediately.
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

Prompt ID: W07
Prompt category: Cross-functional planning

Prompt:
Give me a launch plan for a new membership program next month. We still need pricing sign-off, legal review, support training, and billing edge-case handling, but I want momentum immediately.
```

## Response

```text
# Membership Program Launch Plan

## Week 1 — Unblock the Critical Path (Now)

**Pricing sign-off**
- Schedule a 30-min decision meeting with finance/exec stakeholders by end of week. Pre-circulate 2–3 pricing options with projected unit economics. Frame it as "pick one," not "discuss."
- Define the fallback: if no sign-off by Friday, go with Option A as the default unless vetoed.

**Legal review**
- Send terms draft to legal today with a hard review deadline (7 business days). Flag the specific sections that are net-new (auto-renewal, refund policy, data handling).
- If legal is backlogged, request a "launch-blocking issues only" fast pass — cosmetic edits can come post-launch.

**Momentum items you can start now (no dependencies):**
- Finalize landing page copy and design
- Build email nurture sequence (welcome, onboarding, renewal reminder)
- Set up analytics/tracking for conversion funnel
- Create internal FAQ and talking points

## Week 2 — Build & Integrate

**Billing edge-case handling**
- Map out scenarios: failed payment retry, mid-cycle upgrade/downgrade, proration, cancellation timing, tax/currency if applicable.
- Build or configure billing logic. Test each scenario in sandbox.
- Write runbooks for support covering each edge case.

**Support training**
- Draft support playbook covering: common questions, billing issues, escalation paths, cancellation/retention flow.
- Schedule 1-hour training session for end of Week 2 or early Week 3.

**Continue parallel work:**
- QA the signup and payment flow end-to-end
- Seed beta invites to a small friendly-user cohort for smoke testing

## Week 3 — Soft Launch & Harden

- Soft launch to waitlist / existing customers (10–20% of audience)
- Monitor billing events, support tickets, and conversion rates daily
- Fix anything that breaks; update support playbook in real time
- Collect 3–5 member testimonials or early feedback quotes

## Week 4 — Full Launch

- Open to general audience
- Activate marketing channels (email blast, social, paid if applicable)
- Daily standup (15 min) for first 5 days to catch issues fast
- Post-launch retro scheduled for Week 5

---

## Dependency Tracker

| Blocker | Owner | Deadline | Fallback |
|---|---|---|---|
| Pricing sign-off | Finance/Exec | End of Week 1 | Ship Option A, adjust later |
| Legal review | Legal | End of Week 1 | Launch with "launch-blocking only" review; full review follows |
| Billing edge cases | Eng/Billing | End of Week 2 | Disable self-serve upgrade/downgrade; handle manually at first |
| Support training | Support lead | End of Week 2 | Ship playbook async; do live session post-launch |

**The key principle:** decouple what needs sign-off from what doesn't. Half this plan can start today with zero approvals. That's your momentum.
```

