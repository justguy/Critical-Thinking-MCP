# W15 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Hiring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Help me hire one person who can own strategy, execution, analytics, sales enablement, customer support, and recruiting, while staying inexpensive and easy to onboard.
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

Prompt ID: W15
Prompt category: Hiring

Prompt:
Help me hire one person who can own strategy, execution, analytics, sales enablement, customer support, and recruiting, while staying inexpensive and easy to onboard.
```

## Response

```text
This combination describes 4-6 distinct roles. No single hire can own all of them well — you'll get someone mediocre at most of them, or burn them out fast.

**What you're actually asking for:**

| Responsibility | Typical role |
|---|---|
| Strategy | Chief of Staff / BizOps Lead |
| Execution | Operations Manager |
| Analytics | Data/Growth Analyst |
| Sales enablement | Revenue Ops / Sales Ops |
| Customer support | CS Lead |
| Recruiting | HR/Talent Generalist |

**The honest options:**

1. **Pick two.** Decide which two are most critical right now and hire for those. Combining strategy + execution (a Chief of Staff) or analytics + sales enablement (a Revenue Ops hire) are natural pairings.

2. **Hire a strong generalist operator** — someone with a BizOps or consulting background who can *triage* across all areas but won't go deep on any. Works if you need "good enough across the board" at an early stage. Titles: BizOps Manager, Generalist Operator, Head of Operations.

3. **Use fractional/contract specialists** — cheaper than FTEs, faster to onboard, and you avoid the trap of one person being underwater.

**If you insist on one hire:** A former startup BizOps person (3-6 years, Series A/B company) is your best bet. They've worn many hats, can prioritize ruthlessly, and know when to delegate. Budget $90-130k base in most markets.

What's the actual bottleneck right now? That determines which two to prioritize.
```

