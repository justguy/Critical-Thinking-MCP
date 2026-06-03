/**
 * Phase 4 — Deliverable 4 (CRITICAL): the BIND_SYS worked example is PROVEN to
 * RELEASE through the REAL finalize gate offline, and the prompt-set parity
 * invariants (§5) hold.
 *
 * NO model / claude-CLI calls anywhere — this runs the real handleFinalizeDeliverable
 * (the same handler dist/server.js exposes) directly on the structured bundle that
 * BIND_SYS hands the model as its worked example. If the example we coach with did
 * not actually pass the gate, B would be impractical (Amendment A2/A5) — so this
 * test is the offline proof that it does, plus a wrong-number mutation proving the
 * example is not vacuously passing.
 *
 * Parity asserts (§5 system-prompt byte control + allowed-tools matrix):
 *   - BIND_SYS vs NOBIND_SYS differ ONLY in the finalize/binding clause.
 *   - CHECKLIST_SYS length within ±15% of BIND_SYS.
 *   - armConfig(B) → 11-tool server + allowedTools; armConfig(D) → CT_DISABLE_FINALIZE=1;
 *     armConfig(A/C) → empty MCP + the right system prompt.
 */

import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';

import {
  SHARED_COT_SYS,
  BIND_SYS,
  NOBIND_SYS,
  WORKED_EXAMPLE_BUNDLE,
} from '../../benchmark/phase4/prompts.js';
import { CHECKLIST_SYS, checklistLengthRatio } from '../../benchmark/phase4/render_checklist_sys.js';
import { armConfig } from '../../benchmark/phase4/arms.js';
import { buildArmArgs } from '../../benchmark/phase4/arm_adapter.js';

const engine = () => new EnforcementEngine();

// Deep clone so a mutation never leaks into the frozen exported constant.
function cloneBundle(): typeof WORKED_EXAMPLE_BUNDLE {
  return JSON.parse(JSON.stringify(WORKED_EXAMPLE_BUNDLE));
}

// ════════════════════════════════════════════════════════════════════════════
// 1. The BIND_SYS worked example RELEASEs through the REAL gate (no model).
// ════════════════════════════════════════════════════════════════════════════

describe('Deliverable 4: BIND_SYS worked example proven through the real finalize gate', () => {
  it('RELEASE: the embedded credit-weighted bundle PASSES finalize_deliverable', () => {
    const out = handleFinalizeDeliverable(WORKED_EXAMPLE_BUNDLE, engine());

    expect(out.finalize_verdict).toBe('PASS');
    expect(out.status).toBe('PASS');
    // It actually exercised the numeric gate path (not vacuously PASSing on a profile dodge).
    expect(out.re_executed).toContain('trace_conclusion_numbers');
    expect(out.re_executed).toContain('verify_arithmetic');
    // A binding token is returned (this is the answer_text_hash chain BIND_SYS relies on).
    expect(out.answer_text_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('BLOCK: a wrong-conclusion mutation (plain mean 81.67) is REJECTED — not vacuous', () => {
    // The exact STEP-1 failure: declaring the plain mean (81.67) for a credit-weighted task.
    const mutant = cloneBundle();
    mutant.answer_text = 'The credit-weighted average grade is 81.67.\nFINAL ANSWER: 81.67';
    mutant.numeric_derivation.nodes[3].value = 81.67;
    mutant.arithmetic_checks[0].claimed_result = 81.67;
    mutant.contract.must_include = ['81.67'];

    const out = handleFinalizeDeliverable(mutant, engine());

    expect(out.finalize_verdict).toBe('BLOCK');
    const mechanisms = (out.enforcement?.blocking_issues ?? []).map(b => b.mechanism);
    // The weighted_average node no longer recomputes to its claimed value, AND the
    // arithmetic check fails — the gate catches the invalid derivation.
    expect(mechanisms).toContain('number_derivation_dag');
    expect(mechanisms).toContain('arithmetic_mismatch');
  });

  it('BLOCK: mutating ONLY the rendered answer number (ledger still 78.89) is REJECTED', () => {
    // The drift case: derivation/arithmetic stay correct but the surfaced number lies.
    const mutant = cloneBundle();
    mutant.answer_text = 'The credit-weighted average grade is 80.00.\nFINAL ANSWER: 80.00';
    mutant.contract.must_include = ['78.89']; // contract still demands the true value

    const out = handleFinalizeDeliverable(mutant, engine());

    expect(out.finalize_verdict).toBe('BLOCK');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. §5 system-prompt byte control: BIND_SYS vs NOBIND_SYS differ ONLY in the
//    binding clause; the worked example + everything else is byte-identical.
// ════════════════════════════════════════════════════════════════════════════

/** Length of the common prefix two strings share. */
function commonPrefixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
/** Length of the common suffix two strings share. */
function commonSuffixLen(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

describe('§5 byte control: BIND_SYS vs NOBIND_SYS differ ONLY in the binding clause', () => {
  it('the diff is a single contiguous middle region (the binding clause) and nothing else', () => {
    expect(BIND_SYS).not.toBe(NOBIND_SYS);

    const prefix = commonPrefixLen(BIND_SYS, NOBIND_SYS);
    const suffix = commonSuffixLen(BIND_SYS, NOBIND_SYS);
    // Prefix + suffix must not overlap (a single contiguous diff region).
    expect(prefix + suffix).toBeLessThanOrEqual(Math.min(BIND_SYS.length, NOBIND_SYS.length));

    const bindMiddle = BIND_SYS.slice(prefix, BIND_SYS.length - suffix);
    const nobindMiddle = NOBIND_SYS.slice(prefix, NOBIND_SYS.length - suffix);

    // The BIND middle is the finalize/binding clause; the NOBIND middle is the
    // "do NOT call finalize_deliverable; state your final answer directly" clause.
    expect(bindMiddle).toMatch(/finalize_deliverable/);
    expect(bindMiddle).toMatch(/answer_text_hash/);
    expect(nobindMiddle).toMatch(/Do NOT call finalize_deliverable/);
    expect(nobindMiddle).toMatch(/state your final answer directly/);

    // Crucially the diff does NOT touch the worked example or contract instructions:
    const sharedPrefix = BIND_SYS.slice(0, prefix);
    expect(sharedPrefix).toContain('WORKED EXAMPLE');
    expect(sharedPrefix).toContain('numeric_derivation');
    expect(sharedPrefix).toContain('weighted_average');
    expect(sharedPrefix).toContain('plan_checks');
  });

  it('both prompts share the identical FINAL ANSWER sentinel suffix', () => {
    const sentinel = 'FINAL ANSWER: <value>';
    expect(BIND_SYS.endsWith(sentinel)).toBe(true);
    expect(NOBIND_SYS.endsWith(sentinel)).toBe(true);
    expect(SHARED_COT_SYS.endsWith(sentinel)).toBe(true);
    expect(CHECKLIST_SYS.endsWith(sentinel)).toBe(true);
  });

  it('the bind-only middle never appears in NOBIND, and vice versa', () => {
    const prefix = commonPrefixLen(BIND_SYS, NOBIND_SYS);
    const suffix = commonSuffixLen(BIND_SYS, NOBIND_SYS);
    const bindMiddle = BIND_SYS.slice(prefix, BIND_SYS.length - suffix);
    const nobindMiddle = NOBIND_SYS.slice(prefix, NOBIND_SYS.length - suffix);
    expect(NOBIND_SYS.includes(bindMiddle)).toBe(false);
    expect(BIND_SYS.includes(nobindMiddle)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. §5 length parity: CHECKLIST_SYS within ±15% of BIND_SYS.
// ════════════════════════════════════════════════════════════════════════════

describe('§5 length parity: CHECKLIST_SYS within ±15% of BIND_SYS', () => {
  it('rendered CHECKLIST_SYS sits inside the ±15% band', () => {
    const ratio = checklistLengthRatio();
    expect(ratio).toBeGreaterThanOrEqual(0.85);
    expect(ratio).toBeLessThanOrEqual(1.15);
  });

  it('CHECKLIST_SYS is the prose-only control: no enforcement-tool call instructions', () => {
    // It must NOT instruct the model to CALL any ct-mcp tool (it has none) — the ONLY
    // semantic delta vs BIND_SYS is "do this yourself" vs "you have tools that enforce this".
    expect(CHECKLIST_SYS).not.toMatch(/mcp__ct-mcp__/);
    expect(CHECKLIST_SYS).not.toMatch(/Call (?:plan_checks|finalize_deliverable)/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. §5 arm-config matrix: the four armConfig outputs are correct.
// ════════════════════════════════════════════════════════════════════════════

const PARAMS = { task: 'TASK BODY', model: 'claude-haiku-4-5-20251001' };

function mcpServerArg(argv: string[]): any {
  const idx = argv.indexOf('--mcp-config');
  expect(idx).toBeGreaterThanOrEqual(0);
  return JSON.parse(argv[idx + 1]);
}

describe('§5 arm-config matrix', () => {
  it('A: empty MCP + SHARED_COT_SYS, no tools', () => {
    const opts = armConfig('A', PARAMS);
    expect(opts.mcpConfig).toBeUndefined();
    expect(opts.allowedTools).toBeUndefined();
    expect(opts.appendSystemPrompt).toBe(SHARED_COT_SYS);

    const argv = buildArmArgs(opts);
    expect(mcpServerArg(argv)).toEqual({ mcpServers: {} });
    expect(argv).not.toContain('--allowedTools');
  });

  it('C: empty MCP + CHECKLIST_SYS, no tools', () => {
    const opts = armConfig('C', PARAMS);
    expect(opts.mcpConfig).toBeUndefined();
    expect(opts.allowedTools).toBeUndefined();
    expect(opts.appendSystemPrompt).toBe(CHECKLIST_SYS);

    const argv = buildArmArgs(opts);
    expect(mcpServerArg(argv)).toEqual({ mcpServers: {} });
    expect(argv).not.toContain('--allowedTools');
  });

  it('B: real ct-mcp server (finalize advertised) + allowedTools + BIND_SYS + acceptEdits', () => {
    const opts = armConfig('B', PARAMS);
    expect(opts.appendSystemPrompt).toBe(BIND_SYS);
    expect(opts.allowedTools).toBe('mcp__ct-mcp__*');
    expect(opts.permissionMode).toBe('acceptEdits');

    const argv = buildArmArgs(opts);
    const cfg = mcpServerArg(argv);
    const server = cfg.mcpServers['ct-mcp'];
    expect(server.command).toBe('node');
    expect(server.args[0]).toMatch(/\/dist\/server\.js$/);
    // B must NOT disable finalize (it is the 11-tool, finalize-advertised server).
    expect(server.env).toBeUndefined();

    expect(argv).toContain('--allowedTools');
    expect(argv[argv.indexOf('--allowedTools') + 1]).toBe('mcp__ct-mcp__*');
    expect(argv[argv.indexOf('--permission-mode') + 1]).toBe('acceptEdits');
  });

  it('D: ct-mcp server with CT_DISABLE_FINALIZE=1 (10 tools) + allowedTools + NOBIND_SYS', () => {
    const opts = armConfig('D', PARAMS);
    expect(opts.appendSystemPrompt).toBe(NOBIND_SYS);
    expect(opts.allowedTools).toBe('mcp__ct-mcp__*');
    expect(opts.permissionMode).toBe('acceptEdits');

    const argv = buildArmArgs(opts);
    const cfg = mcpServerArg(argv);
    const server = cfg.mcpServers['ct-mcp'];
    expect(server.command).toBe('node');
    expect(server.args[0]).toMatch(/\/dist\/server\.js$/);
    // The single B-vs-D surface delta: D hides finalize at the SERVER level.
    expect(server.env).toEqual({ CT_DISABLE_FINALIZE: '1' });
  });

  it('frozen caps pass through identically (same value across all arms)', () => {
    const caps = { maxAssistantTurns: 8, maxOutputTokens: 1024, wallClockMs: 180_000, maxBudgetUsd: 5 };
    for (const arm of ['A', 'B', 'C', 'D'] as const) {
      const opts = armConfig(arm, { ...PARAMS, caps });
      expect(opts.maxAssistantTurns).toBe(8);
      expect(opts.maxOutputTokens).toBe(1024);
      expect(opts.wallClockMs).toBe(180_000);
      expect(opts.maxBudgetUsd).toBe(5);
    }
  });
});
