import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ErrorCode,
  ListResourcesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readProjectFile(relativePath: string): string {
  return readFileSync(join(PROJECT_ROOT, relativePath), 'utf-8');
}

export const RESOURCES = [
  {
    uri: 'ct-mcp://capability-map',
    name: 'Capability Map',
    description: 'Benchmark-backed assessment of what CT-MCP catches, including proven strengths, partial coverage, scope boundaries, and all 15 mechanisms.',
    mimeType: 'text/markdown',
    file: 'CAPABILITY_MAP.md',
  },
  {
    uri: 'ct-mcp://description',
    name: 'Description',
    description: 'Overview of the critical-thinking-mcp server: what it does, the nine tools, install instructions, and validation results.',
    mimeType: 'text/markdown',
    file: 'README.md',
  },
] as const;

export function registerResourceHandlers(server: Server): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: RESOURCES.map(({ uri, name, description, mimeType }) => ({
        uri,
        name,
        description,
        mimeType,
      })),
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const resource = RESOURCES.find((entry) => entry.uri === uri);

    if (!resource) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unknown resource: "${uri}". Available: ${RESOURCES.map((entry) => entry.uri).join(', ')}`,
      );
    }

    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: readProjectFile(resource.file),
        },
      ],
    };
  });
}
