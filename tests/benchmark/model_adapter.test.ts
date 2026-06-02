/**
 * Model-adapter tests (plan §1a, HARD CONSTRAINT: CLI-only, no paid API).
 *
 * These verify argv construction and stdout parsing WITHOUT spawning a live CLI
 * (unit tests must be deterministic and offline). The actual end-to-end CLI call
 * is exercised by benchmark/smoke_real_output.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  buildClaudeArgs,
  buildCodexArgs,
  parseClaudeStdout,
} from '../../benchmark/model_adapter.js';

describe('buildClaudeArgs — verified working contract', () => {
  it('puts the prompt as the first positional so --mcp-config cannot swallow it', () => {
    const args = buildClaudeArgs('what is 2+2', 'haiku');
    // -p <prompt> must precede --mcp-config (variadic).
    const pIdx = args.indexOf('-p');
    const mcpIdx = args.indexOf('--mcp-config');
    expect(pIdx).toBe(0);
    expect(args[1]).toBe('what is 2+2');
    expect(pIdx).toBeLessThan(mcpIdx);
  });

  it('forces an empty, strict MCP surface', () => {
    const args = buildClaudeArgs('p', 'haiku');
    expect(args).toContain('--strict-mcp-config');
    const mcpIdx = args.indexOf('--mcp-config');
    expect(args[mcpIdx + 1]).toBe('{"mcpServers":{}}');
  });

  it('requests JSON output and the given model', () => {
    const args = buildClaudeArgs('p', 'sonnet');
    const ofIdx = args.indexOf('--output-format');
    expect(args[ofIdx + 1]).toBe('json');
    const mIdx = args.indexOf('--model');
    expect(args[mIdx + 1]).toBe('sonnet');
  });

  it('appends --json-schema when a schema file is supplied', () => {
    const args = buildClaudeArgs('p', 'haiku', { jsonSchemaFile: '/tmp/s.json' });
    const i = args.indexOf('--json-schema');
    expect(i).toBeGreaterThan(-1);
    expect(args[i + 1]).toBe('/tmp/s.json');
  });
});

describe('buildCodexArgs — documented fallback', () => {
  it('uses `exec <prompt>`', () => {
    expect(buildCodexArgs('hello')).toEqual(['exec', 'hello']);
  });
});

describe('parseClaudeStdout — contract is the .result field', () => {
  it('extracts .result text', () => {
    const out = parseClaudeStdout(JSON.stringify({ type: 'result', result: '391', is_error: false }));
    expect(out).not.toBeNull();
    expect(out!.text).toBe('391');
  });

  it('returns null on non-JSON', () => {
    expect(parseClaudeStdout('not json')).toBeNull();
  });

  it('returns null when .result is absent or not a string', () => {
    expect(parseClaudeStdout(JSON.stringify({ foo: 'bar' }))).toBeNull();
    expect(parseClaudeStdout(JSON.stringify({ result: 5 }))).toBeNull();
  });

  it('returns null on empty stdout', () => {
    expect(parseClaudeStdout('')).toBeNull();
  });
});
