# Phase 4 — STEP 1 (CLI→real-MCP smoke) findings

> **Date:** 2026-06-02 · **Verdict: FEASIBLE** (the B/D multi-turn-real-MCP mechanism works end-to-end through `claude -p`), **but with concrete calibration work + design revisions required before freeze.** Raw transcript: `benchmark/phase4/step1_smoke_B_raw.jsonl`. Runner: `benchmark/phase4/step1_smoke.mjs`.

## Environment confirmed
- `claude` CLI **2.1.160**; all required flags present: `--mcp-config`, `--strict-mcp-config`, `--allowedTools`, `--permission-mode`, `--output-format stream-json`, `--resume`, `--max-budget-usd`, `--model`. (No `--temperature`/`--seed` — confirms decode is not pinnable.)
- Built `dist/server.js` lists exactly **11 tools** over raw stdio.

## What PASSED (the make-or-break feasibility)
| Sub-check | Result |
|---|---|
| (a) server connects via CLI | ✅ `ct-mcp status=connected` |
| advertised tools | ✅ 11, includes `finalize_deliverable` |
| (b) tool_use fires; numeric recompute | ✅ `check_numeric_claims` (PASS) + `verify_arithmetic` called |
| (c) finalize returns binding | ✅ `answer_text_hash: 39fad8f4…`, `plan_token: ctmcp.plan_token.v1.4a5c…` |
| (d) token ledger recoverable | ✅ top-level `usage` {input 194, output 14890, cache_creation 83244, cache_read 1,380,230}, `num_turns 25`, `total_cost_usd 0.317` |
| (f) permission_denials | ✅ `[]` (with `--permission-mode acceptEdits` + `--allowedTools 'mcp__ct-mcp__*'`) |
| correctness | ✅ `FINAL ANSWER: 78.89` (oracle-correct) |

## What STEP 1 surfaced (must resolve before freeze)

### F1 — finalize_deliverable BLOCKed a CORRECT answer (the central finding)
The model answered 78.89 (correct) but declared `conclusion_numbers:[{value:78.89, op:"mean", input_refs:[80,70,95]}]`. The gate recomputed `mean(80,70,95)=81.67 ≠ 78.89` → **`NUMERIC_MISMATCH` BLOCK**, plus "8 numbers in answer not traced" and "required `verify_arithmetic` missing `arithmetic_checks`". The answer was right; the *declared proof was invalid* (plain mean, not credit-weighted). Per §1/§5 this is a **correct block of an unproven answer**, not a gate bug. It exposes a definitional fork (see decisions). The model then retried finalize **22×** without ever supplying a valid derivation → 25 turns, $0.32.

### F2 — harness-side turn cap is mandatory AND `max_turns=8` is likely too tight
No `--max-turns` flag exists; nothing stopped the 22-call loop. But `max_turns=8` would have cut the model off *before* it could build a valid derivation ledger. The cap must be reconciled with realistic artifact-construction cost + strong BIND_SYS guidance (see decisions).

### F3 — per-turn token reconciliation is NOT available from this CLI
Sum of assistant `message.usage.output_tokens` (128) ≠ top-level (14890); per-turn stream usage is streaming-delta, not billable. **The top-level `usage` is the authoritative ledger.** The prereg's "summed-per-turn == total" invariant (frozen-invariant #9) must be replaced with "top-level `usage` is authoritative; sanity-check `total_cost_usd` consistency." `cache_read` dominates cost (1.38M tokens) → `quality_per_1k_tokens` must weight cache at its billed discount, and the turn cap controls the blow-up.

### F4 — arm D needs a `src/` change
`CT_DISABLE_FINALIZE` is **not wired** (`grep` clean). Hiding `finalize_deliverable` for arm D is a small additive change at `src/server-runtime.ts:54` (the `ListToolsRequestSchema` handler) — but `src/` is outside `dvp-p4`'s declared `allowed_paths`.

## Decisions required before freeze — see the orchestrator's questions to the human.
1. **False-block definition** (F1): is "correct answer + invalid declared proof → BLOCK" a false-block (counted against the gate) or a legitimate repairable block?
2. **Turn-budget philosophy** (F2): BIND_SYS few-shot + pilot-calibrated cap, fixed generous cap, or count finalize-miss as a B defect?
3. **Scope** (F4): expand `dvp-p4` to the minimal `src/` change for the D variant, or realize D via a benchmark-side wrapper server.

## Decisions the orchestrator is taking (informed, not blocking)
- **Feasibility = PASS**; proceed to build (STEP 2+) after the above are resolved + frozen.
- Adopt **top-level `usage`** as the authoritative token ledger (F3); drop per-turn reconciliation; weight cache at billed discount in `quality_per_1k_tokens`.
- Add a **B happy-path calibration gate** before scoring: confirm that with good BIND_SYS a *correct* answer reliably RELEASEs (`ledger_completion ≥ 0.90`) within budget; if Haiku cannot produce re-executable derivations even with coaching, that is itself a reportable finding (B impractical for weak models), surfaced — not hidden.
- Pass `< /dev/null` to the CLI to avoid the 3s stdin wait.
