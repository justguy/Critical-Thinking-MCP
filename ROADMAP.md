# Roadmap

This repo now has two parallel release lines:

- `ct-mcp` package semver for the MCP server and tool surface
- `Invisible Tea Party` benchmark releases for benchmark artifacts and published result bundles

They are related, but they do not move in lockstep.

## Positioning (changed)

ct-mcp is now positioned as a **deterministic release gate for structured agent deliverables** — **not** a
critical-thinking / reasoning-improvement tool. Phase 4 proved the heavy multi-turn gate does not improve a
strong model's reasoning or repair; what is proven is deterministic *catching* of planted/contract-violating
defects. Phase 5 proved `ct-enforce` reduces false releases at low friction when host contracts are authored
correctly. Authoritative outcomes: [`docs/PHASE4_RESULTS.md`](docs/PHASE4_RESULTS.md),
[`docs/PHASE5_RESULTS.md`](docs/PHASE5_RESULTS.md); honest gaps: `docs/GAPS.md`.

## Current State

### `ct-mcp` package

- Current package version: `0.1.0-beta.3`
- Current **public** surface: a **12-tool** set — an 11-tool spine (9 analyzers + `plan_checks` + `finalize_deliverable`) plus the **`review_before_final` facade**; by default `tools/list` advertises **only the facade** (+ 6 MCP prompts), with the spine hidden-but-callable behind `CT_EXPOSE_ALL`
- Current validation baseline: 56 benchmark scenarios (`42` defect, `14` clean control) — detection quality of the tools in isolation on a hand-crafted corpus, **not** a vs-baseline win
- Current publication caveat: baseline and prompted benchmark conditions are still self-assessed

#### Phase 4 & 5 (concluded)

- **Phase 4 — value/repair/binding ablation: DONE.** On a strong model (Haiku 4.5) the gate does not improve reasoning or repair (checklist/self-review arms 6/6 vs gate 4/6, at 3–11× the turns; natural defect density 0.000). Proven: deterministic catching of injected defects (106/106 blocked, 0/41 false-block on 147 hand-edited bundles, CI-backed). Repair/binding nulls are directional (n=6, no CI). The marketing claim *"reduces high-severity defects"* stays **unproven**. Record: [`docs/PHASE4_RESULTS.md`](docs/PHASE4_RESULTS.md).
- **Phase 5 — host-contract release gate: DONE.** `ct-enforce` reduces false releases at low friction when contracts follow [`docs/designs/HOST_CONTRACT_AUTHORING.md`](docs/designs/HOST_CONTRACT_AUTHORING.md) (curated 16/16 violations blocked, 0/14 good blocked; the as-run friction traced to one over-specified contract; a corrected re-run demonstrated `ship_worthy=true`). Record: [`docs/PHASE5_RESULTS.md`](docs/PHASE5_RESULTS.md).
- Honest limitations for both phases are consolidated in `docs/GAPS.md` (single model class, directional pilots, N4 semantic boundary, small live realism arm, decode not pinnable).

#### Working-tree: deliverable-centric layer + facade (unreleased)

The deliverable-centric layer is implemented in the working tree on top of the 9 analyzers: a stateless
`deliverable_contract`, a `plan_checks` planner, a re-executing `finalize_deliverable` gate (with the leaf
checks internalized), and the **`review_before_final` facade** + 6 MCP prompts. Full record:
`docs/designs/IMPLEMENTATION_CHANGES.md`; design rationale: `docs/designs/robustness-additions.md`; test
plan: `docs/designs/STRESS_TEST_STRATEGY.md`. Not yet published.

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
- a generic structured integration envelope and normalized verdict wrapper over existing deterministic tools, without changing core tool semantics
- cross-tool routing via the existing claim classifier
- chained arithmetic verification for multi-step formulas
- escalate `ordering_assumption` from warning to blocking when no protections are listed

Status note: several of these are now **implemented in the working-tree deliverable-centric layer**
(unreleased): the structured envelope + normalized verdict wrapper (`deliverable_contract` +
`finalize_deliverable`), cross-tool routing via the claim classifier (`plan_checks`,
`check_profile_downgrade`), and multi-step number provenance (`trace_conclusion_numbers`). Phase 4/5 have
now evaluated this layer (see above and `docs/PHASE4_RESULTS.md` / `docs/PHASE5_RESULTS.md`): the gate's
deterministic catching is CI-backed on injected bundles, while reasoning/repair/binding value is not
supported on a strong model. Remaining before any non-beta claim: independent validation and the gaps in
`docs/GAPS.md`.

The most important gate is independent human scoring. That is the explicit blocker for stronger non-beta benchmark claims.

#### Candidate capability additions after interface stabilization

These are plausible `ct-mcp` additions, but they are new deterministic capabilities rather than interface-only work:

- deterministic proof classification (`R-3`): AST-based JS/TS proof classification for tests, scoped as a new tool instead of overloading existing verification outputs
- reference grounding (`R-5`): a new generic structured check that validates plan references against caller-supplied inventories of paths, symbols, and seams; do not repurpose the current text-oriented `entity_grounding` mechanism for this
- structured contract drift detection (`R-8`): a new deterministic diff/check for retry-time contract changes; keep existing `detect_drift` focused on numeric CUSUM analysis

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
