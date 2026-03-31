# Manual Validation Protocol

## Purpose

Proves: "The scoring is credible."

The hybrid rubric uses deterministic scoring for 3 dimensions and LLM-as-judge for 3 dimensions. This protocol validates that the combined scores are credible by comparing them to human judgment on a subset of scenarios.

---

## Subset Selection

Score 5 scenarios manually:

| Slot | Expected quality | Scenario | Rationale |
|------|-----------------|----------|-----------|
| Strong 1 | High | S6-F (mutex fix) | Clean control with concrete metrics, incident IDs, clear structure |
| Strong 2 | High | S3-A (uptime chain) | Correct numerical reasoning, grounded DAG |
| Weak 1 | Low | S4-C (event sourcing inflation) | Confidence inflation should be caught |
| Weak 2 | Low | S5-B (Xeldon.js) | Fabricated framework, low specificity |
| Ambiguous | Mixed | billing_system | Flagship, complex, partially fails |

---

## Scoring Procedure

For each of the 5 scenarios, record:

### 1. Run hybrid scorer

```
Scenario: ___
Condition: ct_mcp

Deterministic scores:
  specificity:        ___/3
  logical_structure:  ___/3
  assumption_honesty: ___/3

Judge scores:
  correctness:        ___/3
  tradeoff_quality:   ___/3
  safety_readiness:   ___/3

quality_score (normalized): ___
```

### 2. Score manually (human)

Use the same rubric definitions from `benchmark/rubric.json`. For each dimension, assign a score from 0-3 based on the level descriptors.

```
Human scores:
  correctness:        ___/3
  specificity:        ___/3
  assumption_honesty: ___/3
  logical_structure:  ___/3
  tradeoff_quality:   ___/3
  safety_readiness:   ___/3

human_quality_score (normalized): ___
```

### 3. Compute deltas

```
Per-dimension deltas (hybrid - human):
  correctness:        ___
  specificity:        ___
  assumption_honesty: ___
  logical_structure:  ___
  tradeoff_quality:   ___
  safety_readiness:   ___

Total delta: ___
quality_score delta: ___
```

---

## Acceptance Rules

| Rule | Threshold | Meaning |
|------|-----------|---------|
| Average per-dimension delta | <= 1.0 | Hybrid scoring is within 1 rubric level of human on average |
| Max scenario total delta | <= 2 (or explained) | No scenario wildly misjudged without explanation |
| Direction agreement | >= 4/5 | Hybrid and human agree on pass/fail classification |

If any rule fails, document:
- Which dimension diverged
- Why (pattern matching blind spot? judge hallucination? human bias?)
- Whether the rubric definition needs clarification

---

## Recording Template

Use this template for each validated scenario. Save to `benchmark/validation/results/`.

**File**: `benchmark/validation/results/{scenario_id}.json`

```json
{
  "scenario_id": "S6-F",
  "condition": "ct_mcp",
  "validation_date": "2026-03-30",
  "validator": "human",

  "hybrid_scores": {
    "correctness": 3,
    "specificity": 3,
    "assumption_honesty": 2,
    "logical_structure": 3,
    "tradeoff_quality": 1,
    "safety_readiness": 3,
    "quality_score": 0.833
  },

  "human_scores": {
    "correctness": 3,
    "specificity": 3,
    "assumption_honesty": 2,
    "logical_structure": 3,
    "tradeoff_quality": 1,
    "safety_readiness": 3,
    "quality_score": 0.833
  },

  "deltas": {
    "correctness": 0,
    "specificity": 0,
    "assumption_honesty": 0,
    "logical_structure": 0,
    "tradeoff_quality": 0,
    "safety_readiness": 0,
    "total_delta": 0,
    "quality_score_delta": 0.0
  },

  "notes": "Perfect agreement. Clean control with rich structural features."
}
```

---

## Aggregate Validation Report

After all 5 scenarios are validated, compute:

```
VALIDATION SUMMARY
==================
Scenarios validated: 5
Average per-dimension delta: ___
Max scenario total delta: ___
Direction agreement: ___/5

Acceptance: PASS / FAIL

If FAIL:
  Dimensions with systematic divergence: ___
  Proposed rubric clarification: ___
```

Save to: `benchmark/validation/VALIDATION_REPORT.md`

---

## When to Re-Validate

Re-run validation when:
- Rubric scoring logic changes (extract_features.ts or deterministic_score.ts)
- Judge prompt changes (judge_score.ts)
- New scenarios are added to the validation subset
- Model version changes for judge scoring
