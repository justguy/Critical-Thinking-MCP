# Example: Arithmetic Verification with CT-MCP

This example demonstrates `verify_arithmetic` catching a weighted-average claim
that sounds plausible but does not match the stated inputs.

---

## Scenario

A team reports an aggregate API reliability score across three regions:

- us-east: 99.9% with 50% of traffic
- eu-west: 99.7% with 30% of traffic
- ap-south: 98.5% with 20% of traffic

The written claim says the weighted average is **99.72%**.

---

## Tool Call: `verify_arithmetic`

```json
{
  "claim_type": "weighted_average",
  "values": [99.9, 99.7, 98.5],
  "weights": [0.5, 0.3, 0.2],
  "claimed_result": 99.72
}
```

## Enforcement Response: `ENFORCEMENT_FAIL`

```json
{
  "status": "ENFORCEMENT_FAIL",
  "computed_result": 99.6,
  "claimed_result": 99.72,
  "difference": -0.12,
  "enforcement": {
    "blocking_issues": [
      {
        "mechanism": "arithmetic_mismatch",
        "description": "Weighted average mismatch: computed 99.6, claimed 99.72",
        "severity": "blocking"
      }
    ],
    "warnings": [],
    "corrective_prompt": "Recompute the weighted average using the stated values and weights. Show each contribution explicitly."
  }
}
```

## What was caught

The arithmetic is deterministic:

```text
99.9 * 0.5 = 49.95
99.7 * 0.3 = 29.91
98.5 * 0.2 = 19.70
Total        = 99.56 -> 99.60
```

The claim of 99.72% is close enough to sound credible in prose, but it is still
wrong. `verify_arithmetic` blocks instead of accepting an almost-right answer.

---

## Corrected Tool Call

```json
{
  "claim_type": "weighted_average",
  "values": [99.9, 99.7, 98.5],
  "weights": [0.5, 0.3, 0.2],
  "claimed_result": 99.6
}
```

## Corrected Response: `PASS`

```json
{
  "status": "PASS",
  "computed_result": 99.6,
  "claimed_result": 99.6,
  "difference": 0
}
```

## Why this matters

- LLMs often produce arithmetic that is directionally right but numerically wrong
- Prompting alone may catch obvious errors but not consistently
- `verify_arithmetic` turns "sounds right" into exact recomputation
