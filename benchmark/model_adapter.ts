/**
 * CLI-only model adapter for the real-output benchmark harness (Phase 1a).
 *
 * HARD CONSTRAINT: no billed/paid API. This module drives a LOCAL CLI that
 * ships with the developer's environment. It NEVER reads ANTHROPIC_API_KEY and
 * NEVER imports or calls the Anthropic SDK. The only way it produces text is by
 * spawning the `claude` (or fallback `codex`) command-line binary.
 *
 * Verified working contract (from a NEUTRAL cwd):
 *
 *   claude -p '<prompt>' --model haiku --output-format json \
 *          --strict-mcp-config --mcp-config '{"mcpServers":{}}'
 *
 * returns JSON whose `.result` field is the model's text. The prompt MUST be
 * the positional argument that comes BEFORE `--mcp-config`, because that flag
 * is variadic and would otherwise swallow the prompt as a config path.
 *
 * `--strict-mcp-config --mcp-config '{"mcpServers":{}}'` forces an EMPTY MCP
 * surface, and spawning from os.tmpdir() means this repo's .mcp.json / CLAUDE.md
 * are never discovered. The model therefore answers the benchmark prompt with
 * NO tools — exactly the bare-model behavior the baseline/prompted arms need.
 */

import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

export type AdapterBackend = 'claude' | 'codex';

export interface ModelOutput {
  /** The model's answer text (`.result` for claude, stdout for codex). */
  text: string;
  /** The model identifier we asked the CLI to use (e.g. "haiku"). */
  model: string;
  /** The exact CLI backend that produced this output. */
  backend: AdapterBackend;
  /** True when the spawn failed or returned no usable text. */
  error: boolean;
  /** Human-readable error detail when `error` is true. */
  error_detail?: string;
  /** Raw structured payload from the CLI (parsed JSON or raw stdout). */
  raw: unknown;
  /** The exact argv used, for reproducibility / audit. */
  invocation: string[];
}

export interface AdapterOptions {
  /** Spawn timeout in milliseconds. Default 120_000. */
  timeoutMs?: number;
  /**
   * Optional JSON-schema file path. When set, passed as `--json-schema <file>`
   * (with --print) to force structured output. Caller owns the temp file.
   */
  jsonSchemaFile?: string;
  /** Backend to use. Default 'claude'; 'codex' is the documented fallback. */
  backend?: AdapterBackend;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const EMPTY_MCP_CONFIG = '{"mcpServers":{}}';

/**
 * Build the claude argv for a prompt. Prompt is FIRST (positional) so the
 * variadic --mcp-config cannot consume it. Exported for testability.
 */
export function buildClaudeArgs(prompt: string, model: string, opts: AdapterOptions = {}): string[] {
  const args = [
    '-p', prompt,
    '--model', model,
    '--output-format', 'json',
    '--strict-mcp-config',
    '--mcp-config', EMPTY_MCP_CONFIG,
  ];
  if (opts.jsonSchemaFile) {
    args.push('--json-schema', opts.jsonSchemaFile);
  }
  return args;
}

/** Build the codex fallback argv. Exported for testability. */
export function buildCodexArgs(prompt: string): string[] {
  return ['exec', prompt];
}

/**
 * Parse the claude CLI `--output-format json` stdout into answer text.
 * The contract: a JSON object with a `.result` string field. Exported so the
 * unit tests can verify parsing without spawning a live CLI.
 */
export function parseClaudeStdout(stdout: string): { text: string; raw: unknown } | null {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (
    parsed && typeof parsed === 'object' &&
    'result' in parsed && typeof (parsed as { result: unknown }).result === 'string'
  ) {
    return { text: (parsed as { result: string }).result, raw: parsed };
  }
  return null;
}

/**
 * Drive the local CLI to produce a real model answer for `prompt`.
 *
 * Returns a ModelOutput. On any failure (binary missing, non-zero exit,
 * unparseable output, timeout) it returns `{ error: true, text: '' }` rather
 * than throwing — the harness records the failure as a row instead of crashing.
 */
export function runModel(prompt: string, model: string, opts: AdapterOptions = {}): ModelOutput {
  const backend: AdapterBackend = opts.backend ?? 'claude';
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const args = backend === 'codex' ? buildCodexArgs(prompt) : buildClaudeArgs(prompt, model, opts);
  const bin = backend === 'codex' ? 'codex' : 'claude';

  // Neutral cwd: os.tmpdir() so this repo's .mcp.json / CLAUDE.md are NOT loaded.
  // Explicitly DO NOT forward ANTHROPIC_API_KEY — the CLI uses its own session
  // auth; we never inject a paid API key from this process.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;

  const result = spawnSync(bin, args, {
    cwd: tmpdir(),
    timeout,
    encoding: 'utf-8',
    maxBuffer: 16 * 1024 * 1024,
    env,
  });

  const invocation = [bin, ...args];

  if (result.error) {
    return {
      text: '', model, backend, error: true,
      error_detail: `spawn failed: ${result.error.message}`,
      raw: null, invocation,
    };
  }
  if (result.status !== 0) {
    return {
      text: '', model, backend, error: true,
      error_detail: `exit ${result.status}: ${(result.stderr ?? '').slice(0, 500)}`,
      raw: result.stdout ?? null, invocation,
    };
  }

  const stdout = result.stdout ?? '';

  if (backend === 'codex') {
    const text = stdout.trim();
    if (!text) {
      return { text: '', model, backend, error: true, error_detail: 'empty codex stdout', raw: stdout, invocation };
    }
    return { text, model, backend, error: false, raw: stdout, invocation };
  }

  const parsed = parseClaudeStdout(stdout);
  if (!parsed) {
    return {
      text: '', model, backend, error: true,
      error_detail: 'could not parse .result from claude JSON stdout',
      raw: stdout.slice(0, 1000), invocation,
    };
  }
  return { text: parsed.text, model, backend, error: false, raw: parsed.raw, invocation };
}
