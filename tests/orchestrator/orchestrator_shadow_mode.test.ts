/**
 * Shadow mode tests.
 *
 * Shadow mode runs every artifact-compatible tool observationally, but MUST
 * never change the routed-mode decision. Its job is to surface what routed
 * mode would have missed so that routing calibration can improve over time.
 */

import { describe, expect, it } from 'vitest';

import { runOrchestrator } from '../../src/orchestrator/index.js';
import type { OrchestratorEnvelope } from '../../src/orchestrator/index.js';

// Note: claimed_confidence (60%) must stay below the assumption product so that
// validate_confidence PASSes cleanly in routed mode. The whole point of these
// tests is to verify that shadow-only failures do NOT escalate the routed
// decision — so the routed tool must not fail on its own.
const FORECAST_ANSWER =
  'We predict the system will handle 50,000 concurrent users by Q3. We are 60% confident in this forecast, based on load test results showing p99 latency under 200ms at 30,000 users.';

const GOOD_CONFIDENCE_CONTRACT = {
  response_text: FORECAST_ANSWER,
  assumptions: [
    {
      description: 'Load test at 30k users extrapolates to 50k users',
      confidence: 0.9,
      falsification_condition:
        'Staging load test at 50k users shows non-linear p99 latency degradation over 400ms',
    },
    {
      description: 'Auto-scaling provisions capacity within 60 seconds',
      confidence: 0.9,
      falsification_condition:
        'Synthetic spike test exceeds 90 seconds before new instances become healthy',
    },
  ],
};

const PLAN_WITH_MISSING_PREREQ = {
  steps: [
    {
      id: 'p1',
      description: 'Run 40k and 50k load tests in staging',
      dependencies: ['p_missing_capacity_baseline'],
    },
    {
      id: 'p2',
      description: 'Configure auto-scaling policies',
      dependencies: ['p1'],
    },
  ],
};

const GOOD_PLAN = {
  steps: [
    {
      id: 'p1',
      description: 'Provision new cluster',
      dependencies: [],
    },
    {
      id: 'p2',
      description: 'Migrate connection strings',
      dependencies: ['p1'],
    },
  ],
};

const PLAN_WITH_RESOURCE_WARNING = {
  steps: [
    {
      id: 'p1',
      description: 'Update the shared release checklist',
      dependencies: [],
      resources: ['release-checklist'],
    },
    {
      id: 'p2',
      description: 'Revise the shared release checklist for rollback steps',
      dependencies: [],
      resources: ['release-checklist'],
    },
  ],
};

const LOW_GROUNDING_REASONING = {
  nodes: [
    { id: 'a1', label: 'The traffic spike pattern will repeat', type: 'assumption' },
    { id: 'c1', label: 'Capacity will stay sufficient', type: 'claim' },
    { id: 'cn1', label: 'The launch is safe to proceed', type: 'conclusion' },
  ],
  edges: [
    { from: 'a1', to: 'c1', relation: 'supports' },
    { from: 'c1', to: 'cn1', relation: 'implies' },
  ],
};

function mixedEnvelope(
  mode: 'routed' | 'shadow',
  planContract: unknown = GOOD_PLAN,
): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text: FORECAST_ANSWER,
    contracts: {
      confidence: GOOD_CONFIDENCE_CONTRACT,
      plan: planContract,
    },
    mode,
    review_context: { iteration_number: 1, prior_failures: [] },
  };
}

describe('shadow mode — runs extra artifact-compatible tools', () => {
  it('executes check_plan_validity when a plan contract is present but the classifier did not route it', () => {
    const result = runOrchestrator(mixedEnvelope('shadow'));

    // The plan contract is present → artifact_compatible includes check_plan_validity.
    expect(result.telemetry.artifact_compatible_tools).toContain('check_plan_validity');

    // validate_confidence is routed (forecast classifier).
    expect(result.telemetry.routed_tools).toContain('validate_confidence');

    // check_plan_validity is NOT routed (classifier did not suggest it),
    // but it IS executed in shadow mode.
    expect(result.telemetry.routed_tools).not.toContain('check_plan_validity');
    expect(result.telemetry.tools_executed_only_in_shadow).toContain(
      'check_plan_validity',
    );
    expect(result.telemetry.tools_executed).toContain('check_plan_validity');
  });

  it('records shadow_only_findings when a shadow tool returns ENFORCEMENT_FAIL', () => {
    const result = runOrchestrator(
      mixedEnvelope('shadow', PLAN_WITH_MISSING_PREREQ),
    );

    expect(result.telemetry.shadow_only_findings.length).toBeGreaterThan(0);
    const finding = result.telemetry.shadow_only_findings.find(
      f => f.tool === 'check_plan_validity',
    );
    expect(finding).toBeDefined();
    expect(finding!.status).toBe('ENFORCEMENT_FAIL');
    expect(finding!.summary).toContain('missing_prerequisite');
  });

  it('would_have_escalated is true when a shadow-only finding is ENFORCEMENT_FAIL', () => {
    const result = runOrchestrator(
      mixedEnvelope('shadow', PLAN_WITH_MISSING_PREREQ),
    );
    expect(result.telemetry.would_have_escalated).toBe(true);
  });
});

describe('shadow mode — does NOT change the routed decision', () => {
  it('routed policy decision ignores shadow-only failures', () => {
    const result = runOrchestrator(
      mixedEnvelope('shadow', PLAN_WITH_MISSING_PREREQ),
    );

    // routed tool (validate_confidence) should pass or warn, since the
    // confidence contract is clean. Shadow failure on the plan contract
    // must NOT escalate the policy decision.
    expect(['PASS', 'WARN']).toContain(result.policy_decision);
    expect(result.policy_decision).not.toBe('REVISE');
    expect(result.policy_decision).not.toBe('HUMAN_REVIEW');
  });

  it('routed-mode run with the same envelope has no shadow-only findings', () => {
    const result = runOrchestrator(
      mixedEnvelope('routed', PLAN_WITH_MISSING_PREREQ),
    );

    expect(result.mode).toBe('routed');
    expect(result.telemetry.shadow_only_findings).toEqual([]);
    expect(result.telemetry.tools_executed_only_in_shadow).toEqual([]);
    expect(result.telemetry.would_have_escalated).toBe(false);
    // check_plan_validity must not have executed
    expect(result.telemetry.tools_executed).not.toContain('check_plan_validity');
  });

  it('routed mode and shadow mode agree on routed_tools but differ on tools_executed', () => {
    const routed = runOrchestrator(mixedEnvelope('routed', PLAN_WITH_MISSING_PREREQ));
    const shadow = runOrchestrator(mixedEnvelope('shadow', PLAN_WITH_MISSING_PREREQ));

    expect(routed.telemetry.routed_tools).toEqual(shadow.telemetry.routed_tools);
    // Shadow mode executes strictly more tools than routed mode here.
    expect(shadow.telemetry.tools_executed.length).toBeGreaterThan(
      routed.telemetry.tools_executed.length,
    );
    // And the routed decision is the same — shadow does not mutate it.
    expect(shadow.policy_decision).toBe(routed.policy_decision);
  });
});

describe('shadow mode — warning clusters are visible in telemetry', () => {
  it('marks would_have_escalated true when shadow-only warnings cross the revision threshold', () => {
    const result = runOrchestrator({
      schema_version: 'orchestrator_v0',
      answer_text: FORECAST_ANSWER,
      contracts: {
        confidence: GOOD_CONFIDENCE_CONTRACT,
        plan: PLAN_WITH_RESOURCE_WARNING,
        reasoning_chain: LOW_GROUNDING_REASONING,
      },
      mode: 'shadow',
      review_context: { iteration_number: 1, prior_failures: [] },
    });

    expect(result.policy_decision).toBe('PASS');
    expect(result.telemetry.tools_executed_only_in_shadow).toEqual(
      expect.arrayContaining(['check_plan_validity', 'validate_reasoning_chain']),
    );
    expect(result.telemetry.shadow_only_findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: 'check_plan_validity',
          status: 'WARN',
        }),
        expect.objectContaining({
          tool: 'validate_reasoning_chain',
          status: 'WARN',
        }),
      ]),
    );
    expect(result.telemetry.would_have_escalated).toBe(true);
  });
});

describe('shadow mode — schema failures are observed but do not break routed decision', () => {
  it('schema-invalid shadow contract is recorded in telemetry.schema_failures without affecting routed decision', () => {
    const envelope = mixedEnvelope('shadow', {
      // plan contract missing required field `description` on a step
      steps: [
        { id: 'p1', dependencies: [] },
        { id: 'p2', dependencies: ['p1'] },
      ],
    });

    const result = runOrchestrator(envelope);

    // routed confidence tool should still drive the decision — not HUMAN_REVIEW
    expect(['PASS', 'WARN']).toContain(result.policy_decision);

    const schemaFailureTools = result.telemetry.schema_failures.map(
      f => f.tool,
    );
    expect(schemaFailureTools).toContain('check_plan_validity');
  });
});
