# CT-MCP Benchmark Scoring Rubric

## Overview

Each benchmark scenario is scored across 6 dimensions on a 0-3 scale.
Maximum score: 18 (normalized to 0.0-1.0).

Total weighted dimensions sum to 1.0. The raw score is computed as the sum of all dimension scores (each 0-3), then normalized by dividing by 18.

## Free-Text Scoring Approach

Free-text scoring uses deterministic structure checks where possible and rubric-constrained semantic judging only where necessary.

**Deterministic scoring** (reproducible, rule-based) for:
- **specificity** — count thresholds, units, component names, conditionals; penalize vague phrases
- **logical_structure** — detect claim/evidence/conclusion markers, loops, unsupported jumps
- **assumption_honesty** — count explicit assumptions, detect confidence statements, check falsification-condition presence

**LLM-as-judge scoring** (rubric-constrained, strict JSON output) for:
- **correctness** — semantic accuracy relative to scenario ground truth
- **tradeoff_quality** — whether tradeoffs are explicit and weighted
- **safety_readiness** — whether production risks are identified with mitigations

**Human validation** on a 5-scenario subset (2 strong, 2 weak, 1 ambiguous):
- Average per-dimension difference must be <= 1 point
- No unexplained >2-point total delta on any validated scenario

## Dimensions

### 1. Correctness (weight: 25%)

Mathematical and logical accuracy of the tool's output.

| Level | Description |
|-------|-------------|
| 0 | Tool produced incorrect result or missed planted defect |
| 1 | Tool detected issue but with wrong mechanism or incomplete analysis |
| 2 | Tool correctly identified the issue with appropriate mechanism |
| 3 | Tool correctly identified issue, provided actionable corrective prompt |

Applies to all scenarios. For clean controls, a correct PASS result scores 3. For defect scenarios, the planted defect must be detected by the correct mechanism.

### 2. Specificity (weight: 20%)

Precision and actionability of enforcement output.

| Level | Description |
|-------|-------------|
| 0 | Vague or generic output |
| 1 | Names the general area of concern |
| 2 | Names specific mechanism, component, or threshold |
| 3 | Names specific mechanism with measurable condition and time window |

Measures whether the tool output provides enough detail for a developer to act without further investigation.

### 3. Assumption Honesty (weight: 20%)

Whether confidence claims match mathematical basis.

| Level | Description |
|-------|-------------|
| 0 | Confidence inflation undetected |
| 1 | Inflation flagged but not blocked |
| 2 | Inflation blocked with corrective prompt |
| 3 | Inflation blocked, corrective prompt forces specific falsification conditions |

Primarily relevant to `validate_confidence` scenarios (S4-C, S6-B, billing_system). For scenarios that do not involve confidence validation, this dimension is scored based on whether the tool avoids introducing unfounded confidence in its own output.

### 4. Logical Structure (weight: 15%)

DAG integrity, cycle detection, grounding score.

| Level | Description |
|-------|-------------|
| 0 | Structural issues not detected |
| 1 | Partial detection (e.g., found orphan but missed cycle) |
| 2 | All structural issues detected |
| 3 | All issues detected with accurate depth/path analysis |

Primarily relevant to `validate_reasoning_chain` scenarios (S3-A, S3-C, S3-D, S5-C, S6-D). For cycle-containing scenarios, the tool must detect all cycles and report the participating nodes.

### 5. Tradeoff Quality (weight: 10%)

Whether tradeoffs are explicit, quantified, and actionable.

| Level | Description |
|-------|-------------|
| 0 | No tradeoff analysis |
| 1 | Tradeoffs mentioned qualitatively |
| 2 | Tradeoffs quantified with utility scores |
| 3 | Quantified with indeterminate detection when scores are close |

Primarily relevant to `evaluate_tradeoffs` scenarios (S2-B, S4-A, S4-B, S4-D). The tool must compute expected utility for each option and flag cases where options are too close to distinguish (indeterminate).

### 6. Safety & Production Readiness (weight: 10%)

Detection of concurrency issues, race conditions, missing locks.

| Level | Description |
|-------|-------------|
| 0 | Safety issues not addressed |
| 1 | General concern raised without specifics |
| 2 | Specific safety issue named (e.g., race condition) |
| 3 | Safety issue named with specific mitigation (e.g., SELECT FOR UPDATE) |

Primarily relevant to the billing_system flagship scenario and S6-F (mutex-protected code review). For other scenarios, score based on whether the tool surfaces production-readiness concerns when applicable.

## Score Interpretation

| Range | Label | Meaning |
|-------|-------|---------|
| 0.0-0.49 | Below threshold | Tool did not provide meaningful enforcement |
| 0.50-0.74 | Adequate | Core issues detected, some gaps |
| 0.75-0.89 | Good | Most issues detected with actionable output |
| 0.90-1.0 | Excellent | Comprehensive detection with specific corrective guidance |

## Condition Comparison

Scores are computed for each condition:

- **Baseline**: Raw LLM with no tools (requires API integration)
- **Prompted**: LLM with explicit reasoning instructions (requires API integration)
- **CT-MCP**: One-shot deterministic enforcement
- **CT-MCP + Context**: Iterative enforcement with caller-provided context

Publication criteria:

- CT-MCP must win at least 31/42 defect scenarios vs baseline (~73%)
- CT-MCP must win at least 21/42 defect scenarios vs prompted LLM (~50%)
- Zero false positives on clean controls

## Scenario Categories

| Category | Scenarios | Count | Primary Dimensions |
|----------|----------|-------|--------------------|
| Numerical Analysis | S1-A through S1-D | 4 | Correctness, Specificity |
| Reasoning Quality | S2-A through S2-D | 4 | Correctness, Specificity, Tradeoff Quality |
| Multi-Step Logic | S3-A through S3-D, L8 | 5 | Correctness, Logical Structure |
| Decision Making | S4-A through S4-D | 4 | Correctness, Tradeoff Quality, Assumption Honesty |
| Hallucination Detection | S5-A through S5-D | 4 | Correctness, Specificity, Logical Structure |
| Billing (Flagship) | billing_system | 1 | All |
| Production Safety | P1, P2, P4, P8 | 4 | Safety Readiness, Logical Structure |
| Arithmetic | A2, A6 | 2 | Correctness |
| Concurrency Patterns | CON1 through CON5 | 5 | Safety Readiness |
| Confidence Discipline | C4, CONF1, CONF2 | 3 | Assumption Honesty |
| Numeric Anomaly | N8 | 1 | Correctness, Specificity |
| Mutation Tests | MUT1 through MUT3 | 3 | Safety Readiness |
| Adversarial Wording | ADV1, ADV2 | 2 | Safety Readiness |
| Clean Controls | S6-A through S6-F, CC2, CC9, CC11 through CC16 | 14 | All (false positive check) |
| **Total** | | **56** | |
