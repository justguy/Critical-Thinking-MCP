# Changelog

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
