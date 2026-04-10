# W08 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `score_response_quality`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
I need product, sales, finance, and support to all feel equally heard on a pricing change, but I also need a fast decision and no conflict.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: score_response_quality.
- Secondary designated tool: check_plan_validity.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W08
Prompt category: Cross-functional planning

Prompt:
I need product, sales, finance, and support to all feel equally heard on a pricing change, but I also need a fast decision and no conflict.
```

## Response

```text
The core problem: "equally heard" and "fast + no conflict" are in tension by default. Resolve it structurally, not relationally.

**Step 1 — Async input before any meeting (1–2 days)**
Send each team a 3-question brief:
1. What's your team's top concern with this pricing change?
2. What would a good outcome look like for your team?
3. What's one thing you could accept even if it's not your preference?

This surfaces concerns without live conflict and gives everyone equal airtime on their own time.

**Step 2 — 1:1 pre-wiring with each lead (same day as async collection)**
Call each team lead individually. Understand their hard lines vs. soft preferences. Resolve soft objections before the group meeting. This eliminates ambushes.

**Step 3 — Name the decision owner upfront**
Before the group meeting, explicitly designate who makes the final call (typically finance or product). Frame everyone else as consulted, not deciding. Unclear authority is the #1 source of conflict in cross-functional decisions.

**Step 4 — Single 60-minute structured meeting**
- 8 min per team: present your view, no interruptions
- 15 min: decision owner synthesizes themes
- 15 min: decision + one round of live objections only

Since async input is already in, there are no surprises and no need to relitigate.

**Step 5 — Written decision memo within 24 hours**
Captures what was decided, what each team raised, and how their input shaped the outcome. This closes the loop so teams feel heard even if they didn't get their preferred outcome.
```

