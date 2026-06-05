/**
 * Reusable MCP prompts surface.
 *
 *  - the registry exposes exactly the 6 named prompts
 *  - listPromptDescriptors / GetPrompt return well-formed descriptors + messages
 *  - GetPrompt returns non-empty user messages for every prompt
 *  - an unknown prompt name errors
 *  - the prompts capability is declared and discoverable over live HTTP transport
 *    (prompts/list + prompts/get round-trip)
 */

import { describe, expect, it } from 'vitest';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import {
  PROMPTS,
  getPrompt,
  listPromptDescriptors,
} from '../../src/mcp/prompts.js';
import { startHttpServer } from '../../src/server-runtime.js';

const EXPECTED_PROMPT_NAMES = [
  'review_plan',
  'stress_architecture',
  'review_decision',
  'verify_research_answer',
  'audit_numeric_analysis',
  'review_before_final',
];

describe('MCP prompts registry', () => {
  it('exposes exactly the 6 expected prompts by name', () => {
    expect(PROMPTS).toHaveLength(6);
    expect(listPromptDescriptors().map(p => p.name)).toEqual(EXPECTED_PROMPT_NAMES);
  });

  it('each descriptor has a description and well-formed arguments', () => {
    for (const descriptor of listPromptDescriptors()) {
      expect(descriptor.description.length, descriptor.name).toBeGreaterThan(0);
      expect(Array.isArray(descriptor.arguments)).toBe(true);
      for (const arg of descriptor.arguments) {
        expect(typeof arg.name).toBe('string');
        expect(typeof arg.description).toBe('string');
        expect(typeof arg.required).toBe('boolean');
      }
    }
  });

  it('returns non-empty user messages for every prompt', () => {
    for (const name of EXPECTED_PROMPT_NAMES) {
      const result = getPrompt(name, {});
      expect(result.messages.length, name).toBeGreaterThan(0);
      const first = result.messages[0];
      expect(first.role).toBe('user');
      expect(first.content.type).toBe('text');
      const text = (first.content as { type: 'text'; text: string }).text;
      expect(text.length, `${name} message text`).toBeGreaterThan(0);
      // The reusable scaffold carries a checklist + critique section.
      expect(text).toMatch(/Checklist/);
      expect(text).toMatch(/Critique questions/);
    }
  });

  it('weaves supplied original_request / draft_answer into the prompt text', () => {
    const result = getPrompt('audit_numeric_analysis', {
      original_request: 'WHAT_IS_THE_TOTAL_MARKER',
      draft_answer: 'THE_DRAFT_MARKER',
    });
    const text = (result.messages[0].content as { type: 'text'; text: string }).text;
    expect(text).toContain('WHAT_IS_THE_TOTAL_MARKER');
    expect(text).toContain('THE_DRAFT_MARKER');
  });

  it('errors on an unknown prompt name', () => {
    expect(() => getPrompt('not_a_prompt', {})).toThrow(/Unknown prompt/);
  });
});

describe('MCP prompts over live Streamable HTTP transport', () => {
  it('declares the prompts capability and round-trips prompts/list + prompts/get', async () => {
    const running = await startHttpServer({ host: '127.0.0.1', port: 0, path: '/mcp' });
    const client = new Client({ name: 'prompts-http-proof', version: '0.0.0-test' });
    const transport = new StreamableHTTPClientTransport(new URL(running.url));

    try {
      await client.connect(transport);

      // Server advertised the prompts capability.
      expect(client.getServerCapabilities()?.prompts).toBeDefined();

      const listed = await client.listPrompts();
      expect(listed.prompts.map(p => p.name)).toEqual(EXPECTED_PROMPT_NAMES);

      const got = await client.getPrompt({
        name: 'review_plan',
        arguments: { original_request: 'Plan the migration.', draft_answer: 'Step 1...' },
      });
      expect(got.messages.length).toBeGreaterThan(0);
      expect(got.messages[0].role).toBe('user');

      await expect(
        client.getPrompt({ name: 'does_not_exist', arguments: {} }),
      ).rejects.toThrow();
    } finally {
      await client.close();
      await running.close();
    }
  });
});
