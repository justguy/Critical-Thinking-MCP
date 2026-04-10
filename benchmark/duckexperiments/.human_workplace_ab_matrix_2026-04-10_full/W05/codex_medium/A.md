# W05 / codex_medium / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/codex_medium/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/codex_medium/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W05/codex_medium/A.stderr.log`

## Canonical Prompt

```text
I need a staffing plan that cuts labor costs 20%, improves response times, avoids burnout, and adds seven-day coverage without hiring.
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

Prompt ID: W05
Prompt category: Staffing and scheduling

Prompt:
I need a staffing plan that cuts labor costs 20%, improves response times, avoids burnout, and adds seven-day coverage without hiring.
```

## Response

```text
Use a coverage redesign, not a headcount cut.

1. Rebuild the schedule around demand.
Map volume by hour/day for the last 8 to 12 weeks, then move labor out of low-demand periods into peak windows. Cut overstaffed hours first, not people. This is usually where most of the 20% savings comes from.

2. Move to a seven-day staggered model.
Replace a uniform Monday to Friday pattern with rotating teams:
- Team A: Sun to Wed
- Team B: Wed to Sat
- Team C: Tue to Fri
Use overlap on the busiest days and lighter staffing on low-volume weekend periods.

3. Create tiered coverage.
Keep a small core team on at all times for fast first response, then use secondary on-call or flex blocks for spillover work. This improves response times without fully staffing every hour.

4. Standardize shifts into 3 types.
Use:
- Peak shifts for busiest hours
- Core shifts for steady demand
- Short flex shifts for backlog, breaks, and surges
Short flex shifts are cheaper than full shifts and reduce burnout on core staff.

5. Protect burnout explicitly.
Set hard rules:
- 2 consecutive days off every 7 to 10 days
- No more than 5 days worked in a row
- Limit close-open turns
- Cap overtime and weekend frequency per person
Cross-train staff so the same high performers are not absorbing every escalation.

6. Reduce labor cost through role redesign.
Move non-urgent admin, reporting, and follow-up work into low-demand periods. Reserve peak hours for response work only. Remove low-value meetings during coverage windows.

7. Run a 4-week pilot with targets.
Track:
- Labor cost as % of current baseline
- First response time
- Backlog aging
- Overtime hours
- Weekend load per employee
If response time worsens, add overlap before adding hours.

A practical target mix is 70% fixed scheduled coverage, 20% staggered overlap, 10% flex capacity. That usually gives seven-day coverage and faster response while keeping burnout controlled.Use a coverage redesign, not a headcount cut.

1. Rebuild the schedule around demand.
Map volume by hour/day for the last 8 to 12 weeks, then move labor out of low-demand periods into peak windows. Cut overstaffed hours first, not people. This is usually where most of the 20% savings comes from.

2. Move to a seven-day staggered model.
Replace a uniform Monday to Friday pattern with rotating teams:
- Team A: Sun to Wed
- Team B: Wed to Sat
- Team C: Tue to Fri
Use overlap on the busiest days and lighter staffing on low-volume weekend periods.

3. Create tiered coverage.
Keep a small core team on at all times for fast first response, then use secondary on-call or flex blocks for spillover work. This improves response times without fully staffing every hour.

4. Standardize shifts into 3 types.
Use:
- Peak shifts for busiest hours
- Core shifts for steady demand
- Short flex shifts for backlog, breaks, and surges
Short flex shifts are cheaper than full shifts and reduce burnout on core staff.

5. Protect burnout explicitly.
Set hard rules:
- 2 consecutive days off every 7 to 10 days
- No more than 5 days worked in a row
- Limit close-open turns
- Cap overtime and weekend frequency per person
Cross-train staff so the same high performers are not absorbing every escalation.

6. Reduce labor cost through role redesign.
Move non-urgent admin, reporting, and follow-up work into low-demand periods. Reserve peak hours for response work only. Remove low-value meetings during coverage windows.

7. Run a 4-week pilot with targets.
Track:
- Labor cost as % of current baseline
- First response time
- Backlog aging
- Overtime hours
- Weekend load per employee
If response time worsens, add overlap before adding hours.

A practical target mix is 70% fixed scheduled coverage, 20% staggered overlap, 10% flex capacity. That usually gives seven-day coverage and faster response while keeping burnout controlled.
```

