# Claude Orchestrator Execution Report

**Date:** 2026-04-09
**Branch:** `orchestrator/v0-experimental-0.1.0-beta.2`
**Package version:** ct-mcp 0.1.0-beta.2
**Prompt files:** `CLAUDE_ORCHESTRATOR_IMPLEMENTATION_PROMPT.md`, `CLAUDE_ORCHESTRATOR_VERIFICATION_PROMPT.md`

## 1. Overall Status

**MATERIALLY ALIGNED, BUT NOT FULLY SIGNED OFF — the implementation appears to satisfy the prompt's core constraints, and the recorded focused verification passed, but the evidence here is still targeted rather than exhaustive.**

- `npm run build` passes (clean compile, zero errors).
- 44/44 orchestrator tests pass across the 4 required test files.
- All 3 CLI verification commands exit 0 and produce correctly-shaped machine-readable JSON.
- The recorded verification run reports all 4 adversarial checks passing:
  - Corrupted fixture halts before any tool call (schema failure).
  - Iteration-2 with prior failure escalates to `HUMAN_REVIEW` instead of re-emitting `REVISE`.
  - Routed vs shadow comparison on the mixed fixture confirms shadow mode adds findings without changing the routed decision (`policy_decision: "WARN"` in both, `would_have_escalated: true` only in shadow).
  - README wording explicitly disclaims workflow-engine / control-plane / production framing.

The layer is correctly scoped as an experimental internal module. It is **not** wired into the MCP server, does **not** add new public tools, does **not** introduce provider SDKs, does **not** maintain hidden memory, and does **not** contain any prose-rescue parser.

Status: **reasonable experimental candidate, with the most obvious routed-mode and test-coverage gaps now closed, but still not a high-confidence sign-off**. The current evidence supports continued internal experimentation, not broad claims of exhaustive validation. See §8 and §10 for the main remaining testing and productization gaps.

## 2. Implementation Summary

The orchestrator is a TypeScript-first module under `src/orchestrator/` that accepts a versioned JSON envelope and dispatches structured contracts to the existing 5 orchestrator-eligible deterministic tools. It has 6 responsibilities:

1. **Envelope validation** (`schemaValidation.ts`) — Ajv 8 validators compiled once. Rejects malformed envelopes and per-route contracts before any tool invocation.
2. **Routing** (`router.ts`) — reuses the existing deterministic `classifyClaim()` from `src/enforcement/claim_classifier.ts`. The router projects classifier suggestions onto the 5-tool orchestrator surface, adds a small adjacent deterministic mapping from classifier type to internal route family where needed (`architectural -> check_plan_validity`, `safety -> detect_concurrency_patterns`), and intersects that eligible set with the contracts actually supplied. Tools whose matching contract is absent are dropped.
3. **Contract mapping + execution** (`review.ts`) — thin pass-through shapers that map a validated contract onto the existing tool handler signatures (`handleValidateConfidence`, `handleValidateReasoningChain`, `handleCheckPlanValidity`, `handleDetectConcurrencyPatterns`, `handleScoreResponseQuality`). No field invention, no regex rescue.
4. **Policy** (`policy.ts`) — produces `PASS | WARN | REVISE | HUMAN_REVIEW`. Hard rule: iteration 1 failure → `REVISE`; iteration ≥ 2 failure → `HUMAN_REVIEW`. No second revise loop is possible.
5. **Shadow telemetry** (`shadowTelemetry.ts`) — observational. Records routed_tools, artifact_compatible_tools, tools_executed, tools_executed_only_in_shadow, shadow_only_findings, schema_failures, policy_decision, iteration_number, would_have_escalated. Never leaks back into the policy layer.
6. **CLI harness** (`cli.ts`) — `node --import tsx src/orchestrator/cli.ts --input <envelope> --mode routed|shadow [--out <file>]`.

Key invariants preserved:
- ct-mcp remains stateless per tool call; orchestration state lives in explicit `review_context`.
- The 9 public MCP tools are unchanged. `src/mcp/tool-call.ts` and `src/server.ts` were not modified.
- Ajv is already a repo dependency (`ajv@^8.18.0`, `ajv-formats@^3.0.1`). No new dependencies were added.
- No LLM calls anywhere in the orchestrator.
- `additionalProperties: false` is set at every level of every contract schema to prevent silent drift.

## 3. Findings (severity-ordered)

### Critical
None.

### High
None.

### Medium

**M1. Classifier is heuristic, so routing quality is still bounded by regex patterns.**
`src/orchestrator/router.ts` delegates routing to `classifyClaim` in `src/enforcement/claim_classifier.ts`. The classifier is pattern-based (see `TYPE_PATTERNS` around `src/enforcement/claim_classifier.ts:34`) and can mis-classify realistic answer text. The router now closes the most obvious dead zones by adding an adjacent deterministic mapping for orchestrator-internal families (`architectural -> check_plan_validity`, `safety -> detect_concurrency_patterns`), so plan and concurrency contracts are no longer shadow-only by construction. But routed-mode coverage still depends on the classifier producing the right type signals in the first place. This remains the main reason shadow mode exists.

**M2. Classifier confidence is exposed but unused by the policy layer.**
`router.ts` returns `classifier_confidence` in its `RouterResult`, but `policy.ts` never reads it. Low-confidence routing is not flagged as a warning. For v0 this is acceptable because policy is driven by deterministic tool output, not by router self-reported confidence — but it is a known gap the report should flag.

**M3. The verification evidence is focused, not exhaustive.**
The recorded checks are useful and materially better than the earlier snapshot: 4 orchestrator-specific test files, 44 tests, 3 CLI runs, and 4 adversarial/manual checks. The previously called-out gaps around caller-side 2-iteration flow, dedicated concurrency-route execution, multi-failure live-path coverage, CLI `--out` writing, and README/ROADMAP framing drift are now covered. But this is still targeted verification, not broad exhaustion. That supports "experimental and promising," not "thoroughly tested."

### Low

**L1. Envelope contract keys are fixed strings.**
`src/orchestrator/contracts.ts` defines `CONTRACT_KEY_TO_TYPE` with literal keys `confidence | reasoning_chain | plan | concurrency | quality`. This matches the prompt, but it means adding a new contract family requires editing two tables (`TOOL_TO_CONTRACT` and `CONTRACT_KEY_TO_TYPE`). Non-blocking.

**L2. `tools_executed` excludes schema-failed tools.**
In `src/orchestrator/shadowTelemetry.ts`, `tools_executed` intentionally filters out `SchemaFailure` entries because the deterministic tool did not run. Schema failures are surfaced via `telemetry.schema_failures`. This is correct per the prompt ("schema failure must stop the route before any tool call") but a reader skimming telemetry might expect `tools_executed` to double as an attempt counter. The field name is honest about execution.

**L3. Envelope top-level schema failure short-circuits routing.**
`runOrchestrator` in `src/orchestrator/index.ts` short-circuits on envelope validation failure and returns an `envelopeFailureResult` with `route_results: []`. This is correct fail-fast behavior. Flagged here only so a future reader understands why `route_results` is empty in that case.

### Nits

**N1. TypeScript interop for Ajv default export.**
`src/orchestrator/schemaValidation.ts` has a defensive default-export unwrap (`((AjvImport as any).default) ?? AjvImport`). This matches the existing pattern in `benchmark/invisible-tea-party/ts/src/schemaValidation.ts` and is necessary under `module: Node16`. It looks a bit ugly but is repo-consistent.

**N2. Two test files intentionally use "60% confident" in response text.**
`tests/orchestrator/orchestrator_shadow_mode.test.ts` uses a low claimed confidence so that `validate_confidence` passes cleanly — the test goal is to assert shadow mode does not escalate the routed decision. The assumption confidences (0.9 + 0.9) are intentionally chosen so the product exceeds the claimed value. Documented inline in the test file.

## 4. Files Changed

### Created (19)
```
src/orchestrator/types.ts
src/orchestrator/contracts.ts
src/orchestrator/schemaValidation.ts
src/orchestrator/router.ts
src/orchestrator/policy.ts
src/orchestrator/review.ts
src/orchestrator/shadowTelemetry.ts
src/orchestrator/index.ts
src/orchestrator/cli.ts
src/orchestrator/fixtures/confidence_inflation.json
src/orchestrator/fixtures/circular_reasoning.json
src/orchestrator/fixtures/structured_plan.json
src/orchestrator/fixtures/concurrency_flow.json
src/orchestrator/fixtures/mixed_shadow_mode.json
tests/orchestrator/orchestrator_schema_validation.test.ts
tests/orchestrator/orchestrator_routing.test.ts
tests/orchestrator/orchestrator_policy.test.ts
tests/orchestrator/orchestrator_shadow_mode.test.ts
docs/reports/claude_orchestrator_execution_report.md
```

### Modified (2)
```
README.md    — added "## Experimental: Internal Orchestrator (v0)" section + honest "What this is not" list
ROADMAP.md   — added experimental orchestrator note with explicit out-of-scope bullets
```

### Not modified (preserved)
- `src/server.ts` — MCP server bootstrap
- `src/mcp/tool-call.ts` — tool dispatch
- `src/tools/*.ts` — the 9 deterministic public tools
- `src/enforcement/*` — enforcement engine and mechanisms (including `claim_classifier.ts`)
- `CLAUDE_ORCHESTRATOR_IMPLEMENTATION_PROMPT.md` and `CLAUDE_ORCHESTRATOR_VERIFICATION_PROMPT.md` (explicitly forbidden)

## 5. Commands Run

```bash
# build
rm -rf dist && npm run build

# focused tests
npx vitest run \
  tests/orchestrator/orchestrator_schema_validation.test.ts \
  tests/orchestrator/orchestrator_routing.test.ts \
  tests/orchestrator/orchestrator_policy.test.ts \
  tests/orchestrator/orchestrator_shadow_mode.test.ts

# CLI verification commands
node --import tsx src/orchestrator/cli.ts \
  --input src/orchestrator/fixtures/confidence_inflation.json --mode routed
node --import tsx src/orchestrator/cli.ts \
  --input src/orchestrator/fixtures/mixed_shadow_mode.json --mode shadow
node --import tsx src/orchestrator/cli.ts \
  --input src/orchestrator/fixtures/circular_reasoning.json --mode routed

# adversarial: corrupt fixture (restored afterward)
# (edit src/orchestrator/fixtures/confidence_inflation.json to drop
#  falsification_condition from assumption[0], run CLI, restore from backup)
node --import tsx src/orchestrator/cli.ts \
  --input src/orchestrator/fixtures/confidence_inflation.json --mode routed

# adversarial: iteration-2 escalation
node --import tsx src/orchestrator/cli.ts \
  --input /tmp/ct-mcp-verify/iteration2_envelope.json --mode routed

# adversarial: routed vs shadow comparison
node --import tsx src/orchestrator/cli.ts \
  --input src/orchestrator/fixtures/mixed_shadow_mode.json --mode routed
node --import tsx src/orchestrator/cli.ts \
  --input src/orchestrator/fixtures/mixed_shadow_mode.json --mode shadow
```

## 6. Verification Command Results

### 6.1 `npm run build`

**Exit status:** 0 (clean compile)

```
> ct-mcp@0.1.0-beta.2 build
> tsc
```

No warnings, no errors. `dist/` is populated. TypeScript config is `target: ES2022`, `module: Node16`, `strict: true`.

### 6.2 `npx vitest run tests/orchestrator/*.test.ts`

**Exit status:** 0

```
 RUN  v3.2.4 /Users/adilevinshtein/Documents/dev/ct-mcp

 ✓ tests/orchestrator/orchestrator_shadow_mode.test.ts         (7 tests)  34ms
 ✓ tests/orchestrator/orchestrator_routing.test.ts           (10 tests)  40ms
 ✓ tests/orchestrator/orchestrator_policy.test.ts            (11 tests)  43ms
 ✓ tests/orchestrator/orchestrator_schema_validation.test.ts (16 tests) 779ms
   ✓ cli/report and docs smoke checks > cli --out writes the machine-readable JSON report to disk  749ms

 Test Files  4 passed (4)
      Tests  44 passed (44)
   Duration  2.31s
```

**Test breakdown (44 tests):**

| File | Tests | What it covers |
|---|---:|---|
| `orchestrator_schema_validation.test.ts` | 16 | envelope field rejection, contract rejection (missing `assumptions`, missing `falsification_condition`, bad confidence range, empty array), runOrchestrator returns `isSchemaFailure` before tool executes, schema failures recorded in telemetry, envelope-level failure short-circuits route execution, CLI `--out` writes a machine-readable report file, README/ROADMAP framing stays experimental |
| `orchestrator_routing.test.ts` | 10 | router classifies forecast answers, drops routed tools without contracts, records artifact_compatible_tools regardless of classifier suggestion, `tools_executed ⊆ routed_tools` in routed mode, reasoning-chain cycle is detected, unrouted contracts do not execute in routed mode, architectural answers route `check_plan_validity`, safety answers route `detect_concurrency_patterns`, and both routes execute successfully in routed mode |
| `orchestrator_policy.test.ts` | 11 | iteration 1 fail → REVISE, iteration 2 fail → HUMAN_REVIEW, no-failure + warning → WARN, clean pass → PASS, no infinite loop (4 synthetic iterations), `failure_source: schema` for schema failures, `failure_source: deterministic_tool` for tool failures, caller-side two-iteration loop escalation, multi-failure critique packet on a live routed path |
| `orchestrator_shadow_mode.test.ts` | 7 | shadow mode runs extra artifact-compatible tool (`check_plan_validity`), `shadow_only_findings` populated when shadow tool fails, `would_have_escalated: true` on shadow fail, routed decision unaffected by shadow failure, routed-mode baseline has no shadow-only findings, routed vs shadow produce same decision but different `tools_executed`, schema-invalid shadow contract recorded in `telemetry.schema_failures` without changing decision |

### 6.3 `node --import tsx src/orchestrator/cli.ts --input src/orchestrator/fixtures/confidence_inflation.json --mode routed`

**Exit status:** 0

Key excerpts from the JSON result:

```json
{
  "schema_version": "orchestrator_v0",
  "mode": "routed",
  "policy_decision": "REVISE",
  "route_results": [
    {
      "tool": "validate_confidence",
      "contract_type": "confidence_contract",
      "status": "ENFORCEMENT_FAIL",
      "result": {
        "status": "ENFORCEMENT_FAIL",
        "honest_ceiling": 0.727,
        "claimed_confidence": 0.9,
        "gap": 0.173,
        "inflation_detected": true,
        "enforcement": {
          "blocking_issues": [
            {
              "mechanism": "confidence_product",
              "description": "Inflation detected — claimed confidence exceeds honest ceiling by 0.173. Honest ceiling: 0.727, claimed: 0.900.",
              "severity": "blocking"
            }
          ]
        }
      }
    }
  ],
  "telemetry": {
    "mode": "routed",
    "router_primary_type": "forecast",
    "router_secondary_type": "architectural",
    "routed_tools": ["validate_confidence"],
    "artifact_compatible_tools": ["validate_confidence"],
    "tools_executed": ["validate_confidence"],
    "tools_executed_only_in_shadow": [],
    "shadow_only_findings": [],
    "schema_failures": [],
    "policy_decision": "REVISE",
    "iteration_number": 1,
    "would_have_escalated": false
  }
}
```

**Verified:**
- classifier assigned `primary_type: forecast`
- routed tool `validate_confidence` ran and returned `ENFORCEMENT_FAIL`
- policy produced `REVISE` on iteration 1
- `confidence_product` mechanism fired with `gap = 0.173 > 0.15` threshold
- failure_source in critique = `deterministic_tool`

### 6.4 `node --import tsx src/orchestrator/cli.ts --input src/orchestrator/fixtures/mixed_shadow_mode.json --mode shadow`

**Exit status:** 0

Telemetry excerpt:

```json
"telemetry": {
  "mode": "shadow",
  "router_primary_type": "forecast",
  "router_secondary_type": "empirical",
  "routed_tools": ["validate_confidence", "score_response_quality"],
  "artifact_compatible_tools": [
    "validate_confidence",
    "score_response_quality",
    "check_plan_validity"
  ],
  "tools_executed": [
    "validate_confidence",
    "score_response_quality",
    "check_plan_validity"
  ],
  "tools_executed_only_in_shadow": ["check_plan_validity"],
  "shadow_only_findings": [
    {
      "tool": "check_plan_validity",
      "status": "ENFORCEMENT_FAIL",
      "summary": "Shadow-only ENFORCEMENT_FAIL: missing_prerequisite: 1 missing prerequisite(s): step \"p1\" depends on non-existent \"p_missing_capacity_baseline\""
    }
  ],
  "schema_failures": [],
  "policy_decision": "WARN",
  "iteration_number": 1,
  "would_have_escalated": true
}
```

**Verified:**
- routed tools are 2 (`validate_confidence`, `score_response_quality`)
- artifact_compatible = 3 (plus `check_plan_validity`)
- shadow mode additionally executed `check_plan_validity` and surfaced a missing-prerequisite failure
- `policy_decision: WARN` — the shadow failure did **not** escalate the routed decision
- `would_have_escalated: true` records what would have happened if check_plan_validity had been in the routed set

### 6.5 `node --import tsx src/orchestrator/cli.ts --input src/orchestrator/fixtures/circular_reasoning.json --mode routed`

**Exit status:** 0

Key excerpt:

```json
{
  "schema_version": "orchestrator_v0",
  "mode": "routed",
  "policy_decision": "REVISE",
  "route_results": [
    {
      "tool": "validate_reasoning_chain",
      "contract_type": "reasoning_chain_contract",
      "status": "ENFORCEMENT_FAIL",
      "result": {
        "cycles": [{ "path": ["n1", "n3", "n2", "n1"] }],
        "grounding_score": 0,
        "enforcement": {
          "blocking_issues": [
            {
              "mechanism": "cycle_detection",
              "description": "Found 1 circular reasoning cycle(s): n1 -> n3 -> n2 -> n1",
              "severity": "blocking"
            }
          ]
        }
      }
    }
  ],
  "critique": {
    "failing_routes": [
      {
        "tool": "validate_reasoning_chain",
        "failure_source": "deterministic_tool"
      }
    ]
  },
  "telemetry": {
    "router_primary_type": "architectural",
    "routed_tools": ["validate_reasoning_chain"],
    "policy_decision": "REVISE",
    "iteration_number": 1
  }
}
```

**Verified:**
- `primary_type: architectural` correctly routes to `validate_reasoning_chain`
- cycle `n1 -> n3 -> n2 -> n1` detected
- policy produced `REVISE` on iteration 1
- critique `failure_source: deterministic_tool`

## 7. Adversarial Check Results

### 7.1 Corrupted fixture (missing required contract field) — PASS

**Method.** Created a temp copy of `src/orchestrator/fixtures/confidence_inflation.json`, dropped `falsification_condition` from the first assumption in the temp file (the schema makes this field required), and ran the CLI in routed mode against the temp envelope. The repo fixture itself was left untouched.

**Result.**

```json
{
  "policy_decision": "REVISE",
  "route_results": [
    {
      "tool": "validate_confidence",
      "contract_type": "confidence_contract",
      "status": "ENFORCEMENT_FAIL",
      "failure_type": "schema_validation_failure",
      "validation_errors": [
        {
          "path": "/assumptions/0",
          "message": "must have required property 'falsification_condition'"
        }
      ]
    }
  ],
  "telemetry": {
    "tools_executed": [],
    "schema_failures": [
      {
        "tool": "validate_confidence",
        "contract_type": "confidence_contract",
        "errors": ["/assumptions/0: must have required property 'falsification_condition'"]
      }
    ]
  },
  "critique": {
    "failing_routes": [
      { "tool": "validate_confidence", "failure_source": "schema" }
    ]
  }
}
```

**Verified:**
- Schema validation fired BEFORE the tool ran. `tools_executed` is empty; the route_result entry is a `SchemaFailure` (has `failure_type`, no `result` field with tool-specific output).
- Critique `failure_source` is `schema`, not `deterministic_tool`.
- Policy produced `REVISE` because iteration_number is 1.

**Repo fixture preserved.** The broken input lived only at `/tmp/ct-mcp-verify/confidence_inflation_broken.json`.

### 7.2 Iteration-2 escalation (HUMAN_REVIEW) — PASS

**Method.** Created `/tmp/ct-mcp-verify/iteration2_envelope.json` with the same circular-reasoning reasoning_chain contract, but set `iteration_number: 2` and populated `prior_failures` with a cycle_detection entry from iteration 1. Ran the CLI.

**Result.**

```json
{
  "policy_decision": "HUMAN_REVIEW",
  "telemetry": {
    "policy_decision": "HUMAN_REVIEW",
    "iteration_number": 2
  }
}
```

**Verified:** The orchestrator did not emit another `REVISE` on iteration 2. It escalated to `HUMAN_REVIEW`. This is also exercised by `tests/orchestrator/orchestrator_policy.test.ts` ("never emits REVISE past iteration 1 — no infinite loop") which runs 4 synthetic iterations and asserts only iteration 1 can ever return `REVISE`.

### 7.3 Routed vs shadow comparison on mixed fixture — PASS

**Method.** Ran `mixed_shadow_mode.json` in both modes and diffed the telemetry fields that matter for this check.

| Field | Routed | Shadow | Delta |
|---|---|---|---|
| `policy_decision` | `WARN` | `WARN` | same ✓ |
| `routed_tools` | `[validate_confidence, score_response_quality]` | same | same ✓ |
| `artifact_compatible_tools` | `[validate_confidence, score_response_quality, check_plan_validity]` | same | same ✓ |
| `tools_executed` | 2 tools | **3 tools** (+`check_plan_validity`) | shadow adds 1 |
| `tools_executed_only_in_shadow` | `[]` | `[check_plan_validity]` | shadow adds 1 |
| `shadow_only_findings` | `[]` | 1 ENFORCEMENT_FAIL on `check_plan_validity` | shadow adds 1 |
| `would_have_escalated` | `false` | **`true`** | shadow flips it |

**Verified:**
- Shadow mode reports additional compatible tools and findings (`check_plan_validity` surfaced a missing prerequisite).
- Shadow mode does **not** change the routed decision path (both modes → `WARN`).
- Shadow mode correctly flags `would_have_escalated: true` so routing calibration can learn from it.

### 7.4 README wording inspection — PASS

**Method.** Ripgrep scans for forbidden framing terms (`workflow engine`, `control plane`, `production orchestration`, `finished`, `automatic routing is now`).

**Findings:**
- The only match on `workflow engine | control plane | production orchestration` is on `README.md:165`:
  > `- Not a workflow engine, control plane, or production orchestration platform`

  This is the explicit "What this is not" negation list inside the experimental orchestrator section. It is the correct honest framing, not a marketing claim.
- The section header is `README.md:135`: `## Experimental: Internal Orchestrator (v0)`.
- The first paragraph (`README.md:137`) states: *"an experimental internal layer... not part of the public MCP tool surface, and... not exposed as an MCP tool. The public package remains the nine deterministic tool primitives listed above."*
- The routed-mode description now states that routing is classifier-driven and requires present, valid contracts; it no longer implies that the envelope itself directly suggests tools.
- `ROADMAP.md` contains a matching experimental note, with explicit out-of-scope bullets (no provider SDKs, no LLM routing, no prose-to-graph rescue, not a public MCP tool).

**Verified:** Docs do not claim the package is a finished workflow engine or production control plane. The framing is now consistent with the implementation: routed mode is classifier-driven, shadow mode is observational, and the feature remains explicitly experimental.

## 8. Missing Tests

The 44 tests cover everything in the implementation prompt's explicit test requirements plus several adjacent cases. Known remaining gaps:

1. **No test for classifier-confidence threshold behavior.** Since the policy layer does not currently use `classifier_confidence`, there is nothing meaningful to assert yet — but if M2 (§3) is addressed, a test must be added immediately.

## 9. Implementation Compromises

1. **Ajv default-export interop hack.** `src/orchestrator/schemaValidation.ts` uses `((AjvImport as any).default) ?? AjvImport` because the Ajv 8 d.ts shapes do not expose a constructable default under `module: Node16`. This mirrors the existing pattern in `benchmark/invisible-tea-party/ts/src/schemaValidation.ts`. It works but is the ugliest line in the module.

2. **`score_response_quality` is only routed when the classifier suggests it.** In the mixed fixture (`mixed_shadow_mode.json`), the classifier's forecast pattern suggests both `validate_confidence` and `score_response_quality`, so the quality contract is routed. If the classifier primary type changed, the quality contract might fall into shadow-only. This is the intended coupling — routing is driven by the classifier — but it means quality scoring is not a universal default.

3. **Classifier output uses string tool names, not the orchestrator's `OrchestratorToolName` union.** `src/orchestrator/router.ts` has a `CLASSIFIER_TO_ORCHESTRATOR_TOOL` lookup table that explicitly maps the classifier's 9-tool suggestion space onto the orchestrator's 5-tool routable set. Tools outside the routable set (`check_numeric_claims`, `detect_drift`, `evaluate_tradeoffs`, `verify_arithmetic`) are intentionally dropped in v0 — they have no orchestrator contract yet. This is correct scope but means the orchestrator routes a strict subset of the 9 public tools.

4. **Envelope contracts use short keys (`confidence`, `reasoning_chain`, etc.) rather than contract types (`confidence_contract`, ...).** Chose to match the shape suggested by the implementation prompt's example JSON. The internal type system uses `ContractType = '<name>_contract'` and a `CONTRACT_KEY_TO_TYPE` map bridges the two.

## 10. Residual Risks Before This Can Be Presented As More Than Experimental

1. **Classifier accuracy bounds routed-mode coverage.** The deterministic regex-based classifier is the only routing signal. If an answer is mis-classified, the routed set may miss contracts that were actually supplied. Shadow mode exists precisely to surface this, but shadow findings are observational only. Before productizing, someone needs to calibrate the classifier against real benchmark output and either tune the patterns or add a second routing signal (still non-LLM, still deterministic).

2. **One revision pass is hard-coded.** The policy prompt states "one revision pass maximum" and the implementation enforces that. But real workflows might want 2-3 passes with different escalation criteria. The current design does not let callers configure that. Before productizing, caller-configurable retry budgets would need to be added — while still preventing infinite loops.

3. **No orchestrator MCP tool surface.** The orchestrator is called via the CLI harness only. It is not exposed as an MCP tool. Before any client can consume it through MCP, a new tool definition plus schema plus handler would need to land — and that should be gated behind an explicit "this is still experimental" flag.

4. **Shadow telemetry is not persisted.** Every run emits telemetry to stdout or an optional `--out` file, but there is no central store for comparing shadow vs routed decisions across many runs. Calibration feedback requires that store; otherwise shadow mode findings vanish after each CLI run.

5. **Classifier confidence is unused.** The router returns `classifier_confidence` but policy does not read it. A low-confidence routing (e.g., 0.15) looks identical in policy to a high-confidence routing. This is fine for v0 but a real product would surface low-confidence routing as a warning.

6. **No telemetry on WARN-category classifier mismatches.** If the routed tool PASSes but the classifier also flagged a secondary type whose contract was not supplied, the orchestrator does not warn about the gap. Shadow mode partially covers this when the contract is supplied, but not when it is absent.

7. **No versioning discipline yet.** `schema_version: "orchestrator_v0"` is hard-coded and enforced by Ajv (`const: "orchestrator_v0"`). There is no migration story for when v1 lands. Before productizing, a versioning + migration story is needed so that existing callers do not break when new contract fields appear.

8. **No resource/time limits.** A malicious or buggy caller could hand in an extremely large reasoning_chain (thousands of nodes) and the DAG-path computation inside `validate_reasoning_chain` would run to completion. The reasoning chain tool has a depth cap (`MAX_PATH_DEPTH = 20`) but no node/edge count limit. Non-blocking at this scope but worth flagging before any public-facing productization.

## 11. Claude Haiku Smoke Test

This section records a minimal out-of-sandbox smoke test using the local Claude CLI with model `haiku`.

### 11.1 What Ran

- run profile intent: `claude_low`
- actual CLI model used: `haiku`
- prompt id: `C01`
- condition: `baseline`
- artifact written to: `/tmp/duck_claude-haiku_low_C01_baseline.md`

Exact prompt text from `benchmark/duckexperiments/manifest.ts`:

```text
Design a falsifiable experiment to test whether rubber duck debugging improves bug-finding speed. Include the metric, hypothesis, confounders, and stopping rule.
```

### 11.2 Did CT-MCP Adjust The Response?

No.

This was a `baseline` cell. Under the duck-experiments contract, baseline responses answer the prompt directly and do **not** use CT-MCP to shape or revise the answer. The Haiku smoke test therefore validates Claude CLI execution and artifact writing, not CT-MCP-assisted revision behavior.

The CLI reported:

```text
Baseline cell executed and written to /tmp/duck_claude-haiku_low_C01_baseline.md
The response directly answers the prompt with a testable experiment design.
No tools were used per baseline rules.
```

### 11.3 Baseline Response Summary

The baseline artifact contains:

- two-group experiment design (`duck` vs `no duck`)
- metric: time to bug identification
- hypothesis: duck group is 25% faster
- confounders: experience, bug complexity, familiarity, fatigue
- stopping rule: 100 bug discoveries per group or 8 weeks
- analysis: paired t-test at `p < 0.05`
- self-critique: the design may conflate the duck with articulation effects

### 11.4 Post-Hoc CT-MCP Review Of The Same Response

To inspect deterministic tool behavior on the generated response, the response was then reviewed **after the fact** with the designated CT-MCP tools for `C01`:

- primary: `check_plan_validity`
- secondary: `score_response_quality`

Important: this CT-MCP review was observational only. It did **not** modify the already-written Haiku baseline artifact.

#### 11.4.1 `check_plan_validity`

Structured input used:

```json
{
  "steps": [
    { "id": "s1", "description": "Divide developers into two equal groups", "dependencies": [] },
    { "id": "s2", "description": "Pre-plant 15 identical bugs of varying complexity in isolated code modules", "dependencies": [] },
    { "id": "s3", "description": "Run debugging sessions with Group A using a rubber duck and Group B without", "dependencies": ["s1", "s2"] },
    { "id": "s4", "description": "Measure minutes from code review start to bug identification", "dependencies": ["s3"] },
    { "id": "s5", "description": "Rotate developers so each tries both conditions on separate bugs", "dependencies": ["s3"] },
    { "id": "s6", "description": "Collect 100 bug discoveries per group or stop after 8 weeks", "dependencies": ["s3"] },
    { "id": "s7", "description": "Use a paired t-test for significance at p<0.05", "dependencies": ["s4", "s5", "s6"] }
  ]
}
```

Raw CT-MCP output:

```json
{
  "status": "PASS",
  "is_valid": true,
  "circular_dependencies": [],
  "missing_prerequisites": [],
  "resource_conflicts": [],
  "completeness_score": 1,
  "critical_path": ["s1", "s3", "s4", "s7"],
  "step_count": 7,
  "context_used": false
}
```

Interpretation:

- the experiment design can be shaped into a coherent dependency graph
- no obvious missing prerequisites or circular dependencies were detected
- CT-MCP does not object to the structure of the plan itself

#### 11.4.2 `score_response_quality`

Raw CT-MCP output:

```json
{
  "status": "PASS",
  "overall_score": 0.628,
  "substance_score": 0.979,
  "specificity_score": 0.008,
  "hedge_density": 0,
  "structure_score": 0.66,
  "improvement_prompt": "Your weakest dimension is \"specificity\" (score: 0.01). Add concrete details: names, numbers, dates, measurements, or specific conditions.",
  "context_used": false,
  "enforcement": {
    "blocking_issues": [],
    "warnings": [
      "Low specificity (score: 0.01). Add concrete details and quantitative markers."
    ],
    "corrective_prompt": ""
  }
}
```

Interpretation:

- CT-MCP does **not** block the response
- it does warn that the response is structurally decent but extremely low-specificity under this scorer
- the main deterministic critique is not logical invalidity, but lack of concrete operational detail

### 11.5 Smoke-Test Conclusion

The Haiku smoke test succeeded at the CLI/artifact level, and the post-hoc CT-MCP review behaved coherently on the generated response:

- Claude Haiku produced a valid baseline artifact
- baseline mode did not use CT-MCP, by design
- CT-MCP review of the resulting answer produced:
  - `check_plan_validity`: `PASS`
  - `score_response_quality`: `PASS` with a low-specificity warning

This is enough to show the execution path works end-to-end for one minimal Claude cell plus deterministic review, but it is still only a smoke test, not a full benchmark run.

---

## 12. Sonnet Direct Invocation vs Fixed-Host Tool Review

This section clarifies a benchmark-design question that came up during review: whether Claude Sonnet can invoke CT-MCP directly from the local Claude host, or whether CT-MCP review must always be done in the fixed host.

### 12.1 Benchmark Rule vs Host Capability

The benchmark docs intentionally recommend a fixed review host:

- `benchmark/duckexperiments/RUN_PROFILES.md` says: "Do not run `tool_review` inside whichever CLI produced the answer unless all six profiles can access CT-MCP identically."
- `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` repeats that `tool_review` should run in one fixed MCP-enabled host client to preserve comparability.

That is a methodology choice, not evidence that Claude Sonnet cannot call the tools. To test host capability directly, I ran one out-of-sandbox Sonnet call that explicitly asked the Claude host to use CT-MCP tools itself and show the results inline.

### 12.2 Direct Sonnet Prompt Used

Original user-facing prompt:

```text
Design an experiment to test whether explaining a problem to a rubber duck helps developers debug faster.
```

Draft answer supplied to Sonnet for direct CT-MCP review:

```text
Design a randomized controlled trial with 40 developers, split into duck and no-duck groups. Give everyone the same buggy task, measure time to fix, and compare the means with a t-test. I am 72 percent confident this will show whether the duck helps.
```

Direct Sonnet instruction:

```text
Use CT-MCP tools directly if they are available in this Claude host. Analyze this answer draft and improve it only if the tool results justify a concrete change.

Original prompt:
Design an experiment to test whether explaining a problem to a rubber duck helps developers debug faster.

Draft answer to review:
Design a randomized controlled trial with 40 developers, split into duck and no-duck groups. Give everyone the same buggy task, measure time to fix, and compare the means with a t-test. I am 72 percent confident this will show whether the duck helps.

Required CT-MCP tools to try:
- check_plan_validity
- score_response_quality
- validate_confidence
```

### 12.3 Did Sonnet Invoke CT-MCP Directly?

Yes.

The returned answer includes concrete CT-MCP findings rather than generic paraphrase, and the content aligns with the local deterministic tool behavior. Sonnet did not follow the requested output labels exactly, but it did surface tool-derived results and a revised end-user answer.

Tools evidently fired:

- `score_response_quality`
- `validate_confidence`

`check_plan_validity` was requested but not used in this particular direct response.

### 12.4 Raw Direct Sonnet Output

```text
- score_response_quality — PASS overall (0.626/1.0), but specificity_score: 0.00 with explicit warning: "Add concrete details and quantitative markers."
- validate_confidence — honest_ceiling: 0.12; the draft's claimed 72% confidence is drastically inflated relative to what the underlying assumptions support (ceiling is only 12%)
score_response_quality: overall=0.626, substance=0.981, specificity=0.00, hedge_density=0, structure=0.66 | warning: specificity critically low
validate_confidence: honest_ceiling=0.12, claimed=0.72 (implied), gap=~0.60 — severe inflation; assumptions around power, normality, and signal detectability compound to a ceiling of only ~12%
Design a randomized controlled trial with 40 developers (20 per group), balanced for experience level (e.g., stratified by years of professional coding). Both groups receive the same buggy Python task — for example, a function with an off-by-one error and a silent type coercion bug. The duck group is instructed to explain their reasoning aloud to a rubber duck before each debugging action; the no-duck group works silently. Measure wall-clock time from task start to first correct fix, verified by automated test suite. Analyze with an independent-samples t-test if residuals pass Shapiro-Wilk; otherwise use Mann-Whitney U.

Three caveats the draft omits: (1) N=40 is likely underpowered — a power analysis for a medium effect (Cohen's d=0.5) at 80% power requires roughly 64 participants; consider recruiting more or running a pilot first. (2) The 72% confidence claim is not supportable — compounding uncertainty over statistical power, task suitability, and whether verbalization actually separates from silent thinking yields an honest confidence ceiling closer to 12% that this specific design will produce a clean, conclusive result. State instead that the design is capable of detecting an effect if one exists at the chosen effect size. (3) Add a manipulation check: record whether duck-group participants actually verbalized, to avoid null results from non-compliance contaminating the treatment condition.
```

### 12.5 Interpretation

This direct Sonnet run is enough to answer the narrow operational question:

- the local Claude Sonnet host can invoke CT-MCP directly
- the response changed materially because of deterministic CT-MCP feedback
- the most visible tool contribution here was not plan invalidity, but confidence deflation and specificity pressure

It does **not** overturn the benchmark methodology recommendation. For the benchmark, keeping `tool_review` in one fixed MCP-enabled host still makes sense because that preserves comparability across all six run profiles. But the local host capability itself is now demonstrated, not hypothetical.

---

**Bottom line.** The orchestrator v0 looks directionally correct and honestly scoped as an experimental internal layer. The strongest prompt constraints appear to be met in the reviewed code paths: strict structured contracts, Ajv validation before tool execution, one-revision-cap policy, second-failure escalation, observational shadow mode, no provider SDKs, no hidden memory, no prose rescue, and no public-tool-surface change. The earlier routed-mode dead zones for `plan` and `concurrency` contracts are now closed, and the most obvious test-coverage holes called out in the earlier review have been covered. But the validation here is still focused rather than exhaustive. The remaining gaps (§3 Medium, §8, §9, §10) are enough that this should still be framed as "promising experimental tooling under targeted verification," not as thoroughly tested or broadly signed off.
