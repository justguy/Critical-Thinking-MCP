# Deliverable-Centric Robustness — Implementation (built + verified)

> **Status:** implemented in the working tree (uncommitted), 2026-05-30. **Verified:** `tsc --noEmit`
> clean; `npm test` → **259 passed** (101 new + 158 existing), incl. freshness suite green under
> `TZ=Asia/Tokyo`; stdio MCP server lists **17 tools** (8 with `outputSchema`) and returns
> `structuredContent`. **Covers all build-sequence steps (0–8)** in
> [`robustness-additions.md`](robustness-additions.md): schema foundation, marker precision split,
> factual-QA slice, host contract + freshness, constraints, numeric tracing, Tier-2 hardenings, and
> structural checks. Each phase was adversarially reviewed by subagents/workflows; every confirmed bug was
> fixed and regression-tested.
>
> **Step 4 added:** `check_freshness` (pure interval arithmetic over a caller-supplied `eval_time`; no
> server clock) + the host-integration contract (below). `finalize_deliverable` re-executes freshness
> inline when `contract.freshness` is set. Adversarial subagent review caught a **determinism bug** —
> offset-less ISO datetimes (`"…T00:00:00"` with no `Z`) were parsed in the host's local timezone — now
> rejected; regression-tested across timezones.
>
> **Steps 5–6 added:** `check_answer_against_constraints` (restate-and-diff predicate eval) and
> `trace_conclusion_numbers` (re-derivation). `finalize_deliverable` now re-executes **any**
> `finalize_required` check inline (grounding, number tracing, constraints), blocking when a required
> check's inputs are absent. Both new tools passed a per-tool adversarial subagent review; the confirmed
> bugs were fixed + regression-tested:
> - **trace tolerance bug** — the denominator was floored at 1, turning relative tolerance into a loose
>   absolute window for sub-unit numbers (a real bypass). Fixed to true relative tolerance + tiny epsilon.
> - **constraints `in`-list anchor** — numeric arrays were stringified to `"100200"`, causing false blocks.
>   Fixed to per-element extraction.
> - **constraints `==`/`!=`** — number-vs-string asymmetry (`100` vs `"100"`). Fixed via `normScalar` coercion.
> - plus arity enforcement (ratio/pct_of=2 refs, literal/identity=1, no `op`), numeric omission comparison,
>   decimal-only `toNumber`, and an empty-field-name regex guard.
>
> **Known honest limits left in place** (deterministic ceilings, not bugs): the constraint `source_quote`
> numeric anchor can be satisfied by an incidental number (e.g. `100` from `100%`) — it makes misstatement
> costly, not impossible; an agent can still omit the constraint that would fail (the documented anti-omission
> ceiling); `diff`/`ratio` `input_refs` are order-sensitive by design.
>
> Discipline held throughout: **BLOCK only on unforgeable within-request signals** (verbatim
> containment, re-execution); everything self-declared is **WARNING**.

## What shipped

The end-to-end factual-QA loop:

```
plan_checks(contract)            → which checks this deliverable needs (pure lookup; never blocks)
check_quote_grounding(...)       → verbatim span containment per claim (BLOCK on fabrication)
check_claim_coverage(...)        → advisory coverage report (never blocks)
finalize_deliverable(...)        → RE-RUNS grounding + substring gates inline (the keystone BLOCK)
```

## Files

### New (`src/`)
| File | Purpose |
|---|---|
| `src/enforcement/check_planner.ts` | `planChecks(contract)` + `inferTaskType()`. Static profile map + policy. `UNFORGEABLE_CHECKS` set gates what may be promoted to blocking / enter `finalize_required`. |
| `src/tools/check_quote_grounding.ts` | Span-in-source + token-in-span containment; `claim_kind` support rules; `source_manifest_hash` + per-claim `claim_witness` (binding tokens, not blocks). |
| `src/tools/check_claim_coverage.ts` | Advisory. Declared-coverage (self-reported) + auto-detected unaccounted claim-like spans (stop-listed). Always `PASS`. |
| `src/tools/plan_checks.ts` | Thin wrapper over `planChecks`. Always `PASS`. |
| `src/tools/finalize_deliverable.ts` | Keystone. Re-runs grounding inline; `must_include`/`must_not_include`/numeric-criterion substring gates; `answer_text_hash` binding token; `contract_strength` warning. |

### Edited (`src/`)
| File | Change |
|---|---|
| `src/enforcement/types.ts` | Added `DeliverableContract`, `SourceManifestEntry`, `GroundingClaim`, `ClaimKind`, `AcceptanceCriterion`, `PlanResult`, etc. (additive). |
| `src/enforcement/utils.ts` | Added `normalizeWhitespace`, `sha256Hex` (`node:crypto`), `canonicalJson`, `extractNumericTokens`. |
| `src/mcp/tool-call.ts` | Registered 4 handlers; both response branches now also return `structuredContent` (MCP 2025-06-18) alongside the backward-compat text block. |
| `src/mcp/tool-definitions.ts` | 4 new `TOOLS` entries with `inputSchema` **and** `outputSchema`. |

### Tests / fixtures
| File | Purpose |
|---|---|
| `tests/fixtures/factual_qa/golden_grounding.json` | Golden grounding input. |
| `tests/fixtures/factual_qa/golden_finalize.json` | Golden finalize input (contract + answer + sources + claims). |
| `tests/tools/factual_qa_slice.test.ts` | 16 tests: golden paths + adversarial (fabricated span, swapped number, trimmed answer, ungrounded contract claim, weak contract). |

## The `plan_checks` profile map (as built)

Source of truth: `src/enforcement/check_planner.ts`.

```ts
const PROFILE_MAP = {
  factual_qa:        { required: ['check_quote_grounding','check_claim_coverage'], optional: ['check_freshness','validate_confidence'] },
  numeric_analysis:  { required: ['trace_conclusion_numbers','verify_arithmetic'], optional: ['check_numeric_claims','check_dimensional_consistency'] },
  planning:          { required: ['check_plan_validity'],          optional: ['check_precondition_coverage','validate_reasoning_chain'] },
  decision:          { required: ['evaluate_tradeoffs'],           optional: ['validate_confidence','check_belief_revision','check_quote_grounding'] },
  concurrency_design:{ required: ['detect_concurrency_patterns'],  optional: ['check_plan_validity'] },
  reasoning:         { required: ['validate_reasoning_chain'],     optional: ['validate_confidence','check_claim_coverage'] },
  freeform:          { required: ['score_response_quality'],       optional: [] },
};

// Only these may be promoted to BLOCK / enter finalize_required (fail-signal is unforgeable):
const UNFORGEABLE_CHECKS = new Set([
  'check_quote_grounding','trace_conclusion_numbers','verify_arithmetic',
  'check_answer_against_constraints','check_freshness',
]);
```

Policy: `evidence_level` `cited`/`rederived` makes grounding blocking; `risk_level` `medium`/`high`
promotes unforgeable required checks to blocking; `high` pulls the first unforgeable optional into
required. `finalize_required` = required ∩ blocking ∩ unforgeable. (`check_claim_coverage` is **never**
in `finalize_required` — it's forgeable/advisory.)

## How to run / reproduce

```bash
npm run build            # tsc → dist/
npm test                 # vitest run → 174 passed
npx vitest run tests/tools/factual_qa_slice.test.ts   # just the slice (16)
```

Smoke-test the live stdio server (initialize → tools/list → tools/call):
```bash
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"s","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
 | node dist/server.js
# → 13 tools; plan_checks/check_quote_grounding/check_claim_coverage/finalize_deliverable carry outputSchema
```

## Honest limits (carried from the design)

- **Internal grounding, not truth.** The agent supplies the sources; containment proves it copied real
  text from its own corpus and pointed at the right token — not that the source is correct.
- **`finalize` re-executes; it does not trust hashes.** No `witness_hash` chain. `answer_text_hash` and
  `source_manifest_hash` are binding tokens for the host to compare, never proof a check ran.
- **`contract_authority`/`profile_source` are unverifiable by a pure fn** → surfaced as
  `contract_strength` WARNING, never a gate. Strong guarantees require the **host** to author the contract.
- **Adoption is host-side.** A non-cooperating agent can skip `finalize` or pass a trimmed `answer_text`;
  the `answer_text_hash` lets the host detect the latter. Enforcement = host honoring `ENFORCEMENT_FAIL`.

## Host integration contract (step 4)

ct-mcp tools are model-controlled — the protocol can't force the agent to call them, and a pure
function can't verify who authored its inputs or read a clock. So four obligations live **host-side**;
ct-mcp gives the host the structural hooks to meet them:

1. **Host authors (or derives) the `deliverable_contract`.** If the agent authors it, `finalize` returns
   `contract_strength: "weak_agent_declared"` — the host should treat that as not-releasable for
   high-stakes work. The strong contract is one the host builds from the user request and passes in.
2. **Host supplies `eval_time` with `authority: "host"`.** Only then can `check_freshness` BLOCK; an
   agent-supplied time is warning-only. Use ISO-8601 with `Z`/offset or epoch-ms (offset-less datetimes
   are rejected as non-deterministic).
3. **Host verifies `answer_text_hash`.** `finalize` returns `sha256(normalize(answer_text))`; the host
   recomputes it over the answer it actually surfaces and refuses to ship on mismatch — this closes the
   "called `finalize` with a trimmed answer" gap.
4. **Host gates release on `finalize` PASS.** A system-prompt / harness rule ("no final answer until
   `finalize_deliverable` returns PASS") or the experimental orchestrator is the actual enforcement;
   ct-mcp makes "done" *checkable*, the host makes it *mandatory*.

Reference loop the host runs per deliverable:

```
contract = derive_contract(user_request)            # authority: host
plan     = plan_checks(contract)                     # which checks are required
... agent produces answer + grounding artifacts ...
verdict  = finalize_deliverable({ contract, answer_text, eval_time: {value, authority:'host'},
                                  sources, claims, inputs, conclusion_numbers, constraints,
                                  structured_answer })
if verdict.status != 'PASS': reject / send corrective_prompt back to the agent
if sha256(normalize(surfaced_answer)) != verdict.answer_text_hash: reject   # anti-swap
release(surfaced_answer)
```

## Deliberately out of this slice

- Tier-2/3 hardenings (steps 7–8): confidence-extraction + hedge contradiction, falsification↔assumption
  binding, tautology guard, case partition, premise usage, redundant evidence, plan failure branches.
- **Marker precision split** (`utils`): still pending — needed before any **marker-based** BLOCK ships
  (the Tier-2 falsifiability/tautology items). The numeric `claim_kind` bug found earlier (`"p99"` leaking
  a `99`) and the freshness timezone bug were both this class of issue caught by review.

## Next steps

1. **Tier-2 hardenings (step 7)** — modify existing public tools (`validate_confidence`,
   `score_response_quality`), so do the marker precision split first and keep the circumvention tests green.
2. Migrate the existing 9 tool definitions to a shared `CONTEXT_SCHEMA` constant (deferred to keep these
   slices surgical — the new tools already avoid the 80-line copy).
3. Add a clean-control fixture set + wire a pre-merge clean-control replay before any marker-based BLOCK.
