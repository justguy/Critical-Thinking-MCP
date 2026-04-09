#!/usr/bin/env node

/**
 * critical-thinking-mcp — MCP server providing 9 deterministic reasoning
 * enforcement tools. No LLM calls; all checks are mathematical/structural.
 *
 * Transport: stdio (StdioServerTransport).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { registerResourceHandlers } from './mcp/resources.js';
import { registerToolHandlers } from './mcp/tool-call.js';
import { TOOLS } from './mcp/tool-definitions.js';

const server = new Server(
  {
    name: 'critical-thinking-mcp',
    version: '0.1.0-beta.2',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

registerResourceHandlers(server);
registerToolHandlers(server);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('critical-thinking-mcp server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
