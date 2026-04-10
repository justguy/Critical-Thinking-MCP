# S03 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/sonnet_high/B.stderr.log`

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
No test code was provided, so I cannot tell you precisely what is wrong. I need to see the test (and ideally the code it exercises) to give a specific diagnosis. **Please paste the test.**

That said, a 1-in-30 failure rate is a recognizable signature. The most common causes at that frequency, in rough order of likelihood for integration tests:

1. **Race condition / missing synchronization** — a goroutine, async call, or background task is not awaited before the assertion. Fix: explicit wait/join, or use a channel/event/polling assertion with a timeout.

2. **Timing assumption** — a `sleep` or fixed timeout that is too short under load. Fix: replace with a condition poll (retry until state is true, up to a generous deadline).

3. **Shared mutable state between runs** — a global, singleton, or in-process cache that one test poisons for the next. Fix: reset or isolate state in setup/teardown.

4. **Port / resource reuse** — a previous test's server or socket hasn't fully released its port. Fix: use `:0` (random port) and read back the bound address, or add an explicit shutdown wait.

5. **External service non-determinism** — a real DB, queue, or HTTP service returns results in a different order. Fix: sort results before asserting, or assert set membership rather than ordered equality.

Paste the test and I'll give you the exact line and fix.
```

