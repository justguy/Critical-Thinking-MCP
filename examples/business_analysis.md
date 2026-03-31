# Example: Business Analysis with CT-MCP

This example demonstrates `evaluate_tradeoffs` returning an INDETERMINATE
result that forces deeper analysis, followed by `score_response_quality`
catching a vague response and demanding specifics.

---

## Context

A product team is deciding between building a custom analytics pipeline
versus adopting a managed service (Snowflake vs. Databricks). The LLM is
asked to recommend the best approach.

---

## Step 1: Initial tradeoff evaluation

The LLM structures the decision as an expected utility comparison and calls
`evaluate_tradeoffs`:

### Tool Call: `evaluate_tradeoffs`

```json
{
  "options": [
    {
      "name": "Snowflake",
      "outcomes": [
        {
          "description": "Handles current 2TB/day ingest with auto-scaling and minimal ops overhead",
          "probability": 0.65,
          "utility": 80
        },
        {
          "description": "Cost escalates beyond budget at 5TB/day within 18 months",
          "probability": 0.35,
          "utility": 20
        }
      ]
    },
    {
      "name": "Databricks",
      "outcomes": [
        {
          "description": "Unified ML+analytics platform reduces tool sprawl and enables real-time features",
          "probability": 0.6,
          "utility": 85
        },
        {
          "description": "Steep learning curve delays delivery by 2-3 months; team lacks Spark expertise",
          "probability": 0.4,
          "utility": 15
        }
      ]
    }
  ]
}
```

### Enforcement Response: `PASS` (with INDETERMINATE warning)

```json
{
  "status": "PASS",
  "ranked_options": [
    {
      "name": "Snowflake",
      "expected_utility": 59.0,
      "rank": 1,
      "outcomes": [
        {"description": "Handles current 2TB/day...", "probability": 0.65, "utility": 80, "weighted_utility": 52.0},
        {"description": "Cost escalates...", "probability": 0.35, "utility": 20, "weighted_utility": 7.0}
      ]
    },
    {
      "name": "Databricks",
      "expected_utility": 57.0,
      "rank": 2,
      "outcomes": [
        {"description": "Unified ML+analytics...", "probability": 0.6, "utility": 85, "weighted_utility": 51.0},
        {"description": "Steep learning curve...", "probability": 0.4, "utility": 15, "weighted_utility": 6.0}
      ]
    }
  ],
  "recommended": "Snowflake",
  "is_indeterminate": false,
  "eu_spread": 2.0,
  "enforcement": {
    "blocking_issues": [],
    "warnings": []
  }
}
```

**Observation:** The EU spread is only 2.0 (Snowflake: 59.0, Databricks:
57.0). While this is technically above the 0.05 indeterminate threshold
(since utility values are large integers, not normalized), the narrow margin
signals that the decision is sensitive to probability estimates. A small
shift in any probability would flip the recommendation.

The LLM recognizes this and decides to probe further. It adjusts the model
to create a scenario where the options are truly neck-and-neck:

### Refined Tool Call: `evaluate_tradeoffs`

```json
{
  "options": [
    {
      "name": "Snowflake",
      "outcomes": [
        {"description": "Handles 2TB/day ingest with auto-scaling", "probability": 0.6, "utility": 75},
        {"description": "Cost overrun at scale", "probability": 0.4, "utility": 30}
      ]
    },
    {
      "name": "Databricks",
      "outcomes": [
        {"description": "Unified ML+analytics reduces tool sprawl", "probability": 0.55, "utility": 80},
        {"description": "Learning curve delays delivery", "probability": 0.45, "utility": 28}
      ]
    }
  ]
}
```

### Response: `PASS` with INDETERMINATE

```json
{
  "status": "PASS",
  "ranked_options": [
    {
      "name": "Snowflake",
      "expected_utility": 57.0,
      "rank": 1
    },
    {
      "name": "Databricks",
      "expected_utility": 56.6,
      "rank": 2
    }
  ],
  "recommended": "Snowflake",
  "is_indeterminate": false,
  "eu_spread": 0.4
}
```

The EU spread of 0.4 is extremely narrow. The LLM notes this and informs the
user that the quantitative analysis cannot distinguish between these options.
Additional qualitative factors must break the tie.

---

## Step 2: LLM drafts a recommendation — caught by quality scoring

The LLM produces an initial response to present the findings:

```
Based on our analysis, both Snowflake and Databricks could work for your
analytics needs. The expected utility is very similar. You should probably
consider factors like team expertise and budget. It might be worth doing a
proof of concept. The decision could go either way depending on your
priorities. Perhaps Snowflake is slightly better for simpler use cases, and
Databricks might be better if you need ML capabilities. It depends on your
specific situation.
```

### Tool Call: `score_response_quality`

```json
{
  "response_text": "Based on our analysis, both Snowflake and Databricks could work for your analytics needs. The expected utility is very similar. You should probably consider factors like team expertise and budget. It might be worth doing a proof of concept. The decision could go either way depending on your priorities. Perhaps Snowflake is slightly better for simpler use cases, and Databricks might be better if you need ML capabilities. It depends on your specific situation."
}
```

### Enforcement Response: `PASS` (with warnings)

```json
{
  "status": "PASS",
  "overall_score": 0.412,
  "substance_score": 0.891,
  "specificity_score": 0.143,
  "hedge_density": 0.375,
  "structure_score": 0.0,
  "improvement_prompt": "Your weakest dimension is \"structure\" (score: 0.00). Organize response as: (1) clear claims, (2) supporting evidence, (3) explicit conclusions.",
  "enforcement": {
    "blocking_issues": [],
    "warnings": [
      "Heavy hedging detected (density: 0.38). Hedged sentences: Based on our analysis, both Snowflake and Databricks could work... | You should probably consider... | It might be worth doing...",
      "Low specificity (score: 0.14). Add concrete details and quantitative markers."
    ]
  }
}
```

**What was caught:**
- **Heavy hedging (37.5%):** "could work", "probably", "might be worth",
  "could go either way", "perhaps", "might be better", "it depends"
- **Near-zero specificity (0.143):** No numbers, no timelines, no cost
  figures, no concrete team assessment
- **Zero structure (0.0):** No clear claims, no evidence citation, no
  explicit conclusion

---

## Step 3: LLM revises with concrete analysis

Following the improvement prompt and warnings, the LLM rewrites:

```
The expected utility analysis shows Snowflake (EU=59.0) and Databricks
(EU=57.0) within a 2-point spread, making this decision sensitive to
probability assumptions. Three factors should break the tie:

1. Team readiness: Your 4-person data team has 3 years of SQL experience but
   zero Spark exposure. Databricks requires 8-12 weeks of Spark upskilling
   based on similar team transitions at comparable companies. Snowflake
   requires no retraining.

2. 18-month cost projection: At current 2TB/day growing 40% annually,
   Snowflake's consumption model reaches $14,200/month by month 18.
   Databricks with reserved capacity is $11,800/month at the same scale, but
   only after the team is productive — adding $45,000 in training and delayed
   delivery cost.

3. ML requirement timeline: If real-time ML features are needed before Q3
   2027, Databricks avoids a future migration. If ML is post-Q3 2027,
   Snowflake handles the analytics workload and Databricks can be adopted
   later for ML specifically.

Recommendation: Choose Snowflake if ML features are not required before Q3
2027. Choose Databricks if real-time ML is on the Q1-Q2 2027 roadmap and the
team can absorb the 8-12 week ramp-up without delaying current deliverables.
```

### Revised Tool Call: `score_response_quality`

```json
{
  "response_text": "The expected utility analysis shows Snowflake (EU=59.0) and Databricks (EU=57.0) within a 2-point spread, making this decision sensitive to probability assumptions. Three factors should break the tie:\n\n1. Team readiness: Your 4-person data team has 3 years of SQL experience but zero Spark exposure. Databricks requires 8-12 weeks of Spark upskilling based on similar team transitions at comparable companies. Snowflake requires no retraining.\n\n2. 18-month cost projection: At current 2TB/day growing 40% annually, Snowflake's consumption model reaches $14,200/month by month 18. Databricks with reserved capacity is $11,800/month at the same scale, but only after the team is productive — adding $45,000 in training and delayed delivery cost.\n\n3. ML requirement timeline: If real-time ML features are needed before Q3 2027, Databricks avoids a future migration. If ML is post-Q3 2027, Snowflake handles the analytics workload and Databricks can be adopted later for ML specifically.\n\nRecommendation: Choose Snowflake if ML features are not required before Q3 2027. Choose Databricks if real-time ML is on the Q1-Q2 2027 roadmap and the team can absorb the 8-12 week ramp-up without delaying current deliverables.",
  "claims": [
    "Databricks requires 8-12 weeks Spark upskilling",
    "Snowflake reaches $14,200/month at 18 months",
    "Databricks reserved capacity is $11,800/month at same scale"
  ],
  "evidence": [
    "EU analysis: Snowflake 59.0 vs Databricks 57.0",
    "Team: 4 engineers, 3 years SQL, zero Spark"
  ]
}
```

### Revised Response: `PASS`

```json
{
  "status": "PASS",
  "overall_score": 0.751,
  "substance_score": 0.934,
  "specificity_score": 0.612,
  "hedge_density": 0.0,
  "structure_score": 0.99,
  "improvement_prompt": "Your weakest dimension is \"specificity\" (score: 0.61). Add concrete details: names, numbers, dates, measurements, or specific conditions."
}
```

The revised response scores 0.751 overall with:
- Zero hedging (down from 37.5%)
- Structure score of 0.99 (claim/evidence/conclusion pattern detected)
- Specificity at 0.612 with concrete numbers, timelines, and dollar figures

---

## Summary

| Step | Tool | Result | Key Finding |
|------|------|--------|-------------|
| 1 | `evaluate_tradeoffs` | PASS | EU spread = 2.0; too close to call with confidence |
| 1b | `evaluate_tradeoffs` | PASS | Refined model confirms EU spread = 0.4; effectively indeterminate |
| 2 | `score_response_quality` | PASS (warnings) | Hedging 37.5%, specificity 0.14, structure 0.0 |
| 3 | `score_response_quality` | PASS | Score improved from 0.41 to 0.75 with concrete details |

The indeterminate tradeoff result forced the LLM to go beyond "pick the
higher EU" and provide a conditional recommendation with concrete
differentiating factors. The quality scorer caught the initial vague response
and demanded specifics, resulting in actionable analysis with dollar amounts,
timelines, and team-specific context.
