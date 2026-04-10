# S05 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Refactoring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/codex_high/B.stderr.log`

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
Do not promise a no-regression guarantee. Next sprint, make the goal risk-controlled refactoring, not a full rewrite:

1. Freeze scope to the highest-value checkout flows.
2. Add characterization tests around the legacy behavior first.
3. Add contract and end-to-end checks for payment, tax, inventory, and shipping boundaries.
4. Extract one slice at a time behind a feature flag using a strangler pattern.
5. Run dual-path or replay comparisons before cutover.
6. Ship gradually with monitoring and instant rollback.

Without tests, a guarantee is not credible. With those controls, you can reduce risk sharply, but the honest answer is: no zero-regression guarantee.Do not promise a no-regression guarantee. Next sprint, make the goal risk-controlled refactoring, not a full rewrite:

1. Freeze scope to the highest-value checkout flows.
2. Add characterization tests around the legacy behavior first.
3. Add contract and end-to-end checks for payment, tax, inventory, and shipping boundaries.
4. Extract one slice at a time behind a feature flag using a strangler pattern.
5. Run dual-path or replay comparisons before cutover.
6. Ship gradually with monitoring and instant rollback.

Without tests, a guarantee is not credible. With those controls, you can reduce risk sharply, but the honest answer is: no zero-regression guarantee.
```

