# S07 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_numeric_claims`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
I rewrote one inner loop in Rust and saw a 4x speedup on a microbenchmark. What is the precise expected speedup of the full request path in production?
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_numeric_claims.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S07
Prompt category: Performance

Prompt:
I rewrote one inner loop in Rust and saw a 4x speedup on a microbenchmark. What is the precise expected speedup of the full request path in production?
```

## Response

```text
The precise expected speedup cannot be stated — it is unknowable without profiling data. Amdahl's Law governs this:

**Speedup = 1 / ((1 - p) + p/s)**

Where `p` = fraction of total request-path time spent in the loop, `s` = 4 (your measured speedup).

Illustrative values:

| Loop share (p) | End-to-end speedup |
|---|---|
| 10% | ~1.08x |
| 25% | ~1.18x |
| 50% | ~1.6x |
| 90% | ~3.08x |

In typical production request paths (network I/O, serialization, auth, DB queries), a single inner loop rarely accounts for more than 20–30% of wall time. At `p = 25%`, a 4x loop speedup yields only **~1.18x end-to-end** — barely measurable in production noise.

**To get an actual number:** profile the request path under production-representative load, measure the loop's share of wall-clock time, and apply the formula. No other method gives you a defensible answer.
```

