#!/usr/bin/env node

/**
 * critical-thinking-mcp — MCP server providing 9 deterministic reasoning
 * enforcement tools. No LLM calls; all checks are mathematical/structural.
 *
 * Default transport: stdio.
 * Optional transport: Streamable HTTP via --transport http.
 */

import {
  parseRuntimeConfig,
  startHttpServer,
  startStdioServer,
} from './server-runtime.js';

async function main(): Promise<void> {
  const config = parseRuntimeConfig(process.argv.slice(2));

  if (config.transport === 'http') {
    await startHttpServer(config);
    return;
  }

  await startStdioServer();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
