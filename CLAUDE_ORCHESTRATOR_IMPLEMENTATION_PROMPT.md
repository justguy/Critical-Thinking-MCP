# Claude Orchestrator Implementation Prompt

Use this prompt as the implementation handoff for the `ct-mcp` orchestrator `v0`.

## Prompt

You are implementing an experimental orchestration layer for `ct-mcp` in this repository.

Work in-place. Make code changes directly. Do not stop at analysis.

Repository root:

- repository root

Current package:

- `ct-mcp` `0.1.0-beta.2`

Current reality:

- the repo already ships 9 deterministic, stateless MCP tools
- the repo does **not** yet ship a workflow engine
- `src/enforcement/claim_classifier.ts` already exists but is not wired into real routing
- the biggest missing product layer is: routing + strict structured contracts + policy + telemetry

Your job is to build the minimum viable orchestrator that proves this can work **without** pretending the current package is already a complete reasoning-control plane.

## Read First

Read these before editing:

- `README.md`
- `ROADMAP.md`
- `DEVELOPMENT.md`
- `benchmark/benchmark_gaps.json`
- `benchmark/reports/BENCHMARK_REPORT.md`
- `benchmark/duckexperiments/README.md`
- `src/enforcement/claim_classifier.ts`
- `src/mcp/tool-call.ts`
- `src/tools/validate_confidence.ts`
- `src/tools/validate_reasoning_chain.ts`
- `src/tools/check_plan_validity.ts`
- `src/tools/detect_concurrency_patterns.ts`
- `src/tools/score_response_quality.ts`

Also inspect at least these live artifacts for shape and critique-packet style:

- `benchmark/duckexperiments/results/gemini_thinking/Q01/tool_review.md`
- `benchmark/duckexperiments/results/gemini_thinking/Q07/tool_review.md`
- `benchmark/duckexperiments/results/gemini_thinking/Q07/critique_revised.md`

## Objective

Build an **experimental internal orchestrator** that:

1. receives a draft answer plus strict structured artifacts
2. uses the existing claim classifier to suggest routed tools
3. validates route-specific JSON contracts with Ajv
4. maps validated contracts into deterministic tool inputs
5. executes routed tools in standard mode
6. executes all artifact-compatible tools in shadow mode
7. applies a policy layer with a maximum of one revision pass
8. emits machine-readable telemetry showing:
   - routed tools
   - shadow-eligible tools
   - which tools actually fired
   - which failures would have been missed by routing
   - whether the answer should pass, revise, or escalate to human review

This is **not** a public productization pass. Do not market this as a finished workflow engine.

## Non-Negotiable Constraints

1. Keep this TypeScript-first and repo-native.
2. Do not add provider SDK dependencies.
3. Do not add LLM calls inside deterministic tool code.
4. Do not change the semantics of the existing 9 public MCP tools.
5. Do not add a public MCP tool for orchestration in this pass unless absolutely necessary.
6. Do not parse arbitrary raw prose into plan graphs, reasoning DAGs, or concurrency steps using regex rescue logic.
7. Every route must rely on a strict structured JSON contract. If the contract is invalid, fail before the tool call.
8. One revision pass maximum.
9. If the same answer family fails twice, escalate to human review. Do not loop indefinitely.
10. Keep shadow mode observational only. It must not affect the routed-mode decision path.

## Product Rules To Preserve

These are design invariants for this implementation:

1. `ct-mcp` remains stateless per tool call.
2. Orchestration state lives in explicit caller-provided review context, not hidden server memory.
3. Shapers validate and map structured contracts. They do not invent missing structure.
4. A schema failure is an orchestration failure, not a best-effort fallback to prose parsing.
5. Shadow mode is for telemetry and routing calibration, not silent enforcement changes.

## Required Deliverables

### 1. Internal Orchestrator Module

Add a new internal module tree:

- `src/orchestrator/types.ts`
- `src/orchestrator/contracts.ts`
- `src/orchestrator/schemaValidation.ts`
- `src/orchestrator/router.ts`
- `src/orchestrator/policy.ts`
- `src/orchestrator/review.ts`
- `src/orchestrator/shadowTelemetry.ts`
- `src/orchestrator/index.ts`

You may add a `src/orchestrator/shapers/` folder if it keeps the implementation clearer.

### 2. Strict Structured Contracts

Define explicit contract types for at least these route families:

- `confidence_contract`
- `reasoning_chain_contract`
- `plan_contract`
- `concurrency_contract`
- `quality_contract`

Each contract must be a strict object schema validated with Ajv.

The orchestrator input envelope should be explicit and versioned.

Suggested top-level shape:

```json
{
  "schema_version": "orchestrator_v0",
  "answer_text": "full model answer",
  "contracts": {
    "confidence": { "...": "..." },
    "reasoning_chain": { "...": "..." }
  },
  "mode": "routed",
  "review_context": {
    "iteration_number": 1,
    "prior_failures": []
  }
}
```

Do not require every contract for every answer.

### 3. Route-Specific Contract Requirements

#### `confidence_contract`

Must validate:

- `response_text`
- `assumptions[]`
- each assumption has:
  - `description`
  - `confidence`
  - `falsification_condition`

This should map directly into `validate_confidence`.

#### `reasoning_chain_contract`

Must validate:

- `nodes[]`
- `edges[]`

This should map directly into `validate_reasoning_chain`.

Do not accept freeform prose in place of nodes and edges.

#### `plan_contract`

Must validate:

- `steps[]`
- each step has:
  - `id`
  - `description`
  - `dependencies`
  - optional `resources`

This should map directly into `check_plan_validity`.

#### `concurrency_contract`

Must validate:

- `steps[]`
- optional `shared_resources`
- optional `protections`
- optional `delivery_model`
- optional `retry_behavior`

This should map directly into `detect_concurrency_patterns`.

#### `quality_contract`

Must validate:

- `response_text`
- optional `claims[]`
- optional `evidence[]`

This should map directly into `score_response_quality`.

### 4. Schema Validation Rules

Implement Ajv-backed validators for the orchestrator contracts.

Requirements:

- compile validators once
- expose helpers like:
  - `validateOrchestratorEnvelope`
  - `validateConfidenceContract`
  - `validateReasoningChainContract`
  - `validatePlanContract`
  - `validateConcurrencyContract`
  - `validateQualityContract`
- return precise Ajv-derived errors
- if validation fails, emit a structured orchestration error with:
  - `status: ENFORCEMENT_FAIL`
  - `failure_type: schema_validation_failure`
  - `route`
  - `validation_errors`

### 5. Router

Use the existing `claim_classifier` as the starting point. Do not replace it with an LLM router.

Requirements:

- classify the answer text
- produce:
  - `primary_type`
  - `secondary_type`
  - `suggested_tools`
- map suggested tools to required contracts
- only route a tool in standard mode if:
  - the route is suggested, and
  - a valid matching contract is present

Add an internal mapping layer from tool name to required contract type.

The router must support:

- `mode = routed`
- `mode = shadow`

Behavior:

- `routed`: run only routed tools with valid contracts
- `shadow`: run all contract-compatible tools, then annotate which ones were outside the routed set

### 6. Shapers

Implement shapers as **contract validators + direct mappers**, not prose interpreters.

Rules:

- no regex rescue for missing graph nodes
- no regex rescue for missing dependencies
- no regex rescue for concurrency protections
- no invented structure

If a route is selected but the required contract is missing or invalid, return `ENFORCEMENT_FAIL` before any tool is called for that route.

This rule matters more than coverage.

### 7. Policy Layer

Implement a policy engine with these output states:

- `PASS`
- `WARN`
- `REVISE`
- `HUMAN_REVIEW`

Rules:

1. If any routed tool returns `ENFORCEMENT_FAIL` on iteration 1:
   - produce `REVISE`
   - emit a single merged critique packet
2. If any routed tool returns `ENFORCEMENT_FAIL` on iteration 2:
   - produce `HUMAN_REVIEW`
   - do not emit a second revise loop
3. If only warnings exist:
   - produce `WARN`
4. If all routed tools pass cleanly:
   - produce `PASS`

The critique packet must include at least:

- failing route/tool
- blocking issues
- warnings
- contract failures if any
- safer revision target
- whether the issue came from:
  - routing
  - schema
  - deterministic tool result

### 8. Shadow Mode Telemetry

Implement shadow telemetry with machine-readable outputs.

For every orchestrator run, record:

- `mode`
- `router_primary_type`
- `router_secondary_type`
- `routed_tools`
- `artifact_compatible_tools`
- `tools_executed`
- `tools_executed_only_in_shadow`
- `shadow_only_findings`
- `schema_failures`
- `policy_decision`
- `iteration_number`
- `would_have_escalated`

The important question the telemetry should answer:

- what did shadow mode find that routed mode would have missed?

### 9. CLI Harness

Add an experimental CLI entrypoint:

- `src/orchestrator/cli.ts`

It should:

1. load a JSON review envelope from disk
2. run the orchestrator in `routed` or `shadow` mode
3. print machine-readable JSON
4. optionally write a report file

Suggested flags:

- `--input`
- `--mode routed|shadow`
- `--out`

### 10. Fixtures

Add local fixtures under:

- `src/orchestrator/fixtures/`

Create at least these fixture envelopes:

1. `confidence_inflation.json`
   - should exercise `validate_confidence`
   - include a 90% claim with weaker assumptions
2. `circular_reasoning.json`
   - should exercise `validate_reasoning_chain`
   - include an explicit cycle
3. `structured_plan.json`
   - should exercise `check_plan_validity`
4. `concurrency_flow.json`
   - should exercise `detect_concurrency_patterns`
5. `mixed_shadow_mode.json`
   - should demonstrate routed-mode selection vs extra shadow-compatible tools

### 11. Tests

Add focused tests under:

- `tests/orchestrator/orchestrator_schema_validation.test.ts`
- `tests/orchestrator/orchestrator_routing.test.ts`
- `tests/orchestrator/orchestrator_policy.test.ts`
- `tests/orchestrator/orchestrator_shadow_mode.test.ts`

At minimum verify:

1. schema-invalid route payload fails before tool call
2. valid confidence contract reaches `validate_confidence`
3. valid reasoning graph reaches `validate_reasoning_chain`
4. routed mode only runs routed + contract-valid tools
5. shadow mode runs all contract-compatible tools
6. one failed revision leads to `REVISE`
7. second failed revision leads to `HUMAN_REVIEW`
8. no infinite loop behavior exists in policy
9. shadow telemetry records shadow-only findings
10. no existing public tool semantics are changed

### 12. Documentation

Update docs briefly and honestly:

- `README.md`
- optionally `ROADMAP.md` if needed

The docs must say:

- this is an experimental orchestrator layer
- the public package still centers on deterministic tool primitives
- the orchestrator depends on strict structured contracts
- raw prose rescue is intentionally not supported

Do **not** rewrite the README as if this is already the finished control plane.

## Recommended File Plan

Create:

- `src/orchestrator/types.ts`
- `src/orchestrator/contracts.ts`
- `src/orchestrator/schemaValidation.ts`
- `src/orchestrator/router.ts`
- `src/orchestrator/policy.ts`
- `src/orchestrator/review.ts`
- `src/orchestrator/shadowTelemetry.ts`
- `src/orchestrator/index.ts`
- `src/orchestrator/cli.ts`
- `src/orchestrator/fixtures/confidence_inflation.json`
- `src/orchestrator/fixtures/circular_reasoning.json`
- `src/orchestrator/fixtures/structured_plan.json`
- `src/orchestrator/fixtures/concurrency_flow.json`
- `src/orchestrator/fixtures/mixed_shadow_mode.json`
- `tests/orchestrator/orchestrator_schema_validation.test.ts`
- `tests/orchestrator/orchestrator_routing.test.ts`
- `tests/orchestrator/orchestrator_policy.test.ts`
- `tests/orchestrator/orchestrator_shadow_mode.test.ts`

Likely update:

- `package.json`
- `README.md`
- `ROADMAP.md` only if needed for an experimental note

## Boundaries

Do not do these things:

- do not add provider SDKs
- do not make the orchestrator depend on hidden memory
- do not add an unconstrained prose-to-graph parser
- do not silently run every tool on every answer in production mode
- do not change the public MCP server to claim automatic routing is production-ready
- do not market shadow mode findings as production enforcement results

## Definition Of Done

This task is complete only when all of the following are true:

1. `npm run build` passes
2. focused orchestrator tests pass
3. schema-invalid fixtures fail before tool invocation
4. routed mode and shadow mode produce different tool execution sets where appropriate
5. a second failed iteration escalates to `HUMAN_REVIEW`
6. README language remains honest about experimental status

## Verification Steps

Your implementation must make these commands work:

```bash
npm run build
```

```bash
npx vitest run \
  tests/orchestrator/orchestrator_schema_validation.test.ts \
  tests/orchestrator/orchestrator_routing.test.ts \
  tests/orchestrator/orchestrator_policy.test.ts \
  tests/orchestrator/orchestrator_shadow_mode.test.ts
```

```bash
node --import tsx src/orchestrator/cli.ts \
  --input src/orchestrator/fixtures/confidence_inflation.json \
  --mode routed
```

```bash
node --import tsx src/orchestrator/cli.ts \
  --input src/orchestrator/fixtures/mixed_shadow_mode.json \
  --mode shadow
```

```bash
node --import tsx src/orchestrator/cli.ts \
  --input src/orchestrator/fixtures/circular_reasoning.json \
  --mode routed
```

Also verify these behaviorally:

1. break one fixture schema on purpose and confirm the orchestrator returns a schema failure before any tool call
2. run an iteration-2 fixture with prior failure context and confirm policy escalates to `HUMAN_REVIEW`
3. compare routed vs shadow output on `mixed_shadow_mode.json` and confirm the telemetry records shadow-only findings

## Final Response Format

When finished, report:

1. files changed
2. commands run
3. whether each verification step passed
4. any implementation compromises
5. residual risks before this should be presented as more than experimental
