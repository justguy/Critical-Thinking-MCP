# CT-MCP Phase 4 — 4-Arm Ablation: Pre-Registration

> **Status:** DRAFT + **Amendments A, B & C**. STEP-1 smoke + A5 **PASSED**; calibration confirms Haiku natural defect density = 0.000 → natural ablation declared inconclusive, **headline pivots to injected-defect + REPAIR tracks** (Amendment C). Still PRE-FREEZE. · **Date:** 2026-06-02 · **Branch:** `tool-surface-consolidation`
> **Amendments A, B & C govern the body where they conflict** (pre-registration changes are recorded as dated addenda, never silent rewrites).
> **Plan:** `docs/designs/DETERMINISTIC_VALUE_PLAN.md` (authoritative; §refs below). Tracker task `dvp-p4` (approval gate: `experiment-preregistration`).
> **Rule of this document:** once frozen, results are read ONLY against the thresholds written here. No threshold may move after any model output is seen. A null/kill outcome is a valid result, not a failure.

---

## 0. What this experiment decides (and what it cannot)

The whole value thesis stands or falls here (plan §12). The north-star claim under test (plan §1):

> **CT-MCP reduces high-severity defects by forcing checkable intermediate artifacts and rejecting any answer that is not a faithful projection of those artifacts.**

The four arms isolate *which ingredient*, if any, creates that value:

| Arm | Regime | Isolates |
|---|---|---|
| **A** | answer-then-block (post-hoc gate) | baseline + "a linter bolted on" |
| **B** | forced artifacts **+ final-answer binding** (multi-turn real MCP) | the full proof-carrying spine |
| **C** | prompted checklist, **no enforcement** (negative control / kill switch) | "structure as prose only" |
| **D** | forced artifacts **without binding** (multi-turn real MCP) | "forced structure + linting, no projection guarantee" |

**Reads:** `B vs D` isolates **binding**; `D vs C` isolates **enforcement**; `C vs A` is "structure helps" (possibly just chain-of-thought elicitation). **Kills:** if `C ≈ B` → CT-MCP is honestly *structured prompting + a linter* (claim narrows to fabrication/arithmetic/grounding catching, plan §11/§12); if `B ⊁ D` → binding is not the active ingredient.

**Honest boundaries baked in up front:**
- **The design is powered to KILL the claim.** At n≈40 with no decode pinning the minimum detectable effect is ~0.20; effects smaller than that fire the kill conditions and are reported as *"no large effect; null ≠ absent,"* never spun as wins.
- **`B == D` when the model faithfully copies its ledger numbers into prose is a legitimate, pre-registered null.** The harness is forbidden from injecting artificial drift into D to manufacture a B win.
- **The N4 boundary holds:** a wrong *method* that self-traces consistently passes the gate. No arm is credited for catching semantic-method errors a deterministic predicate cannot catch.

---

## Amendment A — post-STEP-1 resolutions (2026-06-02, pre-freeze, human-approved)

STEP-1 (the CLI→real-MCP smoke, `benchmark/phase4/STEP1_FINDINGS.md`) PASSED feasibility but surfaced four items resolved here. **These override the body where they conflict.**

- **A1 — False-block definition (resolves F1).** STEP-1 showed the gate block a *correct* answer (78.89) whose *declared proof was invalid* (model declared `op:mean` over the grades → recomputes 81.67, not the weighted 78.89). Resolution (human-approved): such a case is a **LEGITIMATE repairable block, NOT a false-block** — per §1/§5 an answer with an unchecked/invalid derivation is invalid. It feeds `repair_success_rate` (does the model then supply a valid derivation while keeping the answer correct?). **`false_block_rate` is measured ONLY on clean-control bundles that carry a correct answer AND an already-valid declared proof** (the gate must not block those). The naive **oracle-strict "blocked-despite-oracle-correct" rate is ALSO reported as a transparency secondary**, never as the headline. Corpus consequence: clean-control bundles for B/D must include a *valid declared proof*, and generation tasks must be ones a competent model *can* prove.

- **A2 — Turn budget (resolves F2).** `max_turns=8` is **withdrawn as a literal**. `BIND_SYS` MUST include a worked `numeric_derivation`/`arithmetic_checks` example so a competent model finalizes in 1–3 turns. The turn cap is **calibrated in the pilot to the ~90th-percentile turns-to-RELEASE on CORRECT answers**, then frozen for the standard run (identical across all arms; A/C self-terminate early, unused headroom unused).

- **A3 — Token ledger (resolves F3).** Per-turn reconciliation ("summed-per-turn == total") is **withdrawn** — this CLI's per-turn stream usage is streaming-delta, not billable. The **top-level `result.usage` is the authoritative per-task ledger** (`input + output + cache_creation + cache_read` + `total_cost_usd` + `num_turns`). In `quality_per_1k_tokens`, **cache tokens are weighted at their billed discount** (`cache_read` ≈ 0.1×, `cache_creation` ≈ 1.25× of base input), so B/D's large `cache_read` (STEP-1: 1.38M tokens/task uncapped) is charged fairly, and the frozen turn cap controls the blow-up. Sanity check: `total_cost_usd` consistent with `usage` at known rates (a witness, not a $ metric).

- **A4 — Scope: arm-D `src/` env-gate (resolves F4).** `dvp-p4` is expanded to include a **minimal additive `src/` change**: a `CT_DISABLE_FINALIZE` filter at the server's `ListToolsRequestSchema` handler (`src/server-runtime.ts`) so the D-variant server advertises 10 tools (no `finalize_deliverable`), with a unit test. Also a legitimate product "no-finalize" mode.

- **A5 — B happy-path calibration gate (new, informed).** Before any scored run, confirm that with the worked-example `BIND_SYS` a *correct* answer reliably reaches a finalize **RELEASE** (`ledger_completion_rate(B) ≥ 0.90` on a correct-answer probe set) within the calibrated budget. **If Haiku cannot produce re-executable derivations even with coaching, B is impractical for weak models — reported as a finding, not hidden.** ✅ **STEP-1+A5 RESULT: PASS** — Haiku reaches RELEASE in ~3 turns with the worked example (correct answers, proofs re-executed); arm B is viable.

---

## Amendment B — calibration round-1 findings (2026-06-02, pre-freeze, human-approved)

The lean k=8 arm-A calibration (`benchmark/phase4/calibration_run.json`) surfaced two things, resolved here. **These override the body where they conflict.**

- **B1 — Measurement-instrument bugs (fix before any difficulty judgement).** The round-1 "defects" were dominated by grading bugs, NOT model error: (i) the `source_span` oracle marked a *verbatim-correct* RAG answer wrong because gold_span `"50 per month"` doesn't tokenize-match `"$50 per month"` (currency-adjacency); (ii) a constraint task's JSON answer was *refused/buried* under `SHARED_COT_SYS` ("a bare JSON response isn't helpful…") and the `structured_constraint` oracle parsed nothing; (iii) numeric answers were occasionally mis-extracted from verbose CoT despite a correct `FINAL ANSWER:` sentinel. **Resolution:** fix the `source_span` matcher (punctuation/currency-robust) + add a fixture; introduce a **type-aware grading helper** (`benchmark/phase4/grade_answer.ts`: numeric → the `FINAL ANSWER:` sentinel value; constraint → the extracted JSON object; source_span → full text) with the prereg's **dry-run extraction assertion for every arm shape**; constraint task prompts demand a JSON-only answer. Re-measure on the FIXED instrument before any hardening (don't conflate the two).

- **B2 — Natural-defect band revised + injected/repair elevated to co-primary (the recurring "modern models are good now" wall).** Even modulo the bugs, Haiku barely defects on bounded oracle tasks (failure-prone ≈ 0.06, and lower once the false-defects are removed) — the same wall as the original 0%-natural-density finding. **Resolution (human-approved):**
  - The failure-prone Haiku acceptance band is **revised from [0.30, 0.60] to [0.15, 0.40]** (a realistic target for a strong CLI model); one focused hardening round (deep multi-step chains at Haiku's real weak spots) targets it. Tuning rounds stay ≤3 and hashed; holdout still gives the unbiased estimate.
  - The **injected-defect gate-mechanics track and the repair tracks are elevated to CO-PRIMARY** alongside the natural generation ablation (they do not need natural defects).
  - If natural arm-separation remains thin after the hardening round, the **natural generation ablation is reported honestly as underpowered / ALL-TIE-HIGH (a pre-registered non-win, §11/§12)** — binding/enforcement value then rests on the injected + repair evidence, and the marketing claim narrows accordingly. This is an accepted, honest outcome, not a failure to be engineered around.

---

## Amendment C — natural ablation declared inconclusive; pivot to the repair headline (2026-06-02, pre-freeze, human-approved)

The round-2 calibration **on the fixed instrument** (`benchmark/phase4/calibration_run.json`, Haiku k=8, n=144 failure-prone) measured **failure-prone defect density = 0.000, Wilson 95% [0, 0.026]** (tuning 0.000 / holdout 0.000; numeric 0.000, RAG 0.000, constraint 0.047 — the only residual is one constraint task's occasional format slip). The round-1 0.06 was **entirely grading bugs**; the true natural rate is zero.

**Resolution (human-approved): corpus hardening is SKIPPED.** A strong 4.5-generation model does not defect on bounded, objectively-gradeable tasks (method traps, 4-step chains, distractor RAG all aced); pushing it to [0.15, 0.40] would require contrived torture tasks of dubious validity. Therefore:
- The **natural A/B/C/D generation ablation is pre-registered as INCONCLUSIVE / ALL-TIE-HIGH** (§11/§12) — at 0.000 natural defect density every arm scores ~ceiling, so it cannot isolate binding/enforcement. Reported honestly as such; a small all-four-arm confirmation sample may be run to witness the tie, not to chase separation.
- The **headline rests on the two tracks that do NOT need natural defects** (the co-primary of B2):
  1. **Injected-defect gate mechanics** — DONE: block_recall 1.0 [0.965, 1], false_block 0 [0, 0.086], precision 1.0 [0.965, 1] (renderer-unit-test scope per A1; gate-mechanics sanity, not fabrication-catching).
  2. **The REPAIR track** (next build, STEP 6) — the §10-**primary** endpoint (H4): seed the model with a *defective* draft (a real planted defect) + the arm-specific feedback (B/D = the gate's structured BLOCK reason, gold redacted; A = generic oracle-fail; C = prompted self-review), ≤2 retries, re-grade ALL oracles each attempt. Measures `repair_success_rate` (1- & 2-retry), `new_defects_introduced_during_repair`, and the differential value of *structured gate feedback vs generic vs self-review* — the actual research question, answerable without any natural defects.

The marketing claim "reduces high-severity defects" stays **UNPROVEN** in the ledger; what Phase 4 can now defensibly claim narrows to *fabrication/arithmetic/grounding catching on planted defects* + *repair assistance*, pending the repair result.

---

## 1. The four arms (frozen realizations)

All arms run through **one unified `claude -p` stream-json adapter** (same code path), spawned from `os.tmpdir()` with `ANTHROPIC_API_KEY` deleted (CLI session auth — **no billed API**), full dated model id pinned.

### Arm A — answer-then-block (post-hoc)
- **Invocation:** single call, EMPTY MCP (`--strict-mcp-config --mcp-config '{"mcpServers":{}}'`). System prompt = `SHARED_COT_SYS` ("show every derivation step, quote sources verbatim, restate constraints, re-check your final number"). Answer must end in a required `FINAL ANSWER: <x>` sentinel.
- **"Gate":** the **objective oracle** (`gradeWithOracle`) — A produces no model-authored bundle, and synthesizing one would re-import the NLP-extraction problem plan §5 refuses. A's "block" is an oracle-fail surfaced as the implied §7 code.
- **Allowed tools:** none. **Enforcement:** post-hoc oracle, no binding, no forced artifacts.
- **Parity:** gets `SHARED_COT_SYS` so `A vs C` isolates *enforcement*, not thinking-volume. Same per-task ceilings as B/D (self-terminates in 1 turn; unused headroom genuinely unused, no filler). **A's block accounting is reported in a SEPARATE column and never pooled with B/D** (different judge: oracle vs `realEnforcementGate`).

### Arm B — forced artifacts + binding (multi-turn real MCP)
- **Invocation:** multi-turn against the **real built ct-mcp server** — `--mcp-config` launching `node dist/server.js`, `--strict-mcp-config`, `--allowedTools 'mcp__ct-mcp__*'`, `--permission-mode acceptEdits`, `--output-format stream-json`, `--max-budget-usd <backstop>`. System prompt = `BIND_SYS`: (1) `plan_checks` for the **host-authored** contract, (2) populate artifacts — for numeric tasks a `check_numeric_claims` call that **declares leaf inputs so the gate RECOMPUTES the chain** (not a render-vs-stated-derivation diff), (3) `finalize_deliverable` returns `answer_text_hash` binding the surfaced answer to the ledger.
- **Released answer:** the finalize-bound rendered field (graded on THAT field). **On BLOCK,** the full enforcement object (code + field pointer + mechanism, **no gold value**) is fed back in-session, ≤2 repairs.
- **Allowed tools:** `mcp__ct-mcp__*` (11 advertised). **Enforcement:** forced artifacts + `answer_text_hash` binding. Binding **ON**.
- **Parity:** inherits 11 tool schemas as context (cache tokens A/C never see) — **charged in full** via `quality_per_1k_tokens`. A B row without ≥1 `mcp__ct-mcp__` tool_use AND a `finalize_deliverable` returning `answer_text_hash` is an **execution failure** (scored defect + flagged), never a clean datapoint. `permission_denials` must be `[]` per row.

### Arm C — prompted checklist, no enforcement (negative control / kill switch)
- **Invocation:** single call, EMPTY MCP exactly like A. System prompt = `CHECKLIST_SYS`, generated by a **frozen render script FROM the real ct-mcp tool-description source** (`dist/mcp/*`) so its instruction *content* matches what B's tools surface, within a frozen ±15% length band. The ONLY delta vs `BIND_SYS` is "you have tools that enforce this" (B) vs "do this" (C).
- **No host gate runs as a release blocker.** C gets a **self-review repair channel** ("apply your checklist and correct any issue you find", ≤2 passes) so attempt-count parity holds. Graded by the same oracle on the `FINAL ANSWER:` sentinel.
- **Allowed tools:** none. **Enforcement:** none; structure-as-prose only.
- **Parity:** render-from-source + byte-diff archived in the freeze hash neutralizes the "C over/under-helped" confound that would bias the `C ≈ B` kill. **Reported BOTH ways: C first-pass AND C post-self-review** (headline never compares post-repair B against first-pass C).

### Arm D — forced artifacts WITHOUT binding (multi-turn real MCP)
- **Invocation:** identical to B EXCEPT a **server variant** (`dist/server.js` started with `CT_DISABLE_FINALIZE=1`) that **does not advertise `finalize_deliverable`** — so the binding tool's schema never enters context (verified: D init lists 10 tools, B lists 11; `--allowedTools` gates execution not visibility, which is why a server variant is required). System prompt = `NOBIND_SYS` (`BIND_SYS` minus the finalize/binding clause).
- The same artifact tools run and the same per-artifact gates (recomputed numeric DAG, strong grounding, requirement coverage, constraint) BLOCK, but the surfaced answer is the model's own restatement — **not hashed/bound**, so final-answer↔artifact drift cannot be enforced. BLOCK feedback (full object minus any drift/binding code) fed back in-session, ≤2 repairs.
- **Allowed tools:** `mcp__ct-mcp__*` minus `finalize_deliverable`. **Enforcement:** forced artifacts + linting; **NO binding**.
- **Parity:** `B vs D` isolates binding because the ONLY delta is the `finalize_deliverable` advertisement + the `answer_text_hash` chain it enables. `binding_attributable_catch` gates the binding claim (see §6).

---

## 2. Corpus (two corpora, both content-hashed before any call)

### 2.1 Hard generation corpus — drives the A/B/C/D natural ablation
The existing calibration corpus is at **0% Haiku-natural defect density on every suite** (`calibration_haiku…json`), so it cannot separate arms and MUST be hardened first.

- Author ~60 candidate tasks across 4 families matched to `oracles.ts`: **math** (`gold_answer`, ≥4 dependent chained ops + a method-choice trap, **multi-field answer requiring ≥3 restated numbers so drift has a real opportunity to occur**), **RAG** (`source_span` + a conflicting-number distractor doc + superseded-version trap), **constraint** (`structured_constraint`, ≥3 simultaneous bounds + 1 forbidden enum), **decision** (option-coverage + rejected-option reversal, advisory-graded).
- **Calibration is MULTI-SAMPLE:** run the **arm-A invocation** at **k=8 samples/task** at the same decode the arms use. Tune difficulty on a **tuning split**, FREEZE, then estimate the band on a **disjoint holdout split** (removes winner's-curse selection bias). **ACCEPT iff** Haiku failure-prone suite-mean defect_density ∈ [0.30, 0.60] on the holdout AND clean-control false-trigger ≤ 0.02 AND no single accepted task at exactly 0.00 or 1.00 (1.00 audited as a suspected oracle bug). **Sonnet monotonicity:** Sonnet holdout density must be < Haiku by ≥ 0.10.
- Tuning **capped at 3 rounds**, each round's corpus content-hashed (final hash one of a pre-committed enumerated set), tuning targets the **arm-A baseline ONLY** and is **blind to B/C/D outcomes**. If unreachable in 3 rounds → **DEGENERATE-CORPUS** terminal node (§6).

### 2.2 Task-level distractor mutations — proves the *workflow* (plan §8 row 2)
For each accepted base, author paired mutated **tasks** with **deterministically recomputed oracles**, each asserted oracle-wrong-vs-original-gold before the run: annual→monthly, budget $10k→$8k, "bullets preferred"→"no bullets", add-conflicting-number-distractor-doc, add-tempting-irrelevant-option. Both pair members run all four arms under one shared task-order permutation (`SEED=42`). Contrast uses **paired (McNemar)** structure.

### 2.3 Repair-on-injected sub-experiment — FROZEN SCOPE: renderer/diff unit test ONLY
Uses the existing 41-base / ~106-mutant OUTPUT-level corpus (`mutators.ts` + `bundle_cases.ts`; 6 ungroundable source_span bases excluded per `live_gate_score.json`).

> **⚠️ Honesty constraint (critical).** The `goldBundle` mutator plants the *correct* gold in the derivation and mutates only the rendered field — so this corpus tests **render-vs-stated-derivation consistency**, NOT model fabrication/arithmetic. It is **pre-registered that its `block_recall` and `repair_success` may NOT be cited as evidence the gate catches fabrication/arithmetic, and may NOT become the headline win if the generation corpus degenerates.** (The 100%/0%/100% live_gate_score is gate *mechanics* on hand-edited JSON.)

**Wiring:** seed the model with the mutated draft + arm-specific BLOCK feedback (**gold value redacted** — repair measures re-derivation, not transcription), ≤2 retries under the same per-attempt ceilings, re-grade ALL oracles each attempt. Bootstrap CIs **cluster-resample whole bases** (~41 effective n, not 106 mutants). `new_defects_introduced_during_repair` restricted to multi-field bases.

---

## 3. Models
- **Haiku** — full A/B/C/D, dev/high-defect target. Pinned to the **full dated id** resolved at smoke time (e.g. `claude-haiku-4-5-20251001`), NOT the `haiku` alias; `claude --version` + served `modelUsage` fingerprint recorded in the freeze hash. A mid-run alias rotation invalidates the comparison.
- **Sonnet** — **pilot scale (~12 tasks)**, full A/B/C/D, pre-registered **DIRECTIONAL-ONLY** (underpowered for its own CIs). A Sonnet null is reported as *"no measurable defect reduction on the stronger model"* (an expected outcome, plan-aligned). **Haiku-null + Sonnet-null = overall NULL**, never spun as "works where it should."

---

## 4. Scale & gating
- **Pilot:** 12 tasks/arm × 4 Haiku arms ≈ 48 generation rows + the ~106-mutant repair sub-experiment for {A,B,D} ≈ **~150 Haiku calls**. The pilot is a **pure feasibility/calibration gate**, measured ONLY on quantities **orthogonal to the headline contrast**.
- **Standard:** 40 tasks/arm × 4 Haiku arms (160 rows) + 40 task-level mutation pairs (paired) + repair sub-experiment under {A,B,D} + Sonnet pilot arm ≈ **~500–700 calls**.
- **Samples per scored cell (k):** **k=1 uniform baseline** (paired McNemar over 40 tasks → MDE ~0.20). The repair primary endpoint carries the headline, so it does not hinge on the underpowered density contrast. **Opportunistic upgrade:** k=3 is applied ONLY to the pre-enumerated **binding-eligible multi-field-math task ids** (where the B-vs-D contrast lives), and ONLY if the pilot's measured per-call token cost leaves headroom inside the ~500–700-call envelope. *Frozen:* the decision rule + the eligible task-id set (not a post-hoc count).
- **Gating rule (pilot → standard), ALL must hold:** (i) hardened-corpus Haiku failure-prone suite-mean density ∈ [0.30, 0.60] on holdout; (ii) clean-control `false_block_rate` point 0 with Wilson 95% upper bound reported (the ≤0.02 ceiling is **unverifiable until clean-control n ≥ 150** — at pilot n it is directional only, NOT a hard pass/fail); (iii) `adapter_error_rate` ≤ 0.10 AND equal across arms within ±5pp; (iv) `ledger_completion_rate(B)` ≥ 0.90 AND `permission_denials == []` on all B/D rows; (v) token-ledger reconciliation (summed-per-turn == top-level usage) passes on every scored row; (vi) STEP-1 smoke passed. **No arm-vs-arm defect-density spread is in the gate** (that is the effect under test; gating on it would be optional-stopping). Once feasibility passes, **standard runs unconditionally on direction.**

---

## 5. Parity matrix (the ablation is ceteris-paribus or it is invalid)

| Dimension | How held equal |
|---|---|
| Model + served fingerprint | Full dated id pinned per cell; `modelUsage` recorded per call; divergent cell dropped, not scored. |
| Decode determinism | **No `--temperature`/`--seed` exists in this CLI build → "determinism" abandoned as unenforceable.** All arms at identical CLI-session default; sampling variance handled by k samples/cell folded into CIs. |
| Task set + order | One content-hashed task list, one shared `SEED=42` permutation, per-(task,arm) row stored so McNemar is computable. Task-hash ≠ frozen → invalid run. |
| Source documents + context | Identical source bytes; A/C inline in prompt, B/D fed the same manifest to the server. No arm sees a doc another doesn't. |
| Chain-of-thought elicitation | **A and C both receive `SHARED_COT_SYS`**, isolating structure from thinking-volume. |
| Allowed tools | A,C = empty MCP. B = 11 advertised. D = server variant advertising 10 (`finalize_deliverable` removed at the SERVER level). The single surface delta B-vs-D **is** the binding manipulation. |
| System-prompt byte control | `CHECKLIST_SYS` rendered from source; `BIND_SYS` vs `NOBIND_SYS` differ ONLY in the finalize/binding clause; all hashed, ±15% length band. Any other diff invalidates the run. |
| **Token charging (parity linchpin)** | ONE denominator for ALL arms = input+output+cache_creation+cache_read over EVERY turn + EVERY tool round-trip. Cache state **warmed identically per cell** by a fixed throwaway priming call (neutralizes the observed ~3.3× cold/warm swing). No row scores without a reconciled ledger. |
| Budget ceilings | Frozen `BUDGET` identical for all: `max_assistant_turns=8` (harness-side stream-json counter + hard-stop), `max_output_tokens_per_turn=1024`, **`TASK_TOKEN_CEILING=12000` (the binding experimental constraint)**, `WALL_CLOCK=180000ms`. A/C unused headroom genuinely unused (no filler). |
| Runaway backstop | `--max-budget-usd` set **high enough to never bind** (pure CLI runaway-loop stop, NOT an experimental variable, NOT spend under session auth). The token ceiling is what truncates. |
| Permission mode | B/D pinned to `--permission-mode acceptEdits` (NOT `auto` — a nondeterministic LLM classifier that empirically denies on task semantics). `permission_denials == []` per scored B/D row. |
| Retry / repair policy | Every arm ≤2 repairs (3 total). A/B/D triggered by BLOCK + gate text; C by self-review. Feedback richness (A~1 field, C self-review, B/D~3 fields) is the **declared mediator** `repair_feedback_richness`, quantified not hidden. Headline contrasts compare EQUAL attempt counts. |
| Grading | Same `gradeWithOracle` on the FINAL answer; B/D on the finalize-bound field, A/C on the `FINAL ANSWER:` sentinel; a dry run asserts `extractNumericAnswer` returns the intended token for every arm shape. |
| Adapter-error / attrition | Spawn/parse/timeout failures recorded identically, excluded from defect/quality denominators, counted in `adapter_error_rate` (parity witness, equal within ±5pp). Differential B/D attrition is treated as a B/D defect, not a free discard. |
| Server cwd purity | ct-mcp child launched with explicit neutral cwd, verified to read no repo files/`CLAUDE.md`/`.mcp.json`; server-startup latency excluded from `latency` identically. |

---

## 6. Metrics (de-dollarized — tokens & defect-equivalents only)

> **No currency anywhere.** CT-MCP's gate is deterministic and ~free; the only real cost the enforcement regime imposes is **extra model tokens** (forced multi-turn artifact production). That is measured in **tokens** via `quality_per_1k_tokens`. `net_value` is reported in **defect-equivalent units**. This is a deliberate, pre-registered refinement of plan §10 (which wrote `− latency_cost − token_cost − user_friction_cost` in implied money) into the honest unit.

**Primary**
- `repair_success_rate_after_one_retry` / `_after_two_retries` = correct-by-attempt-2 (resp. 3) / blocked-on-attempt-1. Per arm (A,B,D gate; C self-review), per corpus. Injected CIs cluster-resample whole bases.
- `new_defects_introduced_during_repair` = repairs that cleared the named code BUT introduced a *different* oracle defect / total repairs. Re-grade ALL oracles each attempt. Multi-field bases only.
- `quality_per_1k_tokens` = `1000 × correct_final_answers / total_tokens_all_turns_all_attempts` (denominator = input+output+cache, every turn + tool round-trip; cache warmed per cell). Bootstrap 95% CI over tasks. **The efficiency guard against B "winning" on tokens.**
- `defect_density_per_arm` = final answers with `high_sev_defects>0` / graded final answers (excl. adapter_error + truncated). Per arm, per task_type. Wilson 95% CI. **The headline generation contrast.**

**net_value (defect-equivalent units)**
- `net_value = severity-weighted prevented_defects − false_blocks_on_correct − false_passes_on_known_wrong`. **Frozen severity weights:** numeric/grounding = 1.0, constraint = 0.8, missing-requirement = 0.6. `prevented_defects` counted ONLY on **live model-generated defects** (the injected corpus may NOT contribute). **No latency/token/$ term inside net_value** — efficiency lives in `quality_per_1k_tokens`, friction in `false_block_rate`.
- **Headline rule:** `net_value(B) > net_value(A)` with bootstrap 95% CI lower bound > 0.
- **cost-honesty veto:** if `density(B) < density(C)` BUT `quality_per_1k_tokens(B) < quality_per_1k_tokens(C)`, the headline downgrades to *"binding improves quality only at a token premium of X%"* — never a clean win.

**Binding attribution**
- `binding_attributable_catch` = on B, count(shipped-answer drift defects caught by binding that D shipped oracle-wrong on the MATCHED (task,seed) cell) / count(D shipped defects). **GATING precondition** for the binding claim: if ~0 (Haiku faithfully copies ledger numbers), binding is inert for this model class — a legitimate null.

**Block accounting** (Wilson CIs; 0/n reported with its upper bound, never as certain 0)
- `block_rate / true_block_rate / false_block_rate`; `block_precision / block_recall` — per arm with a gate (A,B,D). On the **injected corpus these are NOT informative** (every mutant blocked by construction) → labeled "gate-mechanics sanity," never summed into net_value. **A reported in a separate column from B/D (different judge).**

**Diagnostics (reported, NOT gated)**
- `blocker_code_accuracy` against the **frozen** §7 label map (the known routing numeric→`FINAL_ANSWER_ARTIFACT_DRIFT`, fabrication→`SOURCE_SPAN_MISMATCH`, live_gate_score 27.4%, is a labeling-alignment diagnostic; the label map is frozen before the run, never relabeled after seeing emitted codes).
- `repair_feedback_richness`; `adapter_error_rate / ledger_completion_rate / truncation_rate`.

---

## 7. Hypotheses

| id | statement | test |
|---|---|---|
| **H1-binding** | B reduces high-sev defect density vs D **on binding-eligible cases** (multi-field/recomputable, where drift can occur). | McNemar paired (B vs D) on binding-eligible cases only (NOT pooled math), one-sided; 95% CI on (density_D − density_B) LB > 0, AND `binding_attributable_catch` ≥ 0.05 of D's defects, AND `quality_per_1k_tokens(B)` ≥ `(D)`. Effective n = binding-eligible subset; honest MDE reported. |
| **H2-enforcement** | D reduces defect density vs C, holding CoT constant. | McNemar paired (D vs C) at equal attempt counts; 95% CI on (density_C − density_D) LB > 0. |
| **H3-structure** | C reduces defect density vs A, both with `SHARED_COT_SYS`. | McNemar paired (A vs C); 95% CI LB > 0. May be a CoT-elicitation effect; explicitly NOT the north-star claim. |
| **H4-repair (PRIMARY ENDPOINT)** | B repairs blocked defects on the LIVE generation corpus without net harm. | `repair_success_rate_after_two_retries(B)` on the live generation corpus ≥ **0.50** AND `new_defects_introduced_during_repair(B)` ≤ **0.15**, cluster-bootstrap 95% CI. |
| **H5-repair-binding-vs-prompt** | Structured+bound repair feedback (B) repairs better than prompted self-review (C). | `repair_success_2(B) − (C)` ≥ 0.15, cluster-bootstrap CI excluding 0, on the generation corpus (the injected corpus cannot carry this). |
| **H6-sonnet** | CT-MCP helps least on the stronger model. | DIRECTIONAL ONLY (underpowered). (density_A_sonnet − density_B_sonnet) CI including 0 → "no measurable reduction on the stronger model" (a pre-registered expected outcome, not a failure). |

**Multiplicity:** ONE primary endpoint = H4 at α=0.05. All other thresholds are secondary under **Holm** control; **no secondary may rescue a null primary.**

---

## 8. Decision tree (exhaustive — every outcome maps to an action)

| Condition | Threshold | Action |
|---|---|---|
| STEP-1 smoke fails | any sub-check (server launch / tool call / `answer_text_hash` / token recovery / `--resume` MCP persistence) | **HALT.** Do not freeze thresholds. Escalate; fall back to A-vs-C single-shot only as a degraded "structure-as-prose" study, reported as such. |
| Pilot feasibility gate | §4 (i)–(vi) | All pass → run STANDARD unconditionally. Corpus out-of-band → ≤3 hashed tuning rounds. Still out-of-band → DEGENERATE-CORPUS. |
| **DEGENERATE-CORPUS** | Haiku failure-prone holdout density < 0.30 after 3 rounds | **NEGATIVE headline:** "natural arm-separation not achievable on this model/corpus." Injected sub-experiment reportable ONLY as a renderer/diff unit test; may NOT be the headline. |
| **H4 repair primary** (LIVE corpus) | `repair_success_2(B)` ≥ 0.50 AND `new_defects(B)` ≤ 0.15, CI-backed | Pass → repair value PROVEN (§10 primary). Fail → repair value NOT established; report honestly. |
| **C ≈ B KILL** | \|density_C − density_B\| ≤ 0.05 AND McNemar(C vs B) p ≥ 0.05 on standard failure-prone, OR `qpk(C)` ≥ `qpk(B)` | **KILL** the binding/enforcement value claim → narrows to "fabrication/arithmetic/grounding catching" (§12). **Takes PRECEDENCE** if it co-fires with B-or-D. |
| **B ⊁ D KILL** | 95% CI on (density_D − density_B) includes 0 on binding-eligible cases OR `binding_attributable_catch` < 0.05 | Demote "binding" → claim becomes "forced checkable artifacts + linting." Faithful-copy null reported as such; **no drift injected into D to rescue B.** |
| H1 binding positive | CI(density_D − density_B) LB > 0 AND `binding_attributable_catch` ≥ 0.05 AND `qpk(B)` ≥ `qpk(D)` | Declare **binding** the active ingredient on binding-eligible cases. |
| cost-honesty veto | density(B) < density(C) BUT `qpk(B)` < `qpk(C)` | Downgrade to "binding improves quality only at a token premium of X%." Terminal node. |
| ALL-TIE-HIGH | every arm correct-rate within 0.05 AND all > 0.90 | **INCONCLUSIVE** — "corpus too easy / repair saturated." NOT a win (§11). |
| ALL-TIE-LOW | every arm correct-rate within 0.05 AND all < 0.10 | **INCONCLUSIVE** — "task unwinnable / oracle suspect; audit oracles." NOT a win, NOT a kill. |
| H2 / H3 | respective McNemar CI LB > 0 | Declare enforcement (D>C) / structure (C>A); flag H3 as possibly CoT-elicitation, not north-star. |
| Underpowered region | any contrast CI includes 0 at standard n (true effect in (0, MDE~0.20)) | "No LARGE effect detected at n; null ≠ absent." Binding-eligible & Sonnet contrasts pre-declared underpowered; a kill there is a power statement. |
| Sonnet | (density_A_sonnet − density_B_sonnet) CI | Directional only: CI-includes-0 → "no measurable reduction on stronger model." Haiku-null + Sonnet-null = overall NULL. |

---

## 9. Frozen invariants (hashed at freeze, before any model call)
1. **This document** (the merged design) at its frozen git commit.
2. Task-list content hash (hard generation corpus + task-level mutation pairs) + the enumerated set of allowed tuning-round hashes + the binding-eligible-math task-id set (for opportunistic k).
3. `benchmark/oracles.ts` content hash (`extractNumericAnswer`/`conveysGoldSpan` are load-bearing; adversarial fixtures for trailing-number / negation / "X not Y" added and hashed).
4. `benchmark/mutators.ts` + `bundle_cases.ts` content hash (frozen as **renderer-unit-test scope**, explicitly NOT a fabrication/arithmetic oracle).
5. `src/` enforcement commit hash (a mid-run `src/` change invalidates pilot→standard comparison).
6. System-prompt set hashes: `SHARED_COT_SYS`, `BIND_SYS`, `NOBIND_SYS`, `CHECKLIST_SYS` + the render-from-source script + its byte-diff archive.
7. The §7 expected-code label map (numeric→`NUMERIC_MISMATCH` on recompute path; drift only when derivation valid but render differs; reconciliation done pre-run, never post-hoc).
8. `BUDGET`: `max_turns=8`, `max_output_tokens_per_turn=1024`, `TASK_TOKEN_CEILING=12000` (literal), `--max-budget-usd` backstop (literal, non-binding), `WALL_CLOCK=180000ms`, no conditional bump.
9. Token-denominator definition (input+output+cache, all turns/tool round-trips) + cache-warming protocol + the per-turn==total reconciliation assertion.
10. `net_value` definition: severity weights {1.0, 0.8, 0.6}; defect-equivalent units only; the `net_value(B) > net_value(A)` CI rule; the cost-honesty veto. (No monetary coefficients — none exist.)
11. `SEED=42`; k policy (k=1 baseline, k=8 calibration, k=3 binding-eligible-math-only-if-headroom); the CI library (Wilson, Newcombe, exact-McNemar, cluster-by-base bootstrap) unit-tested vs textbook fixtures and content-hashed.
12. ONE primary endpoint = `repair_success_rate_after_two_retries(B)` on the live generation corpus, α=0.05; all others secondary under Holm; the written "no secondary rescues a null primary" rule.
13. Pinned full dated model ids + `claude --version` + `--permission-mode acceptEdits` + the D server-variant flag (`CT_DISABLE_FINALIZE`).

---

## 10. Top risks (tracked)

| Risk | Sev | Mitigation |
|---|---|---|
| Injected corpus is a **tautology** (catches the harness's own render edit, not model fabrication; the N4 boundary). | critical | Frozen scope = renderer/diff unit test ONLY; recall/repair may not be cited as fabrication-catching nor be the degenerate-corpus headline. Arithmetic claim tested ONLY where the live model declares leaf inputs and `check_numeric_claims` recomputes (live B). Binding claim restricted to binding-eligible cases; `binding_attributable_catch` gates it. |
| `quality_per_1k_tokens` (the sole guard against B winning on tokens) has no token source today; ~3.3× cold/warm cache swing; `auto` permission-mode is a nondeterministic LLM gate. | critical | STEP-1 smoke must prove usage/cache/num_turns recoverable + per-turn==total reconciliation; ONE input+output+cache denominator; cache warmed per cell; permission-mode pinned `acceptEdits`; no row scores without a reconciled ledger. |
| Decode NOT pinnable (no `--temperature`/`--seed`) → "determinism" fictional; at n=40 MDE~0.20 auto-fires kills on true effects of 0.05–0.20. | high | Abandon determinism claim; k samples/cell folded into CIs; pre-register sub-MDE kills as "no large effect / null ≠ absent"; binding-eligible subset reports its own honest MDE; primary endpoint moved to the higher-power repair metric. |
| Injected "n=106" is ~41 clustered bases; quoted power overstated; no CI/bootstrap code exists in the repo. | high | Cluster-resample whole bases; build+unit-test+hash the CI library before any scored run; effective-n + DEFF reported; binding sub-claim pre-labeled underpowered. |
| Goalposts movable / pilot gating on arm-spread = optional stopping. | high | Collapse to ONE hashed predicate set; freeze net_value definition; pilot gates ONLY on feasibility orthogonal to the contrast; standard runs unconditionally on direction. |
| A-arm "gate" is the oracle, not `realEnforcementGate`; pooling A vs B/D block accounting is apples-to-oranges. | high | A pre-registered as oracle-graded in a SEPARATE column; never pooled; A's "block" is explicitly an oracle-fail. |
| CoT confound: A had no CT prompt while C/D force visible steps. | medium | `SHARED_COT_SYS` given to BOTH A and C; H3 flagged as possibly-CoT, not north-star. |
| Multi-turn B/D get iterative refinement A/C physically cannot use; token charging only partially offsets. | medium | Symmetric ceilings + full token charging + cost-honesty veto; any B win that vanishes under `quality_per_1k_tokens` reported as a token/compute premium, scoped to "B/D mechanism + its inherent multi-turn cost." |

---

## 11. Build plan (ordered; STEP 1 is BLOCKING)

1. **STEP 1 (BLOCKING, FIRST) — CLI→real-MCP smoke for arm B.** From `os.tmpdir()`, spawn `claude -p '<one multi-field math task>' --model <dated-haiku> --output-format stream-json --mcp-config '{…node dist/server.js…}' --strict-mcp-config --allowedTools 'mcp__ct-mcp__*' --permission-mode acceptEdits --max-budget-usd <backstop>`. Prove non-interactively: (a) server connects (`init mcp ct-mcp status=connected`); (b) ≥1 `mcp__ct-mcp__` tool_use fires AND `check_numeric_claims` recomputes a declared chain; (c) `finalize_deliverable` returns `answer_text_hash`/`plan_token`; (d) `usage{input,output,cache_creation,cache_read}` + `num_turns` recoverable AND summed-per-turn == top-level; (e) a second turn via `--resume` re-attaches the SAME ct-mcp child (in-server ledger survives) — if not, keep all turns in one invocation; (f) `permission_denials == []`; (g) D server variant (`CT_DISABLE_FINALIZE`) advertises 10 tools, B advertises 11. **Any failure → HALT per the decision tree.**
2. **STEP 2** — Extend `model_adapter` into ONE unified stream-json path for all arms (accepts `mcpConfig`+`allowedTools`+`appendSystemPrompt`+`maxBudgetUsd`+`permissionMode`; harness-side 8-turn hard-stop; complete token ledger + per-turn==total assertion; per-cell cache-warming). Unit-test the ledger assertion against a captured fixture.
3. **STEP 3** — Four arm drivers as thin configs over the unified adapter, reading ONE frozen `BUDGET` + the hashed system-prompt set; D = server variant + `NOBIND_SYS`; A/C = empty MCP + `SHARED_COT_SYS`/`CHECKLIST_SYS`. Unit-test: A/C byte-identical except system prompt; B/D byte-identical except server-variant flag + binding clause; `CHECKLIST_SYS` within ±15% of `BIND_SYS`.
4. **STEP 4** — Build + unit-test + hash the statistics library (Wilson, Newcombe, exact McNemar, cluster-by-base bootstrap) vs textbook fixtures; re-report existing `live_gate_score` numbers WITH CIs (false_block 0/41 → Wilson [0, 0.086]).
5. **STEP 5** — Author the hard generation corpus (~60 candidates) + frozen §7 label map + adversarial oracle fixtures. Run the k=8 arm-A calibration on the tuning split, FREEZE, verify band on disjoint holdout; Sonnet monotonicity; ≤3 hashed tuning rounds.
6. **STEP 6** — Author task-level distractor-mutation pairs (recomputed+asserted oracles). Wire the repair loop (in-session B/D, append A, self-review C, ≤2 retries, re-grade ALL oracles, **redact gold from feedback**). Wire the injected repair sub-experiment over the ~106 mutants for {A,B,D} under the FROZEN renderer-unit-test scope.
7. **STEP 7** — Scoring/accounting layer: per-arm defect_density (Wilson), pairwise diffs (Newcombe), paired contrast (McNemar), `quality_per_1k_tokens` (cluster-bootstrap, full+warmed denominator), block accounting in SEPARATE A vs B/D columns, `blocker_code_accuracy` (reported not gated), `binding_attributable_catch`, ledger/permission/truncation/adapter witnesses, `net_value` (defect-equivalent, severity-weighted), Holm multiplicity. Emit one frozen results JSON.
8. **STEP 8** — Run PILOT (~150 Haiku calls); evaluate the feasibility-only gate; if pass, run STANDARD unconditionally (Haiku ~40/arm + Sonnet pilot arm); evaluate every decision-tree node against the FROZEN numbers; hand the frozen results + spec hash to the orchestrator (which owns the doc write + commit), reporting any KILL/INCONCLUSIVE outcome without moving any threshold.

---

## 12. Freeze record

**Outcome:** the experiment **concluded from the calibration + repair pilot** (Amendment C), not from a full scored standard run — Haiku's 0.000 natural defect density made the natural ablation inconclusive by construction, and the repair pilot showed no gate advantage. See [`../PHASE4_RESULTS.md`](../PHASE4_RESULTS.md).

**Audit trail (this is what makes the result trustworthy):** the design was frozen *as dated amendments authored before each measurement* — Amendment A before STEP-1, B before the instrument re-measure, C before the conclusion — so no threshold moved after seeing the data it judged. The decisive numbers (calibration 0.000, repair 6/6·6/6·4/6·5/6, injected 106/106·0/41) are all in committed JSON (`benchmark/phase4/*.json`, `benchmark/reports/live_gate_score.json`) and reproducible via the committed harness.

- Pre-registration commit: `<the commit that lands this document — the freeze anchor>`
- `claude --version`: 2.1.160 (recorded at STEP-1 smoke)
- Authoritative gate at freeze: tsc clean · 855 tests · claims-ledger pass (16 entries)
- Human approval: experiment design (AskUserQuestion), Amendments A/B/C, and conclude-from-pilot all human-approved in-session; commit pending sign-off.
