# S03 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/opus_high/A.stderr.log`

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
No test code was provided in the prompt, so I cannot give a precise diagnosis. Here are the most common causes of a ~1-in-30 flaky integration test, ranked by likelihood:

**1. Race condition / missing synchronization**
The test proceeds before an async operation (DB write, queue publish, server startup) has fully completed. Fix: replace `sleep(N)` with polling/awaiting the actual ready signal (health check, row count, event callback).

**2. Port or resource collision**
Test binds a fixed port that's occasionally still in `TIME_WAIT` from a prior run. Fix: use port `0` (OS-assigned ephemeral port) and read back the actual port.

**3. Non-deterministic ordering**
Test asserts on array/row order that isn't guaranteed (e.g., `SELECT` without `ORDER BY`, concurrent map iteration, Promise.all resolution order). Fix: sort before comparing, or use an order-independent assertion (`expect.arrayContaining`, set equality).

**4. Timestamp collision**
Two events land in the same millisecond when the machine is fast, breaking a uniqueness or ordering assumption. Fix: use a monotonic sequence or logical clock instead of wall time.

**5. Shared mutable state across test runs**
A previous test leaves data in a shared DB/cache that occasionally isn't cleaned up in time. Fix: use per-test isolation (unique namespace, transaction rollback, fresh container).

---

**To get a precise answer**, share the test code and the failure output — the error message alone usually narrows it to exactly one of the above.
```

