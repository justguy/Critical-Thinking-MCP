# S07 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_numeric_claims`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/opus_high/B.stderr.log`

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
There is no precise answer — it depends entirely on what fraction of the total request time that inner loop consumes. This is Amdahl's Law:

**Speedup_total = 1 / ((1 - f) + f / S)**

where **f** is the fraction of end-to-end time spent in the loop and **S** is the component speedup (4x).

Examples:
- If the loop is 20% of request time: 1 / (0.80 + 0.05) = **~1.18x** end-to-end
- If the loop is 5% of request time: 1 / (0.95 + 0.0125) = **~1.04x** end-to-end

Additionally, the 4x microbenchmark figure itself may not hold in production. Microbenchmarks typically run with warm caches, no memory pressure from adjacent work, and no I/O interleaving. Real production conditions often erode that multiplier.

To get an actual number:
1. **Profile the full request path** to measure what percentage of wall-clock time is spent in that loop under realistic load.
2. **Apply Amdahl's Law** with that fraction.
3. **Validate with a production A/B test** or shadow traffic comparison, since Amdahl's Law assumes clean decomposition that real systems often violate.
```

