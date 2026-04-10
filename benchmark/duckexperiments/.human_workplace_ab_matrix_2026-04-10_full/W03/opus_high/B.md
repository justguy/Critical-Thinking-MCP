# W03 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `People management`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/opus_high/B.stderr.log`

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
The single highest-leverage change is **structured weekly 1-on-1s** (15 minutes, fixed format). Most attrition stems from people feeling unheard, not from compensation or workload. A short, recurring conversation catches frustration before it becomes a resignation.

**How to implement with near-zero overhead:**

1. **Schedule a recurring 15-minute 1-on-1** between each person and their direct lead. Three standing questions:
   - What is blocking you right now?
   - What one thing would you change about how we work?
   - What are you learning or want to learn?

2. **Log recurring themes** in a shared, lightweight doc (a spreadsheet row per week is enough). Anonymize where needed. This replaces engagement surveys — it's faster and more honest.

3. **Act on the top theme each sprint.** The critical part: close the loop visibly. "You said X was broken, here's what we changed." People leave when input disappears into a void.

**Why this works:**
- Research from CultureAmp and Gallup consistently shows that manager-report relationship quality is the #1 predictor of voluntary turnover — above pay, above perks.
- 15 minutes per person per week is less time than backfilling a departed teammate (typically 3–6 months of lost productivity per exit).
- No new tools, no new roles, no process documents. Just a calendar invite and three questions.

**What to avoid:** Don't turn 1-on-1s into status updates. If the conversation drifts to task tracking, you've lost the retention signal. Keep it about the person, not the project.
```

