/**
 * Phase 3.1 — host-grade trust through the real enforcement_host gate (§3).
 *
 * The host authors the contract AND the proof_grade_requirements; the agent
 * authors the artifact_bundle. These tests prove the §3 rule end-to-end at the
 * release boundary:
 *   - a proof-grade requirement backed by a tier-1/2 strong artifact RELEASES;
 *   - the same requirement backed only by a tier-3..5 (model-authored) artifact —
 *     even internally consistent — is REJECTed (host_grade_proof_missing);
 *   - the model cannot dodge by self-declaring a weaker profile (the host owns the
 *     proof set, not the agent);
 *   - declaring proof-grade requirements without supplying a bundle REJECTs.
 */

import { describe, it, expect } from 'vitest';

import { enforceDeliverable, type ContractSpec, type DeliverableArtifacts } from '../../src/host/enforcement_host.js';
import type { HostAnchoredEvidence } from '../../src/enforcement/host_grade_trust.js';
import type { ArtifactBundle } from '../../src/enforcement/types.js';

const factSpec = (over: Partial<ContractSpec> = {}): ContractSpec => ({
  contract_id: 'h-trust',
  original_request_text: 'State the contract renewal cadence.',
  task_type: 'freeform',
  evidence_level: 'none',
  risk_level: 'low',
  ...over,
});

// answer_text is the rendered projection; for the host's anti-swap hash it just
// needs to match what we surface (default = artifacts.answer_text).
const answer = 'cadence: renews annually';

function proofGradeBundle(): ArtifactBundle {
  return {
    contract_id: 'h-trust',
    requirements: [{ id: 'cadence', text: 'State the renewal cadence.' }],
    artifacts: [
      { id: 'src-1', provenance: 'host_extracted', kind: 'source_span', text: 'The contract renews annually.' },
      {
        id: 'claim-1',
        provenance: 'host_extracted',
        kind: 'claim',
        grounding_level: 'strong',
        text: 'renews annually',
        source_span_id: 'src-1',
        quoted_span: 'renews annually',
      },
    ],
    final_answer_bindings: [
      { field: 'cadence', binding_kind: 'claim', artifact_id: 'claim-1', rendered_value: 'renews annually' },
    ],
  };
}

/** Same shape, but the cadence claim is model-authored (tier 4) — a self-consistent fake proof. */
function modelAuthoredBundle(): ArtifactBundle {
  const b = proofGradeBundle();
  (b.artifacts[1] as { provenance: string }).provenance = 'model_generated_reasoning';
  return b;
}

/**
 * The HOST's anchored evidence: a host-supplied source the cadence claim's quoted_span
 * ("renews annually") verbatim-matches. This — NOT the agent's provenance label — is
 * what makes the claim proof-grade. The agent never authors this.
 */
const hostEvidence: HostAnchoredEvidence = {
  host_sources: [{ id: 'host-src-1', text: 'The contract renews annually.' }],
};

const artifactsWith = (bundle: ArtifactBundle): DeliverableArtifacts => ({
  answer_text: answer,
  artifact_bundle: bundle,
});

describe('enforceDeliverable + host-grade trust (§3)', () => {
  it('RELEASES when the host proof-grade requirement rests on a HOST-ANCHORED tier-1/2 strong artifact', () => {
    const d = enforceDeliverable(factSpec(), artifactsWith(proofGradeBundle()), {
      proof_grade_requirements: ['cadence'],
      host_evidence: hostEvidence,
    });
    expect(d.decision).toBe('RELEASE');
  });

  it('FORGERY HOLE replicated: a fabricated host_extracted+strong bundle with NO matching host source REJECTS', () => {
    // The exploit: an agent self-labels provenance:'host_extracted', grounding_level:'strong'
    // with a perfectly self-consistent bundle, but NO host_evidence anchors it. Before the fix
    // this RELEASED (proof-grade decided from the agent-written label). After the fix the label
    // is a CLAIM verified against host evidence — with none supplied, it REJECTS.
    const d = enforceDeliverable(factSpec(), artifactsWith(proofGradeBundle()), {
      proof_grade_requirements: ['cadence'],
      // host_evidence intentionally omitted — nothing host-anchored backs the label.
    });
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('host_grade_proof_missing');
    expect(d.blocking_issues.some(i => i.mechanism === 'host_grade_proof_required')).toBe(true);
    expect(d.blocking_issues.find(i => i.mechanism === 'host_grade_proof_required')?.taxonomy).toBe(
      'PROFILE_DOWNGRADE',
    );
  });

  it('FORGERY HOLE: a host_extracted claim whose span does NOT appear in the host source REJECTS', () => {
    // Host evidence IS supplied, but the agent's quoted_span is not a verbatim substring of it —
    // the label is unauthenticated, so it cannot carry a proof-grade PASS.
    const d = enforceDeliverable(factSpec(), artifactsWith(proofGradeBundle()), {
      proof_grade_requirements: ['cadence'],
      host_evidence: { host_sources: [{ id: 'h', text: 'The contract renews monthly.' }] },
    });
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('host_grade_proof_missing');
  });

  it('REJECTS a tier-3..5 artifact used where host-grade proof is required (no proof-grade PASS)', () => {
    const d = enforceDeliverable(factSpec(), artifactsWith(modelAuthoredBundle()), {
      proof_grade_requirements: ['cadence'],
    });
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('host_grade_proof_missing');
    expect(d.blocking_issues.some(i => i.mechanism === 'host_grade_proof_required')).toBe(true);
    // §7 taxonomy code is stamped (a profile dodge: proof-grade work on non-proof input).
    expect(d.blocking_issues.find(i => i.mechanism === 'host_grade_proof_required')?.taxonomy).toBe(
      'PROFILE_DOWNGRADE',
    );
    expect(d.corrective_prompt.length).toBeGreaterThan(0);
  });

  it('anti-dodge: the model cannot relax the host proof set by self-declaring a weaker profile', () => {
    // The agent ships an internally-consistent bundle but with a model-tier claim; the
    // host still demands tier-1/2 for `cadence`, so release is rejected. The agent's own
    // (weaker) provenance choice does not change what the host requires.
    const d = enforceDeliverable(factSpec(), artifactsWith(modelAuthoredBundle()), {
      proof_grade_requirements: ['cadence'],
    });
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('host_grade_proof_missing');
  });

  it('REJECTS when proof-grade requirements are declared but no artifact_bundle is supplied', () => {
    const d = enforceDeliverable(factSpec(), { answer_text: answer }, {
      proof_grade_requirements: ['cadence'],
    });
    expect(d.decision).toBe('REJECT');
    expect(d.reason).toBe('host_grade_proof_missing');
    expect(d.blocking_issues.some(i => i.mechanism === 'host_grade_proof_required')).toBe(true);
  });

  it('no host-grade obligation (empty proof set): a clean freeform deliverable RELEASES', () => {
    const d = enforceDeliverable(factSpec(), { answer_text: answer });
    expect(d.decision).toBe('RELEASE');
  });
});
