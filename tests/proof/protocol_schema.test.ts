import Ajv, { type AnySchema } from 'ajv';
import { describe, expect, it } from 'vitest';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ErrorCode, type CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

import { registerToolHandlers } from '../../src/mcp/tool-call.js';
import { TOOLS } from '../../src/mcp/tool-definitions.js';
import { startHttpServer } from '../../src/server-runtime.js';

type ToolCallResult = {
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type RequestHandler = (request: CallToolRequest, extra: unknown) => Promise<ToolCallResult>;

const PUBLIC_TOOL_NAMES = [
  'validate_reasoning_chain',
  'check_numeric_claims',
  'detect_drift',
  'evaluate_tradeoffs',
  'check_plan_validity',
  'score_response_quality',
  'validate_confidence',
  'verify_arithmetic',
  'detect_concurrency_patterns',
  'plan_checks',
  'finalize_deliverable',
];

const INTERNAL_LEAF_TOOL_NAMES = [
  'check_quote_grounding',
  'check_claim_coverage',
  'trace_conclusion_numbers',
  'check_answer_against_constraints',
  'check_freshness',
  'check_case_partition',
  'check_profile_downgrade',
];

const DAY = 86_400;

function createToolCaller(): (name: string, args: Record<string, unknown>) => Promise<ToolCallResult> {
  const server = new Server(
    { name: 'protocol-schema-proof', version: '0.0.0-test' },
    { capabilities: { tools: {} } },
  );
  registerToolHandlers(server);

  const handlers = (server as unknown as { _requestHandlers: Map<string, RequestHandler> })._requestHandlers;
  const handler = handlers.get('tools/call');
  if (!handler) {
    throw new Error('tools/call handler was not registered');
  }

  return (name: string, args: Record<string, unknown>) =>
    handler({ method: 'tools/call', params: { name, arguments: args } }, {});
}

const toolByName = new Map(TOOLS.map(tool => [tool.name, tool]));

const finalizeBaseContract = {
  contract_id: 'schema-proof',
  contract_authority: 'host',
  profile_source: 'host_supplied',
  original_request_text: 'Give the current pricing.',
  task_type: 'factual_qa',
  evidence_level: 'none',
  risk_level: 'low',
  freshness: { max_age_seconds: 30 * DAY, requires_dated_sources: true },
};

function finalizeFreshnessArgs(
  publishedAt: string,
  overrides: {
    evalTime?: string;
    maxAgeSeconds?: number;
    answerText?: string;
  } = {},
): Record<string, unknown> {
  return {
    contract: {
      ...finalizeBaseContract,
      freshness: {
        max_age_seconds: overrides.maxAgeSeconds ?? 30 * DAY,
        requires_dated_sources: true,
      },
    },
    answer_text: overrides.answerText ?? 'Current pricing is $20/mo.',
    eval_time: { value: overrides.evalTime ?? '2026-05-30T00:00:00Z', authority: 'host' },
    sources: [{ id: 's1', text: 'Pricing: $20/mo.', published_at: publishedAt }],
  };
}

const REPRESENTATIVE_CALLS: { name: string; args: Record<string, unknown> }[] = [
  {
    name: 'validate_reasoning_chain',
    args: {
      nodes: [
        { id: 'e1', label: 'Benchmark shows p99 latency below 200ms', type: 'evidence' },
        { id: 'c1', label: 'The service latency is acceptable', type: 'claim' },
        { id: 'cn1', label: 'Use this service', type: 'conclusion' },
      ],
      edges: [
        { from: 'e1', to: 'c1', relation: 'supports' },
        { from: 'c1', to: 'cn1', relation: 'implies' },
      ],
    },
  },
  {
    name: 'check_numeric_claims',
    args: { numbers: [12.5, 15.3, 14.8, 13.2], description: 'Quarterly revenue figures in millions' },
  },
  {
    name: 'detect_drift',
    args: { sequence: [0.72, 0.73, 0.74, 0.75], drift_sensitivity: 0.5 },
  },
  {
    name: 'evaluate_tradeoffs',
    args: {
      options: [
        {
          name: 'Option A',
          outcomes: [
            { description: 'Success', probability: 0.7, utility: 100 },
            { description: 'Failure', probability: 0.3, utility: -20 },
          ],
        },
        {
          name: 'Option B',
          outcomes: [
            { description: 'Success', probability: 0.5, utility: 150 },
            { description: 'Failure', probability: 0.5, utility: -10 },
          ],
        },
      ],
    },
  },
  {
    name: 'check_plan_validity',
    args: {
      steps: [
        { id: 's1', description: 'Set up database schema', dependencies: [], resources: ['database'] },
        { id: 's2', description: 'Build API endpoints', dependencies: ['s1'], resources: ['api-server'] },
        { id: 's3', description: 'Deploy to staging', dependencies: ['s2'], resources: ['staging-env'] },
      ],
    },
  },
  {
    name: 'score_response_quality',
    args: {
      response_text: 'The benchmark evidence shows p99 latency at 180ms, so the service meets the stated 200ms target.',
      claims: ['The service meets the latency target'],
      evidence: ['p99 latency was measured at 180ms'],
    },
  },
  {
    name: 'validate_confidence',
    args: {
      assumptions: [
        {
          description: 'The benchmark workload matches production traffic',
          confidence: 0.8,
          falsification_condition: 'Production request mix differs from benchmark mix by more than 10 percent.',
        },
      ],
      response_text: 'Given the available benchmark, confidence should remain below the stated assumption ceiling.',
    },
  },
  {
    name: 'verify_arithmetic',
    args: { claim_type: 'weighted_average', values: [100, 80, 60], weights: [0.5, 0.3, 0.2], claimed_result: 86 },
  },
  {
    name: 'detect_concurrency_patterns',
    args: {
      steps: ['Read current balance', 'If balance is enough, approve purchase', 'Write updated balance'],
      shared_resources: ['balance'],
      protections: [],
    },
  },
  {
    name: 'plan_checks',
    args: { contract: { task_type: 'factual_qa', evidence_level: 'cited', risk_level: 'low' } },
  },
  {
    name: 'finalize_deliverable',
    args: {
      contract: {
        contract_id: 'schema-proof-freeform',
        contract_authority: 'host',
        profile_source: 'host_supplied',
        original_request_text: 'Write a short note.',
        task_type: 'freeform',
        evidence_level: 'none',
        risk_level: 'low',
      },
      answer_text: 'A short note that needs no external evidence.',
    },
  },
  {
    name: 'finalize_deliverable',
    args: finalizeFreshnessArgs('2026-01-01T00:00:00Z', { maxAgeSeconds: 7 * DAY }),
  },
];

describe('MCP protocol/schema proof surface', () => {
  it('lists exactly the public tools and hides internal leaf tools', () => {
    const actualNames = TOOLS.map(tool => tool.name);

    expect(actualNames).toHaveLength(11);
    expect(actualNames).toEqual(PUBLIC_TOOL_NAMES);
    for (const internalName of INTERNAL_LEAF_TOOL_NAMES) {
      expect(actualNames).not.toContain(internalName);
    }
  });

  it('declares outputSchema for every public tool', () => {
    expect(TOOLS.map(tool => [tool.name, Boolean((tool as { outputSchema?: object }).outputSchema)]))
      .toEqual(PUBLIC_TOOL_NAMES.map(name => [name, true]));
  });

  it('emits structuredContent for representative PASS and ENFORCEMENT_FAIL calls and validates all samples', async () => {
    const callTool = createToolCaller();
    const ajv = new Ajv({ allErrors: true, strict: false });
    const invalidOutputs: { name: string; errors: unknown }[] = [];
    const statuses: string[] = [];

    for (const sample of REPRESENTATIVE_CALLS) {
      const result = await callTool(sample.name, sample.args);
      const structuredContent = result.structuredContent;
      const outputSchema = (toolByName.get(sample.name) as { outputSchema?: object } | undefined)?.outputSchema;

      expect(structuredContent, `${sample.name} should include structuredContent`).toBeDefined();
      expect(outputSchema, `${sample.name} should declare outputSchema`).toBeDefined();
      expect(result.content[0].text).toBe(JSON.stringify(structuredContent, null, 2));

      statuses.push(String(structuredContent?.status));

      const validate = ajv.compile(outputSchema as AnySchema);
      if (!validate(structuredContent)) {
        invalidOutputs.push({ name: sample.name, errors: validate.errors });
      }
    }

    expect(statuses).toContain('PASS');
    expect(statuses).toContain('ENFORCEMENT_FAIL');
    expect(invalidOutputs).toEqual([]);
  });

  it('rejects unknown and internal-only tool names through the server handler', async () => {
    const callTool = createToolCaller();

    await expect(callTool('not_a_real_tool', {})).rejects.toMatchObject({
      code: ErrorCode.MethodNotFound,
    });
    await expect(callTool('check_freshness', {})).rejects.toMatchObject({
      code: ErrorCode.MethodNotFound,
    });
  });

  it('makes freshness timestamp policy explicit: date-only and offset-less values reject; zoned datetimes are deterministic', async () => {
    const callTool = createToolCaller();

    await expect(
      callTool('finalize_deliverable', finalizeFreshnessArgs('2026-05-20T00:00:00Z', { evalTime: '2026-05-30' })),
    ).rejects.toThrow(/Date-only and offset-less values are rejected/);
    await expect(
      callTool('finalize_deliverable', finalizeFreshnessArgs('2026-05-20T00:00:00Z', { evalTime: '2026-05-30T00:00:00' })),
    ).rejects.toThrow(/Date-only and offset-less values are rejected/);
    await expect(
      callTool('finalize_deliverable', finalizeFreshnessArgs('2026-05-20')),
    ).rejects.toThrow(/date-only \/ offset-less rejected/);
    await expect(
      callTool('finalize_deliverable', finalizeFreshnessArgs('2026-05-20T00:00:00')),
    ).rejects.toThrow(/date-only \/ offset-less rejected/);

    const zonedPass = await callTool(
      'finalize_deliverable',
      finalizeFreshnessArgs('2026-05-20T00:00:00+05:30'),
    );
    expect(zonedPass.structuredContent?.status).toBe('PASS');
    expect(zonedPass.isError).toBeUndefined();

    const zonedFail = await callTool(
      'finalize_deliverable',
      finalizeFreshnessArgs('2026-05-20T00:00:00+05:30', { maxAgeSeconds: 7 * DAY }),
    );
    expect(zonedFail.structuredContent?.status).toBe('ENFORCEMENT_FAIL');
    expect(zonedFail.isError).toBe(true);
  });

  it('round-trips tools/list and tools/call over live Streamable HTTP transport', async () => {
    const running = await startHttpServer({ host: '127.0.0.1', port: 0, path: '/mcp' });
    const client = new Client({ name: 'protocol-http-proof', version: '0.0.0-test' });
    const transport = new StreamableHTTPClientTransport(new URL(running.url));

    try {
      await client.connect(transport);

      const tools = await client.listTools();
      expect(tools.tools.map(tool => tool.name)).toEqual(PUBLIC_TOOL_NAMES);

      const pass = await client.callTool({
        name: 'finalize_deliverable',
        arguments: {
          contract: {
            contract_id: 'http-freeform',
            contract_authority: 'host',
            profile_source: 'host_supplied',
            original_request_text: 'Write a short note.',
            task_type: 'freeform',
            evidence_level: 'none',
            risk_level: 'low',
          },
          answer_text: 'A short note that needs no external evidence.',
        },
      });
      expect(pass.structuredContent?.status).toBe('PASS');
      expect(pass.isError).toBeUndefined();

      const block = await client.callTool({
        name: 'finalize_deliverable',
        arguments: finalizeFreshnessArgs('2026-01-01T00:00:00Z', { maxAgeSeconds: 7 * DAY }),
      });
      expect(block.structuredContent?.status).toBe('ENFORCEMENT_FAIL');
      expect(block.isError).toBe(true);
    } finally {
      await client.close();
      await running.close();
    }
  });
});
