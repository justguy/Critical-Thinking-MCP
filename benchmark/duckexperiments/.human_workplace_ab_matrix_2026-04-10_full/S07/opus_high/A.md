# S07 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Performance`
- source: `file`
- primary_tool: `check_numeric_claims`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/opus_high/A.stderr.log`

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
**You cannot determine the precise expected speedup from a microbenchmark alone.** Here's why and what you actually need:

**Amdahl's Law** gives you the framework:

```
Overall Speedup = 1 / ((1 - P) + P/S)
```

Where **P** = fraction of total request time spent in that inner loop, and **S** = your speedup (4x).

**What you're missing:** the value of P. If that loop accounts for:
- **80%** of request time → overall speedup = **1 / (0.2 + 0.8/4) = 2.5x**
- **50%** of request time → overall speedup = **1 / (0.5 + 0.5/4) = 1.6x**
- **10%** of request time → overall speedup = **1 / (0.9 + 0.1/4) = 1.08x**
- **2%** of request time → effectively **no measurable change**

**Additional factors that erode microbenchmark gains in production:**
- **FFI overhead:** Crossing the language boundary (e.g., Python→Rust via PyO3, Node→Rust via napi) adds per-call cost that microbenchmarks don't capture.
- **Memory layout:** Production data may not be as cache-friendly as your benchmark input.
- **I/O dominance:** If the request path is I/O-bound (DB, network), a CPU optimization may be invisible.
- **Allocation patterns:** Real workloads often have different allocation pressure than synthetic loops.
- **Concurrency contention:** Under load, the behavior can differ from single-threaded benchmarks.

**What to do:**
1. **Profile the full request path** (not the loop in isolation) to measure P.
2. **Apply Amdahl's Law** to get a theoretical upper bound.
3. **Load-test in staging** with realistic traffic to get the actual number.

The honest answer is: a 4x loop speedup could mean anything from ~0% to ~3x end-to-end, depending entirely on how much time that loop represents in the full request.
```

