# W08 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `score_response_quality`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/opus_high/B.stderr.log`

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
Use a structured "input round → decision round" format that separates voice from vote:

**Step 1 — Async input collection (1–2 days)**
Send each function a shared pricing brief (proposed change, rationale, market data) and a structured template asking three things:
1. What impact does this have on your function? (quantified where possible)
2. What constraints or risks must we respect?
3. What would make this change acceptable to you?

This gives every group equal airtime without a meeting where the loudest voice wins.

**Step 2 — Synthesis (owner, 1 day)**
One decision owner (usually product or a GM) consolidates inputs into a single decision memo showing: the proposal, each function's top concern, and how the proposal addresses or explicitly trades off each concern. Unresolved conflicts get flagged as open items with proposed resolutions.

**Step 3 — 60-minute decision meeting**
Walk the memo. Each function gets 5 minutes to confirm their concerns were captured accurately — not to re-argue. The decision owner then decides, live, incorporating any last corrections. The output is a written decision with:
- The pricing change and effective date
- Concessions made to each function
- Owners for downstream execution (sales enablement, billing updates, support scripts, forecast adjustments)

**Step 4 — Disagree-and-commit acknowledgment**
Each lead signs off in writing. Anyone who disagrees states their objection on record but commits to execution. This prevents passive resistance later.

**Why this works for speed + inclusion:**
- Async input removes scheduling bottleneck and lets introverts contribute equally.
- The structured template forces specificity, preventing vague objections that stall decisions.
- A single decision owner prevents consensus paralysis — everyone is heard, but one person decides.
- Written sign-off creates accountability and surfaces hidden disagreement before it becomes sabotage.

Total timeline: 4–5 business days from brief to signed decision.
```

