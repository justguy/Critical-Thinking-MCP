# Stress-Test Strategy — Deliverable-Centric Robustness Layer

> **Scope:** an *objective*, reproducible strategy to stress-test the changes recorded in
> [`IMPLEMENTATION_CHANGES.md`](IMPLEMENTATION_CHANGES.md). "Objective" means: every test layer has a
> defined **oracle** (independent ground truth) or **invariant** (property that must hold), and a
> **measurable pass/fail gate** — not "looks reasonable."
>
> Current baseline: 281 unit tests (example-based). This strategy adds the property/differential/fuzz/
> corpus/determinism/mutation layers that example tests cannot reach.

## 0. The two numbers that decide success

The entire value proposition is *"BLOCK only on unforgeable signals; never false-block."* So two
falsifiable rates drive everything:

- **Bypass rate** = (real violations that return `PASS`) / (real violations). **Target: 0.**
- **False-block rate** = (legitimate inputs that `ENFORCEMENT_FAIL`) / (legitimate inputs). **Target: 0**
  — the modern continuation of the project's "0/14 clean-control" claim.

**Report these as OBSERVED rates, never universal guarantees.** The honest claim is *"observed bypass
rate on corpus X: 0 / N"* and *"observed false-block rate on corpus Y: 0 / M"* — the guarantee holds only
over the generated cases, curated corpora, and stated oracles. That is still strong; do not let a green
dashboard imply a mathematical proof of correctness for all inputs.

Secondary objective gates: **determinism** (identical output across runs/machines/TZ/locale/key-order),
**no-crash** (only `McpError InvalidParams`, never an unhandled throw or hang), **warning precision**,
**mutation score**, and **latency** bounds. Every number below is merge-blocking unless marked *review*.

---

## 1. Test layers

### 1.1 Differential / oracle testing — highest bug-yield for the algorithmic checks

Build an *independent* reference for each deterministic check and assert equivalence over randomized
inputs (`fast-check` generators). Disagreement = bug.

| Check | Oracle (independent reference) | Generator |
|---|---|---|
| `redundant_evidence` max-flow | brute-force enumeration of vertex-disjoint evidence→conclusion paths (exponential, fine for ≤10 nodes) | random graphs incl. cycles, self-loops, dup edges, mixed relations |
| `check_case_partition` numeric | dense point-sampling: sample all interval endpoints ±ε over the domain; `is_mece ⟺ every sample covered exactly once` | random intervals w/ random inclusivity over `[min,max]` |
| `check_case_partition` enum | multiset cover over the universe | random member sets |
| `trace_conclusion_numbers` | exact arithmetic with a *known* result; perturb by `>tol`→BLOCK, `<tol`→PASS | random inputs/ops; **sweep `|value|<1`** to lock the relative-tolerance fix |
| `check_answer_against_constraints` | a 20-line independent predicate evaluator over the same op set | random {field,op,value}+answer |
| plan `failure_branch` cycle | reference Tarjan SCC over the augmented (deps + unbounded on_failure) edge set | random plans w/ on_failure targets + max_attempts |
| `#11` premise reachability | reference BFS over the support-only reverse graph | random graphs w/ mixed relations incl. `contradicts` |
| `quote_grounding` | direct `indexOf` after identical normalization | random source + injected/mutated spans |

**Gate:** 0 disagreements over **≥100k** generated cases per check. (The verification workflow already did
this for max-flow over 60k graphs with zero disagreements — codify it as a permanent CI property test.)

### 1.2 Property-based / metamorphic invariants — catch order/locale/relabel bug classes

Properties that must hold for **all** inputs:

- **Permutation invariance** — shuffling input array order (`cases`, `nodes`, `edges`, `assumptions`,
  `sources`, `constraints`, `conclusion_numbers`) yields an identical verdict and identical normalized
  output. *(Directly guards the class of the NaN-sort non-determinism bug.)*
- **Relabeling invariance** — a bijective rename of node/case/step ids does not change `PASS`/`FAIL`.
- **Determinism / idempotence** — same input twice ⇒ byte-identical JSON; `canonicalJson` over any
  key-order permutation of an object input ⇒ identical hash.
- **Monotonicity** — removing a support edge cannot *increase* disjoint-path count; adding a gap-filling
  interval cannot worsen MECE; adding a constraint cannot *reduce* the violation count.
- **Extractor superset/monotone** — `widened(text) ≥ legacy(text)` for every text; appending text never
  lowers claimed confidence.
- **WARNING-conservativeness** — the WARNING-only checks (`claim_coverage`, binding/tautology warnings,
  agent-authority freshness, plan loop warnings) **never** flip `status` to `ENFORCEMENT_FAIL`. Assert
  over the whole corpus.
- **Polarity safety** — for any sentence `S`, `extractClaimedConfidence("almost certainly not " + S)`
  does not exceed the no-claim baseline.

**Gate:** every property holds over **≥10k** cases each.

### 1.3 Adversarial corpora — the curated false-block / bypass numbers

Labeled, versioned JSON corpora under `tests/corpora/`. **Sizing is per BLOCKING MECHANISM, not per
tool** — several tools (`plan_checks`, `check_claim_coverage`, `check_profile_downgrade`) never block, so
forcing block-cases into them would be meaningless. The ~17 blocking `mechanism` strings each get a quota.

- **`should_block/`** (**≥50 per blocking mechanism**) — fabricated quotes (`quote_grounding`), swapped &
  derived-from-single-root numbers (`number_provenance`, `redundant_evidence`), MECE gaps/overlaps
  (`partition_*`), violated/omitted constraints (`constraint`, `required_field`), host-authority stale
  sources (`freshness`), dangling on_failure (`failure_branch`), phantom/contradicting premises
  (`premise_usage`), trimmed answers (`must_include`, `numeric_not_shipped`), `confidence_hedge` **under
  `strict:true`**. → **Bypass rate must be 0.**
- **`should_pass/`** (**≥50 across all tools**, tricky-but-valid) — single-word evidence labels, bounded
  retries (`max_attempts`), half-open tilings, ±Infinity domains, numeric `in`-lists with anchored quotes,
  specific *negated* falsification conditions, `100` vs `"100"`, **fully-zoned** timestamps
  (`2026-05-30T00:00:00Z`), assertive-but-cautious prose ("highly confident … but there are risks"). →
  **False-block rate must be 0** (the headline regression gate).
- **`warning_only/`** (**≥50 for advisory tools** — `check_claim_coverage`, `check_profile_downgrade`,
  binding/tautology/freshness-agent/plan-loop warnings) — labeled with the *expected warning(s)*. →
  assert the warning fires and **`status` stays `PASS`**.
- **`invalid_params/`** — inputs that must raise `McpError InvalidParams`, including **date-only and
  offset-less timestamps** (per the strict timestamp policy), `tool_result` acceptance-criterion kind,
  NaN partition bounds, malformed structures.
- **`borderline/`** (≥30) — boundary probes labeled with the *expected severity* (pass / warn / block).

**`never_block` invariant:** across the *entire* corpus + fuzz, assert that `plan_checks`,
`check_claim_coverage`, and `check_profile_downgrade` never return `ENFORCEMENT_FAIL`.

**Process gate:** every new BLOCK gate ships with **≥10 new `should_pass` cases** and runs the full
`should_pass` corpus pre-merge with a 0-regression delta.

### 1.4 Fuzzing / robustness — no-crash, schema-valid

A schema-driven fuzzer per tool (derive generators from each tool's `inputSchema`) emitting
malformed/extreme inputs: `NaN`, `±Infinity`, huge/empty arrays, deep nesting, unicode/emoji/RTL, `null`,
wrong types, duplicate ids, self-loops, cyclic graphs, 10⁴-element `cases`, megabyte strings.

Assertions: (a) **never** an unhandled throw — only `McpError InvalidParams` surfaces from the dispatcher;
(b) never hangs (2 s per-call watchdog); (c) every `PASS`/`FAIL` `structuredContent` **validates against
the tool's `outputSchema`** via `ajv` (already a dependency) — **all 11 public tools declare an
`outputSchema`, so this is a global gate over the whole surface** (the `truncation` field is permitted via
`additionalProperties`). Plus a targeted **ReDoS** probe on every
regex (falsifiability markers, claim extraction, and the `RegExp` built from field names in
`check_answer_against_constraints`) with catastrophic-backtracking strings.

**Gate:** 0 unhandled throws / hangs over **≥100k** fuzz inputs per tool; **100%** `outputSchema`-valid.

### 1.5 Determinism & replay matrix — cross-environment

Run the full + differential + property suites under a CI matrix:

| Axis | Values |
|---|---|
| Timezone | `UTC`, `Asia/Kolkata` (+05:30), `Pacific/Chatham` (+12:45), `America/Los_Angeles` |
| Locale | `C`, `tr_TR.UTF-8` (Turkish dotless-i `toLowerCase` trap), `de_DE.UTF-8` |
| Node | 20, 22, 24 |
| JSON key order | original + shuffled |

**Gate:** byte-identical verdicts and hashes across the entire matrix. *(Guards the freshness-TZ bug
class and the `canonicalJson` contract; surfaces any locale dependence in `tokenize`/`normScalar`/
`claim_kind` matching — all of which call `toLowerCase`.)*

### 1.6 Integration / end-to-end — the deliverable loop is the real gate

Drive full scenarios `plan_checks → (quote_grounding | trace_conclusion_numbers | constraints |
freshness) → finalize_deliverable`:

- Golden path `PASS`; each adversarial variant (trimmed answer, fabricated span, swapped number, stale
  source, undeclared contract claim) → `finalize` BLOCK.
- **Chokepoint property (most important):** there is *no* combination of partial inputs that makes
  `finalize` return `PASS` while a `finalize_required` check would fail — missing inputs for a required
  check must always BLOCK (no silent skip). Fuzz the finalize inputs to try to find a bypass.
- **Host-contract scenarios:** agent-authored contract → `contract_strength: weak_agent_declared`;
  `answer_text_hash` changes iff the normalized answer changes (anti-swap binding token);
  `eval_time.authority='agent'` never blocks.

**Gate:** every scenario asserts its terminal verdict; the chokepoint property holds under fuzzing.

### 1.7 Protocol conformance — MCP

Round-trip every tool over **both** transports (stdio + Streamable HTTP):

- success ⇒ `content[0].text` parsed JSON deep-equals `structuredContent`;
- `ENFORCEMENT_FAIL` ⇒ `isError: true` **and** `structuredContent` present;
- invalid params ⇒ `McpError InvalidParams`;
- `tools/list` returns 11 public tools, each with an `outputSchema` that loads in `ajv`; the 7
  internalized leaf checks are absent and return `McpError MethodNotFound` on dispatch.

**Gate:** full round-trip green on both transports.

### 1.8 Mutation testing — does the suite actually constrain behavior?

Run **Stryker** (`@stryker-mutator/core`) over the 10 new/modified source files. A green suite with a low
kill rate means the tests don't pin the logic — mutation score is the objective measure of test strength.

**Gate:** **≥ 80%** mutation score on the new tools/modules; every *surviving* mutant inside a BLOCK path
must be investigated and killed (a survived mutant in a blocking decision is a latent bypass/false-block).

### 1.9 Performance / complexity bounds

Scale inputs: 1000-node reasoning graphs, 10⁴ partition cases, 500-step plans, MB-scale corpora. Assert
empirical near-linear scaling for the `O(V+E)`/`O(n log n)` checks, max-flow bounded by `O(E·|evidence|)`,
and per-call **p95 latency** within budget (e.g. 50 ms typical / 500 ms adversarial-large).

**Gate:** no superlinear blow-ups; latency within budget *(review-level)*.

### 1.10 Hardening invariants (output caps + regex safety)

Two implementation invariants that the stress harness asserts:

- **Bounded diagnostics (output caps).** ✅ **Implemented** (`src/enforcement/limits.ts`, wired in
  `tool-call.ts`): INPUT caps reject pathological requests (`>5 MB`, any array `>5000`, any string
  `>1 MB`, depth `>64`) as `InvalidParams`; OUTPUT caps truncate diagnostic arrays + over-long corrective
  prompts to 100 and report `truncation: { field: { returned, total } }`. **Tests to add:** truncation is
  deterministic; input caps reject at the boundary; capped output still validates against `outputSchema`;
  the limit *values* are calibrated against the corpora (first-cut defaults today).
- **Regex-safety invariant.** Every user-provided string interpolated into a `RegExp` must be neutralized
  (via `escapeRegExp` *or* a charset strip). The one current site —
  `check_answer_against_constraints` field-name matching — strips to `[a-z0-9]`, which is already safe;
  locked by a metachar-field test (`"a+)+$"`, `"(?<x>.*)"`, `"price|admin"`, `"\b.*\b"`, `"___"` → no
  hang, no injection, no spurious match). Any new RegExp-from-user-input site must add the same.

**Gate:** no unbounded output arrays once caps land; 0 regex hangs/injections.

---

## 2. Objective scorecard (acceptance gates)

| Metric | Definition | Target | Gate |
|---|---|---|---|
| Bypass rate | should-block PASSes / total | **0** | merge-blocking |
| False-block rate | should-pass BLOCKs / total | **0** | merge-blocking |
| Differential agreement | oracle disagreements | **0** | merge-blocking |
| Determinism | identical output across the §1.5 matrix | **100%** | merge-blocking |
| No-crash | unhandled throws or hangs over fuzz | **0** | merge-blocking |
| `outputSchema` validity | `structuredContent` valid | **100%** | merge-blocking |
| Mutation score (new code) | killed / total mutants | **≥ 80%** | merge-blocking |
| Warning precision | clean inputs that emit a warning | **≤ ε** | review |
| p95 latency | per call | within budget | review |

---

## 3. Per-component oracle cheat-sheet

| Component | Oracle / invariant | Highest-value attack |
|---|---|---|
| quote_grounding | `indexOf` after normalization | paraphrased span; token in claim but not span; numeric kind with swapped number |
| trace_conclusion_numbers | exact arithmetic; relative-tolerance law | sub-unit values; near-tolerance perturbation; extra/dup `input_refs` |
| constraints | independent predicate eval; bound∈source_quote | `100` vs `"100"`; numeric `in`-list; omit the failing constraint |
| freshness | interval arithmetic; authority gate | seconds-vs-ms unit confusion; date-only & offset-less rejected; agent-authority must never block |
| profile_downgrade | declared vs inferred task type | freeform-dodge of numeric/decision/planning; must stay warning-only |
| confidence/hedge | superset + polarity laws; strict-gated block | "almost certainly NOT"; cautious prose must not block; `strict:true` required to block |
| case_partition | dense point sampling / multiset cover | boundary inclusivity (4 combos); ±Infinity; NaN; nested intervals |
| redundant_evidence | brute-force vertex-disjoint paths | derived evidence as a source; reordered/duplicate labels; shared intermediate node |
| premise_usage | support-only reverse BFS | `contradicts` edge; direct vs transitive; phantom vs unknown-id |
| plan failure_branches | Tarjan SCC on augmented edges | bounded vs unbounded loop; in-place retry; effect-verb false neg/pos |

---

## 4. Build order (maximize signal first)

1. **Differential harnesses** for the 4 algorithmic checks (max-flow, MECE, tracing, plan-cycles) — reuse
   the verification workflow's brute-force references; highest bug-yield.
2. **Property/metamorphic suite** (permutation, determinism, WARNING-conservativeness, polarity) — cheap,
   kills whole bug classes.
3. **`should_pass` + `should_block` corpora** — the headline bypass/false-block numbers.
4. **Determinism CI matrix** (TZ × locale × node × key-order).
5. **Fuzz + `outputSchema` validation** (ajv).
6. **Protocol round-trip** (stdio + HTTP).
7. **Mutation pass** (Stryker); close every surviving BLOCK-path mutant.
8. **Performance bounds.**

---

## 5. Tooling

- **`vitest`** (existing) — host for all layers.
- **`fast-check`** (new dev dep) — property/differential generators + shrinking to minimal counterexamples.
- **`ajv`** (already a dependency) — `outputSchema` validation of `structuredContent`.
- **`@stryker-mutator/core`** (new dev dep, CI-only) — mutation score.
- **CI matrix** (GitHub Actions) — `TZ` × `LANG`/`LC_ALL` × Node version × JSON key-order.
- **Corpora** — versioned JSON under `tests/corpora/{should_block,should_pass,borderline}/<tool>/`.

---

## 6. Two highest-value harnesses (concrete sketches)

**6a. redundant_evidence differential (the riskiest algorithm).**

```ts
import fc from 'fast-check'
// Reference: exhaustive vertex-disjoint path count from any evidence to the conclusion.
function bruteVertexDisjoint(nodes, edges, conclusionId): number {
  const ev = nodes.filter(n => n.type === 'evidence').map(n => n.id)
  const adj = supportAdjacency(edges)            // supports|implies|requires only
  // try every matching of disjoint simple paths (small graphs); return the max set size
  return maxDisjointPaths(ev, conclusionId, adj) // independent recursive search
}
fc.assert(fc.property(genReasoningGraph({maxNodes: 9}), (g) => {
  const tool = maxFlowDisjointPaths(g.conclusionId, g.nodes, g.edges, evidenceIds(g))
  return tool.count === bruteVertexDisjoint(g.nodes, g.edges, g.conclusionId)
}), { numRuns: 100_000 })
```

**6b. Permutation invariance (guards the whole order-dependence class).**

```ts
fc.assert(fc.property(genCasePartitionInput(), fc.scheduler(), (input) => {
  const a = handleCheckCasePartition(input, engine)
  const b = handleCheckCasePartition({ ...input, cases: shuffle(input.cases) }, engine)
  return a.status === b.status && a.is_mece === b.is_mece
        && setEqual(a.gaps, b.gaps) && setEqual(a.overlaps, b.overlaps)
}), { numRuns: 10_000 })
```

These two alone reproduce (and then permanently guard against) the two highest-severity classes the
adversarial review found: a graph-algorithm bypass and order-dependent non-determinism.

---

## 7. CI tiers (keep it practical without weakening the release gate)

The full strategy is heavy (100k generated cases × checks, 100k fuzz × tools, a TZ×locale×node matrix,
mutation, dual-transport protocol, perf). Stage it so every-push stays fast and the release gate stays strict:

| Tier | Runs | Contents |
|---|---|---|
| **Every push** (~fast) | on commit | unit suite; `outputSchema` smoke; **1k** property cases for P0 checks; finalize-chokepoint smoke; `never_block` invariant |
| **PR-required** | on PR | **10k** differential cases (max-flow, MECE, tracing, plan-cycles); full `should_pass` + `should_block` corpora; protocol round-trip on **stdio** |
| **Nightly** | scheduled | **100k** differential + fuzz; full **TZ × locale × Node** matrix; Streamable **HTTP** round-trip; performance bounds |
| **Release candidate** | pre-release | **mutation testing** (no surviving BLOCK-path mutants); full corpora; full matrix; cap/truncation tests |

## 8. Merge gates (objective entry criteria)

**Beta merge — minimum (already satisfied by code or tracked):**
1. ✅ Date-only timestamp policy resolved (strict / Option A).
2. ✅ `tool_result` acceptance-criterion rejected, with test.
3. ✅ `check_profile_downgrade` exists + warning test.
4. ✅ `outputSchema` on **all 18** tools (global structuredContent-validity gate enabled).
5. ✅ `validate_confidence` `confidence_hedge` BLOCK behind `strict` until the clean-control corpus exists.
6. ✅ Resource caps (input rejection + output truncation with reporting) implemented in `limits.ts`.

**Stable release — required gates (build per §4 order, enforce per §2 scorecard):**
- Differential tests for max-flow, MECE, numeric tracing, plan failure-branch cycles → **0 disagreements**.
- Finalize-chokepoint fuzzing → no bypass.
- `should_pass` / `should_block` corpora for **every blocking mechanism** → false-block = 0, bypass = 0.
- Protocol round-trip over **stdio and Streamable HTTP**.
- Determinism matrix for freshness, `canonicalJson`, and hash outputs → byte-identical.
- Mutation testing on BLOCK paths → **≥80%**, no surviving BLOCK-path mutants.
- Output-size caps implemented ✅ — add truncation-determinism + boundary-rejection tests + corpus-calibrated limit values.
