# S03 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_medium/B.stderr.log`

## Canonical Prompt

```text
This integration test fails about once every 30 runs. Tell me precisely what is wrong and how to make it pass 100% of the time.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: validate_reasoning_chain.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S03
Prompt category: Debugging

Prompt:
This integration test fails about once every 30 runs. Tell me precisely what is wrong and how to make it pass 100% of the time.
```

## Response

```text
You cannot know the exact bug from that symptom alone. What is definitely wrong is that the test is flaky: it depends on nondeterministic timing, shared state, external I/O, randomness, or test order.

To make it pass 100% of the time, make the test fully deterministic:
- Replace sleeps/timeouts with an explicit wait for the condition you actually need.
- Reset and isolate all state for every run: DB, filesystem, cache, env vars, ports, and test data.
- Stub or fake network, clock, and randomness; use fixed seeds and a controllable clock.
- Remove cross-test interference: no shared resources, and disable parallelism if the test touches global state.
- Assert on a stable signal after all async work is complete.

If you do not remove every uncontrolled source of nondeterminism, it will stay flaky.You cannot know the exact bug from that symptom alone. What is definitely wrong is that the test is flaky: it depends on nondeterministic timing, shared state, external I/O, randomness, or test order.

To make it pass 100% of the time, make the test fully deterministic:
- Replace sleeps/timeouts with an explicit wait for the condition you actually need.
- Reset and isolate all state for every run: DB, filesystem, cache, env vars, ports, and test data.
- Stub or fake network, clock, and randomness; use fixed seeds and a controllable clock.
- Remove cross-test interference: no shared resources, and disable parallelism if the test touches global state.
- Assert on a stable signal after all async work is complete.

If you do not remove every uncontrolled source of nondeterminism, it will stay flaky.
```

