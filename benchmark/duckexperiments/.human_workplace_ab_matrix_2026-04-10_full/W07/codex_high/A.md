# W07 / codex_high / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/codex_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/codex_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/codex_high/A.stderr.log`

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
Assume target launch is **May 2026**. Run this as a 4-week plan with parallel tracks and hard decision dates.

**Week 1: create momentum now**
- Name a single launch owner and daily 15-minute standup across Product, Finance, Legal, Eng, Support, Marketing.
- Freeze the core offer draft: benefits, eligibility, renewal rules, cancellation policy, trial/refund stance.
- Set a **pricing sign-off deadline by end of Week 1**. If not approved, use a pre-agreed fallback price.
- Open legal review immediately with a tight packet: offer summary, terms changes, billing flows, renewal/cancellation language.
- Engineering starts a **billing edge-case matrix**: failed payment, card update, upgrade/downgrade, prorations, refunds, duplicate charges, tax, grace period, cancellation at renewal, reactivation.
- Launch a waitlist or “coming soon” page to start demand capture without full launch risk.

**Week 2: operational readiness**
- Finish billing handling for highest-risk cases first and add manual support/admin fallback for anything not automated.
- Draft support macros, internal FAQ, escalation paths, and goodwill/refund rules.
- Marketing prepares launch assets, lifecycle emails, landing page, and in-product placement, but holds publish until go/no-go.
- Finance, Legal, and Product review final economics, terms, and customer promises together.

**Week 3: controlled rollout prep**
- Run internal dogfood plus a small beta cohort.
- Train support with real scenarios from the billing matrix and beta feedback.
- Validate reporting: signups, conversion, churn/cancel, failed payments, refund rate, support ticket volume.
- Hold a **go/no-go review at end of Week 3**.

**Week 4: launch**
- Soft launch first for 10-20% of traffic or a limited segment for 2-3 days.
- If billing errors, ticket volume, and refund rate stay within threshold, expand to full launch.
- Keep a daily launch war room for the first week.

**Non-negotiable gates before full launch**
- Pricing signed off
- Legal approved terms and customer-facing copy
- Support trained with macros and escalation rules
- Billing edge cases either automated or covered by a manual process

**To get momentum immediately today**
1. Set owners and deadlines.
2. Send legal the review packet.
3. Force pricing decision by Week 1.
4. Start the billing edge-case matrix.
5. Publish a waitlist/teaser page.Assume target launch is **May 2026**. Run this as a 4-week plan with parallel tracks and hard decision dates.

**Week 1: create momentum now**
- Name a single launch owner and daily 15-minute standup across Product, Finance, Legal, Eng, Support, Marketing.
- Freeze the core offer draft: benefits, eligibility, renewal rules, cancellation policy, trial/refund stance.
- Set a **pricing sign-off deadline by end of Week 1**. If not approved, use a pre-agreed fallback price.
- Open legal review immediately with a tight packet: offer summary, terms changes, billing flows, renewal/cancellation language.
- Engineering starts a **billing edge-case matrix**: failed payment, card update, upgrade/downgrade, prorations, refunds, duplicate charges, tax, grace period, cancellation at renewal, reactivation.
- Launch a waitlist or “coming soon” page to start demand capture without full launch risk.

**Week 2: operational readiness**
- Finish billing handling for highest-risk cases first and add manual support/admin fallback for anything not automated.
- Draft support macros, internal FAQ, escalation paths, and goodwill/refund rules.
- Marketing prepares launch assets, lifecycle emails, landing page, and in-product placement, but holds publish until go/no-go.
- Finance, Legal, and Product review final economics, terms, and customer promises together.

**Week 3: controlled rollout prep**
- Run internal dogfood plus a small beta cohort.
- Train support with real scenarios from the billing matrix and beta feedback.
- Validate reporting: signups, conversion, churn/cancel, failed payments, refund rate, support ticket volume.
- Hold a **go/no-go review at end of Week 3**.

**Week 4: launch**
- Soft launch first for 10-20% of traffic or a limited segment for 2-3 days.
- If billing errors, ticket volume, and refund rate stay within threshold, expand to full launch.
- Keep a daily launch war room for the first week.

**Non-negotiable gates before full launch**
- Pricing signed off
- Legal approved terms and customer-facing copy
- Support trained with macros and escalation rules
- Billing edge cases either automated or covered by a manual process

**To get momentum immediately today**
1. Set owners and deadlines.
2. Send legal the review packet.
3. Force pricing decision by Week 1.
4. Start the billing edge-case matrix.
5. Publish a waitlist/teaser page.
```

