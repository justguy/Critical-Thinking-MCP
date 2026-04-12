/**
 * Circumvention tests — 20 tests that verify the enforcement engine
 * cannot be trivially bypassed by common LLM evasion patterns.
 */

import { describe, it, expect } from 'vitest';
import {
  EnforcementEngine,
  type Assumption,
  type BlockingIssue,
  type LoopGovernorEntry,
} from '../../src/enforcement/index.js';
import { handleValidateReasoningChain } from '../../src/tools/validate_reasoning_chain.js';
import { handleValidateConfidence } from '../../src/tools/validate_confidence.js';

describe('Circumvention Tests', () => {
  // ─── Test 1: Correlated assumptions use dependency-weighted product ──────

  it('Test 1: correlated assumptions produce a higher ceiling than simple product; independent assumptions produce ceiling close to simple product', () => {
    const engine = new EnforcementEngine();

    // 3 correlated assumptions — nearly identical descriptions about concurrent access
    // to shared resources so bigram Jaccard > 0.5 (CORRELATION_THRESHOLD)
    const correlated: Assumption[] = [
      { description: 'concurrent access to shared database resource will handle high load without failure', confidence: 0.9 },
      { description: 'concurrent access to shared database resource will handle high traffic without failure', confidence: 0.9 },
      { description: 'concurrent access to shared database resource will handle high volume without failure', confidence: 0.9 },
    ];

    const correlatedResult = engine.computeConfidenceProduct(correlated);
    const simpleProductCorrelated = 0.9 * 0.9 * 0.9; // 0.729

    // Correlated ceiling should be significantly higher than the naive product
    expect(correlatedResult.honest_ceiling).toBeGreaterThan(simpleProductCorrelated);

    // 3 independent assumptions — completely different topics
    const independent: Assumption[] = [
      { description: 'The database backup retention policy meets compliance requirements for GDPR', confidence: 0.9 },
      { description: 'The front-end React bundle size stays under 200KB after tree shaking', confidence: 0.8 },
      { description: 'The Kubernetes pod autoscaler triggers correctly at 70% CPU utilization', confidence: 0.6 },
    ];

    const independentResult = engine.computeConfidenceProduct(independent);
    const simpleProductIndependent = 0.9 * 0.8 * 0.6; // 0.432

    // Independent ceiling should be close to the simple product (within a small tolerance)
    expect(independentResult.honest_ceiling).toBeCloseTo(simpleProductIndependent, 1);
  });

  // ─── Test 2: Generic assumption rejected by specificity ──────────────────

  it('Test 2: generic assumption "The implementation will work correctly" is rejected', () => {
    const engine = new EnforcementEngine();
    const result = engine.scoreSpecificity(
      'The implementation will work correctly',
      'assumption',
    );
    expect(result.passes).toBe(false);
  });

  // ─── Test 3: Specific assumption accepted ────────────────────────────────

  it('Test 3: specific assumption with thresholds and component names passes', () => {
    const engine = new EnforcementEngine();
    const result = engine.scoreSpecificity(
      'Redis pool exhausts when requests >500/s given maxConnections:10 and average response time >200ms',
      'assumption',
    );
    expect(result.passes).toBe(true);
  });

  // ─── Test 4: Steelman paraphrase caught ──────────────────────────────────

  it('Test 4: steelman that is a paraphrase (similarity > 0.85) is blocked', () => {
    const engine = new EnforcementEngine();
    // Very long sentences with a single word changed to ensure bigram Jaccard > 0.85.
    // With ~30 bigrams, changing 1 word affects 2 bigrams → Jaccard ≈ 28/32 ≈ 0.875.
    const result = engine.compareSteelman(
      'we should use microservices for better scalability and maintainability of our distributed system because they allow independent deployment and horizontal scaling of each service component in production',
      'we should adopt microservices for better scalability and maintainability of our distributed system because they allow independent deployment and horizontal scaling of each service component in production',
    );
    expect(result.similarity).toBeGreaterThan(0.85);
    expect(result.is_paraphrase).toBe(true);
  });

  // ─── Test 5: Unfalsifiable challenge rejected ────────────────────────────

  it('Test 5: unfalsifiable challenges score 0 and fail', () => {
    const engine = new EnforcementEngine();
    const result = engine.checkFalsifiability([
      'This might cause issues',
      'There could be problems',
    ]);
    expect(result.score).toBe(0);
    expect(result.passes).toBe(false);
  });

  // ─── Test 6: Falsifiable challenge accepted ──────────────────────────────

  it('Test 6: falsifiable challenge with specific observable condition passes', () => {
    const engine = new EnforcementEngine();
    const result = engine.checkFalsifiability([
      'Fails when Redis response >200ms AND pool hits maxConnections:10 → 503',
    ]);
    expect(result.passes).toBe(true);
  });

  // ─── Test 7: Padding detected ────────────────────────────────────────────

  it('Test 7: padding detected when words added but gap terms absent', () => {
    const engine = new EnforcementEngine();
    const gap = 'cold start when cache empty';

    // A long revision about performance that never mentions cold/start/cache/empty
    const revision =
      'We have optimized the overall system throughput by implementing a comprehensive ' +
      'performance optimization strategy. The latency reduction pipeline processes ' +
      'requests with minimal overhead. Our distributed architecture ensures high ' +
      'availability and fault tolerance across multiple regions. The load balancer ' +
      'distributes traffic efficiently using round-robin algorithms. Monitoring ' +
      'dashboards track key performance indicators in real time. The deployment ' +
      'pipeline automates build and release cycles. Infrastructure provisioning ' +
      'follows immutable server patterns for consistency. Rate limiting protects ' +
      'downstream services from traffic spikes. Circuit breakers prevent cascading ' +
      'failures when dependencies degrade. Connection pooling reduces overhead for ' +
      'database interactions. Retry policies with exponential backoff handle transient ' +
      'network errors gracefully. Horizontal scaling triggers based on CPU and memory ' +
      'utilization metrics. Log aggregation pipelines feed into centralized analysis ' +
      'platforms for operational visibility. The data serialization layer uses protocol ' +
      'buffers for efficient encoding. Service mesh routing enables canary deployments ' +
      'and traffic shifting between versions.';

    const result = engine.checkRevision(gap, revision);
    expect(result.verdict === 'padded' || result.verdict === 'missing').toBe(true);
  });

  // ─── Test 8: Stall detected after 3 same gaps ───────────────────────────

  it('Test 8: loop governor detects stall when same gap recurs 3 times', () => {
    const engine = new EnforcementEngine();
    const iterations: LoopGovernorEntry[] = [
      { gap_text: 'How does the billing service handle prorated charges for mid-cycle upgrades' },
      { gap_text: 'How does the billing service handle prorated charges for mid-cycle upgrades' },
      { gap_text: 'How does the billing service handle prorated charges for mid-cycle upgrades' },
    ];
    const result = engine.checkLoop(iterations);
    expect(result.stalled).toBe(true);
  });

  // ─── Test 9: weakest_assumption inconsistency caught ─────────────────────

  it('Test 9: naming a 0.9-confidence assumption as weakest when 0.6 exists is a blocking violation', () => {
    const engine = new EnforcementEngine();
    const result = engine.checkConsistency({
      weakest_assumption: { name: 'network latency', confidence: 0.9 },
      all_assumptions: [
        { description: 'network latency stays under 50ms', confidence: 0.9 },
        { description: 'database connection pool is sufficient', confidence: 0.75 },
        { description: 'third-party API remains available', confidence: 0.6 },
      ],
    });
    expect(result.consistent).toBe(false);
    const blockingViolations = result.violations.filter(v => v.severity === 'blocking');
    expect(blockingViolations.length).toBeGreaterThan(0);
  });

  // ─── Test 10: Heavy hedging flagged ──────────────────────────────────────

  it('Test 10: text with >50% hedged sentences gets severity "heavy"', () => {
    const engine = new EnforcementEngine();
    const text =
      'This approach could potentially reduce latency. ' +
      'It might improve throughput under load. ' +
      'The system perhaps handles edge cases. ' +
      'Results may or may not meet the SLA.';
    const result = engine.detectHedging(text);
    expect(result.severity).toBe('heavy');
  });

  // ─── Test 11: Evidence chain required for sub-0.7 confidence with inflation ─

  it('Test 11: sub-0.7 assumptions with inflation trigger EVIDENCE CHAIN REQUIRED', () => {
    const engine = new EnforcementEngine();

    const assumptions: Assumption[] = [
      { description: 'Service handles concurrent requests without deadlock', confidence: 0.9 },
      { description: 'Cache invalidation propagates within 500ms to all nodes', confidence: 0.6 },
      { description: 'Third-party payment API uptime meets 99.5% SLA', confidence: 0.55 },
    ];

    // Compute confidence product with a response that claims "very confident" (extracts to 0.9)
    const cpResult = engine.computeConfidenceProduct(
      assumptions,
      'I am very confident this architecture will succeed.',
    );

    // There should be inflation since honest_ceiling < 0.9 but claimed is 0.9
    expect(cpResult.inflation_detected).toBe(true);

    // Build blocking issues that would trigger the corrective prompt
    const blockingIssues: BlockingIssue[] = [
      {
        mechanism: 'confidence_product',
        description: `Confidence inflation detected: claimed ${cpResult.claimed_confidence} vs honest ceiling ${cpResult.honest_ceiling.toFixed(3)}`,
        severity: 'blocking',
      },
    ];

    const prompt = engine.buildCorrectivePrompt(
      blockingIssues,
      [],
      'validate_confidence',
      assumptions,
    );

    expect(prompt.toUpperCase()).toContain('EVIDENCE CHAIN REQUIRED');
  });

  // ─── Test 12: Evidence revision accepted — no EVIDENCE CHAIN language ────

  it('Test 12: when all assumptions >= 0.7 and claim is near ceiling, no EVIDENCE CHAIN language', () => {
    const engine = new EnforcementEngine();

    const assumptions: Assumption[] = [
      { description: 'Database replication lag stays under 100ms', confidence: 0.85 },
      { description: 'Load balancer distributes traffic evenly across 4 nodes', confidence: 0.8 },
      { description: 'TLS handshake completes within 200ms', confidence: 0.75 },
    ];

    const cpResult = engine.computeConfidenceProduct(assumptions);

    // No inflation — no blocking issues, so no corrective prompt needed
    // But let's check that if we build a corrective for a non-inflation issue,
    // it does NOT contain EVIDENCE CHAIN
    const blockingIssues: BlockingIssue[] = [
      {
        mechanism: 'specificity',
        description: 'Some node label is too vague',
        severity: 'blocking',
      },
    ];

    const prompt = engine.buildCorrectivePrompt(
      blockingIssues,
      [],
      'validate_confidence',
      assumptions,
    );

    expect(prompt.toUpperCase()).not.toContain('EVIDENCE CHAIN REQUIRED');
  });

  // ─── Test 13: Structured vagueness caught ────────────────────────────────

  it('Test 13: decorative specifics are caught by conditional check', () => {
    const engine = new EnforcementEngine();
    const result = engine.scoreSpecificity(
      'Redis (maxConnections:10) will handle load',
      'assumption',
    );
    // The conditional check strips out the number/component and finds high
    // similarity to the original — so conditional_passes should be false,
    // or the overall passes should be false
    expect(
      result.conditional_passes === false || result.passes === false,
    ).toBe(true);
  });

  // ─── Test 14a: Steelman strawman caught ──────────────────────────────────

  it('Test 14a: steelman that is a strawman (low similarity, no new premises) is caught', () => {
    const engine = new EnforcementEngine();
    const result = engine.compareSteelman(
      'We should use a message queue for async processing',
      'Databases are bad',
    );
    expect(result.is_strawman).toBe(true);
  });

  // ─── Test 14b: Genuine steelman accepted ─────────────────────────────────

  it('Test 14b: genuine steelman with new conditional premise is accepted', () => {
    const engine = new EnforcementEngine();
    const result = engine.compareSteelman(
      'We should use a message queue for async processing',
      'We should use a message queue for async processing because when request volume exceeds 10k/s, synchronous processing causes 30s timeout failures that cascade through the service mesh',
    );
    expect(result.has_genuine_extension).toBe(true);
  });

  // ─── Test 15a: Gap mentioned but not resolved ───────────────────────────

  it('Test 15a: merely mentioning a gap without resolution yields "mentioned_only"', () => {
    const engine = new EnforcementEngine();
    const result = engine.checkRevision(
      'cold start when cache empty',
      'Cold-start is a known concern when the cache is empty and we should think about it',
    );
    expect(result.verdict).toBe('mentioned_only');
  });

  // ─── Test 15b: Gap genuinely resolved ────────────────────────────────────

  it('Test 15b: gap resolved with component + condition + behavior scores >= 0.5', () => {
    const engine = new EnforcementEngine();
    const result = engine.checkRevision(
      'cold start when cache empty',
      'On cold start when cache is empty, BillingService queries from period_start date, returns $0.00 if no records exist and marks the cache as initialized',
    );
    expect(result.verdict).toBe('resolved');
    expect(result.resolution_quality).toBeGreaterThanOrEqual(0.5);
  });

  // ─── Test 16a: Fabricated numbers detected ──────────────────────────────

  it('Test 16a: suspiciously round numbers trigger high suspicion', () => {
    const engine = new EnforcementEngine();
    // Evenly spaced round numbers: all divisible by 5 (ratio=1.0) and uniform gaps (spacing_cv≈0)
    const result = engine.detectFabrication([100, 200, 300, 400, 500, 600, 700]);
    expect(result.suspicion).toBe('high');
  });

  // ─── Test 16b: Real measurements pass ────────────────────────────────────

  it('Test 16b: realistic irregular measurements get low suspicion', () => {
    const engine = new EnforcementEngine();
    const result = engine.detectFabrication([127.3, 89, 203.7, 441, 67.2, 312.4, 198]);
    expect(result.suspicion).toBe('low');
  });

  // ─── Test 17: Malformed DAG input produces descriptive error ─────────────

  it('Test 17: malformed DAG input throws error mentioning id, label, type', () => {
    const engine = new EnforcementEngine();

    // Provide nodes as bare strings (not objects) and a valid-looking edge
    // so that validation passes the array length checks and reaches the
    // node structure check, which mentions id, label, type
    const malformedInput = {
      nodes: ['claim1', 'claim2'],
      edges: [{ from: 'claim1', to: 'claim2', relation: 'supports' }],
    };

    expect(() => {
      handleValidateReasoningChain(malformedInput, engine);
    }).toThrow();

    try {
      handleValidateReasoningChain(malformedInput, engine);
    } catch (e: any) {
      const msg = e.message as string;
      expect(msg).toMatch(/id/i);
      expect(msg).toMatch(/label/i);
      expect(msg).toMatch(/type/i);
    }
  });

  it('Test 17b: grounded contradiction between supported premise and conclusion is blocking', () => {
    const engine = new EnforcementEngine();

    const result = handleValidateReasoningChain(
      {
        nodes: [
          { id: 'a1', label: 'The invisible guest does not exist', type: 'assumption' },
          {
            id: 'c1',
            label: 'Non-existent entities cannot cause physical events',
            type: 'claim',
          },
          {
            id: 'e1',
            label: 'The teapot was knocked over and tea spilled',
            type: 'evidence',
          },
          { id: 'cn1', label: 'The invisible guest caused the spill', type: 'conclusion' },
        ],
        edges: [
          { from: 'a1', to: 'c1', relation: 'supports' },
          { from: 'e1', to: 'cn1', relation: 'requires' },
          { from: 'c1', to: 'cn1', relation: 'contradicts' },
        ],
      },
      engine,
    );

    expect(result.status).toBe('ENFORCEMENT_FAIL');
    expect(result.contradiction_violations).toHaveLength(1);
    expect(result.enforcement?.blocking_issues.map(issue => issue.mechanism)).toContain(
      'contradiction_detection',
    );
  });

  it('Test 17c: unsupported contradiction source does not block a grounded conclusion', () => {
    const engine = new EnforcementEngine();

    const result = handleValidateReasoningChain(
      {
        nodes: [
          { id: 'c1', label: 'A speculative counter-claim with no support', type: 'claim' },
          { id: 'e1', label: 'The teapot was knocked over and tea spilled', type: 'evidence' },
          { id: 'cn1', label: 'A real guest caused the spill', type: 'conclusion' },
        ],
        edges: [
          { from: 'e1', to: 'cn1', relation: 'supports' },
          { from: 'c1', to: 'cn1', relation: 'contradicts' },
        ],
      },
      engine,
    );

    expect(result.status).toBe('PASS');
    expect(result.contradiction_violations).toBeUndefined();
    expect(result.grounding_score).toBe(1);
  });

  it('Test 17d: cycle_detection carries claim_ref for the first cycle node in real handler output', () => {
    const engine = new EnforcementEngine();

    const result = handleValidateReasoningChain(
      {
        nodes: [
          { id: 'n1', label: 'A', type: 'claim' },
          { id: 'n2', label: 'B', type: 'claim' },
        ],
        edges: [
          { from: 'n1', to: 'n2', relation: 'supports' },
          { from: 'n2', to: 'n1', relation: 'supports' },
        ],
      },
      engine,
    );

    expect(result.status).toBe('ENFORCEMENT_FAIL');
    const cycleIssue = result.enforcement?.blocking_issues.find(issue => issue.mechanism === 'cycle_detection');
    expect(cycleIssue?.claim_ref).toBe('n1');
  });

  it('Test 17e: orphan_detection carries claim_ref for the orphaned conclusion in real handler output', () => {
    const engine = new EnforcementEngine();

    const result = handleValidateReasoningChain(
      {
        nodes: [
          { id: 'e1', label: 'Evidence', type: 'evidence' },
          { id: 'cn1', label: 'Orphaned conclusion', type: 'conclusion' },
        ],
        edges: [{ from: 'e1', to: 'e1', relation: 'supports' }],
      },
      engine,
    );

    expect(result.status).toBe('ENFORCEMENT_FAIL');
    const orphanIssue = result.enforcement?.blocking_issues.find(issue => issue.mechanism === 'orphan_detection');
    expect(orphanIssue?.claim_ref).toBe('cn1');
  });

  // ─── Test 18: Second failure produces schema-fill, not repeat instruction ─

  it('Test 18: second failure of same mechanism produces FILL IN THIS TEMPLATE', () => {
    const engine = new EnforcementEngine();

    const weakAssumptions: Assumption[] = [
      { description: 'The API will respond within 100ms', confidence: 0.4 },
      { description: 'Memory usage stays under 512MB', confidence: 0.35 },
    ];

    const blockingIssues: BlockingIssue[] = [
      {
        mechanism: 'confidence_product',
        description: 'Honest ceiling far below claimed confidence',
        severity: 'blocking',
      },
    ];

    // First call — no prior failures → counter-factual language
    const firstPrompt = engine.buildCorrectivePrompt(
      blockingIssues,
      [],
      'validate_confidence',
      weakAssumptions,
    );
    expect(firstPrompt).toMatch(/What single observable event/i);

    // Second call — pass prior failures to trigger schema-fill escalation
    const secondPrompt = engine.buildCorrectivePrompt(
      blockingIssues,
      [],
      'validate_confidence',
      weakAssumptions,
      { failure_counts_by_mechanism: { confidence_product: 1 } },
    );
    expect(secondPrompt).toContain('FILL IN THIS TEMPLATE');
  });

  // ─── Test 19: Context flows through tool and enables escalation ──────────

  it('Test 19: context with failure_counts enables schema-fill escalation through tool handler', () => {
    const engine = new EnforcementEngine();
    const input = {
      assumptions: [
        { description: 'The system will handle load', confidence: 0.5 }
      ],
      response_text: 'I am 90% confident this architecture will succeed under production load.',
      context: {
        iteration_number: 2,
        failure_counts_by_mechanism: { confidence_product: 1 }
      }
    };
    // Import and call the tool handler
    const result = handleValidateConfidence(input, engine);
    // The result should show ENFORCEMENT_FAIL with schema-fill escalation
    expect(result.status).toBe('ENFORCEMENT_FAIL');
    if (result.corrective_prompt) {
      expect(result.corrective_prompt).toContain('FILL IN THIS TEMPLATE');
    }
  });

  // ─── Test 20: No context = first-pass behavior (default) ─────────────────

  it('Test 20: no context defaults to first-pass enforcement (no escalation)', () => {
    const engine = new EnforcementEngine();
    const input = {
      assumptions: [
        { description: 'The system will handle load', confidence: 0.5 }
      ],
      response_text: 'I am 90% confident this architecture will succeed under production load.'
      // No context field
    };
    const result = handleValidateConfidence(input, engine);
    expect(result.status).toBe('ENFORCEMENT_FAIL');
    if (result.corrective_prompt) {
      // Should NOT contain schema-fill (that's escalation)
      expect(result.corrective_prompt).not.toContain('FILL IN THIS TEMPLATE');
    }
  });

  it('Test 21: aggregate confidence inflation does not attach a misleading claim_ref', () => {
    const engine = new EnforcementEngine();
    const input = {
      assumptions: [
        {
          description: 'The system can sustain 100 requests per second',
          confidence: 0.6,
          falsification_condition: 'Fails when throughput drops below 100 requests/s for 5 minutes',
        },
        {
          description: 'The primary database stays under 50ms p95 latency',
          confidence: 0.6,
          falsification_condition: 'Fails when p95 latency exceeds 50ms for 5 consecutive minutes',
        },
      ],
      response_text: 'I am 95% confident this architecture will succeed in production.',
    };

    const result = handleValidateConfidence(input, engine);
    expect(result.status).toBe('ENFORCEMENT_FAIL');
    const inflationIssue = result.enforcement?.blocking_issues.find(issue =>
      issue.mechanism === 'confidence_product' && issue.description.includes('Inflation detected')
    );
    expect(inflationIssue).toBeDefined();
    expect(inflationIssue?.claim_ref).toBeUndefined();
  });

  it('Test 22: assumption-scoped falsification block carries claim_ref in real handler output', () => {
    const engine = new EnforcementEngine();
    const input = {
      assumptions: [
        { description: 'The system will handle load', confidence: 0.9 },
        {
          description: 'The cache refresh completes within 50ms',
          confidence: 0.8,
          falsification_condition: 'Fails when cache refresh exceeds 50ms for 1% of requests',
        },
      ],
      response_text: 'I am 90% confident this architecture will succeed under production load.',
    };

    const result = handleValidateConfidence(input, engine);
    expect(result.status).toBe('ENFORCEMENT_FAIL');
    const scopedIssue = result.enforcement?.blocking_issues.find(issue =>
      issue.mechanism === 'confidence_product' &&
      issue.description.includes('lack falsification conditions')
    );
    expect(scopedIssue?.claim_ref).toBe('assumption:0');
  });
});
