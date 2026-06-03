/**
 * Phase 4 — STEP 1 (BLOCKING) CLI->real-MCP smoke for arm B.
 *
 * Proves NON-INTERACTIVELY that `claude -p` can drive multi-turn MCP tool use
 * against the REAL built ct-mcp server (dist/server.js), and that the token
 * ledger + binding are recoverable. This is a FEASIBILITY probe — no scored
 * data, no frozen thresholds. See docs/designs/PHASE4_PREREGISTRATION.md §11.
 *
 * Parity with benchmark/model_adapter.ts: spawn from os.tmpdir(), ANTHROPIC_API_KEY
 * deleted (CLI session auth, no billed API). --strict-mcp-config so the repo
 * .mcp.json is never loaded; the ct-mcp server is the ONLY MCP surface.
 *
 * Usage: node benchmark/phase4/step1_smoke.mjs [--model haiku] [--no-finalize]
 *   --no-finalize : start the server with CT_DISABLE_FINALIZE=1 (arm-D variant probe, sub-check g)
 */
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const SERVER = resolve(REPO, 'dist', 'server.js');

const argv = process.argv.slice(2);
const MODEL = (argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : 'haiku');
const DISABLE_FINALIZE = argv.includes('--no-finalize');

// A multi-field numeric task: credit-weighted average. The model is told to use
// the ct-mcp tools so we can observe tool_use + finalize binding firing.
const TASK = [
  'You are answering under a verification protocol that REQUIRES you to use the ct-mcp tools.',
  'TASK: A student took three courses graded on a CREDIT-WEIGHTED average.',
  'Course 1: 3 credits, grade 80. Course 2: 4 credits, grade 70. Course 3: 2 credits, grade 95.',
  'Compute the credit-weighted average grade, rounded to two decimals.',
  '',
  'You MUST, in order:',
  '1. Call mcp__ct-mcp__check_numeric_claims declaring the leaf input numbers you are using.',
  '2. Call mcp__ct-mcp__finalize_deliverable with your final answer text so it is bound (it returns an answer_text_hash).',
  'Then end your reply with exactly: FINAL ANSWER: <number>',
].join('\n');

// MCP config: launch the REAL built server over stdio. Optionally disable finalize for the D-variant probe.
const mcpConfig = {
  mcpServers: {
    'ct-mcp': {
      command: 'node',
      args: [SERVER],
      ...(DISABLE_FINALIZE ? { env: { CT_DISABLE_FINALIZE: '1' } } : {}),
    },
  },
};

const args = [
  '-p', TASK,
  '--model', MODEL,
  '--output-format', 'stream-json',
  '--verbose', // required for stream-json with --print
  '--mcp-config', JSON.stringify(mcpConfig),
  '--strict-mcp-config',
  '--allowedTools', 'mcp__ct-mcp__*',
  '--permission-mode', 'acceptEdits',
  '--max-budget-usd', '0.50', // non-binding backstop; token ceiling is the real limit (not enforced in this probe)
];

const env = { ...process.env };
delete env.ANTHROPIC_API_KEY;

const variant = DISABLE_FINALIZE ? 'D(no-finalize)' : 'B(full)';
process.stderr.write(`[smoke] variant=${variant} model=${MODEL} server=${SERVER}\n`);
process.stderr.write(`[smoke] cwd=${tmpdir()} (neutral; repo .mcp.json/CLAUDE.md NOT loaded)\n`);

const child = spawn('claude', args, { cwd: tmpdir(), env, encoding: 'utf-8' });
let out = '';
let err = '';
child.stdout.on('data', (d) => { out += d.toString(); });
child.stderr.on('data', (d) => { err += d.toString(); });

const KILL_MS = 240_000;
const timer = setTimeout(() => { process.stderr.write('[smoke] TIMEOUT, killing\n'); child.kill('SIGKILL'); }, KILL_MS);

child.on('close', (code) => {
  clearTimeout(timer);
  const outPath = resolve(__dirname, `step1_smoke_${DISABLE_FINALIZE ? 'D' : 'B'}_raw.jsonl`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, out);

  // Parse the stream-json events.
  const events = out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  const init = events.find((e) => e.type === 'system' && e.subtype === 'init');
  const result = events.find((e) => e.type === 'result');
  const toolUses = [];
  const toolResults = [];
  for (const e of events) {
    if (e.type === 'assistant' && e.message?.content) {
      for (const c of e.message.content) if (c.type === 'tool_use') toolUses.push({ name: c.name, id: c.id, input: c.input });
    }
    if (e.type === 'user' && e.message?.content) {
      for (const c of e.message.content) if (c.type === 'tool_result') toolResults.push({ id: c.tool_use_id, content: c.content });
    }
  }

  // Sub-checks (a)-(g)
  const mcpServers = init?.mcp_servers ?? [];
  const ctServer = mcpServers.find((s) => s.name === 'ct-mcp');
  const advertisedTools = (init?.tools ?? []).filter((t) => String(t).startsWith('mcp__ct-mcp__'));
  const calledNames = toolUses.map((t) => t.name);
  const calledNumeric = calledNames.some((n) => n.includes('check_numeric_claims'));
  const calledFinalize = calledNames.some((n) => n.includes('finalize_deliverable'));
  // find a finalize tool_result carrying answer_text_hash / plan_token
  const finalizeUse = toolUses.find((t) => t.name.includes('finalize_deliverable'));
  let answerHash = null;
  if (finalizeUse) {
    const tr = toolResults.find((r) => r.id === finalizeUse.id);
    const blob = tr ? JSON.stringify(tr.content) : '';
    const m = blob.match(/answer_text_hash[":\s]+([a-z0-9:]+)/i) || blob.match(/plan_token[":\s]+([A-Za-z0-9_:.-]+)/);
    answerHash = m ? m[1] : (blob.includes('answer_text_hash') || blob.includes('plan_token') ? 'PRESENT(unparsed)' : null);
  }
  const usage = result?.usage ?? null;
  const permissionDenials = result?.permission_denials ?? result?.permissionDenials ?? null;

  const report = {
    variant, model: MODEL, exit_code: code,
    a_server_connected: ctServer?.status ?? `NO ct-mcp in mcp_servers (saw: ${mcpServers.map((s) => `${s.name}:${s.status}`).join(',') || 'none'})`,
    advertised_ct_tool_count: advertisedTools.length,
    advertised_includes_finalize: advertisedTools.some((t) => String(t).includes('finalize_deliverable')),
    b_tool_use_fired: toolUses.length > 0,
    b_called_check_numeric_claims: calledNumeric,
    c_called_finalize: calledFinalize,
    c_answer_text_hash: answerHash,
    d_usage: usage,
    d_num_turns: result?.num_turns ?? null,
    d_total_cost_usd: result?.total_cost_usd ?? null,
    f_permission_denials: permissionDenials,
    tool_use_sequence: calledNames,
    result_subtype: result?.subtype ?? null,
    result_text_tail: (result?.result ?? '').slice(-160),
    raw_saved: outPath,
    stderr_tail: err.slice(-400),
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
});
