/**
 * Schema validation tests for the experimental orchestrator.
 *
 * Every route must rely on strict structured contracts. A schema failure
 * is an orchestration failure — the deterministic tool MUST NOT be invoked
 * when the contract is malformed.
 */

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';

import {
  isSchemaFailure,
  runOrchestrator,
  validateConfidenceContract,
  validateOrchestratorEnvelope,
} from '../../src/orchestrator/index.js';
import type {
  OrchestratorEnvelope,
  RouteResult,
  SchemaFailure,
} from '../../src/orchestrator/index.js';

const GOOD_CONFIDENCE_CONTRACT = {
  response_text: 'We are 90% confident the system will handle the load.',
  assumptions: [
    {
      description: 'Peak traffic stays under 40k requests per second',
      confidence: 0.8,
      falsification_condition:
        'Observed RPS exceeds 40k for more than 10 minutes in staging load test',
    },
  ],
};

function validEnvelope(
  overrides: Partial<OrchestratorEnvelope> = {},
): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text:
      'We predict the system will handle peak traffic by Q3. We are 90% confident in this forecast.',
    contracts: { confidence: GOOD_CONFIDENCE_CONTRACT },
    mode: 'routed',
    review_context: { iteration_number: 1, prior_failures: [] },
    ...overrides,
  };
}

describe('envelope schema validation', () => {
  it('rejects an envelope missing schema_version', () => {
    const bad = { ...validEnvelope() } as Partial<OrchestratorEnvelope>;
    delete bad.schema_version;
    const r = validateOrchestratorEnvelope(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects an envelope missing answer_text', () => {
    const bad = { ...validEnvelope() } as Partial<OrchestratorEnvelope>;
    delete bad.answer_text;
    const r = validateOrchestratorEnvelope(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes('answer_text'))).toBe(true);
  });

  it('rejects an envelope missing review_context', () => {
    const bad = { ...validEnvelope() } as Partial<OrchestratorEnvelope>;
    delete bad.review_context;
    const r = validateOrchestratorEnvelope(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes('review_context'))).toBe(true);
  });

  it('rejects an envelope whose schema_version is wrong', () => {
    const bad = validEnvelope({
      schema_version: 'orchestrator_v1' as unknown as 'orchestrator_v0',
    });
    const r = validateOrchestratorEnvelope(bad);
    expect(r.valid).toBe(false);
  });

  it('accepts a minimal valid envelope', () => {
    const r = validateOrchestratorEnvelope(validEnvelope());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

describe('confidence contract schema validation', () => {
  it('rejects a contract missing assumptions', () => {
    const r = validateConfidenceContract({
      response_text: 'short response text value here',
    });
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes('assumptions'))).toBe(true);
  });

  it('rejects an assumption missing falsification_condition', () => {
    const r = validateConfidenceContract({
      response_text: 'short response text value here',
      assumptions: [
        { description: 'Traffic stays flat', confidence: 0.8 },
      ],
    });
    expect(r.valid).toBe(false);
    expect(
      r.errors.some(e => e.message.includes('falsification_condition')),
    ).toBe(true);
  });

  it('rejects a confidence value outside [0,1]', () => {
    const r = validateConfidenceContract({
      response_text: 'short response text value here',
      assumptions: [
        {
          description: 'Traffic stays flat',
          confidence: 1.7,
          falsification_condition: 'RPS exceeds 40k',
        },
      ],
    });
    expect(r.valid).toBe(false);
  });

  it('rejects an empty assumptions array', () => {
    const r = validateConfidenceContract({
      response_text: 'short response text value here',
      assumptions: [],
    });
    expect(r.valid).toBe(false);
  });

  it('accepts a well-formed contract', () => {
    const r = validateConfidenceContract(GOOD_CONFIDENCE_CONTRACT);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });
});

describe('runOrchestrator — schema failure stops the route before any tool call', () => {
  it('returns a schema_validation_failure route entry when an assumption lacks falsification_condition', () => {
    const envelope = validEnvelope({
      contracts: {
        confidence: {
          response_text: 'We are 90% confident the system will scale.',
          assumptions: [
            // Intentionally missing falsification_condition
            { description: 'Traffic stays flat', confidence: 0.9 },
          ],
        },
      },
    });

    const result = runOrchestrator(envelope);

    // Schema failure should escalate to REVISE on iteration 1 (not PASS/WARN).
    expect(['REVISE', 'HUMAN_REVIEW']).toContain(result.policy_decision);
    expect(result.policy_decision).toBe('REVISE');

    // There should be exactly one route result, and it should be a schema failure.
    expect(result.route_results.length).toBe(1);
    const entry = result.route_results[0];
    expect(isSchemaFailure(entry)).toBe(true);

    const failure = entry as SchemaFailure;
    expect(failure.failure_type).toBe('schema_validation_failure');
    expect(failure.tool).toBe('validate_confidence');
    expect(failure.contract_type).toBe('confidence_contract');
    expect(failure.validation_errors.length).toBeGreaterThan(0);
    expect(
      failure.validation_errors.some(e =>
        e.message.includes('falsification_condition'),
      ),
    ).toBe(true);

    // The deterministic tool should NOT have run. Proof: a SchemaFailure has
    // no `result` field with tool-specific output like `honest_ceiling`.
    expect('result' in failure).toBe(false);
  });

  it('schema failure is reflected in telemetry.schema_failures', () => {
    const envelope = validEnvelope({
      contracts: {
        confidence: {
          // response_text too short (< 10 chars)
          response_text: 'nope',
          assumptions: [
            {
              description: 'Traffic stays flat',
              confidence: 0.9,
              falsification_condition: 'RPS exceeds 40k sustained',
            },
          ],
        },
      },
    });

    const result = runOrchestrator(envelope);
    expect(result.telemetry.schema_failures.length).toBeGreaterThan(0);
    expect(result.telemetry.schema_failures[0].tool).toBe('validate_confidence');
  });

  it('valid contract reaches the deterministic tool (produces a real RouteResult)', () => {
    const envelope = validEnvelope();
    const result = runOrchestrator(envelope);

    expect(result.route_results.length).toBeGreaterThan(0);
    const entry = result.route_results[0];
    expect(isSchemaFailure(entry)).toBe(false);

    const routeResult = entry as RouteResult;
    expect(routeResult.tool).toBe('validate_confidence');
    // Real tool output has honest_ceiling etc.
    const toolResult = routeResult.result as { honest_ceiling?: number };
    expect(typeof toolResult.honest_ceiling).toBe('number');
  });

  it('envelope-level schema failure produces a REVISE/HUMAN_REVIEW decision without tool execution', () => {
    const bad = {
      schema_version: 'orchestrator_v0',
      // answer_text missing entirely
      contracts: {},
      mode: 'routed',
      review_context: { iteration_number: 1, prior_failures: [] },
    } as unknown as OrchestratorEnvelope;

    const result = runOrchestrator(bad);
    expect(['REVISE', 'HUMAN_REVIEW']).toContain(result.policy_decision);
    expect(result.route_results).toEqual([]);
    expect(result.telemetry.tools_executed).toEqual([]);
    expect(result.critique).toBeDefined();
    expect(result.critique?.failing_routes[0].failure_source).toBe('schema');
  });
});

describe('cli/report and docs smoke checks', () => {
  it('cli --out writes the machine-readable JSON report to disk', () => {
    const outputPath = '/tmp/ct-mcp-orchestrator-cli-out.json';
    rmSync(outputPath, { force: true });

    const result = spawnSync(
      'node',
      [
        '--import',
        'tsx',
        'src/orchestrator/cli.ts',
        '--input',
        'src/orchestrator/fixtures/confidence_inflation.json',
        '--mode',
        'routed',
        '--out',
        outputPath,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
      },
    );

    expect(result.status).toBe(0);
    expect(existsSync(outputPath)).toBe(true);

    const parsed = JSON.parse(readFileSync(outputPath, 'utf-8')) as {
      schema_version: string;
      mode: string;
      policy_decision: string;
    };
    expect(parsed.schema_version).toBe('orchestrator_v0');
    expect(parsed.mode).toBe('routed');
    expect(parsed.policy_decision).toBe('REVISE');
  });

  it('README and ROADMAP keep the orchestrator framed as experimental, not a workflow engine', () => {
    const readme = readFileSync('README.md', 'utf-8');
    const roadmap = readFileSync('ROADMAP.md', 'utf-8');

    expect(readme).toContain('## Experimental: Internal Orchestrator (v0)');
    expect(readme).toContain('Not a workflow engine, control plane, or production orchestration platform');
    expect(readme).toContain(
      'fall back to all compatible contracts instead of silently returning `PASS`',
    );

    expect(roadmap).toContain('#### Experimental: orchestrator v0 (internal only)');
    expect(roadmap).toContain('no provider SDK integrations');
    expect(roadmap).toContain('no LLM routing');
    expect(roadmap).toContain('no prose-to-graph rescue');
    expect(roadmap).toContain('no exposure as a public MCP tool');
  });
});
