# Implementation Changes — Deliverable-Centric Robustness Layer

> **What this is:** a precise record of the **actual code changes** made (not the design intent — that's
> in [`robustness-additions.md`](robustness-additions.md)). Everything below is in the working tree,
> uncommitted, on top of `aa0fc93` (`ct-mcp@0.1.0-beta.3`). Verified: `tsc --noEmit` clean, `npm test` →
> **296 passed**, stdio server lists **11 public tools** (the 9 analyzers + the `plan_checks` →
> `finalize_deliverable` spine; the 7 leaf checks are internalized). Includes the post-review revisions
> in §I and the surface consolidation + high-risk false-block fix (see CHANGELOG).

## Summary

| | Before | After | Δ |
|---|---|---|---|
| Public MCP tools | 9 | **11** | +2 public spine tools; 7 deterministic leaves internalized |
| Test cases (`it`) | 158 | **296** | +138 |
| Source files (`src/`) | 30 | **42** | +12 new, 10 modified |
| `outputSchema` on tools | 0 | **11 public tools** | public surface |
| `structuredContent` in responses | no | **yes** | both branches |
| Input/output resource caps | none | **enforced** | dispatcher (`limits.ts`) |
| Duplicated `context` schema | 7 copies | **1 shared constant** | consolidated |

**Design discipline held throughout:** a check may **BLOCK** only on an *unforgeable within-request*
signal — verbatim substring containment, numeric re-derivation, pure interval/set math, or graph
reachability/cycles/max-flow. Everything self-declared (authority, claim lists, contract criteria,
trust tier) is **WARNING**. Enforcement that a non-cooperating agent can't skip is **host-side**.

---

## A. New deliverable mechanisms (2 public tools + 7 internal leaves)

All live in `src/tools/`, registered in `src/mcp/tool-call.ts` (`TOOL_HANDLERS`) and described in
`src/mcp/tool-definitions.ts` (`TOOLS`, each with `inputSchema` **and** `outputSchema`).

| Tool | LOC | BLOCK signal (unforgeable) | WARNING | Honest limit |
|---|---|---|---|---|
| `plan_checks` | 100 | *never blocks* (planner) | advisory notes | n/a — it plans, finalize gates |
| `check_quote_grounding` | 272 | span ⊄ source; token ⊄ span; numeric/date/entity token absent from claim | comparison comparator missing; `trust_tier`/authority metadata | internal grounding vs supplied corpus, not external truth |
| `check_claim_coverage` | 154 | *never blocks* (advisory) | low declared coverage; auto-detected unaccounted claim-spans | declared claims only; can't prove claim list complete |
| `finalize_deliverable` | 333 | re-runs required checks inline; `must_include`/`must_not_include`/numeric criterion substring gates; missing required-check inputs | unanchored criterion; weak (agent-authored) contract | proves declared obligations discharged, not answer truth |
| `trace_conclusion_numbers` | 259 | re-derivation mismatch; out-of-range ref | numbers in answer not declared (omission) | only traces declared numbers |
| `check_answer_against_constraints` | 280 | predicate false; field absent; numeric bound absent from its `source_quote`; missing required_field | `source_quote` ⊄ request; request-named field uncovered | agent authors both constraints and answer |
| `check_freshness` | 200 | (host authority only) source after eval_time; stale/undated when `requires_dated_sources` | agent-authority staleness; undated | only as honest as supplied eval_time + dates |
| `check_case_partition` | 213 | any overlap / interior gap / leading-trailing gap (interval+set math) | — | requires explicit intervals/members, not prose |
| `check_profile_downgrade` | 113 | *never blocks* (advisory) | declared `task_type` weaker than the request/answer shape implies | heuristic regexes; host strict mode may act |

**Tool count:** 9 original analyzers + 2 public spine tools = **11 public MCP tools**. The 7 leaf
checks remain internal mechanisms re-executed by `finalize_deliverable`.

## B. New internal modules (2)

- **`src/enforcement/check_planner.ts` (157 LOC)** — `planChecks(contract)` (static `PROFILE_MAP` per
  `task_type` + a policy layer over `evidence_level`/`risk_level`/`freshness`) and `inferTaskType()`.
  `UNFORGEABLE_CHECKS` set gates which checks may be promoted to blocking / enter `finalize_required`.
  Pure lookup; never blocks.
- **`src/enforcement/markers.ts` (58 LOC)** — the **precision split**: `HIGH_PRECISION_MARKERS`
  (blocking-safe: unit thresholds, comparators+numbers, error codes, failure outcomes, time windows) and
  `LOW_PRECISION_MARKERS` (warning-only: bare 3-digit, version, CamelCase, dotted paths, file paths). The
  union `isMeasurable()` is **byte-identical** to the legacy `MEASURABILITY_MARKERS` set, so existing
  falsifiability behavior is preserved.
- **`src/enforcement/limits.ts` (≈110 LOC)** — `enforceInputLimits` (reject oversized requests) +
  `capDiagnostics` (truncate diagnostic arrays / corrective prompt, report it). Wired in `tool-call.ts`.

## C. Modified existing files (10)

| File | +/− | What changed |
|---|---|---|
| `src/enforcement/types.ts` | +102 | Added `DeliverableContract`, `SourceManifestEntry`, `GroundingClaim`, `ClaimKind`, `AcceptanceCriterion`, `ContractClaim`, `TaskType`/`EvidenceLevel`/`RiskLevel`, `PlanResult`/`PlannedCheck`, and `freshness` on the contract. Additive only. |
| `src/enforcement/utils.ts` | +41 | Added `normalizeWhitespace`, `sha256Hex` (`node:crypto`), `canonicalJson` (sorted keys), `extractNumericTokens`. Additive. |
| `src/enforcement/confidence_product.ts` | +70/− | **Widened** `extractClaimedConfidence` (adds `p=0.X`, `N out of 10`, stance-anchored phrases; returns **max**; polarity-guarded against negation) — a strict superset of the legacy 3 patterns. Added new mechanism `checkConfidenceHedgeConsistency`. |
| `src/enforcement/falsifiability_checker.ts` | +132/− | Now imports `markers.js`. Added `isBoundToAssumption`, `checkFalsifiabilityBound`, `isTautological` (bare-negation only when it adds no novel content). `checkFalsifiability(string[])` signature + behavior unchanged. |
| `src/enforcement/index.ts` | +4/− | Re-exports the new helpers (`checkConfidenceHedgeConsistency`, `checkFalsifiabilityBound`, `isTautological`, `isBoundToAssumption`). |
| `src/tools/validate_confidence.ts` | +41 | **(behavior change — see §E)** Wires Tier-2: per-assumption binding + tautology **WARNINGs**, and the confidence/hedge contradiction (WARNING ≥0.8+moderate; **BLOCK** ≥0.9+heavy). |
| `src/tools/validate_reasoning_chain.ts` | +219 | **Opt-in** `#10` redundant-evidence (vertex-disjoint max-flow via node-split Edmonds-Karp; root-evidence-only sources; unigram-set independence) and `#11` premise-usage reconciliation (support-only reverse-reachability; phantom/direct→BLOCK, transitive→WARNING). Absent inputs ⇒ unchanged. |
| `src/tools/check_plan_validity.ts` | +82 | **Opt-in** `require_failure_branches`: effect-bearing step must declare `on_failure`; dangling target → BLOCK; unbounded `on_failure` loops + unbounded in-place retry → WARNING (honors `max_attempts`). Adds `failure_branch_coverage` to output. Absent flag ⇒ unchanged. |
| `src/mcp/tool-call.ts` | rewritten dispatch | Registers all 9 new handlers; emits `structuredContent` in both branches; **input caps** (`enforceInputLimits`) → `InvalidParams`; **output caps** (`capDiagnostics`) with a `truncation` report. |
| `src/mcp/tool-definitions.ts` | major | 9 new `TOOLS` entries with `inputSchema` + `outputSchema`; opt-in fields on the extended tools; `validate_confidence.strict`; **shared `CONTEXT_PROPERTY`** (deduped 7 copies); **`outputSchema` attached to the original 9** via a post-array map. |

## D. New enforcement vocabulary (blocking/warning `mechanism` strings)

Added by this work (used in `blocking_issues[].mechanism` so hosts can route): `quote_grounding`,
`number_provenance`, `constraint`, `required_field`, `freshness`, `partition_gap`, `partition_overlap`,
`premise_usage`, `redundant_evidence`, `failure_branch`, `confidence_hedge`, `finalize_grounding`,
`finalize_missing_inputs`, `must_include`, `must_not_include`, `numeric_not_shipped`,
`structural_criterion`.

## E. Behavior changes & backward compatibility

**`validate_confidence` is the only existing public tool with a default-behavior delta, and after the
post-review revision (§I) that delta is WARNING-only:**
- It may now emit **new WARNINGs** (floating/tautological falsification conditions; confidence/hedge
  tension). A previously-`PASS` response that had no `enforcement` block can now carry one (`status` still
  `PASS`).
- The confidence/hedge contradiction **no longer BLOCKs by default** — it is gated behind opt-in
  `strict: true` (§I.2). So there is **no new default BLOCK** on any existing tool.
- The widened extractor is a strict superset (only raises detected confidence), polarity-guarded so
  `"almost certainly NOT…"` is not read as high confidence.
- **All 23 circumvention tests still pass.**

**Everything else is backward-compatible:** the 9 new tools are additive; the graph (`#10`/`#11`) and plan
(`#16`) extensions are **opt-in** (absent input ⇒ byte-identical prior behavior, verified by the
unchanged existing tests). The `structuredContent` envelope addition is additive (text block preserved).

## I. Post-review revisions (from the design review of these docs)

| # | Change | Type |
|---|---|---|
| I.1 | **Freshness timestamp policy → strict (Option A).** `check_freshness` now accepts **only** epoch-ms or a fully-zoned ISO-8601 datetime. **Date-only** (`2026-05-30`) and offset-less datetimes are rejected (ambiguous / non-deterministic). Resolves the doc contradiction; removes start-vs-end-of-day ambiguity. | code + tests |
| I.2 | **`confidence_hedge` BLOCK gated behind `strict: true`.** Default is WARNING-only, so `validate_confidence` gains no new default BLOCK. Added clean-control tests for assertive-but-cautious prose (no block even under strict). | code + tests |
| I.3 | **`tool_result` acceptance-criterion kind rejected.** `finalize_deliverable` now throws `InvalidParams` on any acceptance-criterion `kind` outside `{numeric, structural, coverage, inline_check}` — pinning the "re-execute, never trust a prior hash" model. | code + tests |
| I.4 | **`check_profile_downgrade` implemented** (tool #18, warning-only) — flags when a declared `task_type` is weaker than the request/answer shape implies (the easiest way to dodge the strict profile). | code + tests |
| I.5 | **Regex-safety confirmed** for the field-name `RegExp` in `check_answer_against_constraints` (the `[a-z0-9]`-strip neutralizes injection/ReDoS); locked with a metachar-field test. | tests |
| I.6 | **Resource caps implemented** — new `src/enforcement/limits.ts`, wired in `tool-call.ts`. INPUT caps reject pathological requests (`>5 MB`, any array `>5000`, any string `>1 MB`, depth `>64`) as `InvalidParams`; OUTPUT caps truncate diagnostic arrays + over-long corrective prompts to 100 with a `truncation: {field:{returned,total}}` report. Verified end-to-end (150 violations → 100 + report). | code |
| I.7 | **`outputSchema` added to the original 9 tools** (attached via a post-array map in `tool-definitions.ts`). All **18** tools now declare an `outputSchema` → the global structuredContent-validity gate is now possible. | code |
| I.8 | **`context` schema consolidated** — the ~45-line block (7 copies) replaced by one shared `CONTEXT_PROPERTY` constant. | code |

**No implementation items remain open.** Deferred to the next session (per owner): the *test layers*
themselves (property/differential/fuzz/mutation/corpora) — see
[`STRESS_TEST_STRATEGY.md`](STRESS_TEST_STRATEGY.md). The caps' tunable values in `limits.ts` are first-cut
defaults to calibrate against real corpora.

## F. Bugs found in adversarial review & fixed (the real record)

Each implementation phase was adversarially reviewed (subagents + a 4-agent verification workflow that
brute-forced the max-flow against 60k random graphs). Confirmed bugs, all fixed + regression-tested:

| Phase | Bug | Severity | Fix |
|---|---|---|---|
| factual-QA | `claim_kind:numeric` compared *all* span numbers → `"p99"` leaked a `99`, masking a swapped number | high bypass | compare the supporting token's number only |
| numeric tracing | tolerance denominator floored at 1 → "relative" tol became a loose absolute window for sub-unit numbers | high bypass | true relative tolerance + epsilon; arity enforcement |
| constraints | numeric `in`-list bound stringified to `"100200"` → false block | high false-block | per-element extraction |
| constraints | `==`/`!=` treated `100` ≠ `"100"` | medium | `normScalar` numeric coercion; decimal-only `toNumber` |
| freshness | offset-less ISO datetime parsed in host-local TZ → non-deterministic | high determinism | reject offset-less datetimes (require `Z`/offset) |
| Tier-2 | polarity-blind extraction → `"almost certainly NOT…"` + hedging falsely fired the hedge BLOCK | high false-block | negation look-ahead on new phrases |
| Tier-2 | `isTautological` false-flagged specific negative conditions | medium | bare-negation only when no novel content |
| redundant evidence | derived `evidence` node counted as an independent source | high bypass | only in-degree-0 (root) evidence are sources |
| redundant evidence | bigram-Jaccard independence false-blocked single words & missed reordered dupes | medium | unigram token-set + exact fallback |
| premise usage | walked `contradicts` edges → contradicting node treated as a premise | high false-block + bypass | support-only reverse adjacency |
| plan failure-branches | any back-edge false-blocked as a cycle; unbounded in-place retry missed | high ×2 | honor `max_attempts`; loops → WARNING |
| case partition | NaN bounds broke determinism; enum within-case duplicate false-blocked | medium | reject NaN; dedup members |

## G. Tests added (111 across 6 files + 2 fixtures)

| File | tests | Covers |
|---|---|---|
| `tests/tools/factual_qa_slice.test.ts` | 16 | plan_checks, quote_grounding (golden + fabricated span/token/numeric), claim_coverage advisory, finalize golden + adversarial |
| `tests/tools/numeric_constraints.test.ts` | 24 | trace_conclusion_numbers + constraints + finalize numeric path + review regressions |
| `tests/tools/freshness.test.ts` | 12 | host/agent authority, stale/future/undated, epoch-ms, **strict timestamp policy** (date-only + offset-less rejected, TZ-locked) |
| `tests/tools/structural_checks.test.ts` | 30 | MECE numeric/enum + hygiene, plan failure branches, redundancy max-flow, premise usage + all review regressions |
| `tests/enforcement/tier2_hardening.test.ts` | 21 | widened extraction, hedge contradiction (strict-gated + cautious-prose clean control), binding, tautology, polarity guard |
| `tests/tools/review_followups.test.ts` | 8 | profile-downgrade, `tool_result` rejection, constraints regex-safety |
| `tests/fixtures/factual_qa/*.json` | (2) | golden grounding + finalize inputs |

## H. Not changed / out of scope

- The 9 original tools' algorithms (only `validate_confidence` gained the Tier-2 wiring; the rest are
  untouched). The 158 pre-existing tests pass unchanged.
- The existing ~80-line `context` schema is still copy-pasted across the original 9 tool definitions (the
  new tools avoid the copy; consolidation deferred).
- No new dependencies; no server state, keys, network, or clock reads introduced. `node:crypto` (already
  used for `randomUUID`) is now also used for `sha256Hex`.
