# W09 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_high/B.stderr.log`

## Canonical Prompt

```text
Help me roll out a new performance-review process across the company quickly, with strong adoption, low manager burden, and no confusion.
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

Prompt ID: W09
Prompt category: Cross-functional planning

Prompt:
Help me roll out a new performance-review process across the company quickly, with strong adoption, low manager burden, and no confusion.
```

## Response

```text
Roll this out as a 4-week, minimum-viable process:

1. Week 1: lock one simple review design: a single rating rubric, 3-5 written questions, clear calibration rules, and one timeline.
2. Pilot it for 5 business days with 1-2 departments. Measure manager time, confusing instructions, and tooling failures; cut anything non-essential.
3. Freeze a single toolkit before launch: form/template, example reviews, manager script, FAQ, and one source-of-truth page.
4. Train managers once, briefly, and make it mandatory. Give them exact expectations, deadlines, escalation paths, and sample language for employee conversations.
5. Run the company rollout with automated reminders, office hours, and HRBP support. Handle exceptions centrally so managers do not invent local variants.
6. Track four metrics live: completion rate, average manager time per review, employee understanding, and calibration quality. Fix the top 3 issues before the next cycle.

Guardrails: keep the form short, allow no department-specific process changes in cycle 1, and send every communication back to the same source-of-truth page.Roll this out as a 4-week, minimum-viable process:

1. Week 1: lock one simple review design: a single rating rubric, 3-5 written questions, clear calibration rules, and one timeline.
2. Pilot it for 5 business days with 1-2 departments. Measure manager time, confusing instructions, and tooling failures; cut anything non-essential.
3. Freeze a single toolkit before launch: form/template, example reviews, manager script, FAQ, and one source-of-truth page.
4. Train managers once, briefly, and make it mandatory. Give them exact expectations, deadlines, escalation paths, and sample language for employee conversations.
5. Run the company rollout with automated reminders, office hours, and HRBP support. Handle exceptions centrally so managers do not invent local variants.
6. Track four metrics live: completion rate, average manager time per review, employee understanding, and calibration quality. Fix the top 3 issues before the next cycle.

Guardrails: keep the form short, allow no department-specific process changes in cycle 1, and send every communication back to the same source-of-truth page.
```

