# CT-MCP Robustness Proof Report

## Executive Summary

Verdict: PARTIAL.

The update has clear correctness value: the public surface is reduced to the 11-tool facade, every public tool advertises an `outputSchema`, representative PASS and BLOCK calls emit schema-valid `structuredContent`, `finalize_deliverable` blocks the tested bypass attempts, host enforcement blocks gate failures and answer swaps, deterministic fuzz cases do not crash, and latency is well inside budget on this machine. Product-value evidence is narrower: a fixed no-LLM benchmark shows host-authored contracts reduce false done releases, but it is not a real agent benchmark and the earlier value pilot remains a null/toy result. As of 2026-06-01, strict release integration, numeric derivation DAGs, and predicate-aware grounding have focused local prototypes with tests. Biggest remaining risk: the proof still does not include mutation testing, a live stdio/http protocol transport round-trip, or the real tagent product-value benchmark, and PASS remains limited to supplied artifacts and host-authored obligations.

## 2026-06-01 Value Discovery Addendum

| Item | Result |
|---|---|
| Tier 4A artifacts | `VALUE_GAP_REPORT.md`, `VALUE_BACKLOG.jsonl`, seed task/defect/result JSONL created and parse cleanly |
| Strict release prototype | implemented: `strict_release`, JSON CLI errors, exit codes 0/1/2/3, host-contract rejection |
| Numeric DAG prototype | implemented: `numeric_derivation`, raw/intermediate/final nodes, final-answer binding, percent change, weighted average, flattened-input and wrong-method tests |
| Predicate grounding prototype | implemented: narrow deterministic predicate checks for wrong predicate, distractor/entity mismatch, date/temporal mismatch, and weak causal support |
| Full local test suite | pass: 18 files, 378 tests |
| Build | pass: `npm run build` |
| Still unproven | mutation testing, live transport proof, real tagent benchmark, feature ablations on representative real-failure corpus |

## Repo State

| Field | Value |
|---|---|
| Commit hash | `0a5535fb08977ef4ebe3b81ba96c661ed9746c70` |
| Branch | `tool-surface-consolidation` |
| Date/time | `2026-05-31T09:04:08Z` |
| Node | `v24.13.0` |
| npm | `11.6.2` |
| OS | `Darwin 24.6.0 x64` |
| CPU | `Intel(R) Core(TM) i7-8850H CPU @ 2.60GHz` |
| Relevant env vars | `TPF_LLM_TOOL=codex`; no `CT_MCP_*` env vars observed via filtered env probe |
| Dirty worktree | yes: tracked edits plus pre-existing untracked `.claude/`, `.hoplon/`, `ct-mcp-0.1.0-beta.3.tgz`, `html/screenshots/` |

## Baseline

| Check | Result |
|---|---|
| Typecheck | pass: `npm run build` |
| Existing tests | pass |
| Existing test count | 296 |
| Full test count after proof additions | 378 |
| Public tools listed | 11 |
| Internal leaf tools hidden | 7 hidden from public surface |
| Tools with outputSchema | 11/11 public tools |
| structuredContent emitted | yes: 12 representative PASS/BLOCK calls |

## Correctness Gates

| Gate | Target | Observed | Pass? |
|---|---:|---:|---|
| Bypass rate | 0 | 0/15 should-block or bypass cases | yes |
| False-block rate | 0 | 0/7 should-pass corpus cases | yes |
| Differential disagreements | 0 | 0/15 independent-helper checks | yes |
| Finalize chokepoint bypasses | 0 | 0/7 bypass attempts | yes |
| Fuzz crashes/hangs | 0 | 0/360 deterministic fuzz cases | yes |
| Schema-invalid outputs | 0 | 0/12 representative structured outputs | yes |
| Determinism mismatches | 0 | 0/5 repeatability probes | yes |
| Protocol round-trip failures | 0 | 0/14 in-process `tools/call` handler probes | partial: live stdio/http not run |
| Mutation score | >=80% | not run | no |
| BLOCK-path surviving mutants | 0 unresolved | not run | no |
| p95 latency typical | <=50ms | 0.099ms over 150 cases | yes |
| p95 latency adversarial-large | <=500ms | 2.783ms over 30 cases | yes |

Fuzz details: 120 valid-ish MECE partitions, 144 numeric tracing cases, 96 freshness cases, plus 3 asserted malformed-input validation cases.

## Product-Value Benchmark

This is a deterministic fixture benchmark, not an LLM/tagent field benchmark. Product modes expose only the facade tools: `plan_checks` and `finalize_deliverable`. The separate `debug_raw` diagnostic condition exposes 17 tools and is not counted as a product mode.

| Mode | Task success | High-sev defects/task | Unsupported claims/task | Wrong numbers/task | Constraint violations/task | False done rate | Avg latency | Avg tool calls |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 0.20 | 1.20 | 0.20 | 0.80 | 0.20 | 0.80 | 72.0ms | 0.0 |
| Advisory | 0.40 | 0.60 | 0.20 | 0.20 | 0.20 | 0.60 | 112.8ms | 1.0 |
| Enforced | 0.40 | 0.80 | 0.20 | 0.40 | 0.20 | 0.60 | 163.4ms | 2.0 |
| Enforced + host contract | 0.60 | 0.40 | 0.00 | 0.40 | 0.00 | 0.00 | 169.0ms | 2.0 |

Diagnostic raw mode, excluded from product modes: task success 0.60, false done 0.40, average tool calls 2.8, average tool-choice confusion 3.4, exposed tools 17.

## Interpretation

What improved?

- Deterministic correctness evidence is materially stronger: new proof tests cover protocol/schema behavior, differential helper oracles, finalize bypass attempts, host-wrapper release rules, deterministic fuzzing, and latency budgets.
- A protocol/schema bug was fixed: `ENFORCEMENT_FAIL` structured output now includes the typed finalize fields at top level, so failures can validate against the advertised output schema.
- Tool schemas now advertise the freshness, `eval_time`, `case_partition`, and related fields already accepted by the runtime.

What regressed?

- No functional regression found in `npm test` or `npm run build`.
- Product benchmark latency increases from baseline to enforced modes in the deterministic fixture, as expected from extra gate calls.

Did host enforcement matter?

- Yes in the deterministic fixture benchmark: false done drops from 0.60 in agent-declared enforced mode to 0.00 with host-authored contracts and anti-swap checking.

Did host-derived contracts matter?

- Yes. Agent-declared/weak contracts can understate obligations and pass with warnings; host-authored contracts make the same omissions/replacements release-blocking.

Did facade tools reduce agent confusion compared with raw 17-tool access?

- In the deterministic proxy only: product modes expose 2 facade tools, while the raw diagnostic condition exposes 17 and records 3.4 average tool-choice confusions. This is not a live-agent tool-selection proof.

## Bugs Found

Title: Failure structuredContent did not match advertised schema.

Severity: high for MCP clients that validate `structuredContent`.

Repro: call `finalize_deliverable` through `tools/call` with stale freshness inputs that BLOCK; previous failure payload put the real finalize fields under `partial`, leaving required top-level fields absent.

Root cause: failure wrapper replaced the handler result with `{status, blocking_issues, corrective_prompt, partial}` instead of preserving the typed result shape.

Fix: failure payload now spreads the typed result at top level and keeps `partial` for backward compatibility.

Regression test: `tests/proof/protocol_schema.test.ts` validates representative PASS and ENFORCEMENT_FAIL structured outputs against `outputSchema`.

Title: Public schema omitted runtime-supported gate inputs.

Severity: medium.

Repro: `finalize_deliverable` accepts `eval_time` and `case_partition`, and contracts accept `freshness`/`required_fields`, but those fields were not advertised in the public schema.

Root cause: tool schema lagged behind handler capabilities.

Fix: added the missing schema fields.

Regression test: `tests/proof/protocol_schema.test.ts` includes freshness-policy and schema-validation coverage.

## Known Limitations

- Agent-supplied sources are not externally verified.
- Agent-supplied claim lists can omit obligations unless the host supplies or derives the contract.
- Agent-authored contracts do not count as host-authored proof; the report preserves `weak_agent_declared`.
- Source authority metadata is surfaced but not independently authenticated by the MCP function.
- Warning-only signals, such as profile downgrade, require host policy escalation if they should block release.
- Hash witnesses bind exact text only; they do not prove prior checks ran.
- `finalize_deliverable` cannot PASS missing required artifacts in tested cases, but verify-if-present artifacts may be absent by design.
- Benchmark sample size is small and deterministic; it is useful for regression, not market/product lift.
- Mutation testing was not run.
- Live stdio/http transport round-trip was not run; protocol proof used the registered in-process MCP `tools/call` handler.

## Reproduction

Exact commands run:

```sh
TPF_LLM_TOOL=codex tpf npm run build
TPF_LLM_TOOL=codex tpf npm test
TPF_LLM_TOOL=codex tpf npm test -- tests/proof/protocol_schema.test.ts
TPF_LLM_TOOL=codex tpf npm test -- tests/proof/correctness_gates.test.ts
TPF_LLM_TOOL=codex tpf npm test -- tests/proof/facade_value_benchmark.test.ts
TPF_LLM_TOOL=codex tpf npm test -- tests/proof/fuzz_host_latency.test.ts
TPF_LLM_TOOL=codex tpf node --import tsx -e "import { runFacadeValueBenchmark } from './benchmark/proof/facade_value_benchmark.ts'; const r=runFacadeValueBenchmark({includeDebugRaw:true}); for (const mode of r.modes) { const m=r.metrics_by_mode[mode]; console.log([mode,m.task_success_rate,m.high_sev_defects_per_task,m.unsupported_claims_per_task,m.wrong_numbers_per_task,m.constraint_violations_per_task,m.false_done_rate,m.avg_latency_ms,m.avg_tool_calls,m.avg_tool_choice_confusions,m.exposed_tools_count].join('\t')); }"
```

Observed full-suite result:

```text
Test Files  18 passed (18)
Tests       378 passed (378)
```

## Merge Recommendation

Safe to merge behind experimental flag only.

Rationale: the update is stronger and useful for beta hardening, and the deterministic proof suite now catches important schema, host-boundary, and finalize-bypass regressions. It is not a stable release candidate because mutation scoring and live transport round-trip proof have not run, and product-value evidence remains a small deterministic benchmark plus an earlier null toy pilot.
