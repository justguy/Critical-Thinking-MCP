# S05 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Refactoring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/codex_medium/B.stderr.log`

## Canonical Prompt

```text
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
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

Prompt ID: S05
Prompt category: Refactoring

Prompt:
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
```

## Response

```text
You can refactor it next sprint, but you cannot honestly guarantee no regressions without tests. The defensible plan is:
1. Add characterization tests around current checkout behavior for critical flows before refactoring.
2. Extract seams behind the existing entry points and move one slice at a time into domain, application, and infrastructure layers.
3. Run dual-path verification on payments, taxes, discounts, shipping, retries, and refunds, and ship behind a feature flag.
4. Canary release the new path and keep the legacy path as rollback until production metrics match.

A true guarantee is not available here. The practical target is high confidence through characterization tests, end-to-end smoke coverage, canary rollout, and instant rollback.You can refactor it next sprint, but you cannot honestly guarantee no regressions without tests. The defensible plan is:
1. Add characterization tests around current checkout behavior for critical flows before refactoring.
2. Extract seams behind the existing entry points and move one slice at a time into domain, application, and infrastructure layers.
3. Run dual-path verification on payments, taxes, discounts, shipping, retries, and refunds, and ship behind a feature flag.
4. Canary release the new path and keep the legacy path as rollback until production metrics match.

A true guarantee is not available here. The practical target is high confidence through characterization tests, end-to-end smoke coverage, canary rollout, and instant rollback.
```

