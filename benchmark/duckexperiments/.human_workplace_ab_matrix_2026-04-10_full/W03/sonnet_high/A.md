# W03 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `People management`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Our team feels shaky. What's the simplest process change that will stop attrition without increasing management overhead?
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

Prompt ID: W03
Prompt category: People management

Prompt:
Our team feels shaky. What's the simplest process change that will stop attrition without increasing management overhead?
```

## Response

```text
**Weekly 15-minute 1:1s with a single standing question: "What's one thing that's slowing you down or frustrating you?"**

That's it. No agenda templates, no tracking spreadsheet, no HR process.

Why it works:
- People leave managers, not companies — this creates a direct channel before frustration compounds into a decision
- "Slowing you down" surfaces blockers you can actually fix (process waste, unclear ownership, missing tools)
- 15 minutes is short enough that it doesn't feel like a performance check-in, so people are more honest
- You get signal early, when the cost to fix is low, rather than during an exit interview

What makes it stick: the manager's job is to listen and remove one thing per week, not to report upward or evaluate. No notes required unless you choose to take them. The overhead is genuinely just the time.

The hidden benefit: most attrition isn't about compensation — it's about feeling unheard or blocked. This directly addresses both.
```

