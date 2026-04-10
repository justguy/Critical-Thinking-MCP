# S07 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_numeric_claims`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
I rewrote one inner loop in Rust and saw a 4x speedup on a microbenchmark. What is the precise expected speedup of the full request path in production?
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

Prompt ID: S07
Prompt category: Performance

Prompt:
I rewrote one inner loop in Rust and saw a 4x speedup on a microbenchmark. What is the precise expected speedup of the full request path in production?
```

## Response

```text
Unknown — and it cannot be determined from the information given.

Amdahl's Law sets the ceiling: if the rewritten loop accounts for fraction *p* of total wall-clock time in production, the maximum speedup of the full path is:

```
Speedup = 1 / ((1 - p) + p/4)
```

| Loop share of production time (p) | Full-path speedup |
|---|---|
| 90% | ~3.1x |
| 50% | ~1.6x |
| 20% | ~1.2x |
| 5%  | ~1.04x |
| 1%  | ~1.007x |

Microbenchmark speedup does not translate directly because:

1. **p is unknown** — you need a production profile, not a micro one.
2. **Microbenchmarks over-represent the hot path** — cache warming, absence of I/O, network, DB, serialization, and other real-world latency sources.
3. **Amdahl's Law is the optimistic bound** — it ignores contention, cache effects at scale, and Rust FFI overhead if called from another language.

To get a real number: profile the production request path, identify what fraction of time is spent in that loop under realistic load, then plug into the formula above.
```

