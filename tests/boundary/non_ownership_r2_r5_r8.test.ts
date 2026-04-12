/**
 * Boundary assertion tests — Slice 2
 *
 * Locks in the non-ownership boundary for Phalanx requirements R-2, R-5, R-8.
 * All assertions read from the authoritative TOOLS export; nothing is hardcoded
 * independently. If a banned name or property appears, the test fails loudly.
 *
 * Requirements addressed:
 *   R-2: Phalanx owns rebuttal loop schema + cap — ct-mcp exposes no rebuttal tool.
 *   R-5: Phalanx owns hallucinated-seam detection — entity_grounding is response-text only.
 *   R-8: Phalanx owns retry-contract drift — detect_drift is numeric CUSUM only.
 */

import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../src/mcp/tool-definitions.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toolByName(name: string) {
  return TOOLS.find((t) => t.name === name);
}

function topLevelProperties(toolName: string): string[] {
  const tool = toolByName(toolName);
  if (!tool) return [];
  const schema = tool.inputSchema as { properties?: Record<string, unknown> };
  return Object.keys(schema.properties ?? {});
}

// ---------------------------------------------------------------------------
// R-2: No rebuttal-loop tool registered
// ---------------------------------------------------------------------------

describe('R-2 boundary — no rebuttal tool registered', () => {
  const BANNED_REBUTTAL_NAMES = [
    'rebuttal_cap',
    'rebuttal_schema',
    'validate_rebuttal',
    'verify_rebuttal',
    'rebuttal_loop',
  ] as const;

  const registeredNames = TOOLS.map((t) => t.name);

  for (const banned of BANNED_REBUTTAL_NAMES) {
    it(`no tool named "${banned}" is registered`, () => {
      expect(registeredNames).not.toContain(banned);
    });
  }
});

// ---------------------------------------------------------------------------
// R-5: No seam-grounding tool registered
// ---------------------------------------------------------------------------

describe('R-5 boundary — no seam/repo-grounding tool registered', () => {
  const BANNED_SEAM_NAMES = [
    'verify_seam',
    'seam_grounding',
    'repo_entity_grounding',
  ] as const;

  const registeredNames = TOOLS.map((t) => t.name);

  for (const banned of BANNED_SEAM_NAMES) {
    it(`no tool named "${banned}" is registered`, () => {
      expect(registeredNames).not.toContain(banned);
    });
  }
});

// ---------------------------------------------------------------------------
// R-8: No retry/contract-drift tool registered
// ---------------------------------------------------------------------------

describe('R-8 boundary — no retry-contract drift tool registered', () => {
  const BANNED_DRIFT_NAMES = [
    'retry_drift',
    'contract_drift',
    'verify_contract',
    'compare_contracts',
  ] as const;

  const registeredNames = TOOLS.map((t) => t.name);

  for (const banned of BANNED_DRIFT_NAMES) {
    it(`no tool named "${banned}" is registered`, () => {
      expect(registeredNames).not.toContain(banned);
    });
  }
});

// ---------------------------------------------------------------------------
// detect_drift inputSchema — must NOT contain contract-shaped top-level keys
// ---------------------------------------------------------------------------

describe('detect_drift inputSchema — contract-shaped keys absent', () => {
  const BANNED_PROPS = [
    'contract',
    'prior_contract',
    'current_contract',
    'prior',
    'current',
    'seam_id',
    'fields',
    'justification_refs',
  ] as const;

  const props = topLevelProperties('detect_drift');

  for (const banned of BANNED_PROPS) {
    it(`detect_drift has no top-level property "${banned}"`, () => {
      expect(props).not.toContain(banned);
    });
  }
});

// ---------------------------------------------------------------------------
// score_response_quality inputSchema — must NOT contain repo-grounding keys
// ---------------------------------------------------------------------------

describe('score_response_quality inputSchema — repo-grounding keys absent', () => {
  const BANNED_PROPS = [
    'repo_root',
    'file_list',
    'files',
    'symbol_table',
    'symbols',
    'target_shell',
    'target_shells',
  ] as const;

  const props = topLevelProperties('score_response_quality');

  for (const banned of BANNED_PROPS) {
    it(`score_response_quality has no top-level property "${banned}"`, () => {
      expect(props).not.toContain(banned);
    });
  }
});

// ---------------------------------------------------------------------------
// Disclaimer strings are present in the descriptions
// ---------------------------------------------------------------------------

describe('disclaimer strings present in tool descriptions', () => {
  it('detect_drift description contains the R-8 disclaimer', () => {
    const tool = toolByName('detect_drift');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain(
      'Numeric-series drift only; NOT a retry-contract drift detector (see Phalanx R-8).',
    );
  });

  it('score_response_quality description contains the R-5 disclaimer', () => {
    const tool = toolByName('score_response_quality');
    expect(tool).toBeDefined();
    expect(tool!.description).toContain(
      'Entity grounding here is scoped to response-text entities; NOT repo-level seam, symbol, or file-existence checking (see Phalanx R-5).',
    );
  });
});
