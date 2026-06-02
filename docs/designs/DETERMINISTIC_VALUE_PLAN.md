# CT-MCP Deterministic-Value Plan

> **Status:** Proposed · **Date:** 2026-06-02 · **Branch:** `tool-surface-consolidation`
> **Supersedes (in spirit):** the "force deep reasoning" framing. This document is the authoritative plan for fixing gaps, proving value, and increasing impact.
> **Sibling docs:** `PROOF_HANDOFF.md` (shipped 11-tool spine), `TESTING_AND_VALUE_STRATEGY.md` (Tier-4 corpus + net_value formula). Where those disagree with this doc, this doc wins; where they disagree with code, code wins (per `AGENTS.md`).

---

## 1. North star — the only claim worth defending

> **CT-MCP reduces high-severity defects by forcing checkable intermediate artifacts and rejecting any answer that is not a faithful projection of those artifacts.**

It does **not** "make models reason correctly." Deterministic checks cannot verify semantic correctness — proven by the pilot's `N4` finding: a *wrong method* (unweighted vs weighted average) self-traces consistently and passes the gate. That boundary is a **product principle stated up front**, not a footnote.

The difference this plan is built to protect:

- ❌ *"Please think harder before answering."* — structured prompting; not deterministic value.
- ✅ *"Your answer is invalid unless every material claim, number, and recommendation is traceable to a checked artifact."* — deterministic value.

---

## 2. Design laws (apply to every phase)

1. **Proof-carrying answers.** The final answer is a *rendering of the artifact ledger*, not a separate freeform object (see §5). Every material claim binds to a `source_span_id`, `derivation_id`, `assumption_id`, or explicit `judgment` flag; every number appears in a checked derivation; every recommendation references evaluated `option_id`s.
2. **Deterministic-value-or-advisory.** Every check is classified **Cat-1** (objective predicate), **Cat-2** (valuable under declared scope), or **Cat-3** (prompt affordance). Nothing **blocks** until an ablation proves it. Gate = the No-Semantic-Miracle test below.
3. **Trust is not uniform.** Artifacts carry provenance and are weighted by it (§3). A model-authored, self-consistent fake proof is the #1 residual risk; only host-grade facts are proof-grade.
4. **Profile-scoped enforcement.** No universal blockers. A check × `task_type` matrix decides what is required where (§9).
5. **Cost-honest, repair-first accounting.** A 5% quality lift that costs 80% more tokens may be negative product value. Repair value can matter more than preventive value (§10).

### No-Semantic-Miracle test
Every **blocking** check must answer all five, or it stays advisory:
1. What exact defect class does it catch?
2. What objective predicate detects it?
3. What *correct* answer could it falsely block?
4. Could a prompted checklist produce the same benefit?
5. Does the final answer bind to this artifact?

---

## 3. Artifact trust taxonomy (Risk 1: model-authored artifacts can still be theater)

If the model authors the contract, artifacts, claims, assumptions, options, *and* answer, it can fabricate a perfectly self-consistent fake proof. Host-authored contracts help but cannot cover every artifact. Therefore every artifact carries a `provenance` tier, and **trust is explicitly unequal**:

| Tier | `provenance` | Trust | Treatment |
|---|---|---|---|
| 1 | `host_authored` | Proof-grade | Authoritative; cannot be overridden by the model |
| 2 | `host_extracted` | Proof-grade | Extracted from host-supplied sources by deterministic code |
| 3 | `model_declared_assumption` | Conditional | Allowed, but must be surfaced as an assumption in the answer |
| 4 | `model_generated_reasoning` | Low | Self-consistency only; never proof; advisory unless it binds to Tier 1–2 |
| 5 | `model_generated_recommendation` | Low | Must reference evaluated `option_id`s grounded in Tier 1–3 inputs |

**Rule:** a deterministic *PASS* may only rest on Tier 1–2 facts (plus exact-grounding, §4). Tier 3–5 artifacts can be *required to exist and be internally consistent*, but their presence is never evidence the answer is true — they are surfaced/labeled, not trusted.

---

## 4. Grounding has two levels (Risk 2: span grounding ≠ semantic grounding)

A deterministic system **can** verify: a claim cites a `span_id`; the span exists; the quoted text appears verbatim in the span; a number/date/entity appears in the span; no nonexistent source was cited. It **cannot** verify: entailment of a paraphrase, validity of a causal interpretation, whether the source supports a recommendation, or over-generalization.

So grounding splits:

```
strong_grounding:   exact quote · exact number · exact date · exact entity · extractive fact
                    → deterministic proof → may BLOCK
weak_grounding:     paraphrase · synthesis · interpretation · causal claim · recommendation
                    → advisory, OR the final answer must mark it as interpretation
```

- **BLOCK:** "Contract renews monthly" cites a span that says "renews annually." (strong, falsifiable)
- **ALLOW WITH LABEL:** "This creates renewal risk" cites the annual-renewal span but is rendered as `interpretation`. (weak, labeled)

This preserves the deterministic-value claim without pretending span IDs solve entailment.

---

## 5. Final answer = rendered projection, not extracted prose (Risk 3)

We will **not** let the model emit arbitrary prose and then ask deterministic code to extract "every material claim" — that re-imports the hard NLP problem and produces both missed claims and false-blocks.

Instead: **the final answer is a deterministic rendering of the bound artifact ledger.** The model fills artifacts (claims with provenance + grounding, derivations, options, assumptions); a renderer projects them into prose with their bindings intact. The checker then operates on structured bindings, not on free text. Free-text segments that are not backed by an artifact are only permitted when explicitly typed `judgment`/`interpretation` and are surfaced as such.

This is what makes "final-answer artifact-drift detection" tractable: drift = a rendered field disagreeing with its source artifact (e.g. derivation says `$14,250`, rendered answer says `$14,520` → `FINAL_ANSWER_ARTIFACT_DRIFT` → BLOCK).

---

## 6. Phase sequence (locked)

```
Phase 0   Claims hygiene + typed claims ledger
Phase 1a  Real-output harness (kill synthetic baselines; four suites; oracles)
Phase 1b  Thin contract/artifact schema (provenance + grounding tiers; enough to mutate)
Phase 2   False-block repair + mutation-coverage preservation
Phase 3   Full binding spine + deterministic gates (host contracts + plan_token here)
Phase 4   4-arm ablation (A / B / C / D) under strict cost controls
Phase 5   Live host-contract proof + adoption (human scoring last)
```

`1b` precedes `2` so the mutation suites have an artifact schema to mutate. `3` then thickens `1b` into the full spine.

---

### Phase 0 — Claims hygiene + typed claims ledger
- Reconcile stale "2-tool facade" docs → "11-tool spine"; retire the non-reproducible "30/30 vs baseline" (it compares against synthetic rows).
- **Build `CLAIMS_LEDGER.jsonl`** and a CI check that **fails if a doc asserts a claim whose ledger status isn't `proven`** (or isn't marked `planned`). Dogfood the product on its own docs.
- **Claims are typed** (Risk 6) — each type carries a different evidence standard:

  | `claim_type` | Required evidence |
  |---|---|
  | `empirical_claim` (e.g. "false-block ≤2% on suite X") | test fixture + result hash |
  | `architecture_claim` (e.g. "exposes an 11-tool spine") | code path / exported-API check |
  | `roadmap_claim` (e.g. "Phase 4 will test forced artifacts") | none, but must be marked `planned` |
  | `scope_claim` (e.g. "does not prove semantic correctness") | docs-consistency check |
  | `marketing_claim` (e.g. "reduces high-severity defects") | must cite ≥1 `empirical_claim` ID |

  Record: `{claim_id, claim_text, claim_type, source_file, evidence_fixture, last_verified_commit, status}`.

---

### Phase 1a — Real-output harness (the unblocker)
- **Wire one real model into `benchmark/runner.ts`** — eliminate `synthetic:true` baseline/prompted rows. This is the single missing piece behind every unprovable claim.
- **Reject synthetic *results*, not synthetic *tasks*.** Generated tasks with executable oracles scale grading: finance math with gold answers, RAG docs with planted facts + distractors, constraint tasks with enumerated constraints, citation tasks with known-valid spans.
- **Four suites:**
  1. **Failure-prone** — does the gate catch real defects?
  2. **Clean-control** — does it block correct work? (target false-block ≤2%)
  3. **Mutation** — see Phase 2 / §8.
  4. **Realistic-distribution** — so value isn't proven only on a 30–60% torture set.
- **Oracles, not proxies** — replace `grader.mjs` substring matching with gold answers / source-span truth / the existing `evaluateConstraint` path.
- **Models:** Haiku as the high-defect *development* target; **validate on the model class you actually ship to** (a gate tuned to a weak model's failure modes may not transfer).
- **Verify:** baseline arm shows non-zero, non-ceiling defect density; deterministic grading; n large enough for a confidence interval.

---

### Phase 1b — Thin contract/artifact schema
- Define the minimum artifact model needed to *mutate and check*: `task_contract → requirement_ids → artifact_ids → final_answer_bindings`, with every artifact carrying `provenance` (§3) and, for claims, a `grounding_level` (§4).
- Thin = enough structure to generate Phase-2 mutations and run drift checks; **not** yet the full host-contract/plan-token machinery (that lands in Phase 3).

---

### Phase 2 — False-block repair + mutation-coverage preservation (existential)
- Prove the `numeric_derivation` DAG (`src/enforcement/numeric_analysis.ts`) on the historically false-blocked tasks (`N1/N2/N4`) with **two checks, never one:**
  - **Regression:** formerly false-blocked *correct* answers now PASS.
  - **Coverage preservation:** mutated-*wrong* variants of those same answers **still BLOCK.** (Prevents "fixing" false-blocks by quietly going permissive — the trap the old flatten-intermediates mitigation fell into.)
- **Severity-weight** false-blocks (minor citation-format ≠ impossible numeric provenance).
- **Targets:** clean-control false-block ≤2% · known-defect block-rate ≥ threshold · **no coverage loss on the mutation suite** · every BLOCK maps to a named predicate (§7).

---

### Phase 3 — Full binding spine + deterministic gates

**3.1 Binding spine + host contracts + plan-token (deterministic core).**
- Thicken 1b into the full proof-carrying contract; the answer renderer (§5).
- **Host-authored contracts** — authored host-side so the model can't dodge by self-declaring a weaker profile. Trust tiers (§3) enforced here.
- **`plan_token` / contract hash** — a deterministic chain `contract → artifacts → answer`, extending the existing `answer_text_hash` binding in `finalize_deliverable.ts`, so the spine holds even for raw MCP clients, not only host-wrapped ones.

**3.2 Highest-confidence deterministic gates (Cat-1).**
- Numeric DAG validation: every leaf has source + unit + op; every derived value recomputed; **final-answer numbers must match the DAG.**
- **Strong** source-span grounding (§4) — exact quote/number/date/entity; weak grounding is advisory/labeled.
- Requirement coverage (user reqs, format, exclusions, deadlines, budgets, "must-not"s).
- **Final-answer ↔ artifact drift detection** (the highest-value gate, made tractable by §5).
- Unit / currency / date consistency.

**3.3 Decision/reasoning gates — profile-scoped, advisory until Phase 4 proves them (Cat-2).**
- Status-quo baseline → **"status-quo option OR explicit `not_applicable_because`"**, not universal.
- Option coverage; dominated-option flagging **only under the model's *declared* scoring dimensions/weights** (never "objectively dominated").
- Competing hypothesis → **diagnosis/causal/investigation profiles only.**
- **Rejected-option reversal condition** (replaces "steelman", see §11): for each rejected finalist, the answer must state ≥1 condition under which it would become preferred.

**3.4 Tool-description affordances (Cat-3, not counted as core value).** "Use this when…" clauses; `task_type` recommender (deterministic only when paired with host enforcement).

---

### Phase 4 — The decisive experiment: 4-arm ablation
Four arms:
- **A** — answer-then-block (today's gate)
- **B** — forced artifacts **+ final-answer binding**
- **C** — prompted checklist (same content, no enforcement) — negative control
- **D** — forced artifacts **without** binding

**Reads:** B vs D isolates *binding*; D vs C isolates *enforcement*; C vs baseline is just "structure helps." If **C ≈ B → the project is prompt-engineering + linting.** If **B ⊁ D → binding isn't the active ingredient.**

**Strict cost/parity controls (Risk 4)** — all arms share:
same model · same task-order randomization · same context window · same source documents · same allowed tools *except* the enforced artifact calls · same max output budget · same retry policy · same repair opportunity after BLOCK.

Otherwise B can "win" purely on extra thinking tokens, retries, or scratch space. **Primary efficiency metric: `quality_per_1k_tokens`.**

---

### Phase 5 — Live host-contract proof + adoption
- Prove on **live agents** that host-authored contracts make a real underdeclaration release-blocking (the path *all* current measured value rests on, with zero live evidence today).
- Mutation testing on BLOCK paths (≥80%). Package `ct-enforce` as the adoption vehicle.
- **Independent human scoring last** — prove deterministic oracles move before spending human-eval budget.

---

## 7. Blocker taxonomy
Every BLOCK carries exactly one code, so we can measure *which* blockers create value:

`NUMERIC_MISMATCH · UNSUPPORTED_CLAIM · MISSING_REQUIREMENT · SOURCE_SPAN_MISMATCH · CONSTRAINT_VIOLATION · UNDECLARED_ASSUMPTION · OPTION_COVERAGE_GAP · PROFILE_DOWNGRADE · FINAL_ANSWER_ARTIFACT_DRIFT`

---

## 8. Mutation testing has two layers (Risk 5)

| Layer | Start from | Mutate | Proves |
|---|---|---|---|
| **Output-level** | a correct artifact/answer bundle | change a final number · swap a citation span · drop a required constraint · flip recommendation to a losing option · delete an assumption · invent a source ID · change unit/currency/date | **the gate** works (blocker coverage) |
| **Task-level** | the task / source material | annual→monthly renewal · budget $10k→$8k · "bullets preferred"→"no bullets" · add a conflicting-number distractor doc · add a tempting irrelevant option | **the workflow** works (model + gate adapt under changed real conditions) |

Output mutation alone proves a validator catches hand-edited JSON; task mutation proves the system catches real model behavior under changed inputs. Both are required.

---

## 9. Profile × check enforcement matrix
`req` = required-block · `adv` = advisory · `—` = off. **Writing is split into three modes (Risk 7).**

| Check | Math | RAG | Decision | Diagnosis | Writing.Creative | Writing.Transform | Writing.Persuasive/Factual |
|---|---|---|---|---|---|---|---|
| numeric DAG + answer-number match | req | adv | adv | adv | — | — | adv |
| strong source-span grounding | adv | req | adv | adv | — | req¹ | req² |
| requirement coverage | req | req | req | req | req | req | req |
| final-answer artifact binding | req | req | req | req | adv | req | req/adv³ |
| source preservation / prohibited-change | — | — | — | — | — | req | — |
| status-quo-or-NA | — | — | req | adv | — | — | — |
| competing hypothesis | — | adv | adv | req | — | — | — |
| rejected-option reversal condition | — | — | adv | adv | — | — | — |

¹ when rewriting source text. ² for factual claims. ³ `req` for high-stakes, `adv` otherwise.

---

## 10. Metrics — repair is primary (Risk 8 + Risk 4)

A blocker has **preventive value** (stops a bad answer) and **repair value** (gives a concrete reason the model can act on). For product usefulness, repair value often matters more — a system that blocks 70% but repairs 85% beats one that blocks 90% but repairs 10%.

**Primary**
- `repair_success_rate_after_one_retry`
- `repair_success_rate_after_two_retries`
- `new_defects_introduced_during_repair` ← critical: models often fix the named issue while breaking something else
- `quality_per_1k_tokens`

**Block accounting**
- `block_rate` · `true_block_rate` · `false_block_rate` · `block_precision` · `block_recall`

**Net value (severity-weighted, cost-honest)**
```
net_value = prevented_defects(severity-weighted)
          − false_blocks_on_correct
          − false_passes_on_known_wrong
          − latency_cost − token_cost − user_friction_cost
```

---

## 11. Explicitly cut / demoted
- **"Steelman" as a named pillar → removed.** The word invites expectations of semantic fairness / debate quality that a deterministic predicate can't meet. Replaced by the narrower, checkable **Rejected-option reversal condition** (§3.3), framed under *decision robustness*.
- **Generic steelman-similarity blocker** → gone (gameable; can't prove semantic value).
- **Universal competing-hypothesis** → diagnosis/causal profiles only.
- **MECE as a generic blocker** → only where the domain partition is known or the model declares a structurally-checkable one.
- **"Use this when…" clauses / `task_type` recommender** → kept, but Cat-3 affordance, not core value.
- **Independent human scoring** → moved to Phase 5 (prove deterministic oracles move first).

---

## 12. Residual risks tracked, not solved
- **Model-authored theater** (§3) is mitigated by trust tiers but not eliminated; any PASS resting on Tier 3–5 artifacts is *consistency*, not *proof*, and must be reported as such.
- **Weak grounding** (§4) is fundamentally non-deterministic; it is labeled, never proven.
- The whole value thesis stands or falls on Phase 4: if **C ≈ B**, CT-MCP is honestly "structured prompting + a linter," and the claim narrows to fabrication/arithmetic/grounding defect-catching.
