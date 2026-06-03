/**
 * Phase 4 — the four arm drivers: thin configs over runArm/buildArmArgs from the
 * unified adapter (arm_adapter.ts). The parity linchpin (§5) is that ALL arms run
 * through ONE code path; these configs are the ONLY per-arm difference, and each
 * difference maps to exactly one ablation dimension:
 *
 *   A : empty MCP, SHARED_COT_SYS, no tools        — baseline + post-hoc oracle
 *   C : empty MCP, CHECKLIST_SYS, no tools         — structure-as-prose (no enforcement)
 *   B : real ct-mcp server (11 tools), BIND_SYS    — forced artifacts + finalize binding
 *   D : ct-mcp w/ CT_DISABLE_FINALIZE=1 (10 tools), NOBIND_SYS — forced artifacts, NO binding
 *
 * A vs C isolates ENFORCEMENT (both get CoT). D vs C isolates forced artifacts.
 * B vs D isolates BINDING (the single surface delta is finalize_deliverable +
 * the answer_text_hash chain). See PHASE4_PREREGISTRATION.md §1/§5.
 *
 * This module ONLY builds the runArm options object — it executes NO model calls
 * (that is the separate live-probe step). armConfig(arm, params) returns the opts;
 * the caller passes them to runArm. Pure config assembly.
 */

import type { RunArmOptions } from './arm_adapter.js';
import { SHARED_COT_SYS, BIND_SYS, NOBIND_SYS } from './prompts.js';
import { CHECKLIST_SYS } from './render_checklist_sys.js';

export type Arm = 'A' | 'B' | 'C' | 'D';

/** Absolute path to the built ct-mcp server (the real MCP for arms B/D). */
export const SERVER_PATH = '/Users/adilevinshtein/Documents/dev/ct-mcp/dist/server.js';

/** The allowedTools glob for the real-MCP arms (B and D). */
export const CT_ALLOWED_TOOLS = 'mcp__ct-mcp__*';

export interface ArmConfigParams {
  /** The task prompt (positional first arg to claude -p). */
  task: string;
  /** Full dated model id (e.g. 'claude-haiku-4-5-20251001') or alias. */
  model: string;
  /**
   * Optional frozen per-task ceilings (§5 BUDGET). Passed straight through to
   * runArm's harness-side hard-stop caps. Identical across all arms by the caller.
   */
  caps?: {
    maxAssistantTurns?: number;
    maxOutputTokens?: number;
    wallClockMs?: number;
    hardTimeoutMs?: number;
    maxBudgetUsd?: number;
  };
}

/** The MCP config OBJECT launching the real ct-mcp server (optionally finalize-disabled). */
function ctMcpConfig(disableFinalize: boolean): object {
  return {
    mcpServers: {
      'ct-mcp': {
        command: 'node',
        args: [SERVER_PATH],
        // Arm D advertises 10 tools (no finalize_deliverable) via the server-side
        // CT_DISABLE_FINALIZE filter (server-runtime.ts). --allowedTools gates
        // EXECUTION not VISIBILITY, so hiding finalize requires the server variant.
        ...(disableFinalize ? { env: { CT_DISABLE_FINALIZE: '1' } } : {}),
      },
    },
  };
}

function applyCaps(opts: RunArmOptions, caps: ArmConfigParams['caps']): RunArmOptions {
  if (!caps) return opts;
  const next = { ...opts };
  if (caps.maxAssistantTurns !== undefined) next.maxAssistantTurns = caps.maxAssistantTurns;
  if (caps.maxOutputTokens !== undefined) next.maxOutputTokens = caps.maxOutputTokens;
  if (caps.wallClockMs !== undefined) next.wallClockMs = caps.wallClockMs;
  if (caps.hardTimeoutMs !== undefined) next.hardTimeoutMs = caps.hardTimeoutMs;
  if (caps.maxBudgetUsd !== undefined) next.maxBudgetUsd = caps.maxBudgetUsd;
  return next;
}

/**
 * Build the runArm options for one arm. Does NOT run anything. The empty-MCP arms
 * (A/C) omit mcpConfig — runArm then uses --strict-mcp-config '{"mcpServers":{}}'
 * so the repo .mcp.json / CLAUDE.md are never discovered. The real-MCP arms (B/D)
 * pin --permission-mode acceptEdits via permissionMode (§5).
 */
export function armConfig(arm: Arm, params: ArmConfigParams): RunArmOptions {
  const { task, model, caps } = params;
  let opts: RunArmOptions;
  switch (arm) {
    case 'A':
      opts = {
        prompt: task,
        model,
        appendSystemPrompt: SHARED_COT_SYS,
        // no mcpConfig, no allowedTools → empty MCP
      };
      break;
    case 'C':
      opts = {
        prompt: task,
        model,
        appendSystemPrompt: CHECKLIST_SYS,
        // no mcpConfig, no allowedTools → empty MCP
      };
      break;
    case 'B':
      opts = {
        prompt: task,
        model,
        appendSystemPrompt: BIND_SYS,
        mcpConfig: ctMcpConfig(false), // 11 tools incl. finalize_deliverable
        allowedTools: CT_ALLOWED_TOOLS,
        permissionMode: 'acceptEdits',
      };
      break;
    case 'D':
      opts = {
        prompt: task,
        model,
        appendSystemPrompt: NOBIND_SYS,
        mcpConfig: ctMcpConfig(true), // 10 tools — CT_DISABLE_FINALIZE=1
        allowedTools: CT_ALLOWED_TOOLS,
        permissionMode: 'acceptEdits',
      };
      break;
    default: {
      const exhaustive: never = arm;
      throw new Error(`armConfig: unknown arm "${String(exhaustive)}".`);
    }
  }
  return applyCaps(opts, caps);
}
