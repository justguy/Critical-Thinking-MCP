# Claude Calibration Prompt

Use this prompt with Claude to implement the Tea Party calibration runner and reporting layer.

## Prompt

You are implementing the calibration subsystem for:

`The Invisible Tea Party: A Benchmark for Coherence vs Truth`

Work inside this repo only. Use the existing Tea Party run, attest, ingest, schema, and scoring flow as the source of truth. Do not change benchmark scoring semantics while implementing calibration.

### Read first

- `benchmark/invisible-tea-party/README.md`
- `benchmark/invisible-tea-party/PASS_SCHEMA.md`
- `benchmark/invisible-tea-party/PASS4_ARCHITECTURE.md`
- `benchmark/invisible-tea-party/NEXT_STEPS_PLAN.md`
- `benchmark/invisible-tea-party/CALIBRATION_PLAN.md`

### Existing benchmark surface

Canonical root:

- `benchmark/invisible-tea-party/`

Existing runtime:

- `benchmark/invisible-tea-party/ts/src/cli.ts`
- `benchmark/invisible-tea-party/ts/src/pipeline.ts`
- `benchmark/invisible-tea-party/ts/src/scenarioRegistry.ts`
- `benchmark/invisible-tea-party/ts/src/moduleLoader.ts`
- `benchmark/invisible-tea-party/ts/src/config.ts`
- `benchmark/invisible-tea-party/ts/src/attest.ts`
- `benchmark/invisible-tea-party/ts/src/ingest.ts`

Existing schemas and models:

- `benchmark/invisible-tea-party/ts/src/models.ts`
- `benchmark/invisible-tea-party/ts/src/schemaValidation.ts`

Current threshold profile:

- `benchmark/invisible-tea-party/config/threshold_profiles.json`

### Objective

Build a calibration runner that executes multiple Tea Party scenarios across multiple executor profiles and produces aggregate reports for threshold review.

The implementation must be provider-agnostic and must not add provider SDK dependencies into benchmark core logic.

### Hard requirements

1. Use repo-native TypeScript/Node.
2. Do not change the meaning of `core_final_score`.
3. Do not silently mutate threshold profiles.
4. Continue on per-cell failures and record them explicitly.
5. Emit machine-readable outputs and a human-readable markdown summary.
6. Preserve official vs unofficial distinction; do not fabricate officiality.
7. Use actual benchmark bundle artifacts, not mock summary records disconnected from the real run outputs.

### Deliverables

Implement:

- `benchmark/invisible-tea-party/ts/src/calibrationRunner.ts`
- `benchmark/invisible-tea-party/ts/src/calibrationReport.ts`
- `benchmark/invisible-tea-party/config/model_profiles.example.json`

Add package scripts:

- `benchmark:tea:calibrate`
- `benchmark:tea:report`

Update docs briefly in:

- `benchmark/invisible-tea-party/README.md`

Add focused tests.

### Functional scope

The calibration runner should:

1. load a scenario set
2. load a profile set
3. run the Tea Party benchmark for each matrix cell
4. write each cell into its own bundle directory
5. record matrix-level status for success/failure
6. optionally run ingest when configured
7. write aggregate JSON and markdown reports

### Scenario support

Support at least:

- `--scenario-set all`
- `--scenario-ids tea_001_ontology_spill,tea_003_consensus_occupant`

Use the current registry from:

- `benchmark/invisible-tea-party/scenarios/scenario_registry.json`

### Profile support

Support a provider-agnostic profile config that names:

- profile ID
- display label
- executor module path
- optional executor args
- whether ingest should be attempted
- whether the profile is expected to produce official-comparable runs

You do not need to ship provider SDKs. This is bring-your-own executor.

### Output requirements

Write:

- one bundle directory per matrix cell
- `calibration_matrix.json`
- `calibration_summary.json`
- `calibration_summary.md`
- `model_breakdown.json`
- `scenario_breakdown.json`
- `threshold_review.md`

Each matrix cell record should include:

- scenario ID
- profile ID
- attempt status
- bundle directory if created
- official/unofficial status if available
- core final score if available
- contradiction overlap if available
- gap closure rate if available
- arbiter pass status if available
- error category and message if failed

### Reporting requirements

Aggregate at least:

- mean/median/min/max `core_final_score` by profile
- breakdown by scenario family
- breakdown by difficulty tier
- cap frequency by rule
- arbiter unavailable frequency
- evasion penalty frequency
- completion rate by profile

The markdown summary should clearly answer:

1. are scores degenerate or useful?
2. which scenarios separate models best?
3. which caps fire most often?
4. is any threshold obviously too strict or too lenient?

### Failure handling

The runner must continue across failures and classify them:

- executor_failure
- arbiter_failure
- schema_validation_failure
- ingest_failure
- unexpected_failure

Do not silently map failed cells to zero.

### CLI examples

Support flows like:

```bash
npm run benchmark:tea:calibrate -- \
  --scenario-set all \
  --profile-set frontier_v1 \
  --arbiter-module benchmark/invisible-tea-party/ts/fixtures/staticArbiterEvaluator.ts \
  --out-dir benchmark/invisible-tea-party/results/calibration/2026-04-05
```

```bash
npm run benchmark:tea:report -- \
  --input-dir benchmark/invisible-tea-party/results/calibration/2026-04-05 \
  --out-dir benchmark/invisible-tea-party/results/calibration/2026-04-05/report
```

### Testing

Add tests that cover:

1. matrix execution with fixture executor(s)
2. partial failure does not abort the whole run
3. aggregate summary is generated
4. markdown summary is generated
5. no score semantics are changed

### Definition of done

You are done when:

1. `npm run benchmark:tea:check` passes
2. focused tests pass
3. calibration runner writes real per-cell bundles
4. report step emits aggregate JSON and markdown outputs
5. implementation does not modify benchmark scoring semantics

### Constraints

- do not rewrite the core benchmark loop unless necessary
- prefer reusing the existing run/ingest machinery
- keep dependencies light
- if you need a new schema for calibration outputs, add it explicitly and validate it

At the end, summarize:

1. files changed
2. commands run
3. residual limitations
