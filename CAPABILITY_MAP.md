# CT-MCP Capability Map

Benchmark-backed assessment of what CT-MCP catches, partially catches, and does not catch. Based on 56-scenario benchmark (42 defect + 14 clean control) with 3 conditions (baseline, prompted, ct_mcp). V5 results: 42/42 vs baseline, 42/42 vs prompted. 0/14 false positives. All publication gates pass.

## Proven Strong

These capabilities consistently outperform both baseline and prompted LLM.

| Capability | Mechanism | Benchmark evidence | Delta vs baseline |
|---|---|---|---|
| Circular reasoning detection | DFS cycle detection on DAG | S3-C, S3-D, S5-C: 0.733 vs 0.000 | +0.733 |
| Confidence inflation enforcement | Dependency-weighted ceiling + falsification cap | S4-C: 0.750, billing: 0.817 | +0.600 avg |
| Tradeoff quantification | Expected utility computation | S2-B, S4-A, S4-B, S4-D: 0.783 consistent | +0.550 avg |
| Hedge detection | Sentence-level hedging density | S2-A, S2-D: 0.533 vs 0.133 | +0.400 |
| Specificity enforcement | Technical marker density + conditional check | S2-C: 0.533 vs 0.133 | +0.400 |
| Indeterminate detection | EU spread threshold | S4-B: correctly flags near-tie | N/A (qualitative) |
| Fabrication detection (round numbers) | Round-number ratio + spacing CV + precision CV + geometric ratio | S5-A: high suspicion on all-round data | +0.483 |
| False positive avoidance | Clean control pass-through | 0/6 false positives | 0 (correct) |

## Improved (v0.1.1)

These were weak in v0.1.0 and fixed with targeted mechanisms.

| Capability | Fix | Expected benchmark impact |
|---|---|---|
| Small-sample outlier detection | MAD-based detection (robust to single-outlier std inflation) | S1-C, S5-D: MISSED → DETECTED |
| Geometric pattern detection | Ratio consistency check for constant-ratio sequences | S1-B: low → moderate suspicion |
| Arithmetic relationship verification | Sum, product, compound growth, weighted average, ratio checks | S1-D, S3-B: new arithmetic layer adds specificity |
| Concurrency hazard detection | Pattern matching for check-then-act, read-modify-write, missing boundaries | Billing: deeper race condition analysis |
| Claim typing | Routes claims to appropriate tools by type | Prevents routing errors (formula → fabrication checker) |

## Partial

These work in specific conditions but have known limits.

| Capability | Works when | Fails when | Benchmark evidence |
|---|---|---|---|
| Outlier detection | N >= 6, outlier is extreme | N < 5, multiple moderate outliers | S5-D: now detected with MAD |
| Fabrication detection | Round numbers, geometric sequences | Non-random patterns outside heuristic set | S1-B: moderate, not high |
| Steelman quality | Paraphrase and strawman detected | Genuine extension assessment is coarse | Test 14a/14b pass |
| Revision quality | Component + condition + behavior check | Semantic adequacy requires domain knowledge | Test 15a/15b pass |

## Weak / Not Covered

These are out of scope or require capabilities CT-MCP does not have.

| Capability | Why | Honest scope |
|---|---|---|
| Arithmetic correctness | `check_numeric_claims` targets fabrication, not formula verification. Arithmetic verifier added in v0.1.1 but limited to common patterns. | "Detects common arithmetic relationships. Not a general-purpose calculator." |
| External fact verification | Cannot verify that "Xeldon.js" doesn't exist without browsing | "Cannot verify entities from provided context alone." |
| Domain-specific correctness | Cannot assess whether a Redis config is production-ready | "Checks reasoning structure, not domain truth." |
| Multi-turn conversation analysis | Stateless — each call is independent | "Context must be explicitly provided by caller." |
| Code correctness | Does not parse or execute code | "Checks claims about code, not the code itself." |

## Mechanism Inventory

| # | Mechanism | File | Deterministic | Stateless |
|---|---|---|---|---|
| 1 | Confidence product ceiling | confidence_product.ts | Yes | Yes |
| 2 | Specificity scoring | specificity_scorer.ts | Yes | Yes |
| 3 | Consistency checking | consistency_checker.ts | Yes | Yes |
| 4 | Hedge detection | hedge_detector.ts | Yes | Yes |
| 5 | Falsifiability checking | falsifiability_checker.ts | Yes | Yes |
| 6 | Steelman similarity | steelman_similarity.ts | Yes | Yes |
| 7 | Revision contrast | revision_contrast.ts | Yes | Yes |
| 8 | Loop governance | loop_governor.ts | Yes | Yes |
| 9 | Fabrication detection | index.ts (detectFabricationImpl) | Yes | Yes |
| 10 | Outlier detection (MAD + Z-score) | index.ts (findOutliersImpl) | Yes | Yes |
| 11 | Arithmetic verification | arithmetic_verifier.ts | Yes | Yes |
| 12 | Concurrency hazard detection | concurrency_checker.ts | Yes | Yes |
| 13 | Claim classification | claim_classifier.ts | Yes | Yes |
| 14 | Ungrounded entity detection | entity_grounding.ts | Yes | Yes |
| 15 | Monotonicity checking | numeric_analysis.ts | Yes | Yes |

All 15 mechanisms are deterministic and stateless. No LLM calls in enforcement logic.

## Tool Scope Boundaries

| Tool | Does | Does Not |
|---|---|---|
| `check_numeric_claims` | Fabrication patterns, outliers, monotonicity, geometric regularity | Verify formula correctness |
| `verify_arithmetic` | Recompute sums, weighted averages, percentages, growth, products | Detect suspicious patterns |
| `detect_concurrency_patterns` | Flag check-then-act, missing idempotency, ordering assumptions | Understand arbitrary prose concurrency descriptions |
| `validate_reasoning_chain` | Cycle detection, orphan detection, grounding score | Verify domain truth of claims |
| `validate_confidence` | Confidence ceiling, inflation detection, falsification enforcement | Assess whether assumptions are factually correct |
| `evaluate_tradeoffs` | Expected utility computation, indeterminate detection | Evaluate non-quantified tradeoffs |
| `score_response_quality` | Substance, specificity, hedging, structure, entity grounding, text concurrency scan | Verify external facts |
| `check_plan_validity` | Cycle detection, missing prerequisites, resource conflicts, critical path | Assess plan feasibility or quality |
| `detect_drift` | CUSUM drift detection, monotonic progress tracking | Predict future trends |
