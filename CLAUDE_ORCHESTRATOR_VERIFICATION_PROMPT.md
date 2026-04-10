# Claude Orchestrator Verification Prompt

Use this prompt as the verification handoff **after** the orchestrator implementation is complete.

## Prompt

You are verifying the experimental `ct-mcp` orchestrator implementation in this repository.

You are operating as a reviewer and verifier, not as the original implementer.

Your job is to confirm whether the implementation actually satisfies the intended contract:

- strict structured contracts
- no prose rescue
- routed mode vs shadow mode separation
- one revision pass max
- second failure escalates to human review
- honest documentation

Work inside this repo only.

## Read First

- `CLAUDE_ORCHESTRATOR_IMPLEMENTATION_PROMPT.md`
- `README.md`
- `ROADMAP.md`
- `DEVELOPMENT.md`
- all new `src/orchestrator/` files
- all new `tests/orchestrator/` files

Also inspect these existing files to ensure the new work did not misrepresent current package reality:

- `src/enforcement/claim_classifier.ts`
- `src/mcp/tool-call.ts`
- `benchmark/benchmark_gaps.json`

## Verification Goals

You must answer:

1. does the implementation use strict JSON contracts instead of prose rescue?
2. does schema failure stop the route before any deterministic tool call?
3. does standard mode avoid "run all tools" behavior?
4. does shadow mode run extra contract-compatible tools and record the difference?
5. does the policy layer enforce a single revision pass and then escalate?
6. do the docs remain honest that this is experimental?
7. were any existing tool semantics changed accidentally?

## Required Verification Checks

### A. Source Review

Inspect the source and confirm:

1. shapers only validate + map structured contracts
2. no regex/parser fallback tries to synthesize reasoning graphs or dependency lists from raw prose
3. router uses the existing claim classifier or a directly adjacent deterministic mapping
4. policy logic contains explicit `REVISE` then `HUMAN_REVIEW` escalation
5. shadow telemetry differentiates:
   - routed tools
   - artifact-compatible tools
   - shadow-only findings

### B. Test Review

Inspect the tests and confirm they actually cover:

1. schema-invalid route payloads
2. routed vs shadow execution differences
3. policy escalation after second failure
4. telemetry contents

If a required behavior is untested, call that out explicitly even if the code looks plausible.

### C. Command Verification

Run:

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

### D. Behavioral Adversarial Checks

Perform these explicit checks:

1. Intentionally corrupt one fixture so a required contract field is missing.
   Confirm the result is a schema failure before tool invocation.

2. Run or simulate an iteration-2 case with prior failure context.
   Confirm the system returns `HUMAN_REVIEW` rather than another revise loop.

3. Compare a routed-mode run and a shadow-mode run on the mixed fixture.
   Confirm that shadow mode reports additional compatible tools or findings without changing the routed decision path.

4. Inspect README wording.
   Confirm the docs do **not** claim the package is already a finished workflow engine or production control plane.

## Review Standard

Be skeptical.

Do not treat passing tests as sufficient if the implementation violates the prompt contract in spirit.

Examples of failures that matter:

- a hidden fallback that parses freeform prose into a graph
- shadow mode mutating production decisions
- a second failed revision still returning `REVISE`
- docs that imply automatic routing is now the default public package behavior
- a route that silently skips schema validation

## Final Response Format

Return findings first, ordered by severity, with file references.

Then include:

1. commands run
2. verification results
3. any missing tests
4. residual risks

If no findings are discovered, say that explicitly and still mention any remaining uncertainty or follow-up risks.
