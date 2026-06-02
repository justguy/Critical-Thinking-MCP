/**
 * §7 blocker taxonomy unit tests — the mechanism→code map must be total over the
 * mechanisms the blocking gates emit, and must reject an unmapped mechanism (so a
 * new BLOCK path cannot ship without a §7 code).
 */

import { describe, it, expect } from 'vitest';

import {
  BLOCKER_TAXONOMY_CODES,
  taxonomyForMechanism,
  stampTaxonomy,
} from '../../src/enforcement/blocker_taxonomy.js';
import type { BlockingIssue } from '../../src/enforcement/types.js';

describe('blocker taxonomy (§7)', () => {
  it('exposes exactly the nine §7 codes', () => {
    expect(BLOCKER_TAXONOMY_CODES).toHaveLength(9);
    expect(new Set(BLOCKER_TAXONOMY_CODES).size).toBe(9);
    expect(BLOCKER_TAXONOMY_CODES).toContain('NUMERIC_MISMATCH');
    expect(BLOCKER_TAXONOMY_CODES).toContain('FINAL_ANSWER_ARTIFACT_DRIFT');
  });

  it.each([
    ['number_provenance', 'NUMERIC_MISMATCH'],
    ['arithmetic_mismatch', 'NUMERIC_MISMATCH'],
    ['number_input_anchor', 'NUMERIC_MISMATCH'],
    ['number_answer_binding', 'FINAL_ANSWER_ARTIFACT_DRIFT'],
    ['numeric_not_shipped', 'FINAL_ANSWER_ARTIFACT_DRIFT'],
    ['finalize_grounding', 'UNSUPPORTED_CLAIM'],
    ['quote_grounding', 'SOURCE_SPAN_MISMATCH'],
    ['must_include', 'MISSING_REQUIREMENT'],
    ['must_not_include', 'CONSTRAINT_VIOLATION'],
    ['constraint', 'CONSTRAINT_VIOLATION'],
  ])('maps mechanism %s → %s', (mechanism, code) => {
    expect(taxonomyForMechanism(mechanism)).toBe(code);
  });

  it('throws on an unmapped mechanism (no silent un-coded BLOCK)', () => {
    expect(() => taxonomyForMechanism('brand_new_unmapped_gate')).toThrow(/taxonomy code/i);
  });

  it('stampTaxonomy stamps blocking issues and leaves warnings alone', () => {
    const issues: BlockingIssue[] = [
      { mechanism: 'number_provenance', description: 'x', severity: 'blocking' },
      { mechanism: 'number_input_anchor', description: 'y', severity: 'warning' },
    ];
    stampTaxonomy(issues);
    expect(issues[0].taxonomy).toBe('NUMERIC_MISMATCH');
    expect(issues[1].taxonomy).toBeUndefined();
  });
});
