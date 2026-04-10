import { afterEach, describe, expect, it } from 'vitest';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import {
  parseRuntimeConfig,
  startHttpServer,
  type RunningHttpServer,
} from '../src/server-runtime.js';

const serversToClose: RunningHttpServer[] = [];

afterEach(async () => {
  while (serversToClose.length > 0) {
    const server = serversToClose.pop();
    if (server) {
      await server.close();
    }
  }
});

describe('HTTP transport support', () => {
  it('parses HTTP runtime flags', () => {
    const config = parseRuntimeConfig(
      ['--transport', 'http', '--host', '0.0.0.0', '--port', '4100', '--path', 'rpc'],
      {},
    );

    expect(config.transport).toBe('http');
    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(4100);
    expect(config.path).toBe('/rpc');
  });

  it('serves MCP over streamable HTTP and exposes the existing tools', async () => {
    const running = await startHttpServer({
      host: '127.0.0.1',
      port: 0,
      path: '/mcp',
    });
    serversToClose.push(running);

    const healthResponse = await fetch(`http://${running.config.host}:${running.config.port}/healthz`);
    expect(healthResponse.status).toBe(200);
    const healthJson = (await healthResponse.json()) as {
      status: string;
      transport: string;
      endpoint: string;
    };
    expect(healthJson.status).toBe('ok');
    expect(healthJson.transport).toBe('http');
    expect(healthJson.endpoint).toBe('/mcp');

    const client = new Client(
      {
        name: 'ct-mcp-http-test-client',
        version: '1.0.0',
      },
      { capabilities: {} },
    );
    const transport = new StreamableHTTPClientTransport(new URL(running.url));

    try {
      await client.connect(transport);

      const toolList = await client.listTools();
      expect(toolList.tools.some(tool => tool.name === 'validate_confidence')).toBe(
        true,
      );
      expect(toolList.tools.some(tool => tool.name === 'verify_arithmetic')).toBe(
        true,
      );

      const arithmeticResult = await client.callTool({
        name: 'verify_arithmetic',
        arguments: {
          claim_type: 'sum',
          values: [2, 3, 5],
          claimed_result: 10,
        },
      });

      const textOutput = arithmeticResult.content.find(
        item => item.type === 'text',
      );
      expect(textOutput?.type).toBe('text');
      expect((textOutput as { text: string }).text).toContain('"status": "PASS"');
    } finally {
      await transport.terminateSession().catch(() => undefined);
      await transport.close().catch(() => undefined);
      await client.close().catch(() => undefined);
    }
  });
});
