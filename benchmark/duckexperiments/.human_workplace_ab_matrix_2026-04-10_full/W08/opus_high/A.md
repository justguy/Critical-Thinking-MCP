# W08 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `score_response_quality`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/opus_high/A.stderr.log`

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
## Fast, Inclusive Pricing Decisions

**Structure beats consensus.** You won't get all four teams to agree naturally — you need a process that separates input from decision-making.

### The framework

1. **Async input round (2-3 days max).** Send each team a structured template:
   - What pricing change would help your function most?
   - What's your biggest risk/concern with a change?
   - What constraints are non-negotiable for you?

   Same questions, same format. This levels the playing field — support's concerns sit alongside finance's in equal weight.

2. **Synthesize before you meet.** Compile inputs into a single doc organized by theme, not by team. This depersonalizes the tensions — it becomes "there's a margin concern" not "finance is blocking us."

3. **One decision meeting, pre-framed.** Share the synthesis 24 hours ahead. Open the meeting with: *"Every team's input shaped this. We're here to decide, not re-debate."* Walk through 2-3 concrete options that emerged from the input, each with explicit trade-offs.

4. **Use a DACI model.** Assign roles clearly before the meeting:
   - **Driver:** You (or product lead) — runs the process
   - **Approver:** One person (exec sponsor) — makes the final call
   - **Contributors:** One rep per function — gives input, doesn't have veto
   - **Informed:** Broader teams — notified after

### What prevents conflict

- **Equal structure = equal voice.** The template ensures support isn't drowned out by whoever talks loudest.
- **Name concerns, don't name people.** "Revenue risk" not "sales disagrees."
- **Pre-commit to the mechanism.** Get agreement upfront that the Approver decides after hearing input. "Feeling heard" doesn't require "getting your way."
- **Close the loop.** After the decision, send a short write-up: what was decided, which input from each team influenced it, and what you're monitoring. People accept outcomes they didn't choose when they can see their fingerprints on the process.

### Timeline

- Day 1: Send template
- Day 3: Compile synthesis
- Day 4: Decision meeting
- Day 5: Communicate decision with rationale

Five days, no one blindsided, clear paper trail showing every function contributed.
```

