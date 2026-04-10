# W05 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/codex_medium/B.stderr.log`

## Canonical Prompt

```text
I need a staffing plan that cuts labor costs 20%, improves response times, avoids burnout, and adds seven-day coverage without hiring.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W05
Prompt category: Staffing and scheduling

Prompt:
I need a staffing plan that cuts labor costs 20%, improves response times, avoids burnout, and adds seven-day coverage without hiring.
```

## Response

```text
Use a 6-step plan: 1. Map 8-12 weeks of demand by hour/day, overtime, missed SLAs, and absences. 2. Rebuild shifts around peaks with staggered starts and overlap windows, and cut low-demand coverage. 3. Put burnout rules in place first: cap weekly hours, cap consecutive days, enforce rest gaps, and hold a small flex buffer each day. 4. Cross-train into a primary/secondary skill matrix so the on-duty team can absorb most daily volume without escalation. 5. Add seven-day coverage by rotating two weekend teams from existing staff, with each weekend assignment offset by protected weekday recovery time. 6. Run a 4-week pilot and keep only the schedule that hits all three weekly targets: labor cost down 20%, response time up, and overtime/PTO drift flat or better.

If one target slips, use this order of adjustment: reduce low-demand hours first, improve cross-skill coverage second, and only then tighten weekend rotation frequency.Use a 6-step plan: 1. Map 8-12 weeks of demand by hour/day, overtime, missed SLAs, and absences. 2. Rebuild shifts around peaks with staggered starts and overlap windows, and cut low-demand coverage. 3. Put burnout rules in place first: cap weekly hours, cap consecutive days, enforce rest gaps, and hold a small flex buffer each day. 4. Cross-train into a primary/secondary skill matrix so the on-duty team can absorb most daily volume without escalation. 5. Add seven-day coverage by rotating two weekend teams from existing staff, with each weekend assignment offset by protected weekday recovery time. 6. Run a 4-week pilot and keep only the schedule that hits all three weekly targets: labor cost down 20%, response time up, and overtime/PTO drift flat or better.

If one target slips, use this order of adjustment: reduce low-demand hours first, improve cross-skill coverage second, and only then tighten weekend rotation frequency.
```

