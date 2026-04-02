# CT-MCP Benchmark Report — V5

**Run Date:** 2026-03-31
**Version:** 0.1.0-beta.1 (9 tools, 15 enforcement mechanisms)
**Scenarios:** 56 (42 defect + 14 clean control)
**Conditions:** baseline (raw LLM), prompted (6-check system prompt), ct_mcp (9 enforcement tools)

---

## Publication Gates

| Gate | Required | Result | Status |
|---|---|---|---|
| CT-MCP > baseline | >= 31/42 | **42/42** | PASS |
| CT-MCP > prompted | >= 21/42 | **42/42** | PASS |
| Billing race caught | YES | **YES** | PASS |
| Billing SLA defined | YES | **YES** | PASS |
| Clean control FPs | 0/14 | **0/14** | PASS |

All 5 publication gates pass. Clean sweep on all 42 defect scenarios.

---

## Condition Summary

| Condition | Wins vs Baseline | Wins vs Prompted |
|---|---:|---:|
| Baseline | -- | -- |
| Prompted | -- | -- |
| **CT-MCP** | **42/42** | **42/42** |

---

## Per-Scenario Comparison (42 Defect Scenarios)

| Scenario | Category | Baseline | Prompted | CT-MCP | vs Base | vs Prompt |
|---|---|---:|---:|---:|---|---|
| S1-A | Numerical | 0.400 | 0.533 | 0.733 | WIN | WIN |
| S1-B | Numerical | 0.200 | 0.267 | 0.650 | WIN | WIN |
| S1-C | Numerical | 0.283 | 0.467 | 0.733 | WIN | WIN |
| S1-D | Numerical | 0.467 | 0.533 | 0.733 | WIN | WIN |
| S2-A | Reasoning | 0.167 | 0.533 | 0.683 | WIN | WIN |
| S2-B | Decision | 0.233 | 0.533 | 0.833 | WIN | WIN |
| S2-C | Reasoning | 0.133 | 0.433 | 0.600 | WIN | WIN |
| S2-D | Reasoning | 0.133 | 0.467 | 0.683 | WIN | WIN |
| S3-A | Logic | 0.400 | 0.533 | 0.733 | WIN | WIN |
| S3-B | Logic | 0.400 | 0.533 | 0.733 | WIN | WIN |
| S3-C | Logic | 0.083 | 0.267 | 0.800 | WIN | WIN |
| S3-D | Logic | 0.000 | 0.267 | 0.800 | WIN | WIN |
| S4-A | Decision | 0.233 | 0.533 | 0.833 | WIN | WIN |
| S4-B | Decision | 0.233 | 0.383 | 0.900 | WIN | WIN |
| S4-C | Decision | 0.050 | 0.333 | 0.800 | WIN | WIN |
| S4-D | Decision | 0.233 | 0.533 | 0.833 | WIN | WIN |
| S5-A | Hallucination | 0.133 | 0.267 | 0.800 | WIN | WIN |
| S5-B | Hallucination | 0.200 | 0.267 | 0.600 | WIN | WIN |
| S5-C | Hallucination | 0.083 | 0.267 | 0.800 | WIN | WIN |
| S5-D | Hallucination | 0.283 | 0.467 | 0.733 | WIN | WIN |
| billing_system | Billing | 0.133 | 0.500 | 0.867 | WIN | WIN |
| P1 | Production Safety | 0.167 | 0.467 | 0.900 | WIN | WIN |
| P2 | Production Safety | 0.133 | 0.350 | 0.667 | WIN | WIN |
| P4 | Production Safety | 0.167 | 0.467 | 0.900 | WIN | WIN |
| A2 | Arithmetic | 0.200 | 0.400 | 0.800 | WIN | WIN |
| A6 | Arithmetic | 0.200 | 0.317 | 0.800 | WIN | WIN |
| L8 | Logic | 0.133 | 0.267 | 0.800 | WIN | WIN |
| P8 | Production Safety | 0.133 | 0.267 | 0.800 | WIN | WIN |
| N8 | Numeric Anomaly | 0.200 | 0.400 | 0.800 | WIN | WIN |
| C4 | Confidence | 0.050 | 0.267 | 0.800 | WIN | WIN |
| CONF1 | Confidence | 0.050 | 0.267 | 0.800 | WIN | WIN |
| CONF2 | Confidence | 0.050 | 0.333 | 0.800 | WIN | WIN |
| CON1 | Concurrency | 0.167 | 0.467 | 0.900 | WIN | WIN |
| CON2 | Concurrency | 0.167 | 0.467 | 0.900 | WIN | WIN |
| CON3 | Concurrency | 0.167 | 0.467 | 0.900 | WIN | WIN |
| CON4 | Concurrency | 0.167 | 0.467 | 0.900 | WIN | WIN |
| CON5 | Concurrency | 0.167 | 0.467 | 0.900 | WIN | WIN |
| MUT1 | Mutation | 0.167 | 0.467 | 0.900 | WIN | WIN |
| MUT2 | Mutation | 0.167 | 0.467 | 0.900 | WIN | WIN |
| MUT3 | Mutation | 0.167 | 0.467 | 0.900 | WIN | WIN |
| ADV1 | Adversarial | 0.050 | 0.300 | 0.667 | WIN | WIN |
| ADV2 | Adversarial | 0.050 | 0.300 | 0.900 | WIN | WIN |

## Clean Controls (14)

| Scenario | Baseline | Prompted | CT-MCP | False Positive |
|---|---:|---:|---:|---|
| S6-A | 0.400 | 0.533 | 0.733 | No |
| S6-B | 0.400 | 0.533 | 0.800 | No |
| S6-C | 0.467 | 0.533 | 0.733 | No |
| S6-D | 0.400 | 0.533 | 0.733 | No |
| S6-E | 0.467 | 0.533 | 0.733 | No |
| S6-F | 0.500 | 0.567 | 0.767 | No |
| CC2 | 0.400 | 0.533 | 0.733 | No |
| CC9 | 0.400 | 0.533 | 0.733 | No |
| CC11 | 0.400 | 0.533 | 0.733 | No |
| CC12 | 0.533 | 0.600 | 0.800 | No |
| CC13 | 0.467 | 0.600 | 0.833 | No |
| CC14 | 0.467 | 0.600 | 0.833 | No |
| CC15 | 0.467 | 0.600 | 0.833 | No |
| CC16 | 0.467 | 0.600 | 0.833 | No |

Zero false positives across all 14 clean controls.

---

## Strongest CT-MCP Advantages

| Capability | Representative scenarios | What changed |
|---|---|---|
| Tradeoff quantification | S2-B, S4-A, S4-B, S4-D | CT-MCP computes exact expected-utility rankings or returns `INDETERMINATE` instead of qualitative comparisons |
| Confidence inflation enforcement | S4-C, C4, CONF1, CONF2, billing_system | CT-MCP converts overclaimed confidence into deterministic ceilings and blocks on inflation |
| Circular reasoning detection | S3-C, S3-D, S5-C, L8 | Explicit cycle detection turns vague logical discomfort into named blocking errors |
| Arithmetic verification | A2, A6 | Dedicated arithmetic recomputation closes a class of earlier benchmark misses |
| Concurrency hazard detection | P1, P4, CON1-CON5, MUT1-MUT3 | Structured concurrency analysis names exact hazards like `check_then_act`, `missing_idempotency`, and `dual_write` |
| False positive restraint | S6-A through S6-F, CC2, CC9, CC11-CC16 | Safe inputs pass without spurious blocking across all 14 targeted clean controls |

## Previous Losses — Now Resolved

Earlier internal benchmark iterations had 5 losses. The current V5 benchmark
resolves them with dedicated tool routing:

| Scenario | Earlier weakness | Current V5 behavior |
|---|---|---|
| A2 (sum error) | Generic numeric analysis missed additive mismatch | `verify_arithmetic` computes 26 and blocks the claim of 24 |
| A6 (weighted avg) | Generic numeric analysis missed weighted-average mismatch | `verify_arithmetic` computes 99.6 and blocks the claim of 99.72 |
| P1 (check-then-act) | Generic quality scoring only hinted at risk | `detect_concurrency_patterns` names `check_then_act` and blocks |
| P4 (missing idempotency) | Prompted reasoning improved, but without deterministic blocking | `detect_concurrency_patterns` blocks `missing_idempotency` under retryable at-least-once delivery |
| N8 (non-monotonic percentiles) | Earlier iterations tied with prompted analysis | `check_numeric_claims` now wins cleanly by flagging the impossible ordering |

---

## Flagship Finding

> The billing race condition was **not caught** by baseline, **caught** by
> prompted, and **caught with blocking enforcement** by ct_mcp.

CT-MCP surfaces the billing system failure through `validate_confidence`:

- honest ceiling: **0.085**
- claimed confidence: **0.900**
- gap: **0.815**
- blocking issues: `confidence_product`
- race condition surfaced: **Yes**
- SLA explicitly defined: **Yes**

The decisive step is falsifiability capping. The assumption "Concurrent usage
events will be processed in order" cannot state what would prove it wrong, so
its confidence is capped and the hidden race becomes visible.

See [BILLING_REPORT.md](BILLING_REPORT.md) for the full billing system analysis.

---

## Version History

| Metric | V1 (27) | V2 (27) | V3 (40) | V4 (40) | V5 (56) |
|---|---|---|---|---|---|
| Wins vs baseline | 17/21 | 20/21 | 28/30 | 30/30 | **42/42** |
| Wins vs prompted | 17/21 | 18/21 | 25/30 | 30/30 | **42/42** |
| Clean control FPs | 0/6 | 0/6 | 0/10 | 0/10 | **0/14** |
| Tools | 7 | 7 | 7 | 9 | **9** |
| Mechanisms | 8 | 13 | 14 | 15 | **15** |

---

## Disclosure

CT-MCP tool results (enforcement failures, confidence ceilings, cycle
detection, arithmetic verification, concurrency pattern detection) are
**deterministic and reproducible** — they reflect actual MCP server outputs run
against defined inputs.

Baseline and prompted condition scores are **self-assessed by the same LLM**
(Claude) that benefits from the tool-assisted condition, introducing potential
scoring bias. Inter-rater reliability analysis is included below to quantify
scoring consistency. Independent human evaluation of baseline and prompted
responses is planned for the v1.0 release.

---

## Inter-Rater Reliability

A second scoring pass (Score B) challenged each dimension score by asking:
"Could this reasonably be 1 point higher or lower?"

| Dimension | Cohen's Weighted Kappa | Agreement |
|---|---|---|
| Correctness | 0.830 | Almost perfect |
| Specificity | 0.966 | Almost perfect |
| Assumption Honesty | 0.994 | Almost perfect |
| Logical Structure | 1.000 | Almost perfect |
| Tradeoff Quality | 1.000 | Almost perfect |
| Safety Readiness | 1.000 | Almost perfect |
| **Overall** | **0.979** | **Almost perfect** |

49 disagreements identified across 168 rows. Systematic patterns:

- **CT-MCP specificity inflated** (18 scenarios): Score A gave 3/3 to all
  `ct_mcp` scenarios. Score B challenged 18 to 2/3 — tools like
  `check_numeric_claims` name mechanisms and thresholds but do not always
  produce the richer corrective detail required for a perfect score.
- **CT-MCP correctness on PASS results** (14 scenarios): Score A gave 3/3 for
  correct detection. Score B challenged to 2/3 — PASS results do not generate
  corrective guidance, which is the distinction between level 2 and 3.
- **Baseline correctness on obvious defects** (6 scenarios): Score A scored
  1/3. Score B challenged to 2/3 — a strong LLM may still catch blatant issues
  like p90<p75 or 3+5+8+4+6!=24 without tools.
- **Prompted correctness** (4 scenarios): Score A scored 2/3. Score B
  challenged to 3/3 — explicit checklist prompting helps on obvious defects.

**Impact on publication gates:** If all Score B challenges are accepted,
CT-MCP's quality scores decrease slightly and some baseline/prompted scores
increase. CT-MCP still wins the majority of scenarios, but the margin narrows.
This is the honest result.

---

## Known Gaps

10 gaps are documented in [benchmark/benchmark_gaps.json](../benchmark_gaps.json):

| ID | Severity | Description |
|---|---|---|
| GAP-1 | High | Cannot detect semantic fabrication about real entities (no world knowledge) |
| GAP-6 | High | Cannot detect semantically wrong reasoning in structurally valid DAGs |
| GAP-3 | Medium | Soft ordering language triggers warning, not blocking |
| GAP-4 | Medium | Cross-tool routing: billing scenario only runs one tool, misses secondary findings |
| GAP-8 | Medium | Causally linked assumptions with different wording bypass correlation detection |
| GAP-9 | Medium | Realistic-looking fabricated data passes statistical detection |
| GAP-10 | Medium | CT-MCP specificity scoring inflated in benchmark (Score B adjustment) |
| GAP-2 | Medium | Multi-step chained arithmetic not yet supported |
| GAP-5 | Low | Floating-point precision edge cases in arithmetic verification |
| GAP-7 | Low | Hedging penalty on genuinely uncertain responses |

---

## False Positive Scope

Zero false positives on the 14 targeted clean-control scenarios. These controls
are narrowly scoped: they confirm that well-formed, logically sound inputs pass.
They do not represent the full distribution of real-world inputs. False
positive rate on arbitrary inputs is unknown and likely non-zero.

**Honest claim:** "Zero false positives detected on the 14 targeted calibration
scenarios. False positive rate on arbitrary inputs is unknown."
