/**
 * Phase 1b — thin artifact / provenance / grounding schema.
 *
 * Constructs valid + invalid artifact bundles and asserts the validators/guards
 * behave. These tests are the authoring surface Phase-2 mutations build on:
 * a "valid" bundle is the start-point; each "invalid" case is one mutation that
 * the validator must reject (bad provenance tier, missing grounding, dangling
 * binding, etc.). Nothing here asserts blocking enforcement — Phase 1b ships none.
 *
 * Plan refs: docs/designs/DETERMINISTIC_VALUE_PLAN.md §1b (chain), §3 (tiers),
 * §4 (grounding levels).
 */

import { describe, it, expect } from 'vitest';

import type { ArtifactBundle } from '../../src/enforcement/types.js';
import {
  ARTIFACT_PROVENANCE_TIERS,
  validateArtifactBundle,
  isArtifactBundle,
  isArtifact,
  isArtifactProvenance,
  isGroundingLevel,
  trustTier,
  isProofGrade,
  isPassEligibleClaim,
} from '../../src/enforcement/artifact_schema.js';

// A well-formed bundle exercising the full §1b chain:
// contract → requirements → artifacts (all 5 tiers) → final_answer_bindings.
function validBundle(): ArtifactBundle {
  return {
    contract_id: 'contract-1',
    requirements: [
      { id: 'req-1', text: 'State the renewal cadence.' },
      { id: 'req-2', text: 'Recommend an action.' },
    ],
    artifacts: [
      { id: 'src-1', provenance: 'host_extracted', kind: 'source_span', text: 'The contract renews annually.' },
      {
        id: 'claim-1',
        provenance: 'host_extracted',
        kind: 'claim',
        grounding_level: 'strong',
        text: 'The contract renews annually.',
        source_span_id: 'src-1',
        quoted_span: 'renews annually',
      },
      {
        id: 'claim-2',
        provenance: 'model_generated_reasoning',
        kind: 'claim',
        grounding_level: 'weak',
        text: 'This creates renewal risk.',
        source_span_id: 'src-1',
      },
      { id: 'assume-1', provenance: 'model_declared_assumption', kind: 'assumption', text: 'Pricing stays flat.' },
      { id: 'opt-1', provenance: 'host_authored', kind: 'option', text: 'Renegotiate before renewal.' },
      {
        id: 'rec-1',
        provenance: 'model_generated_recommendation',
        kind: 'claim',
        grounding_level: 'weak',
        text: 'Renegotiate now.',
        option_refs: ['opt-1'],
      },
    ],
    final_answer_bindings: [
      { field: 'cadence', binding_kind: 'claim', artifact_id: 'claim-1', rendered_value: 'annually' },
      { field: 'risk_note', binding_kind: 'claim', artifact_id: 'claim-2' },
      { field: 'recommendation', binding_kind: 'option', artifact_id: 'rec-1' },
      { field: 'caveat', binding_kind: 'judgment', rendered_value: 'Verify with counsel.' },
    ],
  };
}

describe('provenance enum (§3)', () => {
  it('has EXACTLY the five tiers in trust order', () => {
    expect(ARTIFACT_PROVENANCE_TIERS).toEqual([
      'host_authored',
      'host_extracted',
      'model_declared_assumption',
      'model_generated_reasoning',
      'model_generated_recommendation',
    ]);
  });

  it('isArtifactProvenance accepts members and rejects non-members', () => {
    for (const tier of ARTIFACT_PROVENANCE_TIERS) expect(isArtifactProvenance(tier)).toBe(true);
    expect(isArtifactProvenance('host_supplied')).toBe(false); // a SourceManifest origin, not a tier
    expect(isArtifactProvenance('model_generated')).toBe(false);
    expect(isArtifactProvenance(undefined)).toBe(false);
  });

  it('trustTier maps each provenance to 1..5', () => {
    expect(trustTier('host_authored')).toBe(1);
    expect(trustTier('host_extracted')).toBe(2);
    expect(trustTier('model_declared_assumption')).toBe(3);
    expect(trustTier('model_generated_reasoning')).toBe(4);
    expect(trustTier('model_generated_recommendation')).toBe(5);
  });

  it('isProofGrade is true only for tier-1/2', () => {
    expect(isProofGrade('host_authored')).toBe(true);
    expect(isProofGrade('host_extracted')).toBe(true);
    expect(isProofGrade('model_declared_assumption')).toBe(false);
    expect(isProofGrade('model_generated_reasoning')).toBe(false);
    expect(isProofGrade('model_generated_recommendation')).toBe(false);
  });
});

describe('grounding level (§4)', () => {
  it('isGroundingLevel accepts strong/weak only', () => {
    expect(isGroundingLevel('strong')).toBe(true);
    expect(isGroundingLevel('weak')).toBe(true);
    expect(isGroundingLevel('exact')).toBe(false);
    expect(isGroundingLevel(undefined)).toBe(false);
  });

  it('isPassEligibleClaim requires a claim that is tier-1/2 + strong (advisory predicate, not enforced)', () => {
    expect(
      isPassEligibleClaim({ id: 'c', provenance: 'host_extracted', kind: 'claim', grounding_level: 'strong' }),
    ).toBe(true);
    // tier ok but weak grounding
    expect(
      isPassEligibleClaim({ id: 'c', provenance: 'host_authored', kind: 'claim', grounding_level: 'weak' }),
    ).toBe(false);
    // strong grounding but model-tier
    expect(
      isPassEligibleClaim({
        id: 'c',
        provenance: 'model_generated_reasoning',
        kind: 'claim',
        grounding_level: 'strong',
      }),
    ).toBe(false);
    // not a claim
    expect(isPassEligibleClaim({ id: 's', provenance: 'host_extracted', kind: 'source_span' })).toBe(false);
  });
});

describe('isArtifact structural guard', () => {
  it('accepts a strong-grounded claim and a non-claim without grounding', () => {
    expect(isArtifact({ id: 'c', provenance: 'host_extracted', kind: 'claim', grounding_level: 'strong' })).toBe(
      true,
    );
    expect(isArtifact({ id: 's', provenance: 'host_authored', kind: 'source_span' })).toBe(true);
  });

  it('rejects a claim missing grounding_level (§4)', () => {
    expect(isArtifact({ id: 'c', provenance: 'host_extracted', kind: 'claim' })).toBe(false);
  });

  it('rejects a non-claim that declares grounding_level', () => {
    expect(
      isArtifact({ id: 's', provenance: 'host_authored', kind: 'source_span', grounding_level: 'strong' }),
    ).toBe(false);
  });

  it('rejects bad provenance / bad kind / missing id', () => {
    expect(isArtifact({ id: 'c', provenance: 'bogus', kind: 'claim', grounding_level: 'strong' })).toBe(false);
    expect(isArtifact({ id: 'c', provenance: 'host_authored', kind: 'bogus' })).toBe(false);
    expect(isArtifact({ provenance: 'host_authored', kind: 'source_span' })).toBe(false);
  });
});

describe('validateArtifactBundle — valid chain', () => {
  it('accepts a well-formed bundle and returns it normalized', () => {
    const bundle = validateArtifactBundle(validBundle());
    expect(bundle.contract_id).toBe('contract-1');
    expect(bundle.artifacts).toHaveLength(6);
    expect(bundle.final_answer_bindings).toHaveLength(4);
    expect(isArtifactBundle(validBundle())).toBe(true);
  });

  it('allows a judgment binding with no artifact_id (§2 law 1)', () => {
    const b = validBundle();
    expect(b.final_answer_bindings.some(x => x.binding_kind === 'judgment' && x.artifact_id === undefined)).toBe(
      true,
    );
    expect(() => validateArtifactBundle(b)).not.toThrow();
  });
});

describe('validateArtifactBundle — invalid bundles (Phase-2 mutation targets)', () => {
  it('rejects an unknown provenance tier', () => {
    const b = validBundle();
    (b.artifacts[1] as { provenance: string }).provenance = 'model_generated';
    expect(() => validateArtifactBundle(b)).toThrow(/provenance must be one of/);
    expect(isArtifactBundle(b)).toBe(false);
  });

  it('rejects a claim missing grounding_level', () => {
    const b = validBundle();
    delete (b.artifacts[1] as { grounding_level?: string }).grounding_level;
    expect(() => validateArtifactBundle(b)).toThrow(/must carry grounding_level/);
  });

  it('rejects a non-claim that declares grounding_level', () => {
    const b = validBundle();
    (b.artifacts[3] as { grounding_level?: string }).grounding_level = 'strong';
    expect(() => validateArtifactBundle(b)).toThrow(/must not carry grounding_level/);
  });

  it('rejects a claim citing a nonexistent source span (invent-a-source mutation, §8)', () => {
    const b = validBundle();
    (b.artifacts[1] as { source_span_id?: string }).source_span_id = 'src-ghost';
    expect(() => validateArtifactBundle(b)).toThrow(/unknown source_span_id "src-ghost"/);
  });

  it('rejects a recommendation referencing a nonexistent option', () => {
    const b = validBundle();
    (b.artifacts[5] as { option_refs?: string[] }).option_refs = ['opt-ghost'];
    expect(() => validateArtifactBundle(b)).toThrow(/unknown option id "opt-ghost"/);
  });

  it('rejects a final-answer binding to a nonexistent artifact (drift-surface mutation)', () => {
    const b = validBundle();
    (b.final_answer_bindings[0] as { artifact_id?: string }).artifact_id = 'claim-ghost';
    expect(() => validateArtifactBundle(b)).toThrow(/unknown artifact_id "claim-ghost"/);
  });

  it('rejects a non-judgment binding with no artifact_id', () => {
    const b = validBundle();
    delete (b.final_answer_bindings[0] as { artifact_id?: string }).artifact_id;
    expect(() => validateArtifactBundle(b)).toThrow(/must reference a non-empty artifact_id/);
  });

  it('rejects duplicate artifact ids', () => {
    const b = validBundle();
    b.artifacts[2].id = 'claim-1';
    expect(() => validateArtifactBundle(b)).toThrow(/duplicate id "claim-1"/);
  });

  it('rejects empty requirements / empty artifacts / missing contract_id', () => {
    expect(() => validateArtifactBundle({ ...validBundle(), requirements: [] })).toThrow(
      /requirements must be a non-empty array/,
    );
    expect(() => validateArtifactBundle({ ...validBundle(), artifacts: [] })).toThrow(
      /artifacts must be a non-empty array/,
    );
    expect(() => validateArtifactBundle({ ...validBundle(), contract_id: '' })).toThrow(
      /contract_id must be a non-empty string/,
    );
  });

  it('isArtifactBundle returns false (never throws) on a non-object', () => {
    expect(isArtifactBundle(null)).toBe(false);
    expect(isArtifactBundle('nope')).toBe(false);
  });
});
