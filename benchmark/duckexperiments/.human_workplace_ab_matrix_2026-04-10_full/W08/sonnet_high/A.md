# W08 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `score_response_quality`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
I need product, sales, finance, and support to all feel equally heard on a pricing change, but I also need a fast decision and no conflict.
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

Prompt ID: W08
Prompt category: Cross-functional planning

Prompt:
I need product, sales, finance, and support to all feel equally heard on a pricing change, but I also need a fast decision and no conflict.
```

## Response

```text
Run a single structured session with all four teams, not sequential bilateral conversations. Here's a format that works:

**Before the meeting (async, 24-48 hrs out)**
Send each team a two-question form:
1. What's the one outcome you *must* protect in this pricing change?
2. What are you willing to trade?

This surfaces real constraints without posturing.

**In the meeting (60 min max)**
- 5 min: Restate the decision and deadline — everyone aligned on what's being decided
- 20 min: Each team presents their "must protect" (5 min each, no debate yet)
- 15 min: Identify overlaps and genuine conflicts — write them on a shared doc live
- 15 min: Proposal round — anyone can propose a price structure that addresses the conflicts
- 5 min: Decision

**Why this reduces conflict**
- Async input prevents anyone from feeling ambushed
- "Must protect" framing keeps teams anchored to interests, not positions
- A shared live doc depersonalizes the negotiation
- Time-boxing prevents the meeting from becoming a forum

**When teams still can't converge**
Designate one person in advance (usually the product or revenue owner) as the tiebreaker. Announce this before the meeting so it doesn't feel like a power grab if used. Most teams will self-resolve rather than escalate to a tiebreaker.

The fast decision comes from structure, not from cutting people out.
```

