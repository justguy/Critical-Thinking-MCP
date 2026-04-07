# Invisible Tea Party — Agent Handoff

Updated: 2026-04-07

This file is the handoff anchor for the next agent working on Tea Party.

## Current State

The benchmark execution path is now working end to end for both:

- official Gemini API runs with certified arbiter attestation and successful ingest
- research-grade live Claude CLI runs used for matcher development and comparison
- research-grade local OpenAI CLI runs used for cross-family comparison

What is now stable:

- Pass 1 -> Pass 2 -> Pass 3 loop through the Gemini API adapter
- Pass 1 -> Pass 2 -> Pass 3 loop through the Claude CLI adapter
- Pass 4 deterministic verification
- Pass 4 arbiter verification with strict flat JSON schema and AJV-backed repair retry
- score reconciliation
- scorecard rendering
- calibration matrix execution
- failure gallery rendering
- merged calibration/report bundles for both official and research snapshots

What is not yet solved:

- broader comparative official baselines across more than one pinned profile
- the weakest official cases are still `tea_004_constraint_paradox` and `tea_006_temporal_inversion`
- the research path still uses unofficial floating CLI transport by design

## Canonical Official Baseline

Canonical merged official bundle:

- [results/live-gemini-official-2026-04-06](results/live-gemini-official-2026-04-06)

Key files:

- [aggregate_report.md](results/live-gemini-official-2026-04-06/aggregate_report.md)
- [inclusive_run_report.md](results/live-gemini-official-2026-04-06/inclusive_run_report.md)
- [aggregated_scenario_runs.json](results/live-gemini-official-2026-04-06/aggregated_scenario_runs.json)
- [calibration_manifest.json](results/live-gemini-official-2026-04-06/calibration_manifest.json)
- [failure_gallery.html](results/live-gemini-official-2026-04-06/failure_gallery.html)
- [scorecard_tea001.html](results/live-gemini-official-2026-04-06/scorecard_tea001.html)

Merged official scores:

- `tea_001_ontology_spill`: `0.5733`
- `tea_002_category_fairness`: `0.7580`
- `tea_003_consensus_occupant`: `0.7233`
- `tea_004_constraint_paradox`: `0.4780`
- `tea_005_recursive_role`: `0.7593`
- `tea_006_temporal_inversion`: `0.4300`

Aggregate summary:

- total runs: `6`
- successful: `6`
- failed: `0`
- overall mean: `0.6203`
- overall median: `0.6483`
- arbiter unavailable count: `0`
- leaderboard status: all six `official_certified_arbiter`

Important note:

- the underlying operational history included a later full-suite `tea_001` retry that failed under Gemini `503` load
- the archived merged official bundle now deduplicates repeated `profile_id + scenario_id` cells and correctly keeps the successful smoke-run `tea_001` result

## Canonical Research Baseline

Canonical merged research bundle:

- [results/live-claude-research-2026-04-06](results/live-claude-research-2026-04-06)

Research scores:

- `tea_001_ontology_spill`: `0.9124`
- `tea_002_category_fairness`: `0.7860`
- `tea_003_consensus_occupant`: `0.7947`
- `tea_004_constraint_paradox`: `0.9105`
- `tea_005_recursive_role`: `0.7620`
- `tea_006_temporal_inversion`: `0.4867`

## Canonical Comparison Bundles

Claude Haiku comparison bundle:

- [results/live-claude-haiku-research-2026-04-07](results/live-claude-haiku-research-2026-04-07)

Haiku scores:

- `tea_001_ontology_spill`: `0.6906`
- `tea_002_category_fairness`: `0.7580`
- `tea_003_consensus_occupant`: `0.6254`
- `tea_004_constraint_paradox`: `0.7522`
- `tea_005_recursive_role`: `0.6793`
- `tea_006_temporal_inversion`: `0.5371`

OpenAI high comparison bundle:

- [results/live-openai-cli-high-research-2026-04-07](results/live-openai-cli-high-research-2026-04-07)

OpenAI high scores:

- `tea_001_ontology_spill`: `0.5822`
- `tea_002_category_fairness`: `0.8737`
- `tea_003_consensus_occupant`: `0.9137`
- `tea_004_constraint_paradox`: `0.6715`
- `tea_005_recursive_role`: `0.4245`
- `tea_006_temporal_inversion`: `0.4352`

Comparison takeaway:

- Sonnet is the strongest broad comparison run
- Haiku is stronger than "just for fun" framing suggests
- OpenAI high is the clearest detection-without-closure example on `tea_004_constraint_paradox`
- `tea_006_temporal_inversion` remains weak across all completed profiles

Gemini 3.1 Preview comparison bundle:

- [results/live-gemini-3-1-preview-2026-04-07](results/live-gemini-3-1-preview-2026-04-07)

Gemini 3.1 Preview scores:

- `tea_001_ontology_spill`: `0.7593`
- `tea_002_category_fairness`: `0.8680`
- `tea_003_consensus_occupant`: `0.7267`
- `tea_004_constraint_paradox`: `0.5000`
- `tea_005_recursive_role`: `0.7947`
- `tea_006_temporal_inversion`: `0.5100`

Gemini 3.1 takeaway:

- materially better than official Gemini `2.5 Pro` on `tea_001`, `tea_002`, `tea_005`, and `tea_006`
- still only marginally better on `tea_004_constraint_paradox`, so the core closure weakness survives the model upgrade
- useful as an unofficial preview comparison, not as a replacement for the official attested baseline

Expanded comparison bundle:

- [results/live-expanded-comparison-2026-04-07](results/live-expanded-comparison-2026-04-07)

Expanded bundle notes:

- completed profiles: `claude_opus_4_6_research_cli`, `claude_live_research_cli`, `claude_haiku_research_cli`, `openai_cli_research_high_cli`
- failed profile: `gemini_3_1_preview_api` (`GEMINI_API_KEY` missing in that run environment)
- separate dedicated rerun status: `gemini_3_1_preview_api` later completed cleanly in [results/live-gemini-3-1-preview-2026-04-07](results/live-gemini-3-1-preview-2026-04-07)
- aggregate mean `0.6437`, median `0.6227`
- hardest family: `recursive_role`
- strongest discrimination family: `category_error`
- the same-day expanded bundle is the cleanest cross-model research comparison artifact currently in-repo
- the score movement versus earlier standalone CLI runs is itself evidence that floating local CLI transports drift and should stay research-only

## What We Fixed

The benchmark moved from research-only to an official publishable baseline by closing the remaining transport and reporting gaps.

Key fixes already in code:

- Gemini retry/backoff for transient `429` / `5xx` pressure in [ts/src/adapters/geminiApi.ts](ts/src/adapters/geminiApi.ts)
- flat canonical arbiter JSON contract in [ts/src/arbiter.ts](ts/src/arbiter.ts)
- AJV validation and schema-repair retry in [ts/src/adapters/claudeCli.ts](ts/src/adapters/claudeCli.ts)
- duplicate-output normalization and JSON recovery in [ts/src/adapters/openaiCli.ts](ts/src/adapters/openaiCli.ts)
- simplified citation contract in [schemas/arbiter_payload.schema.json](schemas/arbiter_payload.schema.json)
- calibration merger utility in [ts/src/mergeCalibrationArtifacts.ts](ts/src/mergeCalibrationArtifacts.ts)
  - handles missing `diagnostics/`
  - deduplicates repeated `profile_id + scenario_id` cells
  - uses neutral inclusive report wording instead of hard-coded Claude labels

Net result:

- all six official Gemini cells are attested, ingested, and archived in-repo
- all six latest Claude research reruns came back with `Arbiter: AVAILABLE`
- the main remaining score suppression is now scenario-side, not arbiter transport
- `tea_005_recursive_role` remains strong in both official and research paths

## What Still Looks Weak

The biggest April 6 matcher misses from the Claude research run were fixed. What remains weak now is concentrated in a small number of low-GCR official cases.

Current weak scenarios:

- `tea_004_constraint_paradox`
- `tea_006_temporal_inversion`

Common pattern:

- the arbiter is available and officially ingested
- remaining score suppression is coming from low gap-closure / overlap rather than transport failure
- `repair_quality_cap_low_gcr` still fires frequently in the official Gemini snapshot

Next agent should inspect these bundle artifacts first:

- [aggregated_scenario_runs.json](results/live-gemini-official-2026-04-06/aggregated_scenario_runs.json)
- [threshold_review.md](results/live-gemini-official-2026-04-06/threshold_review.md)

Look at:

- `scenarios[].responses.pass3`
- `scenarios[].verification.deterministic.unresolved_constraint_ids`
- `scenarios[].verification.arbiter`

Then patch:

- [ts/src/scenarioRegistry.ts](ts/src/scenarioRegistry.ts)
- [ts/src/extraction.ts](ts/src/extraction.ts)

## Embarrassing Sample

Best public example right now: `tea_005_recursive_role`

Bundle:

- see the `tea_005_recursive_role` entry in [aggregated_scenario_runs.json](results/live-claude-research-2026-04-06/aggregated_scenario_runs.json)

Why it is useful:

- Pass 1 confidently claims a fatal circular paradox
- Pass 2 exposes the hidden assumption: Claude assumed the invitation must come from inside the room
- Pass 3 reverses the core conclusion and says the scenario is actually consistent under the most natural reading

That is a clean example of fluent but assumption-fragile reasoning.

## Commands

Compile check:

```bash
npm run benchmark:tea:check
```

Run one scenario official smoke:

```bash
npm run benchmark:tea:calibrate -- --scenario-ids tea_001_ontology_spill --profile-config benchmark/invisible-tea-party/config/model_profiles.official_api.example.json --out-dir /tmp/tea-gemini-official-smoke-$(date +%Y-%m-%d)
```

Run the full official suite:

```bash
npm run benchmark:tea:calibrate -- --scenario-set all --profile-config benchmark/invisible-tea-party/config/model_profiles.official_api.example.json --out-dir /tmp/tea-gemini-official-full-$(date +%Y-%m-%d)
```

Merge smoke + full official sources into the repo snapshot:

```bash
npm run benchmark:tea:merge-calibration -- --source-dirs /tmp/tea-gemini-official-smoke-2026-04-06,/tmp/tea-gemini-official-full-2026-04-06 --out-dir benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06
```

Render a scorecard for the official `tea_001` smoke bundle:

```bash
npm run benchmark:tea:render-scorecard -- --bundle-dir /tmp/tea-gemini-official-smoke-2026-04-06/gemini_official_api/tea_001_ontology_spill --out-file benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/scorecard_tea001.html
```

## Immediate Next Work

Recommended order:

1. inspect `tea_004_constraint_paradox` and `tea_006_temporal_inversion` in the official Gemini bundle for the remaining low-GCR caps
2. rerun the OpenAI CLI research suite now that duplicated CLI output is normalized
3. add a second official pinned profile if comparative publication claims are needed
4. use [inclusive_run_report.md](results/live-gemini-official-2026-04-06/inclusive_run_report.md) and [aggregated_scenario_runs.json](results/live-gemini-official-2026-04-06/aggregated_scenario_runs.json) as the handoff input for downstream publication work

## Important Boundary

There is now an official publishable baseline:

- profile: `gemini_official_api`
- transport: pinned Gemini API profile
- leaderboard status: `official_certified_arbiter`

The Claude research baseline is still research-only:

- profile: `claude_live_research_cli`
- transport: floating Claude CLI alias `sonnet`
- leaderboard status: unofficial

Do not mix the two when writing up results:

- use the Gemini bundle for official claims
- use the Claude bundle for research comparison or matcher-debug context
