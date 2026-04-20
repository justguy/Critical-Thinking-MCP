import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server as NodeHttpServer, type ServerResponse } from 'node:http';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  isInitializeRequest,
  ListToolsRequestSchema,
  type JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';

import { registerResourceHandlers } from './mcp/resources.js';
import { registerToolHandlers } from './mcp/tool-call.js';
import { TOOLS } from './mcp/tool-definitions.js';

export const SERVER_INFO = {
  name: 'critical-thinking-mcp',
  version: '0.1.0-beta.3',
} as const;

export type ServerTransportMode = 'stdio' | 'http';

export interface RuntimeConfig {
  transport: ServerTransportMode;
  host: string;
  port: number;
  path: string;
}

export interface RunningHttpServer {
  config: RuntimeConfig;
  server: NodeHttpServer;
  url: string;
  close(): Promise<void>;
}

interface SessionRuntime {
  server: Server;
  transport: StreamableHTTPServerTransport;
}

function createMcpServer(): Server {
  const server = new Server(
    SERVER_INFO,
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

  return server;
}

function normalisePath(path: string): string {
  if (!path) return '/mcp';
  return path.startsWith('/') ? path : `/${path}`;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return parsed;
}

export function parseRuntimeConfig(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  let transport: ServerTransportMode =
    env.CT_MCP_TRANSPORT === 'http' ? 'http' : 'stdio';
  let host = env.CT_MCP_HOST ?? '127.0.0.1';
  let port = parsePort(env.CT_MCP_PORT, 3000);
  let path = normalisePath(env.CT_MCP_PATH ?? '/mcp');

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--transport':
        transport = argv[i + 1] === 'http' ? 'http' : 'stdio';
        i += 1;
        break;
      case '--http':
        transport = 'http';
        break;
      case '--stdio':
        transport = 'stdio';
        break;
      case '--host':
        host = argv[i + 1] ?? host;
        i += 1;
        break;
      case '--port':
        port = parsePort(argv[i + 1], port);
        i += 1;
        break;
      case '--path':
        path = normalisePath(argv[i + 1] ?? path);
        i += 1;
        break;
      default:
        break;
    }
  }

  return { transport, host, port, path };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const bodyText = Buffer.concat(chunks).toString('utf-8').trim();
  if (bodyText.length === 0) {
    return undefined;
  }

  return JSON.parse(bodyText) as JSONRPCMessage | JSONRPCMessage[];
}

function getSessionId(req: IncomingMessage): string | undefined {
  const raw = req.headers['mcp-session-id'];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  if (res.headersSent) return;
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function writeJsonRpcError(
  res: ServerResponse,
  statusCode: number,
  code: number,
  message: string,
): void {
  writeJson(res, statusCode, {
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  });
}

function writeNotFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ error: 'Not found' }));
}

async function createSessionRuntime(
  sessions: Map<string, SessionRuntime>,
): Promise<SessionRuntime> {
  const server = createMcpServer();
  let sessionTransport: StreamableHTTPServerTransport | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: sessionId => {
      if (sessionTransport) {
        sessions.set(sessionId, { server, transport: sessionTransport });
      }
    },
  });
  sessionTransport = transport;

  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) {
      sessions.delete(sessionId);
    }
  };

  await server.connect(transport);
  return { server, transport };
}

export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('critical-thinking-mcp server running on stdio');
}

export async function startHttpServer(
  config: Partial<RuntimeConfig> = {},
): Promise<RunningHttpServer> {
  const resolvedConfig: RuntimeConfig = {
    transport: 'http',
    host: config.host ?? '127.0.0.1',
    port: config.port ?? 3000,
    path: normalisePath(config.path ?? '/mcp'),
  };
  const sessions = new Map<string, SessionRuntime>();

  const httpServer = createServer(async (req, res) => {
    try {
      const method = req.method ?? 'GET';
      const url = new URL(
        req.url ?? '/',
        `http://${req.headers.host ?? `${resolvedConfig.host}:${resolvedConfig.port}`}`,
      );

      if (url.pathname === '/healthz') {
        writeJson(res, 200, {
          status: 'ok',
          transport: 'http',
          endpoint: resolvedConfig.path,
          sessions: sessions.size,
        });
        return;
      }

      if (url.pathname !== resolvedConfig.path) {
        writeNotFound(res);
        return;
      }

      if (method === 'POST') {
        const parsedBody = await readJsonBody(req);
        const sessionId = getSessionId(req);

        if (sessionId) {
          const existing = sessions.get(sessionId);
          if (!existing) {
            writeJsonRpcError(
              res,
              404,
              -32001,
              `Unknown or expired MCP session: ${sessionId}`,
            );
            return;
          }

          await existing.transport.handleRequest(req, res, parsedBody);
          return;
        }

        if (!isInitializeRequest(parsedBody)) {
          writeJsonRpcError(
            res,
            400,
            -32000,
            'Bad Request: missing MCP session ID or initialize request body',
          );
          return;
        }

        const runtime = await createSessionRuntime(sessions);
        await runtime.transport.handleRequest(req, res, parsedBody);
        return;
      }

      if (method === 'GET' || method === 'DELETE') {
        const sessionId = getSessionId(req);
        if (!sessionId) {
          writeJsonRpcError(
            res,
            400,
            -32000,
            'Bad Request: missing MCP session ID',
          );
          return;
        }

        const existing = sessions.get(sessionId);
        if (!existing) {
          writeJsonRpcError(
            res,
            404,
            -32001,
            `Unknown or expired MCP session: ${sessionId}`,
          );
          return;
        }

        await existing.transport.handleRequest(req, res);
        return;
      }

      res.statusCode = 405;
      res.setHeader('allow', 'GET, POST, DELETE');
      res.end('Method Not Allowed');
    } catch (error) {
      if (error instanceof SyntaxError) {
        writeJsonRpcError(res, 400, -32700, 'Invalid JSON body');
        return;
      }

      if (!res.headersSent) {
        writeJsonRpcError(
          res,
          500,
          -32603,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(resolvedConfig.port, resolvedConfig.host, () => {
      httpServer.off('error', reject);
      resolve();
    });
  });

  const address = httpServer.address();
  const port =
    typeof address === 'object' && address !== null ? address.port : resolvedConfig.port;
  const url = `http://${resolvedConfig.host}:${port}${resolvedConfig.path}`;

  console.error(`critical-thinking-mcp server running on streamable HTTP at ${url}`);

  return {
    config: { ...resolvedConfig, port },
    server: httpServer,
    url,
    async close(): Promise<void> {
      for (const runtime of sessions.values()) {
        await runtime.transport.close();
      }
      sessions.clear();
      await new Promise<void>((resolve, reject) => {
        httpServer.close(error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}
