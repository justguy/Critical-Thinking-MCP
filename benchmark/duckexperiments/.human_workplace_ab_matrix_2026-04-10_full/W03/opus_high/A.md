# W03 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `People management`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/opus_high/A.stderr.log`

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
**One-on-ones with a single standing question: "What's in your way?"**

Weekly or biweekly 15-minute 1:1s where the manager's only job is to listen and then remove the blocker. That's it.

**Why this works:**

- **Attrition is usually preceded by feeling unheard**, not by compensation or title issues. A reliable venue to surface friction catches problems before they become resignations.
- **It costs almost nothing.** 15 minutes per report per week. No new tools, no new rituals, no committee.
- **It shifts the manager's role from status-checker to blocker-remover**, which is higher leverage and actually reduces other overhead (fewer escalations, fewer surprise departures, fewer "can we talk?" ambushes).

**How to keep it from becoming another empty meeting:**

1. The report owns the agenda, not the manager. No status updates — that's what standups/async tools are for.
2. The manager commits to acting on at least one thing within the week, even if it's just "I looked into it and here's why we can't change that yet."
3. If there's genuinely nothing to discuss, cancel that week. The slot existing matters more than filling it.

The pattern that kills retention isn't big dramatic failures — it's the slow accumulation of small frustrations nobody asked about. A lightweight, consistent feedback loop is the highest-ROI fix.
```

