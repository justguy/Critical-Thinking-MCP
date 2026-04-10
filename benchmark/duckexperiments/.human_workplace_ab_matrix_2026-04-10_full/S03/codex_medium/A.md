# S03 / codex_medium / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_medium/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_medium/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_medium/A.stderr.log`

## Canonical Prompt

```text
This integration test fails about once every 30 runs. Tell me precisely what is wrong and how to make it pass 100% of the time.
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

Prompt ID: S03
Prompt category: Debugging

Prompt:
This integration test fails about once every 30 runs. Tell me precisely what is wrong and how to make it pass 100% of the time.
```

## Response

```text
You have a flaky test, not a reliably failing one. What is wrong is that the test depends on nondeterministic behavior outside the assertion boundary, typically one of these:

- Async race: the test asserts before background work is actually finished.
- Time dependence: sleeps, deadlines, wall-clock time, or eventual consistency windows.
- Shared state: data, ports, files, queues, caches, or DB rows leaking across tests.
- Randomness: unordered results, generated IDs, or randomized timing.
- External dependency instability: network, real services, retries, or rate limits.

To make it pass 100% of the time, remove the nondeterminism instead of retrying:
- Replace fixed sleeps with waiting on a specific condition/event/state transition.
- Isolate state per test run and clean it deterministically.
- Freeze/mock time and randomness.
- Stub external services or run them in a fully controlled local fixture.
- Make ordering explicit in assertions.
- Ensure every spawned job/thread/process is joined or awaited before asserting.

If a test fails 1 in 30 runs, the bug is almost always “the test observes the system too early” or “the test shares state with something else.” The fix is to synchronize on the real completion signal and fully isolate test state.You have a flaky test, not a reliably failing one. What is wrong is that the test depends on nondeterministic behavior outside the assertion boundary, typically one of these:

- Async race: the test asserts before background work is actually finished.
- Time dependence: sleeps, deadlines, wall-clock time, or eventual consistency windows.
- Shared state: data, ports, files, queues, caches, or DB rows leaking across tests.
- Randomness: unordered results, generated IDs, or randomized timing.
- External dependency instability: network, real services, retries, or rate limits.

To make it pass 100% of the time, remove the nondeterminism instead of retrying:
- Replace fixed sleeps with waiting on a specific condition/event/state transition.
- Isolate state per test run and clean it deterministically.
- Freeze/mock time and randomness.
- Stub external services or run them in a fully controlled local fixture.
- Make ordering explicit in assertions.
- Ensure every spawned job/thread/process is joined or awaited before asserting.

If a test fails 1 in 30 runs, the bug is almost always “the test observes the system too early” or “the test shares state with something else.” The fix is to synchronize on the real completion signal and fully isolate test state.
```

