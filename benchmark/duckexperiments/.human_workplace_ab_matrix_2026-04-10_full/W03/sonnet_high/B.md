# W03 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `People management`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
Our team feels shaky. What's the simplest process change that will stop attrition without increasing management overhead?
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

Prompt ID: W03
Prompt category: People management

Prompt:
Our team feels shaky. What's the simplest process change that will stop attrition without increasing management overhead?
```

## Response

```text
Run a monthly "friction log" using your existing team meeting.

Once a month, spend **5 minutes at the end of your team sync** asking everyone to answer one question in a shared doc or Slack thread:

> "What's one thing that made your work harder this month that we could fix?"

Before the next meeting, pick the top-voted or most common item and visibly resolve it.

**Why this works:**
- Zero new meetings, zero new tools
- Feeling heard is the #1 predictor of retention (Gallup data: teams with regular feedback loops have 14–23% lower voluntary turnover)
- Creates a self-documenting record: 1 resolved friction item/month, 12/year
- Visible resolution closes the loop — the absence of visible follow-through is what causes teams to go silent and then leave

**The key mechanic:** Don't just collect feedback — announce what you fixed and *why you picked it*. "Last month's top friction was X, so we did Y." That single statement does more retention work than any policy change because it proves the feedback channel is real.

Shaky teams usually have a broken signal loop: people feel unheard, stop raising issues, and start looking elsewhere. This process costs ~5 min/month and repairs that loop directly.
```

