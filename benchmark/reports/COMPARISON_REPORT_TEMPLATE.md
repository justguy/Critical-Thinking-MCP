# Billing System Benchmark: Raw LLM vs Prompted LLM vs CT-MCP

## Benchmark Prompt

> We're building a usage-based billing system. The billing aggregation query computes totals at period boundaries. Concurrent usage events are processed by the pipeline. The payment gateway has a 99.9% uptime SLA. Here are our assumptions and confidence assessment:
>
> Assumption 1: The billing aggregation query will return correct totals (confidence: 0.9)
> Assumption 2: Concurrent usage events will be processed in order (confidence: 0.85)
> Assumption 3: The payment gateway will respond within SLA (confidence: 0.95, falsification: gateway response >2000ms for >5% of requests in 1-minute window)
>
> Overall assessment: We are very confident this billing system architecture will handle concurrent usage correctly.

## Scoring Rubric

| Dimension | Weight | Baseline | Prompted | CT-MCP |
|---|---:|---:|---:|---:|
| Correctness | 25% | 1 | 2 | **3** |
| Specificity | 20% | 1 | 2 | **3** |
| Assumption Honesty | 20% | 1 | **3** | **3** |
| Logical Structure | 15% | 1 | 2 | **3** |
| Tradeoff Quality | 10% | 0 | **2** | 0 |
| Safety Readiness | 10% | 1 | 2 | 2 |
| **Quality Total** | | **0.300** | **0.733** | **0.867** |

## Key Finding

> The race condition was **not caught** by baseline, **caught** by prompted, and **caught** by ct_mcp.

CT-MCP identified it through falsification enforcement: the assumption "Concurrent usage events will be processed in order" could not state a falsification condition, so its confidence was capped from 0.85 to 0.30. This is the mechanism that exposed the hidden ordering assumption as unverified — and therefore as the concurrency hazard.

The prompted LLM also caught the race condition through self-directed analysis (the 6-check system prompt forced it to look for concurrency issues). The difference: CT-MCP's detection is enforced and blocking. The prompted LLM's detection is advisory.

## Outcome Comparison

| Outcome | Baseline | Prompted | CT-MCP |
|---|---|---|---|
| Race condition caught | No | Yes (advisory) | **Yes (blocking)** |
| SLA explicitly defined | No | Yes | **Yes** |
| Confidence inflation detected | No | Partial (self-reported) | **Yes (0.085 ceiling vs 0.900 claimed)** |
| Falsification conditions enforced | No | No | **Yes (2 assumptions capped to 0.30)** |

## The Honest Ceiling Math

```
Assumption 1: "Billing aggregation returns correct totals"
  Stated: 0.90 → Capped to 0.30 (no falsification condition)

Assumption 2: "Concurrent events processed in order"
  Stated: 0.85 → Capped to 0.30 (no falsification condition)
  THIS IS THE RACE CONDITION — ordering is not guaranteed without serialization

Assumption 3: "Payment gateway responds within SLA"
  Stated: 0.95 → Kept (has falsification condition: >2000ms for >5% in 1min)

Honest ceiling: 0.30 × 0.30 × 0.95 = 0.085
Claimed: 0.900
Gap: 0.815
```

## Full Benchmark Context

This is one scenario from a 56-scenario benchmark (42 defect + 14 clean control).

| Gate | Required | Result |
|---|---|---|
| CT-MCP > baseline | >= 31/42 defect scenarios | 42/42 |
| CT-MCP > prompted | >= 21/42 defect scenarios | 42/42 |
| Clean control false positives | 0/14 | 0/14 |

## Replicate This

1. Install: `npm install -g critical-thinking-mcp`
2. Configure your MCP client with `{"mcpServers": {"critical-thinking": {"command": "critical-thinking-mcp"}}}`
3. Ask the billing prompt above without CT-MCP — note what it catches
4. Ask the same prompt with CT-MCP enabled — compare the enforcement output
5. The full benchmark scenarios are in `benchmark/scenarios.json`
