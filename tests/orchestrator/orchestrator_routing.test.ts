/**
 * Router tests for the experimental orchestrator.
 *
 * The router uses the existing deterministic claim_classifier to suggest
 * tools, then intersects suggestions with the contracts the caller actually
 * supplied. Standard mode runs only that intersection.
 */

import { describe, expect, it } from 'vitest';

import {
  isSchemaFailure,
  routeEnvelope,
  runOrchestrator,
} from '../../src/orchestrator/index.js';
import type {
  OrchestratorEnvelope,
  RouteResult,
} from '../../src/orchestrator/index.js';

const FORECAST_ANSWER =
  'We predict the system will handle 10x our current traffic by Q4. We are 90% confident in this forecast and will scale horizontally.';
const DUCK_Q04_ANSWER =
  '3 outages / 3 trials = 100% accuracy. Weighted average outage score totals 100 and exact error bounds equal 0%.';

function baseEnvelope(
  overrides: Partial<OrchestratorEnvelope> = {},
): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text: FORECAST_ANSWER,
    contracts: {},
    mode: 'routed',
    review_context: { iteration_number: 1, prior_failures: [] },
    ...overrides,
  };
}

const FORECAST_CONFIDENCE_CONTRACT = {
  response_text: FORECAST_ANSWER,
  assumptions: [
    {
      description: 'Horizontal scaling removes the current bottleneck',
      confidence: 0.7,
      falsification_condition: 'Load test at 5x current RPS shows p99 > 500ms for 10 minutes',
    },
    {
      description: 'Team velocity holds through the migration window',
      confidence: 0.7,
      falsification_condition: 'Sprint velocity drops below 70 percent of trailing average for two sprints',
    },
  ],
};

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
    { id: 'e1', label: 'Three prior outage calls were recorded', type: 'evidence' },
    { id: 'c1', label: 'The duck may correlate with outage timing', type: 'claim' },
    { id: 'cn1', label: 'The duck should be treated as a weak signal only', type: 'conclusion' },
  ],
  edges: [
    { from: 'e1', to: 'c1', relation: 'supports' },
    { from: 'c1', to: 'cn1', relation: 'implies' },
  ],
};

const VALID_PLAN_CONTRACT = {
  steps: [
    {
      id: 's1',
      description: 'Provision the new database cluster',
      dependencies: [],
    },
    {
      id: 's2',
      description: 'Migrate application connection strings to the new cluster',
      dependencies: ['s1'],
    },
  ],
};

const ARCHITECTURAL_PLAN_ANSWER =
  'This deploy migration strategy plan uses a blue-green release approach and a staged refactor.';

const SAFETY_ANSWER =
  'Concurrent workers read the shared balance, check whether it is sufficient, update it, and retry failed writes in parallel.';

const CONCURRENCY_CONTRACT = {
  steps: [
    'Read current balance from the shared account',
    'If balance is sufficient, approve the debit',
    'Update balance and publish debit event',
  ],
  shared_resources: ['balance', 'ledger'],
  protections: [],
  delivery_model: 'at_least_once' as const,
  retry_behavior: 'automatic' as const,
};

const DUCK_CONFIDENCE_CONTRACT = {
  response_text: DUCK_Q04_ANSWER,
  assumptions: [
    {
      description: 'Three correct duck predictions are enough to generalize future outage timing',
      confidence: 0.6,
      falsification_condition:
        'On the next 5 production incidents, the duck prediction window misses 2 or more outage starts',
    },
    {
      description: 'The duck signal is stable across different outage classes',
      confidence: 0.5,
      falsification_condition:
        'Prediction precision drops below 80 percent on network or database incidents over the next quarter',
    },
  ],
};

const DUCK_QUALITY_CONTRACT = {
  response_text: DUCK_Q04_ANSWER,
};

describe('routeEnvelope — classifier-driven routing', () => {
  it('classifies forecast-shaped answers and routes validate_confidence when contract is present', () => {
    const routing = routeEnvelope(
      baseEnvelope({
        contracts: { confidence: FORECAST_CONFIDENCE_CONTRACT },
      }),
    );

    expect(routing.primary_type).toBe('forecast');
    expect(routing.routed_tools).toContain('validate_confidence');
  });

  it('drops a routed tool when the classifier suggested it but no contract is supplied', () => {
    const routing = routeEnvelope(
      baseEnvelope({
        // forecast answer but NO contracts
        contracts: {},
      }),
    );

    expect(routing.primary_type).toBe('forecast');
    expect(routing.routed_tools).toEqual([]);
  });

  it('records artifact_compatible_tools for every contract present, regardless of suggestion', () => {
    // architectural/unknown answer, but plan contract is provided
    const routing = routeEnvelope(
      baseEnvelope({
        answer_text:
          'Below is the structured deployment migration plan with five phases.',
        contracts: { plan: VALID_PLAN_CONTRACT },
      }),
    );

    expect(routing.artifact_compatible_tools).toContain('check_plan_validity');
    // plan is present — whether or not it was routed depends on the classifier
  });

  it('uses adjacent deterministic mapping to route check_plan_validity for architectural plan answers', () => {
    const routing = routeEnvelope(
      baseEnvelope({
        answer_text: ARCHITECTURAL_PLAN_ANSWER,
        contracts: { plan: VALID_PLAN_CONTRACT },
      }),
    );

    expect(routing.primary_type).toBe('architectural');
    expect(routing.routed_tools).toContain('check_plan_validity');
  });

  it('uses adjacent deterministic mapping to route detect_concurrency_patterns for safety answers', () => {
    const routing = routeEnvelope(
      baseEnvelope({
        answer_text: SAFETY_ANSWER,
        contracts: { concurrency: CONCURRENCY_CONTRACT },
      }),
    );

    expect(routing.primary_type).toBe('safety');
    expect(routing.routed_tools).toContain('detect_concurrency_patterns');
  });

  it('falls back to all compatible contracts when the classifier yields no orchestrator-routable tool', () => {
    const routing = routeEnvelope(
      baseEnvelope({
        answer_text: DUCK_Q04_ANSWER,
        contracts: {
          confidence: DUCK_CONFIDENCE_CONTRACT,
          reasoning_chain: GOOD_REASONING_CONTRACT,
          quality: DUCK_QUALITY_CONTRACT,
        },
      }),
    );

    expect(routing.primary_type).toBe('arithmetic');
    expect(routing.orchestrator_eligible_tools).toEqual([]);
    expect(routing.routed_tools).toEqual(routing.artifact_compatible_tools);
    expect(routing.routed_tools).toEqual(
      expect.arrayContaining([
        'validate_confidence',
        'validate_reasoning_chain',
        'score_response_quality',
      ]),
    );
  });
});

describe('runOrchestrator — routed mode executes only routed tools', () => {
  it('runs validate_confidence for a forecast answer with a confidence contract', () => {
    const envelope = baseEnvelope({
      contracts: { confidence: FORECAST_CONFIDENCE_CONTRACT },
    });

    const result = runOrchestrator(envelope);

    expect(result.mode).toBe('routed');
    expect(result.telemetry.routed_tools).toContain('validate_confidence');
    expect(result.telemetry.tools_executed).toContain('validate_confidence');

    // tools_executed in routed mode must be a subset of routed_tools
    for (const tool of result.telemetry.tools_executed) {
      expect(result.telemetry.routed_tools).toContain(tool);
    }

    // route_results must contain a real RouteResult (not a SchemaFailure)
    const entry = result.route_results[0];
    expect(isSchemaFailure(entry)).toBe(false);
    const routeResult = entry as RouteResult;
    expect(routeResult.tool).toBe('validate_confidence');
    // validate_confidence output has honest_ceiling
    expect(
      typeof (routeResult.result as { honest_ceiling?: number }).honest_ceiling,
    ).toBe('number');
  });

  it('runs validate_reasoning_chain and detects the cycle', () => {
    const envelope = baseEnvelope({
      answer_text:
        'Our architectural decision is validated because we use a microservice deployment strategy that scales.',
      contracts: { reasoning_chain: CYCLE_REASONING_CONTRACT },
    });

    const result = runOrchestrator(envelope);

    expect(result.telemetry.routed_tools).toContain('validate_reasoning_chain');
    const entry = result.route_results.find(
      r => !isSchemaFailure(r) && (r as RouteResult).tool === 'validate_reasoning_chain',
    );
    expect(entry).toBeDefined();

    const rr = entry as RouteResult;
    expect(rr.status).toBe('ENFORCEMENT_FAIL');

    const toolOutput = rr.result as { cycles?: Array<{ path: string[] }> };
    expect(toolOutput.cycles).toBeDefined();
    expect(toolOutput.cycles!.length).toBeGreaterThan(0);
  });

  it('routed mode does NOT run tools whose contract is present but classifier did not suggest', () => {
    // Forecast answer -> classifier suggests validate_confidence + score_response_quality.
    // A plan contract is also supplied but check_plan_validity is NOT in the suggestion set.
    const envelope = baseEnvelope({
      contracts: {
        confidence: FORECAST_CONFIDENCE_CONTRACT,
        plan: VALID_PLAN_CONTRACT,
      },
    });

    const result = runOrchestrator(envelope);

    expect(result.telemetry.artifact_compatible_tools).toContain('check_plan_validity');
    // In routed mode, check_plan_validity is artifact-compatible but NOT routed,
    // so it must not appear in tools_executed.
    expect(result.telemetry.tools_executed).not.toContain('check_plan_validity');
    expect(result.telemetry.tools_executed_only_in_shadow).toEqual([]);
  });

  it('runs check_plan_validity for an architectural answer with a plan contract', () => {
    const envelope = baseEnvelope({
      answer_text: ARCHITECTURAL_PLAN_ANSWER,
      contracts: { plan: VALID_PLAN_CONTRACT },
    });

    const result = runOrchestrator(envelope);

    expect(result.telemetry.routed_tools).toContain('check_plan_validity');
    const entry = result.route_results.find(
      r => !isSchemaFailure(r) && (r as RouteResult).tool === 'check_plan_validity',
    );
    expect(entry).toBeDefined();

    const rr = entry as RouteResult;
    expect(rr.status).toBe('PASS');
    expect((rr.result as { step_count?: number }).step_count).toBe(2);
  });

  it('runs detect_concurrency_patterns for a safety answer with a concurrency contract', () => {
    const envelope = baseEnvelope({
      answer_text: SAFETY_ANSWER,
      contracts: { concurrency: CONCURRENCY_CONTRACT },
    });

    const result = runOrchestrator(envelope);

    expect(result.telemetry.routed_tools).toContain('detect_concurrency_patterns');
    const entry = result.route_results.find(
      r =>
        !isSchemaFailure(r) &&
        (r as RouteResult).tool === 'detect_concurrency_patterns',
    );
    expect(entry).toBeDefined();

    const rr = entry as RouteResult;
    expect(rr.status).toBe('ENFORCEMENT_FAIL');
    expect((rr.result as { patterns_detected?: string[] }).patterns_detected).toEqual(
      expect.arrayContaining(['check_then_act', 'missing_idempotency']),
    );
  });

  it('does not silently PASS when compatible contracts are present but classifier routing would otherwise be empty', () => {
    const result = runOrchestrator(
      baseEnvelope({
        answer_text: DUCK_Q04_ANSWER,
        contracts: {
          confidence: DUCK_CONFIDENCE_CONTRACT,
          reasoning_chain: GOOD_REASONING_CONTRACT,
          quality: DUCK_QUALITY_CONTRACT,
        },
      }),
    );

    expect(result.telemetry.routed_tools).toEqual(
      expect.arrayContaining([
        'validate_confidence',
        'validate_reasoning_chain',
        'score_response_quality',
      ]),
    );
    expect(result.route_results).toHaveLength(3);
    expect(result.policy_decision).not.toBe('PASS');
  });
});
