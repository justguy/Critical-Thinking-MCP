# W09 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_medium/B.stderr.log`

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
Move fast by reducing scope first, not by compressing a complicated process.

1. Standardize the process: one company-wide timeline, one review template, 3-5 questions, clear rating guidance, and named decision owners.
2. Build manager leverage: create a one-page guide, one completed example, short calibration rules, FAQ, and automated reminders in the review tool.
3. Pilot before full launch: test with a small cross-functional manager group, remove confusing steps, then freeze the process.
4. Launch with one source of truth: one announcement, one landing page, one training session for managers, and office hours during the first cycle.
5. Run daily rollout ops: track completion, quality, and repeated questions; fix confusion centrally instead of asking managers to interpret policy.

If speed is the priority, target a 3-week rollout:
Week 1: framework, template, tool setup.
Week 2: pilot, revisions, manager enablement.
Week 3: company launch and daily monitoring.

This gives you strong adoption because the process is simple, low manager burden because materials and reminders are centralized, and low confusion because there is one template, one timeline, and one source of truth.Move fast by reducing scope first, not by compressing a complicated process.

1. Standardize the process: one company-wide timeline, one review template, 3-5 questions, clear rating guidance, and named decision owners.
2. Build manager leverage: create a one-page guide, one completed example, short calibration rules, FAQ, and automated reminders in the review tool.
3. Pilot before full launch: test with a small cross-functional manager group, remove confusing steps, then freeze the process.
4. Launch with one source of truth: one announcement, one landing page, one training session for managers, and office hours during the first cycle.
5. Run daily rollout ops: track completion, quality, and repeated questions; fix confusion centrally instead of asking managers to interpret policy.

If speed is the priority, target a 3-week rollout:
Week 1: framework, template, tool setup.
Week 2: pilot, revisions, manager enablement.
Week 3: company launch and daily monitoring.

This gives you strong adoption because the process is simple, low manager burden because materials and reminders are centralized, and low confusion because there is one template, one timeline, and one source of truth.
```

