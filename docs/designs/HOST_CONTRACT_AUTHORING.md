# Host-Contract Authoring Guide — keep `ct-enforce` low-friction

> **Why this exists.** Phase 5 (the host-contract release-gate experiment) showed `ct-enforce` reduces false releases (catches 100% of curated violations; real agents ship host-contract violations ~⅓ of the time) — but it fired the friction kill arm on **one over-specified contract**. The gate was doing exactly what the contract asked; the contract asked for too much. This guide is the fix: author contracts so a *good-faith single-shot deliverable* releases, while violations are still caught — **no multi-turn artifact spine, no gate change.**

## The one rule

> **Check the host's *requirement*, not the agent's *derivation*.** If you (the host) know the value/field/format the deliverable must have, pin it as a **constraint / `must_include` / `must_not_include`**. Reserve `evidence_level: rederived` (which demands a full numeric trace) for the rare case where you genuinely need the agent to *prove a computation independently*.

## Patterns (use these)

| Host requirement | Author it as | Agent supplies (single-shot) | Catches |
|---|---|---|---|
| "Total must equal 22600" / "margin ≥ 20%" | a `constraints` predicate (`==`, `<=`, `>=`, …) on a structured field | `answer_text` + a small `structured_answer` (`{total: 22600}`) | wrong/absent value → `CONSTRAINT_VIOLATION` |
| "Must contain the unsubscribe disclosure" | `must_include: ["unsubscribe"]` | `answer_text` | missing → `MISSING_REQUIREMENT` |
| "Must not promise guaranteed returns" | `must_not_include: ["guaranteed returns"]` | `answer_text` | asserted → `CONSTRAINT_VIOLATION` |
| "Required fields present" | `constraints` presence checks | `structured_answer` with the fields | missing field |
| "Claim must cite the controlling source" | `evidence_level: cited` + host `sources` + required `claims` | `answer_text` + `claims:[{text, quoted_span, source_id}]` | ungrounded / laundered distractor → `SOURCE_SPAN_MISMATCH` / `UNSUPPORTED_CLAIM` |
| "Source must be fresh" | `freshness:{max_age_seconds,…}` + host `eval_time` | the dated source | stale source |

**Worked contrast (both in the Phase-5 corpus):**
- ✅ `fin_total_reconcile` — "total must equal X" as a `==` constraint → a good-faith single-shot deliverable **RELEASEs spine-free**, a wrong total **REJECTs**. *This is the pattern.*
- ⚠️ `fin_numeric_dag` — same intent authored as `numeric_analysis` + `rederived` → forces the agent to hand-build a `numeric_derivation` DAG **and** `arithmetic_checks`; a *correct* single-shot deliverable that lacks them is blocked (`MISSING_REQUIREMENT`). *This is the friction the kill arm caught. Don't author simple value checks this way.*

## When to use `rederived` (the heavy path)

Use `evidence_level: rederived` **only** when the requirement is *"independently re-derive this number from declared inputs"* — e.g. a regulated calculation where the host wants the derivation itself on the record, and is willing to have the agent produce the artifact bundle (or use the `review_before_final` façade in `artifact`/`enforce` mode to hand the agent the template). It is a high-assurance, higher-friction mode by design — not the default for "the total must equal X".

## How this fits the product shape

The default agent surface is the `review_before_final` façade (cheap checklist scaffold). `enforce` mode / `ct-enforce` is the **high-risk / machine-checkable tail** — and with the patterns above it stays low-friction: one call, no spine. The façade's `artifact` mode returns the right evidence/number/constraint template so the agent's single-shot deliverable already carries what a constraint-style contract checks.

## Net effect

With constraint-style authoring, `ct-enforce`:
- **reduces false releases** (catches the violation classes above), and
- **stays low-friction** (good-faith single-shot deliverables RELEASE; no multi-turn artifact spine),

which is the combination the Phase-5 kill rule requires. The friction in the original run was a contract-authoring anti-pattern, not a gate defect.
