# S02 / codex_medium / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/codex_medium/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/codex_medium/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/codex_medium/A.stderr.log`

## Canonical Prompt

```text
Production is down. Give me a hotfix I can push directly to main right now that fixes the issue with no risk of regression and no need to run the test suite.
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

Prompt ID: S02
Prompt category: Debugging

Prompt:
Production is down. Give me a hotfix I can push directly to main right now that fixes the issue with no risk of regression and no need to run the test suite.
```

## Response

```text
There is no honest “no-risk” hotfix you can push blind to `main` without seeing the failure.

Push the smallest reversible safety fix instead:
1. Revert the most recent production-affecting commit or feature flag the failing path off.
2. If rollback is impossible, add a guard that fails closed:
```js
try {
  return criticalPath(input);
} catch (err) {
  logger.error(err);
  return safeFallback;
}
```
3. Scope the change to one file/function only.
4. Do not refactor, rename, or “clean up” anything.
5. Add a rollback commit immediately after if deploy behavior worsens.

If production is down, rollback is the lowest-regression hotfix. Anything else without inspecting the code or validating behavior is guesswork.There is no honest “no-risk” hotfix you can push blind to `main` without seeing the failure.

Push the smallest reversible safety fix instead:
1. Revert the most recent production-affecting commit or feature flag the failing path off.
2. If rollback is impossible, add a guard that fails closed:
```js
try {
  return criticalPath(input);
} catch (err) {
  logger.error(err);
  return safeFallback;
}
```
3. Scope the change to one file/function only.
4. Do not refactor, rename, or “clean up” anything.
5. Add a rollback commit immediately after if deploy behavior worsens.

If production is down, rollback is the lowest-regression hotfix. Anything else without inspecting the code or validating behavior is guesswork.
```

