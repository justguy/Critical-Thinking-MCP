# Changelog

## Unreleased — repositioned as a deterministic release gate (Phase 4/5)

Working-tree changes, not yet published. ct-mcp is now positioned as a **deterministic release gate for
structured agent deliverables**, **not** a critical-thinking / reasoning-improvement tool. Authoritative
records: [`docs/PHASE4_RESULTS.md`](docs/PHASE4_RESULTS.md),
[`docs/PHASE5_RESULTS.md`](docs/PHASE5_RESULTS.md),
[`docs/designs/HOST_CONTRACT_AUTHORING.md`](docs/designs/HOST_CONTRACT_AUTHORING.md), and the
claims ledger (`CLAIMS_LEDGER.jsonl`). No tracked-phrase head-to-head wins are claimed.

- **Repositioning (Phase 4, concluded).** On a strong, shipping-class model (Haiku 4.5) the heavy
  multi-turn gate does **not** improve reasoning or repair — the cheap checklist scaffold and self-review
  arms repaired 6/6 vs the gate arm's 4/6, at 3–11× the turns; natural high-severity defect density was
  0.000. What is **proven** is deterministic *catching* of planted/contract-violating defects: on 147
  hand-edited structured bundles the gate gave perfect separation (106/106 mutants blocked, 0/41 correct
  bases false-blocked, CI-backed). The marketing claim *"reduces high-severity defects"* stays
  **unproven** (ledger `mkt-reduces-high-sev-defects`). The repair/binding nulls are **directional**
  pilots (n=6, no CI); binding showed no measured benefit (B≈D). Scope: the 100%/0% result is gate
  mechanics on hand-edited bundles, not evidence of catching live model fabrication.
- **Product reshape — cheap scaffold + a gate for the high-risk tail.** Added **6 reusable MCP prompts**
  (`review_plan`, `stress_architecture`, `review_decision`, `verify_research_answer`,
  `audit_numeric_analysis`, `review_before_final`) discoverable via `prompts/list` + `prompts/get`, and one
  **`review_before_final` facade** tool: deterministic, **never blocks**. Input
  `{task_type, original_request, draft_answer, mode, risk_level?}`; output
  `{checklist[], critique_questions[], artifact_template?, enforce_required?, corrective_prompt?}`. Modes:
  `checklist` (default) / `artifact` / `enforce`; `enforce_required` only for high-risk or
  numeric/research. Its enforce mode **signals** (sets `enforce_required` + `corrective_prompt` pointing at
  `finalize_deliverable` / `ct-enforce`) but does **not** itself run the gate or block — the decision
  family is advisory.
- **Gate-compatible artifact templates (bug fixed).** The façade `artifact` templates were
  non-gate-compatible placeholders (research used `text` instead of `claim_text`/`claim_id`/
  `supporting_token`/`claim_kind`; numeric pushed the heavy `numeric_derivation` DAG). They were rewritten
  to mirror the real gate schemas — grounded-citation `GroundingClaim` shape; **numeric now defaults to
  the light `{answer_text, structured_answer}` constraint shape**, not a `numeric_derivation` DAG. Proven:
  a valid fill RELEASEs through the real gate, a mutated fill REJECTs
  (`tests/tools/review_before_final.gate_compat.test.ts`). Single-shot parseability went 0/3 → 3/3.
- **Default-minimal discovery surface (breaking).** By default `tools/list` advertises **only the
  `review_before_final` facade** (+ the 6 prompts). The **11-tool spine** (9 analyzers + `plan_checks` +
  `finalize_deliverable`) is **hidden from discovery but still callable** via `tools/call`. Opt in with
  **`CT_EXPOSE_ALL=1`** (→ all 12; `CT_DISABLE_FINALIZE` then composes to drop `finalize_deliverable` →
  11). Hiding is **discovery-only**. Total public surface = **12 tools** (11-tool spine + the facade).
  Breaking for integrations that relied on the analyzers/`finalize` being advertised; bare
  `CT_DISABLE_FINALIZE` now yields the facade-only surface.
- **Phase 5 (host-contract release gate, concluded).** `ct-enforce` (host-side single call) **reduces
  false releases at low friction when contracts are authored per**
  [`HOST_CONTRACT_AUTHORING.md`](docs/designs/HOST_CONTRACT_AUTHORING.md) (value/field/format requirements
  as `constraints`/`must_include`; `evidence_level: rederived` reserved for genuine independent
  re-derivation). Curated arm: 16/16 violations blocked, 0/14 good deliverables blocked; real agents ship
  host-contract violations ~⅓ of the time. As-run, the frozen kill rule fired on friction from **one
  over-specified contract** (`fin_numeric_dag`); a corrected re-run (re-authored as a `==` constraint, gate
  **unchanged**) demonstrated `ship_worthy=true` (realism_false_block 0/7, no spine,
  false_release_reduction 1.0). Caveat: the live realism arm is small (8 gradeable + 6 unparseable
  single-shot); the façade `artifact` mode addresses the parseability friction, and the gate still
  correctly REJECTs genuine grounding errors (an ideal fill RELEASEs).

## Unreleased — deliverable-centric robustness layer

Working-tree changes, not yet published. Full record: `docs/designs/IMPLEMENTATION_CHANGES.md`;
test plan: `docs/designs/STRESS_TEST_STRATEGY.md`. The original 9 analyzer tools remain the
benchmark-backed surface; the two-tool deliverable gate has only directional value-pilot evidence, not a
definitive product-value benchmark.

- Public tool surface 9 → **11**: a deliverable gate of two new public tools — `plan_checks` (planner)
  and `finalize_deliverable` (keystone gate) — on top of the nine analyzers. The seven deterministic
  check primitives (`check_quote_grounding`, `check_claim_coverage`, `trace_conclusion_numbers`,
  `check_answer_against_constraints`, `check_freshness`, `check_case_partition`, `check_profile_downgrade`)
  are kept **internal**: `finalize_deliverable` re-executes the blocking ones inline, and they are not
  separately agent-callable. (Consolidated from an interim 18-tool surface — leaf checks are mechanisms,
  not jobs-to-be-done, so the agent drives the layer through the plan → finalize spine.)
- `finalize_deliverable` now also folds in `check_profile_downgrade` as a WARNING (declared task_type vs
  request/answer shape; never blocks) and verifies a *supplied* `case_partition` is MECE (blocks on
  overlap/gap; absent = no obligation).
- **Fixed a high-risk false-block.** `risk_level:'high'` previously force-promoted the first unforgeable
  *optional* check (freshness for factual_qa, constraints for numeric_analysis) into mandatory
  `finalize_required`, so `finalize` blocked on its missing artifacts even for tasks with no
  freshness/constraint dimension — false-blocking every legitimate high-risk deliverable. The promotion
  is now **verify-if-present**: re-executed and blocking on failure only when its artifacts are supplied;
	  a missing artifact never blocks. A contract-declared freshness window stays mandatory. New plan field
	  `finalize_verify_if_present`; regression suite `tests/tools/risk_promotion.test.ts`.
- **Tightened deliverable-gate soundness after adversarial review.** `verify_arithmetic` is mandatory for
  rederived numeric deliverables and must be supplied as `arithmetic_checks`; mandatory no-executor checks
  now block; grounding binds contract claim id/text/kind and blocks weak-kind downgrades; cited factual
  finalize blocks unaccounted claim-like answer spans; numeric finalize blocks untraced answer numbers and
  unanchored flattened inputs; host anti-swap hashing is exact text; host direct mode applies MCP input caps.
- Tier-2 hardenings to `validate_confidence`: widened claimed-confidence extraction (returns max, polarity-
  guarded), confidence/hedge contradiction (warning by default; block under opt-in `strict`),
  falsification↔assumption binding, tautology/bare-negation guard. No new default BLOCK on existing tools.
- Opt-in structural checks: redundant-evidence via vertex-disjoint max-flow and premise-usage reconciliation
  on `validate_reasoning_chain`; failure-branch coverage on `check_plan_validity` (`require_failure_branches`).
- Marker precision split (`markers.ts`): blocking-safe HIGH vs warning-only LOW measurability markers (union
  byte-identical to the legacy set — existing falsifiability behavior preserved).
- MCP structured output: `outputSchema` on the deliverable-gate tools + `structuredContent` in every response.
- Resource caps (`limits.ts`): input-size rejection (`InvalidParams`) + diagnostic output truncation with a
  `truncation` report.
- **Reference host-enforcement layer** (`src/host/`, deterministic — no LLM/agent/network/clock): makes the
  gate mandatory rather than advisory. `enforceDeliverable(spec, artifacts)` authors a host contract, runs
  `finalize_deliverable`, verifies the anti-swap `answer_text_hash` against the surfaced text, and returns a
  binding `RELEASE`/`REJECT` decision + `corrective_prompt`. New `ct-enforce` CLI (exit 0 RELEASE / 1 REJECT
  / 2 bad input) for pipeline/CI gating. Docs: `docs/designs/HOST_ENFORCEMENT.md`.
- Shared `CONTEXT_PROPERTY` schema (deduped 7 copies). Tests: 158 → **296**.
- Design discipline: BLOCK only on unforgeable within-request signals (verbatim containment, re-derivation,
  interval/graph math); everything self-declared is WARNING; enforcement of "done" is host-side.

## 0.1.0-beta.3 — 2026-04-15

Third public beta.

- narrows the Vitest publish gate to the canonical `tests/` tree instead of transient `.claude/worktrees/` copies
- refreshes the npm package description with a clearer value proposition
- bumps the published package and server version to `0.1.0-beta.3`

## 0.1.0-beta.2 — 2026-04-08

Second public beta.

- adds a consolidated repo-level roadmap in `ROADMAP.md`
- links the roadmap from the main `README.md`
- bumps the published package and server version to `0.1.0-beta.2`

## 0.1.0-beta.1 — 2026-03-31

First public beta.

- 9 MCP tools: validate_reasoning_chain, check_numeric_claims, verify_arithmetic, detect_drift, evaluate_tradeoffs, check_plan_validity, score_response_quality, validate_confidence, detect_concurrency_patterns
- 15 enforcement mechanisms, all deterministic and stateless
- 56 benchmark scenarios (42 defect + 14 clean control)
- Benchmark results: CT-MCP detected the planted defect in 42/42 defect scenarios, 0/14 false positives (the baseline/prompted comparison rows were synthetic placeholders, so a measured "42/42 vs baseline / vs prompted" head-to-head is not reproducible and is pending a real-model run)
- MAD-based outlier detection for small samples
- Geometric ratio fabrication detection
- Arithmetic verification (sum, weighted average, percentage, compound growth, product)
- Concurrency hazard detection (check-then-act, lost update, dual write, missing idempotency, ordering assumptions)
- Monotonicity checking for percentiles and SLA tiers
- Ungrounded entity detection
- Claim classification for tool routing
- Iterative enforcement with explicit caller-provided context
