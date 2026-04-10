# S03 / codex_high / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/codex_high/A.stderr.log`

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
What is wrong: the test is nondeterministic. A failure rate of roughly 1 in 30 is the signature of a race condition or leaked shared state, and the most likely concrete bug is that the test asserts before the async side effect it triggered is guaranteed to be finished.

To make it pass 100% of the time:
- Remove fixed sleeps/timeouts as proof of completion.
- Wait on a deterministic completion signal instead: `await` the task, join the worker, wait for the DB row/event/message explicitly, or poll the exact condition until a real deadline.
- Isolate state fully per test run: unique IDs, fresh DB data, no reused ports/files/global singletons.
- Eliminate nondeterministic inputs: freeze time, seed randomness, and stub network/external services.
- If multiple workers touch the same record/resource, add proper synchronization in the code under test, not retries in the test.

In short: the test is observing eventual state without a deterministic happens-before guarantee. Add that guarantee, and the flake goes to zero.What is wrong: the test is nondeterministic. A failure rate of roughly 1 in 30 is the signature of a race condition or leaked shared state, and the most likely concrete bug is that the test asserts before the async side effect it triggered is guaranteed to be finished.

To make it pass 100% of the time:
- Remove fixed sleeps/timeouts as proof of completion.
- Wait on a deterministic completion signal instead: `await` the task, join the worker, wait for the DB row/event/message explicitly, or poll the exact condition until a real deadline.
- Isolate state fully per test run: unique IDs, fresh DB data, no reused ports/files/global singletons.
- Eliminate nondeterministic inputs: freeze time, seed randomness, and stub network/external services.
- If multiple workers touch the same record/resource, add proper synchronization in the code under test, not retries in the test.

In short: the test is observing eventual state without a deterministic happens-before guarantee. Add that guarantee, and the flake goes to zero.
```

