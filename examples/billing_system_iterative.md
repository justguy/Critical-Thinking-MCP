# Billing System: Iterative Enforcement Demo

This example demonstrates CT-MCP's iterative enforcement on a usage-based billing
system architecture review. No hidden memory -- context is passed explicitly by the caller.

## The Scenario

A team is designing a usage-based billing system. The LLM proposes an architecture
and claims high confidence. CT-MCP enforces mathematical constraints across 3 iterations.

---

## Iteration 1 -- No Context (One-Shot)

### Input

```json
{
  "assumptions": [
    {
      "description": "The billing aggregation query will return correct totals",
      "confidence": 0.9
    },
    {
      "description": "Concurrent usage events will be processed in order",
      "confidence": 0.85
    },
    {
      "description": "The payment gateway will respond within SLA",
      "confidence": 0.95,
      "falsification_condition": "Gateway response time exceeds 2000ms for >5% of requests"
    }
  ],
  "response_text": "I am very confident this billing system architecture will handle concurrent usage correctly..."
}
```

### `validate_confidence` Output

```json
{
  "status": "ENFORCEMENT_FAIL",
  "honest_ceiling": 0.285,
  "claimed_confidence": 0.9,
  "gap": 0.615,
  "inflation_detected": true,
  "blocking_issues": [
    {
      "mechanism": "confidence_product",
      "description": "Honest ceiling (0.285) far below claimed confidence (0.9). Two assumptions lack falsification conditions -- confidence capped from 0.9->0.3 and 0.85->0.3."
    }
  ],
  "corrective_prompt": "EVIDENCE CHAIN REQUIRED: For each assumption below confidence 0.7, answer: 'What single observable event would prove this wrong?'..."
}
```

### What happened

- Two assumptions lacked falsification conditions -- capped to 0.3
- Honest ceiling dropped to ~0.285 (0.3 x 0.3 x 0.95)
- Claimed 0.9 vs ceiling 0.285 = massive inflation
- Corrective prompt: counterfactual forcing (first failure)
- **Race condition: NOT surfaced** -- the vague "processed in order" hides it

---

## Iteration 2 -- With Context (Escalation)

The caller passes context from iteration 1's results.

### Input

```json
{
  "assumptions": [
    {
      "description": "The billing aggregation query will return correct totals",
      "confidence": 0.7,
      "falsification_condition": "Totals are incorrect when multiple events arrive simultaneously"
    },
    {
      "description": "Concurrent usage events will be processed correctly",
      "confidence": 0.7,
      "falsification_condition": "Events may be lost during high concurrency"
    },
    {
      "description": "The payment gateway will respond within SLA",
      "confidence": 0.95,
      "falsification_condition": "Gateway response time exceeds 2000ms for >5% of requests"
    }
  ],
  "response_text": "I am fairly confident this billing system will work...",
  "context": {
    "iteration_number": 2,
    "failure_counts_by_mechanism": { "confidence_product": 1 },
    "prior_blocking_issues": ["confidence_product"]
  }
}
```

### `validate_confidence` Output

```json
{
  "status": "ENFORCEMENT_FAIL",
  "honest_ceiling": 0.466,
  "claimed_confidence": 0.75,
  "gap": 0.284,
  "inflation_detected": true,
  "blocking_issues": [
    {
      "mechanism": "confidence_product",
      "description": "Inflation persists. Falsification conditions are too vague to be actionable."
    }
  ],
  "corrective_prompt": "FILL IN THIS TEMPLATE -- do not add explanation, fill the blanks only:\n\nAssumption 1: \"The billing aggregation query...\"\n  Observable failure event: [FILL: specific measurable event]\n  Threshold: [FILL: specific number with unit]\n  Time window: [FILL: specific duration]\n  Revised confidence (0.0-1.0): [FILL: number]\n..."
}
```

### What happened

- Context triggered schema-fill escalation (second failure of same mechanism)
- Falsification conditions present but vague ("events may be lost" -- when? how many?)
- Template forces specific measurable conditions
- **Race condition: PARTIALLY surfaced** -- "concurrent" mentioned but not specific mechanism

---

## Iteration 3 -- With Accumulated Context (Resolution)

### Input

```json
{
  "assumptions": [
    {
      "description": "The billing aggregation query uses SELECT FOR UPDATE to prevent concurrent read-modify-write races",
      "confidence": 0.85,
      "falsification_condition": "Duplicate charges occur when >2 concurrent requests hit the same billing period row without serialization, observable via sum(charges) > expected_total within a 5-second window"
    },
    {
      "description": "Usage events are deduplicated by event_id before aggregation",
      "confidence": 0.9,
      "falsification_condition": "Duplicate event_ids appear in aggregation table when dedup index is absent, detectable by COUNT(DISTINCT event_id) < COUNT(*)"
    },
    {
      "description": "The payment gateway will respond within SLA",
      "confidence": 0.95,
      "falsification_condition": "Gateway response time exceeds 2000ms for >5% of requests"
    }
  ],
  "response_text": "Based on enforced assumptions, overall confidence is approximately 0.72. The billing system uses SELECT FOR UPDATE for serialization and event_id deduplication. The primary remaining risk is gateway timeout under load.",
  "context": {
    "iteration_number": 3,
    "failure_counts_by_mechanism": { "confidence_product": 2 },
    "prior_blocking_issues": ["confidence_product", "confidence_product"],
    "iteration_history": [
      { "iteration_number": 1, "blocking_issues": ["confidence_product"] },
      { "iteration_number": 2, "blocking_issues": ["confidence_product"] }
    ]
  }
}
```

### `validate_confidence` Output

```json
{
  "status": "PASS",
  "honest_ceiling": 0.727,
  "claimed_confidence": 0.72,
  "gap": -0.007,
  "inflation_detected": false,
  "enforcement_score": 0.95,
  "warnings": []
}
```

### What happened

- All assumptions have specific, measurable falsification conditions
- Claimed confidence (0.72) actually BELOW honest ceiling (0.727) -- no inflation
- **Race condition: FULLY SURFACED** -- "SELECT FOR UPDATE" and "concurrent read-modify-write races" explicitly named
- The schema-fill template in iteration 2 forced the specificity that exposed the race condition

---

## The Story in One Table

| Iteration | Context | Confidence Gap | Race Condition | Corrective Style |
|-----------|---------|---------------|----------------|-----------------|
| 1 | None | 0.615 (massive) | Hidden | Counterfactual |
| 2 | Failure counts | 0.284 (shrinking) | Partial | Schema-fill |
| 3 | Full history | -0.007 (honest) | Explicit | None needed |

## What This Proves

1. **The math matters**: Confidence ceiling is non-negotiable regardless of iteration
2. **Context enables escalation**: Schema-fill forced specificity that counterfactual couldn't
3. **No hidden memory**: All iteration state visible in the request payload
4. **The race condition was only caught because the escalation demanded specific mechanisms**
   - Iteration 1 would never have caught it -- "processed in order" sounds fine
   - Iteration 3 caught it because the template forced naming "the specific component" and "the specific condition"
