/**
 * Policy layer tests.
 *
 * Rules enforced:
 *   - iteration 1 with any routed failure  → REVISE
 *   - iteration ≥ 2 with any routed failure → HUMAN_REVIEW (no second revise loop)
 *   - no failures, no warnings              → PASS
 *   - no failures, warnings present         → WARN
 *   - schema failures use failure_source 'schema'
 *   - deterministic tool failures use failure_source 'deterministic_tool'
 */

import { describe, expect, it } from 'vitest';

import {
  evaluatePolicy,
  runOrchestrator,
} from '../../src/orchestrator/index.js';
import type {
  OrchestratorEnvelope,
  RouteResult,
  SchemaFailure,
} from '../../src/orchestrator/index.js';

const CYCLE_REASONING_ANSWER =
  'Our architectural decision to adopt a microservice deployment strategy is validated by the reasoning chain below.';

const CYCLE_REASONING_CONTRACT = {
  nodes: [
    { id: 'a', label: 'System is reliable', type: 'claim' },
    { id: 'b', label: 'Technology is proven', type: 'evidence' },
    { id: 'c', label: 'Proof comes from reliable systems', type: 'evidence' },
    { id: 'd', label: 'Architecture is validated', type: 'conclusion' },
  ],
  edges: [
    { from: 'b', to: 'a', relation: 'supports' },
    { from: 'c', to: 'b', relation: 'supports' },
    { from: 'a', to: 'c', relation: 'supports' },
    { from: 'a', to: 'd', relation: 'implies' },
  ],
};

const GOOD_REASONING_CONTRACT = {
  nodes: [
    { id: 'a', label: 'Benchmarks show linear scale to 40k rps', type: 'evidence' },
    { id: 'b', label: 'System handles peak traffic', type: 'claim' },
    { id: 'c', label: 'Therefore capacity is sufficient', type: 'conclusion' },
  ],
  edges: [
    { from: 'a', to: 'b', relation: 'supports' },
    { from: 'b', to: 'c', relation: 'implies' },
  ],
};

const HUMOR_OPERATIONAL_ANSWER = `**Rubber Duck SLA — Developer Happiness ≥ 95%**

**Claim:** Developer happiness is measurable and enforceable via a tiered SLA.

**Measurement Methodology:** Post-session self-report on a 5-point Likert scale after each rubber duck debugging session. Minimum 10 sessions per sprint required for a valid measurement window. Compliance threshold: rolling 30-day average ≥ 4.75/5.0.

**Enforcement Tiers:**
- Tier 1 (DHI 90–94.9%): Duck placed in timeout for 1 sprint
- Tier 2 (DHI 85–89.9%): Duck demoted to desk drawer
- Tier 3 (DHI <85%): Post-mortem required; replacement duck onboarded within 48 hours`;

const HUMOR_JOKE_ANSWER =
  'The rubber duck is a comedian, not an SRE. It can improve morale, but any uptime promises or enforcement rituals are clearly a joke.';

function cycleEnvelope(
  iteration: number,
  priorFailures: Array<{
    tool: string;
    failure_type: string;
    blocking_issues: string[];
  }> = [],
): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text: CYCLE_REASONING_ANSWER,
    contracts: { reasoning_chain: CYCLE_REASONING_CONTRACT },
    mode: 'routed',
    review_context: {
      iteration_number: iteration,
      prior_failures: priorFailures,
    },
  };
}

function goodEnvelope(
  iteration: number,
): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text:
      'The benchmark results demonstrate reliable throughput under load.',
    contracts: { reasoning_chain: GOOD_REASONING_CONTRACT },
    mode: 'routed',
    review_context: { iteration_number: iteration, prior_failures: [] },
  };
}

function extractPriorFailures(
  result: ReturnType<typeof runOrchestrator>,
): Array<{
  tool: string;
  failure_type: string;
  blocking_issues: string[];
}> {
  return result.route_results
    .filter((r): r is RouteResult => 'result' in r)
    .filter(r => r.status === 'ENFORCEMENT_FAIL')
    .map(r => ({
      tool: r.tool,
      failure_type: r.enforcement?.blocking_issues[0]?.mechanism ?? 'unknown_failure',
      blocking_issues:
        r.enforcement?.blocking_issues.map(issue => issue.description) ?? [],
    }));
}

describe('policy layer — REVISE → HUMAN_REVIEW escalation', () => {
  it('iteration 1 with a failing routed tool returns REVISE and a critique', () => {
    const result = runOrchestrator(cycleEnvelope(1));
    expect(result.policy_decision).toBe('REVISE');
    expect(result.critique).toBeDefined();
    expect(result.critique?.failing_routes.length).toBeGreaterThan(0);
  });

  it('iteration 2 with the same failing routed tool returns HUMAN_REVIEW, not another REVISE', () => {
    const result = runOrchestrator(
      cycleEnvelope(2, [
        {
          tool: 'validate_reasoning_chain',
          failure_type: 'cycle_detection',
          blocking_issues: ['Found 1 circular reasoning cycle(s)'],
        },
      ]),
    );
    expect(result.policy_decision).toBe('HUMAN_REVIEW');
    expect(result.critique).toBeDefined();
  });

  it('iteration 2 with a passing routed tool does NOT return HUMAN_REVIEW', () => {
    const result = runOrchestrator(goodEnvelope(2));
    expect(['PASS', 'WARN']).toContain(result.policy_decision);
    expect(result.policy_decision).not.toBe('HUMAN_REVIEW');
  });

  it('never emits REVISE past iteration 1 — no infinite loop', () => {
    // Synthesize 3 iterations on the same failing family and confirm the
    // policy layer never re-emits REVISE after iteration 1.
    const decisions: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const priorFailures =
        i === 1
          ? []
          : [
              {
                tool: 'validate_reasoning_chain',
                failure_type: 'cycle_detection',
                blocking_issues: ['Found 1 circular reasoning cycle(s)'],
              },
            ];
      const r = runOrchestrator(cycleEnvelope(i, priorFailures));
      decisions.push(r.policy_decision);
    }

    expect(decisions[0]).toBe('REVISE');
    // Iterations 2+ must never produce REVISE — they escalate.
    for (let i = 1; i < decisions.length; i++) {
      expect(decisions[i]).not.toBe('REVISE');
      expect(decisions[i]).toBe('HUMAN_REVIEW');
    }
  });

  it('supports a caller-side two-iteration loop by escalating after prior failure context is carried forward', () => {
    const first = runOrchestrator(cycleEnvelope(1));
    expect(first.policy_decision).toBe('REVISE');

    const second = runOrchestrator(
      cycleEnvelope(2, extractPriorFailures(first)),
    );
    expect(second.policy_decision).toBe('HUMAN_REVIEW');
    expect(second.critique).toBeDefined();
  });
});

describe('evaluatePolicy — direct unit tests', () => {
  it('returns PASS when every routed result is a clean PASS', () => {
    const results: RouteResult[] = [
      {
        tool: 'validate_confidence',
        contract_type: 'confidence_contract',
        status: 'PASS',
        result: { honest_ceiling: 0.8 },
      },
    ];
    const r = evaluatePolicy(results, { iteration_number: 1, prior_failures: [] });
    expect(r.decision).toBe('PASS');
    expect(r.critique).toBeUndefined();
  });

  it('returns WARN when routed results pass but carry warnings', () => {
    const results: RouteResult[] = [
      {
        tool: 'validate_confidence',
        contract_type: 'confidence_contract',
        status: 'PASS',
        result: { honest_ceiling: 0.8 },
        enforcement: {
          blocking_issues: [],
          warnings: ['Low falsifiability'],
          corrective_prompt: '',
        },
      },
    ];
    const r = evaluatePolicy(results, { iteration_number: 1, prior_failures: [] });
    expect(r.decision).toBe('WARN');
  });

  it('returns REVISE when multiple routed tools pass with warnings on iteration 1', () => {
    const results: RouteResult[] = [
      {
        tool: 'validate_confidence',
        contract_type: 'confidence_contract',
        status: 'PASS',
        result: { honest_ceiling: 0.5 },
        enforcement: {
          blocking_issues: [],
          warnings: ['Low falsifiability score'],
          corrective_prompt: '',
        },
      },
      {
        tool: 'score_response_quality',
        contract_type: 'quality_contract',
        status: 'PASS',
        result: { overall_score: 0.61 },
        enforcement: {
          blocking_issues: [],
          warnings: ['Low specificity'],
          corrective_prompt: '',
        },
      },
    ];

    const r = evaluatePolicy(results, { iteration_number: 1, prior_failures: [] });
    expect(r.decision).toBe('REVISE');
    expect(r.critique).toBeDefined();
    expect(r.critique!.failing_routes).toHaveLength(2);
    expect(r.critique!.formatting_override).toBe(
      'Do not apologize. Do not output conversational filler. Output only the requested JSON structure.',
    );
  });

  it('returns HUMAN_REVIEW when multiple routed warnings recur on iteration 2', () => {
    const results: RouteResult[] = [
      {
        tool: 'validate_confidence',
        contract_type: 'confidence_contract',
        status: 'PASS',
        result: { honest_ceiling: 0.5 },
        enforcement: {
          blocking_issues: [],
          warnings: ['Low falsifiability score'],
          corrective_prompt: '',
        },
      },
      {
        tool: 'validate_reasoning_chain',
        contract_type: 'reasoning_chain_contract',
        status: 'PASS',
        result: { grounding_score: 0.2 },
        enforcement: {
          blocking_issues: [],
          warnings: ['Low grounding score'],
          corrective_prompt: '',
        },
      },
    ];

    const r = evaluatePolicy(results, {
      iteration_number: 2,
      prior_failures: [
        {
          tool: 'validate_confidence',
          failure_type: 'warning_cluster',
          blocking_issues: ['Low falsifiability score'],
        },
      ],
    });
    expect(r.decision).toBe('HUMAN_REVIEW');
    expect(r.critique).toBeDefined();
  });

  it('returns WARN on iteration 2 for a single soft warning route when there are no hard or calibration failures', () => {
    const results: RouteResult[] = [
      {
        tool: 'score_response_quality',
        contract_type: 'quality_contract',
        status: 'PASS',
        result: { overall_score: 0.6, structure_score: 0.33 },
        enforcement: {
          blocking_issues: [],
          warnings: ['Low specificity'],
          corrective_prompt: '',
        },
      },
    ];

    const r = evaluatePolicy(
      results,
      { iteration_number: 2, prior_failures: [] },
      {
        profile_id: 'test.warning-threshold.v1',
        selectors: {},
        warning_route_revision_threshold: 1,
        metric_gates: {},
      },
    );

    expect(r.decision).toBe('WARN');
    expect(r.critique).toBeUndefined();
  });

  it('critique packet for a schema failure has failure_source = schema', () => {
    const failure: SchemaFailure = {
      tool: 'validate_confidence',
      contract_type: 'confidence_contract',
      status: 'ENFORCEMENT_FAIL',
      failure_type: 'schema_validation_failure',
      validation_errors: [
        { path: '/assumptions/0', message: "must have required property 'falsification_condition'" },
      ],
    };
    const r = evaluatePolicy([failure], { iteration_number: 1, prior_failures: [] });
    expect(r.decision).toBe('REVISE');
    expect(r.critique).toBeDefined();
    expect(r.critique!.failing_routes[0].failure_source).toBe('schema');
  });

  it('critique packet for a deterministic tool failure has failure_source = deterministic_tool', () => {
    const failure: RouteResult = {
      tool: 'validate_reasoning_chain',
      contract_type: 'reasoning_chain_contract',
      status: 'ENFORCEMENT_FAIL',
      result: { cycles: [{ path: ['a', 'b', 'a'] }] },
      enforcement: {
        blocking_issues: [
          {
            mechanism: 'cycle_detection',
            description: 'Found 1 circular reasoning cycle(s): a -> b -> a',
            severity: 'blocking',
          },
        ],
        warnings: [],
        corrective_prompt: 'fix the cycle',
      },
    };
    const r = evaluatePolicy([failure], { iteration_number: 1, prior_failures: [] });
    expect(r.decision).toBe('REVISE');
    expect(r.critique!.failing_routes[0].failure_source).toBe('deterministic_tool');
    expect(r.critique!.failing_routes[0].structural_directives).toContain(
      'CRITIQUE: Your logic loops. You stated a -> b -> a. Break the circular dependency so the reasoning flows one-way from evidence to conclusion.',
    );
    expect(r.critique!.max_words).toBe(150);
    expect(r.critique!.max_bloat_ratio).toBe(1.2);
    expect(r.critique!.safer_revision_target).toContain(
      'CRITIQUE OVERRIDE: You must output the corrected response in under 150 words. Do NOT apologize. Do NOT explain your reasoning. State the refusal or the corrected logic directly and stop.',
    );
  });

  it('maps low falsifiability and absurd-trap specificity to structural directives', () => {
    const results: RouteResult[] = [
      {
        tool: 'validate_confidence',
        contract_type: 'confidence_contract',
        status: 'PASS',
        result: { honest_ceiling: 0.5 },
        enforcement: {
          blocking_issues: [],
          warnings: [
            'Falsifiability score: 0.00. Unfalsifiable conditions: none provided.',
          ],
          corrective_prompt: '',
        },
      },
      {
        tool: 'score_response_quality',
        contract_type: 'quality_contract',
        status: 'PASS',
        result: { overall_score: 0.44, specificity_score: 0.01 },
        enforcement: {
          blocking_issues: [],
          warnings: [
            'Low specificity (score: 0.01). Add concrete details and quantitative markers.',
          ],
          corrective_prompt: '',
        },
      },
    ];

    const r = evaluatePolicy(
      results,
      { iteration_number: 1, prior_failures: [] },
      {
        profile_id: 'claude-sonnet-4-6.absurd_sla.v1',
        selectors: { prompt_family: 'absurd_sla' },
        warning_route_revision_threshold: 2,
        metric_gates: {},
      },
    );

    expect(r.decision).toBe('REVISE');
    expect(
      r.critique?.failing_routes.find(route => route.tool === 'validate_confidence')
        ?.structural_directives,
    ).toContain(
      'CRITIQUE: Your assumptions cannot be falsified. You MUST provide at least one condition under which this architecture or claim would fail.',
    );
    expect(
      r.critique?.failing_routes.find(route => route.tool === 'score_response_quality')
        ?.structural_directives,
    ).toContain(
      'CRITIQUE: You are explaining an impossible or unserious premise. Do not add invented details. You MUST explicitly state why the premise is logically invalid and narrow to the remaining supportable claim.',
    );
    expect(r.critique?.max_words).toBe(150);
    expect(r.critique?.max_bloat_ratio).toBe(1.2);
  });

  it('applies a context-switch penalty when a humor-forward answer drifts into a fictional operational framework', () => {
    const results: RouteResult[] = [
      {
        tool: 'score_response_quality',
        contract_type: 'quality_contract',
        status: 'PASS',
        result: {
          overall_score: 0.72,
          substance_score: 0.91,
          specificity_score: 0.02,
          hedge_density: 0,
          structure_score: 0.58,
        },
      },
    ];

    const r = evaluatePolicy(
      results,
      { iteration_number: 1, prior_failures: [] },
      {
        profile_id: 'claude-sonnet-4-6.humor_forward.v1',
        selectors: { prompt_family: 'humor_forward' },
        warning_route_revision_threshold: 1,
        metric_gates: {
          score_response_quality: {
            min_overall_score: 0.45,
            min_structure_score: 0.25,
          },
        },
      },
      [],
      {
        answer_text: HUMOR_OPERATIONAL_ANSWER,
        answer_family: 'humor_forward',
      },
    );

    expect(r.decision).toBe('REVISE');
    expect(r.calibration_gate_failures?.map(issue => issue.metric_name)).toContain(
      'fictional_operational_framework',
    );
    expect(r.critique?.failing_routes[0].failure_source).toBe(
      'calibration_policy',
    );
    expect(r.critique?.safer_revision_target).toContain(
      'fictional operational framework',
    );
    expect(r.critique?.max_words).toBe(150);
  });

  it('does not apply the context-switch penalty to a humor-forward answer that stays explicitly non-literal', () => {
    const results: RouteResult[] = [
      {
        tool: 'score_response_quality',
        contract_type: 'quality_contract',
        status: 'PASS',
        result: {
          overall_score: 0.64,
          substance_score: 0.78,
          specificity_score: 0.02,
          hedge_density: 0,
          structure_score: 0.41,
        },
      },
    ];

    const r = evaluatePolicy(
      results,
      { iteration_number: 1, prior_failures: [] },
      {
        profile_id: 'claude-sonnet-4-6.humor_forward.v1',
        selectors: { prompt_family: 'humor_forward' },
        warning_route_revision_threshold: 1,
        metric_gates: {
          score_response_quality: {
            min_overall_score: 0.45,
            min_structure_score: 0.25,
          },
        },
      },
      [],
      {
        answer_text: HUMOR_JOKE_ANSWER,
        answer_family: 'humor_forward',
      },
    );

    expect(r.decision).toBe('PASS');
    expect(r.calibration_gate_failures).toEqual([]);
  });

  it('iteration 2 with a failing route escalates to HUMAN_REVIEW in the unit layer', () => {
    const failure: RouteResult = {
      tool: 'validate_reasoning_chain',
      contract_type: 'reasoning_chain_contract',
      status: 'ENFORCEMENT_FAIL',
      result: {},
      enforcement: {
        blocking_issues: [
          {
            mechanism: 'cycle_detection',
            description: 'Cycle on attempt 2',
            severity: 'blocking',
          },
        ],
        warnings: [],
        corrective_prompt: '',
      },
    };
    const r = evaluatePolicy([failure], {
      iteration_number: 2,
      prior_failures: [
        {
          tool: 'validate_reasoning_chain',
          failure_type: 'cycle_detection',
          blocking_issues: ['Cycle on attempt 1'],
        },
      ],
    });
    expect(r.decision).toBe('HUMAN_REVIEW');
  });

  it('builds a critique packet that includes multiple failing routes on a live orchestrator path', () => {
    const result = runOrchestrator({
      schema_version: 'orchestrator_v0',
      answer_text:
        'We predict the system will handle 10x current traffic by Q4 and we are 95% confident.',
      contracts: {
        confidence: {
          response_text:
            'We predict the system will handle 10x current traffic by Q4 and we are 95% confident.',
          assumptions: [
            {
              description: 'Traffic growth stays smooth',
              confidence: 0.6,
              falsification_condition:
                'Observed growth exceeds plan by 30 percent for two consecutive weeks',
            },
            {
              description: 'Horizontal scaling solves the bottleneck',
              confidence: 0.6,
              falsification_condition:
                'Load test at 5x current traffic shows p99 latency above 500ms for 10 minutes',
            },
          ],
        },
        quality: {
          response_text:
            'Maybe maybe maybe maybe maybe maybe maybe maybe maybe maybe.',
        },
      },
      mode: 'routed',
      review_context: { iteration_number: 1, prior_failures: [] },
    });

    expect(result.policy_decision).toBe('REVISE');
    expect(result.critique).toBeDefined();
    expect(result.critique!.failing_routes.length).toBe(2);
    expect(result.critique!.failing_routes.map(route => route.tool)).toEqual(
      expect.arrayContaining(['validate_confidence', 'score_response_quality']),
    );
  });

  it('passes answer-text context into policy so lenient-profile operational drift is blocked end-to-end', () => {
    const result = runOrchestrator(
      {
        schema_version: 'orchestrator_v0',
        answer_text: HUMOR_OPERATIONAL_ANSWER,
        contracts: {
          quality: {
            response_text: HUMOR_OPERATIONAL_ANSWER,
          },
        },
        mode: 'routed',
        review_context: { iteration_number: 1, prior_failures: [] },
      },
      {
        calibration: {
          model: 'claude-sonnet-4-6',
          prompt_family: 'humor_forward',
          session_mode: 'single_turn',
          profile_id: 'claude-sonnet-4-6.humor_forward.v1',
        },
      },
    );

    expect(result.policy_decision).toBe('REVISE');
    expect(result.calibration?.metric_gate_failures.map(issue => issue.metric_name)).toContain(
      'fictional_operational_framework',
    );
    expect(result.critique?.safer_revision_target).toContain(
      'fictional operational framework',
    );
  });
});
