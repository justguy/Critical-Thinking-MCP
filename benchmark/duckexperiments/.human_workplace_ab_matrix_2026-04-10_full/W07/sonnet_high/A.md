# W07 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W07/sonnet_high/A.stderr.log`

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
## Membership Program Launch Plan — Next Month

### This Week: Unblock in Parallel

| Workstream | Owner | Action |
|---|---|---|
| Pricing | Finance lead | Schedule sign-off meeting; circulate 2–3 pricing options with rationale by EOD tomorrow |
| Legal | Counsel | Kick off review of terms, cancellation policy, auto-renewal disclosures — flag any showstoppers by day 5 |
| Billing | Engineering | Audit edge cases: failed renewals, mid-cycle upgrades/downgrades, proration, refunds — document expected behavior |
| Support | Support lead | Begin drafting FAQ and internal runbook; training can happen once billing logic is locked |

### Week 2: Build While Approvals Close

- Finalize copy, pricing page, and member onboarding flow (use placeholder pricing if sign-off is still pending)
- QA billing flows against documented edge cases
- Complete support training as soon as billing edge cases are resolved
- Run internal soft-launch (employees/volunteers) to catch gaps

### Week 3: Staged Rollout

- Legal and pricing **must** be signed off before this gate
- Release to waitlist or limited segment (5–10%)
- Monitor: activation rate, payment failures, support ticket volume
- Hold a 48-hour checkpoint before expanding

### Week 4: Full Launch

- Open to all users
- Publish announcement, activate any referral/promo mechanics
- Daily monitoring for first 7 days post-launch

---

**Critical path:** Legal and billing edge cases are your longest poles. If legal review isn't started by day 3, the launch date is at risk. Everything else can build in parallel.

**What to do right now:** Send a "launch in 30 days" brief to all four workstream owners today so urgency is real and no one treats this as eventual.
```

