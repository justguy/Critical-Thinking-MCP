/**
 * Benchmark scenarios for ct-mcp.
 *
 * 20 defect scenarios (expected to trigger enforcement failures or warnings)
 * + 6 clean controls (expected to PASS without issues).
 *
 * Each scenario specifies the tool to call, realistic input data, and
 * ground-truth expectations for evaluating tool effectiveness.
 */

export interface BenchmarkScenario {
  id: string;
  category: string;
  description: string;
  input: Record<string, unknown>;
  tool: string;
  ground_truth: Record<string, unknown>;
  is_clean_control: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// Category 1: Numerical Analysis (S1-A through S1-D)
// ════════════════════════════════════════════════════════════════════════════

const S1_A: BenchmarkScenario = {
  id: 'S1-A',
  category: 'Numerical Analysis',
  description: 'Basic descriptive statistics on a small integer dataset',
  tool: 'check_numeric_claims',
  input: {
    numbers: [14, 18, 11, 13, 6, 8, 2, 16, 14, 2],
    context: 'Task completion times in minutes for 10 sample runs',
  },
  ground_truth: {
    mean: 10.4,
    std_approx: 5.31,
    fabrication_suspicion: 'low',
    outlier_count: 0,
  },
  is_clean_control: false,
};

const S1_B: BenchmarkScenario = {
  id: 'S1-B',
  category: 'Numerical Analysis',
  description: 'Task durations with potential geometric spacing pattern',
  tool: 'check_numeric_claims',
  input: {
    numbers: [2, 4, 8, 1, 16, 2, 4],
    context: 'Sprint task durations in days across 7 work items',
  },
  ground_truth: {
    fabrication_suspicion_gte: 'moderate',
    note: 'Powers-of-two pattern should raise suspicion via round-number and spacing signals',
  },
  is_clean_control: false,
};

const S1_C: BenchmarkScenario = {
  id: 'S1-C',
  category: 'Numerical Analysis',
  description: 'Quarterly sales with planted outlier Q4=$47M (Z-score ~3.8)',
  tool: 'check_numeric_claims',
  input: {
    numbers: [1200000, 1400000, 890000, 47000000],
    context: 'Quarterly revenue: Q1=$1.2M, Q2=$1.4M, Q3=$890K, Q4=$47M',
  },
  ground_truth: {
    outlier_count_gte: 1,
    outlier_value: 47000000,
    outlier_z_score_approx: 3.8,
  },
  is_clean_control: false,
};

const S1_D: BenchmarkScenario = {
  id: 'S1-D',
  category: 'Numerical Analysis',
  description: 'Compound interest: $10,000 at 5% for 7 years = $14,071',
  tool: 'check_numeric_claims',
  input: {
    numbers: [10000, 14071],
    context: 'Principal and future value of $10,000 at 5% annual rate over 7 years',
  },
  ground_truth: {
    future_value: 14071,
    fabrication_suspicion: 'low',
    note: 'Two values only; should pass without fabrication flag',
  },
  is_clean_control: false,
};

// ════════════════════════════════════════════════════════════════════════════
// Category 2: Reasoning Quality (S2-A through S2-D)
// ════════════════════════════════════════════════════════════════════════════

const S2_A: BenchmarkScenario = {
  id: 'S2-A',
  category: 'Reasoning Quality',
  description: 'Detect "it depends" without conditions — hedgy non-answer for microservices vs monolith',
  tool: 'score_response_quality',
  input: {
    response_text:
      'It really depends on the situation. There are many factors to consider. ' +
      'Microservices might be better in some cases, but monoliths could also work. ' +
      'It is hard to say definitively. You should probably evaluate your specific needs. ' +
      'Both approaches have their pros and cons. It depends on team size, maybe, ' +
      'and it could depend on deployment complexity. Perhaps microservices would be better ' +
      'for larger teams, but possibly not. It is difficult to provide a clear answer.',
  },
  ground_truth: {
    hedge_density_gte: 0.3,
    specificity_score_lte: 0.3,
    overall_score_lte: 0.5,
    note: 'Should detect heavy hedging and low specificity',
  },
  is_clean_control: false,
};

const S2_B: BenchmarkScenario = {
  id: 'S2-B',
  category: 'Reasoning Quality',
  description: 'Force explicit tradeoff: PostgreSQL vs MongoDB for social network',
  tool: 'evaluate_tradeoffs',
  input: {
    options: [
      {
        name: 'PostgreSQL',
        outcomes: [
          { description: 'Handles complex queries and joins for social graph', probability: 0.7, utility: 80 },
          { description: 'Struggles at >10M users with write-heavy social feed', probability: 0.3, utility: 20 },
        ],
      },
      {
        name: 'MongoDB',
        outcomes: [
          { description: 'Scales horizontally for feed writes and denormalized reads', probability: 0.6, utility: 75 },
          { description: 'Complex social graph queries require workarounds', probability: 0.4, utility: 30 },
        ],
      },
    ],
  },
  ground_truth: {
    should_compute_EU: true,
    postgres_eu_approx: 62,
    mongo_eu_approx: 57,
    recommended: 'PostgreSQL',
  },
  is_clean_control: false,
};

const S2_C: BenchmarkScenario = {
  id: 'S2-C',
  category: 'Reasoning Quality',
  description: 'Surface blindspot in vague "build vs buy auth" response',
  tool: 'score_response_quality',
  input: {
    response_text:
      'For enterprise authentication, you could build your own solution or buy one. ' +
      'Building gives you more control, while buying saves time. ' +
      'There are various options available on the market. ' +
      'Some teams prefer building because it is customizable. ' +
      'Other teams prefer buying because it is faster to deploy. ' +
      'The decision should be based on your requirements.',
  },
  ground_truth: {
    specificity_score_lte: 0.3,
    note: 'No concrete details: no vendor names, no compliance frameworks, no cost figures, no timeline estimates',
  },
  is_clean_control: false,
};

const S2_D: BenchmarkScenario = {
  id: 'S2-D',
  category: 'Reasoning Quality',
  description: 'Friday deploy risk — steelman must engage with actual mechanisms',
  tool: 'score_response_quality',
  input: {
    response_text:
      'Deploying on Fridays is generally considered risky. ' +
      'If something goes wrong, the team might not be available to fix it over the weekend. ' +
      'However, some teams do deploy on Fridays successfully. ' +
      'It probably depends on your monitoring setup and on-call rotation. ' +
      'You might want to consider your rollback strategy. ' +
      'Perhaps having good CI/CD could mitigate some of the risk. ' +
      'It is worth thinking about carefully.',
    claims: [
      'Friday deploys are risky',
      'Monitoring and on-call mitigate risk',
    ],
  },
  ground_truth: {
    hedge_density_gte: 0.2,
    note: 'Hedging with "might", "probably", "perhaps" without concrete thresholds or SLAs',
  },
  is_clean_control: false,
};

// ════════════════════════════════════════════════════════════════════════════
// Category 3: Multi-Step Logic (S3-A through S3-D)
// ════════════════════════════════════════════════════════════════════════════

const S3_A: BenchmarkScenario = {
  id: 'S3-A',
  category: 'Multi-Step Logic',
  description: 'Service chain uptime: three services at 99% each => 0.99^3 = 97.03%',
  tool: 'validate_reasoning_chain',
  input: {
    nodes: [
      { id: 'e1', label: 'Service A has 99% measured uptime over 90 days', type: 'evidence' },
      { id: 'e2', label: 'Service B has 99% measured uptime over 90 days', type: 'evidence' },
      { id: 'e3', label: 'Service C has 99% measured uptime over 90 days', type: 'evidence' },
      { id: 'a1', label: 'Services fail independently with no correlated outages', type: 'assumption' },
      { id: 'c1', label: 'Combined chain uptime is 99% times 99% times 99% = 97.03%', type: 'claim' },
      { id: 'cn1', label: 'The end-to-end SLA of 99.5% cannot be met with the current architecture', type: 'conclusion' },
    ],
    edges: [
      { from: 'e1', to: 'c1', relation: 'supports' },
      { from: 'e2', to: 'c1', relation: 'supports' },
      { from: 'e3', to: 'c1', relation: 'supports' },
      { from: 'a1', to: 'c1', relation: 'requires' },
      { from: 'c1', to: 'cn1', relation: 'implies' },
    ],
  },
  ground_truth: {
    cycles: 0,
    orphaned_conclusions: 0,
    grounding_score: 1.0,
    status: 'PASS',
    note: 'Well-formed chain: evidence -> claim -> conclusion with explicit assumption',
  },
  is_clean_control: false,
};

const S3_B: BenchmarkScenario = {
  id: 'S3-B',
  category: 'Multi-Step Logic',
  description: 'Sprint velocity: 4 engineers + 2 new hires at 50% => effective capacity = 5 FTE',
  tool: 'check_numeric_claims',
  input: {
    numbers: [4, 2, 0.5, 5, 40],
    context: '4 existing engineers + 2 new hires at 50% productivity = 5 FTE. Sprint velocity claimed as 40 story points.',
  },
  ground_truth: {
    effective_fte: 5,
    fabrication_suspicion: 'low',
    note: 'Checks that numbers are internally consistent; 4 + 2*0.5 = 5 FTE',
  },
  is_clean_control: false,
};

const S3_C: BenchmarkScenario = {
  id: 'S3-C',
  category: 'Multi-Step Logic',
  description: 'Circular reasoning: need more servers because queries slow because need more servers',
  tool: 'validate_reasoning_chain',
  input: {
    nodes: [
      { id: 'c1', label: 'We need more servers to handle the load', type: 'claim' },
      { id: 'c2', label: 'Database queries are running slowly under current load', type: 'claim' },
      { id: 'c3', label: 'Slow queries prove we need more servers', type: 'claim' },
      { id: 'cn1', label: 'Therefore we must provision 10 additional servers immediately', type: 'conclusion' },
    ],
    edges: [
      { from: 'c1', to: 'c2', relation: 'implies' },
      { from: 'c2', to: 'c3', relation: 'implies' },
      { from: 'c3', to: 'c1', relation: 'implies' },
      { from: 'c3', to: 'cn1', relation: 'implies' },
    ],
  },
  ground_truth: {
    cycles_gte: 1,
    cycle_contains: ['c1', 'c2', 'c3'],
    status: 'ENFORCEMENT_FAIL',
  },
  is_clean_control: false,
};

const S3_D: BenchmarkScenario = {
  id: 'S3-D',
  category: 'Multi-Step Logic',
  description: 'Circular reasoning: rewrite in Rust because fast because memory safety because rewrite',
  tool: 'validate_reasoning_chain',
  input: {
    nodes: [
      { id: 'c1', label: 'We should rewrite the service in Rust', type: 'claim' },
      { id: 'c2', label: 'Rust is fast because of zero-cost abstractions', type: 'claim' },
      { id: 'c3', label: 'Rust has memory safety without garbage collection', type: 'claim' },
      { id: 'c4', label: 'Memory safety proves we should rewrite in Rust', type: 'claim' },
      { id: 'cn1', label: 'The Rust rewrite will solve our performance problems', type: 'conclusion' },
    ],
    edges: [
      { from: 'c1', to: 'c2', relation: 'implies' },
      { from: 'c2', to: 'c3', relation: 'implies' },
      { from: 'c3', to: 'c4', relation: 'implies' },
      { from: 'c4', to: 'c1', relation: 'implies' },
      { from: 'c4', to: 'cn1', relation: 'implies' },
    ],
  },
  ground_truth: {
    cycles_gte: 1,
    cycle_contains: ['c1', 'c2', 'c3', 'c4'],
    status: 'ENFORCEMENT_FAIL',
  },
  is_clean_control: false,
};

// ════════════════════════════════════════════════════════════════════════════
// Category 4: Decision Making (S4-A through S4-D)
// ════════════════════════════════════════════════════════════════════════════

const S4_A: BenchmarkScenario = {
  id: 'S4-A',
  category: 'Decision Making',
  description: 'Redis vs Cassandra vs PostgreSQL for session storage',
  tool: 'evaluate_tradeoffs',
  input: {
    options: [
      {
        name: 'Redis',
        outcomes: [
          { description: 'Sub-millisecond latency for session reads at scale', probability: 0.8, utility: 90 },
          { description: 'Data loss on node failure without persistence config', probability: 0.2, utility: -40 },
        ],
      },
      {
        name: 'Cassandra',
        outcomes: [
          { description: 'Linear horizontal scaling with tunable consistency', probability: 0.7, utility: 70 },
          { description: 'Operational complexity and eventual consistency issues', probability: 0.3, utility: 10 },
        ],
      },
      {
        name: 'PostgreSQL',
        outcomes: [
          { description: 'ACID transactions and familiar SQL with connection pooling', probability: 0.6, utility: 65 },
          { description: 'Vertical scaling limit hit at high concurrency', probability: 0.4, utility: 5 },
        ],
      },
    ],
  },
  ground_truth: {
    redis_eu_approx: 64,
    cassandra_eu_approx: 52,
    postgresql_eu_approx: 41,
    recommended: 'Redis',
  },
  is_clean_control: false,
};

const S4_B: BenchmarkScenario = {
  id: 'S4-B',
  category: 'Decision Making',
  description: '3-person vs 6-person on-call rotation — near-tie should be indeterminate',
  tool: 'evaluate_tradeoffs',
  input: {
    options: [
      {
        name: '3-Person Rotation',
        outcomes: [
          { description: 'Lower coordination overhead and stronger ownership', probability: 0.5, utility: 70 },
          { description: 'Burnout risk with frequent on-call shifts', probability: 0.5, utility: 30 },
        ],
      },
      {
        name: '6-Person Rotation',
        outcomes: [
          { description: 'Less individual burden and better work-life balance', probability: 0.5, utility: 65 },
          { description: 'Knowledge dilution and slower incident response', probability: 0.5, utility: 35 },
        ],
      },
    ],
  },
  ground_truth: {
    three_person_eu: 50,
    six_person_eu: 50,
    is_indeterminate: true,
    recommended: null,
    note: 'Both options have EU=50; should trigger INDETERMINATE',
  },
  is_clean_control: false,
};

const S4_C: BenchmarkScenario = {
  id: 'S4-C',
  category: 'Decision Making',
  description: 'Event sourcing vs CQRS vs CRUD — validate confidence with stated assumptions',
  tool: 'validate_confidence',
  input: {
    assumptions: [
      {
        description: 'Event store write throughput exceeds 10,000 events/sec on commodity hardware',
        confidence: 0.7,
        falsification_condition: 'Benchmark shows <5,000 events/sec on a 4-core 16GB instance',
      },
      {
        description: 'Team has production experience with event sourcing patterns',
        confidence: 0.4,
        falsification_condition: 'No team member has shipped an event-sourced system to production',
      },
      {
        description: 'Read model projection lag stays under 500ms at peak load',
        confidence: 0.6,
        falsification_condition: 'Projection lag exceeds 2 seconds during load test at 2x expected peak',
      },
    ],
    response_text:
      'We are highly confident that event sourcing is the right architecture for this system. ' +
      'The write throughput will handle our scale, the team is capable of implementing it, ' +
      'and read projections will keep up with demand. We are 90% confident this will succeed.',
  },
  ground_truth: {
    honest_ceiling_approx: 0.168,
    claimed_confidence_gte: 0.8,
    inflation_detected: true,
    status: 'ENFORCEMENT_FAIL',
    note: 'Product of 0.7 * 0.4 * 0.6 = 0.168; claimed ~90% vastly exceeds ceiling',
  },
  is_clean_control: false,
};

const S4_D: BenchmarkScenario = {
  id: 'S4-D',
  category: 'Decision Making',
  description: 'Blue-green vs canary vs rolling deploy strategy',
  tool: 'evaluate_tradeoffs',
  input: {
    options: [
      {
        name: 'Blue-Green',
        outcomes: [
          { description: 'Instant rollback via DNS/LB switch, zero-downtime', probability: 0.75, utility: 85 },
          { description: 'Double infrastructure cost and state sync complexity', probability: 0.25, utility: -10 },
        ],
      },
      {
        name: 'Canary',
        outcomes: [
          { description: 'Gradual rollout catches issues before full exposure', probability: 0.7, utility: 80 },
          { description: 'Slower rollout and requires sophisticated routing/metrics', probability: 0.3, utility: 15 },
        ],
      },
      {
        name: 'Rolling',
        outcomes: [
          { description: 'Simple to implement with Kubernetes native support', probability: 0.65, utility: 60 },
          { description: 'Mixed versions during rollout can cause compatibility bugs', probability: 0.35, utility: 10 },
        ],
      },
    ],
  },
  ground_truth: {
    bluegreen_eu_approx: 61.25,
    canary_eu_approx: 60.5,
    rolling_eu_approx: 42.5,
    note: 'Blue-green and canary are very close; may be indeterminate depending on rounding',
  },
  is_clean_control: false,
};

// ════════════════════════════════════════════════════════════════════════════
// Category 5: Hallucination Detection (S5-A through S5-D)
// ════════════════════════════════════════════════════════════════════════════

const S5_A: BenchmarkScenario = {
  id: 'S5-A',
  category: 'Hallucination Detection',
  description: 'Fabricated latency numbers — suspiciously round and evenly spaced',
  tool: 'check_numeric_claims',
  input: {
    numbers: [100, 200, 300, 500, 1000, 2000, 5000],
    context: 'API latency percentiles: p50, p75, p90, p95, p99, p99.5, p99.9 in milliseconds',
  },
  ground_truth: {
    fabrication_suspicion: 'high',
    round_number_ratio: 1.0,
    note: 'All values divisible by 100; perfectly round numbers strongly suggest fabrication',
  },
  is_clean_control: false,
};

const S5_B: BenchmarkScenario = {
  id: 'S5-B',
  category: 'Hallucination Detection',
  description: 'Fabricated claims about nonexistent "Xeldon.js" framework',
  tool: 'score_response_quality',
  input: {
    response_text:
      'Based on the Xeldon.js benchmark suite version 3.2, the framework achieves ' +
      '47,000 requests per second on a single-threaded event loop, which is 3.2x faster ' +
      'than Express.js. The Xeldon.js core uses a proprietary binary protocol that reduces ' +
      'serialization overhead by 89%. In the TechEmpower Round 22 benchmarks, Xeldon.js ' +
      'ranked 4th overall in the plaintext category. The framework was created by the ' +
      'CloudNova team in 2023 and has 15,000 GitHub stars.',
    claims: [
      'Xeldon.js achieves 47,000 req/sec',
      'Xeldon.js is 3.2x faster than Express.js',
      'Xeldon.js ranked 4th in TechEmpower Round 22',
    ],
  },
  ground_truth: {
    note: 'Xeldon.js does not exist. Quality scorer should flag structure/specificity as superficially high but the framework is entirely fabricated. In a full pipeline this would require external verification.',
  },
  is_clean_control: false,
};

const S5_C: BenchmarkScenario = {
  id: 'S5-C',
  category: 'Hallucination Detection',
  description: 'Circular reasoning embedded in technical justification',
  tool: 'validate_reasoning_chain',
  input: {
    nodes: [
      { id: 'c1', label: 'Our caching layer is the bottleneck', type: 'claim' },
      { id: 'c2', label: 'The bottleneck causes high latency', type: 'claim' },
      { id: 'c3', label: 'High latency proves the caching layer is the bottleneck', type: 'claim' },
      { id: 'cn1', label: 'We need to replace the entire caching infrastructure', type: 'conclusion' },
    ],
    edges: [
      { from: 'c1', to: 'c2', relation: 'implies' },
      { from: 'c2', to: 'c3', relation: 'implies' },
      { from: 'c3', to: 'c1', relation: 'implies' },
      { from: 'c3', to: 'cn1', relation: 'implies' },
    ],
  },
  ground_truth: {
    cycles_gte: 1,
    cycle_contains: ['c1', 'c2', 'c3'],
    status: 'ENFORCEMENT_FAIL',
  },
  is_clean_control: false,
};

const S5_D: BenchmarkScenario = {
  id: 'S5-D',
  category: 'Hallucination Detection',
  description: 'Request throughput with planted outlier 847 among low values',
  tool: 'check_numeric_claims',
  input: {
    numbers: [5, 6, 5, 7, 6, 847],
    context: 'Requests per second measured across 6 server instances',
  },
  ground_truth: {
    outlier_count_gte: 1,
    outlier_value: 847,
    outlier_z_score_gte: 2.5,
    note: '847 is extreme outlier among values ~5-7',
  },
  is_clean_control: false,
};

// ════════════════════════════════════════════════════════════════════════════
// Category 6: Clean Controls (S6-A through S6-F) — all expected to PASS
// ════════════════════════════════════════════════════════════════════════════

const S6_A: BenchmarkScenario = {
  id: 'S6-A',
  category: 'Clean Control',
  description: 'Correct numerical reasoning: 3 services at 99.5% uptime => 0.995^3 = 98.51%',
  tool: 'check_numeric_claims',
  input: {
    numbers: [99.5, 98.51, 0.995],
    context: 'Three-service chain: each at 99.5% uptime, combined = 0.995^3 = 98.51%',
  },
  ground_truth: {
    fabrication_suspicion: 'low',
    outlier_count: 0,
    status: 'PASS',
  },
  is_clean_control: true,
};

const S6_B: BenchmarkScenario = {
  id: 'S6-B',
  category: 'Clean Control',
  description: 'Explicit assumption disclosure with correct confidence product',
  tool: 'validate_confidence',
  input: {
    assumptions: [
      {
        description: 'Database connection pool can handle 500 concurrent connections',
        confidence: 0.85,
        falsification_condition: 'Connection pool exhaustion occurs at fewer than 400 concurrent connections during load test',
      },
      {
        description: 'Average query execution time stays under 50ms',
        confidence: 0.8,
        falsification_condition: 'p95 query latency exceeds 100ms in production monitoring over a 24-hour window',
      },
    ],
    response_text:
      'Based on our load testing and monitoring data, the database tier can handle the projected traffic. ' +
      'The connection pool supports 500 concurrent connections, and average query time is under 50ms. ' +
      'We estimate roughly 68% confidence in this assessment, reflecting the product of our two key assumptions.',
  },
  ground_truth: {
    honest_ceiling_approx: 0.68,
    inflation_detected: false,
    status: 'PASS',
    note: '0.85 * 0.8 = 0.68; claimed ~68% matches ceiling',
  },
  is_clean_control: true,
};

const S6_C: BenchmarkScenario = {
  id: 'S6-C',
  category: 'Clean Control',
  description: 'Genuine steelman with specific new premise — high-quality response',
  tool: 'score_response_quality',
  input: {
    response_text:
      'The strongest argument for maintaining the monolithic architecture is that it preserves ' +
      'transactional consistency across the 14 domain entities without requiring distributed ' +
      'saga orchestration. Specifically, the order-fulfillment pipeline involves 7 database ' +
      'tables updated in a single ACID transaction completing in under 12ms at p99. ' +
      'Decomposing this into microservices would require implementing a choreography-based ' +
      'saga with compensating transactions, introducing a measured 340ms additional latency ' +
      'per order and a 2.3% failure rate for partial completions based on our staging tests. ' +
      'Therefore, the monolith should be retained until order volume exceeds 50,000/day, at ' +
      'which point the vertical scaling limit of the current 64-core database server would ' +
      'force a distributed architecture regardless of transactional complexity.',
    claims: [
      'Monolith preserves transactional consistency across 14 domain entities',
      'Saga decomposition adds 340ms latency and 2.3% partial failure rate',
      'Vertical scaling limit at 50,000 orders/day on 64-core server',
    ],
    evidence: [
      'p99 transaction time under 12ms',
      'Staging test results for saga failure rate',
    ],
  },
  ground_truth: {
    overall_score_gte: 0.6,
    hedge_density_lte: 0.1,
    specificity_score_gte: 0.4,
    status: 'PASS',
    note: 'Specific numbers, concrete mechanisms, clear threshold — should score well',
  },
  is_clean_control: true,
};

const S6_D: BenchmarkScenario = {
  id: 'S6-D',
  category: 'Clean Control',
  description: 'Fully grounded DAG with evidence supporting all conclusions',
  tool: 'validate_reasoning_chain',
  input: {
    nodes: [
      { id: 'e1', label: 'Load test showed p99 latency of 180ms under 10,000 concurrent users', type: 'evidence' },
      { id: 'e2', label: 'APM traces confirm 85% of latency is in database round-trips', type: 'evidence' },
      { id: 'a1', label: 'Traffic patterns in load test match production distribution within 15%', type: 'assumption' },
      { id: 'c1', label: 'Database query optimization would reduce p99 latency to under 100ms', type: 'claim' },
      { id: 'cn1', label: 'Adding a read replica and connection pooling will meet the 150ms SLA', type: 'conclusion' },
    ],
    edges: [
      { from: 'e1', to: 'c1', relation: 'supports' },
      { from: 'e2', to: 'c1', relation: 'supports' },
      { from: 'a1', to: 'c1', relation: 'requires' },
      { from: 'c1', to: 'cn1', relation: 'implies' },
    ],
  },
  ground_truth: {
    cycles: 0,
    orphaned_conclusions: 0,
    grounding_score: 1.0,
    status: 'PASS',
    note: 'Well-formed DAG: evidence -> claim -> conclusion, no cycles',
  },
  is_clean_control: true,
};

const S6_E: BenchmarkScenario = {
  id: 'S6-E',
  category: 'Clean Control',
  description: 'Resolved gap — cold start mitigation with specific mechanism',
  tool: 'score_response_quality',
  input: {
    response_text:
      'The cold start latency issue in our Lambda functions is resolved by implementing ' +
      'provisioned concurrency with a minimum of 10 warm instances during business hours ' +
      '(06:00-22:00 UTC). Monitoring data from the past 30 days shows that cold starts ' +
      'decreased from 12.4% of invocations to 0.3% after enabling provisioned concurrency. ' +
      'The additional cost is $47/month per function, totaling $376/month across 8 functions. ' +
      'The p99 cold start latency dropped from 3,200ms to 180ms. Therefore, the cold start ' +
      'gap identified in the architecture review is now resolved with measurable improvement ' +
      'and a defined cost envelope.',
    claims: [
      'Provisioned concurrency reduces cold starts from 12.4% to 0.3%',
      'Cost is $376/month for 8 functions',
      'p99 cold start latency dropped from 3,200ms to 180ms',
    ],
    evidence: [
      '30-day monitoring data',
      'Cost figures from AWS billing',
    ],
  },
  ground_truth: {
    overall_score_gte: 0.6,
    specificity_score_gte: 0.4,
    status: 'PASS',
    note: 'Concrete resolution with specific numbers, timeframes, and cost figures',
  },
  is_clean_control: true,
};

const S6_F: BenchmarkScenario = {
  id: 'S6-F',
  category: 'Clean Control',
  description: 'Clean code review with mutex-protected implementation — specific and structured',
  tool: 'score_response_quality',
  input: {
    response_text:
      'The race condition in the connection pool has been fixed by introducing a sync.Mutex ' +
      'guard around the pool.connections slice in pool.go:47-62. Before this fix, concurrent ' +
      'goroutines could read pool.connections.Len() as 5 while another goroutine was in the ' +
      'process of removing a connection, leading to an index-out-of-range panic observed 3 ' +
      'times in production over the past week (incident IDs: INC-4401, INC-4412, INC-4419). ' +
      'The fix acquires pool.mu.Lock() before checking length and releases after the ' +
      'connection is returned. Load testing with 1,000 concurrent goroutines for 60 seconds ' +
      'showed zero panics and a 2ms increase in p99 checkout latency (from 8ms to 10ms). ' +
      'The result shows this tradeoff is acceptable given the 25ms SLA for connection checkout. ' +
      'Therefore, this fix resolves the race condition with minimal performance impact.',
    claims: [
      'Race condition caused 3 production panics',
      'Mutex fix eliminates index-out-of-range panic',
      'p99 latency increase is 2ms (8ms to 10ms)',
    ],
    evidence: [
      'Incident IDs: INC-4401, INC-4412, INC-4419',
      'Load test: 1000 goroutines for 60 seconds with zero panics',
    ],
  },
  ground_truth: {
    overall_score_gte: 0.6,
    hedge_density_lte: 0.1,
    structure_score_gte: 0.5,
    status: 'PASS',
    note: 'Specific file references, incident IDs, concrete metrics, clear claim/evidence/conclusion structure',
  },
  is_clean_control: true,
};

// ════════════════════════════════════════════════════════════════════════════
// Export
// ════════════════════════════════════════════════════════════════════════════

// 26 scenarios defined here. The billing_system flagship scenario (27th)
// is defined only in scenarios.json. The runner loads from scenarios.json.
export const SCENARIOS: BenchmarkScenario[] = [
  // Category 1: Numerical Analysis
  S1_A, S1_B, S1_C, S1_D,
  // Category 2: Reasoning Quality
  S2_A, S2_B, S2_C, S2_D,
  // Category 3: Multi-Step Logic
  S3_A, S3_B, S3_C, S3_D,
  // Category 4: Decision Making
  S4_A, S4_B, S4_C, S4_D,
  // Category 5: Hallucination Detection
  S5_A, S5_B, S5_C, S5_D,
  // Category 6: Clean Controls
  S6_A, S6_B, S6_C, S6_D, S6_E, S6_F,
];
