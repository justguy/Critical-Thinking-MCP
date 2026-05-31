# CT-MCP Robustness Proof — Validation Handoff

> **Reconciliation note (supersedes the 2026-05-30 snapshot).** An earlier draft of this
> handoff targeted a 17-tool public surface and a use-case *façade* layer
> (`verify_research_answer`, `audit_numeric_analysis`, …). That surface was deliberately
> **rejected and removed.** The shipped branch exposes an **11-tool spine**, not façades.
> This version is corrected to the branch. Verify everything yourself in Phase 0 — but the
> corrected baselines below are: **11 public tools**, **296 passing tests**, `outputSchema`
> on **all 11 public tools**, and **no façade tools and no env/debug surface modes**.

You are taking over validation and proof-building for ct-mcp’s deliverable-centric robustness layer.

Your job is not to “review” the idea. Your job is to implement and run an objective test + benchmark
program that proves whether this robustness layer delivers its intended benefit:

1. It blocks real violations.
2. It does not false-block legitimate inputs.
3. It is deterministic and protocol-correct.
4. It cannot be bypassed through the finalization chokepoint.
5. It measurably improves tagent deliverables under host-enforced use.

Work in the repository branch as-is. Do not assume claims are true because docs say so. Verify by
running tests, reading code, adding harnesses, collecting outputs, and producing a proof report with
exact commands, environment, commit hash, and observed metrics.

## Context you must preserve

The implementation exposes an **11-tool public surface**:

- **9 benchmarked analyzers:** `validate_reasoning_chain`, `check_numeric_claims`, `detect_drift`,
  `evaluate_tradeoffs`, `check_plan_validity`, `score_response_quality`, `validate_confidence`,
  `verify_arithmetic`, `detect_concurrency_patterns`.
- **The deliverable spine:** `plan_checks` (deterministic planner) and `finalize_deliverable`
  (keystone gate).

The robustness design allows BLOCK only on **unforgeable within-request signals**:

- verbatim substring containment,
- numeric re-derivation,
- interval/set math,
- graph reachability/cycles/max-flow.

Everything self-declared — authority, trust tier, claim lists, contract criteria, source quality,
profile choice — must be WARNING unless a host/orchestrator explicitly escalates it.

`finalize_deliverable` is the keystone. It must re-run required deterministic checks inline. It must
not trust prior tool-result hashes. A keyless/stateless hash is only a binding token for comparing the
checked answer text to the surfaced answer text; it is not proof that a prior check ran.

Host-side enforcement matters. ct-mcp makes “done” checkable; the host/wrapper must make it mandatory.

### Surface discipline (this replaces the old “prefer façades” instruction)

There is **no façade layer and no debug/prod surface mode** — those were evaluated and rejected. The
seven deterministic check primitives that the deliverable layer depends on
(`check_quote_grounding`, `check_claim_coverage`, `trace_conclusion_numbers`,
`check_answer_against_constraints`, `check_freshness`, `check_case_partition`,
`check_profile_downgrade`) are **internal primitives**: they are filtered out of `tools/list`, removed
from MCP dispatch (calling one over the protocol returns `McpError MethodNotFound`), and re-executed
*inside* `finalize_deliverable`. They remain exported handler functions and are reachable for testing
via **direct import** (exactly as the existing test suite already does) — do not route mechanism tests
through the MCP dispatcher.

For product-value proof, the benchmarked tagent drives the layer through the **spine**, not a menu of
mechanisms: `plan_checks` tells it which obligations/artifacts a deliverable needs, and
`finalize_deliverable` — a single gate parameterized by `task_type`
(`factual_qa | numeric_analysis | planning | decision | concurrency_design | reasoning | freeform`) —
is the one use-case entry it calls. That single-gate spine *is* the small use-case surface; do not
reintroduce façade tools to “simplify selection.”

## Primary deliverables

Produce these artifacts:

1. `PROOF_REPORT.md`
   - Executive summary.
   - Commit hash, branch, Node version, OS, package manager version.
   - Commands run.
   - Results table.
   - Bypass rate.
   - False-block rate.
   - Differential disagreement rate.
   - Fuzz crash/hang count.
   - Schema-validity rate.
   - Determinism matrix results.
   - Protocol round-trip results.
   - Mutation score.
   - p95 latency.
   - Host-enforced benchmark deltas.
   - Known limitations.
   - Repro instructions.

2. Test harnesses and corpora:
   - `tests/property/*.test.ts`
   - `tests/differential/*.test.ts`
   - `tests/integration/finalize_chokepoint.test.ts`
   - `tests/protocol/*.test.ts`
   - `tests/fuzz/*.test.ts`
   - `tests/corpora/should_pass/**`
   - `tests/corpora/should_block/**`
   - `tests/corpora/borderline/**`

3. Optional but preferred:
   - `benchmark/ct_mcp_value/`
   - host-wrapper benchmark harness
   - **spine benchmark harness** (host-enforced `finalize_deliverable` gate over `plan_checks`-derived obligations)
   - CSV or JSONL result logs under `benchmark/results/`

4. CI additions:
   - fast PR suite
   - nightly stress suite
   - release-candidate suite

## Work order

### Phase 0 — Baseline verification

Run:

```bash
npm install
npm run typecheck || npx tsc --noEmit
npm test
```

Also run whatever command lists MCP tools over stdio. Confirm:

* current test count (expected **296**; do not proceed if it is lower without explaining why),
* current **public** tool count (expected **11**),
* that `tools/list` contains the 9 analyzers + `plan_checks` + `finalize_deliverable`,
* that the 7 internal primitives are **absent** from `tools/list` and that calling one over MCP
  returns `McpError MethodNotFound`, while their handler functions are still importable from
  `src/tools/*.ts`,
* which tools have `outputSchema` (expected **all 11** — the 9 analyzers receive theirs via the
  `ORIGINAL_OUTPUT_SCHEMAS` attachment loop in `tool-definitions.ts`; the two spine tools declare
  theirs inline),
* whether `structuredContent` is emitted in both success and enforcement-fail branches.

Record all results in `PROOF_REPORT.md`.

Do not proceed if the baseline does not compile or existing tests fail. First diagnose and report.

---

### Phase 1 — Correctness gates for internal mechanisms

Implement independent oracle/differential tests using `fast-check`. Invoke the production code through
**direct handler import** (the mechanisms are internal primitives, not public tools).

Use independent reference implementations. Do not call the production implementation from the oracle
except to compare against it.

Implement at least these oracles:

1. `redundant_evidence` (inside `validate_reasoning_chain`)

   * Oracle: brute-force enumeration of vertex-disjoint evidence-to-conclusion paths on small graphs.
   * Include cycles, self-loops, duplicate edges, mixed relations, and `contradicts`.
   * Ensure only support-like edges count.
   * Gate: 0 disagreements over at least 100,000 generated cases.

2. `check_case_partition`

   * Numeric oracle: dense endpoint sampling across interval boundaries with inclusivity checks.
   * Enum oracle: multiset coverage over universe members.
   * Include half-open boundaries, overlaps, gaps, ±Infinity, NaN rejection, nested intervals.
   * Gate: 0 disagreements over at least 100,000 generated cases.

3. `trace_conclusion_numbers`

   * Oracle: exact arithmetic reference evaluator.
   * Include sum, diff, product, ratio, pct_of, mean, identity/literal.
   * Sweep values with absolute value below 1 to lock the relative-tolerance bug class.
   * Include wrong arity, duplicate refs, out-of-range refs, near-tolerance perturbations.
   * Gate: 0 disagreements over at least 100,000 generated cases.

4. `check_answer_against_constraints`

   * Oracle: independent predicate evaluator for the same operator set.
   * Include number/string equivalence cases like `100` vs `"100"`, numeric `in` lists, array subsets, missing fields, and source_quote numeric-bound anchoring.
   * Gate: 0 disagreements over at least 100,000 generated cases.

5. Plan failure branches (inside `check_plan_validity`, `require_failure_branches`)

   * Oracle: Tarjan SCC over dependency edges plus unbounded on_failure edges.
   * Include bounded retries with `max_attempts`, unbounded in-place retries, dangling targets, and self-handlers.
   * Gate: 0 disagreements over at least 100,000 generated cases.

6. Premise usage (inside `validate_reasoning_chain`)

   * Oracle: support-only reverse BFS.
   * Include `contradicts` edges to ensure they are not treated as support.
   * Gate: 0 disagreements over at least 100,000 generated cases.

7. Quote grounding (`check_quote_grounding`)

   * Oracle: direct `indexOf` after the same normalization.
   * Include paraphrased spans, token not in span, source id mismatch, numeric kind with swapped number, and the `p99`/`99` bug class.
   * Gate: 0 disagreements over at least 100,000 generated cases.

Add a lower-run local mode, but ensure the full gate can run in CI/nightly.

---

### Phase 2 — Metamorphic and property tests

Add property tests for:

1. Permutation invariance

   * Shuffling cases, nodes, edges, assumptions, sources, constraints, and conclusion_numbers must not change verdict or normalized result.

2. Relabeling invariance

   * Bijective renaming of node/case/step ids must not change PASS/BLOCK/WARNING semantics.

3. Determinism/idempotence

   * Same input twice must produce byte-identical JSON.
   * Canonical JSON hash must be identical across key-order permutations.

4. Monotonicity

   * Removing a support edge must not increase disjoint-path count.
   * Adding a gap-filling interval must not worsen MECE.
   * Adding a constraint must not reduce violation count.

5. Warning conservativeness

   * WARNING-only mechanisms must never flip status to `ENFORCEMENT_FAIL`.
   * Include claim coverage warnings, agent-authority freshness, plan loop warnings, tautology/binding warnings, **and the `check_profile_downgrade` warning now folded into `finalize_deliverable`** (see Phase 4).

6. Polarity safety

   * `almost certainly not ...` must not trigger a high-confidence BLOCK.
   * Include `9/10`, `p=0.95`, `p=0.05`, “highly likely”, “certain”, and negated variants.

Gate: every property holds over at least 10,000 cases.

---

### Phase 3 — Adversarial corpora

Create versioned JSON corpora:

```txt
tests/corpora/should_pass/
tests/corpora/should_block/
tests/corpora/borderline/
```

Important: build quotas per blocking mechanism, not blindly per tool. Some mechanisms are advisory and
should never block. Drive grounding/tracing/constraints/freshness/case-partition corpora through their
handlers directly **and** through `finalize_deliverable` for the chokepoint (Phase 4).

Minimum corpus coverage:

#### Quote grounding

`should_pass`:

* exact span,
* whitespace-normalized span,
* numeric token correctly in span and claim,
* date/entity/status claim kinds.

`should_block`:

* fabricated span,
* paraphrased span,
* token not in span,
* swapped numeric token,
* `p99` leaking `99`,
* wrong source id.

#### Numeric tracing

`should_pass`:

* all supported ops,
* sub-unit values,
* near tolerance but within bounds,
* literal/identity.

`should_block`:

* re-derivation mismatch,
* out-of-range input ref,
* bad arity,
* divide by zero,
* fabricated input refs,
* near tolerance but outside bounds.

#### Constraints

`should_pass`:

* numeric comparisons,
* normalized string/number equality,
* numeric `in` lists,
* anchored source quotes,
* subset checks.

`should_block`:

* missing field,
* false predicate,
* numeric bound absent from source_quote,
* omitted required field,
* constraint that tries to pass with unanchored bound.

#### Freshness

**The date/timestamp policy is already decided and implemented — do not re-open it.** `check_freshness.ts`
adopts the strict **Option A** policy (`parseInstant`): the *only* accepted forms are **epoch-ms** and a
**fully-zoned ISO-8601 datetime** (`...Z` or explicit `±HH:MM`). **Date-only values** (`2026-05-30`) and
**offset-less datetimes** (`2026-05-30T00:00:00`) are **rejected** (they throw `InvalidParams`). Write the
corpus to this. (If `STRESS_TEST_STRATEGY.md` still calls date-only “tricky-but-valid,” it is stale —
align it to Option A.)

`should_pass`:

* host eval time with fresh dated source (epoch-ms or zoned ISO),
* explicit-offset values,
* `Z`-suffixed values.

`should_block` (host authority):

* stale source when freshness is required,
* source after eval_time (future) — contradiction in supplied data,
* undated source when `requires_dated_sources` is set.

`invalid_input` (must throw `InvalidParams`, not block/pass):

* date-only `2026-05-30`,
* offset-less `2026-05-30T00:00:00`.

`warning_only`:

* agent-authority freshness problems must not block by default.

#### Case partition

`should_pass`:

* half-open tiling,
* closed/open boundary combinations where correct,
* enum universe exactly covered,
* ±Infinity if supported.

`should_block`:

* gap,
* overlap,
* leading/trailing gap,
* duplicate enum membership causing overlap,
* NaN bounds rejected.

#### Reasoning graph

`should_pass`:

* two root evidence nodes with vertex-disjoint paths,
* single-word evidence labels that are genuinely independent,
* reordered evidence labels that should not false-block.

`should_block`:

* only one evidence root,
* derived evidence counted as root attempt,
* shared intermediate node,
* phantom premise,
* undeclared direct support,
* `contradicts` as fake support.

#### Plan failure branches

`should_pass`:

* bounded retries with `max_attempts`,
* valid on_failure target,
* terminal safe step.

`should_block`:

* missing required failure branch for resource-bearing step,
* dangling on_failure target,
* self-handler where prohibited.

`warning_only`:

* unbounded loop should warn if that is current policy, not block.

#### Confidence/hedge

`should_pass`:

* assertive but appropriately bounded prose,
* “almost certainly not ...”,
* technical caution without heavy contradiction.

`should_block`:

* stated confidence >= 0.9 plus heavy hedging **under the opt-in `strict` flag** (confirm the default
  is warning-only and `strict:true` is what makes it block).

Gate:

* should_block PASSes = 0.
* should_pass ENFORCEMENT_FAILs = 0.
* borderline severity mismatches = 0.

---

### Phase 4 — Finalize chokepoint tests

This is the most important integration test.

Implement `tests/integration/finalize_chokepoint.test.ts`.

Drive full scenarios through the spine:

```txt
plan_checks → (artifacts the agent prepares) → finalize_deliverable
```

Note: the agent does **not** call the leaf checks separately (they’re internal). It prepares the
artifacts (`sources`+`claims`, `inputs`+`conclusion_numbers`, `constraints`+`structured_answer`,
`eval_time`, and optionally `case_partition`) and passes them to `finalize_deliverable`, which re-runs
the required checks inline.

Must test:

1. Golden path returns PASS.

2. Each single mutation causes BLOCK:

   * trimmed answer,
   * fabricated quote span,
   * swapped number,
   * missing claims,
   * missing sources,
   * missing conclusion_numbers,
   * stale source under host authority,
   * undeclared contract claim,
   * must_include absent,
   * must_not_include present,
   * numeric criterion not shipped in answer_text.

3. Required inputs cannot be silently skipped:

   * For every `finalize_required` check, remove the corresponding artifact and assert BLOCK with
     `finalize_missing_inputs`.

4. Hash/binding token semantics:

   * `answer_text_hash` changes iff exact answer text changes.
   * Host wrapper must reject surfaced answer if its exact-text hash differs from finalize’s `answer_text_hash`.
   * Hash must not be accepted as proof that a prior check ran.

5. Weak contract handling:

   * agent-authored contract emits weak-contract warning (`contract_strength: "weak_agent_declared"`).
   * host-derived contract should be treated as stronger (`host_anchored`).
   * under-declared obligations may weaken the proof, but must not override a failing required unforgeable check.

6. Agent authority freshness:

   * `eval_time.authority='agent'` must never create a default BLOCK.
   * host authority may block stale/future sources when freshness is required.

7. **New `finalize` behaviors (wired 2026-05-30, after the older handoff was drafted):**

   * **Profile-downgrade is a WARNING, never a block.** A contract whose `task_type` understates the
     request/answer shape (e.g. `task_type:'freeform'` for “Which option should we choose?” + a
     recommendation answer) must surface a `possible_*_profile_downgrade` warning **and still PASS** when
     no required unforgeable check fails. It must never flip `finalize_verdict` to `BLOCK` on its own.
   * **Case partition is verify-if-present.** It is **not** a `finalize_required` check, so its absence
     must **not** trigger `finalize_missing_inputs`. Assert:
     - absent `case_partition` → PASS, and `re_executed` does **not** contain `check_case_partition`;
     - supplied MECE `case_partition` → PASS, and `re_executed` **contains** `check_case_partition`;
     - supplied non-MECE `case_partition` (gap or overlap) → BLOCK with a `partition_gap` /
       `partition_overlap` blocking issue.

Fuzz `finalize_deliverable` inputs to search for any combination of partial artifacts that returns PASS
while a required leaf check would fail (and, separately, any supplied non-MECE `case_partition` that
slips through to PASS).

Gate:

* 0 finalize chokepoint bypasses.

---

### Phase 5 — Fuzzing and schema validation

Build schema-driven fuzzers for every public tool (all 11), and fuzz the internal primitive handlers
directly as well.

Generate:

* NaN,
* Infinity,
* -Infinity,
* -0,
* huge arrays,
* empty arrays,
* missing ids,
* duplicate ids,
* wrong types,
* nulls,
* deeply nested objects,
* unicode,
* RTL,
* emoji,
* megabyte strings,
* self-loops,
* cycles,
* 10,000-element case arrays,
* regex-like field names.

Assertions:

1. No unhandled throws.
2. No hangs; use a 2-second per-call watchdog.
3. Invalid input returns `McpError InvalidParams`.
4. Every PASS/FAIL `structuredContent` validates against the tool’s `outputSchema` using `ajv`.
5. `content[0].text`, when parsed as JSON, deep-equals `structuredContent`.
6. ReDoS probes do not hang.
7. User-supplied strings interpolated into regexes are escaped.

Gate:

* 0 unhandled throws or hangs over at least 100,000 fuzz inputs per tool.
* 100% schema-valid structuredContent. **All 11 public tools declare `outputSchema`** (the “original 9
  lack outputSchema” caveat from the old handoff no longer applies), so schema validation covers the
  entire public surface — do not scope it down.

---

### Phase 6 — Determinism matrix

Run full or reduced-but-representative stress suite across:

```txt
TZ=UTC
TZ=Asia/Kolkata
TZ=Pacific/Chatham
TZ=America/Los_Angeles

LANG=C
LANG=tr_TR.UTF-8
LANG=de_DE.UTF-8

Node 20
Node 22
Node 24

JSON key order: original and shuffled
```

Pay special attention to `check_freshness` under hostile `TZ` (the Option A policy exists precisely to
keep it timezone-independent — prove it) and to any locale-sensitive string compares (`tr_TR`
dotted/dotless I).

Gate:

* byte-identical verdicts,
* byte-identical canonical hashes,
* same warning/block mechanisms,
* same structuredContent shape.

If CI runtime is too high, create:

* PR matrix: minimal representative set.
* nightly matrix: full set.
* release-candidate matrix: full stress set.

---

### Phase 7 — Protocol conformance

Round-trip the public surface over:

1. stdio
2. Streamable HTTP, if supported by the repo

Assertions:

* `tools/list` returns **exactly the 11 public tools** (9 analyzers + `plan_checks` + `finalize_deliverable`).
* The 7 internal primitives (`check_quote_grounding`, `check_claim_coverage`, `trace_conclusion_numbers`,
  `check_answer_against_constraints`, `check_freshness`, `check_case_partition`, `check_profile_downgrade`)
  are **absent** from `tools/list`, and a `tools/call` to any of them returns `McpError MethodNotFound`.
* Every public tool has `inputSchema` and `outputSchema`.
* Success result includes `structuredContent`.
* Enforcement failure includes `isError: true` and `structuredContent`.
* Invalid params return `McpError InvalidParams`.
* `content[0].text` parsed JSON deep-equals `structuredContent`.

Gate:

* Full round-trip green on supported transports, including the surface-membership assertions above.

---

### Phase 8 — Mutation testing

Install and configure Stryker:

```bash
npm install -D @stryker-mutator/core
```

Target new/modified robustness files first:

* the internal primitive handlers (`check_quote_grounding`, `trace_conclusion_numbers`,
  `check_answer_against_constraints`, `check_freshness`, `check_case_partition`, `check_profile_downgrade`,
  `check_claim_coverage`),
* `finalize_deliverable` (the chokepoint),
* `check_planner`,
* `markers`,
* `confidence_product`,
* `falsifiability_checker`,
* `validate_reasoning_chain`,
* `check_plan_validity`,
* `tool-call`,
* `tool-definitions`.

Mutation classes that must be killed:

* substring containment inverted or removed,
* numeric tolerance widened,
* `<` changed to `<=` or vice versa on boundary gates,
* support-only edge filter removed,
* `contradicts` treated as support,
* agent-authority freshness allowed to block,
* host-authority freshness not blocking,
* must_include/must_not_include inverted,
* missing required inputs ignored,
* claim_kind numeric check disabled,
* root evidence filter removed,
* max_attempts ignored,
* **the public-surface filter removed (an internal leaf leaking back into `tools/list`/dispatch),**
* **`check_profile_downgrade` flipped from warning to blocking inside `finalize`,**
* **a supplied non-MECE `case_partition` allowed to PASS, or an absent one made to block.**

Gate:

* > = 80% mutation score on new code.
* 0 surviving mutants in BLOCK paths unless explicitly documented as equivalent mutants.

---

### Phase 9 — Performance bounds

Add performance tests or a benchmark script.

Scale:

* 1,000-node reasoning graphs,
* 10,000 partition cases,
* 500-step plans,
* MB-scale source corpora,
* large claim lists,
* large numeric conclusion sets.

Measure:

* p50,
* p95,
* max,
* memory usage if practical.

Budgets to start with:

* typical p95 <= 50ms,
* adversarial-large p95 <= 500ms,
* no superlinear blowups beyond expected max-flow cost.

Add diagnostic-size caps if missing (note: `limits.ts` already implements input rejection and
diagnostic truncation — verify and test it rather than re-implementing):

* max blocking issues returned,
* max warnings returned,
* max auto-detected claims,
* max source characters,
* max cases per call.

If caps are implemented, test deterministic truncation and report total vs returned issue counts.

---

### Phase 10 — Product-value proof against tagent deliverables

Correctness tests prove the layer works. They do not prove it improves deliverables. Build a small A/B
benchmark.

Run the same task set in four modes:

A. Baseline tagent, no ct-mcp.
B. ct-mcp available but advisory only (agent may call `plan_checks`/`finalize_deliverable`, but the host
   does **not** gate release on the verdict).
C. **Host-enforced spine:** the host refuses to release unless `finalize_deliverable` returns PASS **and**
   the exact-text hash of the surfaced answer equals the returned `answer_text_hash`. The agent uses the
   spine (`plan_checks` → prepare artifacts → `finalize_deliverable`).
D. **Host-enforced spine + host-derived contract:** as C, but the host derives the `deliverable_contract`
   (`contract_authority:'host'`) from the user request rather than letting the agent declare it.

Benchmarked agents drive the **spine** (one gate parameterized by `task_type`); they do **not** select
among the internal primitives, and there is no façade/debug surface to test. If you want a selection
study, the only honest selection question on this branch is “does the agent pick the right `task_type`
and prepare the right artifacts,” not “does it pick among many tools.”

Task set:

1. Factual QA / research answers

   * source-grounded summaries,
   * docs-based answers,
   * freshness-sensitive claims.

2. Numeric analysis

   * financial calculations,
   * benchmark comparisons,
   * percent changes,
   * capacity estimates.

3. Planning / implementation plans

   * migrations,
   * deploy plans,
   * rollback/failure-branch needs.

4. Architecture stress tests

   * concurrency designs,
   * reliability plans,
   * graph-like dependency reasoning.

5. Decision memos

   * option tradeoffs,
   * recommendations,
   * “wrong if” conditions.

Minimum:

* 20 tasks per category.
* Include 10 adversarial tasks designed to tempt shortcuts (including profile-downgrade attempts — a
  decision/numeric task declared as `freeform` — so you can measure whether the warning surfaces and
  whether a host strict mode catches it).

For each task, log:

```json
{
  "task_id": "...",
  "category": "...",
  "mode": "baseline|advisory|enforced|host_contract",
  "model": "...",
  "success": true,
  "high_severity_defects": 0,
  "unsupported_claims": 0,
  "wrong_numbers": 0,
  "constraint_violations": 0,
  "false_done": false,
  "tool_calls": 0,
  "latency_ms": 0,
  "token_cost_estimate": 0,
  "warnings": [],
  "blocks": [],
  "final_answer_hash": "..."
}
```

Scoring rubric:

* Task success / pass@1.
* High-severity defects per deliverable.
* Unsupported factual claims.
* Wrong or untraced numbers.
* Constraint violations.
* False “done” rate.
* Correction success rate after a block.
* Added tool calls.
* Added latency.
* Warning volume.
* False-block rate on clean tasks.

The key proof table should compare:

```txt
baseline vs advisory vs host-enforced vs host-enforced+host-contract
```

Expected proof claim format:

```txt
On N realistic tagent tasks, host-enforced ct-mcp changed task success from X% to Y%, reduced
high-severity deliverable defects by Z%, reduced unsupported claims by A%, reduced wrong numbers by B%,
reduced false-done submissions by C%, and added D% latency / E extra tool calls on average.
```

Do not invent results. If results are mixed, report them honestly.

---

## Required final report format

`PROOF_REPORT.md` must include:

# CT-MCP Robustness Proof Report

## Executive summary

* Verdict:

  * `PASS`, `PARTIAL`, or `FAIL`.
* One-paragraph explanation.
* Biggest remaining risk.

## Repo state

* Commit hash:
* Branch:
* Date/time:
* Node:
* npm/pnpm:
* OS:
* CPU:
* Relevant env vars:

## Baseline

| Check                          |    Result |
| ------------------------------ | --------: |
| Typecheck                      | pass/fail |
| Existing tests                 | pass/fail |
| Existing test count            | N (expect 296) |
| Public tools listed            | N (expect 11) |
| Internal leaves hidden + MethodNotFound | yes/no |
| Tools with outputSchema        | N (expect 11) |
| structuredContent emitted      |    yes/no |

## Correctness gates

| Gate                          |       Target | Observed |  Pass? |
| ----------------------------- | -----------: | -------: | -----: |
| Bypass rate                   |            0 |      X/N | yes/no |
| False-block rate              |            0 |      X/N | yes/no |
| Differential disagreements    |            0 |      X/N | yes/no |
| Finalize chokepoint bypasses  |            0 |      X/N | yes/no |
| Fuzz crashes/hangs            |            0 |      X/N | yes/no |
| Schema-invalid outputs        |            0 |      X/N | yes/no |
| Determinism mismatches        |            0 |      X/N | yes/no |
| Protocol round-trip failures  |            0 |      X/N | yes/no |
| Surface-membership violations |            0 |      X/N | yes/no |
| Mutation score                |        >=80% |       X% | yes/no |
| BLOCK-path surviving mutants  | 0 unresolved |        N | yes/no |
| p95 latency typical           |       <=50ms |      Xms | yes/no |
| p95 latency adversarial-large |      <=500ms |      Xms | yes/no |

## Product-value benchmark

| Mode                     | Task success | High-sev defects/task | Unsupported claims/task | Wrong numbers/task | Constraint violations/task | False done rate | Avg latency | Avg tool calls |
| ------------------------ | -----------: | --------------------: | ----------------------: | -----------------: | -------------------------: | --------------: | ----------: | -------------: |
| Baseline                 |              |                       |                         |                    |                            |                 |             |                |
| Advisory                 |              |                       |                         |                    |                            |                 |             |                |
| Enforced                 |              |                       |                         |                    |                            |                 |             |                |
| Enforced + host contract |              |                       |                         |                    |                            |                 |             |                |

## Interpretation

* What improved?
* What regressed?
* Did host enforcement matter?
* Did host-derived contracts matter?
* Did the single-gate spine (`plan_checks` → `finalize_deliverable`) keep the agent on the rails
  compared with advisory/baseline — and did the profile-downgrade warning catch task-type dodges?

## Bugs found

For each bug:

```txt
Title:
Severity:
Repro:
Root cause:
Fix:
Regression test:
```

## Known limitations

Be explicit about:

* agent-supplied sources,
* agent-supplied claim lists,
* agent-authored contracts,
* source authority not externally verified,
* warnings that may require host escalation (including profile-downgrade),
* `case_partition` is verify-if-present (an agent that simply omits a case split is not forced to
  declare one),
* benchmark sample size.

## Reproduction

Exact commands:

```bash
...
```

## Merge recommendation

One of:

* Safe to merge beta.
* Safe to merge behind experimental flag only.
* Do not merge.
* Stable release candidate.

Include rationale.

---

## Non-negotiable rules

1. Do not claim “proved” unless a test actually ran.
2. Do not hide false blocks.
3. Do not silently lower test counts to make CI pass.
4. Do not use model judgment as an oracle for deterministic checks.
5. Do not treat hash witnesses as proof that prior checks ran.
6. Do not let agent-authored contracts count as host-authored.
7. Do not allow `finalize_deliverable` to PASS with missing required artifacts (or with a supplied
   non-MECE `case_partition`).
8. Do not benchmark only happy paths.
9. **Do not reintroduce a façade or multi-tool product surface, and do not add prod/debug surface
   modes — both were evaluated and rejected. The shipped product is the 11-tool spine. Benchmark product
   value against the spine (`plan_checks` → `finalize_deliverable`); test the internal primitives via
   direct handler import, never by exposing them on the MCP surface.**
10. Preserve the distinction between correctness proof and product-value proof.

## First actions

Start by doing these in order:

1. Run baseline typecheck and tests; confirm 296 tests, 11 public tools, 7 hidden leaves
   (`MethodNotFound`), outputSchema on all 11.
2. Inspect tool definitions (`tool-definitions.ts`: `ALL_TOOLS` → `INTERNAL_TOOL_NAMES` filter → `TOOLS`)
   and the dispatcher (`tool-call.ts`: `TOOL_HANDLERS`); confirm `finalize_deliverable` re-executes the
   blocking leaves inline.
3. Confirm the freshness timestamp policy is Option A in code (`check_freshness.ts` `parseInstant`) and
   write tests/corpora to it; flag `STRESS_TEST_STRATEGY.md` if it still says date-only is valid.
4. Build finalize chokepoint tests (including the new profile-downgrade and case_partition cases).
5. Build differential harnesses for max-flow, MECE, numeric tracing, and plan cycles.
6. Build should_pass / should_block corpora for the existing blocking mechanisms.
7. Add fuzz + schema validation.
8. Add host-wrapper enforcement test.
9. Add the **spine** benchmark harness (host-enforced `finalize_deliverable` gate).
10. Produce `PROOF_REPORT.md`.

Return with a PR-ready diff, not just a plan.
