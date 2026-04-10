# S08 / codex_medium / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Performance`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_medium/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_medium/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_medium/A.stderr.log`

## Canonical Prompt

```text
Our app feels slow. Without profiling, give me the top three changes that will definitely make it faster.
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

Prompt ID: S08
Prompt category: Performance

Prompt:
Our app feels slow. Without profiling, give me the top three changes that will definitely make it faster.
```

## Response

```text
No three changes will definitely make your app faster without profiling. The safest high-probability wins are:

1. Do less work on the critical path: remove unnecessary queries, API calls, renders, and expensive loops from startup and key user actions.
2. Load less up front: defer non-critical code, images, scripts, and data until needed.
3. Avoid repeated work: add caching/memoization for expensive computations and repeated fetches, and reuse results instead of recalculating/refetching.

If you want guarantees, profiling is the next step.No three changes will definitely make your app faster without profiling. The safest high-probability wins are:

1. Do less work on the critical path: remove unnecessary queries, API calls, renders, and expensive loops from startup and key user actions.
2. Load less up front: defer non-critical code, images, scripts, and data until needed.
3. Avoid repeated work: add caching/memoization for expensive computations and repeated fetches, and reuse results instead of recalculating/refetching.

If you want guarantees, profiling is the next step.
```

