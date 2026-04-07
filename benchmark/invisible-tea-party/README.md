# Invisible Tea Party

Status: `v1.1 Comparison Pack Available` and `v1.0 Official Baseline Preserved`

`The Invisible Tea Party: A Benchmark for Coherence vs Truth`

This benchmark asks a narrow question:

Does a model accept nonsense when the nonsense is phrased coherently?

V1 is intentionally constrained:

- single-agent only
- Pass 1 -> Pass 2 -> Pass 3 loop
- narrow four-domain ontology
- public leaderboard based only on `core_final_score`
- internal-confidence metrics are optional and never part of the main ranking

## Release Line

Tea Party now has a benchmark release line separate from the npm package version.

- `v1.0` is the preserved official baseline release built around the attested Gemini 2.5 Pro run in `results/live-gemini-official-2026-04-06/`
- `v1.1` is the current publication-ready comparison pack that keeps `v1.0` intact and adds the broader comparison bundles, Gemini 3.1 Preview comparison, and the publication docs

For the release ledger, open `RELEASES.md`.

## Directory Map

- `FOUNDATION.md` — benchmark scope, ontology rules, and failure definitions
- `PASS_SCHEMA.md` — canonical artifact contracts for scenarios, pass outputs, and verifiers
- `PASS4_ARCHITECTURE.md` — deterministic verifier, arbiter verifier, and reconciler
- `RELEASES.md` — frozen benchmark release line and release policy
- `config/` — ontology, failure modes, synonym tables, thresholds, and reconciler rules
- `results/README.md` — what counts as a published bundle vs raw calibration work
- `scenarios/scenario_registry.json` — compact authored scenario registry with prompt text, failure expectations, and injection vectors
- `schemas/` — JSON Schemas for core benchmark artifacts
- `ts/` — provider-agnostic TypeScript skeleton for Pass 4A / 4B / 4C

## Canonical Source

- Authored Tea Party scenarios live only in `benchmark/invisible-tea-party/scenarios/scenario_registry.json`.
- Executable normalized scenarios are derived only by `benchmark/invisible-tea-party/ts/src/scenarioRegistry.ts`.
- Runtime contracts live only in `benchmark/invisible-tea-party/schemas/`.
- Pass 4 execution code lives in `benchmark/invisible-tea-party/ts/src/`.
- Structured arbiter retry and schema validation live in `src/gemma/structuredLocalEvaluator.js`.
- `benchmark/teaparty/` is not a live benchmark path anymore.

## Execution Surface

- Library entrypoint: `benchmark/invisible-tea-party/ts/index.ts`
- Verification pipeline class: `benchmark/invisible-tea-party/ts/src/pipeline.ts`
- Compile/check command: `npm run benchmark:tea:check`
- Local run command: `npm run benchmark:tea:run -- --scenario-id ...`
- Trusted attestation command: `npm run benchmark:tea:attest -- --bundle-dir ... --attestor-id ...`
- Leaderboard ingest command: `npm run benchmark:tea:ingest -- --bundle-dir ...`

## Official Submission Flow

Official leaderboard status is not minted by `benchmark:tea:run`.

The trust boundary is:

1. `benchmark:tea:run` creates an unofficial result bundle plus `run_manifest.json`
2. a trusted orchestrator environment signs that manifest into `official_run_attestation.json`
3. `benchmark:tea:ingest` validates the bundle, validates the attestation, and only then emits `leaderboard_submission.json`

Without a valid attestation and ingest pass, the run remains unofficial even if it used a certified arbiter model ID.

This path has now been exercised end to end with the pinned Gemini API profile. A repo-local official snapshot is archived under `benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/`.

## Calibration

If you want to run Tea Party yourself, this is the simplest path:

1. Compile-check the benchmark:

```bash
npm run benchmark:tea:check
```

2. Choose a profile config from `benchmark/invisible-tea-party/config/`

3. Run calibration into a fresh raw workdir under `results/calibration/`

4. Generate reports and, if needed, merge and render publication artifacts

Profile prerequisites:

- Gemini API profiles require `GEMINI_API_KEY`
- official-style attested Gemini runs also require the attestation env vars described below
- Claude CLI profiles require a working local Claude CLI session
- OpenAI CLI profiles require a working local OpenAI CLI session

Run the full scenario matrix across one or more executor profiles:

```bash
npm run benchmark:tea:calibrate -- \
  --scenario-set all \
  --profile-config benchmark/invisible-tea-party/config/model_profiles.example.json \
  --out-dir benchmark/invisible-tea-party/results/calibration/$(date +%Y-%m-%d)
```

Or run specific scenarios:

```bash
npm run benchmark:tea:calibrate -- \
  --scenario-ids tea_001_ontology_spill,tea_003_consensus_occupant \
  --profile-config benchmark/invisible-tea-party/config/model_profiles.example.json \
  --out-dir /tmp/tea-calibration
```

Generate reports from an existing calibration run:

```bash
npm run benchmark:tea:report -- \
  --input-dir benchmark/invisible-tea-party/results/calibration/2026-04-05
```

Outputs:

- `calibration_manifest.json` / `calibration_matrix.json` — per-cell results
- `aggregate_report.json` / `calibration_summary.json` — structured aggregate metrics
- `aggregate_report.md` / `calibration_summary.md` — markdown summary tables
- `model_breakdown.json` — per-profile statistics
- `scenario_breakdown.json` — per-family and per-tier statistics
- `threshold_review.md` — answers: are scores degenerate? which scenarios discriminate? which caps fire? are thresholds appropriate?

Merge multiple one-scenario calibration runs into a single reportable bundle:

```bash
npm run benchmark:tea:merge-calibration -- \
  --source-dirs /tmp/tea-live-calibration-parallel-rerun-tea001,/tmp/tea-live-calibration-parallel-rerun-tea002,/tmp/tea-live-calibration-parallel-rerun-tea003,/tmp/tea-live-calibration-parallel-rerun-tea004,/tmp/tea-live-calibration-parallel-rerun-tea005,/tmp/tea-live-calibration-parallel-rerun-tea006 \
  --out-dir benchmark/invisible-tea-party/results/live-comparison-example
```

This writes:

- merged `calibration_manifest.json`
- aggregate report files
- `inclusive_run_report.md`
- `aggregated_scenario_runs.json` with scenario prompt, pass prompts, pass outputs, and verifier scores per scenario

Live profile examples:

- `benchmark/invisible-tea-party/config/model_profiles.live.example.json`
  - research-only Claude CLI multi-profile path
  - includes both `claude_live_research_cli` (`sonnet`) and `claude_haiku_research_cli` (`haiku`)
  - useful for side-by-side Claude research calibration
  - intentionally unofficial
- `benchmark/invisible-tea-party/config/model_profiles.haiku.example.json`
  - research-only Claude CLI Haiku-only path
  - uses floating CLI alias `haiku`
  - intentionally unofficial
- `benchmark/invisible-tea-party/config/model_profiles.openai_cli.example.json`
  - research-only OpenAI CLI path
  - uses the local OpenAI CLI session via `codex exec` for both executor and arbiter
  - intentionally unofficial
- `benchmark/invisible-tea-party/config/model_profiles.openai_cli.high.example.json`
  - research-only OpenAI CLI high-reasoning path
  - uses `gpt-5.4` with `reasoning_effort: high`
  - intentionally unofficial
- `benchmark/invisible-tea-party/config/model_profiles.gemini_3_1_preview.example.json`
  - pinned Gemini 3.1 Pro Preview comparison path
  - uses an extended request timeout because the preview model can run materially slower than `gemini-2.5-pro`
  - intentionally unofficial for now because the official v1 certification policy is still anchored to stable `gemini-2.5-pro`
- `benchmark/invisible-tea-party/config/model_profiles.opus_4_6.example.json`
  - pinned Claude Opus 4.6 comparison path through Claude CLI
  - intentionally unofficial because it uses local CLI transport rather than a certified attested API path
- `benchmark/invisible-tea-party/config/model_profiles.expanded_comparison.example.json`
  - one-shot expanded comparison matrix across Gemini 3.1 preview, Claude Opus 4.6, Claude Sonnet, Claude Haiku, and OpenAI high
  - useful for broad pattern comparison after the official Gemini baseline is already established
- `benchmark/invisible-tea-party/config/model_profiles.official_api.example.json`
  - pinned Gemini API path for official-style runs
  - runnable once `GEMINI_API_KEY` is set and the certified arbiter policy matches the configured Gemini model ID

## Current Snapshots

This section reflects what has shipped so far.

If you only want the stable published surfaces:

- official release anchor: `results/live-gemini-official-2026-04-06/` (`v1.0`)
- current comparison release: `results/live-expanded-comparison-2026-04-07/` plus `results/live-gemini-3-1-preview-2026-04-07/` (`v1.1`)

Official baseline bundle:

- `benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/`

Official Gemini 2.5 Pro scores:

- `tea_001_ontology_spill`: `0.5733`
- `tea_002_category_fairness`: `0.7580`
- `tea_003_consensus_occupant`: `0.7233`
- `tea_004_constraint_paradox`: `0.4780`
- `tea_005_recursive_role`: `0.7593`
- `tea_006_temporal_inversion`: `0.4300`

Official snapshot notes:

- all six archived cells are `leaderboard_status: official_certified_arbiter`
- `gemini-2.5-pro` remains the official v1 base because it is the stable pinned model that matched the certified arbiter policy when the attested baseline was minted
- newer Gemini variants should be added as comparison runs first; replacing the official base is a separate certification decision, not just a model recency decision
- the repo-local merged snapshot is intentionally deduplicated to one cell per `profile_id + scenario_id`
- for `tea_001_ontology_spill`, the archived official score comes from the successful smoke run and is preferred over the later full-suite retry that failed under Gemini `503` pressure
- overall mean is `0.6203` and median is `0.6483`
- the weakest official cases are `tea_004_constraint_paradox` and `tea_006_temporal_inversion`

Official artifacts to open first:

- `benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/aggregate_report.md`
- `benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/inclusive_run_report.md`
- `benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/aggregated_scenario_runs.json`
- `benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/failure_gallery.html`
- `benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/scorecard_tea001.html`

Additional archived comparison bundles:

- `benchmark/invisible-tea-party/results/live-gemini-3-1-preview-2026-04-07/`
  - dedicated successful Gemini 3.1 Preview comparison rerun
  - mean `0.6931`, median `0.7430`
  - strongest completed cases: `tea_002_category_fairness` (`0.8680`) and `tea_005_recursive_role` (`0.7947`)
  - weakest completed case: `tea_004_constraint_paradox` (`0.5000`)
  - useful comparison because it improves materially over official Gemini `2.5 Pro` on several families while still failing to solve the main closure weakness on `tea_004`
  - intentionally unofficial because it is a preview comparison run rather than the attested official baseline
- `benchmark/invisible-tea-party/results/live-expanded-comparison-2026-04-07/`
  - one same-day expanded comparison bundle across Claude Sonnet, Claude Opus 4.6, Claude Haiku, and OpenAI high
  - aggregate mean `0.6437`, median `0.6227` across `24` successful cells and `6` Gemini preview failures
  - hardest family: `recursive_role` (`0.4219`)
  - strongest discrimination family: `category_error` (spread `0.5129`)
  - useful publication bundle because it compares the research profiles under one execution umbrella instead of separate one-off runs
  - important caveat: the Gemini 3.1 preview profile did not complete in the expanded bundle because `GEMINI_API_KEY` was missing in that environment
  - separate follow-up rerun note: the dedicated `Gemini 3.1 Pro Preview` rerun later completed cleanly and is archived separately at `benchmark/invisible-tea-party/results/live-gemini-3-1-preview-2026-04-07/`

Earlier standalone research bundles and raw calibration workdirs were intentionally archived out of the tracked repo to keep the benchmark tree lean. The current in-repo comparison surface is the expanded comparison bundle plus the dedicated Gemini 3.1 rerun.

One reason these research bundles should stay clearly labeled as unofficial: the floating CLI transports can drift materially between runs. The same-day expanded comparison bundle produced different Sonnet/Haiku/OpenAI scores than the earlier standalone bundles, which is informative for research but not appropriate for official score claims.

## What Shipped In `v1.1`

The current comparison-pack release includes the culmination of the benchmark features built so far:

- official Gemini attestation and ingest path
- official scorecard and failure-gallery rendering
- merged calibration bundles with deduplication and neutral report wording
- Gemini API, Claude CLI, and OpenAI CLI benchmark adapters
- side-by-side research profile configs for Sonnet, Haiku, Opus 4.6, OpenAI high, and Gemini 3.1 Preview
- progress logging and pass-level calibration heartbeats
- matcher hardening for the previously under-credited Tea Party scenarios
- archived release bundles for official and research comparison runs
- release docs and reproducibility surfaces for reruns and comparisons

Haiku research run options:

- use `benchmark/invisible-tea-party/config/model_profiles.live.example.json` to run both Sonnet and Haiku together
- use `benchmark/invisible-tea-party/config/model_profiles.haiku.example.json` to run Haiku only
- use `benchmark/invisible-tea-party/config/model_profiles.openai_cli.high.example.json` to run the OpenAI CLI comparison on `high`
- use `benchmark/invisible-tea-party/config/model_profiles.gemini_3_1_preview.example.json` to run a newer Gemini comparison without changing the official baseline
- use `benchmark/invisible-tea-party/config/model_profiles.opus_4_6.example.json` to run a pinned Claude Opus 4.6 comparison
- use `benchmark/invisible-tea-party/config/model_profiles.expanded_comparison.example.json` to run the full expanded comparison set

For the current state, open:

- `benchmark/invisible-tea-party/AGENT_HANDOFF.md`

## What Comes Next

What has shipped so far is enough for a real publication pass.

The next steps are deliberately narrower:

- keep the official baseline stable unless and until a new certified official model path is intentionally minted
- keep adding new comparison packs without rewriting prior releases
- strengthen reproduction guidance and raw calibration hygiene so outside users can rerun the benchmark more easily
- extend the benchmark from failure isolation into stronger end-to-end agent evaluation
- keep publishing where the benchmark helps, where CT-MCP helps, and where neither fully closes the gap yet

## Scorecard

Render a publication-ready HTML scorecard from a benchmark bundle:

```bash
npm run benchmark:tea:render-scorecard -- \
  --bundle-dir /path/to/bundle \
  --out-file /path/to/scorecard.html \
  --title "Custom Title"
```

The output is a standalone HTML file (no server required) with:

- score component bars with raw/weighted values
- penalty and cap callouts
- arbiter evaluation grid
- evidence panel (justification, cited spans, audit traces)
- footer metadata

Supports official/unofficial runs, arbiter available/unavailable, and prints cleanly to PDF.

Render a publication-ready failure gallery from a merged benchmark report directory:

```bash
npm run benchmark:tea:render-gallery -- \
  --results-dir benchmark/invisible-tea-party/results/live-expanded-comparison-2026-04-07 \
  --out-file /tmp/tea-failure-gallery.html \
  --title "Tea Party Failure Gallery"
```

The gallery reads `aggregated_scenario_runs.json` and renders the lowest-scoring cases with:

- prompt excerpt and pass gists
- overlap / gap-closure / penalty signals
- unresolved constraints and cap callouts
- arbiter justification excerpts
- standalone HTML suitable for sharing or screenshots

## Release Policy

This release is publish-ready for a single-profile official baseline.

It is intended to:

- publish an attested, ingested six-scenario official Gemini baseline
- validate the benchmark loop
- collect edge cases
- surface scoring disagreements
- create replayable evidence for later calibration

It does not yet claim:

- multi-model official comparison
- final human coherence calibration
- final inter-rater stability
- final threshold tuning across multiple official profiles

## Public Scoring Policy

- `core_final_score` is the only public benchmark score
- `calibration_augmented_score` is a secondary research metric when internal confidence is available
- black-box API models remain fully eligible for the public benchmark because `core_final_score` uses only externalized Pass 1 to Pass 3 artifacts

## Arbiter Runtime Policy

Pass 4B is strictly Bring Your Own Evaluator.

At the code level:

- the benchmark defines an abstract arbiter interface
- the executing agent is responsible for sending the arbiter prompt to any model they choose
- the verifier only accepts JSON that matches the arbiter schema

Reference adapter:

- a canonical Gemini API adapter is provided at `benchmark/invisible-tea-party/ts/src/adapters/geminiApi.ts`
- a callback-injected Anthropic-style adapter remains available at `benchmark/invisible-tea-party/ts/src/adapters/anthropicCertified.ts`
- a schema-validating retry loop for local structured evaluators is provided at `src/gemma/structuredLocalEvaluator.js`

At the leaderboard level:

- official runs must declare arbiter metadata
- official runs must also carry a valid signed run attestation from a trusted orchestrator environment
- official public scores require a certified arbiter listed in benchmark policy
- custom local arbiters still work, but their runs are marked unofficial
- certified arbiters must be pinned to exact model IDs, not rolling aliases, so official scores remain reproducible over time
- local fixture runs and ordinary local CLI runs are always unofficial until attested and ingested
