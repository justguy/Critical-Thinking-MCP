# W07 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/opus_high/B.stderr.log`

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
Here is a 14-step launch plan that unblocks parallel work immediately while gating launch on the four outstanding items.

## Critical path (longest sequential chain)

**DRI appointment → Pricing sign-off → Finalize tiers → Billing edge-case resolution → Staging E2E test → Go/no-go → Launch**

Target: pricing sign-off by May 5, legal review by May 7, go/no-go by May 23, launch by May 26.

## Week 1 — Start now (all parallel)

| # | Action | Owner | Deadline |
|---|--------|-------|----------|
| S1 | Appoint a launch DRI; create shared tracker with all workstreams, owners, hard deadlines | PM | Day 1 |
| S2 | Submit pricing proposal to finance/exec; set hard decision deadline of **May 5** | Finance / Exec | May 5 |
| S3 | Send legal the membership terms, auto-renewal disclosures, cancellation policy; deadline **May 7** | Legal | May 7 |
| S4 | Engineering catalogs every billing edge case (proration, failed payment retry, mid-cycle upgrade/downgrade, partial refund, tax jurisdiction) and builds a test matrix | Engineering | May 9 |
| S5 | Build membership landing page, signup flow, and account management UI using **placeholder pricing** | Product + Eng | May 12 |
| S6 | Draft all marketing assets — launch email sequence, FAQ, social copy, in-app banners — with placeholder pricing | Marketing | May 12 |

**Why this unblocks momentum**: S2–S6 all run in parallel off S1. Nothing waits for pricing or legal to start.

## Week 2–3 — Converge

| # | Action | Owner | Depends on | Deadline |
|---|--------|-------|------------|----------|
| S7 | Finalize pricing tiers; swap placeholders across landing page, emails, FAQ | Product + Mktg | S2, S5, S6 | May 13 |
| S8 | Incorporate legal feedback into ToS, signup-flow disclosures, and FAQ | Legal + Product | S3, S5 | May 13 |
| S9 | Resolve all billing edge cases from test matrix; pass QA | Engineering | S4, S7 | May 19 |
| S10 | Write support playbook: tiers, billing scenarios, escalation paths, cancellation flows | Support | S7, S8 | May 16 |

## Week 4 — Validate and launch

| # | Action | Owner | Depends on | Deadline |
|---|--------|-------|------------|----------|
| S11 | Live support training sessions + role-play billing edge cases | Support | S9, S10 | May 21 |
| S12 | End-to-end staging test: signup → billing cycle → upgrade → downgrade → cancel → refund | Eng + Product | S8, S9 | May 21 |
| S13 | Go/no-go meeting — requires sign-off from legal, finance, engineering, and support | All leads | S11, S12 | May 23 |
| S14 | Launch: flip feature flag, send emails, publish page, monitor dashboards for 48 hours | Eng + Mktg + Support | S13 | May 26 |

## Key risk mitigations

- **Pricing delay**: Building on placeholder values means a slip in S2 only blocks S7 onward, not weeks 1–2 of build work.
- **Legal delay**: Same pattern — legal feedback merges into an already-built flow at S8.
- **Billing edge cases**: The test matrix (S4) is built before pricing is final because edge-case categories (proration, retry logic, refunds) don't depend on specific dollar amounts.
- **Engineering and product contention**: Eng works S4 (billing matrix) and S5 (UI build) in parallel by splitting into two sub-teams; product similarly splits across S5/S7/S8.

## Definition of "go" at S13

All four must be true:
1. Pricing signed off and live in all surfaces
2. Legal has approved ToS and disclosure language
3. All billing edge cases in the test matrix pass in staging
4. Support team has completed training and has playbook access
```

