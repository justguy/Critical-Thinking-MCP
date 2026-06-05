You are continuing work on `critical-thinking-mcp`.

## What this is

A stateless MCP server positioned as a **deterministic release gate for structured agent deliverables**
(not a reasoning-improvement tool — Phase 4 showed the heavy gate does not improve a strong model's
reasoning or repair; see `docs/PHASE4_RESULTS.md`). It applies deterministic mathematical enforcement over
structured input. TypeScript, ES modules, @modelcontextprotocol/sdk, stdio transport. No LLM calls in
enforcement logic.

## Architecture

- `src/server.ts` — MCP server, fresh engine per call
- `src/enforcement/index.ts` — `EnforcementEngine` class wrapping 15 mechanisms
- `src/enforcement/*.ts` — individual mechanisms: confidence_product, specificity_scorer, consistency_checker, hedge_detector, falsifiability_checker, steelman_similarity, revision_contrast, loop_governor, numeric_analysis, arithmetic_verifier, concurrency_checker, claim_classifier, entity_grounding
- `src/tools/*.ts` — public tool handlers: 9 benchmarked analyzers plus `plan_checks`, `finalize_deliverable`, and the `review_before_final` facade; deliverable leaf checks are internalized behind finalize
- `src/enforcement/types.ts` — all shared types including `EnforcementContext`

## Tool surface and discovery (default-minimal)

The public surface is an **11-tool spine** (9 analyzers + `plan_checks` + `finalize_deliverable`) plus the
**`review_before_final` facade** = **12 public tools**. The facade is deterministic and **never blocks**:
given `{task_type, original_request, draft_answer, mode, risk_level?}` it returns
`{checklist[], critique_questions[], artifact_template?, enforce_required?, corrective_prompt?}`. Modes:
`checklist` (default) / `artifact` / `enforce`. Its `artifact` templates are gate-compatible (grounded
`GroundingClaim` shape; numeric defaults to the light `{answer_text, structured_answer}` constraint shape).
Enforce mode only **signals** (sets `enforce_required` + a `corrective_prompt` pointing at
`finalize_deliverable` / `ct-enforce`); it does not run the gate.

The same per-task-type checklists are exposed as **6 reusable MCP prompts** via `prompts/list` +
`prompts/get`: `review_plan`, `stress_architecture`, `review_decision`, `verify_research_answer`,
`audit_numeric_analysis`, `review_before_final`.

**Discovery is default-minimal.** `tools/list` advertises **only `review_before_final`** (+ the 6 prompts)
by default; the 11-tool spine is hidden from discovery but still **callable** via `tools/call`. Opt into
advertising the full surface with **`CT_EXPOSE_ALL=1`** (→ all 12; `CT_DISABLE_FINALIZE` then composes to
drop `finalize_deliverable` → 11). Hiding is discovery-only. `ct-enforce` is the host-side CLI for the
single-call release gate (the strict/enforce tail).

## Integration Boundary Work

Recent integration work adds a normalized adapter envelope over existing CT tools, tighter pre-dispatch validation aligned to underlying tool minimums, and explicit boundary tests around the public tool surface.

## Benchmark

- `benchmark/scenarios.json` — 56 scenarios (42 defect + 14 clean control)
- `benchmark/results/BENCHMARK_RESULTS.json` — V5 canonical results (168 rows)
- `benchmark/reports/BENCHMARK_REPORT.md` — full comparison report
- `benchmark/reports/BILLING_REPORT.md` — flagship billing system analysis
- `benchmark/BENCHMARK_RUNNER_PROMPT.md` — reproducible prompt for running all 56 scenarios

## Current state

- `npm run build` — clean
- Benchmark V5: detected the planted defect in 42/42 hand-crafted defect scenarios, 0/14 false positives — **detection quality of the tools in isolation on a hand-crafted corpus, not a vs-baseline win** (the baseline/prompted rows were synthetic placeholders; a measured head-to-head is not reproducible)
- **Phase 4 concluded** (`docs/PHASE4_RESULTS.md`): on a strong model the gate does **not** improve reasoning or repair; what is proven is deterministic catching of injected defects (106/106 blocked, 0/41 false-block on 147 hand-edited bundles, CI-backed). Repair/binding nulls are directional (n=6).
- **Phase 5 concluded** (`docs/PHASE5_RESULTS.md`): `ct-enforce` reduces false releases at low friction when contracts are authored per `docs/designs/HOST_CONTRACT_AUTHORING.md` (curated 16/16 violations blocked, 0/14 good blocked; corrected re-run `ship_worthy=true`).
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

Honest open gaps (full list: `docs/PHASE4_RESULTS.md` and `docs/PHASE5_RESULTS.md`):

- Independent human scoring of baseline/prompted conditions
- A weaker-model arm and a larger, fair-budget repair run (the Phase-4 repair/binding nulls are directional, n=6, no CI; decode is not pinnable without `--temperature`/`--seed`)
- Injected-defect mutators for the 4 section-7 blocker codes that lack them (UNDECLARED_ASSUMPTION, OPTION_COVERAGE_GAP, PROFILE_DOWNGRADE, FINAL_ANSWER_ARTIFACT_DRIFT); blocker_code_accuracy is a labeling-routing diagnostic, not a recall gap
- Producing grounding-heavy deliverables single-shot is still hard; the façade `artifact` mode helps, but the model still makes real grounding errors the gate correctly catches
- Cross-tool routing via claim classifier (exists but not wired into tool selection)
- Chained arithmetic verification (multi-step formulas)
- Escalate `ordering_assumption` to blocking when no protections listed
