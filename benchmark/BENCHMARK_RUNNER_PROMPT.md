# CT-MCP Benchmark Runner Prompt

You are running a controlled benchmark to measure whether CT-MCP (a deterministic mathematical enforcement MCP server) adds value beyond a raw LLM and a prompted LLM.

## What you are proving

Three conditions are compared on the same 56 scenarios (42 defect + 14 clean control):

1. **baseline** — You answer with no tools and no special instructions.
2. **prompted** — You answer with a reasoning-quality system prompt but no tools.
3. **ct_mcp** — You answer with the CT-MCP MCP server wired, and you MUST call the appropriate tool for each scenario.

For each condition × scenario, you produce a response. The responses are scored against a 6-dimension rubric. The scores determine whether CT-MCP passes its publication gates.

---

## Publication gates (what needs to be true)

- CT-MCP quality_score > baseline on **at least 31 of 42** defect scenarios (~73%)
- CT-MCP quality_score > prompted on **at least 21 of 42** defect scenarios (~50%)
- **billing_system** race condition caught by CT-MCP: YES
- **billing_system** SLA explicitly defined by CT-MCP: YES
- **0 false positives** on 14 clean control scenarios

---

## How to run

### Setup

The CT-MCP MCP server should be configured in your MCP settings:

```json
{
  "mcpServers": {
    "ct-mcp": {
      "command": "node",
      "args": ["./node_modules/.bin/critical-thinking-mcp"]
    }
  }
}
```

Build it first: `npm run build` (if running from source)

The server exposes 9 tools (backed by 15 enforcement mechanisms):
- `validate_reasoning_chain` — DAG cycle detection, grounding score, orphan detection
- `check_numeric_claims` — fabrication detection (4 signals), MAD outlier detection, monotonicity checking
- `verify_arithmetic` — **NEW** — strict recomputation of sums, weighted averages, percentages, growth, products
- `detect_drift` — CUSUM drift detection, monotonic progress tracking
- `evaluate_tradeoffs` — expected utility computation, indeterminate detection
- `check_plan_validity` — cycle detection, missing prerequisites, resource conflicts, critical path
- `score_response_quality` — substance, specificity, hedging, structure, entity grounding, text concurrency scan
- `validate_confidence` — confidence ceiling, inflation detection, falsification checking
- `detect_concurrency_patterns` — **NEW** — structured check-then-act, missing idempotency, ordering assumptions

Key: `verify_arithmetic` takes structured input (claim_type, values, weights, claimed_result) and does strict recomputation. `detect_concurrency_patterns` takes structured steps + shared_resources + protections.

### Execution order

Run all 56 scenarios under each condition sequentially:

1. **baseline** — all 56 scenarios (no tools, no system prompt)
2. **prompted** — all 56 scenarios (system prompt below, no tools)
3. **ct_mcp** — all 56 scenarios (CT-MCP tools available, call the designated tool)

For each scenario, record the response and the result row.

---

## Condition 1: BASELINE

No system prompt. No tools. For each scenario, you receive only the scenario prompt below and answer naturally.

## Condition 2: PROMPTED

Use this exact system prompt:

```
Before answering any technical question, you must:

1. List every assumption you are making. For each, state a confidence
   score from 0.0 to 1.0 and the specific condition that would prove
   it wrong. If you cannot state a falsification condition, your
   confidence must be 0.3 or below.

2. Compute your honest output confidence as the product of your
   assumption confidences. Do not claim higher confidence than this
   product allows.

3. Identify the three most significant gaps or blindspots in your
   answer — things you are not addressing that a thorough analyst would.

4. For any time references ("every few minutes", "quickly", "soon"),
   replace them with a specific SLA: a number and a unit.

5. Identify any race conditions, concurrency issues, or ordering
   dependencies in your proposed approach. If you find none, state
   explicitly: "No race conditions identified."

6. State the explicit tradeoff you are making between the two strongest
   competing approaches, with a numerical utility score for each.

Apply all six checks before producing your answer.
```

No tools. The LLM must self-apply the checks.

## Condition 3: CT_MCP

No special system prompt. CT-MCP MCP server is wired. For each scenario, you MUST call the designated tool with the exact input specified. Record the tool's structured response as the result.

---

## Scoring rubric

Each response is scored across 6 dimensions on a 0–3 scale:

### 1. Correctness (weight: 0.25)
- 0: Incorrect or missed the planted defect
- 1: Issue detected but wrong mechanism or incomplete
- 2: Correctly identified with appropriate mechanism
- 3: Identified + actionable corrective guidance

### 2. Specificity (weight: 0.20)
- 0: Vague or generic
- 1: Names the general area
- 2: Names specific mechanism, component, or threshold
- 3: Mechanism + measurable condition + time window

### 3. Assumption Honesty (weight: 0.20)
- 0: Confidence inflation undetected
- 1: Flagged but not blocked
- 2: Blocked with corrective prompt
- 3: Blocked + forces specific falsification conditions

### 4. Logical Structure (weight: 0.15)
- 0: Structural issues undetected
- 1: Partial detection
- 2: All issues detected
- 3: Issues + accurate depth/path analysis

### 5. Tradeoff Quality (weight: 0.10)
- 0: No tradeoff analysis
- 1: Qualitative mention
- 2: Quantified with utility scores
- 3: Quantified + indeterminate detection when close

### 6. Safety Readiness (weight: 0.10)
- 0: Not addressed
- 1: General concern without specifics
- 2: Specific issue named (e.g., "race condition")
- 3: Issue + specific mitigation (e.g., "SELECT FOR UPDATE")

**quality_score** = (sum of weighted dimension scores) where each dimension contributes `(score/3) * weight`. Range: 0.0–1.0.

---

## Output format

For each scenario × condition, produce one JSON row:

```json
{
  "scenario_id": "S1-A",
  "condition": "baseline",
  "dimension_scores": {
    "correctness": 2,
    "specificity": 1,
    "assumption_honesty": 1,
    "logical_structure": 2,
    "tradeoff_quality": 0,
    "safety_readiness": 0
  },
  "quality_score": 0.383,
  "race_condition_caught": false,
  "sla_defined": false,
  "is_clean_control": false,
  "false_positive": false,
  "tools_fired": [],
  "enforcement_blocks": [],
  "response_summary": "Brief 1-2 sentence summary of what the response contained"
}
```

For ct_mcp rows, also include:
```json
{
  "tools_fired": ["check_numeric_claims"],
  "enforcement_blocks": ["confidence_product"],
  "corrective_prompt_excerpt": "First 100 chars of corrective prompt if any"
}
```

Collect all rows into a single array and save as `benchmark_results_raw.json`.

---

## The 56 scenarios

Each scenario below specifies:
- **Prompt**: What to send to the LLM for baseline/prompted conditions
- **Tool + Input**: What to call for the ct_mcp condition
- **Ground truth**: What a correct response should catch (used for scoring, not shown to the LLM)
- **Flags**: What to record (race_condition_caught, sla_defined, etc.)

---

### S1-A — Basic statistics verification

**Prompt**: "Here are task completion times in minutes for 10 sample runs: 14, 18, 11, 13, 6, 8, 2, 16, 14, 2. Compute the mean and standard deviation. Are there any anomalies in this data?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [14, 18, 11, 13, 6, 8, 2, 16, 14, 2],
  "description": "Task completion times in minutes for 10 sample runs"
}
```

**Ground truth**: Mean ~10.4, std ~5.31. No defects. Should PASS. Low fabrication suspicion, zero outliers.
**Clean control**: No

---

### S1-B — Geometric spacing detection

**Prompt**: "Our sprint had 7 work items with these durations in days: 2, 4, 8, 1, 16, 2, 4. Do these task estimates look realistic?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [2, 4, 8, 1, 16, 2, 4],
  "description": "Sprint task durations in days across 7 work items"
}
```

**Ground truth**: Powers-of-two pattern. Fabrication suspicion >= moderate.
**Clean control**: No

---

### S1-C — Outlier detection (Q4 revenue)

**Prompt**: "Quarterly revenue figures: Q1=$1.2M, Q2=$1.4M, Q3=$890K, Q4=$47M. Do these numbers look right?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [1200000, 1400000, 890000, 47000000],
  "description": "Quarterly revenue: Q1=$1.2M, Q2=$1.4M, Q3=$890K, Q4=$47M"
}
```

**Ground truth**: Q4 is extreme outlier, Z-score ~3.8. Must detect outlier.
**Clean control**: No

---

### S1-D — Compound interest verification

**Prompt**: "We invested $10,000 at 5% annual interest for 7 years. The projected future value is $14,071. Is this calculation correct?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [10000, 14071],
  "description": "Principal and future value of $10,000 at 5% annual rate over 7 years"
}
```

**Ground truth**: $10,000 × 1.05^7 = $14,071. Correct. Should PASS.
**Clean control**: No

---

### S2-A — Hedge detection ("it depends")

**Prompt**: "Should a startup with 8 engineers use microservices or a monolith?"

**Tool**: `score_response_quality`
**Input**:
```json
{
  "response_text": "It really depends on the situation. There are many factors to consider. Microservices might be better in some cases, but monoliths could also work. It is hard to say definitively. You should probably evaluate your specific needs. Both approaches have their pros and cons. It depends on team size, maybe, and it could depend on deployment complexity. Perhaps microservices would be better for larger teams, but possibly not. It is difficult to provide a clear answer."
}
```

**Ground truth**: Heavy hedging. Hedge density >= 0.3, specificity <= 0.3. Should flag or fail.
**Clean control**: No

---

### S2-B — PostgreSQL vs MongoDB tradeoff

**Prompt**: "We're building a social network. Should we use PostgreSQL or MongoDB for our primary datastore? Evaluate the tradeoffs quantitatively."

**Tool**: `evaluate_tradeoffs`
**Input**:
```json
{
  "options": [
    {
      "name": "PostgreSQL",
      "outcomes": [
        { "description": "Handles complex queries and joins for social graph", "probability": 0.7, "utility": 80 },
        { "description": "Struggles at >10M users with write-heavy social feed", "probability": 0.3, "utility": 20 }
      ]
    },
    {
      "name": "MongoDB",
      "outcomes": [
        { "description": "Scales horizontally for feed writes and denormalized reads", "probability": 0.6, "utility": 75 },
        { "description": "Complex social graph queries require workarounds", "probability": 0.4, "utility": 30 }
      ]
    }
  ]
}
```

**Ground truth**: PostgreSQL EU ~62, MongoDB EU ~57. Should compute expected utility and recommend.
**Clean control**: No

---

### S2-C — Build vs buy blindspot

**Prompt**: "Should our enterprise build its own authentication system or buy one?"

**Tool**: `score_response_quality`
**Input**:
```json
{
  "response_text": "For enterprise authentication, you could build your own solution or buy one. Building gives you more control, while buying saves time. There are various options available on the market. Some teams prefer building because it is customizable. Other teams prefer buying because it is faster to deploy. The decision should be based on your requirements."
}
```

**Ground truth**: No concrete details — no vendor names, no compliance frameworks, no costs, no timelines. Specificity <= 0.3.
**Clean control**: No

---

### S2-D — Friday deploy hedging

**Prompt**: "Our team wants to deploy to production on Fridays. What are the risks and how should we mitigate them?"

**Tool**: `score_response_quality`
**Input**:
```json
{
  "response_text": "Deploying on Fridays is generally considered risky. If something goes wrong, the team might not be available to fix it over the weekend. However, some teams do deploy on Fridays successfully. It probably depends on your monitoring setup and on-call rotation. You might want to consider your rollback strategy. Perhaps having good CI/CD could mitigate some of the risk. It is worth thinking about carefully.",
  "claims": ["Friday deploys are risky", "Monitoring and on-call mitigate risk"]
}
```

**Ground truth**: Hedging with 'might', 'probably', 'perhaps' without concrete thresholds. Hedge density >= 0.2.
**Clean control**: No

---

### S3-A — Service chain uptime (grounded DAG)

**Prompt**: "Three services each have 99% uptime. We need 99.5% end-to-end SLA. Evaluate whether this is achievable."

**Tool**: `validate_reasoning_chain`
**Input**:
```json
{
  "nodes": [
    { "id": "e1", "label": "Service A has 99% measured uptime over 90 days", "type": "evidence" },
    { "id": "e2", "label": "Service B has 99% measured uptime over 90 days", "type": "evidence" },
    { "id": "e3", "label": "Service C has 99% measured uptime over 90 days", "type": "evidence" },
    { "id": "a1", "label": "Services fail independently with no correlated outages", "type": "assumption" },
    { "id": "c1", "label": "Combined chain uptime is 99% times 99% times 99% = 97.03%", "type": "claim" },
    { "id": "cn1", "label": "The end-to-end SLA of 99.5% cannot be met with the current architecture", "type": "conclusion" }
  ],
  "edges": [
    { "from": "e1", "to": "c1", "relation": "supports" },
    { "from": "e2", "to": "c1", "relation": "supports" },
    { "from": "e3", "to": "c1", "relation": "supports" },
    { "from": "a1", "to": "c1", "relation": "requires" },
    { "from": "c1", "to": "cn1", "relation": "implies" }
  ]
}
```

**Ground truth**: Well-formed chain. No cycles. Grounding score 1.0. Should PASS.
**Clean control**: No

---

### S3-B — Sprint velocity FTE calculation

**Prompt**: "We have 4 engineers plus 2 new hires at 50% productivity. Is our claimed sprint velocity of 40 story points realistic at 5 FTE?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [4, 2, 0.5, 5, 40],
  "description": "4 existing engineers + 2 new hires at 50% productivity = 5 FTE. Sprint velocity claimed as 40 story points."
}
```

**Ground truth**: 4 + 2×0.5 = 5 FTE. Internally consistent. Should PASS.
**Clean control**: No

---

### S3-C — Circular reasoning: server scaling

**Prompt**: "Review this reasoning chain about our server scaling decision."

**Tool**: `validate_reasoning_chain`
**Input**:
```json
{
  "nodes": [
    { "id": "c1", "label": "We need more servers to handle the load", "type": "claim" },
    { "id": "c2", "label": "Database queries are running slowly under current load", "type": "claim" },
    { "id": "c3", "label": "Slow queries prove we need more servers", "type": "claim" },
    { "id": "cn1", "label": "Therefore we must provision 10 additional servers immediately", "type": "conclusion" }
  ],
  "edges": [
    { "from": "c1", "to": "c2", "relation": "implies" },
    { "from": "c2", "to": "c3", "relation": "implies" },
    { "from": "c3", "to": "c1", "relation": "implies" },
    { "from": "c3", "to": "cn1", "relation": "implies" }
  ]
}
```

**Ground truth**: Cycle: c1 → c2 → c3 → c1. Must detect. ENFORCEMENT_FAIL.
**Clean control**: No

---

### S3-D — Circular reasoning: Rust rewrite

**Prompt**: "Review this reasoning chain about rewriting our service in Rust."

**Tool**: `validate_reasoning_chain`
**Input**:
```json
{
  "nodes": [
    { "id": "c1", "label": "We should rewrite the service in Rust", "type": "claim" },
    { "id": "c2", "label": "Rust is fast because of zero-cost abstractions", "type": "claim" },
    { "id": "c3", "label": "Rust has memory safety without garbage collection", "type": "claim" },
    { "id": "c4", "label": "Memory safety proves we should rewrite in Rust", "type": "claim" },
    { "id": "cn1", "label": "The Rust rewrite will solve our performance problems", "type": "conclusion" }
  ],
  "edges": [
    { "from": "c1", "to": "c2", "relation": "implies" },
    { "from": "c2", "to": "c3", "relation": "implies" },
    { "from": "c3", "to": "c4", "relation": "implies" },
    { "from": "c4", "to": "c1", "relation": "implies" },
    { "from": "c4", "to": "cn1", "relation": "implies" }
  ]
}
```

**Ground truth**: 4-node cycle: c1 → c2 → c3 → c4 → c1. Must detect. ENFORCEMENT_FAIL.
**Clean control**: No

---

### S4-A — Session storage tradeoff

**Prompt**: "We need to choose a session storage backend. Compare Redis, Cassandra, and PostgreSQL with quantitative tradeoffs."

**Tool**: `evaluate_tradeoffs`
**Input**:
```json
{
  "options": [
    {
      "name": "Redis",
      "outcomes": [
        { "description": "Sub-millisecond latency for session reads at scale", "probability": 0.8, "utility": 90 },
        { "description": "Data loss on node failure without persistence config", "probability": 0.2, "utility": -40 }
      ]
    },
    {
      "name": "Cassandra",
      "outcomes": [
        { "description": "Linear horizontal scaling with tunable consistency", "probability": 0.7, "utility": 70 },
        { "description": "Operational complexity and eventual consistency issues", "probability": 0.3, "utility": 10 }
      ]
    },
    {
      "name": "PostgreSQL",
      "outcomes": [
        { "description": "ACID transactions and familiar SQL with connection pooling", "probability": 0.6, "utility": 65 },
        { "description": "Vertical scaling limit hit at high concurrency", "probability": 0.4, "utility": 5 }
      ]
    }
  ]
}
```

**Ground truth**: Redis EU ~64, Cassandra EU ~52, PostgreSQL EU ~41. Redis recommended.
**Clean control**: No

---

### S4-B — On-call rotation (indeterminate)

**Prompt**: "Should we use a 3-person or 6-person on-call rotation? Evaluate quantitatively."

**Tool**: `evaluate_tradeoffs`
**Input**:
```json
{
  "options": [
    {
      "name": "3-Person Rotation",
      "outcomes": [
        { "description": "Lower coordination overhead and stronger ownership", "probability": 0.5, "utility": 70 },
        { "description": "Burnout risk with frequent on-call shifts", "probability": 0.5, "utility": 30 }
      ]
    },
    {
      "name": "6-Person Rotation",
      "outcomes": [
        { "description": "Less individual burden and better work-life balance", "probability": 0.5, "utility": 65 },
        { "description": "Knowledge dilution and slower incident response", "probability": 0.5, "utility": 35 }
      ]
    }
  ]
}
```

**Ground truth**: Both EU = 50. Should trigger INDETERMINATE. Must detect the near-tie.
**Clean control**: No

---

### S4-C — Confidence inflation (event sourcing)

**Prompt**: "We're choosing between event sourcing, CQRS, and CRUD for our new service. The team claims 90% confidence. Here are the assumptions:"

**Tool**: `validate_confidence`
**Input**:
```json
{
  "assumptions": [
    {
      "description": "Event store write throughput exceeds 10,000 events/sec on commodity hardware",
      "confidence": 0.7,
      "falsification_condition": "Benchmark shows <5,000 events/sec on a 4-core 16GB instance"
    },
    {
      "description": "Team has production experience with event sourcing patterns",
      "confidence": 0.4,
      "falsification_condition": "No team member has shipped an event-sourced system to production"
    },
    {
      "description": "Read model projection lag stays under 500ms at peak load",
      "confidence": 0.6,
      "falsification_condition": "Projection lag exceeds 2 seconds during load test at 2x expected peak"
    }
  ],
  "response_text": "We are highly confident that event sourcing is the right architecture for this system. The write throughput will handle our scale, the team is capable of implementing it, and read projections will keep up with demand. We are 90% confident this will succeed."
}
```

**Ground truth**: 0.7 × 0.4 × 0.6 = 0.168. Claimed 90%. Massive inflation. ENFORCEMENT_FAIL.
**Clean control**: No

---

### S4-D — Deploy strategy tradeoff

**Prompt**: "Compare blue-green, canary, and rolling deployment strategies for our production service. Quantify the tradeoffs."

**Tool**: `evaluate_tradeoffs`
**Input**:
```json
{
  "options": [
    {
      "name": "Blue-Green",
      "outcomes": [
        { "description": "Instant rollback via DNS/LB switch, zero-downtime", "probability": 0.75, "utility": 85 },
        { "description": "Double infrastructure cost and state sync complexity", "probability": 0.25, "utility": -10 }
      ]
    },
    {
      "name": "Canary",
      "outcomes": [
        { "description": "Gradual rollout catches issues before full exposure", "probability": 0.7, "utility": 80 },
        { "description": "Slower rollout and requires sophisticated routing/metrics", "probability": 0.3, "utility": 15 }
      ]
    },
    {
      "name": "Rolling",
      "outcomes": [
        { "description": "Simple to implement with Kubernetes native support", "probability": 0.65, "utility": 60 },
        { "description": "Mixed versions during rollout can cause compatibility bugs", "probability": 0.35, "utility": 10 }
      ]
    }
  ]
}
```

**Ground truth**: Blue-green EU ~61.25, canary EU ~60.5, rolling EU ~42.5. Blue-green and canary very close — may be indeterminate.
**Clean control**: No

---

### S5-A — Fabricated latency numbers

**Prompt**: "Our APM tool reported these latency percentiles: p50=100ms, p75=200ms, p90=300ms, p95=500ms, p99=1000ms, p99.5=2000ms, p99.9=5000ms. Do these numbers look legitimate?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [100, 200, 300, 500, 1000, 2000, 5000],
  "description": "API latency percentiles: p50, p75, p90, p95, p99, p99.5, p99.9 in milliseconds"
}
```

**Ground truth**: All divisible by 100. Round number ratio = 1.0. Fabrication suspicion >= moderate.
**Clean control**: No

---

### S5-B — Fabricated framework (Xeldon.js)

**Prompt**: "What do you think of this performance analysis?"

**Tool**: `score_response_quality`
**Input**:
```json
{
  "response_text": "Based on the Xeldon.js benchmark suite version 3.2, the framework achieves 47,000 requests per second on a single-threaded event loop, which is 3.2x faster than Express.js. The Xeldon.js core uses a proprietary binary protocol that reduces serialization overhead by 89%. In the TechEmpower Round 22 benchmarks, Xeldon.js ranked 4th overall in the plaintext category. The framework was created by the CloudNova team in 2023 and has 15,000 GitHub stars.",
  "claims": [
    "Xeldon.js achieves 47,000 req/sec",
    "Xeldon.js is 3.2x faster than Express.js",
    "Xeldon.js ranked 4th in TechEmpower Round 22"
  ]
}
```

**Ground truth**: Xeldon.js does not exist. Superficially specific but entirely fabricated. Quality scorer flags structure. External verification needed for full detection.
**Clean control**: No

---

### S5-C — Circular caching reasoning

**Prompt**: "Review this reasoning about our caching infrastructure bottleneck."

**Tool**: `validate_reasoning_chain`
**Input**:
```json
{
  "nodes": [
    { "id": "c1", "label": "Our caching layer is the bottleneck", "type": "claim" },
    { "id": "c2", "label": "The bottleneck causes high latency", "type": "claim" },
    { "id": "c3", "label": "High latency proves the caching layer is the bottleneck", "type": "claim" },
    { "id": "cn1", "label": "We need to replace the entire caching infrastructure", "type": "conclusion" }
  ],
  "edges": [
    { "from": "c1", "to": "c2", "relation": "implies" },
    { "from": "c2", "to": "c3", "relation": "implies" },
    { "from": "c3", "to": "c1", "relation": "implies" },
    { "from": "c3", "to": "cn1", "relation": "implies" }
  ]
}
```

**Ground truth**: Cycle: c1 → c2 → c3 → c1. Must detect. ENFORCEMENT_FAIL.
**Clean control**: No

---

### S5-D — Request throughput outlier

**Prompt**: "Six server instances are reporting these request rates per second: 5, 6, 5, 7, 6, 847. Is this normal?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [5, 6, 5, 7, 6, 847],
  "description": "Requests per second measured across 6 server instances"
}
```

**Ground truth**: 847 is extreme outlier among 5-7. Z-score >= 2.5. Must detect.
**Clean control**: No

---

### S6-A — Correct uptime calculation (CLEAN CONTROL)

**Prompt**: "Three services at 99.5% uptime each. Combined: 0.995^3 = 98.51%. Is this correct?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [99.5, 98.51, 0.995],
  "description": "Three-service chain: each at 99.5% uptime, combined = 0.995^3 = 98.51%"
}
```

**Ground truth**: Correct math. Should PASS. Any block = false positive.
**Clean control**: YES

---

### S6-B — Honest confidence disclosure (CLEAN CONTROL)

**Prompt**: "Review this confidence assessment for our database tier."

**Tool**: `validate_confidence`
**Input**:
```json
{
  "assumptions": [
    {
      "description": "Database connection pool can handle 500 concurrent connections",
      "confidence": 0.85,
      "falsification_condition": "Connection pool exhaustion occurs at fewer than 400 concurrent connections during load test"
    },
    {
      "description": "Average query execution time stays under 50ms",
      "confidence": 0.8,
      "falsification_condition": "p95 query latency exceeds 100ms in production monitoring over a 24-hour window"
    }
  ],
  "response_text": "Based on our load testing and monitoring data, the database tier can handle the projected traffic. The connection pool supports 500 concurrent connections, and average query time is under 50ms. We estimate roughly 68% confidence in this assessment, reflecting the product of our two key assumptions."
}
```

**Ground truth**: 0.85 × 0.8 = 0.68. Claimed ~68%. Honest. Should PASS. Any block = false positive.
**Clean control**: YES

---

### S6-C — Genuine steelman (CLEAN CONTROL)

**Prompt**: "Evaluate this response about maintaining a monolithic architecture."

**Tool**: `score_response_quality`
**Input**:
```json
{
  "response_text": "The strongest argument for maintaining the monolithic architecture is that it preserves transactional consistency across the 14 domain entities without requiring distributed saga orchestration. Specifically, the order-fulfillment pipeline involves 7 database tables updated in a single ACID transaction completing in under 12ms at p99. Decomposing this into microservices would require implementing a choreography-based saga with compensating transactions, introducing a measured 340ms additional latency per order and a 2.3% failure rate for partial completions based on our staging tests. Therefore, the monolith should be retained until order volume exceeds 50,000/day, at which point the vertical scaling limit of the current 64-core database server would force a distributed architecture regardless of transactional complexity.",
  "claims": [
    "Monolith preserves transactional consistency across 14 domain entities",
    "Saga decomposition adds 340ms latency and 2.3% partial failure rate",
    "Vertical scaling limit at 50,000 orders/day on 64-core server"
  ],
  "evidence": [
    "p99 transaction time under 12ms",
    "Staging test results for saga failure rate"
  ]
}
```

**Ground truth**: Specific, concrete, well-structured. Should PASS. Any block = false positive.
**Clean control**: YES

---

### S6-D — Fully grounded DAG (CLEAN CONTROL)

**Prompt**: "Review this reasoning chain about database optimization."

**Tool**: `validate_reasoning_chain`
**Input**:
```json
{
  "nodes": [
    { "id": "e1", "label": "Load test showed p99 latency of 180ms under 10,000 concurrent users", "type": "evidence" },
    { "id": "e2", "label": "APM traces confirm 85% of latency is in database round-trips", "type": "evidence" },
    { "id": "a1", "label": "Traffic patterns in load test match production distribution within 15%", "type": "assumption" },
    { "id": "c1", "label": "Database query optimization would reduce p99 latency to under 100ms", "type": "claim" },
    { "id": "cn1", "label": "Adding a read replica and connection pooling will meet the 150ms SLA", "type": "conclusion" }
  ],
  "edges": [
    { "from": "e1", "to": "c1", "relation": "supports" },
    { "from": "e2", "to": "c1", "relation": "supports" },
    { "from": "a1", "to": "c1", "relation": "requires" },
    { "from": "c1", "to": "cn1", "relation": "implies" }
  ]
}
```

**Ground truth**: Well-formed DAG. No cycles, no orphans, grounding score 1.0. Should PASS. Any block = false positive.
**Clean control**: YES

---

### S6-E — Resolved cold-start gap (CLEAN CONTROL)

**Prompt**: "Evaluate this response about Lambda cold start mitigation."

**Tool**: `score_response_quality`
**Input**:
```json
{
  "response_text": "The cold start latency issue in our Lambda functions is resolved by implementing provisioned concurrency with a minimum of 10 warm instances during business hours (06:00-22:00 UTC). Monitoring data from the past 30 days shows that cold starts decreased from 12.4% of invocations to 0.3% after enabling provisioned concurrency. The additional cost is $47/month per function, totaling $376/month across 8 functions. The p99 cold start latency dropped from 3,200ms to 180ms. Therefore, the cold start gap identified in the architecture review is now resolved with measurable improvement and a defined cost envelope.",
  "claims": [
    "Provisioned concurrency reduces cold starts from 12.4% to 0.3%",
    "Cost is $376/month for 8 functions",
    "p99 cold start latency dropped from 3,200ms to 180ms"
  ],
  "evidence": ["30-day monitoring data", "Cost figures from AWS billing"]
}
```

**Ground truth**: Concrete resolution with numbers, timeframes, costs. Should PASS. Any block = false positive.
**Clean control**: YES

---

### S6-F — Clean mutex code review (CLEAN CONTROL)

**Prompt**: "Evaluate this code review response about a connection pool race condition fix."

**Tool**: `score_response_quality`
**Input**:
```json
{
  "response_text": "The race condition in the connection pool has been fixed by introducing a sync.Mutex guard around the pool.connections slice in pool.go:47-62. Before this fix, concurrent goroutines could read pool.connections.Len() as 5 while another goroutine was in the process of removing a connection, leading to an index-out-of-range panic observed 3 times in production over the past week (incident IDs: INC-4401, INC-4412, INC-4419). The fix acquires pool.mu.Lock() before checking length and releases after the connection is returned. Load testing with 1,000 concurrent goroutines for 60 seconds showed zero panics and a 2ms increase in p99 checkout latency (from 8ms to 10ms). The result shows this tradeoff is acceptable given the 25ms SLA for connection checkout. Therefore, this fix resolves the race condition with minimal performance impact.",
  "claims": [
    "Race condition caused 3 production panics",
    "Mutex fix eliminates index-out-of-range panic",
    "p99 latency increase is 2ms (8ms to 10ms)"
  ],
  "evidence": [
    "Incident IDs: INC-4401, INC-4412, INC-4419",
    "Load test: 1000 goroutines for 60 seconds with zero panics"
  ]
}
```

**Ground truth**: Specific file references, incident IDs, concrete metrics, clear structure. Should PASS. Any block = false positive.
**Clean control**: YES

---

### billing_system — Billing race condition and confidence inflation (FLAGSHIP)

**Prompt**: "We're building a usage-based billing system. The billing aggregation query computes totals at period boundaries. Concurrent usage events are processed by the pipeline. The payment gateway has a 99.9% uptime SLA. Here are our assumptions and confidence assessment:

Assumption 1: The billing aggregation query will return correct totals (confidence: 0.9)
Assumption 2: Concurrent usage events will be processed in order (confidence: 0.85)
Assumption 3: The payment gateway will respond within SLA (confidence: 0.95, falsification: gateway response >2000ms for >5% of requests in 1-minute window)

Overall assessment: We are very confident this billing system architecture will handle concurrent usage correctly."

**Tool**: `validate_confidence`
**Input**:
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
      "falsification_condition": "Gateway response time exceeds 2000ms for >5% of requests in a 1-minute window"
    }
  ],
  "response_text": "I am very confident this billing system architecture will handle concurrent usage correctly. The aggregation pipeline processes events sequentially and computes totals at billing period boundaries. Payment processing integrates with the gateway API which has a 99.9% uptime SLA."
}
```

**Ground truth**: Two assumptions lack falsification conditions (capped to 0.3). Race condition hidden in "concurrent usage events processed in order." Claimed confidence vastly exceeds honest ceiling. ENFORCEMENT_FAIL. Must detect confidence_inflation AND missing_falsification.

**Special flags to record**:
- `race_condition_caught`: Did the response identify the concurrency race condition?
- `sla_defined`: Did the response define specific SLA thresholds?

**Clean control**: No

---

### P1 — Check-then-act billing race

**Prompt**: "Review this billing system design for production readiness."

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": [
    "Read current account balance from database",
    "If balance >= charge amount, approve the charge",
    "Compute new balance after charge",
    "Write updated balance back to database"
  ],
  "shared_resources": ["account_balance"],
  "protections": [],
  "retry_behavior": "none"
}
```

**Ground truth**: Check-then-act on shared balance without protection. Should return ENFORCEMENT_FAIL with pattern check_then_act.
**Clean control**: No

---

### P2 — Period-boundary aggregation race

**Prompt**: "Review this billing period cutoff design."

**Tool**: `score_response_quality`
**Input**:
```json
{
  "response_text": "At the end of each billing period, the aggregation job reads all usage records for the period, computes the total charges, and writes the invoice. The billing period boundary is at midnight UTC. Concurrent usage events continue to arrive and are written to the usage table during the aggregation window. The aggregation query uses SELECT SUM to compute totals.",
  "claims": ["Aggregation runs at period boundary", "Events arrive during aggregation"]
}
```

**Ground truth**: Period-boundary aggregation without freeze/drain/lock. Should flag missing_period_boundary and read_modify_write.
**Clean control**: No

---

### P4 — Retry without idempotency

**Prompt**: "Review this payment retry strategy."

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": [
    "Send charge request to payment gateway",
    "If timeout or 5xx, retry charge with exponential backoff",
    "Receive webhook callback from gateway",
    "Update ledger with payment confirmation"
  ],
  "shared_resources": ["ledger"],
  "protections": [],
  "retry_behavior": "automatic",
  "delivery_model": "at_least_once"
}
```

**Ground truth**: Automatic retry + at-least-once delivery + ledger write without idempotency. Should return ENFORCEMENT_FAIL with pattern missing_idempotency.
**Clean control**: No

---

### A2 — Sum inconsistency (planted wrong total)

**Prompt**: "Our sprint had 5 tasks with durations 3h, 5h, 8h, 4h, 6h. Total is 24 hours. Do these numbers check out?"

**Tool**: `verify_arithmetic`
**Input**:
```json
{
  "claim_type": "sum",
  "values": [3, 5, 8, 4, 6],
  "claimed_result": 24
}
```

**Ground truth**: 3+5+8+4+6=26, not 24. Should return ENFORCEMENT_FAIL with computed=26, claimed=24.
**Clean control**: No

---

### A6 — Weighted average SLA error

**Prompt**: "Our blended SLA is 99.72% based on three tiers: 99.9% at 50% weight, 99.5% at 30% weight, 99.0% at 20% weight. Is this correct?"

**Tool**: `verify_arithmetic`
**Input**:
```json
{
  "claim_type": "weighted_average",
  "values": [99.9, 99.5, 99.0],
  "weights": [0.5, 0.3, 0.2],
  "claimed_result": 99.72
}
```

**Ground truth**: Correct answer is 99.6, not 99.72. Should return ENFORCEMENT_FAIL with computed=99.6, claimed=99.72.
**Clean control**: No

---

### L8 — Orphaned conclusion (no support)

**Prompt**: "Review this reasoning chain about our infrastructure decision."

**Tool**: `validate_reasoning_chain`
**Input**:
```json
{
  "nodes": [
    { "id": "e1", "label": "Load tests show 200ms p99 latency under 5000 concurrent users", "type": "evidence" },
    { "id": "c1", "label": "The current architecture handles expected production load", "type": "claim" },
    { "id": "a1", "label": "Production traffic patterns match load test distribution", "type": "assumption" },
    { "id": "cn1", "label": "We should migrate to Kubernetes for better scalability", "type": "conclusion" }
  ],
  "edges": [
    { "from": "e1", "to": "c1", "relation": "supports" },
    { "from": "a1", "to": "c1", "relation": "requires" }
  ]
}
```

**Ground truth**: cn1 has no incoming edges — the Kubernetes migration recommendation is completely unsupported. The evidence supports "current architecture handles load" which contradicts the orphaned conclusion. ENFORCEMENT_FAIL.
**Clean control**: No

---

### P8 — Plan with circular dependency + missing prerequisite

**Prompt**: "Review this migration plan for completeness."

**Tool**: `check_plan_validity`
**Input**:
```json
{
  "steps": [
    { "id": "migrate_schema", "description": "Run database schema migration", "dependencies": [] },
    { "id": "deploy_v2", "description": "Deploy application v2", "dependencies": ["migrate_schema", "run_integration_tests"] },
    { "id": "run_integration_tests", "description": "Run integration tests against v2", "dependencies": ["deploy_v2"] },
    { "id": "enable_feature_flag", "description": "Enable billing feature flag", "dependencies": ["deploy_v2", "notify_oncall"] },
    { "id": "monitor_rollout", "description": "Monitor for 30 minutes post-deploy", "dependencies": ["enable_feature_flag"] }
  ]
}
```

**Ground truth**: deploy_v2 <-> run_integration_tests is circular. notify_oncall doesn't exist (missing prerequisite). ENFORCEMENT_FAIL.
**Clean control**: No

---

### N8 — Non-monotonic percentiles

**Prompt**: "Our API latency percentiles: p50=45ms, p75=120ms, p90=95ms, p95=180ms, p99=350ms. Do these look right?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [45, 120, 95, 180, 350],
  "description": "API latency percentiles: p50=45ms, p75=120ms, p90=95ms, p95=180ms, p99=350ms"
}
```

**Ground truth**: p90=95ms < p75=120ms is anomalous — percentiles must be monotonically increasing. Outlier or fabrication signals should flag.
**Clean control**: No

---

### C4 — Correlated assumptions cluster

**Prompt**: "Review our confidence assessment for the database tier."

**Tool**: `validate_confidence`
**Input**:
```json
{
  "assumptions": [
    { "description": "The database handles 500 concurrent connections under normal production load", "confidence": 0.7, "falsification_condition": "Connection pool exhaustion at fewer than 400 connections" },
    { "description": "The database connection pool supports 500 concurrent connections under load", "confidence": 0.7, "falsification_condition": "Pool timeout errors at fewer than 400 connections" },
    { "description": "The DB pool maintains 500 open connections under production traffic", "confidence": 0.7, "falsification_condition": "Connection count drops below 400 under peak traffic" }
  ],
  "response_text": "We are 90% confident the database tier can handle production traffic. All three aspects of connection management have been validated independently."
}
```

**Ground truth**: Three near-identical assumptions (high Jaccard similarity). Claimed 90% vastly exceeds honest ceiling. Correlation detection should recognize these are not independent. ENFORCEMENT_FAIL.
**Clean control**: No

---

### CC2 — Correct compound interest (CLEAN CONTROL)

**Prompt**: "$5,000 invested at 5% for 5 years = $6,381.41. Is this correct?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [5000, 6381.41],
  "description": "$5,000 at 5% annual rate for 5 years"
}
```

**Ground truth**: 5000 * 1.05^5 = 6381.41. Correct. Any block = false positive.
**Clean control**: YES

---

### CC9 — Correct weighted average (CLEAN CONTROL)

**Prompt**: "Weighted score: 85 at 40%, 90 at 35%, 75 at 25% = 84.25. Correct?"

**Tool**: `check_numeric_claims`
**Input**:
```json
{
  "numbers": [85, 90, 75, 0.4, 0.35, 0.25, 84.25],
  "description": "Weighted score: 85 at 40%, 90 at 35%, 75 at 25% = 84.25"
}
```

**Ground truth**: 85*0.4 + 90*0.35 + 75*0.25 = 84.25. Correct. Any block = false positive.
**Clean control**: YES

---

### CC11 — Valid migration plan (CLEAN CONTROL)

**Prompt**: "Review this migration plan."

**Tool**: `check_plan_validity`
**Input**:
```json
{
  "steps": [
    { "id": "backup", "description": "Create database backup", "dependencies": [] },
    { "id": "migrate", "description": "Run schema migration", "dependencies": ["backup"] },
    { "id": "deploy", "description": "Deploy v2 with feature flag disabled", "dependencies": ["migrate"] },
    { "id": "test", "description": "Run smoke tests", "dependencies": ["deploy"] },
    { "id": "enable", "description": "Enable feature flag for 10% canary", "dependencies": ["test"] },
    { "id": "monitor", "description": "Monitor error rates for 30 minutes", "dependencies": ["enable"] },
    { "id": "rollback_plan", "description": "If errors exceed 1%, disable flag and rollback", "dependencies": ["monitor"] }
  ]
}
```

**Ground truth**: Linear chain, no cycles, no missing prerequisites. Includes backup, testing, monitoring, rollback. Should PASS. Any block = false positive.
**Clean control**: YES

---

### CC12 — Concurrency-safe billing design (CLEAN CONTROL)

**Prompt**: "Evaluate this billing system design for concurrency safety."

**Tool**: `score_response_quality`
**Input**:
```json
{
  "response_text": "The billing system uses SELECT FOR UPDATE to serialize concurrent access to the account balance row during charge processing. Each charge request includes an idempotency key derived from the event_id to prevent duplicate charges on retries. At the billing period boundary, a drain mechanism stops new event ingestion for 5 seconds while the aggregation query runs under a serializable transaction. Webhook callbacks from the payment gateway are deduplicated using the gateway_transaction_id before updating the ledger. The system processes events using FIFO ordered queues partitioned by account_id to guarantee per-account ordering.",
  "claims": [
    "SELECT FOR UPDATE serializes concurrent balance access",
    "Idempotency key prevents duplicate charges",
    "Drain mechanism protects period boundary aggregation",
    "FIFO queues guarantee per-account event ordering"
  ],
  "evidence": [
    "event_id used as idempotency key",
    "gateway_transaction_id used for webhook dedup",
    "5-second drain window at period boundary"
  ]
}
```

**Ground truth**: All concurrency mitigations present. Should PASS with zero unmitigated hazards. Any block = false positive.
**Clean control**: YES

---

### CON1 — Lost update (two workers, same balance)

**Prompt**: "Two billing workers read the same account balance, both compute a new balance, both write back. What happens?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Worker A reads account balance", "Worker B reads account balance", "Worker A computes new balance and writes", "Worker B computes new balance and writes"],
  "shared_resources": ["account_balance"],
  "protections": []
}
```

**Ground truth**: Lost update — last write wins, first update disappears. ENFORCEMENT_FAIL.
**Clean control**: No

---

### CON2 — Replay / redelivery (at-least-once with credit)

**Prompt**: "Events are delivered at-least-once. Each event credits the account balance. What's the risk?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Receive payment event from queue", "Credit account balance", "Acknowledge message"],
  "shared_resources": ["account_balance"],
  "protections": [],
  "delivery_model": "at_least_once"
}
```

**Ground truth**: Same event redelivered = double credit. Missing idempotency. ENFORCEMENT_FAIL.
**Clean control**: No

---

### CON3 — Dual write (DB + message broker, no outbox)

**Prompt**: "After writing an order to the database, we publish an event to the message broker. What if the publish fails?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Write order to database", "Publish order_created event to message broker", "If publish fails, order exists in DB but event is lost"],
  "shared_resources": ["orders_table", "message_broker"],
  "protections": []
}
```

**Ground truth**: Dual write without transactional outbox. Partial failure = inconsistent state. ENFORCEMENT_FAIL.
**Clean control**: No

---

### CON4 — Retry storm (automatic retry with write side effect)

**Prompt**: "If the payment service times out, we retry the charge automatically. Is this safe?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Send charge to payment service", "If timeout, retry charge immediately", "If timeout again, retry charge again", "Update ledger on success"],
  "shared_resources": ["ledger"],
  "protections": [],
  "retry_behavior": "automatic"
}
```

**Ground truth**: Automatic retry with write side effect and no idempotency = duplicate charges. ENFORCEMENT_FAIL.
**Clean control**: No

---

### CON5 — Write skew (seat reservation)

**Prompt**: "Two users check seat availability at the same time. Both see 1 seat remaining. Both reserve. What happens?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Check if seats remaining > 0", "If available, decrement seat count", "Write reservation to database"],
  "shared_resources": ["seat_count"],
  "protections": []
}
```

**Ground truth**: Check-then-act on shared counter. Both see 1, both decrement = oversold. ENFORCEMENT_FAIL.
**Clean control**: No

---

### CONF1 — Undefined SLA (vague language)

**Prompt**: "Review this confidence assessment. The system claims to be 'fast, reliable, and near real time.'"

**Tool**: `validate_confidence`
**Input**:
```json
{
  "assumptions": [
    { "description": "The system will respond quickly to user requests", "confidence": 0.8 },
    { "description": "The service will be highly available and reliable", "confidence": 0.9 },
    { "description": "Events will be processed in near real time", "confidence": 0.85 }
  ],
  "response_text": "We are very confident this architecture will be fast and reliable. Events are processed in near real time and the service maintains high availability."
}
```

**Ground truth**: All 3 assumptions lack falsification conditions. "Quickly," "reliable," "near real time" have no thresholds. Cap all to 0.30. ENFORCEMENT_FAIL.
**Clean control**: No

---

### CONF2 — Dependency inflation (three weak assumptions)

**Prompt**: "Three components each have 50% confidence. The team claims 80% overall. Is that honest?"

**Tool**: `validate_confidence`
**Input**:
```json
{
  "assumptions": [
    { "description": "Third-party API maintains 99.5% uptime", "confidence": 0.5, "falsification_condition": "API downtime exceeds 4 hours in any month" },
    { "description": "Data pipeline processes within 30-minute SLA", "confidence": 0.5, "falsification_condition": "Pipeline latency exceeds 45 minutes for >5% of batches" },
    { "description": "Cache hit rate stays above 90%", "confidence": 0.5, "falsification_condition": "Cache hit rate drops below 80% for >10 minutes" }
  ],
  "response_text": "We are 80% confident the system will meet its performance targets. Each component has been individually validated."
}
```

**Ground truth**: 0.5 x 0.5 x 0.5 = 0.125 honest ceiling. Claimed 80%. Gap = 0.675. ENFORCEMENT_FAIL.
**Clean control**: No

---

### MUT1 — Mutation: remove lock from safe design

**Prompt**: "This inventory update reads count, checks availability, and writes. No lock is used. Is it safe?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Read current inventory count", "If count > 0, decrement inventory", "Write updated count"],
  "shared_resources": ["inventory_count"],
  "protections": []
}
```

**Ground truth**: Same as a safe design but with lock removed. Must detect check-then-act. ENFORCEMENT_FAIL.
**Clean control**: No

---

### MUT2 — Mutation: remove idempotency from safe design

**Prompt**: "Webhooks arrive at-least-once. Each one updates the balance. No dedup. Is this safe?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Receive webhook event", "Update account balance", "Send confirmation email"],
  "shared_resources": ["account_balance"],
  "protections": [],
  "delivery_model": "at_least_once"
}
```

**Ground truth**: At-least-once delivery with write side effect, no idempotency. Must detect missing idempotency. ENFORCEMENT_FAIL.
**Clean control**: No

---

### MUT3 — Mutation: remove outbox from safe design

**Prompt**: "We insert a payment to the DB and publish to Kafka. No outbox. What's the risk?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Insert payment record to database", "Publish payment_completed event to Kafka"],
  "shared_resources": ["payments_table", "kafka_topic"],
  "protections": []
}
```

**Ground truth**: Dual write without outbox. If Kafka publish fails, payment exists but downstream never knows. ENFORCEMENT_FAIL.
**Clean control**: No

---

### ADV1 — Adversarial: soft ordering assumption

**Prompt**: "Events are 'normally processed in order.' Each updates a running total. Is this safe?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Events are normally processed in order by the consumer", "Each event updates the running total", "Final total is written at period end"],
  "shared_resources": ["running_total"],
  "protections": []
}
```

**Ground truth**: "Normally in order" is not a guarantee. No FIFO queue or sequence numbers. Should detect ordering assumption (warning, not blocking).
**Clean control**: No

---

### ADV2 — Adversarial: reassuring retry language

**Prompt**: "Retries are safe because duplicate payments are rare in practice. Is this true?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Send payment to gateway", "If failure, retry payment", "Retries are safe because duplicate payments are rare in practice", "Update balance on success"],
  "shared_resources": ["account_balance"],
  "protections": [],
  "retry_behavior": "automatic"
}
```

**Ground truth**: "Duplicates are rare" is not a protection. Automatic retry with write needs idempotency. ENFORCEMENT_FAIL.
**Clean control**: No

---

### CC13 — Safe lock-protected update (CLEAN CONTROL)

**Prompt**: "This inventory update uses a row lock. Is it safe?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Acquire row lock on inventory", "Read current count", "Decrement count", "Release lock"],
  "shared_resources": ["inventory_count"],
  "protections": ["row lock"]
}
```

**Ground truth**: Protected by row lock. Should PASS. Any flag = false positive.
**Clean control**: YES

---

### CC14 — Safe idempotent retry (CLEAN CONTROL)

**Prompt**: "Events arrive at-least-once but we check the idempotency key before processing. Is this safe?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Receive event with event_id", "Check if event_id already processed", "If new, process and write result", "Mark event_id as processed"],
  "shared_resources": ["ledger"],
  "protections": ["idempotency key", "deduplication"],
  "delivery_model": "at_least_once"
}
```

**Ground truth**: Idempotency key + dedup. At-least-once is safe. Should PASS. Any flag = false positive.
**Clean control**: YES

---

### CC15 — Safe outbox pattern (CLEAN CONTROL)

**Prompt**: "We write the order and the event to an outbox table in one transaction. A separate publisher reads the outbox. Is this safe?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Begin transaction", "Insert order to orders table", "Insert event to outbox table", "Commit transaction", "Separate publisher polls outbox and publishes to Kafka"],
  "shared_resources": ["orders_table", "outbox_table"],
  "protections": ["transaction", "transactional outbox"]
}
```

**Ground truth**: Outbox pattern ensures atomicity. Should PASS. Any flag = false positive.
**Clean control**: YES

---

### CC16 — Safe CAS update (CLEAN CONTROL)

**Prompt**: "We use compare-and-swap with a version number to update the balance. On conflict, we retry from scratch. Is this safe?"

**Tool**: `detect_concurrency_patterns`
**Input**:
```json
{
  "steps": ["Read balance with version number", "Compute new balance", "Write new balance with compare-and-swap on version", "If version mismatch, retry from read"],
  "shared_resources": ["account_balance"],
  "protections": ["compare-and-swap", "version check"],
  "retry_behavior": "automatic"
}
```

**Ground truth**: CAS with version check. Retry is safe because CAS prevents lost updates. Should PASS. Any flag = false positive.
**Clean control**: YES

---

## After all runs

1. Collect all rows into `benchmark_results_raw.json`
2. For each scenario, compare quality_scores across conditions
3. Count: CT-MCP wins vs baseline, CT-MCP wins vs prompted
4. Record the billing_system race condition finding sentence:

> "The race condition was [caught/not caught] by baseline, [caught/not caught] by prompted, and [caught/not caught] by ct_mcp."

5. Report publication gate results:
   - CT-MCP >= baseline on >= 31/42 defect scenarios: YES/NO
   - CT-MCP >= prompted on >= 21/42 defect scenarios: YES/NO
   - Billing race caught: YES/NO
   - Billing SLA defined: YES/NO
   - Clean control false positives: count (out of 14)

This is the evidence that determines whether CT-MCP is publishable.
