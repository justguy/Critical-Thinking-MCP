# CT-MCP Phase 5 — Host-Contract Release Gate: Pre-Registration

> **Status:** DRAFT — awaiting human sign-off, then FREEZE before any run. · **Date:** 2026-06-03 · **Branch:** `tool-surface-consolidation` · Tracker: `dvp-p5`.
> **Product (repositioned):** *a deterministic release gate for structured agent deliverables* — **not** a reasoning amplifier (Phase 4 settled that, see [`../PHASE4_RESULTS.md`](../PHASE4_RESULTS.md)).
> **This experiment has a hard, pre-registered KILL rule (§6). A null result archives the product direction — that is an accepted outcome, not a failure to engineer around.**

---

## 1. The one claim under test

> **A host-authored contract + a single `ct-enforce` call at release time reduces false releases — violating deliverables that would otherwise ship — without unacceptable friction.**

This is the *only* value path Phase 4 left standing. It does **not** depend on the model being weak or on a multi-turn artifact spine. The defect being caught is **"the deliverable violates an objective requirement the host cares about"** (missing required field, total that doesn't reconcile, claim with no source, excluded item asserted, stale source, broken constraint) — a thing a competent model can ship even while reasoning well, because the requirement is the *host's*, not the task's.

**Why this is not circular** (vs the Phase-4 injected-gate mechanics): the deliverables are **realistic full artifacts** (reports/configs/answers), the contracts are **host-authored** (the real trust-tier-1 path), the metric is **false-RELEASE** (a product outcome), the artifacts are produced in **one normal generation** (no spine), and the **friction arm can genuinely fail** — Phase 4 showed the gate can block a *correct* answer whose declared proof was incomplete, so "does the gate false-block good single-shot deliverables?" is a live risk, not a foregone pass.

---

## 2. Design

**Unit:** one (deliverable, host-contract) pair → one `ct-enforce` call → RELEASE / REJECT.

- **Scenarios (~12–16 realistic workflow deliverables)** spanning deliverable types with objective host requirements: financial summary (totals reconcile to line items; required fields), RAG/customer answer (claims cite the controlling source; no excluded/unsupported facts), config/spec (constraints honored; forbidden option excluded), compliance/format (required disclosure present; freshness). Each is a **realistic full artifact**, not a toy bundle.
- **Host-authored contracts:** for each scenario, a contract in the existing `ct-enforce` spec format (`contract_id`, `task_type`, `evidence_level`, `risk_level` + required `sources`/`claims`/`inputs`/`conclusion_numbers`/`constraints`/`must_include`/`eval_time`), authored **host-side** (fixed, not by the producing model). Frozen + content-hashed.
- **Known defect opportunities:** each scenario carries a contract-**SATISFYING** deliverable AND ≥1 contract-**VIOLATING** deliverable (missing field, unreconciled total, asserted excluded/unsupported fact, stale source, broken constraint), each with **known ground truth** (satisfies / violates the host contract). These are the would-be false releases.
- **Single-call gate:** `ct-enforce` runs **once** per deliverable (host-side CLI, stdin spec+artifacts → RELEASE/REJECT JSON). **No multi-turn artifact spine.** The agent's deliverable carries its own artifacts (answer + sources + declared derivation + structured fields) produced in **one** generation.
- **Status-quo (no gate):** baseline release = the deliverable ships unchecked → every violating deliverable is a false release.
- **Live-realism arm (secondary):** a model produces a single-shot deliverable for each scenario; measure the **natural violation rate** — do real agents actually ship host-contract violations the gate would catch, and do good-faith single-shot deliverables carry releasable artifacts?

---

## 3. Metrics

**Primary — false-release reduction**
- `false_release_rate(no_gate)` = violating deliverables that ship / total violating = **1.0 by construction**.
- `false_release_rate(with_gate)` = violating deliverables the gate fails to block / total violating.
- **`false_release_reduction` = 1.0 − false_release_rate(with_gate)** = fraction of would-be false releases caught (= block-recall on the violating set). Wilson 95% CI.

**Friction (the kill rule's second arm)**
- `false_block_rate` = contract-**satisfying** deliverables the gate wrongly REJECTs / total satisfying. Wilson 95% CI. *(This is the real risk — the gate being too strict on good single-shot work.)*
- `spine_required` = boolean: did any scenario need a multi-turn spine to reach RELEASE? (Must stay **false** — single-call is the design.)
- `host_contract_burden` = a proxy for authoring cost (fields/checks per contract) + a qualitative note.

**Realism (secondary)**
- `natural_violation_rate` = live single-shot deliverables that violate their host contract / total. (Is the defect opportunity real in practice?)

No currency anywhere (per the token-not-dollar principle).

---

## 4. Hypotheses

| id | statement | test |
|---|---|---|
| H1-reduction | The gate reduces false releases. | `false_release_reduction ≥ 0.50` with Wilson 95% lower bound > 0 on the violating set. |
| H2-low-friction | The gate does not block good single-shot deliverables. | `false_block_rate ≤ 0.05` (Wilson upper bound reported) AND `spine_required = false`. |
| H3-realism | The defect opportunity is real. | `natural_violation_rate > 0` on the live arm (reported; informs whether reduction is practical vs theoretical). |

---

## 5. Build plan

1. Author the scenario corpus: realistic deliverables (satisfying + violating) + host contracts in the `ct-enforce` spec format + ground-truth labels. Content-hash. Tests assert every satisfying deliverable is *genuinely* contract-satisfying and every violating one *genuinely* violates (independent of the gate).
2. Build a single-call runner: pipe each (contract, deliverable) through the **real `ct-enforce` CLI** (`dist/host/cli.js`), record RELEASE/REJECT + the blocking code.
3. Metrics layer: false_release_reduction + false_block_rate (Wilson via the Phase-4 `stats.ts`), spine_required, contract burden.
4. Live-realism arm: model produces one-shot deliverables per scenario (CLI adapter, no spine); grade against the host contract for `natural_violation_rate`.
5. Run → evaluate every §4 hypothesis and the §6 kill rule against the frozen thresholds → record the decision.

---

## 6. HARD KILL RULE (frozen — the decision is mechanical)

**SHIP-WORTHY only if H1 AND H2 both pass.** Otherwise **KILL / ARCHIVE the product direction.** Concretely:

- **KILL if no false-release reduction:** `false_release_reduction < 0.50`, OR its Wilson 95% lower bound ≤ 0, OR (from the realism arm) `natural_violation_rate ≈ 0` so the reduction is theoretical — agents don't actually ship catchable violations.
- **KILL if too much artifact friction:** `false_block_rate > 0.05` on contract-satisfying deliverables, OR `spine_required = true` (single-call ct-enforce cannot gate realistic deliverables without forcing a heavy artifact spine), OR the host-contract authoring burden is judged impractical for real adoption.
- **Decision is read ONLY against these frozen thresholds** — no goalpost-moving. A KILL is recorded honestly in the ledger (`mkt-reduces-high-sev-defects` and the Phase-5 entries) and the product is archived to the narrow proven scope (deterministic catching of structured defects, Phase 4).

---

## 7. What this does and does not test
- **Does:** whether a single host-side gate call reduces false releases on realistic deliverables, and at what friction cost. The actual product question.
- **Does not:** prove the gate improves model reasoning (Phase 4: it doesn't), nor that it works on adversarial host-vs-model gaming, nor live multi-agent adoption at scale (that is downstream of a PASS here).

---

## 8. Freeze record

**FROZEN 2026-06-04 (human-approved before any run).** Thresholds + the live-realism arm were confirmed via AskUserQuestion; per the Phase-4 pattern the design is frozen by this dated document (no threshold moves after data), and committed at the end with the results.
- **Frozen thresholds (the mechanical kill rule):** `false_release_reduction ≥ 0.50` (Wilson LB > 0) · `false_block_rate ≤ 0.05` · `spine_required = false` · `natural_violation_rate > 0`. KILL/ARCHIVE if any fails.
- Realism arm: **included** (live one-shot model deliverables → natural_violation_rate).
- Scenario-corpus + host-contract content hashes: recorded at corpus freeze.
- Pre-registration commit: the commit that lands this document + the results.
