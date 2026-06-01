# CT-MCP Testing and Product-Value Strategy

Status: proposed hardening plan. Created 2026-05-31.

Goal: turn the current deterministic proof suite into a release-quality evidence pipeline, and focus product work on changes that actually improve agent output quality rather than adding more raw tools.

## Current State

The current proof pass demonstrates meaningful deterministic correctness value:

- `npm run build` passes.
- `npm test` passes with 378 tests across 18 files as of 2026-06-01.
- Public MCP surface is 11 facade tools.
- Internal deliverable leaf tools are hidden from the public surface.
- Every public tool has an `outputSchema`.
- Representative PASS and BLOCK calls emit schema-valid `structuredContent`.
- `finalize_deliverable` blocks tested bypass attempts.
- Host enforcement rejects gate blocks, missing artifacts, and answer swaps.
- Deterministic fuzz cases do not crash/hang.
- Latency is below budget on the tested local corpora.

The proof is still partial because these release gates have not run:

- Mutation testing.
- Live stdio and HTTP MCP transport round-trip.
- Real agent/tagent product-value benchmark with objective grading.

## Testing Strategy

### Tier 0: Fast Local Gate

Run on every PR and before any merge.

```sh
TPF_LLM_TOOL=codex tpf npm run build
TPF_LLM_TOOL=codex tpf npm test
```

Required result:

- TypeScript build passes.
- All unit, regression, proof, host, and benchmark-structure tests pass.
- No lowered test counts to make CI pass.

### Tier 1: Deterministic Correctness Proof

Run on every PR touching tools, host enforcement, MCP schemas, or dispatcher code.

Covered by `tests/proof/*`:

- Public-surface membership.
- `outputSchema` presence and representative validation.
- `structuredContent` on success and failure.
- Finalize chokepoint bypass attempts.
- Should-pass / should-block corpora.
- Differential helper oracles for graph, numeric, MECE, and plan-cycle checks.
- Determinism/repeatability.
- Deterministic fuzz.
- Host-wrapper release behavior.
- Latency budgets.

Required result:

- Bypass rate: `0`.
- False-block rate on proof clean controls: `0`.
- Differential disagreements: `0`.
- Schema-invalid representative outputs: `0`.
- Fuzz crashes/hangs: `0`.
- Determinism mismatches: `0`.
- Typical p95 latency: `<=50ms`.
- Adversarial-large p95 latency: `<=500ms`.

### Tier 2: Live MCP Transport Proof

This is missing today. In-process handler tests prove dispatcher behavior, but they do not prove packaging, process startup, stdio framing, Streamable HTTP sessions, or JSON-RPC round-trips.

Add tests or scripts that:

- Build `dist`.
- Spawn `node dist/server.js` over stdio.
- Send `initialize`.
- Send `notifications/initialized`.
- Call `tools/list`.
- Call representative PASS and BLOCK `tools/call` requests.
- Assert `structuredContent`, `isError`, and schema validity.
- Close the process cleanly.
- Start `node dist/server.js --transport http --host 127.0.0.1 --port 0` or a known free port.
- Hit `/healthz`.
- Perform Streamable HTTP initialize/session flow.
- Call `tools/list` and representative `tools/call`.

Required result:

- Stdio round-trip failures: `0`.
- HTTP round-trip failures: `0`.
- Public tools listed by live server: `11`.
- Internal leaf tools return `MethodNotFound`.
- Representative structured outputs validate against `outputSchema`.

### Tier 3: Mutation Testing

Mutation testing asks whether tests fail when production logic is deliberately changed. It is the best next gate for "do these tests actually protect BLOCK paths?"

Recommended runner: StrykerJS with the Vitest runner.

Add dev dependencies:

```sh
TPF_LLM_TOOL=codex tpf npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner
```

Optional if type-aware checking is needed:

```sh
TPF_LLM_TOOL=codex tpf npm install --save-dev @stryker-mutator/typescript-checker
```

Add script to `package.json`:

```json
{
  "scripts": {
    "test:mutation": "stryker run"
  }
}
```

Initial `stryker.config.json`:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "plugins": ["@stryker-mutator/vitest-runner"],
  "mutate": [
    "src/tools/finalize_deliverable.ts",
    "src/tools/trace_conclusion_numbers.ts",
    "src/tools/check_quote_grounding.ts",
    "src/tools/check_answer_against_constraints.ts",
    "src/tools/check_freshness.ts",
    "src/host/enforcement_host.ts",
    "src/mcp/tool-call.ts",
    "src/mcp/tool-definitions.ts"
  ],
  "vitest": {
    "configFile": "vitest.config.ts",
    "related": false
  },
  "thresholds": {
    "high": 80,
    "low": 70,
    "break": 70
  },
  "reporters": ["clear-text", "html", "json"]
}
```

Run:

```sh
TPF_LLM_TOOL=codex tpf npm run test:mutation
```

Release criteria:

- Overall mutation score: `>=80%`.
- BLOCK-path surviving mutants: `0 unresolved`.
- Surviving mutants in release-critical files must be triaged as one of:
  - real test gap, fix with a regression test;
  - equivalent mutant, document why;
  - unreachable/dead code, remove or isolate.

High-priority mutant classes:

- Removing `finalize_missing_inputs` blocks.
- Flipping `finalize_verdict` or `status`.
- Weakening exact hash comparison in host enforcement.
- Dropping `contract_authority='host'` or `profile_source='host_supplied'`.
- Replacing strict answer-number mode with warning-only behavior.
- Loosening quote containment.
- Removing claim id/text/kind binding.
- Accepting date-only or offset-less freshness timestamps.
- Ignoring constraint violations.
- Allowing internal leaf tools on the public MCP surface.
- Omitting `structuredContent` from failure responses.

### Tier 4A: Failure Discovery and Value Backlog

Correctness proof tells us whether deterministic gates work. Failure discovery tells us which expensive tagent failures still reach the user, why they escape, and which deterministic intervention would prevent or reduce them with acceptable friction.

Run Tier 4A before making product-value claims and before expanding the benchmark beyond seed pilots.

Required artifacts:

- `VALUE_GAP_REPORT.md`
- `VALUE_BACKLOG.jsonl`
- `benchmark/tasks/*.jsonl`
- `benchmark/defects/*.jsonl`
- `benchmark/results/*.jsonl`

Process:

1. Collect real tagent deliverables or realistic deliverables derived from actual workflows.
2. Score each deliverable with objective rubrics.
3. Identify high-severity defects.
4. Classify why each defect escaped.
5. Map each escape to an intervention.
6. Rank interventions by expected value.
7. Build the smallest high-value intervention.
8. Re-run the same tasks.
9. Keep only changes that reduce defects without unacceptable friction.

Minimum starting corpus:

- 25 research / factual QA deliverables.
- 25 numeric / finance / benchmark deliverables.
- 25 implementation-plan deliverables.
- 25 architecture / design-review deliverables.
- 25 decision / recommendation deliverables.
- 25 coding-agent task summaries or PR plans.

Task records must include:

```json
{
  "task_id": "arch-014",
  "task_type": "architecture",
  "original_request": "...",
  "agent_answer": "...",
  "artifacts_supplied": {
    "sources": [],
    "claims": [],
    "numbers": [],
    "constraints": [],
    "contract": null
  },
  "mode": "baseline",
  "model": "...",
  "tool_surface": "none|advisory|facade|raw",
  "accepted_by_user_or_eval": true,
  "notes": ""
}
```

Defect records must include:

```json
{
  "task_id": "finance-008",
  "defect_id": "finance-008-D3",
  "defect_type": "unsupported_claim|wrong_number|constraint_violation|false_done|stale_source|quote_laundering|missing_failure_branch|bad_plan|answer_swap|format_failure|other",
  "severity": "critical|high|medium|low",
  "user_impact": "...",
  "evidence": "...",
  "would_user_notice": false,
  "objective_oracle": "source_span|arithmetic|constraint|unit_test|rubric|human_seeded_gold",
  "current_ct_mcp_catches": "yes|no|partial",
  "escape_reason": "...",
  "candidate_intervention": "host_contract|artifact_template|numeric_dag|predicate_grounding|constraint_contract|release_gate|router|warning_only|not_deterministically_checkable",
  "confidence": 0.8
}
```

Backlog records must include:

```json
{
  "intervention": "numeric_derivation_dag",
  "failure_modes_addressed": ["numeric_flattening", "wrong_method"],
  "affected_tasks": ["finance-001", "finance-007"],
  "critical_count": 1,
  "high_count": 8,
  "medium_count": 12,
  "low_count": 0,
  "preventability": 0.8,
  "confidence": 0.85,
  "affected_workflow_importance": 4,
  "implementation_cost": 5,
  "friction_risk": 3,
  "value_score": 12.7,
  "recommended_action": "build|prototype|defer|kill",
  "minimum_viable_change": "..."
}
```

Benchmark result records must include:

```json
{
  "run_id": "value-benchmark-2026-06-01-E3",
  "mode": "baseline|advisory|enforced|enforced_host_contract|debug_raw",
  "ablation_id": "baseline|advisory|enforced_current|host_contract|artifact_template|numeric_dag|predicate_grounding|constraint_contract|strict_release_integration|debug_raw",
  "corpus_version": "value-corpus-v1",
  "oracle": "deterministic_fixture_grader_no_llm|source_span|arithmetic|constraint|unit_test|human_seeded_gold",
  "seed_or_directional": false,
  "task_count": 150,
  "task_success": 120,
  "task_success_delta": 0.12,
  "high_severity_defects": 10,
  "medium_severity_defects": 18,
  "high_severity_defects_avoided": 8,
  "medium_severity_defects_avoided": 12,
  "unsupported_claims": 4,
  "wrong_numbers": 3,
  "constraint_violations": 2,
  "false_done": 5,
  "avoided_false_done": 7,
  "false_blocks": 1,
  "false_block_rate_clean_controls": 0.01,
  "artifact_formatting_failures": 2,
  "revision_count": 14,
  "excessive_revision_loops": 1,
  "average_latency_ms": 42,
  "latency_penalty": 0,
  "average_tool_calls": 2.4,
  "correction_success_rate": 0.75,
  "net_value": 91,
  "notes": ""
}
```

Allowed `ablation_id` values:

- `baseline`: no CT-MCP gate.
- `advisory`: `plan_checks` guidance only.
- `enforced_current`: current finalize gate with agent-declared contract.
- `host_contract`: host-authored contract plus finalize gate and answer binding.
- `artifact_template`: host contract plus artifact templates/checklists.
- `numeric_dag`: artifact template mode plus numeric derivation DAG.
- `predicate_grounding`: artifact template mode plus predicate-aware grounding.
- `constraint_contract`: artifact template mode plus host-authored constraint contracts.
- `strict_release_integration`: artifact template mode plus mandatory `ct-enforce` strict release behavior.
- `debug_raw`: diagnostic-only broad tool surface; not a product-value mode.

Severity is user-impact based:

| Severity | Meaning |
|---|---|
| Critical | Could cause a bad decision, broken release, financial/legal/operational harm |
| High | Materially wrong deliverable; user would likely act on false info |
| Medium | Incomplete, unsupported, or noncompliant but recoverable |
| Low | Style, formatting, minor omission, or non-blocking noise |

Escape-reason taxonomy:

| Escape reason | Meaning | Likely fix |
|---|---|---|
| `no_host_contract` | Agent weakened or omitted obligations | Host-authored contracts |
| `contract_underdeclared` | Contract did not include real user constraints | Contract extraction / strict mode |
| `artifact_missing` | Agent did not provide claims/numbers/sources needed to check | Better artifact UX / templates |
| `artifact_malformed` | Agent tried but schema/artifact was hard to produce | Templates, examples, auto-fill helpers |
| `tool_not_called` | Check existed but agent skipped it | Host-enforced release path |
| `facade_mismatch` | Wrong use-case tool selected | Better routing / fewer facade tools |
| `quote_laundering` | Span existed but did not support claim | Predicate-aware grounding |
| `distractor_source` | Source was real but irrelevant or weaker than another source | Source authority / distractor tests |
| `numeric_flattening` | Derived intermediate treated as raw input | Multi-step numeric DAG |
| `wrong_method` | Arithmetic was right but formula/method was wrong | Formula/method constraints |
| `constraint_omitted` | Answer violated a user constraint not represented in contract | Constraint contracts |
| `freshness_gap` | Source stale/undated but not blocked | Host eval time + freshness policy |
| `false_block` | Tool blocked legitimate answer | Relax gate or move to warning |
| `friction_failure` | Agent gave up or over-edited due to tool burden | Artifact UX / fewer required fields |
| `not_deterministically_checkable` | Needs human/model judgment | Warning/rubric only, not BLOCK |

Map failure shape to value lever:

| If the top failures are... | Build next |
|---|---|
| Agents omit constraints, claims, or evidence level | Host-authored contracts |
| Agents fail to provide usable artifacts | Artifact templates and `plan_checks` checklist |
| Correct calculations are blocked or wrong multi-step methods pass | Numeric derivation DAG |
| Claims cite real but irrelevant spans | Predicate-aware grounding |
| Answers violate explicit user ask | Constraint contracts |
| Agents skip checks or ship different answer | Live release gate / `ct-enforce` strict mode |
| Agents choose wrong facade | Router / two-tool surface |
| Blocks are noisy | Demote gate to warning or improve precision |

Value backlog entries use:

```txt
value_score =
  frequency
  * severity_weight
  * preventability
  * confidence
  * affected_workflow_importance
  / implementation_cost
  / friction_risk
```

Recommended severity weights:

- Critical: `10`
- High: `6`
- Medium: `3`
- Low: `1`

For every real defect, record counterfactuals:

- Would current CT-MCP catch this if used perfectly?
- Would host-enforced CT-MCP catch this?
- Would host-enforced plus host contract catch this?
- Would proposed feature X catch this?
- Would feature X create false blocks on clean controls?

Ship a value feature if:

- High-severity defects fall by `>=25%` in the affected workflow.
- False-block rate on clean controls stays `<=2%`.
- Average extra latency stays within budget.
- Artifact-formatting failures do not materially increase.

Keep as experimental if:

- Defect reduction is `10-25%`.
- Value is concentrated in one workflow only.
- Friction is high but fixable.

Kill or redesign if:

- No measurable defect reduction.
- False blocks exceed threshold.
- Agents avoid or fail the artifact format.
- Benefit only appears on synthetic happy paths.

Seed table from the existing value pilot:

| Top defect | Frequency | Severity | Current MCP catches? | Why escaped? | Candidate fix | Seed value score |
|---|---:|---|---|---|---|---:|
| Numeric derivations false-block correct answers and encourage unsafe flattening | 5/12 enforced pilot attempts across 3 task-level defects | Medium friction / format risk | Partial | `numeric_flattening` | Numeric derivation DAG plus method constraints | 10.9 |
| Unsupported factual claim can reach baseline answer | 1/12 baseline pilot defects | High | Partial | `quote_laundering` risk | Predicate-aware grounding | 15.5 |
| Toy benchmark cannot prove product value | 12/12 pilot tasks too easy for numeric baseline defects | Critical evidence gap | N/A | low real error density | Real-failure corpus and error-density benchmark | 15.0 |
| Agent-authored contracts can underdeclare obligations | Not measured yet | Critical | No if omitted | `no_host_contract` | Host-authored contracts | 14.0 |
| Gate can be skipped or final answer can differ outside strict host path | Not measured yet | Critical | No if skipped | `tool_not_called` | Strict `ct-enforce` release integration | 13.5 |
| Wrong method can self-trace numerically | Counterfactual from N4 gate-limit probe | Medium measured friction plus high counterfactual risk | No | `wrong_method` | Formula/method constraints | 4.2 |
| Spurious warning on clean factual answer | 1/12 pilot attempts | Low/medium | Warning noise | heuristic overreach | Fix/demote heuristic | 5.0 |

### Tier 4A Test-Design Handoff

Before runtime feature work starts, the test design must make each candidate value lever measurable against objective evidence and clean controls.

Oracle and command matrix:

| Surface | Proof purpose | Primary command | Required evidence |
|---|---|---|---|
| JSONL artifacts | Records parse and contain required task, defect, backlog, result, oracle, ablation, and friction fields | `TPF_LLM_TOOL=codex tpf node -e "<jsonl parse/schema check>"` | Parsed record counts and missing-field failures are recorded |
| Facade benchmark fixture | Product facade modes stay deterministic and raw tools stay diagnostic-only | `TPF_LLM_TOOL=codex tpf npm test -- tests/proof/facade_value_benchmark.test.ts` | Metrics include false-done, clean-control false-block, artifact-formatting failures, revisions, correction success, latency, tool calls |
| Benchmark structure | Benchmark fixtures and publication/report tests do not overclaim live product value | `TPF_LLM_TOOL=codex tpf npm test -- tests/benchmark` | Historical reports are marked historical or regenerated |
| Artifact templates | `plan_checks` produces directly usable finalize checklists and minimal artifacts | `TPF_LLM_TOOL=codex tpf npm test -- tests/tools/factual_qa_slice.test.ts tests/tools/numeric_constraints.test.ts tests/proof/correctness_gates.test.ts` | Template examples map to `finalize_deliverable` inputs and do not add unnecessary blockers |
| Numeric derivation DAG | Multi-step calculations are expressible without unsafe flattening | `TPF_LLM_TOOL=codex tpf npm test -- tests/tools/numeric_constraints.test.ts tests/proof/correctness_gates.test.ts` | Percent change, weighted average, derived intermediate refs, final-answer binding, and wrong-method rejection |
| Predicate-aware grounding | Cited spans support the actual predicate, not just nearby text | `TPF_LLM_TOOL=codex tpf npm test -- tests/tools/factual_qa_slice.test.ts tests/proof/correctness_gates.test.ts` | Wrong predicate, distractor source, date/entity/status mismatch, and clean paraphrase controls |
| Strict release integration | `ct-enforce` strict mode is machine-consumable and mandatory when selected | `TPF_LLM_TOOL=codex tpf npm test -- tests/host/enforcement_host.test.ts` plus focused CLI tests when added | Host contract required, weak agent contract rejected, finalize block rejected, hash mismatch rejected, success path releases |
| Full local gate | TypeScript and all current unit/proof tests pass after scoped changes | `TPF_LLM_TOOL=codex tpf npm run build` and `TPF_LLM_TOOL=codex tpf npm test` | Full pass or exact blocker and residual risk |
| Missing release gates | Mutation, live stdio/http, and real agent benchmark remain explicit if not run | `TPF_LLM_TOOL=codex tpf npm run test:mutation`, `TPF_LLM_TOOL=codex tpf npm run test:transport`, explicit real-agent runbook when implemented | Not-run gates are listed as unproven; do not imply product value from skipped gates |

Red-first fixture requirements:

- Corpus and ablation harness:
  - A seed result row missing `ablation_id`, `oracle`, or friction fields must fail schema validation.
  - `debug_raw` must remain excluded from product-value modes.
  - Net-value computation must penalize false blocks, revision loops, latency, and artifact-formatting failures.
- Artifact templates:
  - Factual QA template must include `sources`, `claims`, claim kind, source id, quoted span, and supporting token examples.
  - Numeric template must include raw inputs, final numbers, arithmetic checks, and, once implemented, derivation node examples.
  - Constraint template must include `constraints`, `structured_answer`, required fields, allowed/forbidden values, and request/source anchoring.
  - A template-generated minimal artifact must pass `finalize_deliverable` for a clean control.
- Numeric derivation DAG:
  - Percent change from 20 to 25 should pass without flattening the derived percent as a raw input.
  - Two-step savings should allow an intermediate derived subtotal and bind the final answer to the final node.
  - Weighted average should require the weighted-average method, not a simple mean.
  - A flattened derived intermediate that is not host/source/request anchored should block.
  - A self-consistent wrong method should block even when arithmetic is internally consistent.
- Strict release integration:
  - Strict mode without a host-authored contract should reject.
  - Strict mode with `weak_agent_declared` should reject.
  - Strict mode should return stable JSON and exit codes for release, gate block, schema/input error, and hash mismatch.
  - Corrective prompts must be compact and tied to blocking issue ids.
- Predicate-aware grounding:
  - A real quote with the right entity but wrong status/comparison should block or warn according to claim risk.
  - A distractor source that contains the words but is weaker/irrelevant should not satisfy a primary-source requirement.
  - Numeric/date/entity/status predicates must match source support.
  - Clean paraphrases with the correct predicate must not false-block.

Implementation order for tests:

1. Add schema and fixture tests for JSONL result/backlog records and ablation ids.
2. Extend facade benchmark fixture tests for friction metrics and net value before feature code.
3. Add `plan_checks` artifact-template tests before numeric DAG or predicate grounding.
4. Add numeric DAG red tests before numeric implementation.
5. Add strict release CLI/host tests before changing `ct-enforce`.
6. Add predicate-grounding adversarial and clean-control tests before grounding implementation.

### Tier 4: Product-Value Benchmark

Correctness proof and product-value proof are different. Correctness proof shows the gate works on deterministic obligations. Product-value proof asks whether agents produce better deliverables with acceptable friction.

Tier 4 consumes the Tier 4A value backlog. Do not claim product value from a benchmark whose task set does not contain the failure modes the backlog says matter.

Required benchmark modes:

- Baseline: no CT-MCP gate.
- Advisory: planning/check guidance but no release block.
- Enforced: agent-declared contract and finalize gate.
- Enforced + host contract: host-authored contract, finalize gate, and anti-swap hash check.

Feature ablations for top backlog items:

- E0: Enforced, current.
- E1: E0 plus host-authored contracts.
- E2: E1 plus artifact templates.
- E3: E2 plus numeric derivation DAG.
- E4: E2 plus predicate-aware grounding.
- E5: E2 plus constraint contracts.
- E6: E2 plus strict release integration.

Do not expose the raw 17-tool surface in product-value runs. Raw surface belongs only in a separate diagnostic condition for tool-selection experiments.

Benchmark requirements:

- Fixed task corpus before running.
- Clean controls and adversarial cases.
- Long-context grounding tasks.
- Distractor-source grounding tasks.
- Multi-step numeric tasks.
- Hard constraints/restatement tasks.
- Anti-swap tasks.
- Unsupported-claim traps.
- Objective graders only; no model judgment as deterministic oracle.
- Record revisions/tool calls/latency, not just final correctness.

Metrics:

- Task success.
- High-severity defects per task.
- Unsupported claims per task.
- Wrong numbers per task.
- Constraint violations per task.
- False done rate.
- False-block rate on clean controls.
- Average latency.
- Average tool calls.
- Revision count.
- Artifact-formatting block count.
- Correction success rate.

Net-value score:

```txt
net_value =
  avoided_high_severity_defects * 10
+ avoided_medium_severity_defects * 3
+ avoided_false_done * 8
+ task_success_delta * 5
- false_blocks * 8
- excessive_revision_loops * 3
- latency_penalty
- artifact_formatting_failures * 2
```

Release criteria for product-value claim:

- Enforced + host contract reduces false done versus baseline and advisory.
- Clean-control false-block rate remains acceptably low.
- Friction is bounded and explained.
- Results are not based only on happy paths.
- Null results are reported as null results.

## What Adds the Most Value

### 1. Host-Authored Contracts

This is the biggest quality lever.

Agent-authored contracts are self-graded. An agent can declare `freeform`, omit claims, omit constraints, or weaken evidence level. The host must author or derive the contract before the agent can finalize.

Needed work:

- Make `ct-enforce` the normal release path.
- Require host-authored `ContractSpec` for high-risk deliverables.
- Add helpers that derive a contract from host-known task metadata.
- Treat `weak_agent_declared` as non-releaseable in strict host mode.
- Keep `finalize_deliverable` warning behavior for pure MCP use, but let the host escalate.

Expected quality impact:

- Fewer false done releases.
- Less obligation omission.
- Stronger connection between the user request and checked artifacts.

### 2. Better Artifact UX

Agents need fewer choices and better structured templates.

Needed work:

- Provide templates for:
  - factual QA sources and claims;
  - numeric inputs, derivations, and arithmetic checks;
  - constraints and structured answers;
  - freshness windows and host eval time;
  - case partitions.
- Make `plan_checks` output directly usable as a finalize artifact checklist.
- Add examples for common task types.
- Prefer a two-tool facade:
  - `plan_checks`
  - `finalize_deliverable`
- Keep leaf tools as internal/debug tools.

Expected quality impact:

- Lower tool-choice confusion.
- Fewer malformed artifacts.
- Higher chance the agent actually supplies the evidence needed to pass.

### 3. Multi-Step Numeric Derivation DAGs

Current numeric tracing catches wrong re-derivations, but it is awkward for multi-step calculations and can false-block correct work unless intermediates are flattened into inputs. Flattening weakens the proof because derived values start looking like raw inputs.

Needed work:

- Replace flat `conclusion_numbers` with a derivation graph:
  - raw inputs;
  - derived intermediate nodes;
  - final conclusion nodes.
- Allow derived nodes to reference prior derived nodes.
- Track units and dimensions.
- Support formula/method constraints.
- Require final answer numbers to bind to derivation nodes.
- Block flattened derived outputs unless anchored by host/source/request.

Useful operations:

- `sum`
- `diff`
- `product`
- `ratio`
- `pct_of`
- `pct_change`
- `weighted_average`
- `mean`
- `compound_growth`
- `unit_conversion`

Expected quality impact:

- Fewer numeric false-blocks.
- Better detection of wrong method, not just wrong arithmetic.
- Stronger coverage for finance, billing, benchmark, and planning tasks.

### 4. Predicate-Aware Grounding

Quote containment is necessary but not sufficient. A claim can point to a verbatim but irrelevant span.

Needed work:

- Bind claim kind to expected predicate tokens.
- For numeric claims, require the claim number and source number to match.
- For date claims, require date token match.
- For entity claims, require entity token match.
- For status/comparison claims, require the predicate phrase to appear or be anchored.
- For causal/recommendation claims, keep weak support unless the source explicitly supports causality/action.
- Add distractor-source tests.

Expected quality impact:

- Fewer unsupported factual claims.
- Less "quote laundering" where any nearby span is treated as support.
- Better RAG answer discipline.

### 5. Constraint Contracts

Hard user constraints need first-class host contracts.

Needed work:

- Extract host-authored constraints from task/request metadata.
- Require `source_quote` anchoring to the original request.
- Require `structured_answer` for constrained outputs.
- Make missing required fields release-blocking in host mode.
- Add benchmark tasks for JSON shape, numeric bounds, allowed values, exclusions, and exact text requirements.

Expected quality impact:

- Fewer "looks plausible but violates the ask" outputs.
- Stronger structured-output reliability.

### 6. Live Release Gate Integration

The agent quality improvement only matters if the gate is mandatory.

Needed work:

- Add examples for CI/pipeline usage of `ct-enforce`.
- Add a host-wrapper integration guide.
- Add a strict mode:
  - host contract required;
  - `weak_agent_declared` rejects;
  - profile downgrade warnings reject;
  - missing high-risk artifacts reject when the host declares them required.
- Make release decisions easy to consume:
  - JSON output;
  - exit codes;
  - corrective prompt;
  - compact blocking issue list.

Expected quality impact:

- Prevents agents from skipping the gate.
- Prevents "checked one thing, shipped another."
- Makes CT-MCP useful in real workflows rather than advisory only.

## Suggested CI Matrix

| Gate | Command | When | Required for |
|---|---|---|---|
| Typecheck | `npm run build` | every PR | all merges |
| Unit/proof tests | `npm test` | every PR | all merges |
| Live stdio/http probe | `npm run test:transport` | MCP/server changes | beta/stable |
| Mutation focused | `npm run test:mutation` | nightly/release | stable |
| Product benchmark deterministic | `npm run benchmark:proof` | host/tool changes | beta/stable |
| Real agent benchmark | explicit runbook | release candidates | value claims |

## Suggested Roadmap

### Immediate

- Add Stryker mutation config.
- Add `test:mutation`.
- Add live stdio/http transport tests.
- Keep `PROOF_REPORT.md` honest: partial until those run.

### Near Term

- Add host strict mode.
- Add contract/artifact templates.
- Add multi-step numeric derivation DAG.
- Add predicate-aware grounding tests.
- Add objective product-value benchmark runbook.

### Release Candidate

- Mutation score `>=80%`.
- No unresolved BLOCK-path surviving mutants.
- Live stdio/http protocol proof passes.
- Host-enforced benchmark shows lower false done without unacceptable false blocks.
- Known limitations documented in README/release notes.

## Non-Negotiable Reporting Rules

- Do not claim "proved" unless the test actually ran.
- Do not hide false blocks.
- Do not lower test counts to make CI pass.
- Do not use model judgment as an oracle for deterministic checks.
- Do not treat hash witnesses as proof that prior checks ran.
- Do not count agent-authored contracts as host-authored.
- Do not allow `finalize_deliverable` to PASS with missing required artifacts.
- Do not benchmark only happy paths.
- Preserve the distinction between correctness proof and product-value proof.
