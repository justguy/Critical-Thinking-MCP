/**
 * Phase 4 — STEP 2: ONE unified `claude -p` stream-json adapter for ALL FOUR arms.
 *
 * Generalizes benchmark/model_adapter.ts (which is single-shot, empty-MCP, JSON
 * output) into the multi-turn, real-MCP, stream-json path the ablation needs.
 * Same hard constraint as model_adapter: NO billed/paid API. We spawn the LOCAL
 * `claude` CLI from os.tmpdir() with ANTHROPIC_API_KEY deleted (CLI session auth);
 * we never import the Anthropic SDK. See docs/designs/PHASE4_PREREGISTRATION.md
 * §1/§11 and benchmark/phase4/STEP1_FINDINGS.md (Amendment A).
 *
 * Arm mapping (all through this one code path — the parity linchpin §5):
 *   A : empty MCP, SHARED_COT_SYS  (no mcpConfig, no allowedTools)
 *   B : real ct-mcp server (11 tools), BIND_SYS, allowedTools 'mcp__ct-mcp__*'
 *   C : empty MCP, CHECKLIST_SYS   (no mcpConfig, no allowedTools)
 *   D : ct-mcp server with CT_DISABLE_FINALIZE=1 (10 tools), NOBIND_SYS
 *
 * stream-json REQUIRES --verbose with --print (confirmed STEP-1). The top-level
 * `result.usage` is the authoritative token ledger (Amendment A3 withdrew
 * per-turn reconciliation: per-turn stream usage is streaming-delta, not
 * billable). No model calls happen in any test — parseStreamJson + billedTokens
 * are pure and are exercised against a captured fixture.
 */

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

// ── Parsed-transcript types ──────────────────────────────────────────────────

export interface McpServerStatus {
  name: string;
  status: string;
}

export interface ToolUse {
  name: string;
  id: string;
  input: unknown;
}

export interface ToolResult {
  id: string;
  content: unknown;
}

/**
 * One finalize_deliverable result's binding signals. STEP-1 showed a single
 * task can emit MANY finalize calls (22 in the smoke), so EVERY finalize result
 * is captured. answer_text_hash / plan_token / verdict are null when that
 * particular call errored before binding (e.g. an MCP -32603 schema rejection).
 */
export interface FinalizeBinding {
  answer_text_hash: string | null;
  plan_token: string | null;
  verdict: string | null;
}

/**
 * Top-level usage ledger (Amendment A3: authoritative per-task ledger). Fields
 * mirror the CLI `result.usage` shape; absent fields default to 0.
 */
export interface UsageLedger {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface ArmTranscript {
  /** The final surfaced answer text (`result.result`), '' if absent. */
  final_text: string;
  /** The value after the required `FINAL ANSWER:` sentinel, or null. */
  final_answer_sentinel: string | null;
  /** `result.subtype` (e.g. 'success', 'error_max_turns'), or null. */
  result_subtype: string | null;
  /** MCP servers reported at init (name + status). */
  mcp_servers: McpServerStatus[];
  /** The `mcp__ct-mcp__*` tools advertised at init (full names). */
  advertised_ct_tools: string[];
  /** Every assistant tool_use across the transcript. */
  tool_uses: ToolUse[];
  /** Every tool_result fed back to the model. */
  tool_results: ToolResult[];
  /** Binding signals parsed from EVERY finalize_deliverable result. */
  finalize_bindings: FinalizeBinding[];
  /** Authoritative top-level token ledger (Amendment A3). */
  usage: UsageLedger;
  /** `result.num_turns` (the CLI's own count), or null. */
  num_turns: number | null;
  /** `result.total_cost_usd` (a witness, NOT a metric — de-dollarized §6). */
  total_cost_usd: number | null;
  /** `result.permission_denials` (must be [] for a scored B/D row, §5). */
  permission_denials: unknown[];
}

// ── Pure parser ──────────────────────────────────────────────────────────────

const FINAL_ANSWER_RE = /FINAL ANSWER:\s*(.+?)\s*$/im;

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Stringify tool_result content (string or content-block array) for scanning. */
function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content;
  return JSON.stringify(content);
}

function matchField(blob: string, field: string): string | null {
  const m = blob.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`));
  return m ? m[1] : null;
}

/**
 * Parse `claude --output-format stream-json` JSONL into a structured transcript.
 * PURE: no I/O, no spawning. Unparseable lines are skipped (tolerant of the
 * trailing/partial lines a killed stream can leave).
 */
export function parseStreamJson(raw: string): ArmTranscript {
  const events: any[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // skip partial / non-JSON line
    }
  }

  const init = events.find(e => e?.type === 'system' && e?.subtype === 'init');
  const result = events.find(e => e?.type === 'result');

  const mcp_servers: McpServerStatus[] = Array.isArray(init?.mcp_servers)
    ? init.mcp_servers.map((s: any) => ({ name: String(s?.name), status: String(s?.status) }))
    : [];

  const advertised_ct_tools: string[] = Array.isArray(init?.tools)
    ? init.tools.filter((t: unknown) => typeof t === 'string' && t.startsWith('mcp__ct-mcp__'))
    : [];

  const tool_uses: ToolUse[] = [];
  const tool_results: ToolResult[] = [];
  for (const e of events) {
    if (e?.type === 'assistant' && Array.isArray(e?.message?.content)) {
      for (const c of e.message.content) {
        if (c?.type === 'tool_use') {
          tool_uses.push({ name: String(c.name), id: String(c.id), input: c.input });
        }
      }
    }
    if (e?.type === 'user' && Array.isArray(e?.message?.content)) {
      for (const c of e.message.content) {
        if (c?.type === 'tool_result') {
          tool_results.push({ id: String(c.tool_use_id), content: c.content });
        }
      }
    }
  }

  // Capture EVERY finalize_deliverable result's binding signals (STEP-1: many).
  const finalizeUseIds = new Set(
    tool_uses.filter(t => t.name.includes('finalize_deliverable')).map(t => t.id),
  );
  const finalize_bindings: FinalizeBinding[] = [];
  for (const tr of tool_results) {
    if (!finalizeUseIds.has(tr.id)) continue;
    const blob = stringifyContent(tr.content);
    finalize_bindings.push({
      answer_text_hash: matchField(blob, 'answer_text_hash'),
      plan_token: matchField(blob, 'plan_token'),
      verdict: matchField(blob, 'finalize_verdict'),
    });
  }

  const rawUsage = result?.usage ?? {};
  const usage: UsageLedger = {
    input_tokens: asNumber(rawUsage.input_tokens),
    output_tokens: asNumber(rawUsage.output_tokens),
    cache_creation_input_tokens: asNumber(rawUsage.cache_creation_input_tokens),
    cache_read_input_tokens: asNumber(rawUsage.cache_read_input_tokens),
  };

  const final_text = typeof result?.result === 'string' ? result.result : '';
  const sentinelMatch = final_text.match(FINAL_ANSWER_RE);

  const permission_denials = Array.isArray(result?.permission_denials)
    ? result.permission_denials
    : [];

  return {
    final_text,
    final_answer_sentinel: sentinelMatch ? sentinelMatch[1] : null,
    result_subtype: typeof result?.subtype === 'string' ? result.subtype : null,
    mcp_servers,
    advertised_ct_tools,
    tool_uses,
    tool_results,
    finalize_bindings,
    usage,
    num_turns: typeof result?.num_turns === 'number' ? result.num_turns : null,
    total_cost_usd: typeof result?.total_cost_usd === 'number' ? result.total_cost_usd : null,
    permission_denials,
  };
}

// ── Weighted-token helper (Amendment A3) ─────────────────────────────────────

export interface BilledTokenWeights {
  /** cache_read weight ≈ 0.1× base input (billed-discount approximation). */
  cacheReadWeight?: number;
  /** cache_creation weight ≈ 1.25× base input (billed-discount approximation). */
  cacheCreationWeight?: number;
}

/**
 * Discount-weighted token total for `quality_per_1k_tokens` (Amendment A3).
 *
 * The defaults are the BILLED-DISCOUNT APPROXIMATION: a cache_read token bills
 * at ~0.1× of a base input token and a cache_creation token at ~1.25×. Weights
 * are params so the freeze record can pin the exact published rates. input and
 * output tokens are charged at 1.0× (full weight). This is what stops arm B
 * "winning" on a 1.38M-token cache_read tail (STEP-1) being charged at face.
 */
export function billedTokens(
  usage: UsageLedger,
  weights: BilledTokenWeights = {},
): number {
  const cacheReadWeight = weights.cacheReadWeight ?? 0.1;
  const cacheCreationWeight = weights.cacheCreationWeight ?? 1.25;
  return (
    usage.input_tokens +
    usage.output_tokens +
    usage.cache_creation_input_tokens * cacheCreationWeight +
    usage.cache_read_input_tokens * cacheReadWeight
  );
}

// ── Spawn wrapper with harness-side hard-stop ────────────────────────────────

export type TruncatedBy = 'turns' | 'output_tokens' | 'wall_clock' | null;

export interface RunArmOptions {
  /** The task prompt (positional, FIRST — before the variadic --mcp-config). */
  prompt: string;
  /** Full dated model id (e.g. 'claude-haiku-4-5-20251001') or alias. */
  model: string;
  /** Optional appended system prompt (--append-system-prompt). */
  appendSystemPrompt?: string;
  /**
   * Optional MCP config OBJECT (serialized to JSON for --mcp-config). Omit for
   * the empty-MCP arms (A/C) — then --strict-mcp-config + '{"mcpServers":{}}'
   * is used so the repo .mcp.json / CLAUDE.md are never discovered.
   */
  mcpConfig?: object;
  /** Optional --allowedTools value (e.g. 'mcp__ct-mcp__*' for B/D). */
  allowedTools?: string;
  /** --permission-mode (default 'acceptEdits' per §5; NOT 'auto'). */
  permissionMode?: string;
  /** Non-binding CLI runaway backstop --max-budget-usd (§5 runaway stop). */
  maxBudgetUsd?: number;

  // ── Harness-side hard-stop caps (no --max-turns flag exists; we monitor the
  //    stream incrementally and KILL the child). Cap VALUES are calibrated later
  //    per Amendment A2 — these are mechanism + sane defaults only.
  /** Kill after this many COMPLETE model turns. Default 8. */
  maxAssistantTurns?: number;
  /** Kill after cumulative output_tokens (best-effort from stream usage). Default 200_000. */
  maxOutputTokens?: number;
  /** Kill after this much wall-clock time (ms). Default 180_000. */
  wallClockMs?: number;
  /** Absolute spawn-timeout safety net (ms). Default = wallClockMs + 30s. */
  hardTimeoutMs?: number;
}

export interface RunArmResult {
  /** The structured transcript parsed from whatever stream-json we captured. */
  transcript: ArmTranscript;
  /** Raw stream-json stdout (for archiving / re-parse). */
  raw: string;
  /** Captured stderr tail (diagnostics). */
  stderr: string;
  /** Process exit code (null when we killed it). */
  exit_code: number | null;
  /** Which harness cap fired, if any; null = the model finished on its own. */
  truncated_by: TruncatedBy;
  /** True on spawn failure / no usable output. */
  error: boolean;
  error_detail?: string;
  /** The exact argv used (reproducibility / audit). */
  invocation: string[];
}

const EMPTY_MCP_CONFIG = '{"mcpServers":{}}';
const DEFAULT_MAX_TURNS = 8;
const DEFAULT_MAX_OUTPUT_TOKENS = 200_000;
const DEFAULT_WALL_CLOCK_MS = 180_000;

/**
 * Build the claude argv for one arm. Prompt is FIRST (positional) so the
 * variadic --mcp-config cannot consume it (same gotcha as model_adapter).
 * Exported for testability.
 */
export function buildArmArgs(opts: RunArmOptions): string[] {
  const args = [
    '-p', opts.prompt,
    '--model', opts.model,
    '--output-format', 'stream-json',
    '--verbose', // REQUIRED for stream-json with --print (STEP-1).
    '--strict-mcp-config',
    '--mcp-config', opts.mcpConfig ? JSON.stringify(opts.mcpConfig) : EMPTY_MCP_CONFIG,
  ];
  if (opts.allowedTools) {
    args.push('--allowedTools', opts.allowedTools);
  }
  args.push('--permission-mode', opts.permissionMode ?? 'acceptEdits');
  if (opts.appendSystemPrompt) {
    args.push('--append-system-prompt', opts.appendSystemPrompt);
  }
  if (typeof opts.maxBudgetUsd === 'number') {
    args.push('--max-budget-usd', String(opts.maxBudgetUsd));
  }
  return args;
}

/**
 * Count COMPLETE model turns seen so far in the accumulated stream-json text.
 *
 * Why distinct assistant `message.id` and NOT raw assistant events: STEP-1 had
 * num_turns=25 but ~58 partial `type:"assistant"` events — the CLI emits one
 * assistant event PER streaming content block (thinking, text, tool_use), all
 * sharing one `message.id` per model turn. Counting raw events would over-count
 * ~2.4× and trip the turn cap mid-turn. Collapsing by `message.id` yields 24
 * distinct turns, matching the CLI's own `num_turns`. (This CLI build emits no
 * per-event `stop_reason`, so id-grouping is the robust boundary; events with
 * no id fall back to a 1-per-event count so a malformed stream still advances.)
 */
function countCompleteTurns(accumulated: string): number {
  const ids = new Set<string>();
  let unidentified = 0;
  for (const line of accumulated.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let e: any;
    try {
      e = JSON.parse(trimmed);
    } catch {
      continue; // partial trailing line — wait for the rest
    }
    if (e?.type !== 'assistant') continue;
    const id = e?.message?.id;
    if (typeof id === 'string' && id) ids.add(id);
    else unidentified += 1;
  }
  return ids.size + unidentified;
}

/** Best-effort cumulative output-token estimate from the (delta) stream usage. */
function sumStreamOutputTokens(accumulated: string): number {
  let total = 0;
  for (const line of accumulated.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let e: any;
    try {
      e = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const ot = e?.message?.usage?.output_tokens;
    if (typeof ot === 'number') total += ot;
  }
  return total;
}

/**
 * Drive `claude -p` for one arm, monitoring the stream incrementally and
 * KILLING the child when a harness-side cap is exceeded (no --max-turns flag
 * exists). cwd=os.tmpdir(), ANTHROPIC_API_KEY deleted, stdin closed (< /dev/null
 * equivalent) to avoid the 3s stdin wait STEP-1 hit. Always resolves (never
 * throws): failures are returned as `{ error: true }` so the harness records a
 * row instead of crashing.
 */
export function runArm(opts: RunArmOptions): Promise<RunArmResult> {
  const args = buildArmArgs(opts);
  const invocation = ['claude', ...args];
  const maxTurns = opts.maxAssistantTurns ?? DEFAULT_MAX_TURNS;
  const maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  const wallClockMs = opts.wallClockMs ?? DEFAULT_WALL_CLOCK_MS;
  const hardTimeoutMs = opts.hardTimeoutMs ?? wallClockMs + 30_000;

  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;

  return new Promise<RunArmResult>(resolve => {
    let out = '';
    let err = '';
    let truncatedBy: TruncatedBy = null;
    let settled = false;

    // stdin: 'ignore' closes the child's stdin (the '< /dev/null' equivalent),
    // avoiding the 3s interactive stdin wait STEP-1 observed.
    const child = spawn('claude', args, {
      cwd: tmpdir(),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const kill = (reason: TruncatedBy): void => {
      if (settled) return;
      truncatedBy = reason;
      child.kill('SIGKILL');
    };

    const wallTimer = setTimeout(() => kill('wall_clock'), wallClockMs);
    const hardTimer = setTimeout(() => kill('wall_clock'), hardTimeoutMs);

    child.stdout?.on('data', (d: Buffer) => {
      out += d.toString();
      if (settled) return;
      if (countCompleteTurns(out) > maxTurns) {
        kill('turns');
      } else if (sumStreamOutputTokens(out) > maxOutputTokens) {
        kill('output_tokens');
      }
    });
    child.stderr?.on('data', (d: Buffer) => {
      err += d.toString();
    });

    const finish = (exitCode: number | null, spawnError?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(wallTimer);
      clearTimeout(hardTimer);

      const transcript = parseStreamJson(out);
      const base: RunArmResult = {
        transcript,
        raw: out,
        stderr: err.slice(-2000),
        exit_code: exitCode,
        truncated_by: truncatedBy,
        error: false,
        invocation,
      };

      if (spawnError) {
        resolve({ ...base, error: true, error_detail: `spawn failed: ${spawnError.message}` });
        return;
      }
      // A clean (non-truncated) run with no parseable result is an error row.
      if (!truncatedBy && exitCode !== 0 && out.trim() === '') {
        resolve({ ...base, error: true, error_detail: `exit ${exitCode}: ${err.slice(-500)}` });
        return;
      }
      resolve(base);
    };

    child.on('error', e => finish(null, e));
    child.on('close', code => finish(code));
  });
}
