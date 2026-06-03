# CT-MCP Phase 4 — Results & Conclusion

> **Date:** 2026-06-02 · **Branch:** `tool-surface-consolidation` · **Status:** concluded from the calibration + repair pilot (human-approved). Pre-registration: [`PHASE4_PREREGISTRATION.md`](designs/PHASE4_PREREGISTRATION.md) (Amendments A/B/C). Evidence: `benchmark/phase4/calibration_run.json`, `benchmark/phase4/a5_probe_summary.json`, `benchmark/phase4/repair_run.json`, `benchmark/reports/live_gate_score.json`.

## Verdict (one paragraph)

On a strong, shipping-class model (Claude Haiku 4.5), the Phase-4 evidence lands on the pre-registered **§11/§12 narrowing**: CT-MCP is, honestly, **structured prompting + a deterministic linter**. Its defensible, measured value is **deterministic *catching* of planted/injected defects** (fabrication, arithmetic-provenance, grounding, constraint) — **not** making the model reason better, **not** improving repair, and **not** (measurably) artifact-binding. The natural-defect ablation is **inconclusive by construction** (inferred from 0.000 arm-agnostic density — the 4-arm split was not run); the repair pilot (directional, n=6) shows the gate gives **no advantage** over generic feedback or self-review, at a large token cost. The one fully-powered result is the opposite-signed positive: on 147 hand-edited bundles the gate separates defects from clean work **perfectly** (106/106 blocked, 0/41 false). None of this contradicts the deterministic-value thesis — it bounds it honestly to what a deterministic predicate can do for a competent model.

## What was tested

Three measurement tracks, of differing statistical strength:
- **Natural generation** — measured as *arm-agnostic* defect density (one plain-generation arm at k=8, n=200); the 4-arm A/B/C/D split was **not run separately** (there were no defects for any arm to prevent — see Finding 3).
- **Injected-defect gate mechanics** — the gate over hand-edited structured bundles (no model in the loop); the **only fully-powered track** (n=147: 106 mutants + 41 correct bases, real Wilson CIs).
- **Repair track** (the §10-primary endpoint) — a 4-arm pilot (A/B/C/D) via the real ct-mcp server driven by the local `claude` CLI multi-turn, no billed API; **directional only** (n=6 bases, 1 sample/cell, no CI). Reads: B vs D = binding · D vs C = enforcement · C vs A = structure.

## Findings

| # | Finding | Evidence |
|---|---|---|
| 1 | **Mechanism feasible.** `claude -p` drives the real ct-mcp server multi-turn, non-interactively; tools fire, `finalize_deliverable` binds (`answer_text_hash`/`plan_token`), token ledger recovers, `permission_denials: []`. | STEP-1 (`STEP1_FINDINGS.md`) |
| 2 | **Arm B is viable.** With a worked-example `BIND_SYS`, Haiku reaches a finalize RELEASE in ~3 turns on correct answers (proofs re-executed, answer bound). | A5 (`a5_probe_summary.json`) |
| 3 | **Natural defect density = 0.000** (Wilson 95% [0, 0.026], n=144 failure-prone) on a hard, method-trap corpus. The round-1 0.06 was *entirely* grading bugs. | calibration round 2 (`calibration_run.json`) |
| 4 | **Injected-defect gate mechanics (the one fully-powered result): perfect separation of 147 bundles** — 106/106 mutants blocked, 0/41 correct bases false-blocked. block_recall 1.0 [0.965,1] (over 106 mutants from ~41 independent bases), false_block 0/41 [0,0.086], precision 1.0 [0.965,1]. This is the gate as a deterministic validator of *hand-edited structured defects* (renderer-unit-test scope), **not** evidence it catches model fabrication — but within that scope the discrimination is clean and CI-backed. | `live_gate_score.json` + Wilson CIs |
| 5 | **Repair: the gate gives no advantage.** On the pilot (6 bases × 4 arms): **A 6/6, C 6/6, B 4/6, D 5/6.** Arms *without* the gate repaired perfectly; arm B (gate) repaired *worse* (its 2 losses were finalize-loop `no_answer`, not bad feedback) and at **3–11 turns vs A/C's 1**. | `repair_run.json` |
| 6 | **No measured binding benefit (directional).** A5 showed Haiku produces faithful derivations (no answer↔artifact drift to catch), and on the pilot D (no binding, 5/6) ≥ B (binding, 4/6). `binding_attributable_catch` is **inferred ≈ 0**, not directly measured — and n=6 cannot separate "binding inert" from "binding too costly" (B's 2 losses were finalize-loop truncations; D's 1 loss was a genuinely *wrong* answer the gate would have caught). Consistent with the pre-registered B==D legitimate null. | A5 (n=2) + repair pilot (n=6) |

## Decision-tree outcome (which pre-registered nodes fired)

- **ALL-TIE-HIGH (natural ablation) — INFERRED, not measured:** at 0.000 arm-agnostic natural defect density there is nothing for any arm to prevent, so a 4-arm tie at ceiling follows *by construction*. The 4-arm A/B/C/D natural run was **not executed** (pre-registered as optional, Amendment C); the inconclusive result is an inference from the 0.000 density, not a measured per-arm tie.
- **C≈B / B⊁D KILL (directional, n=6):** on the repair pilot the gate's enforcement+binding shows no advantage over a prompted checklist (C, 6/6) or generic feedback (A, 6/6) — in fact B (4/6) did *worse* — and binding ≤ no-binding (B 4/6 ≤ D 5/6). → the **binding/enforcement value claim is not supported**; the headline narrows to *fabrication/arithmetic/grounding catching* (§12). Pilot-grade, not CI-backed.
- **H4 repair primary:** B's raw `repair_success_2 = 4/6 = 0.67` **clears the pre-registered 0.50 absolute bar** — but it is **not a gate-attributable win**, because A and C (no gate) both hit 6/6. The §10-primary endpoint shows no *differential* gate repair value on a competent model (directional, n=6).
- **cost-honesty:** even where B succeeds it costs 3–11× the turns of A/C → any tie would be a large token premium, not a win.

## What CT-MCP can and cannot defensibly claim (post-Phase-4)

**Can claim (proven, deterministic):**
- The gate **deterministically catches planted/injected defects** with measured recall 1.0 [0.965,1] and false-block 0 [0,0.086] on the injected corpus (scope: structured-bundle validation).
- The binding chain (`contract → artifacts → answer_text_hash`) is real and tamper-evident; raw-client spoofing and answer-substitution are rejected (existing `ct-enforce` tests).
- Arm B is *operable*: a model can drive the gate to a RELEASE.

**Cannot claim (unproven / disproven on a strong model):**
- ❌ "Reduces high-severity defects" in live workflows — **UNPROVEN** (the model doesn't produce them; ledger `mkt-reduces-high-sev-defects` stays `unproven`).
- ❌ Improves model reasoning — out of scope by design (N4 boundary).
- ❌ Improves repair — **no measured advantage** (A=C=6/6, B=4/6).
- ❌ Binding is the active ingredient — **B≈D**, `binding_attributable_catch` ≈ 0.

## Limitations / scope of these findings
- **Evidence strength is uneven (important):** the *catching* result (Finding 4) is fully powered and CI-backed (n=147 bundles); the *repair* and *binding* nulls (Findings 5–6) are **directional pilots** (n=6 bases / A5 n=2), no CI, concluded from direction by approval. So **"the gate catches every planted defect" is far better-evidenced than "the gate adds no repair/binding value."** The latter is a strong-but-pilot-grade signal, consistent with all other evidence, not a powered null.
- **Single model class** (Haiku 4.5) + a small Sonnet point not yet run; a genuinely *weaker* model would defect more and might show natural separation (explicitly declined as the dev target).
- **Repair pilot is small** (n=6 bases, 1 sample/cell, single-defect drafts); concluded from direction by approval, not a powered CI. A larger, fair-budget run could only move B from "worse" to "tied at higher cost" — not to "better."
- **The injected 100%/0% result is gate mechanics**, not live-workflow value (per `scope-output-not-workflow`).

## The honest takeaway

CT-MCP is a **correct, deterministic linter for structured deliverables** with a real, tamper-evident binding chain. For strong models, that buys defect *catching* on the rare occasions defects appear (and host-authored contracts that can make underdeclaration release-blocking — the Phase-5 path) — but it does **not** make a competent model reason, repair, or self-prove better, and forcing the artifact spine costs significant tokens. The marketing claim narrows accordingly; the engineering is sound and the boundaries are stated up front, exactly as the deterministic-value plan required.
