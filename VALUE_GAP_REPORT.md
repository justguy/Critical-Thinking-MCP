# CT-MCP Value Gap Report

Status: seed report from existing repo evidence. Created 2026-06-01.

This report starts the Tier 4A failure-discovery loop. It is not the final product-value benchmark and should not be used to claim broad product value. Its job is to turn the existing pilot and strategy notes into a ranked value-discovery backlog.

## Evidence Used

- `benchmark/value_pilot/PILOT_DESIGN.md`
- `benchmark/value_pilot/PILOT_RESULTS.md`
- `docs/designs/TESTING_AND_VALUE_STRATEGY.md`

The value pilot used two 6-task tagent runs against the real branch MCP gate and host layer. It is directional only. The pilot showed one unsupported-claim defect removed, five numeric false-blocks across enforced attempts, one spurious warning, and a ceiling effect from tasks that were too easy to produce many baseline defects.

## Initial Top Defects

| Top defect | Frequency | Severity | Current MCP catches? | Why escaped? | Candidate fix | Seed value score |
|---|---:|---|---|---|---|---:|
| Numeric derivations false-block correct answers and encourage unsafe flattening | 5/12 enforced pilot attempts across 3 task-level defects | Medium friction / format risk | Partial | `numeric_flattening` | Numeric derivation DAG plus method constraints | 10.9 |
| Unsupported factual claim can reach baseline answer | 1/12 baseline pilot defects | High | Partial | `quote_laundering` risk | Predicate-aware grounding | 15.5 |
| Toy benchmark cannot prove product value | 12/12 pilot tasks too easy for numeric baseline defects | Critical evidence gap | N/A | low real error density | Real-failure corpus and error-density benchmark | 15.0 |
| Agent-authored contracts can underdeclare obligations | Not measured yet | Critical | No if omitted | `no_host_contract` | Host-authored contracts | 14.0 |
| Gate can be skipped or final answer can differ outside strict host path | Not measured yet | Critical | No if skipped | `tool_not_called` | Strict `ct-enforce` release integration | 13.5 |
| Wrong method can self-trace numerically | Counterfactual from N4 gate-limit probe | Medium measured friction plus high counterfactual risk | No | `wrong_method` | Formula/method constraints | 4.2 |
| Spurious warning on clean factual answer | 1/12 pilot attempts | Low/medium | Warning noise | heuristic overreach | Fix/demote heuristic | 5.0 |

## Current Conclusion

The current deterministic gate proves mechanics better than product value. The strongest measured value signal is factual grounding: the gate forced removal of one unsupported claim. The strongest measured cost is numeric false-blocking: correct answers were rejected because the current arithmetic artifact model does not represent multi-step derivations cleanly.

The highest-risk unmeasured gaps are host-authored contracts and strict release integration. Their backlog scores are counterfactual seed scores, not measured defect counts. If the host does not author obligations or enforce the release path, CT-MCP can still be skipped or self-graded.

## Prototype Implementation Status

Status as of 2026-06-01: three high-value interventions now have focused local prototypes, but none has real-agent product-value benchmark evidence yet.

| Intervention | Prototype status | Focused evidence | Product-value status |
|---|---|---|---|
| Strict release integration | Implemented | Host/CLI tests cover strict host contract requirement, JSON errors, exit codes, gate blocks, and hash mismatch. | Not proven against live transport or real tagent runs. |
| Numeric derivation DAG | Implemented | Numeric tests cover percent change, two-step DAGs, weighted averages, final-answer binding, flattened input rejection, and wrong-method rejection. | Not proven to reduce real numeric false blocks or artifact friction. |
| Predicate-aware grounding | Implemented | Factual tests cover clean paraphrase, wrong predicate, distractor/entity mismatch, temporal/date mismatch, and weak causal support. | Not proven to reduce real quote laundering without false blocks at corpus scale. |

These are implementation proofs, not ship-level value proof. The benchmark still needs representative real-failure tasks, clean controls, and feature ablations before external product-value claims are supportable.

## Impact Map

Subagent codebase-explorer and test-designer passes were run on 2026-06-01. Both were read-only.

### Runtime and Enforcement Surfaces

- Public MCP registration flows through `src/server-runtime.ts`; `tools/list` returns the filtered public `TOOLS` set.
- `src/mcp/tool-definitions.ts` keeps deliverable leaf tools internal through `INTERNAL_TOOL_NAMES`. The public MCP surface stays broader than the product facade, but product-value runs should use only `plan_checks` and `finalize_deliverable`.
- `src/mcp/tool-call.ts` dispatches public handlers, rejects unknown/internal tools, caps inputs/diagnostics, and returns `structuredContent` on success and enforcement failure.
- `src/tools/plan_checks.ts` and `src/enforcement/check_planner.ts` provide the policy/checklist surface. This is advisory planning, not the release gate.
- `src/tools/finalize_deliverable.ts` is the MCP chokepoint: it re-executes required checks, blocks missing mandatory artifacts, runs verify-if-present checks, and returns `answer_text_hash`.
- `src/host/enforcement_host.ts` is the actual release gate: the host authors the contract, rejects finalize `BLOCK`, and rejects surfaced-answer hash mismatch.
- `src/host/cli.ts` is the likely home for strict `ct-enforce` release behavior and machine-consumable exit codes.

### Existing Proof and Benchmark Surfaces

- `tests/proof/protocol_schema.test.ts` pins the public/internal tool split and validates `outputSchema` / `structuredContent`.
- `tests/proof/correctness_gates.test.ts` covers finalize bypass attempts and deterministic gate behavior.
- `tests/host/enforcement_host.test.ts` covers host release rejection, gate blocks, and anti-swap hash mismatch.
- `tests/proof/fuzz_host_latency.test.ts` covers fixed-seed fuzz and latency budgets.
- `benchmark/proof/facade_value_benchmark.ts` is the strongest current value-benchmark scaffold. It defines product modes, objective result types, deterministic fixture scoring, host-contract checks, and false-done metrics.
- `tests/proof/facade_value_benchmark.test.ts` verifies the facade corpus is fixed, deterministic, no-LLM, and separates product modes from raw debug mode.
- `benchmark/value_pilot/grader.mjs` and `benchmark/value_pilot/tasks.json` provide useful seed task/grader structure, but the grader is mostly substring/proxy based.
- `benchmark/scoring/index.ts` combines deterministic features with LLM judge scoring; useful for secondary analysis, but not a deterministic oracle for product-value claims.

### Gaps That Block Product-Value Claims

- The broad benchmark runner still has synthetic placeholder baseline/prompted rows, so it cannot support live model win-rate or error-density claims by itself.
- Existing seed/pilot tasks are too small and too easy to establish broad product value.
- Existing objective checks are often proxy regex/substrings rather than durable oracles.
- Raw model output capture, per-defect oracle inputs, blinded baseline/enforced runs, confidence intervals, false-block cost accounting, and representative high-error workflows are missing.
- `benchmark/reports/BENCHMARK_REPORT.md` contains strong publication-style claims that should not be treated as current proof unless regenerated from the live, objective benchmark pipeline.

### Implementation Risks

1. Host-authored contracts are the highest-impact unmeasured path. Outside host mode, agent-authored contracts still let the agent omit obligations.
2. Numeric derivation remains the clearest measured friction point. Flat `conclusion_numbers` cannot represent multi-step workflows without false blocks or unsafe flattened intermediates.
3. Artifact UX is adoption-critical. The gate blocks missing required artifacts correctly, but agents need templates and autofill paths to produce valid sources, claims, numbers, constraints, and structured answers.
4. Predicate-aware grounding is needed before factual QA value can be claimed beyond span containment.
5. Product-value evidence is still seed-level. The next benchmark must intentionally sample workflows with real baseline error density.

## Next Required Evidence

1. Build a real-failure corpus with objective rubrics across factual QA, numeric/finance, implementation planning, architecture review, decisions/recommendations, and coding-agent summaries.
2. Record every defect in `benchmark/defects/*.jsonl`.
3. Rank candidate interventions in `VALUE_BACKLOG.jsonl`.
4. Run benchmark modes and feature ablations only after the task set contains the failure modes being measured.
5. Report null results as null results.
