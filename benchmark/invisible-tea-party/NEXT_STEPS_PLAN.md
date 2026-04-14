# Invisible Tea Party Next Steps Plan

This file defines the post-execution work now that the single-agent benchmark path is live.

Execution is sufficiently complete to move into benchmark hardening. The remaining work is no longer “make the benchmark run”; it is “make the benchmark credible, publishable, and operationally useful.”

## Current Baseline

Already in place:

- scenario registry under `benchmark/invisible-tea-party/scenarios/scenario_registry.json`
- Pass 1 -> Pass 2 -> Pass 3 benchmark loop
- Pass 4A deterministic verifier
- Pass 4B BYOE arbiter verifier
- Pass 4C reconciler
- schema validation with `ajv`
- officiality trust boundary:
  - `benchmark:tea:run`
  - `benchmark:tea:attest`
  - `benchmark:tea:ingest`

Not yet in place:

- calibration matrix runner
- aggregate score reporting across models
- human baseline packet and scorer
- telemetry comparison mode
- publishable scorecard/failure gallery renderer

## Recommended Order

1. Calibration runner and aggregate reports
2. Publishable scorecard and failure gallery
3. Human baseline packet and ingestion
4. Telemetry comparison instrumentation

Reason:

- `1` gives the first real benchmark distributions.
- `2` turns those distributions into assets people can understand and share.
- `3` strengthens the research story.
- `4` ties the public benchmark to operational telemetry and real execution evidence.

## Workstream 1: Calibration Runner

### Goal

Run the scenario registry across multiple model/executor profiles and produce a comparable score distribution for threshold tuning.

### What Claude Can Implement

Claude can implement the full technical substrate for calibration:

- a matrix runner over scenarios and executor profiles
- result directory conventions
- bundle naming and metadata
- aggregate JSON output
- markdown summary tables
- percentile and histogram summaries
- per-family and per-difficulty breakouts

### Suggested Deliverables

Add:

- `benchmark/invisible-tea-party/ts/src/calibrationRunner.ts`
- `benchmark/invisible-tea-party/ts/src/calibrationReport.ts`
- `benchmark/invisible-tea-party/config/model_profiles.example.json`
- `benchmark/invisible-tea-party/results/.gitkeep`

Add scripts:

- `benchmark:tea:calibrate`
- `benchmark:tea:report`

### Required Inputs

These still require you:

- actual executor modules for frontier models
- actual credentials / environment for those models

### Execution Contract

Claude should build a runner that supports:

```bash
npm run benchmark:tea:calibrate -- \
  --scenario-set all \
  --profile-set frontier_v1 \
  --out-dir benchmark/invisible-tea-party/results/calibration/2026-04-05
```

Outputs should include:

- per-run bundles
- a manifest of all attempted runs
- aggregate metrics by model
- aggregate metrics by scenario family
- aggregate metrics by difficulty tier
- a threshold-tuning report

### Acceptance Criteria

- runs multiple scenarios and profiles without changing benchmark semantics
- computes model-level distributions for `core_final_score`
- surfaces outliers and score clustering
- identifies thresholds that are too lenient or too punitive

### Where This May Break

- frontier executor adapters may produce inconsistent confidence fields
- retries and rate limits may create partial matrices
- too few scenarios will make tuning noisy
- deterministic extraction may under-recall valid contradiction detection in free-form outputs

## Workstream 2: Publishable Scorecard and Failure Gallery

### Goal

Generate assets that are readable by humans and shareable online.

### What Claude Can Implement

Claude can implement this end to end:

- standalone HTML scorecard generator
- batch failure gallery generator
- top failures index page
- print-friendly and screenshot-friendly styles

### Suggested Deliverables

Add:

- `benchmark/invisible-tea-party/ts/src/renderScorecard.ts`
- `benchmark/invisible-tea-party/ts/src/renderFailureGallery.ts`
- `benchmark/invisible-tea-party/templates/` only if needed

Add scripts:

- `benchmark:tea:render-scorecard`
- `benchmark:tea:render-gallery`

### Required Inputs

No new product decision is required. Claude can build this now.

### Acceptance Criteria

- renders directly from real bundle artifacts
- works for official and unofficial runs
- shows penalties, caps, conflicts, and arbiter status honestly
- looks publishable without manual design cleanup

### Where This May Break

- if the renderer leans too hard on dark-dashboard tropes, it will look like internal tooling instead of a public research artifact
- screenshots become misleading if the layout hides caveats like unofficial status or arbiter unavailability

## Workstream 3: Human Baseline Packet

### Goal

Create a human-review baseline so the benchmark can make the stronger claim that coherent nonsense is a general cognitive failure mode, not only an LLM failure mode.

### What Claude Can Implement

Claude can implement the package and ingestion path:

- blinded scenario packet generator
- randomized ordering
- response schema
- scoring rubric forms
- ingestion CLI for human responses
- aggregate comparison report: human vs model

### Suggested Deliverables

Add:

- `benchmark/invisible-tea-party/ts/src/humanBaselinePacket.ts`
- `benchmark/invisible-tea-party/ts/src/humanBaselineIngest.ts`
- `benchmark/invisible-tea-party/human/response_schema.json`
- `benchmark/invisible-tea-party/human/rubric.md`

Add scripts:

- `benchmark:tea:human-pack`
- `benchmark:tea:human-ingest`

### Required Inputs

These still require you:

- actual humans
- participant recruiting
- at least a small cohort and collection window

### Acceptance Criteria

- packet is truth-blind enough to avoid leaking benchmark answers
- responses can be ingested into a structured format
- model and human outputs can be compared on the same scenario IDs

### Where This May Break

- a poorly blinded packet will contaminate the human baseline
- non-expert participants may confuse literary metaphor with literal reasoning failure
- too-small cohorts will produce weak claims

## Workstream 4: Telemetry Comparison

### Goal

Show how the benchmarked failure mode appears in real execution loops and what the arbiter catches before low-quality revisions compound.

### Current Reality

There is no `SHADOW_COMPARE` implementation in this repo yet.

That means Claude can build the instrumentation framework, but it cannot fabricate production telemetry or claim savings that have not been observed.

### What Claude Can Implement

Claude can implement:

- a shadow-compare event schema
- a local compare runner
- structured telemetry emission
- bundle-to-telemetry mapping
- rollup reports for catches, reversals, and prevented retries

### Suggested Deliverables

Add:

- `src/gemma/shadowCompareRunner.js`
- `src/gemma/shadowCompareSchemas.js`
- `benchmark/invisible-tea-party/ts/src/telemetryReport.ts`

Add scripts:

- `benchmark:tea:shadow-compare`
- `benchmark:tea:telemetry-report`

### Required Inputs

These still require you:

- the real execution environment where shadow mode runs
- the definition of the review loop to instrument
- the operational definition of “blocked waste” or “prevented bad revision”

### Acceptance Criteria

- captures events without blocking the normal execution path
- records benchmark-like failure signatures in real agent loops
- produces a report you can cite without hand-editing

### Where This May Break

- if event capture is too coarse, contagion and correction will be impossible to attribute
- if shadow mode changes agent behavior, the telemetry will not be clean
- if “waste avoided” is not defined rigorously, the resulting claims will look inflated

## What To Give Claude Next

These are the concrete work orders that are safe to assign now.

### Highest-Leverage Immediate Task

Ask Claude to implement:

- calibration runner
- aggregate calibration report
- scorecard renderer

Those three together unlock:

- threshold tuning
- first comparative runs
- public-facing visuals

### Next Safe Task

Ask Claude to implement:

- human baseline packet generator
- human response ingestion
- human vs model comparison report

### Product-Facing Task

Ask Claude to implement:

- telemetry comparison schema
- local compare mode
- telemetry rollup report

Only do this after you define the real execution loop you want instrumented.

## What Still Requires You

Claude can close most of the engineering work. The remaining non-closable pieces are:

- frontier model access and credentials
- participant recruitment for the human baseline
- real shadow execution environment
- publication/editorial decisions about which runs become the public reference set

## Recommended Claude Sequence

1. Use `CLAUDE_SCOREBOARD_PROMPT.md` to get the scorecard renderer built.
2. Then assign calibration runner + report generation.
3. Then assign human baseline packet + ingest path.
4. Then assign telemetry comparison only after the target execution loop is named.

## Exit Criteria For “Ready To Publish”

The benchmark is ready for an initial public push when all of the following are true:

- at least one real model matrix has been run
- score distributions are not degenerate
- scorecard and failure gallery assets render cleanly
- public examples can be shown from ingested bundles
- the benchmark is labeled `v1.0 Provisional`
- claims are limited to what the collected evidence actually supports
