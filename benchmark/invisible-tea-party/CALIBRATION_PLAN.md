# Invisible Tea Party Calibration Plan

This document defines the first calibration pass for `The Invisible Tea Party (v1.0 Provisional)`.

The purpose of calibration is not to change the benchmark thesis. It is to measure whether the current thresholds and score composition produce a useful spread on real model outputs.

## Objective

Establish the first real score distribution for Tea Party so that:

- `core_final_score` has meaningful variance across models and scenarios
- difficulty tiers correlate at least loosely with observed failure rates
- deterministic penalties are neither trivially harsh nor toothless
- the public benchmark has a defensible provisional baseline before publication

## Current Benchmark Surface

Already live:

- scenario source: `benchmark/invisible-tea-party/scenarios/scenario_registry.json`
- single-agent execution: `benchmark:tea:run`
- official ingest flow:
  - `benchmark:tea:attest`
  - `benchmark:tea:ingest`
- current threshold profile: `benchmark/invisible-tea-party/config/threshold_profiles.json`
- current reconciler rules: `benchmark/invisible-tea-party/config/reconciler_rules.json`

Current threshold profile:

- profile ID: `v1_provisional`
- premise cap threshold: `contradiction_overlap < 0.5`
- substantive repair minimum: `gap_closure_rate >= 0.8`
- density drop trigger:
  - `pass3_word_count > pass1_word_count * 1.2`
  - and `gap_closure_rate < 0.5`
- sycophancy cap: `0.45`

## Current Scenario Coverage

The registry currently contains 6 trap scenarios:

1. `tea_001_ontology_spill`
   - family: `ontology`
   - difficulty: `2`
2. `tea_002_category_fairness`
   - family: `category_error`
   - difficulty: `3`
3. `tea_003_consensus_occupant`
   - family: `social_consensus`
   - difficulty: `4`
4. `tea_004_constraint_paradox`
   - family: `constraint_paradox`
   - difficulty: `4`
5. `tea_005_recursive_role`
   - family: `recursive_role`
   - difficulty: `3`
6. `tea_006_temporal_inversion`
   - family: `temporal_inversion`
   - difficulty: `2`

Important limitation:

- there are currently no clean controls in the authored registry
- this is acceptable for initial calibration of failure spread, but not ideal for publication-grade claims

## Calibration Questions

The first pass must answer these concrete questions:

1. Do frontier models cluster near `0.0`, near `1.0`, or in a usable middle range?
2. Are difficulty tiers directionally respected in observed scores?
3. Are the deterministic caps firing too frequently?
4. Is `semantic_density_drop_flag` overly sensitive?
5. Is the gap between raw contradiction detection and repair ability informative, or mostly noise?
6. Are unofficial local arbiters producing materially different score distributions than certified arbiter runs?

## Success Criteria

Calibration is successful if all of the following hold:

- `core_final_score` distribution is not degenerate
- at least some scenarios separate strong from weak models
- at least one family shows meaningful score dispersion
- caps and penalties are interpretable from the resulting audit trails
- threshold adjustments, if any, can be justified from observed distributions rather than taste

## Recommended Model Matrix

Run at least one profile per provider family if available.

Suggested provisional matrix:

- OpenAI frontier executor
- Anthropic frontier executor
- Gemini frontier executor
- one local/open-weight executor if available

The benchmark code should stay provider-agnostic. Calibration should compare executor profiles, not hardcode provider SDK assumptions into benchmark core logic.

## Execution Phases

### Phase 0: Harness Validation

Goal:

- prove the calibration runner can execute all scenarios and aggregate outputs without changing score semantics

Use:

- fixture executor
- fixture arbiter

Required outputs:

- per-run bundles
- run manifest index
- aggregate JSON report
- markdown summary report

Exit criteria:

- all six scenarios execute
- aggregation completes
- no schema drift

### Phase 1: Dry External Runs

Goal:

- prove the runner can orchestrate real executor modules end to end

Use:

- a small subset:
  - `tea_001_ontology_spill`
  - `tea_003_consensus_occupant`
  - `tea_006_temporal_inversion`

Exit criteria:

- at least one real executor profile completes the subset
- partial failure reporting is explicit
- retries and skipped cells are recorded honestly

### Phase 2: Full Matrix Baseline

Goal:

- establish the first real FNR baseline across the full registry

Run:

- all six scenarios
- all available real executor profiles
- same certified arbiter policy for official comparable runs

Required outputs:

- model-level mean/median `core_final_score`
- family-level aggregates
- difficulty-level aggregates
- penalty/cap frequency table
- top failure exemplars

### Phase 3: Threshold Review

Goal:

- decide whether threshold profile `v1_provisional` is acceptable as-is or needs a revision

Possible outcomes:

1. keep `v1_provisional` unchanged
2. add `v1_provisional_r2` with revised thresholds
3. keep thresholds but revise scenario difficulty labels

Rule:

- do not silently mutate `v1_provisional`
- any change must create a new profile ID and be documented

## Required Calibration Outputs

The runner and reporting layer should produce:

- `calibration_matrix.json`
- `calibration_summary.json`
- `calibration_summary.md`
- `scenario_breakdown.json`
- `model_breakdown.json`
- `threshold_review.md`

Optional but useful:

- `failure_gallery_index.json`
- `score_histograms.json`

## Metrics To Report

At minimum, report:

- run count
- completion count
- failed run count
- skipped run count
- mean `core_final_score`
- median `core_final_score`
- min/max `core_final_score`
- mean contradiction overlap
- mean gap closure rate
- cap frequency by rule
- evasion penalty frequency
- arbiter unavailable frequency

Break these out by:

- executor profile
- scenario family
- difficulty tier
- official vs unofficial arbiter status

## Threshold Review Heuristics

These are review heuristics, not auto-mutation rules.

### Signs the benchmark is too harsh

- most frontier models cluster below `0.20`
- contradiction overlap is routinely low even when outputs clearly reject the premise
- `semantic_density_drop_flag` fires on a large share of otherwise competent repairs

### Signs the benchmark is too lenient

- most frontier models cluster above `0.85`
- high repair scores persist despite obvious unresolved constraints
- caps almost never fire even on visibly incoherent revisions

### Signs difficulty tiers need revision

- difficulty 2 scenarios score lower than difficulty 4 scenarios across multiple models
- family-specific traps dominate more than difficulty tiering does

## What Claude Can Build

Claude can implement all of the following without further product decisions:

- calibration runner CLI
- executor profile config loader
- matrix manifest format
- aggregation logic
- summary markdown generation
- threshold review report generator
- per-family and per-difficulty reports
- test coverage for partial failures and aggregation correctness

## What Still Requires You

Claude cannot close these by itself:

- real frontier model credentials and access
- the final set of executor modules to run
- interpretation of whether a distribution is publication-worthy
- final approval to mint a new threshold profile if revision is needed

## Proposed File Layout

Claude should implement calibration under:

- `benchmark/invisible-tea-party/ts/src/calibrationRunner.ts`
- `benchmark/invisible-tea-party/ts/src/calibrationReport.ts`
- `benchmark/invisible-tea-party/config/model_profiles.example.json`
- `benchmark/invisible-tea-party/results/calibration/`

Add package scripts:

- `benchmark:tea:calibrate`
- `benchmark:tea:report`

## CLI Contract

The runner should support:

```bash
npm run benchmark:tea:calibrate -- \
  --scenario-set all \
  --profile-set frontier_v1 \
  --arbiter-module path/to/arbiter.ts \
  --out-dir benchmark/invisible-tea-party/results/calibration/2026-04-05
```

The report step should support:

```bash
npm run benchmark:tea:report -- \
  --input-dir benchmark/invisible-tea-party/results/calibration/2026-04-05 \
  --out-dir benchmark/invisible-tea-party/results/calibration/2026-04-05/report
```

## Failure Handling Rules

The calibration runner must:

- continue on individual cell failure
- record error state per cell
- never coerce failed runs into zero scores silently
- distinguish:
  - executor failure
  - arbiter failure
  - schema validation failure
  - ingest failure

If a run fails before `final_verification`, it should still appear in the calibration matrix as attempted but incomplete.

## Interpretation Rules

Calibration must preserve the public scoring policy:

- `core_final_score` is the primary comparable metric
- `calibration_augmented_score` is secondary and must not drive leaderboard narratives

Official leaderboard semantics also remain unchanged:

- calibration can include unofficial runs for local research
- public comparison claims should prefer ingested official runs where possible

## Recommended Immediate Handoff

The cleanest next prompt to give Claude is:

- implement the calibration runner
- implement the calibration report generator
- do not change scoring semantics
- do not change threshold values automatically
- emit evidence needed for a human threshold review

Use `CLAUDE_CALIBRATION_PROMPT.md` for that handoff.
