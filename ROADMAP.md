# Roadmap

This repo now has two parallel release lines:

- `ct-mcp` package semver for the MCP server and tool surface
- `Invisible Tea Party` benchmark releases for benchmark artifacts and published result bundles

They are related, but they do not move in lockstep.

## Current State

### `ct-mcp` package

- Current package version: `0.1.0-beta.2`
- Current shipped surface: 9 deterministic, stateless MCP tools
- Current validation baseline: 56 benchmark scenarios (`42` defect, `14` clean control)
- Current publication caveat: baseline and prompted benchmark conditions are still self-assessed

### `Invisible Tea Party` benchmark

- `v1.0` official baseline preserved
- `v1.1` comparison pack published
- Core single-agent benchmark path is live:
  - Pass 1 -> Pass 2 -> Pass 3 loop
  - Pass 4A deterministic verifier
  - Pass 4B arbiter verifier
  - Pass 4C reconciler
  - calibration reporting, scorecard rendering, failure gallery, and official ingest flow

## Near-Term Priorities

### Track A: `ct-mcp` package

These are the clearest next improvements for the MCP server itself:

- independent human scoring of baseline and prompted benchmark conditions
- cross-tool routing via the existing claim classifier
- chained arithmetic verification for multi-step formulas
- escalate `ordering_assumption` from warning to blocking when no protections are listed

The most important gate is independent human scoring. That is the explicit blocker for stronger non-beta benchmark claims.

#### Experimental: orchestrator v0 (internal only)

An internal routing layer under `src/orchestrator/` has landed as an experiment. It is explicitly out of scope for the public MCP tool surface in `0.1.x-beta`.

- what is in: strict structured envelopes routed to existing deterministic tools, `routed` and `shadow` modes, a PASS / WARN / REVISE / HUMAN_REVIEW policy layer with a one-revision cap, and a local CLI harness
- what is intentionally out of scope: no provider SDK integrations, no LLM routing, no prose-to-graph rescue, no exposure as a public MCP tool
- status: experimental, subject to change, not a gating item for `v1.0`

### Track B: `Invisible Tea Party`

The benchmark core is already built, so the next work is hardening and release discipline:

- keep the official baseline stable unless a new certified official path is intentionally minted
- publish new comparison packs without rewriting prior releases
- improve rerun guidance and raw calibration hygiene for outside users
- extend the benchmark from failure isolation toward stronger end-to-end agent evaluation
- keep separating official benchmark claims from research-only comparison runs

## Milestones

### `ct-mcp` `v1.0`

The package is ready to move beyond beta when all of the following are true:

- independent human evaluation has been completed for benchmark scoring
- benchmark claims no longer rely on self-assessed baseline and prompted conditions
- the current tool surface and routing behavior are stable enough for a non-beta contract

Until then, `0.1.x-beta` should be treated as a real public beta with explicit evidence limits.

### `Invisible Tea Party` `v1.5 Calibrated`

The next major benchmark milestone is not another architecture build-out. It is calibration strength.

`v1.5 Calibrated` is the earliest release that should support stronger publication-grade claims about:

- score stability
- threshold quality
- calibration behavior across runs
- broader confidence in benchmark interpretation

## Longer-Term Scope

These items are intentionally not part of the immediate roadmap:

- multi-agent contagion in the default Tea Party benchmark
- folding Tea Party releases into npm package semver
- pretending the current benchmark is a general fact-verification system

For Tea Party specifically:

- multi-agent contagion is reserved for `v2` or explicit extension-mode evaluation
- any early contagion work should remain outside the core public benchmark contract

## Working Rule

If a change affects the MCP server surface, tool semantics, or package claims, treat it as `ct-mcp` roadmap work.

If a change affects benchmark schemas, pass orchestration, calibration bundles, release packs, or leaderboard policy, treat it as `Invisible Tea Party` roadmap work.

## Source Docs

This roadmap consolidates the currently scattered plan from:

- `README.md`
- `DEVELOPMENT.md`
- `benchmark/invisible-tea-party/README.md`
- `benchmark/invisible-tea-party/RELEASES.md`
- `benchmark/invisible-tea-party/NEXT_STEPS_PLAN.md`
- `docs/designs/invisible-tea-party-next-evolution.md`
