# S03 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S03/sonnet_high/A.stderr.log`

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
No test code was provided, so a precise diagnosis isn't possible. That said, a ~1/30 failure rate is a strong signal:

**Most likely cause: a timing/race condition**

A 3% failure rate almost always means one of:

1. **Unguarded async operation** — a promise or callback resolves in a different order under load. The test assumes sequential completion but doesn't enforce it.
2. **Missing `await` on teardown** — cleanup runs before the system under test finishes, leaving state that poisons the next run (or this one under scheduling variance).
3. **Shared mutable state** — a singleton, global, or static field isn't reset between test runs, and occasionally a previous test's write bleeds through.
4. **Flaky external dependency** — a real network call, database, or container that occasionally exceeds an implicit timeout.

**How to make it pass 100% of the time:**

- Paste the test code and I can identify the exact line.
- If you can't do that: add explicit waits/assertions on intermediate states rather than final state, ensure all async paths are awaited (including in `afterEach`/`tearDown`), and isolate shared state per test.
- Run it 100x in a tight loop with `--repeat` or a loop script to force the failure reliably — that will surface the exact condition in logs.

Share the test and I'll pinpoint it.
```

