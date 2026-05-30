# CT-MCP Robustness Additions — Design Catalog

> **Status:** proposal catalog (not yet scheduled). Generated 2026-05-30. **Updated v2 2026-05-30.**
> **Goal:** increase the reasoning ct-mcp forces on the calling agent, and make agents take
> extra steps to **confirm their own work and logic** — **without** introducing any agent/LLM
> into the enforcement flow. Everything below stays pure, deterministic, stateless, no network.
>
> **Provenance:** Part I synthesized from a 5-lens design panel with adversarial verification (23 of 28
> proposals survived). Part II adds a deliverable-centric reframe, a verified MCP-spec alignment, and a
> **correction**: Part I called a cross-turn "server-minted hash" an unforgeable anchor — it is not
> achievable under ct-mcp's keyless+stateless constraints. See **Part II → The integrity correction**.
> Read Part II first if you only read one section.

---

> [!IMPORTANT]
> **Two Part-I items were downgraded by the v2 review** (`check_release_gate` #3, `check_corrective_closure`
> #4). They leaned on a witness hash that the code cannot actually mint. The genuinely unforgeable anchors
> are all *within a single request* (verbatim containment, re-derivation, interval/graph math). Their
> entries below carry a **⚠ CORRECTED** note; the reasoning is in Part II.

---

## The organizing insight

The README already names the core weakness: **"the model grades its own homework."**
Falsifiability is a regex, specificity can be decorated, confidence extraction is shallow, and the
model supplies the very assumptions/graph that get validated.

So the sorting criterion is not "more checks" — it is **which checks the model cannot satisfy by
fabricating their inputs.** A check is genuinely robust only if it has an **unforgeable anchor** —
something the model cannot invent:

1. **Verbatim text** it must copy from a supplied source (substring containment)
2. **Re-derivation** that must reconcile against numbers supplied separately
3. ~~**Server-minted hashes** proving a prior check actually ran~~
   **Removed in v2:** impossible under keyless + stateless constraints. A keyless hash is only a
   *binding token* for "same inputs re-supplied," never proof that a prior check ran. (See Part II →
   The integrity correction.)
4. **Graph structure** the model must genuinely build (not decorate)

All genuinely unforgeable anchors are decided **within a single request**, from that call's own inputs.
Proposals are tiered on exactly this axis: Tier 1 closes the self-grading loophole; lower tiers are
hardening / forcing functions that still raise the cost of bullshitting but operate on self-supplied
structure.

### Cross-cutting rule (applies to every item below)

Default new gates to **WARNING**. Reserve **BLOCKING** for unforgeable *within-request* signals
(substring containment, re-derivation mismatch, interval/graph property). **Not** a hash — a keyless
server cannot mint one that proves anything. Otherwise you trade the "grades own homework" problem for
a false-positive problem — and the 0/14 clean-control record is worth protecting.

---

## Tier 1 — Closes the self-grading loophole (build first)

The only proposals where blocking is backed by something the model cannot fake.

### 1. `check_quote_grounding` *(new tool)* — effort M, FP low

- **Forces:** for every factual claim, copy the **verbatim source span** relied on AND name the
  **supporting token** (number/entity/date/verb) inside that span.
- **Algorithm:** input `sources: [{id, text}]` (the only allowed evidence corpus) and
  `claims: [{claim_text, source_id, quoted_span, supporting_token}]`. For each claim:
  1. Look up `source = sources[source_id]`; missing → BLOCKING (`unknown source`).
  2. Whitespace-normalize both; assert `normalize(quoted_span)` is a contiguous substring of
     `normalize(source.text)`. Not found → **BLOCKING** (`span_found_failure` — fabricated/paraphrased quote).
  3. Assert `normalize(supporting_token)` is a substring of `normalize(quoted_span)` → else
     **BLOCKING** (`token_in_span_failure`).
  4. For numeric tokens, parse the number out of `supporting_token` and `claim_text`; require the
     same value appears in the claim → else **WARNING** (`token_in_claim_failure`).
  5. `grounded_ratio = passing / total`. Pure string ops, O(total chars).
- **Why ungameable:** the span must be verbatim from a supplied source and the token must be inside
  that verbatim span. Rewording the claim changes nothing — grounding is decided by substring
  containment against the source, not by claim prose.
- **Distinct from `entity_grounding`:** that mechanism only scans a single text blob for dot-notation
  names + evidence-anchor regexes; it never verifies a claimed token against a supplied source span.
- **Honest caveat:** the agent supplies the sources too, so this enforces *internal* grounding
  (did you copy real text from your own corpus and point at the right token), not external truth.
- **Plugs into:** new `src/tools/check_quote_grounding.ts`; register in `src/mcp/tool-call.ts` and
  `src/mcp/tool-definitions.ts`; reuse normalize/tokenize from `src/enforcement/utils.ts`.

### 2. `trace_conclusion_numbers` *(new tool)* — effort M, FP low

- **Forces:** list every number in the conclusion with a declared derivation — `literal` (cites which
  input it equals) or `derived` (names the op + the input indices it combined).
- **Algorithm:** input is an externally-supplied `inputs: number[]` plus
  `conclusion_numbers: [{value, origin, op?, input_refs[]}]`. For each:
  - `literal`/`identity`: `traced = inputs[input_refs[0]]` matches value within tolerance.
  - `derived`: recompute from op over `inputs[input_refs]` (`sum=Σ`, `diff=a-b`, `product=Π`,
    `ratio=a/b`, `pct_of=a/b*100`, `mean=Σ/k`); `traced = |recomputed - value|/max(1,|value|) <= tol`
    (default 0.005).
  - Verify every index is valid AND `inputs[index]` is one of the actually-supplied numbers (guards
    fabricated "inputs"). Untraced or out-of-set → **BLOCKING**.
- **Why ungameable:** the tool re-derives the value; a made-up number won't reconcile.
- **Distinct from `check_numeric_claims`:** that analyzes the *input* number set (fabrication/outlier);
  this checks *output* numbers against a separately-supplied input array.
- **v2.1 — close the omission gap.** Like claim-coverage, this only checks numbers the agent *lists*. The
  common failure is tracing one or two numbers and leaving the load-bearing one untraced in prose. Add an
  `auto_extract_answer_numbers(answer_text)` pass and diff against `conclusion_numbers[]`: a declared
  number that fails derivation → **BLOCK**; a number in the answer but **not** declared → **WARNING** by
  default, after stop-listing obvious ordinals / section numbers / dates / versions / IDs. A **host strict
  mode** may escalate untraced answer numbers to BLOCK. Keeps the unforgeable re-derivation as the only
  default block; the extraction stays advisory (regex noise).
- **Plugs into:** new `src/tools/trace_conclusion_numbers.ts`.

### 3. ~~`check_release_gate` (hash-binding variant)~~ — **DEPRECATED, do not implement**

> ⚠ **DEPRECATED (v2):** the hash-witness gate below is **not implementable** as "unforgeable" (no
> server minting exists; a keyless server can't prove a prior check ran). The only unforgeable signal
> here is *"declared numeric value literally present in `answer_text`"* (within-request substring) — that
> survives, **folded into `finalize_deliverable` (Part II)**. The body below is struck for the record; do
> not build it as written. Every "witness_hash" reference is the disproven model.

- ~~**Forces:** before an answer is "done," enumerate every release criterion and bind each to a
  concrete witness it already produced this turn.~~
- ~~**Algorithm:** `kind='numeric'` (value literally in `answer_text`) — **the only survivor**;
  `kind='tool_result'` relied on a `witness_hash` in `context.iteration_history[].response_hash`
  "server-minted, unforgeable" — **this premise is false** (response_hash is caller-supplied; a keyless
  server can't mint an unforgeable proof). The `≥0.8` coverage slack and the vacuity heuristic are
  dropped too.~~
- **Survivor → `finalize_deliverable` (Part II):** "declared numeric value must appear verbatim in the
  shipped `answer_text`" is a genuine within-request substring gate. That single rule moves into the
  re-executing finalize gate. Nothing else from this entry survives.

### 4. `check_corrective_closure` *(new tool)* — effort M, FP medium

> ⚠ **CORRECTED (v2):** the agent supplies the "previous response," so the "new vs prior" comparison is
> **self-graded**, not unforgeable. Demote from Tier 1 to a **forcing function** (WARNING / strict-profile
> only). Its one solid within-request signal: the revision must contain a *measurable specific the prior
> corrective prompt demanded* — keep that, drop the cross-turn hash framing.

- **Forces:** after a prior `ENFORCEMENT_FAIL`, prove the revision closed the *specific* gap the prior
  `corrective_prompt` demanded — not re-assert confidence.
- **Algorithm:**
  1. Infer `required_slots` from the literal label tokens in `context.prior_corrective_prompt`
     (`component`, `threshold`, `time window`, `observable failure event`, `revised confidence`,
     `condition`, `outcome`) — these strings literally exist in the templates in
     `src/enforcement/index.ts`.
  2. A slot is filled iff its detector fires in `revised_text` on a token that is **new vs
     `previous_response_text`** AND is a **strong** marker (numeric/threshold/time-window/error-code
     regex) — **not** the bare `CONDITION_RE` keyword or generic CamelCase (`when` and any CapWord are free).
  3. If `revised_text` length > 1.5× prior but `filled_slots == 0` → verdict `padded`.
  4. `closure_score = filled / required`.
- **Severity (corrected to match the heading):** **default WARNING** for both `padded` and
  `closure_score < 0.5` — the agent supplies `prior_corrective_prompt`, `previous_response_text`, and
  `revised_text`, so all three are self-graded. A **strict host profile may escalate to BLOCK only when**:
  (a) `prior_corrective_prompt` is host-supplied, (b) `previous_response_text` is host-supplied or
  host-retained, and (c) `revised_text` is the actual candidate answer being surfaced. Otherwise the agent
  can manufacture both the prior and the revised text.
- **Why it works:** builds on the real stateless protocol; raises the cost of a fake fill to producing
  a genuinely new measurable specific the prompt demanded.
- **Plugs into:** new `src/tools/check_corrective_closure.ts`; reuse `revision_contrast` detectors +
  falsifiability markers.

---

## Tier 2 — Surgical hardening of existing mechanisms (best effort : value)

Small targeted edits to existing files. Each addresses a documented weakness.

### 5. Falsification ↔ assumption entity binding — effort M, FP medium

- **Today's bug:** `validate_confidence` passes only the **bare condition strings** into
  `checkFalsifiability` (`src/tools/validate_confidence.ts:140-146`) — the link to the assumption
  description is discarded. So a free-floating `200ms` in any condition passes.
- **Fix:** plumb `{description, condition}` pairs through. A condition is "bound" only if it shares an
  **identifier token** (CamelCase/dotted.path/UPPER_SNAKE) with its description, OR a non-stopword
  content noun co-occurring in the same clause as the measurable marker. Measurable-but-unbound =
  WARNING (`floating threshold`); never new blocking — feed the existing falsifiability warning.
- **Plugs into:** `src/enforcement/falsifiability_checker.ts` (signature change to accept pairs) +
  `src/tools/validate_confidence.ts`.

### 6. Widened confidence extraction + confidence/hedge contradiction — effort S, FP low

- **Today's gap:** `extractClaimedConfidence` (`src/enforcement/confidence_product.ts`) recognizes only
  `X% confident`, `confidence: X`, and 3 qualitative phrases. "I'm certain", "almost certainly",
  "p=0.95", "9 out of 10" all escape inflation detection.
- **Fix (ship the two together):**
  - Widen the extractor with numeric forms (`p=0.X`, `probability of 0.X`, `N out of 10`) and a graded
    phrase map (`certainly`→0.97, `highly likely`→0.9, `confident`→0.8 … `possibly`→0.4), **anchored**
    to a stance (`I am/we are <phrase>`, `this is definitely/certainly <claim>`) to avoid firing on
    incidental prose. Return the **max** over anchored matches; existing 0.15 gap gate unchanged.
  - New mechanism `confidence_hedge_consistency(claimed, hedgeResult)`: contradiction WARNING when
    anchored `c >= 0.8` and hedge severity ≥ moderate; **BLOCK only** when anchored `c >= 0.9` AND
    hedge severity = heavy (an unambiguous self-contradiction). Quote the hedged sentences (already
    returned by `detectHedging`) in the corrective prompt.
- **Plugs into:** `src/enforcement/confidence_product.ts` + new tiny mechanism in `src/enforcement/`.

### 7. Shared-entity / shared-number assumption correlation — effort M, FP medium

- **Fixes README limitation #6:** correlated assumptions are detected only by lexical bigram-Jaccard,
  so "DB sustains 5000 writes/s" and "Postgres won't be the bottleneck" score as independent and
  inflate the honest ceiling.
- **Fix:** add a second correlation signal in `computeConfidenceProduct`: two assumptions correlate if
  they share an identifier token (CamelCase/dotted/UPPER_SNAKE) or a `KNOWN_ENTITIES` match. Export
  `KNOWN_ENTITIES` from `entity_grounding.ts` (or move to `utils`). Allow a shared exact number+unit
  only to corroborate an already-shared entity. **Drop** standalone order-of-magnitude bucketing
  (high FP). Emit `correlation_reasons[]`; effects flow only through the existing
  `honest_ceiling`/inflation gate.
- **Plugs into:** `src/enforcement/confidence_product.ts`, `src/enforcement/entity_grounding.ts`.

### 8. Decorative-precision subject binding in specificity — effort M, FP medium

- **Today's gap:** specificity passes if markers are dense AND not strippable — but `/var/log/app.log`
  or `v2.3.1` can be dense and survive stripping while describing nothing.
- **Fix:** add step 3 to `scoreSpecificity` — split on clause connectors (`and/but/while/whereas/
  because/so that`) + sentence punctuation (not inside a number/marker); a marker is "connected" if
  its clause contains ≥1 non-marker content token. Recompute density on connected markers only;
  `decorative_flag = (>=2 markers && connectedRatio < 0.5)` feeds the existing `passes` gate + a
  warning. No new blocking rule.
- **Plugs into:** `src/enforcement/specificity_scorer.ts`.

### 9. Tautology / bare-negation guard for falsification conditions — effort M, FP medium

- **Forces:** a condition that merely negates/restates the assumption ("fails if it doesn't work",
  "if performance is bad", "too slow") is invisible to the regex today as long as a number sneaks in
  elsewhere.
- **Fix:** add `isTautological` as a second gate in `checkFalsifiability`, flagged **only** when the
  condition has no measurable marker AND no comparator AND either bigram-Jaccard restatement vs its
  description > 0.85, OR matches a negation/vague-degree pattern. Any threshold-bearing condition is
  exempt (bounds FP). WARNING; counts as non-falsifiable in the existing score; never direct blocking.
- **Plugs into:** `src/enforcement/falsifiability_checker.ts`.

---

## Tier 3 — New structural reasoning forcing functions

Anchor = graph structure / interval math the model must actually construct.

### 10. Require redundant evidence — *(extend `validate_reasoning_chain`)* — effort L, FP medium

- **Forces:** to mark a conclusion "confirmed," provide ≥2 **vertex-disjoint** evidence→conclusion
  paths with lexically-distinct terminal evidence.
- **Algorithm:** opt-in `require_redundancy_for: conclusion_ids[]`. Build a flow network on the reverse
  graph (super-source → every evidence node cap 1, node-split for vertex-disjoint, conclusion = sink);
  max-flow (Edmonds-Karp) = number of disjoint paths (Menger). Require ≥2 AND terminal evidence
  token-Jaccard < 0.8. BLOCKING only for explicitly-requested conclusions; WARNING otherwise. O(E·V) on
  small graphs.
- **Distinct from `grounding_score`** (counts *any* backward path) and orphan detection (zero incoming).

### 11. Premise-usage reconciliation — *(extend `validate_reasoning_chain`)* — effort M, FP low

- **Forces:** declare each conclusion's premise set; it must match the graph's actual incoming-support set.
- **Algorithm:** optional `declared_support: [{conclusion_id, premise_ids[]}]`. Compute reverse-reachable
  evidence/assumption set `R(c)` via BFS on the existing `reverseAdj`. **BLOCK** phantom premise
  (declared id not in `R(c)`); **BLOCK** undeclared *direct* predecessor missing from the declaration
  (transitive omissions stay WARNING). O(C·(V+E)).
- **Distinct from orphan detection** (zero-incoming) and `grounding_score`.

### 12. `check_case_partition` *(new tool)* — effort M, FP low

- **Forces:** when reasoning by cases, supply the partition as ranges/predicates over a stated variable
  + the universe; tool checks **MECE** (mutually exclusive, collectively exhaustive).
- **Algorithm:** numeric — convert each case to a half-open interval over `[domain.min, domain.max]`,
  sort, sweep for overlaps (`next.start < cur.end`) and gaps (`next.start > cur.end`), plus
  leading/trailing gaps. Enum — covered-member multiset vs the universe. `is_mece = no gaps AND no
  overlaps`. O(n log n).

### 13. `check_answer_against_constraints` *(new tool, restate-and-diff)* — effort M, FP low

- **Forces:** restate the question's hard constraints as machine-checkable predicates
  `{field, op, value, source_quote}` AND supply the answer as structured key→value data.
- **Algorithm:** for each constraint, look up `answer[field]` (missing → `field_absent`); evaluate op
  deterministically (comparisons on numbers; `==`/`!=` on normalized scalars; `in`/`subset_of` on
  arrays). Additionally BLOCK when a constraint's numeric bound is not present in its own `source_quote`
  (number-token extraction), and when no constraint covers a **flagged answer field** — making it costly to
  omit the constraint that would fail. O(C).
- **`flagged_answer_field` — defined deterministically** (else the rule is too weak or too noisy). A field
  is flagged iff it is **required by the deliverable profile**, OR its **name appears in
  `original_request_text`**, OR it is listed in `contract.required_fields`, OR it is produced by a
  **host-supplied `answer_schema`**. All four sources are external to the answer prose, so flagging can't
  be dodged by phrasing — it's anchored to the host/profile/request, not to what the agent chose to emit.

### 14. `check_dimensional_consistency` *(new tool, lower priority)* — effort M, FP medium

- **Forces:** tag every quantity with a unit + state the operator chain; tool runs dimensional algebra.
- **Algorithm:** parse units into dimension vectors over `{time, data, money, length, count, unitless}`;
  `*`→add exponents, `/`→subtract, `+`/`-`→**require equal** vectors (else BLOCKING); compare derived
  unit to `claimed_result_unit`. No magnitude checking (that's `verify_arithmetic`). O(terms·dims).
- **Note:** ship last and WARNING-only at first — unit-parsing edge cases drive medium FP.

---

## Tier 4 — Completeness extensions to plan / decision tools

### 15. `evaluate_tradeoffs` + required `wrong_if` per option — effort M, FP low

- **Forces:** every option names the measurable observable under which it becomes the **wrong** choice.
- **Algorithm:** EU + ranking unchanged. `measurable(wrong_if)` via the falsifiability markers +
  comparator-present-when-threshold-present. BLOCK iff not indeterminate AND the recommended option has
  no measurable `wrong_if`; WARNING for non-recommended options. Anti-symmetry: warn if two options
  share identical observable+comparator+threshold (copy-paste tell). *(Panel's favorite extension.)*

### 16. `check_plan_validity` failure-branch coverage — effort M, FP medium

- **Forces:** every effect-bearing step (`resources[]` non-empty OR matches a write/deploy/charge verb
  lexicon) declares `on_failure {action, target, detect}`.
- **Algorithm:** BLOCK on dangling `on_failure.target` (reuse missing-prereq logic) and on_failure
  cycles (reuse `detectCycles` over the augmented edge set — catches infinite retry/compensate loops).
  Require `on_failure` as BLOCKING only for steps with non-empty `resources[]`; WARNING for
  verb-lexicon-matched steps; run `detect` through the measurability predicate as a warning. O(V+E).

### 17. `check_precondition_coverage` *(new tool, or fold into #16)* — effort M, FP low

- **Forces:** every step declares its failure mode + a handler step that exists, runs after / is
  reachable, and isn't itself.
- **Algorithm:** reuse the plan DAG + `hasTransitiveDep`. BLOCK dangling/self handler; WARNING
  unreachable handler. `coverage_score = covered_or_terminal / total`. O(V+E).

### 18. `check_revision_regression` *(new tool)* — effort L, FP medium

- **Forces:** caller supplies draft + final; tool blocks a quiet downgrade.
- **Algorithm:** **recompute** metrics server-side (don't trust reported): `scoreSpecificity` /
  `score_response_quality` / `checkEntityGrounding` on both. `recomputed_delta = final - draft`. BLOCK
  only on (a) `recomputed_delta < -0.02` (real regression) and (b) technical-marker-drop > 30% with
  `delta <= 0` (use exact-token set difference via `countTechnicalTerms`, not bigram-Jaccard). Keep
  self-reported-mismatch (> 0.1) and near-identical (> 0.97) as WARNINGS.
- **Correction:** the panel's "this is a ROADMAP item" justification was **fabricated** (verified — no
  such item in `ROADMAP.md`). It stands on its own merit.

### 19. `check_belief_revision` *(new tool)* — effort M, FP medium

- **Forces:** per conclusion, a structured `change_my_answer {switch_to, observable, comparator,
  threshold, direction}`.
- **Algorithm:** `observable_measurable` via the markers. WARN when absent (don't force a fabricated
  trigger); BLOCK only when a supplied trigger is internally broken — unmeasurable observable,
  `switch_to` Jaccard-identical to the statement, or missing comparator/threshold/direction. Cross-
  conclusion duplicate-trigger → WARNING.

---

## Free win: wire up code that already exists

Four mechanisms are **fully implemented and tested but not exposed on the public surface** — only the
experimental orchestrator/tests use them:

- `compareSteelman` — anti-paraphrase / anti-strawman (`src/enforcement/steelman_similarity.ts`)
- `checkRevision` — revision_contrast; its detectors are exactly what `check_corrective_closure` (#4) needs
- `checkLoop` — loop_governor; stall / capability-ceiling detection (`src/enforcement/loop_governor.ts`)
- `classifyClaim` — claim→tool routing (`src/enforcement/claim_classifier.ts`)

Exposing these (or a `suggest_checks` router built on `classifyClaim`) is the lowest-effort robustness
gain available — no new logic, just wiring into `tool-call.ts` / `tool-definitions.ts`.

---

## Deliberately rejected (the boundary of what works)

5 proposals were cut. The boundary is instructive: **any check whose blocking signal is derived purely
from fields the model freely sets is gameable.**

| Proposal | Why cut |
|---|---|
| `score_decision_reversibility` | Forces self-classification, not verification. A model that wants to proceed under-declares risk; the mitigation gate clears with boilerplate. |
| `check_assumption_coverage` | Forces classification (verified vs not), and "not verified" is a free pass. Honest disclosure ≠ confirmation. (Also cited a non-existent ROADMAP item.) |
| `reconcile_inverse` | The inverse is algebraically the same equation `verify_arithmetic` already checks — redundant or vacuous. |
| `reconcile_dual_estimates` | The model authors both methods, so "agreement" is manufacturable. Number-provenance (#2) does this right by anchoring to supplied inputs. |
| `verify_claim_ledger` | Circularity defense leans on bigram-Jaccard between short strings (high FP + FN); salvageable half is subsumed by `finalize_deliverable` (Part II). |

---

---

# Part II — Deliverable-centric reframe (v2, 2026-05-30)

Part I is a *tool* catalog. But MCP tools are **model-controlled** — the agent decides which to call,
and a rushed agent picks poorly. To improve real outputs you organize by **deliverable**, hand the
agent the required check suite deterministically, and gate the final answer. Part II reframes around
that, corrects the hash error, and folds in the verified MCP-spec direction.

## The integrity correction (read this first)

Part I, Tier 1 #3/#4 leaned on `context.iteration_history[].response_hash` as a "server-minted,
unforgeable" witness that a prior check ran. **That was wrong on two counts:**

- **No server minting exists.** The only crypto in `src/` is `randomUUID` (session ids in
  `server-runtime.ts`). `response_hash` / `previous_response_hash` are **caller-supplied strings**
  (`types.ts:135,139`) — the model mints them today.
- **A keyless, stateless server cannot mint an unforgeable cross-turn proof at all.** Without a secret
  key, any digest the server computes the client can also compute, so a hash proves nothing about
  whether a check ran. Adding a key violates "no keys"; remembering what was minted violates
  "stateless." A cross-turn *"proof a prior check passed"* is **not achievable** under ct-mcp's
  constraints. Full stop.

**The real unforgeable set** — signals decided entirely *within one request*, from that call's inputs:

1. **Verbatim substring containment** — `quoted_span` ⊂ supplied `source.text`; a declared numeric
   value ⊂ `answer_text`.
2. **Re-derivation** — an output number recomputed from a supplied input array.
3. **Pure interval / graph math** — MECE intervals, freshness inequalities, edge-disjoint paths, cycles.

A keyless hash keeps **one** honest use: a **binding token** proving *"you re-supplied the same inputs"*
within a derivation chain (tamper-evidence) — **never** *"a prior check ran."* Scope it that way or drop it.

**Consequence — the keystone gate re-executes, it does not verify hashes.** `finalize_deliverable` is
given the contract + `answer_text` + sources + claims + numbers *in one call* and **re-runs** the
required deterministic checks inline. Its PASS is then unforgeable in exactly the way each leaf check is,
with zero server state and zero keys. The witness-hash chain from Part I is dropped as load-bearing.

## MCP spec alignment (verified 2026-05-30)

Every spec point cited checks out against the official spec/blog. **Treat the 2026-07-28 items as
provisional** — it's a release candidate locked 2026-05-21, ratifying 2026-07-28, text may still change.

| Claim | Status | Note |
|---|---|---|
| `structuredContent` + optional `outputSchema` on tools | ✅ introduced rev **2025-06-18** | absent in 2025-03-26 |
| With an output schema: server **MUST** conform, client only **SHOULD** validate | ✅ confirmed | **ct-mcp can't rely on the host validating its output** — keep determinism self-contained |
| `structuredContent` tool SHOULD also return serialized JSON as `TextContent` | ✅ confirmed | backward-compat; keep the text block |
| 2026-07-28 RC: stateless core (handshake + `Mcp-Session-Id` removed) | ✅ confirmed (RC) | **endorses** ct-mcp's "state rides in the request" model |
| 2026-07-28 RC: full **JSON Schema 2020-12** for tool schemas; `structuredContent` any JSON | ✅ confirmed (RC) | composition/conditionals now legal in schemas |
| Tools are **model-controlled** (protocol can't force a call) | ✅ confirmed | justifies host-side enforcement (below) |

**Actions:** give every new tool an `outputSchema` (2020-12) and return `structuredContent` (verdict,
ratios, any binding tokens as typed fields) alongside the text block; factor the shared
`context` + `deliverable_contract` schema into one constant before adding tools.

## The spine: `deliverable_contract`

One object the agent declares once and carries (verbatim) in `context` on every check call — the
machine-checkable description of "what done looks like." It declares *obligations*; it is **not** proof.

```ts
interface DeliverableContract {
  contract_id: string;
  contract_authority: 'host' | 'user' | 'derived' | 'agent';  // who authored the obligations
  profile_source: 'host_supplied' | 'inferred' | 'agent_declared';
  original_request_text: string;       // the user/host ask — the external anchor
  original_request_hash: string;       // binding token: "same request re-supplied" (NOT proof)
  task_type: 'factual_qa'|'numeric_analysis'|'planning'|'decision'
           | 'concurrency_design'|'reasoning'|'freeform';   // drives plan_checks
  evidence_level: 'none'|'asserted'|'cited'|'rederived';    // strength of grounding obligation
  risk_level: 'low'|'medium'|'high';                        // escalates WARNING→BLOCK on recommended path
  freshness?: { max_age_seconds: number; requires_dated_sources: boolean };
  acceptance_criteria: Array<{ id: string; text: string;
    kind: 'numeric'|'structural'|'coverage'|'inline_check'; source_quote?: string }>;
    // 'inline_check' = finalize RECOMPUTES this check now; NOT "trust a prior tool result"
    //  (the old 'tool_result' kind is removed — it revived the disproven witness-hash model)
  claims?: Array<{ id: string; text: string }>;
  must_include?: string[]; must_not_include?: string[];     // exact-substring gates on answer_text
  required_fields?: string[];                               // field names that MUST appear in a structured answer
}
```

> ⚠ **The contract is the main self-grading surface.** Left unanchored, the agent declares weak
> constraints ("answer is non-empty") and `finalize` passes vacuously — the exact loophole Part I *cut*
> `check_assumption_coverage` and `reconcile_dual_estimates` over. Three layers of mitigation:
>
> 1. **Anchor every criterion to the external ask.** Require each `acceptance_criterion`'s bound/number to
>    appear **verbatim** in its `source_quote`, and that `source_quote` to be a substring of
>    `original_request_text` (Part I #13 restate-and-diff). `must_include`/`must_not_include` are exact
>    substring gates on `answer_text` — those *are* unforgeable.
> 2. **Report contract strength, don't trust it.** `finalize` emits a **WARNING** (never a sole block) when
>    `contract_authority='agent'` or `profile_source='agent_declared'`, e.g.
>    `{ "contract_strength": "weak_agent_declared", "honest_limit": "PASS only proves the agent-declared
>    contract was satisfied" }`. **`contract_authority` is itself unverifiable by ct-mcp** — only the
>    *host* can vouch that it (not the agent) authored the contract; a pure function can't tell who set the
>    field. So it is a host-cooperation signal, surfaced for the host to act on, consistent with
>    *Adoption is host-side*.
> 3. **For serious use, the host supplies or derives the contract** from the user request and passes it in,
>    rather than letting the agent author its own obligations.

## The planner: `plan_checks` *(new, deterministic — pure lookup)*

```ts
function plan_checks(contract): { required: {check, severity, reason}[]; optional: {...}[]; finalize_required: string[] }
// suggest_checks(text) = plan_checks({ task_type: inferTaskType(classifyClaim(text)) })   // reuses the latent classifyClaim
```

Static profile map (baseline; severity set by policy):

| task_type | required (baseline) | optional |
|---|---|---|
| factual_qa | quote_grounding, claim_coverage | freshness, validate_confidence |
| numeric_analysis | trace_conclusion_numbers, verify_arithmetic | check_numeric_claims, dimensional_consistency |
| planning | plan_validity (+failure-branch #16) | precondition_coverage, validate_reasoning_chain |
| decision | evaluate_tradeoffs (+wrong_if #15) | validate_confidence, belief_revision, quote_grounding |
| concurrency_design | detect_concurrency_patterns | plan_validity |
| reasoning | validate_reasoning_chain | validate_confidence, claim_coverage |
| freeform | score_response_quality | (classifyClaim suggestions) |

**Policy layer** (deterministic; **can only raise to BLOCK the checks whose fail-signal is unforgeable**):
`evidence_level` `cited`→grounding required+blocking, `rederived`→also number-tracing required+blocking;
`risk_level` `medium`/`high`→promote unforgeable required checks to blocking on the recommended path;
`high` also pulls the first unforgeable *optional* check in as **verify-if-present** (`finalize` re-runs
it, blocking on failure, only if its artifacts are supplied — a missing artifact never blocks, so an
unrelated high-risk deliverable is not false-blocked; returned as `finalize_verify_if_present`);
`freshness present`→add `check_freshness`, blocking iff `requires_dated_sources` (a contract-declared
freshness window is mandatory, not verify-if-present). `plan_checks` itself never blocks (status always
PASS — it plans).

**`check_profile_downgrade`** *(new, WARNING-only — guards the one weak point: the agent chooses
`task_type`).* The planner is deterministic *given* a contract, but an agent can declare
`task_type: 'freeform'` for a numeric/factual task to dodge the stricter profile. So cross-check the
declared type against the answer's own shape, conservatively:

| trigger (in `answer_text` / `original_request_text`) | declared type | warning |
|---|---|---|
| numbers present | `≠ numeric_analysis` | `possible_numeric_profile_downgrade` |
| citations / sources / claims present | `freeform` | `possible_factual_profile_downgrade` |
| recommendation language (best/should/prefer/safe/ready) | `≠ decision` | `possible_decision_profile_downgrade` |
| steps / resources / deploy-write verbs | `≠ planning` | `possible_planning_profile_downgrade` |

Reuse `classifyClaim` for the shape signal. WARNING-only (these are heuristic regexes — keep them off
the BLOCK path, same discipline as auto-extracted claims); a **host strict mode** may choose to block a
declared downgrade. *Honest limit:* catches an obvious profile mismatch, not a subtle one.

## New tools (corrected gate placement)

Each follows the within-request unforgeable rule. **BLOCK only on the structural signal; everything
self-declared is WARNING.**

- **`source_manifest` + claim→corpus binding** *(extend `check_quote_grounding`)*. **BLOCK** (the two
  genuinely unforgeable within-request signals): span not a verbatim substring of the supplied source;
  supporting token not inside the span. **First-class source model** (each source is a structured entry,
  so authority/provenance are explicit rather than an ad-hoc `trust_tier` string):
  ```ts
  interface SourceManifestEntry {
    id: string;
    text_hash: string;                       // sha256(normalize(text))
    origin: 'host_supplied' | 'user_supplied' | 'agent_supplied' | 'retrieved_by_host';
    authority_tier: 'primary' | 'official' | 'secondary' | 'unknown';
    retrieved_at?: string;                   // ISO-8601 UTC
    published_at?: string;                    // ISO-8601 UTC
  }
  ```
  `finalize` emits a **WARNING** when a factual claim relies only on `agent_supplied` / `unknown` sources.
  Caveat (same as everything self-declared): `authority_tier` and `origin` are only meaningful when the
  **host** populates them — a pure function can't verify a pasted source is "official." So they surface
  provenance for the host to act on; they **never** gate.
  - **`freeze_manifest(sources)`** → manifest hash = `sha256` over canonical-JSON of
    `[{id, text_hash}]` (deterministic, `node:crypto`, offline). The manifest hash is a **binding token,
    not a block**: it detects a **corpus swap** between the grounding step and `finalize` **only when the
    host/orchestrator retains the expected hash and compares it** against finalize's recomputed hash.
    Inside a single self-contained agent call it is only a binding token (the agent supplies both corpus
    and hash), **not** evidence of continuity. **WARNING:** numeric token absent from claim text.
  - **`claim_kind` — don't overclaim what containment proves.** Substring containment is strong for
    *copyable* facts, weak for *semantic* support. Require a `claim_kind` and scale the rule + report a
    `support_strength`: `numeric`/`date` → the normalized number/year must appear in **both** claim and
    quote (strong, can BLOCK); `entity`/`status` → normalized entity/status token in both (strong);
    `comparison` → comparator token in both (WARNING-only); `causal`/`recommendation` → containment can
    only establish *source proximity*, so return `support_strength: 'weak'` and never BLOCK on it. This
    keeps the tool from asserting it verified support it cannot, deterministically.
- **`check_claim_coverage`** *(new)* — the missing counterpart to grounding-quality. **Never auto-extract
  claims for a BLOCK** (regex extraction fires on "step 3", "Q4", "Figure 2", `CamelCase`, versions →
  lint fatigue / false blocks). The agent **supplies** the claim list; coverage = grounded claims / declared
  claims. **BLOCK** only at `evidence_level` `cited`/`rederived` when a declared claim has no
  within-call grounding pass. Auto-extraction runs **WARNING-only** ("N sentences look like ungrounded
  claims"), with aggressive stop-listing of ordinals/figure/step/version/identifier patterns. Make the
  omission limit explicit in the output, so a warning can be escalated without pretending regex
  extraction is unforgeable:
  ```json
  { "declared_claim_coverage": 0.92,
    "auto_detected_unaccounted_claims": [ { "span": "...", "reason": "number_date_or_named_entity", "severity": "warning" } ],
    "coverage_honest_limit": "Declared claims only" }
  ```
  *Honest limit:* proves declared claims were grounded — **not** that the answer has no undeclared claims
  (the agent still authors the claim list).
- **`check_freshness`** *(new)* — **must not read a server clock** (a clock read is the first impurity in
  the engine; breaks replay and the 0/14 clean-control record). Caller supplies
  `eval_time: { value, authority: 'host' | 'agent' }` (required; reject if missing) in **fixed ISO-8601
  UTC or epoch-ms** (enforced by validation — no locale ambiguity). Pure interval math:
  `age = eval_time − source.published_iso` vs `max_age_seconds`. Gate placement turns on **who supplied
  the time**, making the trust boundary explicit while keeping the function pure:
  - `authority='host'` → a stale or after-`eval_time` source behind a covered claim can **BLOCK** in
    strict profiles (the comparison is arithmetic the model can't soften).
  - `authority='agent'` → **WARNING** by default (the agent supplied both timestamps — self-graded),
    unless the host explicitly opts to trust agent-supplied time.
  - undated sources → WARNING. *Honest limit:* only as honest as the supplied `eval_time` and attached
    dates; an after-`eval_time` source is a **contradiction relative to the supplied eval time**, not
    proof of fabrication.
- **`finalize_deliverable`** *(new — the keystone, re-executor not hash-verifier)*. Given the contract +
  `answer_text` + sources + claims + numbers, it re-runs `plan_checks(contract).finalize_required` **inline**
  and PASSES iff: every required unforgeable check passes on the supplied artifacts; every `must_include`
  string is present and every `must_not_include` string absent in `answer_text`; every `numeric` acceptance
  criterion's value appears **verbatim** in `answer_text`. All-or-nothing on the unforgeable subset (no 0.8
  slack — the signals are exact). It returns an **answer-binding token** so the host can confirm the
  surfaced answer is the one that was checked:
  ```json
  { "finalize_verdict": "PASS",
    "answer_text_hash": "sha256(canonicalize(answer_text))",
    "answer_text_length": 1234 }
  ```
  The hash is **not** proof a check ran — it's the corrected binding-token use: it lets the host compare
  the candidate answer against what it actually shows the user, closing the "called finalize with a trimmed
  `answer_text`" gap. *Honest limit (state in-tool):* proves the contract's declared, machine-checkable
  obligations were genuinely discharged this turn — **not** that the answer is true, and nothing about
  obligations the agent never declared. Precisely: **no model-set metadata field can override a failing
  required unforgeable check**; *however*, a model-supplied contract can **under-declare** obligations
  (fewer/weaker checks run), so finalize's PASS is only as strong as the **contract/profile supplied by the
  host**.

## Cross-cutting fix: precision-tier the measurability markers

Several new BLOCK paths reuse `falsifiability_checker.ts` `MEASURABILITY_MARKERS`, which contain known
high-false-positive members (`/\b(?:HTTP\s*)?\d{3}\b/` fires on "step 503"/"page 200"; the version regex
on "version 2.0"; `CamelCase` on ordinary proper nouns; file-path on `and/or` slashes). Propagating these
into four blocking gates multiplies the false-block surface at once.

**Before any new BLOCK reuses markers:** split the set in `utils` into a **HIGH-PRECISION** subset
(unit-bearing thresholds `\d+\s*(ms|s|%|MB|GB|req/s)`, comparators-with-numbers, `E_`/`ERR-` codes) usable
for blocking, and a **LOW-PRECISION** subset (bare 3-digit, version, `CamelCase`, paths) usable for
warnings only. Centralize so every tool inherits the same tiering.

## Adoption is host-side (the honest limit on all of this)

MCP tools are model-controlled: a non-cooperating agent simply never calls `finalize_deliverable`, or
pastes a trimmed `answer_text` that omits the failing field. **ct-mcp provides the gate; the host enforces
it.** Every `status: ENFORCEMENT_FAIL` is advisory unless the host honors it. The real lever is one of:

- a **host system-prompt / harness hook**: "no final answer surfaced until `finalize_deliverable` returns PASS";
- the **experimental orchestrator** (already in-repo) auto-calling the planned suite before emitting;
- a wrapper that gates the deliverable on a `finalize` PASS.

Document this explicitly so "forcing function" language isn't misleading: ct-mcp makes "done"
*checkable*; it does not make it *mandatory*.

## Evaluation harness — gate before you ship blocking

The headline asset is the **0/14 clean-control record**. Regex claim-extraction + four marker-reusing
gates can erode it silently. **Any new BLOCK gate must pass a clean-control replay before merge** (extend
the existing `benchmark/` fixtures with bad-but-plausible outputs):

| Metric | Why |
|---|---|
| unsupported factual claims / answer | core grounding-quality signal |
| numeric mismatch rate | catches analysis hallucinations |
| constraint-violation rate | usefulness to the user |
| **false-block rate** | protects the 0/14 record |
| warning precision | prevents lint fatigue |
| correction-success rate | do agents actually improve after feedback |
| token / tool-call overhead | practical usability |

## Golden-path fixtures (write these before the tools)

Concrete examples prevent schema drift and make the harness easy to build. Ship one golden path per
vertical *before* writing the tool, then make the tool satisfy it. Sketches (abbreviated):

**factual_qa** — full loop:
```jsonc
// original_request_text: "Is Redis single-threaded for command execution? Cite the docs."
// deliverable_contract:
{ "contract_id": "q1", "contract_authority": "host", "profile_source": "host_supplied",
  "task_type": "factual_qa", "evidence_level": "cited", "risk_level": "low",
  "original_request_text": "Is Redis single-threaded...", "original_request_hash": "sha256:...",
  "acceptance_criteria": [{ "id": "c1", "text": "claim is cited", "kind": "inline_check" }],
  "claims": [{ "id": "cl1", "text": "Redis executes commands single-threaded" }] }
// sources: [{ "id": "s1", "text": "...Redis is single-threaded for command execution...",
//             "origin": "host_supplied", "authority_tier": "official" }]
// claims (grounding): [{ "claim_id":"cl1","source_id":"s1",
//   "quoted_span":"Redis is single-threaded for command execution","supporting_token":"single-threaded",
//   "claim_kind":"status" }]
// answer_text: "...Redis is single-threaded for command execution [s1]."
// finalize_deliverable → { "finalize_verdict":"PASS","answer_text_hash":"sha256:...","answer_text_length":312 }
```

**numeric_analysis** — untraced-number warning:
```jsonc
// inputs: [120, 30]      // supplied separately
// conclusion_numbers: [{ "value": 150, "origin": "derived", "op": "sum", "input_refs": [0,1] }]
// answer_text: "Total is 150/mo, a 25% saving."   // 150 traces; 25% does NOT
// → trace pass for 150 (BLOCK if it didn't reconcile); WARNING: untraced answer number "25%"
```

**constraints** — pass/fail:
```jsonc
// original_request_text: "Return JSON with status and a price under 100."
// constraints: [{ "field":"price","op":"<","value":100,"source_quote":"price under 100" },
//               { "field":"status","op":"!=","value":"","source_quote":"with status" }]
// structured_answer: { "status":"ok", "price":120 }    // FAIL: price 120 ≥ 100 (field flagged: in request)
// structured_answer: { "status":"ok", "price":80 }     // PASS
```

## Build sequence (supersedes Part I's "first slice")

0. **Clean up stale Part I language first** — *(done in this revision)*. The hash-as-unforgeable wording in
   the organizing insight, the cross-cutting rule, and Part I #3/#4 was struck/deprecated. Documentation
   debt becomes implementation debt: implementers skim and copy the wrong version.
1. **Schema foundation.** Shared schema constants for `context`, `deliverable_contract`,
   `SourceManifestEntry`, `claim`, `number`, `verdict`, and `honest_limit`; add `outputSchema` (JSON Schema
   2020-12) + `structuredContent` to every new tool from the start. Foundation the rest reuses — before tools.
2. ✅ **Marker precision split (SHIPPED + verified):** `src/enforcement/markers.ts` —
   `HIGH_PRECISION_MARKERS` (blocking-safe) vs `LOW_PRECISION_MARKERS` (warning-only); `HIGH ∪ LOW`
   verified byte-identical to the legacy set so `isMeasurable`/falsifiability behavior is preserved.
3. ✅ **Factual-QA vertical slice (SHIPPED + verified):** `plan_checks` + `check_quote_grounding` (with
   `source_manifest` + `claim_kind`) + `check_claim_coverage` + `finalize_deliverable` (re-executor). See
   [`factual-qa-slice.md`](factual-qa-slice.md). First end-to-end loop likely to *noticeably* improve deliverables.
4. ✅ **Host integration contract + `check_freshness` (SHIPPED + verified):** `check_freshness` (pure
   interval arithmetic over a host-supplied `eval_time`; offset-less datetimes rejected for determinism)
   and the host-side contract (host authors the contract, supplies `eval_time`, verifies `answer_text_hash`,
   honors `ENFORCEMENT_FAIL`). Documented in [`factual-qa-slice.md`](factual-qa-slice.md).
5. ✅ **Constraint checker (SHIPPED + verified):** `check_answer_against_constraints` (Part I #13),
   constraints anchored to `original_request_text`. Many bad outputs aren't hallucinated — they're non-compliant.
6. ✅ **Numeric tracing (SHIPPED + verified):** `trace_conclusion_numbers` (+ answer-number extraction
   warnings). For analyses, the most useful checker after grounding. (Pair with `verify_arithmetic` next.)
7. ✅ **Tier-2 hardenings (SHIPPED + verified):** widened confidence extraction + hedge contradiction (#6),
   falsification↔assumption binding (#5), tautology guard (#9) — wired into `validate_confidence` as
   WARNINGs, with the hedge contradiction the only new BLOCK (claimed ≥0.9 + heavy hedging). All 23
   circumvention tests stay green; adversarial review caught a polarity false-block (`"almost certainly
   NOT…"`) now guarded + regression-tested.
8. ✅ **Structural checks (SHIPPED + verified):** `check_case_partition` (#12, new MECE tool), plus opt-in
   extensions to `validate_reasoning_chain` — premise-usage reconciliation (#11) and redundant evidence via
   vertex-disjoint max-flow (#10) — and `check_plan_validity` failure-branch coverage (#16). A 4-agent
   adversarial workflow brute-forced the max-flow against 60k graphs (correct) and caught real edge bugs
   (derived-evidence counted as independent, `contradicts` edges treated as premises, bounded-retry
   false-blocked) — all fixed + regression-tested. Existing graph/plan tests stay green (all extensions opt-in).

**All build-sequence steps (0–8) are complete.** 11 public tools (7 leaf checks internalized), 281 tests, `tsc` + `npm test` green.

Everything labeled "unforgeable" must rely on within-request containment / re-derivation / interval-graph
math — **never** a hash. `tool-call.ts` may still emit a keyless **binding token**, honestly scoped as
"same inputs re-supplied," not "check ran."

**The through-line:** under keyless + stateless, the only honest BLOCKs are verbatim containment,
re-derivation, and interval/graph math — all within one request. Everything self-declared (authority_tier,
contract criteria, auto-extracted claims, cross-turn "proof") is WARNING. The deliverable_contract +
planner + re-executing finalize give agents the *right* checks and a checkable "done" — but enforcement
that a rushed agent can't skip is ultimately host-side.
