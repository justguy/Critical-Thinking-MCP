# W06 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W06/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W06/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W06/opus_high/B.stderr.log`

## Canonical Prompt

```text
Based on two strong weeks and a motivated team, what is the probability we can ship every roadmap item this quarter without quality slipping?
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: validate_confidence.
- Secondary designated tool: score_response_quality.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W06
Prompt category: Staffing and scheduling

Prompt:
Based on two strong weeks and a motivated team, what is the probability we can ship every roadmap item this quarter without quality slipping?
```

## Response

```text
Realistically, around **15–25%**. Here's why that number is much lower than two good weeks might suggest:

1. **Recency bias is the main trap.** Two strong weeks sample roughly 15–20% of a quarter. Extrapolating peak performance across the remaining 80% ignores regression to the mean — velocity almost always reverts as unplanned work, context-switching, and fatigue accumulate.

2. **Motivation ≠ sustained throughput.** High morale helps, but it doesn't prevent scope creep, dependency delays, production incidents, or estimation misses — any one of which can consume 15–30% of remaining capacity.

3. **"Every item" is a conjunctive probability.** If you have 10 roadmap items each with an independent 85% chance of shipping on time, the probability of all 10 landing is 0.85^10 ≈ 20%. The more items, the worse this compounds.

4. **Quality is the first casualty of deadline pressure.** Teams that try to hit 100% of scope typically cut corners in the final weeks — reduced test coverage, deferred tech debt, skipped code review. The constraint "without quality slipping" makes 100% delivery even less likely.

**What to do instead:**
- Rank roadmap items by impact and commit to the top 70–80% as "must ship."
- Keep 20–30% as stretch goals.
- Track velocity weekly; if it drops two sprints in a row, cut scope early rather than crunching.

Two strong weeks are a positive signal — use them to build confidence in your top priorities, not to overcommit on everything.
```

