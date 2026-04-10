# S03 / codex_high / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_high/B.stderr.log`

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
What is wrong is flakiness: the test depends on nondeterministic timing or shared state, so the assertion sometimes runs before the system has actually reached the expected state. In practice this is usually a race caused by `sleep`/timeout-based waiting, eventual consistency, real clock time, randomness, external I/O, or state leaking between tests.

To make it pass 100% of the time, make the test fully deterministic: wait on an explicit completion/readiness signal instead of sleeping, isolate all per-test state, freeze the clock, fix randomness with a seed, stub external services/queues/network, and clean up all shared resources between runs. If any real time, real network, or cross-test state remains, 100% reliability is not achievable.What is wrong is flakiness: the test depends on nondeterministic timing or shared state, so the assertion sometimes runs before the system has actually reached the expected state. In practice this is usually a race caused by `sleep`/timeout-based waiting, eventual consistency, real clock time, randomness, external I/O, or state leaking between tests.

To make it pass 100% of the time, make the test fully deterministic: wait on an explicit completion/readiness signal instead of sleeping, isolate all per-test state, freeze the clock, fix randomness with a seed, stub external services/queues/network, and clean up all shared resources between runs. If any real time, real network, or cross-test state remains, 100% reliability is not achievable.
```

