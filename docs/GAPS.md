# CT-MCP — Honest Gaps & Open Questions

> What CT-MCP does **not** prove, stated up front. This file is the single place
> that collects the boundaries scattered across [`PHASE4_RESULTS.md`](PHASE4_RESULTS.md),
> [`PHASE5_RESULTS.md`](PHASE5_RESULTS.md), and the claims ledger
> (`CLAIMS_LEDGER.jsonl`). The README points here so the positive claims stay
> honestly bounded.

> **Status legend:** `by-design` = a deliberate scope boundary, not a defect ·
> `mitigated` = bounded / worked-around but not fully closed · `open` = real and
> unresolved. A cross-reference table mapping every ledger `claim_id` to the
> section that covers it is at the end.

## 1. Semantic correctness is out of scope (the N4 boundary) — *by-design*

Deterministic checks cannot verify whether reasoning is *right*, only whether it
is *internally consistent and self-grounded*. A **wrong method that self-traces
consistently PASSES the gate**: the arithmetic reconciles, every claim quotes a
supplied span, every number re-derives — but the method itself is wrong. The
gate catches forgeable-vs-unforgeable failures, not world-model errors. This is
the hard ceiling on the whole product; no arm is ever credited for catching a
semantic-method error (Phase-4 prereg §0). (Ledger:
`scope-no-semantic-correctness`; `mkt-reduces-high-sev-defects` stays
`unproven`.)

## 2. The headline marketing claim — and the vs-baseline win — are not facts — *open*

**"Reduces high-severity defects in live workflows" is UNPROVEN** (`mkt-reduces-high-sev-defects`):
a strong model does not naturally produce such defects, so there is nothing for
the gate to prevent in the natural arm. Separately, the earlier **"30/30 (and
42/42) vs baseline / vs prompted" head-to-head win is `contradicted`**
(`emp-30-30-vs-baseline`) — the synthetic baseline rows were not a measured
comparison, and these are tracked phrases that may not be reintroduced as facts.
What survives is narrower: a **detection-quality count of the tools in isolation**
on a hand-crafted corpus (42/42 planted defects caught, 0/14 false on clean
controls — `emp-42-detect-quality`, still `unproven` and **not** a vs-baseline
win).

## 3. No measured reasoning / repair / binding improvement on a strong model — *open (directional nulls)*

Phase 4 is explicit and the evidence is **uneven in strength**:

- The **catching** result is fully powered and CI-backed (n=147 hand-edited
  bundles: 106/106 blocked, 0/41 false-block, recall 1.0 [0.965,1]).
- The **no-repair-value** and **no-binding-benefit** conclusions are
  **directional pilots** (n=6 bases, 1 sample/cell, **no CI**). On that pilot the
  arms *without* the gate repaired best (A generic feedback 6/6, C self-review
  6/6), arm B (gate + binding) repaired 4/6 at 3–11× the turns, and D
  (forced artifacts, no binding) 5/6 ≥ B. So binding is **inert / B≈D** on a
  strong model; `binding_attributable_catch` is **inferred ≈ 0, not directly
  measured**.

"The gate catches every planted defect" is therefore far better-evidenced than
"the gate adds no repair/binding value." (Ledger: `emp-repair-no-gate-advantage`,
`emp-no-measured-binding-benefit`, `scope-phase4-narrowed-claim`.)

The artifact spine also costs **3–11× the turns** of a prompted checklist even
when B succeeds — so the cost-honesty veto applies: any tie would be a large
token premium, not a win. And n=6 cannot separate "binding inert" from "binding
too costly" (B's 2 losses were finalize-loop `no_answer` truncations; D's 1 loss
was a genuinely wrong answer the gate would have caught). (Ledger:
`emp-repair-no-gate-advantage`, `emp-no-measured-binding-benefit`,
`scope-phase4-narrowed-claim`.)

## 4. The natural-defect ablation is inconclusive by construction — *mitigated (honestly reported)*

Claude Haiku 4.5's natural high-severity defect density is **0.000** (Wilson 95%
[0, 0.026], n=144 failure-prone). Because there were **no natural defects for any
arm to prevent**, the pre-registered 4-arm (A/B/C/D) natural split was **not run
separately** (it was pre-registered as optional, Amendment C) — the inconclusive
result is an *inference* from the 0.000 density, not a measured per-arm tie.
Corpus hardening into the [0.15, 0.40] defect band was **skipped**: a strong
4.5-class model aced method-traps, 4-step chains, and distractor-RAG, and pushing
it further would have needed contrived torture tasks of dubious validity — the
"modern models are good now" wall, not engineered around. (Ledger:
`emp-haiku-zero-natural-defect`; `road-4arm-ablation` stays `planned`.)

## 5. The injected 100% / 0% result is gate *mechanics*, not live fabrication — *by-design (scope)*

The perfect injected-defect separation is the gate validating **hand-edited
structured bundles** (renderer-unit-test scope; the `goldBundle` mutator plants
the correct gold in the derivation and mutates only the rendered field). It is
**not** evidence that CT-MCP catches a live model *producing* fabrication in a
real workflow — the model in the B track produced ~0% natural defects. The quoted
**"n=106" is ~41 clustered bases**; CIs cluster-resample whole bases (~41
effective n), so the recall CI is not falsely tightened by treating mutants as
independent. Workflow value remains the open question. (Ledger:
`scope-output-not-workflow`, `emp-gate-output-defect-recall`.)

## 6. Blocker-code labeling is a routing diagnostic, not a recall gap — *open (diagnostic)*

`blocker_code_accuracy` is **27.4%**: the gate reliably *blocks*, but it labels
some defects with the wrong code (a numeric mismatch caught as
`FINAL_ANSWER_ARTIFACT_DRIFT`, a fabrication as `SOURCE_SPAN_MISMATCH`). Recall is
still 1.0 — this is a labeling/routing diagnostic, not missed defects. Separately,
**4 of the 9 section-7 blocker codes** (`UNDECLARED_ASSUMPTION`,
`OPTION_COVERAGE_GAP`, `PROFILE_DOWNGRADE`, `FINAL_ANSWER_ARTIFACT_DRIFT`) have
**no injected-defect mutators**, so they are unmeasured by the injected corpus.

## 7. Phase 5 live realism arm is small — *mitigated (facade artifact mode)*

The corrected live arm had **8 gradeable deliverables + 6/14 unparseable** — the
model could not emit valid grounded-claim JSON single-shot for grounding-heavy
deliverables. The clean `0/7` false-block rests on the simpler
structured/constraint deliverables. The `review_before_final` `artifact`-mode fix
improved parseability **0/3 → 3/3**, but the model still makes *real* grounding
errors (e.g. `supporting_token` not inside the quoted span) which the gate
**correctly catches** (an ideal fill RELEASEs) — that is the gate working, not
friction. (Ledger: `emp-phase5-host-gate-false-release`,
`scope-phase5-low-friction-conditional`.)

Low friction is also **conditional on correct contract authoring**. As-run, the
frozen kill rule **fired** (`ship_worthy = false`: realism_false_block 1/6,
`spine_required` true) — traced **entirely** to one over-specified contract
(`fin_numeric_dag`, `numeric_analysis` + `evidence_level: rederived`, which
hard-requires a `numeric_derivation` DAG + `arithmetic_checks`). The same
"total = X" requirement authored as a `==` constraint RELEASEs a good-faith
single-shot deliverable spine-free and REJECTs a wrong total. A corrected re-run
(anti-pattern re-authored, **gate unchanged**) demonstrated `ship_worthy = true`
(false_block 0/7, no spine, reduction 1.0). So the gate is low-friction **only**
when contracts follow [`HOST_CONTRACT_AUTHORING.md`](designs/HOST_CONTRACT_AUTHORING.md);
an over-specified contract WILL block good single-shot work. (Ledger:
`emp-phase5-friction-is-authoring` — *mitigated*, fix is authoring guidance.)

## 8. The decision family is advisory, not gate-checked — *by-design*

`review_before_final` `enforce` mode **signals** (`enforce_required` +
`corrective_prompt`) but does **not itself run the gate or block**. The decision
task family in particular is advisory — its checklist/critique carry the value,
and nothing in the facade verifies the answer.

## 9. Decode is not pinnable; single model class — *open*

The local `claude` CLI exposes no `--temperature` / `--seed`, so runs are not
bit-reproducible (MDE ≈ 0.20). All evidence is a **single model class** (Haiku
4.5 + a small Sonnet point): **no weaker-model arm** (which would defect more and
might show natural separation), **no live multi-agent adoption**, and **no
independent human scoring** yet.

## 10. Default-minimal surface is a breaking change — *by-design (intentional)*

By default `tools/list` advertises **only** `review_before_final`. Integrations
that relied on the 11-tool spine (analyzers + `finalize_deliverable`) being
*advertised* must now set `CT_EXPOSE_ALL`. Bare `CT_DISABLE_FINALIZE` now yields
the facade-only surface (it has nothing to remove). Hiding is **discovery-only** —
`tools/call` still dispatches all 12 handlers — but discovery-driven clients see
the change. (Ledger: `arch-11-tool-spine`.)

## 11. Measurement-instrument & tooling caveats — *mitigated / open*

The numbers rest on recently-built measurement code, which carries its own
caveats:

- **The grading instrument had real bugs (now fixed).** Round-1's apparent 0.06
  natural-defect signal was **entirely grading bugs** — a currency-adjacency span
  mismatch (`"50 per month"` vs `"$50 per month"`), JSON answers buried under the
  CoT system prompt, numeric mis-extraction from verbose CoT. The true 0.000 rate
  holds only on the *fixed*, fixture-tested, content-hashed oracle; any future
  oracle change risks re-introducing such artifacts. *(mitigated)*
- **The CI / statistics library is net-new.** No bootstrap / Wilson / McNemar code
  existed before Phase 4; it was built, unit-tested against textbook fixtures, and
  hashed — but every CI in these docs depends on young, load-bearing code.
  *(mitigated)*
- **The `clean-control false-block ≤ 2%` ceiling is unverifiable at current n.**
  It needs clean-control n ≥ 150; at pilot n it is directional only. The headline
  false-block figures (0/41 injected, 0/7 Phase-5 corrected) are point estimates
  with Wilson upper bounds, not a verified ≤2% rate. (Ledger:
  `emp-clean-false-block-2pct`, still `unproven`.) *(open)*
- **Token charging relies on the top-level `result.usage` ledger** (per-turn
  reconciliation was withdrawn as streaming-delta, not billable); a ~3.3×
  cold/warm cache swing is neutralized by per-cell cache-warming. The sole guard
  against arm B "winning" on tokens (`quality_per_1k_tokens`) depends on that
  ledger being faithful. *(mitigated)*

## Ledger cross-reference

Every claims-ledger entry that bears on a boundary, mapped to the section above.

| Ledger `claim_id` | Status | Covered in |
|---|---|---|
| `scope-no-semantic-correctness` | proven | §1 |
| `mkt-reduces-high-sev-defects` | unproven | §1, §2 |
| `emp-30-30-vs-baseline` | contradicted | §2 |
| `emp-42-detect-quality` | unproven | §2 |
| `emp-repair-no-gate-advantage` | proven | §3 |
| `emp-no-measured-binding-benefit` | proven | §3 |
| `scope-phase4-narrowed-claim` | proven | §3 |
| `emp-haiku-zero-natural-defect` | proven | §4 |
| `road-4arm-ablation` | planned | §4 |
| `scope-output-not-workflow` | proven | §5 |
| `emp-gate-output-defect-recall` | proven | §5, §6 |
| `emp-phase5-host-gate-false-release` | proven | §7 |
| `emp-phase5-friction-is-authoring` | proven | §7 |
| `scope-phase5-low-friction-conditional` | proven | §7 |
| `arch-11-tool-spine` | proven | §10 |
| `emp-clean-false-block-2pct` | unproven | §11 |

