# CT-MCP Phase 4 — Status & Documentation

> **Snapshot:** 2026-06-02 · **Branch:** `tool-surface-consolidation` · **HEAD at session start:** `159a8d1`
> **Scope:** the Phase-4 4-arm ablation build (tracker task `dvp-p4`). Authoritative design: [`docs/designs/PHASE4_PREREGISTRATION.md`](designs/PHASE4_PREREGISTRATION.md) (+ Amendments A & B). Plan: [`docs/designs/DETERMINISTIC_VALUE_PLAN.md`](designs/DETERMINISTIC_VALUE_PLAN.md).
> **Freeze status:** **PRE-FREEZE** — nothing committed; the pre-registration is not yet hashed (freeze happens after corpus calibration succeeds, before the scored run).

---

## 1. Readiness

| Area | State |
|---|---|
| ct-mcp product (11-tool spine + `ct-enforce` CLI) | ✅ shipped & green (pre-existing) |
| Phase-4 mechanism (CLI→real-MCP multi-turn) | ✅ **proven** (STEP-1 smoke) |
| Arm-B viability (Haiku reaches finalize RELEASE) | ✅ **proven** (A5 probe: RELEASE in 3 turns) |
| Unified stream-json adapter + arm-D env-gate | ✅ built & green |
| Arm drivers + prompt set (A/B/C/D) | ✅ built & green |
| Statistics library (Wilson/Newcombe/McNemar/bootstrap) | ✅ built & green |
| Hard corpus (30 tasks) + frozen label map + oracle fixtures | ✅ built & gold-verified |
| Grading-instrument fix (Amendment B1) | ✅ done & green |
| Clean re-calibration | ✅ Haiku natural defect density **0.000** [0,0.026] |
| Corpus hardening (Amendment B2) | ⏹ **skipped** (futile at 0.000; user-approved Amendment C) |
| Repair pilot (the new headline) | ✅ done — **no gate repair advantage** (A=C=6/6, B=4/6) |
| **Phase-4 conclusion** | ✅ [`PHASE4_RESULTS.md`](PHASE4_RESULTS.md) — claim narrows to defect *catching* |
| Freeze / hash + commit | ⏳ **prepped — awaiting your sign-off** |
| Live host-contract proof + adoption (Phase 5, `dvp-p5`) | ⛔ blocked on `dvp-p4` |

**Tracker:** `dvp-p3-4` complete. `dvp-p4` concluded (pending freeze sign-off). `dvp-p5` blocked on p4.

**What "ready" means now:** the experiment is **concluded** (see [`PHASE4_RESULTS.md`](PHASE4_RESULTS.md)). All infrastructure passes the authoritative gate; the honest result — on a strong model CT-MCP catches planted defects deterministically but shows no measurable reasoning/repair/binding value — is written and the claims ledger updated. The only remaining step is the freeze/commit, which needs your sign-off.

---

## 2. Test results

### 2.1 Authoritative gate (`npm run build && npm test && npm run check:claims`)
Run by the orchestrator after every build chunk. Progression this session:

| Checkpoint | tsc | tests | claims-ledger |
|---|---|---|---|
| Session start (`159a8d1`) | clean | 600 | pass (12 entries) |
| + `dvp-p3-4` affordances | clean | 600 | pass |
| + foundation (env-gate + adapter) | clean | 611 | pass |
| + prompts + arms | clean | 624 | pass |
| + stats library | clean | 653 | pass |
| + hard corpus | clean | 777 | pass |
| + instrument fix (B1) | clean | **806** | pass |

All green; zero regressions. (Current authoritative gate: **tsc clean · 806 tests · claims-ledger pass**.) The claims-ledger check ("docs can't assert an unproven claim") passes throughout — the pre-registration deliberately states the unproven north-star as the *hypothesis under test* and is intentionally not in the ledger-scanned `TRACKED_DOCS` set.

### 2.2 STEP-1 — CLI→real-MCP smoke (feasibility) → **PASS**
Evidence: `benchmark/phase4/STEP1_FINDINGS.md`, `benchmark/phase4/step1_smoke_B_raw.jsonl`.
- `claude` CLI **2.1.160** drove the real ct-mcp server multi-turn, non-interactively: server `connected`, 11 tools advertised, `check_numeric_claims`+`verify_arithmetic`+`finalize_deliverable` fired, `permission_denials: []`, exit 0, correct answer.
- Binding recovered: `answer_text_hash` + `plan_token`. Token ledger (input/output/cache/num_turns/cost) recovered from the top-level `usage`.
- Surfaced 4 findings → resolved in Amendment A (turn cap, per-turn token reconciliation withdrawn, arm-D env-gate, B happy-path gate).

### 2.3 A5 — arm-B happy-path (viability) → **PASS**
Evidence: `benchmark/phase4/a5_probe_summary.json`.
- 2 new credit-weighted-average tasks (transfer test, not the worked-example numbers) → **both reached finalize RELEASE** (verdict `PASS`, `trace_conclusion_numbers`+`verify_arithmetic` re-executed, answer bound), **correct** (80.63, 87.30), in **3 turns each**, ~$0.04–0.08.
- Conclusion: the strict finalize gate is satisfiable by Haiku with the worked-example `BIND_SYS`. Arm B is practical.

### 2.4 Calibration round 1 (lean Haiku k=8, failure-prone + clean-control, 200 arm-A calls)
Evidence: `benchmark/phase4/calibration_run.json`.
- Raw: failure-prone density **0.063** (tuning 0.000 / holdout 0.141); clean-control **0.143**.
- **Diagnosis: the "defects" were mostly measurement bugs, not model error.**
  - `source_span` oracle marked a *verbatim-correct* RAG answer wrong (gold_span `"50 per month"` ≠ `"$50 per month"` — currency adjacency). 8/8 false defects.
  - A constraint task was *refused/buried* under `SHARED_COT_SYS`; the structured oracle parsed nothing. 7/8.
  - Occasional numeric mis-extraction from verbose CoT despite a correct sentinel.
- **Underlying truth:** even modulo bugs, Haiku barely defects on bounded oracle tasks (the recurring wall).
- **Action:** Amendment B — fix the instrument first (re-measure cleanly), lower the band to [0.15, 0.40], elevate injected/repair to co-primary.

---

## 3. What changed this session

All new Phase-4 code lives under `benchmark/phase4/`; tests under `tests/`; design under `docs/`. The only `src/` change is the additive arm-D env-gate.

| File | Change |
|---|---|
| `src/server-runtime.ts` | **+ `CT_DISABLE_FINALIZE` env-gate** — pure `listAdvertisedTools(env)` helper; when set, the `ListTools` handler drops *only* `finalize_deliverable` (arm-D server advertises 10 vs B's 11). Additive; off by default; byte-identical when unset. |
| `src/mcp/tool-definitions.ts` | **+ "Use this when…" affordances** on the 9 analyzer tools (Cat-3, model-visible schema text); no behavior change (`dvp-p3-4`). |
| `src/enforcement/check_planner.ts` | **+ `inferTaskType` surfaced** as a host-enforcement-only task_type recommender (doc-comment only; `dvp-p3-4`). |
| `benchmark/oracles.ts` | (B1) source_span matcher made currency/punctuation-robust (`spanCore` edge-peeling; `$50`→`50`); distractor-laundering + missing-gold detection unchanged. |
| `benchmark/phase4/arm_adapter.ts` | **NEW** — unified stream-json adapter: `parseStreamJson`, `billedTokens` (cache-discount), `runArm` (spawn from tmpdir, no billed API, harness-side turn/output/wall hard-stop), `buildArmArgs`. |
| `benchmark/phase4/arms.ts` | **NEW** — `armConfig(A/B/C/D)` thin configs over the adapter. |
| `benchmark/phase4/prompts.ts` | **NEW** — `SHARED_COT_SYS`, `BIND_SYS` (worked example proven to RELEASE), `NOBIND_SYS` (single-clause delta), `WORKED_EXAMPLE_BUNDLE`. |
| `benchmark/phase4/render_checklist_sys.ts` | **NEW** — `CHECKLIST_SYS` rendered from the real tool-description source (±15% length guard). |
| `benchmark/phase4/stats.ts` | **NEW** — Wilson, Newcombe method-10, exact-binomial McNemar, cluster-by-base bootstrap (seeded), `proportionReport`. |
| `benchmark/phase4/corpus.ts` | **NEW** — `HARD_CORPUS` (30 tasks, 10/family, 8 binding-eligible) + `Phase4Task` type. (B1) constraint prompts → JSON-only (format-only). |
| `benchmark/phase4/label_map.ts` | **NEW** — `FROZEN_LABEL_MAP` (defect → §7 code). |
| `benchmark/phase4/grade_answer.ts` | **NEW** (B1) — type-aware `gradeArmAnswer` (numeric→sentinel, constraint→JSON, source_span→text, refusal→defect). |
| `benchmark/phase4/calibrate.ts` | **NEW** — arm-A k-sample calibration runner (now grades via `gradeArmAnswer`). |
| `benchmark/phase4/step1_smoke.mjs` | **NEW** — STEP-1 CLI→real-MCP smoke runner. |
| `benchmark/phase4/a5_probe.ts` | **NEW** — A5 arm-B happy-path probe. |
| `benchmark/phase4/report_gate_cis.ts` | **NEW** — re-reports `live_gate_score` with Wilson CIs. |
| `tests/host/finalize_env_gate.test.ts` | **NEW** — env-gate 10-vs-11 tool test. |
| `tests/benchmark/phase4_*.test.ts` | **NEW** — adapter, prompts, stats, corpus, oracle-robustness tests (~150+). |
| `docs/designs/PHASE4_PREREGISTRATION.md` | **NEW** — the hashed-before-run pre-registration + Amendments A & B. |
| `docs/PHASE4_STATUS.md` | **NEW** — this document. |
| `~/.claude/.../memory/feedback_token_not_dollar_accounting.md` | **NEW** memory — measure cost in tokens, not $. |

---

## 4. Tools available

### 4a. The ct-mcp product surface (11 tools + a CLI)
The "spine": 2 contract/gate tools wrap 9 analyzer primitives. **Only `finalize_deliverable` blocks**; standalone analyzer calls are advisory (finalize re-executes the unforgeable ones inline).

| Tool | What it does | Role |
|---|---|---|
| `plan_checks` | Given a `deliverable_contract` (task_type, evidence_level, risk_level), returns the obligations finalize will re-execute. Pure lookup. | Planner — **never blocks** |
| `finalize_deliverable` | **Keystone gate.** Re-executes the contract's required checks inline over the supplied artifacts; PASSES only on unforgeable within-artifact provenance and returns an `answer_text_hash` binding the answer to the checked ledger. | **Gate — blocks** |
| `check_numeric_claims` | Multi-signal numeric analysis: fabrication, outlier, and arithmetic verification. | Analyzer |
| `verify_arithmetic` | Re-derive each conclusion number from supplied inputs (sum/weighted_average/percentage/growth/product/…); blocks any that fails. | Analyzer (finalize re-runs) |
| `validate_reasoning_chain` | Map reasoning to a directed graph; flag circular reasoning, unsupported conclusions, orphaned claims; supports competing-hypothesis + rejected-option-reversal. | Analyzer |
| `detect_drift` | CUSUM drift detection over a numeric sequence with monotonic-progress tracking. | Analyzer |
| `evaluate_tradeoffs` | Compare options by Expected Utility and rank; status-quo-or-NA, dominated-under-declared-scoring. | Analyzer |
| `check_plan_validity` | Validate plan structure: circular deps, missing prerequisites, resource conflicts, on_failure branches. | Analyzer |
| `score_response_quality` | Score substance / specificity / hedge-avoidance / structure. | Analyzer |
| `validate_confidence` | Check a claimed confidence is mathematically supported by stated assumptions. | Analyzer |
| `detect_concurrency_patterns` | Flag concurrency hazards (check-then-act, read-modify-write, missing idempotency, ordering). | Analyzer |
| **`ct-enforce` (CLI)** | Host-side gate: reads a host-authored spec + artifacts on stdin, runs the gate, returns RELEASE/REJECT JSON (exit 0/1/2/3). The adoption vehicle. | Host gate |

### 4b. The Phase-4 ablation arms (what the experiment compares)
| Arm | Regime | Mechanism |
|---|---|---|
| **A** | answer-then-block | single-shot empty-MCP + `SHARED_COT_SYS`; oracle as post-hoc gate |
| **B** | forced artifacts **+ binding** | multi-turn real MCP (11 tools) + `BIND_SYS`; `finalize_deliverable` binds the answer |
| **C** | prompted checklist (control) | single-shot empty-MCP + `CHECKLIST_SYS`; no enforcement |
| **D** | forced artifacts, **no binding** | multi-turn real MCP (10 tools, `CT_DISABLE_FINALIZE`) + `NOBIND_SYS` |

Reads: B vs D = binding · D vs C = enforcement · C vs A = structure. Kills: C≈B → prompting+linting; B⊁D → binding inert.

### 4c. Phase-4 harness scripts (how to run things)
| Command | Purpose |
|---|---|
| `node benchmark/phase4/step1_smoke.mjs [--no-finalize]` | STEP-1 CLI→real-MCP smoke (arm B, or D-variant probe) |
| `node --import tsx benchmark/phase4/a5_probe.ts` | A5 arm-B happy-path RELEASE probe |
| `node --import tsx benchmark/phase4/calibrate.ts --k 8 --models haiku --suites failure-prone,clean-control` | arm-A defect-density calibration |
| `node --import tsx benchmark/phase4/report_gate_cis.ts` | re-report `live_gate_score` with Wilson CIs |

All model-calling scripts spawn the local `claude` CLI from a neutral cwd with `ANTHROPIC_API_KEY` deleted — **no billed API** (CLI session auth only).

---

## 5. Design decisions (this session)

**Phase-4 design (AskUserQuestion):** harden-corpus **+ repair** both · pilot→gated→standard · Haiku + small Sonnet · **multi-turn real MCP** for B/D.
**Cost framing (user correction):** de-dollarized — `net_value` in defect-equivalents, efficiency in `quality_per_1k_tokens` (tokens), USD cap is a non-binding backstop. (memory: token-not-dollar-accounting)
**Amendment A (post-STEP-1):** false-block = legitimate-repairable-block (oracle-strict reported as secondary) · turn cap from worked-example + pilot calibration · top-level usage ledger · arm-D src env-gate · B happy-path gate.
**Amendment B (post-calibration-round-1):** fix instrument first · band [0.30,0.60]→**[0.15,0.40]** · injected-defect + repair elevated to **co-primary** · natural ablation may be reported underpowered/all-tie-high (honest non-win).

---

*This document is a living snapshot. The Phase-4 experiment is **concluded** — see [`PHASE4_RESULTS.md`](PHASE4_RESULTS.md) for the verdict and [`designs/PHASE4_PREREGISTRATION.md`](designs/PHASE4_PREREGISTRATION.md) (Amendments A/B/C) for the audit trail. Authoritative gate: tsc clean · **855 tests** · claims-ledger pass (16 entries). Remaining: freeze/commit (awaiting sign-off).*
