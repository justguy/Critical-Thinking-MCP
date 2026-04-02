You are continuing work on `critical-thinking-mcp`.

## What this is

A stateless MCP server that applies deterministic mathematical enforcement to LLM reasoning quality. TypeScript, ES modules, @modelcontextprotocol/sdk, stdio transport. No LLM calls in enforcement logic.

## Architecture

- `src/server.ts` — MCP server, 9 tools registered, fresh engine per call
- `src/enforcement/index.ts` — `EnforcementEngine` class wrapping 15 mechanisms
- `src/enforcement/*.ts` — individual mechanisms: confidence_product, specificity_scorer, consistency_checker, hedge_detector, falsifiability_checker, steelman_similarity, revision_contrast, loop_governor, numeric_analysis, arithmetic_verifier, concurrency_checker, claim_classifier, entity_grounding
- `src/tools/*.ts` — 9 tool handlers: validate_reasoning_chain, check_numeric_claims, verify_arithmetic, detect_drift, evaluate_tradeoffs, check_plan_validity, score_response_quality, validate_confidence, detect_concurrency_patterns
- `src/enforcement/types.ts` — all shared types including `EnforcementContext`

## Benchmark

- `benchmark/scenarios.json` — 56 scenarios (42 defect + 14 clean control)
- `benchmark/results/BENCHMARK_RESULTS.json` — V5 canonical results (168 rows)
- `benchmark/reports/BENCHMARK_REPORT.md` — full comparison report
- `benchmark/reports/BILLING_REPORT.md` — flagship billing system analysis
- `benchmark/BENCHMARK_RUNNER_PROMPT.md` — reproducible prompt for running all 56 scenarios

## Current state

- `npm run build` — clean
- `npm test` — 129 tests pass
- Benchmark V5: 42/42 vs baseline, 42/42 vs prompted, 0/14 false positives
- Self-evaluation: honest confidence ceiling 19.9%
- All publication gates pass

## Key design decisions

1. Engine is stateless. Escalation driven by caller-passed `EnforcementContext.failure_counts_by_mechanism`.
2. Assumptions without falsification_condition get confidence capped to 0.3.
3. ENFORCEMENT_FAIL returned as `isError: true` at MCP protocol level.
4. Fabrication uses 4 signals (round ratio + spacing CV + precision CV + geometric regularity).
5. Outlier detection: MAD-primary for small N, Z-score secondary.
6. Arithmetic verification gated by context hint (compound growth only when description mentions rate/interest).
7. Concurrency patterns use structured input (steps + shared_resources + protections), not prose parsing.
8. Indeterminate threshold is relative (5% of top EU), not absolute.

## What's ready

- README with self-evaluation section
- LICENSE (MIT), CHANGELOG
- 10 known gaps documented in `benchmark/benchmark_gaps.json`
- Disclosure and inter-rater reliability (kappa = 0.979) in BENCHMARK_REPORT.md
- 9 tool examples in `examples/`

## What could be improved next

- Independent human scoring of baseline/prompted conditions
- Cross-tool routing via claim classifier (exists but not wired into tool selection)
- Chained arithmetic verification (multi-step formulas)
- Escalate `ordering_assumption` to blocking when no protections listed
