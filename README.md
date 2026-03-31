# critical-thinking-mcp

> **BETA** — Under active development. Interfaces may change between versions.

Deterministic enforcement for LLM reasoning quality. Nine tools that catch confidence inflation, circular logic, fabricated numbers, arithmetic errors, and concurrency hazards — before they reach production.

No LLM calls in enforcement logic. No configuration. No API keys. Runs locally.

## Install

```bash
npm install -g critical-thinking-mcp
```

Add to Claude Desktop, Cursor, or any MCP client:

```json
{
  "mcpServers": {
    "critical-thinking": {
      "command": "critical-thinking-mcp"
    }
  }
}
```

## What Changes

A billing system claims 90% confidence. Three assumptions support it — but two can't state what would prove them wrong.

| | Baseline LLM | Prompted LLM | CT-MCP |
|---|---|---|---|
| Challenges the 90% claim | No | Partially | **Blocks until resolved** |
| Identifies race condition | No | "might be risky" | **Names the pattern** |
| Computes honest confidence | No | Self-reported | **0.085 ceiling (deterministic)** |
| Suggests specific fix | No | Vague | **Requires threshold + time window** |

The assumption "concurrent usage events will be processed in order" couldn't state a falsification condition. CT-MCP capped it from 0.85 to 0.30, dropped the honest ceiling to 8.5%, and exposed the hidden concurrency race.

## The Nine Tools

**Reasoning & Structure**
- **validate_reasoning_chain** — Directed graph analysis. Catches circular logic, orphaned conclusions, computes grounding score.
- **check_plan_validity** — Dependency graph validation. Catches circular dependencies, missing prerequisites, resource conflicts.

**Numeric Analysis**
- **check_numeric_claims** — Fabrication detection, outlier detection, monotonicity checking.
- **verify_arithmetic** — Strict recomputation of sums, weighted averages, percentages, compound growth.

**Decision Quality**
- **evaluate_tradeoffs** — Expected Utility computation. Returns INDETERMINATE when options are too close to call.
- **validate_confidence** — Confidence ceiling from stated assumptions. Caps unfalsifiable claims to 0.30.

**Quality & Safety**
- **score_response_quality** — Substance, specificity, hedging, structure scoring. Flags ungrounded entities.
- **detect_concurrency_patterns** — Check-then-act, missing idempotency, lost updates, dual writes.
- **detect_drift** — CUSUM trend analysis on numeric sequences.

## Validation Results

Tested on 56 scenarios (42 defect + 14 clean control) across 3 conditions (baseline LLM, prompted LLM, CT-MCP):

- **CT-MCP outperformed baseline on 42/42** defect scenarios
- **CT-MCP outperformed prompted LLM on 42/42** defect scenarios
- **0 false positives** on 14 clean controls
- Includes concurrency patterns, mutation tests, and adversarial wording

The system distinguishes between blocking issues (must fix) and warnings (non-critical, correctly non-blocking):

```
Input: Valid design with a non-critical ordering assumption

Output:
  status: PASS
  warning: ordering_assumption — "normally processed in order"
           has no explicit guarantee

The system detects the issue but does not block execution.
```

This matters because most validators either miss issues or block everything.

Coverage includes confidence inflation, concurrency patterns (race conditions, shared state, mutations), circular reasoning, arithmetic verification, fabrication detection, and plan validity.

Full benchmark results: [benchmark/reports/BENCHMARK_REPORT.md](benchmark/reports/BENCHMARK_REPORT.md)

## Iterative Enforcement (No Hidden Memory)

CT-MCP retains nothing between calls. For multi-step workflows, callers pass explicit `context`:

```
Iteration 1: ENFORCEMENT_FAIL → "What would prove this wrong?"
Iteration 2: ENFORCEMENT_FAIL → "Fill in this template: [event] [threshold] [time window]"
Iteration 3: PASS → honest confidence with specific falsification conditions
```

No hidden state — all context is in the request.

## Why This Works Differently

Most AI evaluation checks outputs after they're produced. These tools intervene during reasoning. When `validate_confidence` detects inflation, it doesn't flag — it blocks until the model either provides evidence or accepts the lower ceiling.

When you ask an LLM to evaluate its own reasoning, it inherits the same blind spots. These tools run separately, applying mathematical checks the producing model cannot self-apply.

## Limitations

1. **Cannot verify facts against world knowledge.** If someone claims "Redis 8.0 supports ACID transactions," the tool scores it as specific and well-structured. It cannot know the claim is false.
2. **Cannot catch semantically wrong reasoning in valid structures.** A DAG where latency evidence "supports" a security claim passes structural checks. The graph is valid; the logic is not.
3. **Stateless.** No cross-conversation learning. Conversation 10 is no smarter than conversation 1. Callers can pass context for iterative enforcement, but the server retains nothing.
4. **Arithmetic verification requires structured input.** Cannot parse formulas from prose — needs explicit `claim_type`, `values`, and `claimed_result`.
5. **Concurrency detection relies on pattern libraries.** Catches known patterns (check-then-act, lost update, missing idempotency). Does not understand arbitrary concurrent code.
6. **Causally linked assumptions bypass correlation detection** when worded differently. "Database handles 500 connections" and "query latency stays under 50ms" are causally linked but lexically distinct.
7. **Benchmark scores are self-assessed.** CT-MCP tool outputs are deterministic and reproducible. Baseline and prompted scores are self-assessed by the same LLM, introducing potential bias. Inter-rater reliability (Cohen's kappa = 0.979) is reported. Independent human evaluation is planned for v1.0.
8. **False positive rate on arbitrary inputs is unknown.** 0/14 on targeted clean controls, but these are narrowly scoped.

## Eating Our Own Cooking

I ran CT-MCP against its own publication claims. Here's what it found.

### Reasoning chain — does the benchmark argument hold?

I modeled the publication logic as a DAG: benchmark evidence → claims about value → conclusion "ready for beta."

```
validate_reasoning_chain:
  status: PASS
  grounding_score: 0.571
  cycles: 0
  orphaned_conclusions: 0
```

No circular reasoning, no unsupported conclusions. But the grounding score is 0.571 — not all evidence reaches the conclusion through validated claims. The conclusion depends on assumptions (self-assessment bias, scenario representativeness) that aren't independently verified yet. The tool says: *logically valid, but not fully grounded.*

### Confidence — am I overclaiming?

I stated four assumptions behind "CT-MCP is ready for beta publication" and asked `validate_confidence` to compute the honest ceiling.

| Assumption | Confidence | Falsification condition |
|---|---|---|
| Scenarios represent real-world failure classes | 0.70 | Real deployment finds uncovered failure class |
| Self-assessed scores within 1 point of human scores | 0.60 | Independent scoring differs by >1 point on >10 scenarios |
| Deterministic outputs are reproducible cross-platform | 0.95 | Same input, different result on different OS/Node version |
| 42/42 win rate holds under independent evaluation | 0.50 | Independent scoring shows <31/42 wins |

```
validate_confidence:
  status: PASS
  honest_ceiling: 0.199
  inflation_detected: false
```

**Honest confidence ceiling: 19.9%.** I didn't claim a number, so no inflation was detected — but the tool is telling me: my confidence that the 42/42 result survives independent evaluation should be about 20%, not 100%. The weakest link is the 0.50 assumption that the win rate holds. That's the tool doing exactly what it's designed to do.

### Response quality — is the README any good?

```
score_response_quality:
  status: PASS
  overall: 0.621
  substance: 0.948
  specificity: 0.025
  hedge_density: 0.015
  structure: 0.660
```

Substance is strong (0.948). Almost no hedging (0.015). But **specificity is 0.025** — the README describes capabilities without enough inline numbers, thresholds, or measurable conditions. The tool is right: I moved the details to BENCHMARK_REPORT.md for readability, and the README pays a specificity cost for it.

### Arithmetic — do the numbers add up?

```
verify_arithmetic:
  42 defect + 14 clean = 56 total: PASS
  56 scenarios × 3 conditions = 168 rows: PASS
```

### What this proves

The tools find real issues in their own project's claims. The confidence ceiling (0.199) is the most important finding — it's an honest signal that the benchmark evidence, while strong, rests on assumptions I haven't independently validated.

I'm publishing anyway because beta is for getting that independent validation. But the tool says: *don't treat 42/42 as proven until someone else scores the baseline.*

---

## Try It

Without CT-MCP, ask your LLM:

> "We're building a usage-based billing system. Assumptions: (1) billing aggregation query returns correct totals, confidence 0.9; (2) concurrent usage events processed in order, confidence 0.85; (3) payment gateway responds within SLA, confidence 0.95. We are very confident this architecture will handle concurrent usage correctly."

Note whether it challenges the 90% confidence or identifies the race condition.

Then enable CT-MCP and ask the same question. Compare.

---

Built to catch the failures that matter most: the ones where the AI sounds confident but the math doesn't add up.
