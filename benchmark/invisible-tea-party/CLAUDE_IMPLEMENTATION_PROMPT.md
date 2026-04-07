# Claude Implementation Prompt

Use this prompt as the implementation handoff for the Invisible Tea Party benchmark.

## Prompt

You are completing the implementation of `The Invisible Tea Party` benchmark in this repository.

Work in-place. Make code changes directly. Do not stop at analysis.

Repository root:

- repository root

Benchmark root:

- `benchmark/invisible-tea-party/`

Current state:

- The benchmark architecture docs, schemas, scenario registry, certified arbiter policy, and Pass 4 TypeScript skeleton already exist.
- The authored scenario source of truth is `benchmark/invisible-tea-party/scenarios/scenario_registry.json`.
- The normalized scenario loader is `benchmark/invisible-tea-party/ts/src/scenarioRegistry.ts`.
- The Pass 4 pipeline exists in `benchmark/invisible-tea-party/ts/src/`.
- The arbiter retry loop exists in `src/gemma/structuredLocalEvaluator.js`.
- The benchmark is intentionally TypeScript/Node, not Python.

Your job is to finish the minimum viable end-to-end implementation so the benchmark can actually run locally with Bring Your Own Executor and Bring Your Own Evaluator adapters.

## Non-Negotiable Constraints

1. Keep this repo-native and TypeScript-first.
2. Do not add provider SDK dependencies. The runtime must remain BYOE.
3. Use `ajv` and `ajv-formats` for runtime schema validation.
4. Keep V1 single-agent only: Pass 1 -> Pass 2 -> Pass 3 -> Pass 4.
5. Preserve the public scoring policy:
   - `core_final_score` is the only public ranking score.
   - `calibration_augmented_score` is secondary only.
6. Do not rewrite the benchmark architecture. Implement against the existing docs and schemas.
7. Do not revert unrelated user changes.

## First Files To Read

Read these before editing:

- `benchmark/invisible-tea-party/README.md`
- `benchmark/invisible-tea-party/PASS_SCHEMA.md`
- `benchmark/invisible-tea-party/PASS4_ARCHITECTURE.md`
- `benchmark/invisible-tea-party/ts/src/models.ts`
- `benchmark/invisible-tea-party/ts/src/config.ts`
- `benchmark/invisible-tea-party/ts/src/deterministic.ts`
- `benchmark/invisible-tea-party/ts/src/arbiter.ts`
- `benchmark/invisible-tea-party/ts/src/reconcile.ts`
- `benchmark/invisible-tea-party/ts/src/pipeline.ts`
- `benchmark/invisible-tea-party/ts/src/scenarioRegistry.ts`
- `src/gemma/structuredLocalEvaluator.js`

## Implementation Goal

Build the missing execution layer so a user can:

1. choose a Tea Party scenario by `scenario_id`
2. run Pass 1, Pass 2, and Pass 3 via a pluggable text executor
3. turn those pass outputs into valid `ReasoningState` artifacts
4. run Pass 4A / 4B / 4C
5. validate every emitted artifact against JSON Schema
6. write the full result set to disk
7. run the whole thing with local fixture adapters and no network dependency

## Required Deliverables

### 1. Runtime Schema Validation

Add a reusable Ajv-backed validation module for the Tea Party benchmark.

Required coverage:

- `scenario.schema.json`
- `reasoning_state.schema.json`
- `deterministic_verification.schema.json`
- `arbiter_payload.schema.json`
- `arbiter_verification.schema.json`
- `final_verification.schema.json`

Requirements:

- compile validators once
- expose typed helpers like `validateScenario`, `validateReasoningState`, `validateDeterministicVerification`, `validateArbiterPayload`, `validateArbiterVerification`, `validateFinalVerification`
- return precise Ajv error strings
- fail loudly for benchmark runtime code, except where existing arbiter fail-open behavior already applies

Recommended file:

- `benchmark/invisible-tea-party/ts/src/schemaValidation.ts`

### 2. Reconcile Schema/Type Mismatches

There is at least one real mismatch in the current implementation:

- `ReasoningState.causal_claims` is an object array in `models.ts`, but a string array in `reasoning_state.schema.json`

Fix these mismatches cleanly and consistently.

Rules:

- Prefer structured objects where that clearly helps auditability.
- If you change a schema shape, update:
  - `models.ts`
  - the JSON schema
  - any affected runtime code
  - any affected docs if the mismatch is externally visible

Also verify that confidence fields remain normalized to `[0,1]`.

### 3. ReasoningState Builder + Extraction Layer

Implement the missing conversion from raw pass text to `ReasoningState`.

Requirements:

- deterministic artifact creation
- SHA-256 content hashing
- stable `artifact_id` generation
- `lineage_id`
- `normalized_text`
- `word_count`
- `generated_at`
- provenance fields
- span refs where possible
- `expressed_confidence` normalized to `[0,1]`
- `internal_confidence` and `internal_confidence_mode` support

Extraction behavior:

- Pass 2 should try to map critique findings to canonical `failure_mode_id`s.
- Pass 3 should try to map repairs to canonical `resolution_test_id`s.
- Use scenario metadata first:
  - `expected_failure_modes[].canonical_phrases`
  - `expected_failure_modes[].allowed_synonyms`
  - `ground_truth_constraints[].match_hints`
- Keep the extraction deterministic and script-based.
- Do not pretend the extractor is semantically complete.
- Record uncertainty in `parse_warnings` instead of inventing structure.

Recommended files:

- `benchmark/invisible-tea-party/ts/src/reasoningState.ts`
- `benchmark/invisible-tea-party/ts/src/extraction.ts`

### 4. Pass 1-3 BYOE Executor Interface

Create a provider-agnostic pass executor interface for the answer, critique, and repair loop.

Requirements:

- no provider SDK imports
- pluggable at runtime
- executor returns raw text plus optional confidence metadata
- executor metadata includes `producer_agent_id` and `producer_model_id`

Suggested interface:

- `runPass1(...)`
- `runPass2(...)`
- `runPass3(...)`
- `metadata()`

The benchmark should own the pass prompts. The executor should only execute them.

Recommended file:

- `benchmark/invisible-tea-party/ts/src/passExecutor.ts`

### 5. Pass Prompt Builder

Create benchmark-owned prompt builders for Pass 1, Pass 2, and Pass 3.

Requirements:

- prompts must stay narrow and benchmark-specific
- they should operate on:
  - normalized scenario text
  - adversarial critique where applicable
  - prior pass outputs
- they must not drift into multi-agent or publication-theory concerns

Recommended file:

- `benchmark/invisible-tea-party/ts/src/passPrompts.ts`

### 6. End-to-End CLI Harness

Create a CLI entrypoint that runs a full scenario end-to-end.

The CLI must:

- load a scenario by `scenario_id`
- dynamically load a pass executor module
- dynamically load an arbiter evaluator module
- run Pass 1, Pass 2, Pass 3
- build and validate `ReasoningState` artifacts
- run deterministic verification
- run arbiter verification
- run reconciliation
- validate all outputs
- write artifacts to an output directory

Required output files:

- `pass1.reasoning_state.json`
- `pass2.reasoning_state.json`
- `pass3.reasoning_state.json`
- `deterministic_verification.json`
- `arbiter_verification.json`
- `final_verification.json`

Suggested CLI flags:

- `--scenario-id`
- `--out-dir`
- `--pass-executor-module`
- `--arbiter-module`
- `--threshold-profile`
- `--certified-arbiters-config` only if needed, otherwise use defaults

Recommended files:

- `benchmark/invisible-tea-party/ts/src/cli.ts`
- `benchmark/invisible-tea-party/ts/src/moduleLoader.ts`

Add package scripts:

- `benchmark:tea:run`
- keep `benchmark:tea:check`

### 7. Fixture Adapters For Local Smoke Tests

Add local no-network fixture implementations so the benchmark can be run deterministically in CI and reviewed without external API access.

Required:

- a static pass executor fixture
- a static arbiter evaluator fixture

The fixture pass executor should emit intentionally realistic Pass 1 / Pass 2 / Pass 3 outputs for at least one scenario, preferably `tea_001_ontology_spill`.

The fixture arbiter should emit schema-valid JSON and metadata.

Recommended files:

- `benchmark/invisible-tea-party/ts/fixtures/staticPassExecutor.ts`
- `benchmark/invisible-tea-party/ts/fixtures/staticArbiterEvaluator.ts`

### 8. Tests

Add focused tests for the new implementation.

At minimum cover:

1. scenario registry normalization still loads all 6 scenarios
2. `ReasoningState` validation passes on generated artifacts
3. confidence normalization stays in `[0,1]`
4. end-to-end fixture pipeline writes all expected files
5. deterministic verification validates against schema
6. arbiter unavailable path fails open correctly
7. official vs unofficial arbiter status resolves correctly from certified arbiter metadata

Use Vitest and follow existing repo conventions.

Recommended test files:

- `tests/benchmark/invisible_tea_party_schema_validation.test.ts`
- `tests/benchmark/invisible_tea_party_pipeline.test.ts`

## Suggested File Plan

You do not have to use exactly this layout, but stay close unless there is a strong reason not to.

Create:

- `benchmark/invisible-tea-party/ts/src/schemaValidation.ts`
- `benchmark/invisible-tea-party/ts/src/reasoningState.ts`
- `benchmark/invisible-tea-party/ts/src/extraction.ts`
- `benchmark/invisible-tea-party/ts/src/passExecutor.ts`
- `benchmark/invisible-tea-party/ts/src/passPrompts.ts`
- `benchmark/invisible-tea-party/ts/src/moduleLoader.ts`
- `benchmark/invisible-tea-party/ts/src/cli.ts`
- `benchmark/invisible-tea-party/ts/fixtures/staticPassExecutor.ts`
- `benchmark/invisible-tea-party/ts/fixtures/staticArbiterEvaluator.ts`
- `tests/benchmark/invisible_tea_party_schema_validation.test.ts`
- `tests/benchmark/invisible_tea_party_pipeline.test.ts`

Likely update:

- `benchmark/invisible-tea-party/ts/index.ts`
- `benchmark/invisible-tea-party/ts/src/models.ts`
- `benchmark/invisible-tea-party/ts/src/pipeline.ts`
- `benchmark/invisible-tea-party/schemas/reasoning_state.schema.json`
- `benchmark/invisible-tea-party/README.md`
- `benchmark/invisible-tea-party/PASS_SCHEMA.md`
- `package.json`

## Boundaries

Do not do these things:

- do not add OpenAI, Anthropic, Gemini, or LangChain SDKs
- do not add a database
- do not add multi-agent contagion logic
- do not redesign the scoring framework
- do not rewrite scenario content
- do not mutate benchmark policy to fit implementation shortcuts

## Definition Of Done

This task is complete only when all of the following are true:

1. `npm run benchmark:tea:check` passes
2. the new Tea Party tests pass
3. the CLI can run a local fixture scenario end-to-end without network access
4. all emitted artifacts validate against their schemas
5. the generated `final_verification.json` includes:
   - `core_final_score`
   - `arbiter_pass_status`
   - `leaderboard_status`
6. official arbiter status is correct when the fixture arbiter reports:
   - provider: `anthropic`
   - model_id: `claude-3-5-sonnet-20241022`

## Smoke Test Commands

Your implementation should make these commands work:

```bash
npm run benchmark:tea:check
```

```bash
npx vitest run tests/benchmark/invisible_tea_party_schema_validation.test.ts tests/benchmark/invisible_tea_party_pipeline.test.ts
```

```bash
node --import tsx benchmark/invisible-tea-party/ts/src/cli.ts \
  --scenario-id tea_001_ontology_spill \
  --pass-executor-module benchmark/invisible-tea-party/ts/fixtures/staticPassExecutor.ts \
  --arbiter-module benchmark/invisible-tea-party/ts/fixtures/staticArbiterEvaluator.ts \
  --out-dir /tmp/invisible-tea-party-smoke
```

## Final Response Format

When finished, report:

1. files changed
2. commands run
3. whether the smoke test passed
4. any implementation compromises or follow-up risks
