/**
 * Tool surface after the review_before_final facade was added (chunk A, additive).
 *
 *  - tools/list now includes review_before_final
 *  - the public surface is 12 = the existing 11-tool spine + the facade
 *  - all 11 pre-existing public tools are still present (additive, nothing removed)
 *  - the facade is dispatchable through the server call handler and never blocks
 */

import { describe, expect, it } from 'vitest';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

import { registerToolHandlers } from '../../src/mcp/tool-call.js';
import { TOOLS } from '../../src/mcp/tool-definitions.js';

const SPINE_11 = [
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

type ToolCallResult = {
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type RequestHandler = (request: CallToolRequest, extra: unknown) => Promise<ToolCallResult>;

function createToolCaller(): (name: string, args: Record<string, unknown>) => Promise<ToolCallResult> {
  const server = new Server(
    { name: 'tool-surface-proof', version: '0.0.0-test' },
    { capabilities: { tools: {} } },
  );
  registerToolHandlers(server);
  const handlers = (server as unknown as { _requestHandlers: Map<string, RequestHandler> })._requestHandlers;
  const handler = handlers.get('tools/call');
  if (!handler) throw new Error('tools/call handler was not registered');
  return (name, args) => handler({ method: 'tools/call', params: { name, arguments: args } }, {});
}

describe('public tool surface includes the review_before_final facade', () => {
  it('lists review_before_final and totals 12 public tools', () => {
    const names = TOOLS.map(t => t.name);
    expect(names).toHaveLength(12);
    expect(names).toContain('review_before_final');
  });

  it('keeps all 11 pre-existing spine tools present (additive)', () => {
    const names = TOOLS.map(t => t.name);
    for (const name of SPINE_11) {
      expect(names, `${name} still present`).toContain(name);
    }
    // 11 spine + 1 facade, no overlap.
    expect(SPINE_11).not.toContain('review_before_final');
  });

  it('declares an inputSchema and outputSchema for the facade', () => {
    const facade = TOOLS.find(t => t.name === 'review_before_final') as
      | { inputSchema?: object; outputSchema?: object }
      | undefined;
    expect(facade?.inputSchema).toBeDefined();
    expect(facade?.outputSchema).toBeDefined();
  });

  it('dispatches the facade through the call handler without blocking', async () => {
    const callTool = createToolCaller();
    const result = await callTool('review_before_final', {
      task_type: 'numeric',
      original_request: 'What is the 3-year total at 5% growth on $10,000?',
      draft_answer: 'The 3-year total is $11,576.25.',
      mode: 'enforce',
    });
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent?.status).toBe('PASS');
    expect(result.structuredContent?.enforce_required).toBe(true);
    expect(Array.isArray(result.structuredContent?.checklist)).toBe(true);
  });
});
