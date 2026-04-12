/**
 * phalanx_envelope.test.ts
 *
 * Tests for the Phalanx integration envelope (Slice 1).
 * All tool invocations use mock ToolInvoker — no real MCP server spun up.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  buildMechanismVersions,
  computeObjectionId,
  invokePhalanxContract,
  mapToolResultToObjections,
  PhalanxContractInputError,
  verdictFromObjections,
} from '../../src/integration/phalanx/index.js';
import { transportFailureVerdict } from '../../src/integration/phalanx/failure.js';
import type { PhalanxCtCall, ToolInvoker } from '../../src/integration/phalanx/index.js';
import { SERVER_INFO } from '../../src/server-runtime.js';

// ====== Helpers ======

function makeCall(overrides: Partial<PhalanxCtCall> = {}): PhalanxCtCall {
  return {
    call_id: 'test-call-001',
    phase: 'planning',
    piece_id: null,
    run_id: 'run-abc',
    payload: {
      assumptions: {
        assumptions: [
          {
            description: 'API latency is acceptable',
            confidence: 0.85,
            falsification_condition: 'p99 > 200ms for 1% of requests',
          },
        ],
        response_text: 'The system will perform within acceptable bounds under normal load.',
      },
    },
    ...overrides,
  };
}

const PASS_TOOL_RESULT = {
  status: 'PASS' as const,
  honest_ceiling: 0.85,
  claimed_confidence: null,
  gap: 0,
  inflation_detected: false,
  dependency_weights: [1],
  falsifiability: { score: 1, passes: true, unfalsifiable: [] },
  assumption_count: 1,
  context_used: false,
};

const BLOCK_TOOL_RESULT = {
  status: 'ENFORCEMENT_FAIL' as const,
  honest_ceiling: 0.4,
  claimed_confidence: 0.9,
  gap: 0.5,
  inflation_detected: true,
  dependency_weights: [1],
  falsifiability: { score: 0.5, passes: false, unfalsifiable: [] },
  assumption_count: 1,
  context_used: false,
  enforcement: {
    blocking_issues: [
      {
        mechanism: 'confidence_product',
        description: 'Inflation detected — claimed confidence exceeds honest ceiling by 0.500.',
        severity: 'blocking' as const,
      },
    ],
    warnings: [],
    corrective_prompt: 'Reduce claimed confidence.',
  },
};

const WARN_TOOL_RESULT = {
  status: 'PASS' as const,
  honest_ceiling: 0.7,
  claimed_confidence: null,
  gap: 0,
  inflation_detected: false,
  dependency_weights: [1],
  falsifiability: { score: 0.4, passes: false, unfalsifiable: ['condition1'] },
  assumption_count: 1,
  context_used: false,
  enforcement: {
    blocking_issues: [],
    warnings: ['Falsifiability score: 0.40. Unfalsifiable conditions: condition1.'],
    corrective_prompt: '',
  },
};

// ====== PASS path ======

describe('PASS path', () => {
  it('returns PASS verdict with empty objections when tool returns PASS with no enforcement', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(PASS_TOOL_RESULT);
    const call = makeCall();

    const verdict = await invokePhalanxContract(call, invoker);

    expect(verdict.verdict).toBe('PASS');
    expect(verdict.call_id).toBe('test-call-001');
    expect(verdict.objections).toHaveLength(0);
    expect(typeof verdict.elapsed_ms).toBe('number');
    expect(verdict.elapsed_ms).toBeGreaterThanOrEqual(0);
  });

  it('populates mechanism_versions for the invoked tool', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(PASS_TOOL_RESULT);
    const call = makeCall();

    const verdict = await invokePhalanxContract(call, invoker);

    expect(verdict.mechanism_versions).toHaveProperty('validate_confidence');
    expect(verdict.mechanism_versions['validate_confidence']).toBe(SERVER_INFO.version);
  });

  it('invokes validate_confidence with the correct args', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(PASS_TOOL_RESULT);
    const call = makeCall();

    await invokePhalanxContract(call, invoker);

    expect(invoker).toHaveBeenCalledWith(
      'validate_confidence',
      expect.objectContaining({
        assumptions: call.payload.assumptions!.assumptions,
        response_text: call.payload.assumptions!.response_text,
      }),
    );
  });
});

// ====== BLOCK path ======

describe('BLOCK path', () => {
  it('returns BLOCK verdict with one blocking objection when tool returns ENFORCEMENT_FAIL', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(BLOCK_TOOL_RESULT);
    const call = makeCall();

    const verdict = await invokePhalanxContract(call, invoker);

    expect(verdict.verdict).toBe('BLOCK');
    expect(verdict.objections).toHaveLength(1);
    expect(verdict.objections[0].severity).toBe('blocking');
    expect(verdict.objections[0].mechanism).toBe('confidence_product');
  });

  it('objection message matches raw blocking issue description', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(BLOCK_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall(), invoker);

    expect(verdict.objections[0].message).toContain('Inflation detected');
  });
});

// ====== WARN-only path ======

describe('WARN-only path', () => {
  it('returns WARN verdict when tool passes but has warnings', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(WARN_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall(), invoker);

    expect(verdict.verdict).toBe('WARN');
    expect(verdict.objections.length).toBeGreaterThan(0);
    expect(verdict.objections.every(o => o.severity !== 'blocking')).toBe(true);
  });

  it('ENFORCEMENT_FAIL with only warnings (no blocking_issues) → WARN verdict', async () => {
    const warnOnlyFail = {
      status: 'ENFORCEMENT_FAIL' as const,
      enforcement: {
        blocking_issues: [],
        warnings: ['Low falsifiability score.'],
        corrective_prompt: '',
      },
    };
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(warnOnlyFail);
    const verdict = await invokePhalanxContract(makeCall(), invoker);

    expect(verdict.verdict).toBe('WARN');
  });
});

// ====== Transport failure path ======

describe('transport failure path', () => {
  it('returns WARN verdict and does not throw when toolInvoker throws', async () => {
    const invoker: ToolInvoker = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const call = makeCall();

    await expect(invokePhalanxContract(call, invoker)).resolves.toBeDefined();

    const verdict = await invokePhalanxContract(call, invoker);
    expect(verdict.verdict).toBe('WARN');
    expect(verdict.call_id).toBe(call.call_id);
  });

  it('transport failure objection has mechanism phalanx_ct_mcp_transport', async () => {
    const invoker: ToolInvoker = vi.fn().mockRejectedValue(new TypeError('Network error'));
    const verdict = await invokePhalanxContract(makeCall(), invoker);

    expect(verdict.objections).toHaveLength(1);
    expect(verdict.objections[0].mechanism).toBe('phalanx_ct_mcp_transport');
    expect(verdict.objections[0].severity).toBe('warning');
  });

  it('transportFailureVerdict directly encodes error_kind and error_message in evidence', () => {
    const call = makeCall();
    const err = new TypeError('socket hang up');
    const result = transportFailureVerdict(call, err, 42);

    expect(result.verdict).toBe('WARN');
    expect(result.elapsed_ms).toBe(42);
    expect(result.objections[0].evidence).toMatchObject({
      error_kind: 'TypeError',
      error_message: 'socket hang up',
    });
  });
});

// ====== Malformed input path ======

describe('malformed input path', () => {
  it('throws PhalanxContractInputError on non-object input', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(invokePhalanxContract('not an object', invoker)).rejects.toBeInstanceOf(
      PhalanxContractInputError,
    );
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws PhalanxContractInputError when call_id is missing', async () => {
    const invoker: ToolInvoker = vi.fn();
    const bad = { phase: 'planning', piece_id: null, run_id: 'r', payload: { assumptions: {} } };
    await expect(invokePhalanxContract(bad, invoker)).rejects.toBeInstanceOf(
      PhalanxContractInputError,
    );
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws PhalanxContractInputError when phase is invalid', async () => {
    const invoker: ToolInvoker = vi.fn();
    const bad = { call_id: 'x', phase: 'nonexistent', piece_id: null, run_id: 'r', payload: {} };
    await expect(invokePhalanxContract(bad, invoker)).rejects.toBeInstanceOf(
      PhalanxContractInputError,
    );
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws PhalanxContractInputError when payload has none of the four sub-payloads', async () => {
    const invoker: ToolInvoker = vi.fn();
    const bad = {
      call_id: 'x',
      phase: 'planning',
      piece_id: null,
      run_id: 'r',
      payload: {},
    };
    await expect(invokePhalanxContract(bad, invoker)).rejects.toBeInstanceOf(
      PhalanxContractInputError,
    );
    expect(invoker).not.toHaveBeenCalled();
  });
});

// ====== Deterministic objection_id ======

describe('deterministic objection_id', () => {
  it('same inputs always produce the same objection_id', () => {
    const id1 = computeObjectionId('call-1', 'validate_confidence', 'confidence_product', 'Inflation detected');
    const id2 = computeObjectionId('call-1', 'validate_confidence', 'confidence_product', 'Inflation detected');
    expect(id1).toBe(id2);
  });

  it('objection_id is exactly 32 hex characters', () => {
    const id = computeObjectionId('call-1', 'tool', 'mechanism', 'message');
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('different mechanism yields different objection_id', () => {
    const id1 = computeObjectionId('call-1', 'tool', 'mech_a', 'msg');
    const id2 = computeObjectionId('call-1', 'tool', 'mech_b', 'msg');
    expect(id1).not.toBe(id2);
  });

  it('different call_id yields different objection_id', () => {
    const id1 = computeObjectionId('call-1', 'tool', 'mech', 'msg');
    const id2 = computeObjectionId('call-2', 'tool', 'mech', 'msg');
    expect(id1).not.toBe(id2);
  });

  it('objection_id from mapToolResultToObjections is stable across calls', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(BLOCK_TOOL_RESULT);
    const call = makeCall();

    const v1 = await invokePhalanxContract(call, invoker);
    const v2 = await invokePhalanxContract(call, invoker);

    expect(v1.objections[0].objection_id).toBe(v2.objections[0].objection_id);
  });
});

// ====== Merged call: both assumptions and claims ======

describe('merged call', () => {
  const callWithBoth = makeCall({
    payload: {
      assumptions: {
        assumptions: [
          {
            description: 'Service will respond',
            confidence: 0.9,
            falsification_condition: 'Service times out',
          },
        ],
        response_text: 'The service will respond within SLA bounds.',
      },
      claims: {
        nodes: [
          { id: 'e1', label: 'Benchmark shows p99 < 100ms', type: 'evidence' },
          { id: 'c1', label: 'Latency is acceptable', type: 'claim' },
          { id: 'cn1', label: 'Deploy the service', type: 'conclusion' },
        ],
        edges: [
          { from: 'e1', to: 'c1', relation: 'supports' },
          { from: 'c1', to: 'cn1', relation: 'implies' },
        ],
      },
    },
  });

  it('invokes both validate_confidence and validate_reasoning_chain', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(PASS_TOOL_RESULT);
    await invokePhalanxContract(callWithBoth, invoker);

    const calledTools = (invoker as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(calledTools).toContain('validate_confidence');
    expect(calledTools).toContain('validate_reasoning_chain');
  });

  it('mechanism_versions contains both invoked tools', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(PASS_TOOL_RESULT);
    const verdict = await invokePhalanxContract(callWithBoth, invoker);

    expect(verdict.mechanism_versions).toHaveProperty('validate_confidence');
    expect(verdict.mechanism_versions).toHaveProperty('validate_reasoning_chain');
  });

  it('merges objections from both tools and takes worst verdict', async () => {
    // confidence passes, reasoning chain blocks
    const reasoningBlockResult = {
      status: 'ENFORCEMENT_FAIL' as const,
      enforcement: {
        blocking_issues: [
          {
            mechanism: 'cycle_detection',
            description: 'Found 1 circular reasoning cycle.',
            severity: 'blocking' as const,
          },
        ],
        warnings: [],
        corrective_prompt: '',
      },
    };

    const invoker: ToolInvoker = vi.fn()
      .mockResolvedValueOnce(PASS_TOOL_RESULT)      // validate_confidence → PASS
      .mockResolvedValueOnce(reasoningBlockResult);  // validate_reasoning_chain → BLOCK

    const verdict = await invokePhalanxContract(callWithBoth, invoker);

    expect(verdict.verdict).toBe('BLOCK');
    expect(verdict.objections.some(o => o.mechanism === 'cycle_detection')).toBe(true);
  });
});

// ====== mechanism_versions ======

describe('mechanism_versions', () => {
  it('only contains tools that were actually invoked', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(PASS_TOOL_RESULT);
    // Only assumptions in payload → only validate_confidence invoked
    const call = makeCall();
    const verdict = await invokePhalanxContract(call, invoker);

    expect(Object.keys(verdict.mechanism_versions)).toEqual(['validate_confidence']);
  });

  it('all versions are pinned to SERVER_INFO.version', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(PASS_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall(), invoker);

    for (const v of Object.values(verdict.mechanism_versions)) {
      expect(v).toBe(SERVER_INFO.version);
    }
  });

  it('buildMechanismVersions respects per-tool overrides (future-proof)', () => {
    const versions = buildMechanismVersions(
      ['validate_confidence', 'validate_reasoning_chain'],
      { validate_confidence: '0.2.0-rc.1' },
    );
    expect(versions['validate_confidence']).toBe('0.2.0-rc.1');
    expect(versions['validate_reasoning_chain']).toBe(SERVER_INFO.version);
  });
});

// ====== verdictFromObjections unit ======

describe('verdictFromObjections', () => {
  it('returns PASS for empty array', () => {
    expect(verdictFromObjections([])).toBe('PASS');
  });

  it('returns WARN for warning-only objections', () => {
    const obj = {
      objection_id: 'aaa',
      mechanism: 'x',
      severity: 'warning' as const,
      message: 'w',
      evidence: {},
    };
    expect(verdictFromObjections([obj])).toBe('WARN');
  });

  it('returns BLOCK when any objection is blocking', () => {
    const blocking = {
      objection_id: 'bbb',
      mechanism: 'y',
      severity: 'blocking' as const,
      message: 'b',
      evidence: {},
    };
    const warning = {
      objection_id: 'ccc',
      mechanism: 'z',
      severity: 'warning' as const,
      message: 'w',
      evidence: {},
    };
    expect(verdictFromObjections([warning, blocking])).toBe('BLOCK');
  });
});

// ====== mapToolResultToObjections unit ======

describe('mapToolResultToObjections', () => {
  it('returns empty array for PASS with no enforcement', () => {
    const result = mapToolResultToObjections('validate_confidence', PASS_TOOL_RESULT, 'call-1');
    expect(result).toHaveLength(0);
  });

  it('returns blocking objection for ENFORCEMENT_FAIL with blocking_issues', () => {
    const result = mapToolResultToObjections('validate_confidence', BLOCK_TOOL_RESULT, 'call-1');
    expect(result.some(o => o.severity === 'blocking')).toBe(true);
  });

  it('returns warning objection for warnings', () => {
    const result = mapToolResultToObjections('validate_confidence', WARN_TOOL_RESULT, 'call-1');
    expect(result.some(o => o.severity === 'warning')).toBe(true);
  });

  it('handles non-object raw gracefully (returns empty)', () => {
    const result = mapToolResultToObjections('tool', null, 'call-1');
    expect(result).toHaveLength(0);
  });
});

// ====== steps dispatch ======

const STEPS_PASS_TOOL_RESULT = {
  status: 'PASS' as const,
  circular_dependencies: [],
  missing_prerequisites: [],
  resource_conflicts: [],
  completeness_score: 1,
  critical_path: ['s1', 's2'],
};

const STEPS_BLOCK_TOOL_RESULT = {
  status: 'ENFORCEMENT_FAIL' as const,
  enforcement: {
    blocking_issues: [
      {
        mechanism: 'circular_dependency',
        description: 'Circular dependency detected: s1 -> s2 -> s1',
        severity: 'blocking' as const,
      },
    ],
    warnings: [],
    corrective_prompt: 'Remove the cycle.',
  },
};

const VALID_STEPS_PAYLOAD = {
  steps: [
    { id: 's1', description: 'Initialize DB', dependencies: [] },
    { id: 's2', description: 'Run migrations', dependencies: ['s1'] },
  ],
};

describe('steps dispatch', () => {
  it('invokes check_plan_validity with the correct args', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(STEPS_PASS_TOOL_RESULT);
    const call = makeCall({ payload: { steps: VALID_STEPS_PAYLOAD } });

    await invokePhalanxContract(call, invoker);

    expect(invoker).toHaveBeenCalledWith(
      'check_plan_validity',
      expect.objectContaining({ steps: VALID_STEPS_PAYLOAD.steps }),
    );
  });

  it('returns PASS verdict when check_plan_validity returns PASS', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(STEPS_PASS_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall({ payload: { steps: VALID_STEPS_PAYLOAD } }), invoker);

    expect(verdict.verdict).toBe('PASS');
    expect(verdict.objections).toHaveLength(0);
  });

  it('returns BLOCK verdict when check_plan_validity returns ENFORCEMENT_FAIL', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(STEPS_BLOCK_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall({ payload: { steps: VALID_STEPS_PAYLOAD } }), invoker);

    expect(verdict.verdict).toBe('BLOCK');
    expect(verdict.objections.some(o => o.mechanism === 'circular_dependency')).toBe(true);
  });

  it('mechanism_versions contains check_plan_validity when steps dispatched', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(STEPS_PASS_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall({ payload: { steps: VALID_STEPS_PAYLOAD } }), invoker);

    expect(verdict.mechanism_versions).toHaveProperty('check_plan_validity');
  });
});

// ====== operations dispatch ======

const OPS_PASS_TOOL_RESULT = {
  status: 'PASS' as const,
  patterns_detected: [],
  hazard_count: 0,
};

const OPS_BLOCK_TOOL_RESULT = {
  status: 'ENFORCEMENT_FAIL' as const,
  enforcement: {
    blocking_issues: [
      {
        mechanism: 'check_then_act',
        description: 'Check-then-act pattern detected.',
        severity: 'blocking' as const,
      },
    ],
    warnings: [],
    corrective_prompt: 'Use atomic compare-and-swap.',
  },
};

const VALID_OPERATIONS_PAYLOAD = {
  steps: ['Read balance', 'Check balance >= cost', 'Write balance'],
  shared_resources: ['balance'],
  protections: [],
};

describe('operations dispatch', () => {
  it('invokes detect_concurrency_patterns with the correct args', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(OPS_PASS_TOOL_RESULT);
    const call = makeCall({ payload: { operations: VALID_OPERATIONS_PAYLOAD } });

    await invokePhalanxContract(call, invoker);

    expect(invoker).toHaveBeenCalledWith(
      'detect_concurrency_patterns',
      expect.objectContaining({
        steps: VALID_OPERATIONS_PAYLOAD.steps,
        shared_resources: VALID_OPERATIONS_PAYLOAD.shared_resources,
        protections: VALID_OPERATIONS_PAYLOAD.protections,
      }),
    );
  });

  it('returns PASS verdict when detect_concurrency_patterns returns PASS', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(OPS_PASS_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall({ payload: { operations: VALID_OPERATIONS_PAYLOAD } }), invoker);

    expect(verdict.verdict).toBe('PASS');
    expect(verdict.objections).toHaveLength(0);
  });

  it('returns BLOCK verdict when detect_concurrency_patterns returns ENFORCEMENT_FAIL', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(OPS_BLOCK_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall({ payload: { operations: VALID_OPERATIONS_PAYLOAD } }), invoker);

    expect(verdict.verdict).toBe('BLOCK');
    expect(verdict.objections.some(o => o.mechanism === 'check_then_act')).toBe(true);
  });

  it('forwards optional fields (delivery_model, retry_behavior) when present', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(OPS_PASS_TOOL_RESULT);
    const payload = {
      operations: {
        steps: ['op1', 'op2'],
        delivery_model: 'at_least_once' as const,
        retry_behavior: 'automatic' as const,
      },
    };

    await invokePhalanxContract(makeCall({ payload }), invoker);

    expect(invoker).toHaveBeenCalledWith(
      'detect_concurrency_patterns',
      expect.objectContaining({
        delivery_model: 'at_least_once',
        retry_behavior: 'automatic',
      }),
    );
  });

  it('mechanism_versions contains detect_concurrency_patterns when operations dispatched', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(OPS_PASS_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall({ payload: { operations: VALID_OPERATIONS_PAYLOAD } }), invoker);

    expect(verdict.mechanism_versions).toHaveProperty('detect_concurrency_patterns');
  });
});

// ====== All four sub-payloads ======

describe('all four sub-payloads present', () => {
  const allFourPayload = {
    assumptions: {
      assumptions: [{ description: 'Service is up', confidence: 0.9 }],
      response_text: 'All systems go.',
    },
    claims: {
      nodes: [
        { id: 'n1', label: 'Evidence', type: 'evidence' as const },
        { id: 'n2', label: 'Claim', type: 'claim' as const },
      ],
      edges: [{ from: 'n1', to: 'n2', relation: 'supports' as const }],
    },
    steps: {
      steps: [
        { id: 's1', description: 'Step 1', dependencies: [] },
        { id: 's2', description: 'Step 2', dependencies: ['s1'] },
      ],
    },
    operations: {
      steps: ['Read', 'Write'],
      shared_resources: ['db'],
    },
  };

  it('invokes all four tools when all sub-payloads are present', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(STEPS_PASS_TOOL_RESULT);
    await invokePhalanxContract(makeCall({ payload: allFourPayload }), invoker);

    const calledTools = (invoker as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(calledTools).toContain('validate_confidence');
    expect(calledTools).toContain('validate_reasoning_chain');
    expect(calledTools).toContain('check_plan_validity');
    expect(calledTools).toContain('detect_concurrency_patterns');
    expect(calledTools).toHaveLength(4);
  });

  it('verdict is worst-severity across all four tools', async () => {
    const invoker: ToolInvoker = vi.fn()
      .mockResolvedValueOnce(PASS_TOOL_RESULT)          // validate_confidence → PASS
      .mockResolvedValueOnce(STEPS_PASS_TOOL_RESULT)    // validate_reasoning_chain → PASS (reuses result shape)
      .mockResolvedValueOnce(STEPS_BLOCK_TOOL_RESULT)   // check_plan_validity → BLOCK
      .mockResolvedValueOnce(OPS_PASS_TOOL_RESULT);     // detect_concurrency_patterns → PASS

    const verdict = await invokePhalanxContract(makeCall({ payload: allFourPayload }), invoker);

    expect(verdict.verdict).toBe('BLOCK');
    expect(verdict.objections.some(o => o.mechanism === 'circular_dependency')).toBe(true);
  });

  it('mechanism_versions contains all four tools', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(STEPS_PASS_TOOL_RESULT);
    const verdict = await invokePhalanxContract(makeCall({ payload: allFourPayload }), invoker);

    expect(verdict.mechanism_versions).toHaveProperty('validate_confidence');
    expect(verdict.mechanism_versions).toHaveProperty('validate_reasoning_chain');
    expect(verdict.mechanism_versions).toHaveProperty('check_plan_validity');
    expect(verdict.mechanism_versions).toHaveProperty('detect_concurrency_patterns');
  });
});

// ====== Sub-payload malformed input validation ======

describe('malformed assumptions sub-payload', () => {
  function badAssumptionsCall(assumptions: unknown) {
    return {
      call_id: 'x',
      phase: 'planning',
      piece_id: null,
      run_id: 'r',
      payload: { assumptions },
    };
  }

  it('throws when assumptions.assumptions is not an array', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badAssumptionsCall({ assumptions: 'not-array', response_text: 'ok' }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when an assumption element has missing description', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badAssumptionsCall({ assumptions: [{ confidence: 0.5 }], response_text: 'ok' }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when an assumption description is an empty string', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badAssumptionsCall({ assumptions: [{ description: '', confidence: 0.5 }], response_text: 'ok' }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when confidence is out of [0,1] range', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badAssumptionsCall({ assumptions: [{ description: 'ok', confidence: 1.5 }], response_text: 'ok' }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when confidence is the wrong type', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badAssumptionsCall({ assumptions: [{ description: 'ok', confidence: 'high' }], response_text: 'ok' }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when response_text is missing', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badAssumptionsCall({ assumptions: [{ description: 'ok', confidence: 0.5 }] }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when response_text is empty', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badAssumptionsCall({ assumptions: [{ description: 'ok', confidence: 0.5 }], response_text: '' }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when falsification_condition is wrong type', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badAssumptionsCall({
          assumptions: [{ description: 'ok', confidence: 0.5, falsification_condition: 42 }],
          response_text: 'ok',
        }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });
});

describe('malformed claims sub-payload', () => {
  function badClaimsCall(claims: unknown) {
    return {
      call_id: 'x',
      phase: 'planning',
      piece_id: null,
      run_id: 'r',
      payload: { claims },
    };
  }

  it('throws when nodes is not an array', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badClaimsCall({ nodes: 'bad', edges: [] }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when nodes is an empty array', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badClaimsCall({ nodes: [], edges: [] }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when a node has an invalid type enum value', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badClaimsCall({ nodes: [{ id: 'n1', label: 'x', type: 'invalid_type' }], edges: [] }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when a node has missing required field (id)', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badClaimsCall({ nodes: [{ label: 'x', type: 'claim' }], edges: [] }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when an edge has invalid relation enum value', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badClaimsCall({
          nodes: [{ id: 'n1', label: 'x', type: 'claim' }],
          edges: [{ from: 'n1', to: 'n1', relation: 'bad_relation' }],
        }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when an edge from references a missing node id', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badClaimsCall({
          nodes: [{ id: 'n1', label: 'x', type: 'claim' }],
          edges: [{ from: 'MISSING', to: 'n1', relation: 'supports' }],
        }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when an edge to references a missing node id', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badClaimsCall({
          nodes: [{ id: 'n1', label: 'x', type: 'claim' }],
          edges: [{ from: 'n1', to: 'MISSING', relation: 'supports' }],
        }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when edges is not an array', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badClaimsCall({ nodes: [{ id: 'n1', label: 'x', type: 'claim' }], edges: 'bad' }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });
});

describe('malformed steps sub-payload', () => {
  function badStepsCall(steps: unknown) {
    return {
      call_id: 'x',
      phase: 'planning',
      piece_id: null,
      run_id: 'r',
      payload: { steps },
    };
  }

  it('throws when steps.steps is not an array', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badStepsCall({ steps: 'bad' }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when steps.steps is empty', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badStepsCall({ steps: [] }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when a step is missing required field description', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badStepsCall({ steps: [{ id: 's1', dependencies: [] }] }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when a step dependencies is not an array', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badStepsCall({ steps: [{ id: 's1', description: 'x', dependencies: 'not-array' }] }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when a step resources is wrong type', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(
        badStepsCall({
          steps: [{ id: 's1', description: 'x', dependencies: [], resources: 'bad' }],
        }),
        invoker,
      ),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });
});

describe('malformed operations sub-payload', () => {
  function badOpsCall(operations: unknown) {
    return {
      call_id: 'x',
      phase: 'planning',
      piece_id: null,
      run_id: 'r',
      payload: { operations },
    };
  }

  it('throws when operations.steps is not an array', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badOpsCall({ steps: 'bad' }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when operations.steps is empty', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badOpsCall({ steps: [] }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when operations.steps contains non-strings', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badOpsCall({ steps: [42, 'ok'] }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when delivery_model has invalid enum value', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badOpsCall({ steps: ['op1'], delivery_model: 'maybe_once' }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when retry_behavior has invalid enum value', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badOpsCall({ steps: ['op1'], retry_behavior: 'sometimes' }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when shared_resources is wrong type', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badOpsCall({ steps: ['op1'], shared_resources: 'not-array' }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('throws when protections is wrong type', async () => {
    const invoker: ToolInvoker = vi.fn();
    await expect(
      invokePhalanxContract(badOpsCall({ steps: ['op1'], protections: 123 }), invoker),
    ).rejects.toBeInstanceOf(PhalanxContractInputError);
    expect(invoker).not.toHaveBeenCalled();
  });

  it('does NOT throw for a valid operations payload with all optional fields', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(OPS_PASS_TOOL_RESULT);
    await expect(
      invokePhalanxContract(
        {
          call_id: 'x',
          phase: 'planning',
          piece_id: null,
          run_id: 'r',
          payload: {
            operations: {
              steps: ['op1', 'op2'],
              shared_resources: ['db'],
              protections: ['mutex'],
              delivery_model: 'exactly_once',
              retry_behavior: 'none',
            },
          },
        },
        invoker,
      ),
    ).resolves.toBeDefined();
  });
});

// ======================================================================
// CT tool minimum alignment — envelope must reject inputs that the
// underlying CT tools would themselves reject. These tests lock in the
// four specific minimums (response_text length, nodes count, edges
// count, steps count) so malformed inputs throw PhalanxContractInputError
// pre-dispatch instead of reaching the tool and becoming soft-fail WARN.
// ======================================================================

describe('CT tool minimum alignment — pre-dispatch rejection', () => {
  function callWith(payload: unknown) {
    return {
      call_id: 'min-align',
      phase: 'planning' as const,
      piece_id: null,
      run_id: 'r',
      payload,
    };
  }

  it('rejects assumptions.response_text shorter than 10 chars (matches validate_confidence minimum)', async () => {
    const invoker: ToolInvoker = vi.fn();
    const bad = callWith({
      assumptions: {
        assumptions: [{ description: 'ok', confidence: 0.5 }],
        response_text: 'too short',
      },
    });
    await expect(invokePhalanxContract(bad, invoker)).rejects.toBeInstanceOf(
      PhalanxContractInputError,
    );
    expect(invoker).not.toHaveBeenCalled();
  });

  it('accepts assumptions.response_text of exactly 10 chars', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(PASS_TOOL_RESULT);
    const call = callWith({
      assumptions: {
        assumptions: [{ description: 'ok', confidence: 0.5 }],
        response_text: 'x'.repeat(10),
      },
    });
    await expect(invokePhalanxContract(call, invoker)).resolves.toBeDefined();
    expect(invoker).toHaveBeenCalledOnce();
  });

  it('rejects claims.nodes with only 1 node (matches validate_reasoning_chain minimum)', async () => {
    const invoker: ToolInvoker = vi.fn();
    const bad = callWith({
      claims: {
        nodes: [{ id: 'n1', label: 'sole node', type: 'claim' }],
        edges: [],
      },
    });
    await expect(invokePhalanxContract(bad, invoker)).rejects.toBeInstanceOf(
      PhalanxContractInputError,
    );
    expect(invoker).not.toHaveBeenCalled();
  });

  it('rejects claims.edges empty (matches validate_reasoning_chain minimum)', async () => {
    const invoker: ToolInvoker = vi.fn();
    const bad = callWith({
      claims: {
        nodes: [
          { id: 'n1', label: 'A', type: 'claim' },
          { id: 'n2', label: 'B', type: 'claim' },
        ],
        edges: [],
      },
    });
    await expect(invokePhalanxContract(bad, invoker)).rejects.toBeInstanceOf(
      PhalanxContractInputError,
    );
    expect(invoker).not.toHaveBeenCalled();
  });

  it('accepts claims with exactly 2 nodes and 1 edge', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(PASS_TOOL_RESULT);
    const call = callWith({
      claims: {
        nodes: [
          { id: 'n1', label: 'A', type: 'evidence' },
          { id: 'n2', label: 'B', type: 'claim' },
        ],
        edges: [{ from: 'n1', to: 'n2', relation: 'supports' }],
      },
    });
    await expect(invokePhalanxContract(call, invoker)).resolves.toBeDefined();
    expect(invoker).toHaveBeenCalledOnce();
  });

  it('rejects steps.steps with only 1 step (matches check_plan_validity minimum)', async () => {
    const invoker: ToolInvoker = vi.fn();
    const bad = callWith({
      steps: {
        steps: [{ id: 's1', description: 'lone step', dependencies: [] }],
      },
    });
    await expect(invokePhalanxContract(bad, invoker)).rejects.toBeInstanceOf(
      PhalanxContractInputError,
    );
    expect(invoker).not.toHaveBeenCalled();
  });

  it('accepts steps with exactly 2 steps', async () => {
    const invoker: ToolInvoker = vi.fn().mockResolvedValue(STEPS_PASS_TOOL_RESULT);
    const call = callWith({
      steps: {
        steps: [
          { id: 's1', description: 'first', dependencies: [] },
          { id: 's2', description: 'second', dependencies: ['s1'] },
        ],
      },
    });
    await expect(invokePhalanxContract(call, invoker)).resolves.toBeDefined();
    expect(invoker).toHaveBeenCalledOnce();
  });

  it('rejection happens before any tool dispatch on every minimum violation', async () => {
    const invoker: ToolInvoker = vi.fn();

    const cases: unknown[] = [
      callWith({
        assumptions: {
          assumptions: [{ description: 'ok', confidence: 0.5 }],
          response_text: 'short',
        },
      }),
      callWith({
        claims: {
          nodes: [{ id: 'n1', label: 'A', type: 'claim' }],
          edges: [],
        },
      }),
      callWith({
        claims: {
          nodes: [
            { id: 'n1', label: 'A', type: 'claim' },
            { id: 'n2', label: 'B', type: 'claim' },
          ],
          edges: [],
        },
      }),
      callWith({
        steps: {
          steps: [{ id: 's1', description: 'x', dependencies: [] }],
        },
      }),
    ];

    for (const c of cases) {
      await expect(invokePhalanxContract(c, invoker)).rejects.toBeInstanceOf(
        PhalanxContractInputError,
      );
    }

    expect(invoker).not.toHaveBeenCalled();
  });
});

// ====== Slice A hardening: claim_ref populated / absent ======

describe('claim_ref on blocking objections', () => {
  it('cycle_detection objection carries claim_ref anchored to the first cycle node', async () => {
    const cycleResult = {
      status: 'ENFORCEMENT_FAIL' as const,
      enforcement: {
        blocking_issues: [
          {
            mechanism: 'cycle_detection',
            description: 'Found 1 circular reasoning cycle(s): n1 -> n2 -> n1',
            severity: 'blocking' as const,
            claim_ref: 'n1',
          },
        ],
        warnings: [],
        corrective_prompt: 'Remove the cycle.',
      },
    };

    const invoker: ToolInvoker = vi.fn().mockResolvedValue(cycleResult);
    const call = makeCall({
      payload: {
        claims: {
          nodes: [
            { id: 'n1', label: 'A', type: 'claim' as const },
            { id: 'n2', label: 'B', type: 'claim' as const },
          ],
          edges: [
            { from: 'n1', to: 'n2', relation: 'supports' as const },
            { from: 'n2', to: 'n1', relation: 'supports' as const },
          ],
        },
      },
    });

    const verdict = await invokePhalanxContract(call, invoker);

    const cycleObj = verdict.objections.find(o => o.mechanism === 'cycle_detection');
    expect(cycleObj).toBeDefined();
    expect(cycleObj!.claim_ref).toBe('n1');
  });

  it('orphan_detection objection carries claim_ref anchored to the orphaned node id', async () => {
    const orphanResult = {
      status: 'ENFORCEMENT_FAIL' as const,
      enforcement: {
        blocking_issues: [
          {
            mechanism: 'orphan_detection',
            description: '1 conclusion(s) have no supporting evidence or claims: cn1',
            severity: 'blocking' as const,
            claim_ref: 'cn1',
          },
        ],
        warnings: [],
        corrective_prompt: 'Add support for the orphaned conclusion.',
      },
    };

    const invoker: ToolInvoker = vi.fn().mockResolvedValue(orphanResult);
    const call = makeCall({
      payload: {
        claims: {
          nodes: [
            { id: 'e1', label: 'Evidence', type: 'evidence' as const },
            { id: 'cn1', label: 'Orphaned conclusion', type: 'conclusion' as const },
          ],
          edges: [{ from: 'e1', to: 'cn1', relation: 'supports' as const }],
        },
      },
    });

    const verdict = await invokePhalanxContract(call, invoker);

    const orphanObj = verdict.objections.find(o => o.mechanism === 'orphan_detection');
    expect(orphanObj).toBeDefined();
    expect(orphanObj!.claim_ref).toBe('cn1');
  });

  it('confidence_product inflation objection carries claim_ref assumption:0', async () => {
    const inflationResult = {
      status: 'ENFORCEMENT_FAIL' as const,
      enforcement: {
        blocking_issues: [
          {
            mechanism: 'confidence_product',
            description: 'Inflation detected — claimed confidence exceeds honest ceiling by 0.500.',
            severity: 'blocking' as const,
            claim_ref: 'assumption:0',
          },
        ],
        warnings: [],
        corrective_prompt: 'Reduce claimed confidence.',
      },
    };

    const invoker: ToolInvoker = vi.fn().mockResolvedValue(inflationResult);
    const verdict = await invokePhalanxContract(makeCall(), invoker);

    const inflationObj = verdict.objections.find(o => o.mechanism === 'confidence_product');
    expect(inflationObj).toBeDefined();
    expect(inflationObj!.claim_ref).toBe('assumption:0');
  });

  it('blocking issue without claim_ref in raw output does not get claim_ref on objection', async () => {
    const noRefResult = {
      status: 'ENFORCEMENT_FAIL' as const,
      enforcement: {
        blocking_issues: [
          {
            mechanism: 'consistency',
            description: 'Consistency violation detected.',
            severity: 'blocking' as const,
            // No claim_ref field
          },
        ],
        warnings: [],
        corrective_prompt: 'Fix the inconsistency.',
      },
    };

    const invoker: ToolInvoker = vi.fn().mockResolvedValue(noRefResult);
    const verdict = await invokePhalanxContract(makeCall(), invoker);

    const consistencyObj = verdict.objections.find(o => o.mechanism === 'consistency');
    expect(consistencyObj).toBeDefined();
    expect(consistencyObj!.claim_ref).toBeUndefined();
  });

  it('claim_ref is stable across identical calls (deterministic)', async () => {
    const resultWithRef = {
      status: 'ENFORCEMENT_FAIL' as const,
      enforcement: {
        blocking_issues: [
          {
            mechanism: 'orphan_detection',
            description: '1 conclusion(s) have no supporting evidence or claims: cn1',
            severity: 'blocking' as const,
            claim_ref: 'cn1',
          },
        ],
        warnings: [],
        corrective_prompt: '',
      },
    };

    const call = makeCall({
      payload: {
        claims: {
          nodes: [
            { id: 'e1', label: 'Evidence', type: 'evidence' as const },
            { id: 'cn1', label: 'Orphaned', type: 'conclusion' as const },
          ],
          edges: [{ from: 'e1', to: 'cn1', relation: 'supports' as const }],
        },
      },
    });

    const invoker1: ToolInvoker = vi.fn().mockResolvedValue(resultWithRef);
    const invoker2: ToolInvoker = vi.fn().mockResolvedValue(resultWithRef);

    const v1 = await invokePhalanxContract(call, invoker1);
    const v2 = await invokePhalanxContract(call, invoker2);

    expect(v1.objections[0].objection_id).toBe(v2.objections[0].objection_id);
    expect(v1.objections[0].claim_ref).toBe(v2.objections[0].claim_ref);
  });
});

// ====== Slice B hardening: structured warning mechanism names ======

describe('warning mechanism names', () => {
  it('structured warning_issues produce stable mechanism name (not toolName_warning)', () => {
    const resultWithStructuredWarnings = {
      status: 'PASS' as const,
      enforcement: {
        blocking_issues: [],
        warnings: [],
        warning_issues: [
          { mechanism: 'falsifiability', description: 'Falsifiability score low: 0.30.' },
        ],
        corrective_prompt: '',
      },
    };

    const objections = mapToolResultToObjections(
      'validate_confidence',
      resultWithStructuredWarnings,
      'call-structured',
    );

    expect(objections).toHaveLength(1);
    expect(objections[0].mechanism).toBe('falsifiability');
    expect(objections[0].severity).toBe('warning');
    expect(objections[0].message).toContain('Falsifiability score low');
  });

  it('unstructured string warnings fall back to toolName_warning mechanism', () => {
    const resultWithStringWarnings = {
      status: 'PASS' as const,
      enforcement: {
        blocking_issues: [],
        warnings: ['Low grounding score (0.30). Most conclusions are not traceable to evidence nodes.'],
        corrective_prompt: '',
      },
    };

    const objections = mapToolResultToObjections(
      'validate_reasoning_chain',
      resultWithStringWarnings,
      'call-string-warn',
    );

    expect(objections).toHaveLength(1);
    expect(objections[0].mechanism).toBe('validate_reasoning_chain_warning');
    expect(objections[0].severity).toBe('warning');
  });

  it('when both warning_issues and warnings are present, both are emitted', () => {
    const resultWithBoth = {
      status: 'PASS' as const,
      enforcement: {
        blocking_issues: [],
        warnings: ['A string warning.'],
        warning_issues: [{ mechanism: 'falsifiability', description: 'Falsifiability check failed.' }],
        corrective_prompt: '',
      },
    };

    const objections = mapToolResultToObjections(
      'validate_confidence',
      resultWithBoth,
      'call-both',
    );

    expect(objections).toHaveLength(2);
    expect(objections.some(o => o.mechanism === 'falsifiability')).toBe(true);
    expect(objections.some(o => o.mechanism === 'validate_confidence_warning')).toBe(true);
  });

  it('structured warning_issues objection_id is deterministic', () => {
    const result = {
      status: 'PASS' as const,
      enforcement: {
        blocking_issues: [],
        warnings: [],
        warning_issues: [{ mechanism: 'falsifiability', description: 'Consistent description.' }],
        corrective_prompt: '',
      },
    };

    const objs1 = mapToolResultToObjections('validate_confidence', result, 'call-det');
    const objs2 = mapToolResultToObjections('validate_confidence', result, 'call-det');

    expect(objs1[0].objection_id).toBe(objs2[0].objection_id);
  });
});

// ====== Slice E: Narrow output-shape guard for the four envelope-supported tools ======
// These assertions use known fixture shapes that mirror what the real tool handlers emit.
// They verify that mapToolResultToObjections correctly consumes each tool's output shape
// without requiring the full EnforcementEngine instantiation.

describe('output-shape guard — adapter consumes tool output shapes correctly', () => {
  const CALL_ID = 'shape-guard-call';

  it('validate_confidence ENFORCEMENT_FAIL shape produces blocking objection with expected fields', () => {
    // Fixture mirrors actual validate_confidence ENFORCEMENT_FAIL output shape
    const raw = {
      status: 'ENFORCEMENT_FAIL' as const,
      honest_ceiling: 0.4,
      claimed_confidence: 0.9,
      gap: 0.5,
      inflation_detected: true,
      dependency_weights: [1],
      falsifiability: { score: 1, passes: true, unfalsifiable: [] },
      assumption_count: 1,
      context_used: false,
      enforcement: {
        blocking_issues: [
          { mechanism: 'confidence_product', description: 'Inflation detected.', severity: 'blocking' as const },
        ],
        warnings: [],
        corrective_prompt: 'Fix it.',
      },
    };

    const objs = mapToolResultToObjections('validate_confidence', raw, CALL_ID);
    expect(objs).toHaveLength(1);
    expect(objs[0].severity).toBe('blocking');
    expect(objs[0].mechanism).toBe('confidence_product');
    expect(objs[0].evidence).toMatchObject({ tool: 'validate_confidence' });
  });

  it('validate_reasoning_chain ENFORCEMENT_FAIL shape produces blocking objection with expected fields', () => {
    // Fixture mirrors actual validate_reasoning_chain ENFORCEMENT_FAIL output shape
    const raw = {
      status: 'ENFORCEMENT_FAIL' as const,
      cycles: [{ path: ['n1', 'n2', 'n1'] }],
      orphaned_conclusions: [],
      grounding_score: 0,
      node_count: 2,
      edge_count: 2,
      context_used: false,
      enforcement: {
        blocking_issues: [
          { mechanism: 'cycle_detection', description: 'Found 1 cycle.', severity: 'blocking' as const, claim_ref: 'n1' },
        ],
        warnings: [],
        corrective_prompt: 'Remove cycle.',
      },
    };

    const objs = mapToolResultToObjections('validate_reasoning_chain', raw, CALL_ID);
    expect(objs).toHaveLength(1);
    expect(objs[0].severity).toBe('blocking');
    expect(objs[0].mechanism).toBe('cycle_detection');
    expect(objs[0].claim_ref).toBe('n1');
  });

  it('check_plan_validity ENFORCEMENT_FAIL shape produces blocking objection with expected fields', () => {
    // Fixture mirrors actual check_plan_validity ENFORCEMENT_FAIL output shape
    const raw = {
      status: 'ENFORCEMENT_FAIL' as const,
      is_valid: false,
      circular_dependencies: [['s1', 's2', 's1']],
      missing_prerequisites: [],
      resource_conflicts: [],
      completeness_score: 0,
      critical_path: [],
      step_count: 2,
      context_used: false,
      enforcement: {
        blocking_issues: [
          { mechanism: 'circular_dependency', description: 'Cycle: s1->s2->s1.', severity: 'blocking' as const },
        ],
        warnings: [],
        corrective_prompt: 'Fix dependency cycle.',
      },
    };

    const objs = mapToolResultToObjections('check_plan_validity', raw, CALL_ID);
    expect(objs).toHaveLength(1);
    expect(objs[0].severity).toBe('blocking');
    expect(objs[0].mechanism).toBe('circular_dependency');
    expect(objs[0].evidence).toMatchObject({ tool: 'check_plan_validity' });
  });

  it('detect_concurrency_patterns ENFORCEMENT_FAIL shape produces blocking objection with expected fields', () => {
    // Fixture mirrors actual detect_concurrency_patterns ENFORCEMENT_FAIL output shape
    const raw = {
      status: 'ENFORCEMENT_FAIL' as const,
      patterns_detected: ['check_then_act'],
      hazard_count: 1,
      enforcement: {
        blocking_issues: [
          { mechanism: 'check_then_act', description: 'Check-then-act pattern detected.', severity: 'blocking' as const },
        ],
        warnings: [],
        corrective_prompt: 'Use atomic compare-and-swap.',
      },
    };

    const objs = mapToolResultToObjections('detect_concurrency_patterns', raw, CALL_ID);
    expect(objs).toHaveLength(1);
    expect(objs[0].severity).toBe('blocking');
    expect(objs[0].mechanism).toBe('check_then_act');
    expect(objs[0].evidence).toMatchObject({ tool: 'detect_concurrency_patterns' });
  });

  it('all four tools produce empty objections on PASS with no enforcement', () => {
    const passShape = { status: 'PASS' as const };
    const tools = ['validate_confidence', 'validate_reasoning_chain', 'check_plan_validity', 'detect_concurrency_patterns'];
    for (const tool of tools) {
      expect(mapToolResultToObjections(tool, passShape, CALL_ID)).toHaveLength(0);
    }
  });
});
