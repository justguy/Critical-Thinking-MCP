# BENCHMARK.md

## CT-MCP Benchmark Summary

This benchmark evaluates CT-MCP against three publication-critical conditions and one additional evidence condition:

- **baseline** — raw LLM, no tools
- **prompted** — prompt-only negative control
- **ct_mcp** — CT-MCP one-shot enforcement
- **ct_mcp_context** — CT-MCP with explicit caller-provided context across up to 3 iterations

The first three conditions support the publication criteria comparison. The fourth condition demonstrates iterative value without hidden memory.

---

## Benchmark design

### Core benchmark
42 defect scenarios across 14 categories:

1. Numerical analysis
2. Reasoning quality
3. Multi-step logic
4. Decision making
5. Hallucination / unsupported claims
6. Flagship billing / production safety
7. Concurrency patterns
8. Arithmetic verification
9. Confidence discipline
10. Mutation tests
11. Adversarial wording

### Clean controls
14 targeted calibration scenarios are tracked separately to estimate false positives on known-good inputs.

### Scoring model
Each response is scored across 6 dimensions on a 0–3 scale:

1. Correctness
2. Specificity
3. Assumption honesty
4. Logical structure
5. Tradeoff quality
6. Safety readiness

**Maximum score:** 18  
**Normalized quality score:** total / 18

### Free-text scoring approach
Free-text responses are scored using a hybrid method:

- **Deterministic scoring** for:
  - specificity
  - logical_structure
  - assumption_honesty
- **LLM-as-judge scoring** for:
  - correctness
  - tradeoff_quality
  - safety_readiness
- **Human validation** on a 5-scenario subset

This preserves reproducibility where structure can be measured directly, while using rubric-constrained semantic judgment where meaning matters most.

---

## Publication-critical thresholds

CT-MCP is considered publication-ready only when the following are true:

- **CT-MCP beats baseline on at least 31 of 42 defect scenarios** (~73%)
- **CT-MCP beats prompted on at least 21 of 42 defect scenarios** (~50%)
- **Billing race condition is caught by CT-MCP**
- **Billing SLA is explicitly defined by CT-MCP**
- **False positives on clean controls = 0 / 14**

---

## Conditions

| Condition | Purpose | Notes |
|---|---|---|
| baseline | Raw LLM comparison | No tools |
| prompted | Prompt-only negative control | Tests whether prompting alone closes the gap |
| ct_mcp | Main product condition | One-shot enforcement |
| ct_mcp_context | Additional evidence condition | Explicit caller-provided context, no hidden memory |

---

## Scenario list

56 scenarios total. Full definitions in `benchmark/scenarios.json`.

### Defect scenarios (42)

| Category | IDs | Count |
|---|---|---|
| Numerical analysis | S1-A through S1-D | 4 |
| Reasoning quality | S2-A through S2-D | 4 |
| Multi-step logic | S3-A through S3-D, L8 | 5 |
| Decision making | S4-A through S4-D | 4 |
| Hallucination | S5-A through S5-D | 4 |
| Billing (flagship) | billing_system | 1 |
| Production safety | P1, P2, P4, P8 | 4 |
| Arithmetic | A2, A6 | 2 |
| Concurrency patterns | CON1 through CON5 | 5 |
| Confidence discipline | C4, CONF1, CONF2 | 3 |
| Numeric anomaly | N8 | 1 |
| Mutation tests | MUT1 through MUT3 | 3 |
| Adversarial wording | ADV1, ADV2 | 2 |

### Clean controls (14)

| ID | Purpose |
|---|---|
| S6-A | Correct uptime calculation |
| S6-B | Honest confidence disclosure |
| S6-C | Genuine steelman |
| S6-D | Fully grounded DAG |
| S6-E | Resolved cold-start gap |
| S6-F | Clean mutex code review |
| CC2 | Correct compound interest |
| CC9 | Correct weighted average |
| CC11 | Valid migration plan |
| CC12 | Concurrency-safe billing design |
| CC13 | Lock-protected inventory update |
| CC14 | Idempotent retry with dedup |
| CC15 | Transactional outbox pattern |
| CC16 | Compare-and-swap balance update |

**Interpretation:**  
A clean control should pass with zero blocking issues. Any block on a clean control is a false positive.

---

## Required output fields

Each benchmark row should include at minimum:

```ts
interface BenchmarkRow {
  scenario_id: string;
  condition: 'baseline' | 'prompted' | 'ct_mcp' | 'ct_mcp_context';
  iteration?: number;

  quality_score: number;
  dimension_scores: {
    correctness: 0 | 1 | 2 | 3;
    specificity: 0 | 1 | 2 | 3;
    assumption_honesty: 0 | 1 | 2 | 3;
    logical_structure: 0 | 1 | 2 | 3;
    tradeoff_quality: 0 | 1 | 2 | 3;
    safety_readiness: 0 | 1 | 2 | 3;
  };

  tools_fired: string[];
  blocking_issues: string[];
  warnings: string[];

  race_condition_caught?: boolean | null;
  sla_defined?: boolean | null;
  confidence_inflation_detected?: boolean | null;
  cycle_detected?: boolean | null;
  fabricated_number_suspicion?: 'low' | 'moderate' | 'high' | null;

  resolved?: boolean | null;
  stalled?: boolean | null;
  escalation_used?: boolean | null;
  context_used?: boolean;

  is_clean_control?: boolean;
  false_positive?: boolean;

  model_version?: string;
  run_date?: string;
  temperature?: number | null;
}
```

---

## Results summary table

Fill this table after the real benchmark run.

| Condition | Avg quality score | Wins vs baseline | Wins vs prompted |
|---|---:|---:|---:|
| baseline |  | — | — |
| prompted |  |  | — |
| ct_mcp |  |  |  |
| ct_mcp_context |  |  |  |

---

## Billing-system headline table

This is the flagship engineering story. Fill this table before publishing.

| Outcome | baseline | prompted | ct_mcp | ct_mcp_context |
|---|---|---|---|---|
| Race condition caught |  |  |  |  |
| SLA explicitly defined |  |  |  |  |
| Cold-start behavior resolved concretely |  |  |  |  |
| False concurrency bug on clean lock design |  |  |  |  |

---

## Iterative-value table

This table exists specifically to demonstrate the value of explicit caller-provided context without hidden memory.

| Metric | ct_mcp_context |
|---|---:|
| Resolution rate by iteration 3 |  |
| Stall rate |  |
| Escalation yield |  |
| Avg quality delta (iter 1 → iter 3) |  |

### Definitions
- **Resolution rate by iteration 3** = fraction of context-mode runs whose primary blocking issue is resolved by the third iteration
- **Stall rate** = fraction of context-mode runs where the same failure persists without meaningful improvement
- **Escalation yield** = fraction of escalated runs where schema-fill or stronger corrective prompts improved the score
- **Avg quality delta** = average final quality score minus first-iteration quality score

---

## Determinism and integrity checks

Before publication, confirm:

- Same model version used across compared conditions
- Same run date used across compared conditions
- Same scoring rubric used across all conditions
- No manual score overrides
- Benchmark is reproducible from:
  - `benchmark/scenarios.json`
  - `benchmark/rubric.json`
  - `benchmark/runner.ts`

---

## Human validation protocol

Validate a 5-scenario subset manually:

- 2 strong responses
- 2 weak responses
- 1 ambiguous response

For each:
- compare hybrid score to human score
- record differences by dimension
- explain any material mismatch

Suggested acceptance rule:
- average difference ≤ 1 point per dimension
- no unexplained >2-point total delta on any validated scenario

---

## Interpretation guidance

### If CT-MCP beats baseline but not prompted
The math may be adding structure more than unique capability. Publish with that caveat.

### If CT-MCP beats prompted but misses billing race condition
Do not lead with broad architectural claims. Fix the flagship demo first.

### If ct_mcp_context materially outperforms ct_mcp
This supports the claim that explicit caller-provided context improves iterative enforcement without introducing hidden state.

### If clean controls show false positives
Treat this as a calibration failure, not a benchmark win.

---

## What to publish with the package

- `BENCHMARK.md`
- `benchmark/results/BENCHMARK_RESULTS.json`
- `examples/` showing real enforcement events
- README benchmark summary
- billing-specific comparison narrative

---

## Flagship finding sentence

Before publishing, fill in one sentence exactly:

> The race condition was [caught / not caught] by [baseline], [caught / not caught] by [prompted], [caught / not caught] by [ct_mcp], and [caught / not caught] by [ct_mcp_context].

This is the single most important engineering finding in the benchmark.

---

## Notes

- Do not publish synthetic or placeholder rows as if they were real benchmark outcomes.
- Do not claim determinism if hidden state or inconsistent model versions affect results.
- Do not claim compounding unless iteration metrics actually improve.
- Explicit caller-provided context is allowed. Hidden internal memory is not.
