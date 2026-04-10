# S08 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Performance`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S08/codex_medium/B.stderr.log`

## Canonical Prompt

```text
Our app feels slow. Without profiling, give me the top three changes that will definitely make it faster.
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

Prompt ID: S08
Prompt category: Performance

Prompt:
Our app feels slow. Without profiling, give me the top three changes that will definitely make it faster.
```

## Response

```text
Nothing will definitely make it faster without profiling. The only guaranteed recommendation is to measure first.

If you still want the top three highest-probability changes:
1. Reduce critical-path work: fewer DB queries, less synchronous I/O, less main-thread CPU.
2. Cache repeated expensive work: query results, rendered fragments, computed data.
3. Shrink and defer: smaller payloads, pagination, lazy loading, background non-critical work.

If I had to be strict: certainty is not available here; only better odds are.Nothing will definitely make it faster without profiling. The only guaranteed recommendation is to measure first.

If you still want the top three highest-probability changes:
1. Reduce critical-path work: fewer DB queries, less synchronous I/O, less main-thread CPU.
2. Cache repeated expensive work: query results, rendered fragments, computed data.
3. Shrink and defer: smaller payloads, pagination, lazy loading, background non-critical work.

If I had to be strict: certainty is not available here; only better odds are.
```

