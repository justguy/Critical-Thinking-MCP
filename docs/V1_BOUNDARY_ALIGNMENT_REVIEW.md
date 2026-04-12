# V1 CT-MCP Boundary Alignment — Review Report

**Scope:** Three slices plus a validator/schema alignment fix, combined on a single integration branch.
**Reference:** `/Users/adilevinshtein/Documents/dev/Project-Phalanx/docs/CT_MCP_REQUIREMENTS.md`
**Base:** `orchestrator/v0-experimental-0.1.0-beta.2` @ `40929f1 Fix beta2 publish blockers`
**Integration branch:** `integration/ct-mcp-v1-boundary-alignment`
**Date of review:** 2026-04-12

## Status

**Ready for integration.** An earlier review round had shipped a pass-looking report while three contract gaps remained. Those three gaps were closed in a revision round, and a fourth residual gap — a minimum-value mismatch between the Phalanx envelope/schema and the underlying CT tool validators — was surfaced and is now also closed in this integration round. The merged state passes `npm test` (411 tests) and `npx tsc --noEmit` cleanly.

## Review Trail (oldest to newest)

1. **Initial round.** Three slices produced in isolated worktrees (Slice 1 envelope, Slice 2 R-2/R-5/R-8 non-ownership, Slice 3 R-3/R-4 non-ownership). Slices 2 and 3 were inadvertently cut from a pre-beta.1 base and were rebased onto beta.2 with no conflicts.

2. **Reviewer found three real gaps.** (a) Slice 3's hard-coded `toHaveLength(9)` would break after merging Slice 1's 10th tool (`integrate_phalanx_check`). (b) Slice 1's `validateCall` only checked the outer envelope; malformed nested payloads fell into the generic `catch` and soft-failed to WARN, contradicting the "Malformed Phalanx input → do not proceed" rule. (c) The public MCP schema exposed only 2 of the 4 declared sub-payloads; `steps` and `operations` were typed but not dispatched.

3. **Revision round closed all three.** Slice 1 got recursive sub-payload validation plus `steps`→`check_plan_validity` and `operations`→`detect_concurrency_patterns` dispatch. Slice 3's count assertion became `toBeGreaterThanOrEqual`. Integration verify showed 403 passing tests on the merged state.

4. **Reviewer found a residual alignment gap.** The Phalanx envelope/schema still had looser minimums than the underlying CT tool validators on four fields: `assumptions.response_text` (tool: ≥10, envelope: ≥1), `claims.nodes` (tool: ≥2, envelope: ≥1), `claims.edges` (tool: ≥1, envelope: 0 allowed), `steps.steps` (tool: ≥2, envelope: ≥1). That meant malformed Phalanx inputs at those boundary values could still bypass envelope rejection and soft-fail to WARN at the tool layer.

5. **This integration round closed the residual alignment gap.** All four minimums now match exactly in both `envelope.ts validateCall` and the MCP schema on `integrate_phalanx_check`. Eight new tests lock the alignment in. Final count: 411 tests, type-check clean.

## Branches

| Slice | Branch | Head (latest) |
|---|---|---|
| 1 Integration envelope (revised) | `boundary/slice1-phalanx-contract` | `0cdfb8e` |
| 2 R-2/R-5/R-8 non-ownership | `boundary/slice2-non-ownership-r2-r5-r8` | `f0dbc4a` |
| 3 R-3/R-4 non-ownership (revised) | `boundary/slice3-non-ownership-r3-r4` | `11d55c6` |
| **Integration** (merged + alignment fix) | **`integration/ct-mcp-v1-boundary-alignment`** | (see final HEAD below) |

## Residual Validator/Schema Alignment — Closed

| Field | Prior envelope/schema minimum | Underlying CT tool minimum | New envelope/schema minimum |
|---|---|---|---|
| `assumptions.response_text` | length ≥ 1 (non-empty) | length ≥ 10 (`validate_confidence`) | length ≥ 10 |
| `claims.nodes` | ≥ 1 | ≥ 2 (`validate_reasoning_chain`) | ≥ 2 |
| `claims.edges` | array only; 0 allowed | ≥ 1 (`validate_reasoning_chain`) | ≥ 1 |
| `steps.steps` | ≥ 1 | ≥ 2 (`check_plan_validity`) | ≥ 2 |

Enforced in:

- `src/integration/phalanx/envelope.ts` — `validateAssumptions`, `validateClaims`, `validateSteps`.
- `src/mcp/tool-definitions.ts` — `integrate_phalanx_check.inputSchema.properties.payload.properties.{assumptions, claims, steps}`.

Verified in `tests/integration/phalanx_envelope.test.ts` by the `CT tool minimum alignment — pre-dispatch rejection` describe block (8 tests): four rejection assertions for values below the new minimums, three positive assertions that values at the minimum accept, and one combined assertion that no tool invoker is called across any of the four rejection paths.

## Requirement-by-Requirement Review

### R-1 Middleware identity (Phalanx owns)

ct-mcp does not claim middleware identity. `integrate_phalanx_check` is a signal source; its `CtVerdict` feeds Phalanx's own state-machine gate. Slice 1's contract doc is explicit.

### R-2 Rebuttal loop (Phalanx owns)

Five banned rebuttal tool names asserted absent from the TOOLS registry (Slice 2). Doc `docs/PHALANX_NON_OWNED_R2_R5_R8.md` names `validate_reasoning_chain` as the most tempting misuse vector and documents why it is not a rebuttal cap enforcer.

### R-3 Deterministic proof classification (Phalanx owns)

Four banned R-3 tool names and four banned R-3 input properties asserted absent (Slice 3). Doc ties non-ownership to ct-mcp's lack of repo I/O and test-source parsing.

### R-4 Canonical truth (Phalanx owns)

Seven banned R-4 tool names and six banned R-4 input properties asserted absent (Slice 3). Doc ties non-ownership to non-negotiable constraint #2 (statelessness).

### R-5 Hallucinated seam detection (Phalanx owns)

Three banned seam-grounding tool names asserted absent (Slice 2). `score_response_quality.description` carries the disclaimer *"Entity grounding here is scoped to response-text entities; NOT repo-level seam, symbol, or file-existence checking (see Phalanx R-5)."*, asserted inline. Seven banned repo-grounding input properties asserted absent.

### R-6 Confidence ceiling (ct-mcp owns)

Envelope dispatches `validate_confidence` when `payload.assumptions` is present. `validateAssumptions` enforces structure AND minimum `response_text` length 10 pre-dispatch.

### R-7 Reasoning chain (ct-mcp owns)

Envelope dispatches `validate_reasoning_chain` when `payload.claims` is present. `validateClaims` enforces structure, edge endpoint resolution, minimum 2 nodes AND minimum 1 edge pre-dispatch.

### R-8 Retry drift (Phalanx owns)

Four banned contract-drift tool names asserted absent (Slice 2). `detect_drift.description` carries the disclaimer *"Numeric-series drift only; NOT a retry-contract drift detector (see Phalanx R-8)."*, asserted inline. Eight banned contract-shaped input properties asserted absent.

### Additional planning-phase coverage

`check_plan_validity` (via `payload.steps`, minimum 2) and `detect_concurrency_patterns` (via `payload.operations`, minimum 1 step) are both listed in the requirements doc's "Role in the Phalanx Pipeline" → PLANNING row. Both now dispatch through the envelope with pre-dispatch validation matching their underlying tool minimums.

## Non-Negotiable Constraints

| # | Constraint | Status | Evidence |
|---|---|---|---|
| 1 | Deterministic | PASS | `computeObjectionId` is SHA-256 over a fixed order; `buildMechanismVersions` is pure; no sampling. Stability asserted by tests. |
| 2 | Stateless | PASS | No module-level mutable state in the integration module; `toolInvoker` passed per call. |
| 3 | Structured input only | PASS | `PhalanxCtCall` and all four sub-payloads validated via dedicated typed validators. Minimums now match the underlying tools. |
| 4 | Fast enough | PASS (no load test) | Envelope is a thin mapping layer; one await per invoked tool. Staging benchmark recommended before Phalanx adoption. |
| 5 | No false-positive drift | PASS | 411 tests pass on the integration merge; no regression vs beta.2. |
| 6 | No capability inflation | PASS | 45+ CI-enforced boundary assertions across Slices 2 and 3; disclaimers inline on confusable tool descriptions. |

## Contract Fidelity

### Input envelope — `PhalanxCtCall`

TS types (`src/integration/phalanx/types.ts:83–89`) match the requirements doc verbatim.

MCP public schema (`src/mcp/tool-definitions.ts` `integrate_phalanx_check`) exposes all four sub-payloads and mirrors the envelope's validation minimums (`response_text.minLength: 10`, `nodes.minItems: 2`, `edges.minItems: 1`, `steps.minItems: 2`).

Envelope `validateCall` enforces the outer shape and every sub-payload structure pre-dispatch, throwing `PhalanxContractInputError` with a descriptive field path on violation. The outer `try/catch` explicitly re-throws `PhalanxContractInputError`; only transport/invocation errors soft-fail to WARN.

### Output verdict — `CtVerdict`

Matches the requirements doc verbatim. Every field wired end-to-end.

## Failure Modes

| Failure | Required behavior | Implementation | Status |
|---|---|---|---|
| Transport error / tool throws | Soft-fail WARN; do not block | `failure.ts` returns WARN verdict; envelope catches only non-`PhalanxContractInputError` errors | PASS |
| Malformed `PhalanxCtCall` (outer OR nested OR minimum-violating) | Throw; do not proceed | `validateCall` + four sub-payload validators throw pre-dispatch with field path | PASS |
| ct-mcp tool used outside honest scope | Treat as integration bug | CI-enforced boundary assertions + inline disclaimers | PASS |
| Beta capability churn | Staging benchmark before adoption | `mechanism_versions` pinning + contract doc covers upgrade discipline | PASS (enforcement on Phalanx side) |

## Versioning

`mechanism_versions: Record<string, string>` keyed by invoked tool name, pinned to `SERVER_INFO.version` (`"0.1.0-beta.2"`). `buildMechanismVersions` supports an optional per-tool `overrides` map for future per-mechanism pinning.

## Success Criteria

1. *"CT-MCP only invoked for responsibilities it can honestly support today."* **PASS** — four production-ready tools wired (`validate_confidence`, `validate_reasoning_chain`, `check_plan_validity`, `detect_concurrency_patterns`).
2. *"Phalanx-owned V1 responsibilities are not blocked on CT-MCP roadmap items."* **PASS** — non-ownership boundaries for R-2/R-3/R-4/R-5/R-8 are CI-enforced.
3. *"`validate_confidence` and `validate_reasoning_chain` remain cleanly integrated and do not drift."* **PASS** — wrapped without source modification; input shapes preserved; envelope minimums now match their native minimums.
4. *"Minor-version CT-MCP upgrades always pass a staging benchmark before branch adoption."* **PASS (documented)** — `mechanism_versions` in every verdict enables Phalanx-side pinning.

## Remaining Non-Blocking Follow-ups

1. **`claim_ref` not populated.** Optional per spec; wire it when a blocking issue ties to a specific `ClaimNode.id` or an assumption hash.
2. **Warning-mechanism naming is synthesized.** Envelope uses `${toolName}_warning` when a tool emits unstructured warnings. Surface real mechanism names from the underlying tool in a follow-up when structured warnings ship.
3. **JSON Schema cast for nullable `piece_id`.** Uses `type: ['string', 'null'] as unknown as 'string'`. Replace with `oneOf` if the MCP SDK ever validates schemas strictly.
4. **Slice 3 output-shape guard skipped.** No unified output-type registry exists. Add the assertion if a registry is introduced.
5. **Slice 2 Zod strict-parsing skipped.** Disproportionate to introduce only for guardrails.
6. **`score_response_quality.context` scope note.** A one-line doc note calling out the `context` object's enforcement-loop scope could close a minor secondary confusion vector.
7. **Staging benchmark against Phalanx.** Owned by Phalanx; flagged here so it is not forgotten at adoption time.

---

## Post-Integration Hardening Pass

**Branch:** `ct/post-phalanx-integration-hardening`
**Base:** `integration/ct-mcp-v1-boundary-alignment` @ `834ef59`
**Date:** 2026-04-12

This section distinguishes what was already integration-ready at the `834ef59` merge point versus what was improved in a dedicated hardening pass while Phalanx begins integration.

### What Was Already Integration-Ready (at 834ef59)

All items in "Remaining Non-Blocking Follow-ups" (numbered 1–7 in the earlier section) were explicitly non-blocking. Phalanx could integrate immediately against `834ef59`. The following were stable and complete:

- Envelope contract: input validation, sub-payload dispatch for all four tools, pre-dispatch rejection of minimum-violating inputs (matching underlying CT tool validators exactly)
- Boundary assertions for R-2, R-3, R-4, R-5, R-8 non-ownership: all CI-enforced
- `CtVerdict` output shape: deterministic `objection_id` (SHA-256), `claim_ref` field present in type (though unpopulated), `mechanism_versions` per-tool pinning
- Transport soft-fail: `WARN` verdict + `phalanx_ct_mcp_transport` objection, never re-throws
- `integrate_phalanx_check` MCP tool: all four sub-payloads exposed in public schema with correct minimums

### What This Hardening Pass Improved

**Slice A — `claim_ref` populated honestly (done)**

`claim_ref` was typed but always unset. Now:
- `mapToolResultToObjections` passes through `claim_ref` from raw blocking issues when the tool supplies one. The `computeObjectionId` hash includes `claim_ref || ''` for stability.
- `validate_reasoning_chain` populates `claim_ref` on `cycle_detection` (first cycle node id) and `orphan_detection` (first orphaned node id) blocking issues.
- `validate_confidence` populates `claim_ref: 'assumption:<index>'` on inflation/falsification blocking issues anchored to the first offending assumption.
- `claim_ref` remains absent when a blocking issue has no honest node-level anchor (e.g., `consistency` violations).

**Slice B — Structured warning mechanism names (done)**

`mapToolResultToObjections` previously used `${toolName}_warning` for all warnings. Now:
- Tools can additively emit `warning_issues: Array<{mechanism, description}>` alongside `warnings: string[]`.
- The adapter promotes structured `warning_issues` to stable mechanism keys.
- Plain string `warnings` still fall back to `${toolName}_warning` — fully backward-compatible.
- Tests assert both paths.

**Slice C — Clean `piece_id` JSON Schema (done)**

`integrate_phalanx_check.inputSchema.properties.piece_id` previously used `type: ['string', 'null'] as unknown as 'string'` (an unsafe cast workaround). Replaced with `oneOf: [{ type: 'string' as const }, { type: 'null' as const }]`. Runtime behavior unchanged. `npx tsc --noEmit` clean — no unsafe casts introduced.

**Slice D — Clarify `score_response_quality.context` scope (done)**

`docs/PHALANX_INTEGRATION_CONTRACT.md` now has an explicit `## context Object Scope` section stating that the `context` field on all CT-MCP tools is enforcement-loop metadata only (fields like `previous_response_text`, `previous_response_hash`, `iteration_number`), not repo-grounding or seam-validation input. The `score_response_quality` tool definition's `context` property description in `src/mcp/tool-definitions.ts` also notes this inline. The R-5 boundary assertion in `tests/boundary/non_ownership_r2_r5_r8.test.ts` (`disclaimer strings present in tool descriptions`) continues to pass.

**Slice E — Narrow output-shape guard (done)**

Added adapter-level fixture assertions in `tests/integration/phalanx_envelope.test.ts` (`output-shape guard — adapter consumes tool output shapes correctly` describe block). Asserts that `mapToolResultToObjections` correctly consumes ENFORCEMENT_FAIL and PASS shapes for all four envelope-supported tools (`validate_confidence`, `validate_reasoning_chain`, `check_plan_validity`, `detect_concurrency_patterns`), plus verifies correct `claim_ref` pass-through for the reasoning-chain fixture. Stays narrow — no registry added.

### Hardening Pass Verification

- Test count: 411 → 425 (+14 new tests)
- `npm test`: 425/425 passing, 25 test files
- `npx tsc --noEmit`: clean
- Boundary suite: 37/37 passing (no assertions loosened)
- `integrate_phalanx_check` contract minimums unchanged: `response_text ≥ 10`, `claims.nodes ≥ 2`, `claims.edges ≥ 1`, `steps.steps ≥ 2`
- No new dependencies added

### Remaining Non-Blocking Follow-ups (Post-Hardening)

1. **Staging benchmark against Phalanx.** Owned by Phalanx; flagged here so it is not forgotten at adoption time.
2. **Slice 2 Zod strict-parsing.** Still disproportionate to introduce; remains deferred.
3. **`validate_confidence` warning-to-`warning_issues` migration.** The `validate_confidence` tool still emits only plain-string `warnings[]`. A future pass could emit `warning_issues: [{mechanism: 'falsifiability', ...}]` from the tool directly (rather than relying on Phalanx to pattern-match). This is a pure improvement, not a correctness gap.

---

## Merge Guidance

The integration branch `integration/ct-mcp-v1-boundary-alignment` already contains all three slices plus the minimum-alignment fix on top of beta.2 HEAD. It merges cleanly; `npm test` and `npx tsc --noEmit` are both green. Fast-forward or merge it into the target branch.

## Worktrees Cleanup

After merging:

```sh
git -C /Users/adilevinshtein/Documents/dev/ct-mcp worktree remove .claude/worktrees/agent-a37f45c0
git -C /Users/adilevinshtein/Documents/dev/ct-mcp worktree remove .claude/worktrees/agent-a9a04868
git -C /Users/adilevinshtein/Documents/dev/ct-mcp worktree remove .claude/worktrees/agent-a88c84ee
git -C /Users/adilevinshtein/Documents/dev/ct-mcp worktree remove .claude/worktrees/integration-verify
git -C /Users/adilevinshtein/Documents/dev/ct-mcp worktree remove .claude/worktrees/integration-ready
```
