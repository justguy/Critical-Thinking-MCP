/**
 * Non-ownership boundary assertions for R-3 (Deterministic Proof Classification)
 * and R-4 (Canonical Truth Enforcement).
 *
 * These tests lock in the structural guarantee that ct-mcp does NOT claim
 * ownership of R-3 or R-4 capabilities. Per the Phalanx requirements document
 * (non-negotiable constraint #6: "No capability inflation"), Phalanx must not
 * repurpose a nearby ct-mcp tool as if it solved a different requirement.
 *
 * Assertions are driven off the live TOOLS registry in src/mcp/tool-definitions.ts
 * so that any future accidental addition of a banned tool or input property is
 * caught immediately.
 *
 * NOTE: There is no unified output-type registry in ct-mcp. Tool return shapes
 * are inferred at runtime and are not declared in a shared TS interface catalogue.
 * The output-shape guard bullet from the prompt spec is therefore skipped; that
 * decision is documented in the slice 3 report.
 */

import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../src/mcp/tool-definitions.js';

// ────────────────────────────────────────────────────────────────────────────
// Constants: the banned name and property sets defined by R-3 / R-4 boundaries
// ────────────────────────────────────────────────────────────────────────────

/**
 * Tool names that ct-mcp must never register.
 * Owning any of these names would implicitly claim R-3 or R-4 ownership.
 */
const BANNED_TOOL_NAMES: readonly string[] = [
  'classify_test_proof',
  'proof_classifier',
  'classify_proof',
  'proof_class',
  'verify_canonical_truth',
  'canonical_truth',
  'closure_state',
  'closure_status',
  'verify_closure',
  'serialize_closure',
  'closure_reducer',
];

/**
 * Top-level inputSchema property names that ct-mcp tools must never accept.
 * Accepting any of these would constitute an implicit ownership claim over
 * proof classification (R-3) or canonical truth (R-4) payloads.
 */
const BANNED_INPUT_PROPERTIES: readonly string[] = [
  'proof_class',
  'test_receipts',
  'target_shell',
  'target_shells',
  'closure_status',
  'verified_state',
  'canonical_truth',
  'closure_truth',
  'verified_sources',
  'invariant_hash',
];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Extract top-level property keys from a JSON Schema object. */
function topLevelProperties(tool: (typeof TOOLS)[number]): string[] {
  const schema = tool.inputSchema as {
    properties?: Record<string, unknown>;
  };
  if (!schema.properties) return [];
  return Object.keys(schema.properties);
}

// ────────────────────────────────────────────────────────────────────────────
// Test suite
// ────────────────────────────────────────────────────────────────────────────

describe('Non-ownership boundary: R-3 Deterministic Proof Classification and R-4 Canonical Truth Enforcement', () => {
  // ── Guard: registry is non-empty ─────────────────────────────────────────

  it('TOOLS registry is non-empty (sanity check)', () => {
    expect(TOOLS.length).toBeGreaterThan(0);
  });

  // ── R-3 / R-4: No banned tool names registered ───────────────────────────

  it('no registered tool has a name that claims R-3 proof-classification ownership', () => {
    const r3BannedNames = [
      'classify_test_proof',
      'proof_classifier',
      'classify_proof',
      'proof_class',
    ];

    for (const bannedName of r3BannedNames) {
      const match = TOOLS.find((t) => t.name === bannedName);
      expect(
        match,
        `Tool "${bannedName}" must not exist — it would claim R-3 (proof classification) ownership which belongs to Phalanx`,
      ).toBeUndefined();
    }
  });

  it('no registered tool has a name that claims R-4 canonical-truth ownership', () => {
    const r4BannedNames = [
      'verify_canonical_truth',
      'canonical_truth',
      'closure_state',
      'closure_status',
      'verify_closure',
      'serialize_closure',
      'closure_reducer',
    ];

    for (const bannedName of r4BannedNames) {
      const match = TOOLS.find((t) => t.name === bannedName);
      expect(
        match,
        `Tool "${bannedName}" must not exist — it would claim R-4 (canonical truth / closure) ownership which belongs to Phalanx`,
      ).toBeUndefined();
    }
  });

  it('full banned-name list: no registered tool name matches any R-3 or R-4 banned identifier', () => {
    const registeredNames = TOOLS.map((t) => t.name);
    for (const banned of BANNED_TOOL_NAMES) {
      expect(
        registeredNames,
        `Banned tool name "${banned}" must not appear in the TOOLS registry`,
      ).not.toContain(banned);
    }
  });

  // ── R-3 / R-4: No banned input schema properties ─────────────────────────

  it('no tool inputSchema accepts a top-level property that claims R-3 proof-classification inputs', () => {
    const r3BannedProps = [
      'proof_class',
      'test_receipts',
      'target_shell',
      'target_shells',
    ];

    for (const tool of TOOLS) {
      const props = topLevelProperties(tool);
      for (const banned of r3BannedProps) {
        expect(
          props,
          `Tool "${tool.name}" must not accept top-level input property "${banned}" — accepting it implies R-3 proof-classification capability`,
        ).not.toContain(banned);
      }
    }
  });

  it('no tool inputSchema accepts a top-level property that claims R-4 canonical-truth inputs', () => {
    const r4BannedProps = [
      'closure_status',
      'verified_state',
      'canonical_truth',
      'closure_truth',
      'verified_sources',
      'invariant_hash',
    ];

    for (const tool of TOOLS) {
      const props = topLevelProperties(tool);
      for (const banned of r4BannedProps) {
        expect(
          props,
          `Tool "${tool.name}" must not accept top-level input property "${banned}" — accepting it implies R-4 canonical-truth / closure ownership`,
        ).not.toContain(banned);
      }
    }
  });

  it('full banned-property list: no tool accepts any R-3 or R-4 banned top-level input property', () => {
    for (const tool of TOOLS) {
      const props = topLevelProperties(tool);
      for (const banned of BANNED_INPUT_PROPERTIES) {
        expect(
          props,
          `Tool "${tool.name}" must not have top-level inputSchema property "${banned}"`,
        ).not.toContain(banned);
      }
    }
  });

  // ── Positive confirmation: expected nine tools exist ─────────────────────

  it('the nine expected ct-mcp tools are all present', () => {
    const expectedTools = [
      'validate_reasoning_chain',
      'check_numeric_claims',
      'detect_drift',
      'evaluate_tradeoffs',
      'check_plan_validity',
      'score_response_quality',
      'validate_confidence',
      'verify_arithmetic',
      'detect_concurrency_patterns',
    ];

    const registeredNames = TOOLS.map((t) => t.name);
    for (const expected of expectedTools) {
      expect(
        registeredNames,
        `Expected tool "${expected}" to be registered`,
      ).toContain(expected);
    }

    // The boundary enforced here is about banned names and banned input
    // properties, NOT a strict tool count. Additional non-banned tools
    // (e.g. integration envelopes added by Slice 1 such as
    // `integrate_phalanx_check`) are fully compatible with this boundary.
    expect(TOOLS.length).toBeGreaterThanOrEqual(expectedTools.length);
  });
});
