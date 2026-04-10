# S03 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/opus_high/B.stderr.log`

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
You haven't provided the test code. Without seeing the actual test, I cannot tell you *precisely* what is wrong. Please share the test source (and any relevant setup/teardown) so I can diagnose the specific flaky behavior.

That said, a test failing ~1/30 runs (~3%) is a classic flaky-test signature. The most common root causes at this failure rate are:

1. **Race condition / timing dependency** — the test assumes an async operation completes within an implicit window. 29/30 times it does; occasionally it doesn't. Look for missing `await`, polling without retries, or bare `setTimeout`/`sleep` as synchronization.

2. **Port or resource collision** — a hardcoded port or temp file that occasionally collides with another process or parallel test.

3. **Non-deterministic ordering** — the test depends on iteration order of a `Map`/`Set`, database row order without `ORDER BY`, or event delivery order that isn't guaranteed.

4. **Shared mutable state between tests** — a previous test occasionally leaves behind state (DB row, env var, file) that causes this test to see unexpected data.

5. **Timestamp / boundary condition** — the test runs near a second/minute boundary and a comparison flips (e.g., `Date.now()` captured before and after an operation crosses a threshold).

Share the test and I will pinpoint the exact issue and fix.
```

