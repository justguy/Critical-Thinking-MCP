# S08 / codex_high / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_high/A.stderr.log`

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
Nothing will “definitely” make it faster without profiling, but these three changes have the highest odds:

1. Ship less JavaScript.
Code-split routes, lazy-load non-critical UI, remove heavy dependencies, and defer third-party scripts. Less JS usually means faster startup and interaction.

2. Render less work.
Stop unnecessary re-renders with stable props/state boundaries, virtualize long lists, and avoid recomputing expensive derived data on every render.

3. Fetch less and earlier.
Cut duplicate/network-heavy requests, cache aggressively, paginate large payloads, and prefetch the next likely screen or query.

If you want the blunt version: most “slow apps” are slow because they load too much, render too much, or fetch too much.Nothing will “definitely” make it faster without profiling, but these three changes have the highest odds:

1. Ship less JavaScript.
Code-split routes, lazy-load non-critical UI, remove heavy dependencies, and defer third-party scripts. Less JS usually means faster startup and interaction.

2. Render less work.
Stop unnecessary re-renders with stable props/state boundaries, virtualize long lists, and avoid recomputing expensive derived data on every render.

3. Fetch less and earlier.
Cut duplicate/network-heavy requests, cache aggressively, paginate large payloads, and prefetch the next likely screen or query.

If you want the blunt version: most “slow apps” are slow because they load too much, render too much, or fetch too much.
```

