import { describe, expect, it } from 'vitest';

import {
  buildTemporalRegistry,
  runOrchestrator,
} from '../../src/orchestrator/index.js';
import type { OrchestratorEnvelope } from '../../src/orchestrator/index.js';

function baseEnvelope(
  overrides: Partial<OrchestratorEnvelope> = {},
): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text: 'Here is the structured reasoning graph.',
    contracts: {},
    mode: 'routed',
    review_context: { iteration_number: 1, prior_failures: [] },
    ...overrides,
  };
}

const PRIOR_REASONING_CONTRACT = {
  nodes: [
    { id: 'a1', label: 'Feature flag is disabled', type: 'assumption' as const },
    { id: 'cn1', label: 'The rollout is live', type: 'conclusion' as const },
  ],
  edges: [{ from: 'a1', to: 'cn1', relation: 'contradicts' as const }],
};

const CURRENT_REASONING_CONTRACT = {
  nodes: [
    { id: 'e1', label: 'Traffic logs show live requests', type: 'evidence' as const },
    { id: 'c1', label: 'The rollout is live', type: 'claim' as const },
    { id: 'cn1', label: 'The rollout is live', type: 'conclusion' as const },
  ],
  edges: [
    { from: 'e1', to: 'c1', relation: 'supports' as const },
    { from: 'c1', to: 'cn1', relation: 'implies' as const },
  ],
};

describe('temporal reasoning registry', () => {
  it('does not fail the current graph when no prior registry is supplied', () => {
    const result = runOrchestrator(
      baseEnvelope({
        contracts: {
          reasoning_chain: CURRENT_REASONING_CONTRACT,
        },
      }),
    );

    expect(result.policy_decision).toBe('PASS');
    const route = result.route_results[0];
    expect(route.status).toBe('PASS');
  });

  it('catches a contradiction when a prior registry is merged into the current graph', () => {
    const priorRegistry = buildTemporalRegistry(PRIOR_REASONING_CONTRACT);

    const result = runOrchestrator(
      baseEnvelope({
        contracts: {
          reasoning_chain: CURRENT_REASONING_CONTRACT,
        },
      }),
      {
        temporal: {
          reasoning_registry: priorRegistry,
        },
      },
    );

    expect(result.policy_decision).toBe('REVISE');
    const route = result.route_results[0];
    expect(route.status).toBe('ENFORCEMENT_FAIL');
    if ('result' in route && route.result && typeof route.result === 'object') {
      expect(route.result).toMatchObject({
        contradiction_violations: expect.arrayContaining([
          expect.objectContaining({
            source_label: 'Feature flag is disabled',
            target_label: 'The rollout is live',
          }),
        ]),
      });
    }
    expect(result.temporal_registry?.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Feature flag is disabled', type: 'assumption' }),
        expect.objectContaining({ label: 'Traffic logs show live requests', type: 'evidence' }),
        expect.objectContaining({ label: 'The rollout is live', type: 'conclusion' }),
      ]),
    );
  });
});
