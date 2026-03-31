# Example: Architecture Review with CT-MCP

This example demonstrates `validate_reasoning_chain` and `validate_confidence`
catching logical errors and confidence inflation during an architecture review
for a payment processing microservice migration.

---

## Context

An engineering team proposes migrating from a monolithic payment processor to
microservices. The LLM is asked to evaluate the migration plan.

---

## Step 1: LLM produces initial reasoning chain

The LLM generates an argument graph for the migration decision:

```
User: Evaluate whether we should decompose our payment monolith into
microservices. Current system processes 12,000 transactions/sec with p99
latency of 45ms.
```

The LLM internally builds this reasoning chain and calls `validate_reasoning_chain`:

### Tool Call: `validate_reasoning_chain`

```json
{
  "nodes": [
    {"id": "e1", "label": "Current monolith handles 12,000 tx/sec at 45ms p99", "type": "evidence"},
    {"id": "a1", "label": "Microservices will improve deployment velocity", "type": "assumption"},
    {"id": "c1", "label": "Payment processing can be split into auth, capture, and settlement", "type": "claim"},
    {"id": "c2", "label": "Each microservice can scale independently", "type": "claim"},
    {"id": "c3", "label": "Independent scaling proves microservices are better", "type": "claim"},
    {"id": "c4", "label": "Better architecture means we should migrate", "type": "claim"},
    {"id": "cn1", "label": "We should proceed with the microservice migration", "type": "conclusion"}
  ],
  "edges": [
    {"from": "e1", "to": "c1", "relation": "supports"},
    {"from": "a1", "to": "c2", "relation": "supports"},
    {"from": "c2", "to": "c3", "relation": "implies"},
    {"from": "c3", "to": "c4", "relation": "implies"},
    {"from": "c4", "to": "c2", "relation": "implies"},
    {"from": "c4", "to": "cn1", "relation": "implies"}
  ]
}
```

### Enforcement Response: `ENFORCEMENT_FAIL`

```json
{
  "status": "ENFORCEMENT_FAIL",
  "cycles": [
    {"path": ["c2", "c3", "c4", "c2"]}
  ],
  "orphaned_conclusions": [],
  "grounding_score": 1.0,
  "node_count": 7,
  "edge_count": 6,
  "enforcement": {
    "blocking_issues": [
      {
        "mechanism": "cycle_detection",
        "description": "Found 1 circular reasoning cycle(s): c2 -> c3 -> c4 -> c2",
        "severity": "blocking"
      }
    ],
    "warnings": [
      "Node \"a1\" label is too vague (specificity=0.18). Add concrete details.",
      "Node \"c3\" label is too vague (specificity=0.15). Add concrete details."
    ],
    "corrective_prompt": "ENFORCEMENT FAILURE for tool \"validate_reasoning_chain\":\n[BLOCKING] cycle_detection: Found 1 circular reasoning cycle(s): c2 -> c3 -> c4 -> c2\n\nCORRECTIVE ACTION:\nAnswer ONLY the numbered checklist below — one phrase per blank:\n\n1. Component: ___\n2. Condition: ___\n3. Threshold: ___\n4. Outcome: ___"
  }
}
```

**What was caught:** The reasoning chain contains circular logic. "Each
microservice can scale independently" implies "independent scaling proves
microservices are better" which implies "better architecture means we should
migrate" which loops back to "each microservice can scale independently." This
is a self-reinforcing argument with no external grounding.

---

## Step 2: LLM corrects the reasoning chain

The corrective prompt forces the LLM to break the cycle by grounding each
claim in independent evidence:

### Corrected Tool Call: `validate_reasoning_chain`

```json
{
  "nodes": [
    {"id": "e1", "label": "Current monolith handles 12,000 tx/sec at 45ms p99", "type": "evidence"},
    {"id": "e2", "label": "Deploy frequency is 1x/week due to monolith coupling — 3 rollbacks in past quarter", "type": "evidence"},
    {"id": "e3", "label": "Auth service load is 4x capture service load during Black Friday", "type": "evidence"},
    {"id": "a1", "label": "Network latency between services adds <5ms per hop with service mesh", "type": "assumption"},
    {"id": "c1", "label": "Payment flow can be split into auth, capture, settlement with async settlement", "type": "claim"},
    {"id": "c2", "label": "Auth service can scale to 48,000 req/sec independently during peak", "type": "claim"},
    {"id": "cn1", "label": "Migrate auth first as standalone service; keep capture+settlement in monolith until Q3", "type": "conclusion"}
  ],
  "edges": [
    {"from": "e1", "to": "c1", "relation": "supports"},
    {"from": "e2", "to": "cn1", "relation": "supports"},
    {"from": "e3", "to": "c2", "relation": "supports"},
    {"from": "a1", "to": "c2", "relation": "requires"},
    {"from": "c1", "to": "cn1", "relation": "implies"},
    {"from": "c2", "to": "cn1", "relation": "implies"}
  ]
}
```

### Corrected Response: `PASS`

```json
{
  "status": "PASS",
  "cycles": [],
  "orphaned_conclusions": [],
  "grounding_score": 1.0,
  "node_count": 7,
  "edge_count": 6
}
```

The cycle is broken. Each claim now traces back to independent evidence. The
conclusion is scoped ("migrate auth first") rather than sweeping.

---

## Step 3: Validate confidence in the migration plan

The LLM now calls `validate_confidence` with its assumptions:

### Tool Call: `validate_confidence`

```json
{
  "assumptions": [
    {
      "description": "Network latency between services adds <5ms per hop with service mesh",
      "confidence": 0.75,
      "falsification_condition": "Measured inter-service p99 latency exceeds 15ms in staging with Istio sidecar under 5,000 RPS"
    },
    {
      "description": "Auth service can be extracted without changing the payment state machine",
      "confidence": 0.6,
      "falsification_condition": "Auth service requires synchronous read of capture state during 3D Secure flow"
    },
    {
      "description": "Team can operate two deployment pipelines by end of Q2",
      "confidence": 0.8,
      "falsification_condition": "CI/CD setup for second pipeline takes >4 weeks based on infra team capacity"
    }
  ],
  "response_text": "We recommend migrating the auth service first. The network overhead is manageable, the auth flow is decoupled from capture state, and the team can handle dual pipelines. We are 85% confident this migration will succeed within the proposed timeline."
}
```

### Enforcement Response: `ENFORCEMENT_FAIL`

```json
{
  "status": "ENFORCEMENT_FAIL",
  "honest_ceiling": 0.36,
  "claimed_confidence": 0.85,
  "gap": 0.49,
  "inflation_detected": true,
  "dependency_weights": [0.75, 0.6, 0.8],
  "falsifiability": {
    "score": 1.0,
    "passes": true,
    "unfalsifiable": []
  },
  "assumption_count": 3,
  "enforcement": {
    "blocking_issues": [
      {
        "mechanism": "confidence_inflation",
        "description": "Claimed confidence exceeds honest ceiling by 0.490. Honest ceiling: 0.360, claimed: 0.850. Reduce claimed confidence or strengthen assumptions.",
        "severity": "blocking"
      }
    ],
    "warnings": [],
    "corrective_prompt": "ENFORCEMENT FAILURE for tool \"validate_confidence\":\n[BLOCKING] confidence_inflation: Claimed confidence exceeds honest ceiling by 0.490. ...\n\nCORRECTIVE ACTION:\nEVIDENCE CHAIN REQUIRED: For each assumption below confidence 0.7, answer: 'What single observable event would prove this wrong?' Name a threshold, a component, a time window. If you cannot, state: 'No falsification condition — confidence <= 0.3.'"
  }
}
```

**What was caught:** The LLM claimed 85% confidence, but the honest ceiling
is only 36% (0.75 x 0.6 x 0.8 = 0.36). The gap of 0.49 far exceeds the
0.15 threshold. Note that the falsifiability score is perfect (1.0) because
all three assumptions have concrete falsification conditions — the problem is
purely with confidence inflation.

---

## Step 4: LLM corrects the confidence claim

```
Revised response: "We recommend migrating the auth service first as a
lower-risk starting point. The honest confidence ceiling for this plan is
36%, reflecting that: (1) inter-service latency may exceed targets (75%
confident), (2) auth-capture coupling is uncertain (60% confident), and (3)
dual pipeline readiness depends on infra team capacity (80% confident).

Key risk: the weakest assumption is auth-capture decoupling at 60%. If the
3D Secure flow requires synchronous capture state reads, the entire
extraction is blocked. We recommend a 2-week spike to map all auth-to-capture
data dependencies before committing to the migration timeline."
```

The corrected response:
- States the honest ceiling (36%) instead of inflated 85%
- Identifies the weakest assumption and its impact
- Proposes a concrete risk-mitigation step (2-week spike)
- Scopes the recommendation to avoid overcommitment

---

## Summary

| Step | Tool | Result | Issue |
|------|------|--------|-------|
| 1 | `validate_reasoning_chain` | ENFORCEMENT_FAIL | Circular reasoning: c2 -> c3 -> c4 -> c2 |
| 2 | `validate_reasoning_chain` | PASS | Cycle broken, all claims grounded in evidence |
| 3 | `validate_confidence` | ENFORCEMENT_FAIL | Confidence inflation: claimed 85%, ceiling 36% |
| 4 | (revised text) | PASS | Honest ceiling stated, risk mitigation proposed |

The enforcement loop required two iterations to produce a grounded,
honestly-scoped architecture recommendation.
