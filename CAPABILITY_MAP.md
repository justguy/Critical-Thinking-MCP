# CT-MCP Capability Map

Benchmark-backed assessment of what CT-MCP catches, partially catches, and does
not catch. Based on the V5 benchmark: 56 scenarios total, 42 defect scenarios,
14 clean controls, 3 conditions (baseline, prompted, ct_mcp). Current beta
results: 42/42 wins vs baseline, 42/42 wins vs prompted, 0/14 false positives
on targeted clean controls.

## Proven Strong

These capabilities consistently outperform both baseline and prompted LLM.

| Capability | Mechanism | Benchmark evidence | Honest claim |
|---|---|---|---|
| Circular reasoning detection | DFS cycle detection on DAGs | S3-C, S3-D, S5-C, L8 all block with explicit cycles | Strong when reasoning is supplied as a graph |
| Confidence inflation enforcement | Dependency-weighted ceiling + falsification cap | S4-C, C4, CONF1, CONF2, billing_system all enforce lower honest ceilings | Reliable when assumptions and confidence claims are structured |
| Tradeoff quantification | Expected utility computation + indeterminate threshold | S2-B, S4-A, S4-B, S4-D produce deterministic rankings or `INDETERMINATE` | Strong on explicitly quantified options |
| Arithmetic mismatch detection | Strict recomputation in `verify_arithmetic` | A2 and A6 both flip from earlier misses to wins vs prompted | Strong on sums, weighted averages, percentages, growth, and products |
| Concurrency hazard detection | Structured pattern matching over steps/resources/protections | P1, P4, CON1-CON5, MUT1-MUT3 all block known hazards | Strong when callers provide structured concurrency flow descriptions |
| Fabrication and anomaly detection | Round-number ratio, spacing CV, precision CV, geometric regularity, MAD/Z-score | S1-B, S1-C, S5-A, S5-D, N8 all surface suspicious numeric structure | Strong on common statistical red flags, not all fabricated data |
| False positive avoidance | Clean-control pass-through | 14/14 clean controls passed without false positives | Strong on the targeted calibration scenarios in the benchmark |

## Improved In This Beta

These areas were weak in earlier internal benchmark iterations and are now
covered by dedicated tools or stronger mechanisms.

| Capability | Current implementation | Benchmark impact |
|---|---|---|
| Arithmetic relationship verification | `verify_arithmetic` handles sums, weighted averages, percentages, growth, and products | A2 and A6 are now wins vs both baseline and prompted |
| Concurrency hazard detection | `detect_concurrency_patterns` checks read-modify-write, check-then-act, missing idempotency, dual write, ordering assumptions | P1, P4, CON1-CON5, MUT1-MUT3 block with named hazard patterns |
| Small-sample outlier detection | MAD-based detection is used for small N, Z-score for larger sets | S1-C and S5-D now surface outliers more reliably |
| Geometric fabrication detection | Ratio-consistency adds a signal beyond simple round-number checks | S1-B moves from a vague suspicion case to a concrete pattern hit |
| Monotonicity enforcement | Numeric monotonicity checks catch impossible percentile or tier ordering | N8 is now a clean win instead of a tie case |

## Partial

These capabilities work in specific conditions but have known limits.

| Capability | Works when | Fails when | Benchmark evidence |
|---|---|---|---|
| Outlier detection | Sample size is reasonable or the outlier is extreme | Very small samples or multiple moderate outliers dilute the signal | S5-D is detected; edge cases remain documented in benchmark gaps |
| Fabrication detection | Data uses round numbers, suspicious spacing, geometric progressions, or monotonicity violations | Fabricated data mimics realistic distributions outside the heuristic set | S1-B and S5-A are strong hits; realistic-looking fabrication remains a gap |
| Response-quality scoring | Text contains detectable hedging, structural weakness, or missing specificity | Semantically wrong but well-structured answers can still score well | S2-A through S2-D show real gains, but domain truth stays out of scope |
| Concurrency analysis | Caller provides ordered steps, shared resources, and protections explicitly | Hazards are embedded in arbitrary prose or code with no structured abstraction | Concurrency benchmark set is strong; free-form understanding is intentionally limited |

## Weak / Not Covered

These are out of scope or require capabilities CT-MCP does not have.

| Capability | Why | Honest scope |
|---|---|---|
| External fact verification | No browsing or world-model lookup in enforcement logic | "Cannot verify whether a claim about the external world is true." |
| Domain-specific correctness | Structural validity is not the same as production readiness | "Checks reasoning quality, not whether the architecture is actually correct." |
| General symbolic math | `verify_arithmetic` covers common arithmetic claims, not arbitrary formulas | "Detects common arithmetic mismatches. Not a general-purpose math engine." |
| Multi-turn memory | The server is stateless between calls | "Caller must pass context explicitly for iterative enforcement." |
| Code execution or code proof | The system reasons over structured claims, numbers, and steps, not running programs | "Checks claims about systems, not the executable systems themselves." |

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

All 15 mechanisms are deterministic and stateless. No LLM calls in enforcement
logic.

## Tool Scope Boundaries

| Tool | Does | Does Not |
|---|---|---|
| `check_numeric_claims` | Fabrication patterns, outliers, monotonicity, geometric regularity | Verify arbitrary formula correctness |
| `verify_arithmetic` | Recompute sums, weighted averages, percentages, growth, products | Detect suspicious statistical patterns |
| `detect_concurrency_patterns` | Flag check-then-act, read-modify-write, missing idempotency, ordering assumptions, dual writes | Understand arbitrary prose concurrency descriptions |
| `validate_reasoning_chain` | Cycle detection, orphan detection, grounding score | Verify domain truth of claims |
| `validate_confidence` | Confidence ceiling, inflation detection, falsification enforcement | Decide whether assumptions are factually true |
| `evaluate_tradeoffs` | Expected utility computation, ranking, indeterminate detection | Evaluate non-quantified tradeoffs |
| `score_response_quality` | Substance, specificity, hedging, structure, entity grounding | Verify external facts |
| `check_plan_validity` | Cycle detection, missing prerequisites, resource conflicts, critical path | Assess plan feasibility or business desirability |
| `detect_drift` | CUSUM drift detection, monotonic progress tracking | Predict future trends |

## Phalanx Integration Boundary

CT-MCP exposes a normalized integration envelope for Project Phalanx via the `integrate_phalanx_check` MCP tool and the `invokePhalanxContract` function in `src/integration/phalanx/`. The envelope accepts a `PhalanxCtCall`, routes to `validate_confidence` (R-6) and/or `validate_reasoning_chain` (R-7) based on payload shape, and returns a deterministic `CtVerdict` with stable `objection_id` hashes, soft-fail transport-error handling, and `mechanism_versions` pinned to `SERVER_INFO.version`. Phalanx owns all pipeline gates, state-machine transitions, and closure truth; CT-MCP is a signal provider only. See [`docs/PHALANX_INTEGRATION_CONTRACT.md`](docs/PHALANX_INTEGRATION_CONTRACT.md) for the full contract specification.
