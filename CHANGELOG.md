# Changelog

## 0.1.0-beta.2 — 2026-04-08

Second public beta.

- adds a consolidated repo-level roadmap in `ROADMAP.md`
- links the roadmap from the main `README.md`
- bumps the published package and server version to `0.1.0-beta.2`

## 0.1.0-beta.1 — 2026-03-31

First public beta.

- 9 MCP tools: validate_reasoning_chain, check_numeric_claims, verify_arithmetic, detect_drift, evaluate_tradeoffs, check_plan_validity, score_response_quality, validate_confidence, detect_concurrency_patterns
- 15 enforcement mechanisms, all deterministic and stateless
- 56 benchmark scenarios (42 defect + 14 clean control)
- Benchmark results: 42/42 vs baseline, 42/42 vs prompted, 0/14 false positives
- MAD-based outlier detection for small samples
- Geometric ratio fabrication detection
- Arithmetic verification (sum, weighted average, percentage, compound growth, product)
- Concurrency hazard detection (check-then-act, lost update, dual write, missing idempotency, ordering assumptions)
- Monotonicity checking for percentiles and SLA tiers
- Ungrounded entity detection
- Claim classification for tool routing
- Iterative enforcement with explicit caller-provided context
