import { describe, expect, it } from 'vitest';

import {
  buildCrossToolContext,
  runOrchestrator,
} from '../../src/orchestrator/index.js';
import type { OrchestratorEnvelope } from '../../src/orchestrator/index.js';

function baseEnvelope(
  overrides: Partial<OrchestratorEnvelope> = {},
): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text: 'This is the proposed plan and capacity model.',
    contracts: {},
    mode: 'routed',
    review_context: { iteration_number: 1, prior_failures: [] },
    ...overrides,
  };
}

describe('cross-tool variable binder', () => {
  it("extracts explicit concurrency variables and catches Little's Law overflow", () => {
    const envelope = baseEnvelope({
      contracts: {
        concurrency: {
          steps: ['Accept request', 'Process request', 'Return response'],
          protections: ['queue'],
          capacity_model: {
            throughput_per_sec: 1000,
            mean_latency_sec: 5,
            capacity_slots: 500,
          },
        },
      },
    });

    const context = buildCrossToolContext(envelope);

    expect(context.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'throughput_per_sec', value: 1000 }),
        expect.objectContaining({ name: 'mean_latency_sec', value: 5 }),
        expect.objectContaining({ name: 'capacity_slots', value: 500 }),
      ]),
    );
    expect(context.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          invariant_id: 'littles_law_capacity',
          severity: 'blocking',
        }),
      ]),
    );
  });

  it('catches retry windows that exceed the stated SLA', () => {
    const envelope = baseEnvelope({
      contracts: {
        concurrency: {
          steps: ['Attempt request', 'Retry failed request'],
          protections: ['idempotency_key'],
          capacity_model: {
            retry_count: 5,
            timeout_sec: 2,
            sla_sec: 8,
          },
        },
      },
    });

    const context = buildCrossToolContext(envelope);

    expect(context.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          invariant_id: 'retry_window_within_sla',
          severity: 'blocking',
        }),
      ]),
    );
  });

  it('catches plan durations that overflow a stated time budget', () => {
    const envelope = baseEnvelope({
      contracts: {
        plan: {
          time_budget_hours: 24,
          steps: [
            { id: 'sleep', description: 'Sleep', dependencies: [], duration_hours: 8 },
            { id: 'eat', description: 'Eat', dependencies: [], duration_hours: 2 },
            { id: 'exercise', description: 'Exercise', dependencies: [], duration_hours: 1 },
            { id: 'work', description: 'Work', dependencies: [], duration_hours: 10 },
            { id: 'family', description: 'Family time', dependencies: [], duration_hours: 2 },
            { id: 'projects', description: 'AI projects', dependencies: [], duration_hours: 3 },
          ],
        },
      },
    });

    const context = buildCrossToolContext(envelope);

    expect(context.bindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'time_budget_hours', value: 24 }),
        expect.objectContaining({ name: 'plan.total_duration_hours', value: 26 }),
      ]),
    );
    expect(context.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          invariant_id: 'plan_time_budget',
          severity: 'blocking',
        }),
      ]),
    );
  });

  it('feeds blocking cross-tool violations into policy decisions', () => {
    const result = runOrchestrator(
      baseEnvelope({
        contracts: {
          concurrency: {
            steps: ['Accept request', 'Process request', 'Return response'],
            protections: ['queue'],
            capacity_model: {
              throughput_per_sec: 1000,
              mean_latency_sec: 5,
              capacity_slots: 500,
            },
          },
        },
      }),
    );

    expect(result.policy_decision).toBe('REVISE');
    expect(result.cross_tool_context?.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ invariant_id: 'littles_law_capacity' }),
      ]),
    );
    expect(result.critique?.failing_routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: '__cross_tool__',
          failure_source: 'cross_tool_invariant',
        }),
      ]),
    );
  });

  it('escalates blocking cross-tool violations to HUMAN_REVIEW on iteration 2', () => {
    const result = runOrchestrator(
      baseEnvelope({
        review_context: {
          iteration_number: 2,
          prior_failures: [],
        },
        contracts: {
          concurrency: {
            steps: ['Attempt request', 'Retry failed request'],
            protections: ['idempotency_key'],
            capacity_model: {
              retry_count: 5,
              timeout_sec: 2,
              sla_sec: 8,
            },
          },
        },
      }),
    );

    expect(result.policy_decision).toBe('HUMAN_REVIEW');
    expect(result.cross_tool_context?.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ invariant_id: 'retry_window_within_sla' }),
      ]),
    );
  });
});
