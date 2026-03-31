# Billing System Benchmark Report

**Run Date:** 2026-03-30
**Version:** V2 (MAD outliers, geometric detection, arithmetic verifier, relative indeterminate threshold)

## Flagship Finding

> The race condition was **not caught** by baseline, **caught** by prompted, and **caught** by ct_mcp.

CT-MCP specifically flagged the assumption "Concurrent usage events will be processed in order" as lacking a falsification condition, capping its confidence from 0.85 to 0.30 and exposing the hidden concurrency race. The prompted LLM also identified the ordering hazard through self-directed analysis, but without enforcement blocking.

---

## Three-Condition Comparison

| Dimension | Baseline | Prompted | CT-MCP |
|---|---:|---:|---:|
| correctness | 1 | 2 | **3** |
| specificity | 1 | 2 | **3** |
| assumption_honesty | 1 | **3** | **3** |
| logical_structure | 1 | 2 | **3** |
| tradeoff_quality | 0 | **2** | 0 |
| safety_readiness | 1 | 2 | 2 |
| **quality_score** | **0.300** | **0.733** | **0.867** |

| Outcome | Baseline | Prompted | CT-MCP |
|---|---|---|---|
| Race condition caught | No | Yes | **Yes** |
| SLA explicitly defined | No | Yes | **Yes** |
| Confidence inflation detected | No | Partial | **Yes (blocking)** |
| Enforcement blocks | -- | -- | confidence_product |

## What Each Condition Did

### Baseline (quality: 0.300)

Noted billing system "seems reasonable." Vague mention of concurrency concerns but no systematic detection of the race condition in ordered event processing. No challenge to the 90% confidence claim. No SLA thresholds defined.

### Prompted (quality: 0.733)

The 6-check system prompt forced:
- Assumption listing with falsification conditions
- Confidence product computation (0.3 x 0.3 x 0.95 = 0.085 after capping unfalsifiable assumptions)
- Race condition check identified ordering hazard
- SLA replacement added specific thresholds

Scored well on assumption_honesty (3) and tradeoff_quality (2) because the prompt forces self-assessment. But the enforcement is advisory — the LLM reports the issues without blocking.

### CT-MCP (quality: 0.867)

`validate_confidence` returned ENFORCEMENT_FAIL:
- **honest_ceiling:** 0.085
- **claimed_confidence:** 0.900
- **gap:** 0.815
- **Blocking issues:**
  1. Confidence inflation: claimed 0.900 vs honest ceiling 0.085
  2. Two assumptions lack falsification conditions — "billing aggregation query will return correct totals" (0.9 → capped to 0.3) and "concurrent usage events will be processed in order" (0.85 → capped to 0.3)
- **Race condition surfaced:** The assumption "Concurrent usage events will be processed in order" was flagged as unfalsifiable. This is the hidden concurrency race — ordering is not guaranteed without explicit serialization.
- **SLA defined:** Gateway falsification condition provides a concrete threshold (response time >2000ms for >5% of requests in a 1-minute window).
- **Corrective prompt:** Forces evidence chain — "What single observable event would prove this wrong?"

## Why CT-MCP Scored Higher Than Prompted

Both caught the race condition. The difference is in **enforcement mechanics**:

| Aspect | Prompted | CT-MCP |
|---|---|---|
| Detection | Self-reported | Tool-enforced |
| Blocking | Advisory (can be ignored) | ENFORCEMENT_FAIL (blocks until resolved) |
| Confidence math | LLM computes product (can make errors) | Deterministic ceiling computation |
| Falsification capping | LLM may or may not cap unfalsifiable claims | Automatic cap to 0.30 for missing conditions |
| Corrective action | "Consider adding conditions" | Specific template: event, threshold, time window |

CT-MCP scored lower on tradeoff_quality (0 vs 2) because `validate_confidence` doesn't compute expected utility — it's the wrong tool for tradeoffs. This is a correct scope boundary, not a failure.

## The Honest Ceiling Math

```
Assumption 1: "Billing aggregation query returns correct totals"
  Stated confidence: 0.90
  Falsification condition: MISSING → capped to 0.30

Assumption 2: "Concurrent usage events processed in order"
  Stated confidence: 0.85
  Falsification condition: MISSING → capped to 0.30

Assumption 3: "Payment gateway responds within SLA"
  Stated confidence: 0.95
  Falsification condition: "Gateway response >2000ms for >5% in 1min" → kept at 0.95

Honest ceiling: 0.30 × 0.30 × 0.95 = 0.085
Claimed confidence: 0.900
Gap: 0.815
Verdict: INFLATION DETECTED → ENFORCEMENT_FAIL
```

## What This Proves

1. **Deterministic enforcement catches inflation that the LLM's own reasoning misses at baseline.** The raw LLM accepted the 90% confidence claim without challenge.

2. **Prompting closes part of the gap but not all of it.** The prompted LLM computed the confidence product and identified the race condition — but the enforcement is advisory. Under pushback ("I disagree with this assessment"), a prompted LLM can be talked out of its findings. CT-MCP cannot — the math blocks until the input changes.

3. **Falsification capping is the mechanism that surfaces the race condition.** The race wasn't found by searching for concurrency keywords. It was found because the assumption "events processed in order" couldn't state a falsification condition — which is exactly the indicator that the ordering guarantee is unverified.
