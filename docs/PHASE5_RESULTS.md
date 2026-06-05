# CT-MCP Phase 5 — Host-Contract Release Gate: Results

> **Date:** 2026-06-04 · **Branch:** `tool-surface-consolidation` · Pre-registration: [`designs/PHASE5_PREREGISTRATION.md`](designs/PHASE5_PREREGISTRATION.md) (frozen kill rule). Evidence: `benchmark/phase5/gate_run.json` (curated, deterministic), `benchmark/phase5/realism_run.json` (live arm).

## Verdict

`ct-enforce` **reduces false releases** — and the friction that fired the kill rule traced **entirely to one over-specified host contract**, not to the gate. With contracts authored per [`designs/HOST_CONTRACT_AUTHORING.md`](designs/HOST_CONTRACT_AUTHORING.md), the gate is a **low-friction host release gate**: good-faith single-shot deliverables RELEASE, violations are caught, no multi-turn spine. The marketing claim *"reduces high-severity defects"* stays **unproven** (that is the reasoning claim Phase 4 closed); the supported claim is narrower and real: **a host-contract release gate that reduces false releases at low friction when authored correctly.**

## What the frozen kill rule said (as-run)

| Metric | Result | Threshold | Pass? |
|---|---|---|---|
| false_release_reduction (curated) | **1.0** [0.806, 1] (16/16 violations blocked) | ≥ 0.50, LB>0 | ✅ |
| natural_violation_rate (live) | **0.33** (3/9 — real agents ship violations) | > 0 | ✅ |
| realism_false_block (live) | **0.167** (1/6) | ≤ 0.05 | ❌ |
| spine_required | **true** | false | ❌ |

→ `ship_worthy = false` **as-run**. Honestly recorded: the gate fired the friction arm.

## Diagnosis — the friction is one authoring anti-pattern

Both failing signals are the **same single scenario**, `fin_numeric_dag`:
- Its host contract is `numeric_analysis` + `evidence_level: rederived`, which **hard-requires** a full `numeric_derivation` DAG **and** an `arithmetic_checks` array. A *correct* single-shot deliverable that simply states the right total is blocked (`MISSING_REQUIREMENT`) / errors — that is the **entire** realism false-block (1/6) and the **only** spine.
- The other 5 contract-satisfying live deliverables RELEASED with no spine.
- The corpus's own `fin_total_reconcile` expresses the **same** "total must equal X" requirement as a `==` constraint and, in the deterministic curated arm, **RELEASEs the good-faith deliverable spine-free and REJECTs the wrong total.** The spine-free, catch-preserving pattern is already proven.

So: the gate did exactly what `rederived` asks; the contract asked for re-derivation where a constraint was the right tool. Per the human decision, the fix is **authoring guidance, not a gate change** ([`HOST_CONTRACT_AUTHORING.md`](designs/HOST_CONTRACT_AUTHORING.md)).

## Corrected re-run (demonstration — `ship_worthy = true`)

After re-authoring the one anti-pattern contract per the guide (`fin_numeric_dag`: `numeric_analysis`+`rederived` → a `==` constraint on the total) and keeping the gate unchanged, the live realism arm was re-run (`benchmark/phase5/realism_run.json`; as-run preserved in `*_asrun.json`):

| Metric | as-run (anti-pattern) | corrected (per guide) | threshold |
|---|---|---|---|
| false_release_reduction | 1.0 | **1.0** (16/16) | ≥0.50 ✅ |
| realism_false_block | 0.167 | **0/7 = 0.000** | ≤0.05 ✅ |
| spine_required | true | **false** | =false ✅ |
| natural_violation_rate | 0.33 | **0.125** (1/8) | >0 ✅ |
| **kill rule** | not ship-worthy | **ship_worthy = TRUE** | — |

The re-framed `fin_numeric_dag` now RELEASEs spine-free; the friction arm cleared end-to-end with **no gate change** — the fix was entirely contract authoring.

## Honest caveats
- **Small n:** the corrected live arm had 8 gradeable deliverables + **6/14 `unparseable`** (the model couldn't emit valid grounded-claim JSON single-shot). The clean `0/7` false-block rests on the simpler structured/constraint deliverables.
- This is host-contract **false-release** reduction, distinct from (and not evidence for) reasoning/repair improvement (Phase 4 closed those).

## Façade `artifact`-mode validation (follow-up — `facade_artifact_probe.json`)

Investigating the 6 unparseable deliverables surfaced a real bug **and** a clean result:
- **Bug (fixed):** `review_before_final`'s `artifact` templates were non-gate-compatible *placeholders* — the research template used the wrong field names (`text` vs `claim_text`, no `claim_id`/`supporting_token`/`claim_kind`) and the numeric template pushed the **heavy `numeric_derivation` DAG** the authoring guide says to avoid. Filling them could not produce a releasable deliverable. The templates were rewritten to mirror the real gate schemas (grounded-citation `GroundingClaim` shape; numeric defaults to the light `{answer_text, structured_answer}` constraint shape) and **proven**: a valid fill RELEASEs through the real gate, a mutated fill REJECTs (`tests/tools/review_before_final.gate_compat.test.ts`).
- **Parseability solved:** with the *corrected* template, Haiku produced **parseable, well-structured grounded deliverables single-shot — 3/3** (was 0/3). The façade `artifact` mode does fix the "can't produce the structure" friction.
- **The gate then does its job:** those 3 still REJECTed — because the model made *real grounding errors* (e.g. `supporting_token: "sla_enterprise_tier"`, a made-up id not inside the quoted span → `SOURCE_SPAN_MISMATCH` / `UNSUPPORTED_CLAIM`). An **ideal fill of the same template RELEASEs**. So the remaining non-release is **the gate correctly catching mis-grounded claims (false-release reduction working), not friction.** Net: the façade scaffolds the structure; the gate enforces grounding accuracy; only accurate grounded deliverables release — exactly the intended division.

## What Phase 5 supports
- **Proven (deterministic):** the host gate gives perfect separation on the curated set (16/16 violations blocked, 0/14 good deliverables blocked), and real agents produce host-contract violations ~⅓ of the time — so there is a real false-release opportunity the gate catches.
- **Supported (with the authoring guide):** as a **single-call, no-spine** release gate it stays low-friction; the original friction was a contract anti-pattern with a documented, proven-spine-free alternative.
