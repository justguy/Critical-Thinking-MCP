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

  it('throws PhalanxContractInputError when payload has neither assumptions nor claims', async () => {
    const invoker: ToolInvoker = vi.fn();
    const bad = {
      call_id: 'x',
      phase: 'planning',
      piece_id: null,
      run_id: 'r',
      payload: { operations: { steps: ['step1'] } },
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
