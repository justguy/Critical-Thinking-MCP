/**
 * Phase 3.1 — binding spine + host-grade trust + plan_token.
 *
 * Covers the three infrastructure pieces of dvp-p3-1:
 *   1. ANSWER RENDERER (§5): the final answer is a projection of the bound ledger;
 *      every rendered material field carries its binding (artifact_id + trust tier,
 *      or an explicit judgment label). Render+bind happy path; tamper surfaces.
 *   2. HOST-GRADE TRUST (§3): a proof-grade requirement may rest ONLY on tier-1/2
 *      strong-grounded artifacts; a tier-3..5 artifact must NOT yield a proof-grade
 *      PASS even when internally consistent; the model can't dodge via a weaker
 *      self-declared profile (the host owns proof_grade_requirements).
 *   3. PLAN_TOKEN (§3.1): plan_checks issues it; finalize recomputes and BLOCKS on
 *      mismatch — the contract→artifacts→answer chain holds for a RAW MCP client.
 *
 * SCOPE: this is the binding INFRASTRUCTURE. It does NOT test Phase-3.2 drift
 * comparison (the renderer exposes the wiring point; the diff is dvp-p3-2).
 *
 * Plan refs: DETERMINISTIC_VALUE_PLAN.md §2 (design laws), §3 (trust tiers),
 * §5 (renderer).
 */

import { describe, it, expect } from 'vitest';

import type { ArtifactBundle, DeliverableContract } from '../../src/enforcement/types.js';
import { renderAnswer } from '../../src/enforcement/answer_renderer.js';
import {
  evaluateHostGradeTrust,
  isHostGradeProof,
  type HostAnchoredEvidence,
} from '../../src/enforcement/host_grade_trust.js';
import { computePlanToken, verifyPlanToken, contractIdentity } from '../../src/enforcement/plan_token.js';
import { handlePlanChecks } from '../../src/tools/plan_checks.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';
import { EnforcementEngine } from '../../src/enforcement/index.js';

const engine = () => new EnforcementEngine();

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** A bundle whose `cadence` requirement IS backed proof-grade (tier-2 strong). */
function provenBundle(): ArtifactBundle {
  return {
    contract_id: 'c-1',
    requirements: [
      { id: 'cadence', text: 'State the renewal cadence.' },
      { id: 'recommendation', text: 'Recommend an action.' },
    ],
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
      { field: 'cadence', binding_kind: 'claim', artifact_id: 'claim-1', rendered_value: 'renews annually' },
      { field: 'recommendation', binding_kind: 'option', artifact_id: 'rec-1', rendered_value: 'Renegotiate now.' },
      { field: 'caveat', binding_kind: 'judgment', rendered_value: 'Verify with counsel.' },
    ],
  };
}

/**
 * The HOST's anchored evidence for provenBundle: a host-supplied source the cadence
 * claim's quoted_span ("renews annually") verbatim-matches. Proof-grade is decided
 * ONLY against this; the agent's provenance label is verified against it, not trusted.
 */
const hostEvidence: HostAnchoredEvidence = {
  host_sources: [{ id: 'host-src-1', text: 'The contract renews annually unless cancelled.' }],
};

// ─── 1. ANSWER RENDERER (§5) ──────────────────────────────────────────────────

describe('answer renderer (§5): final answer is a projection of the bound ledger', () => {
  it('render+bind happy path: every material field carries its binding + trust tier', () => {
    const rendered = renderAnswer(provenBundle());

    // The answer text is a projection of the ledger, not free prose.
    expect(rendered.answer_text).toContain('cadence: renews annually');
    expect(rendered.answer_text).toContain('recommendation: Renegotiate now.');

    const byField = Object.fromEntries(rendered.rendered_fields.map(f => [f.field, f]));

    // cadence binds to a tier-2 (host_extracted) strong claim — proof-grade material.
    expect(byField.cadence.binding_kind).toBe('claim');
    expect(byField.cadence.artifact_id).toBe('claim-1');
    expect(byField.cadence.trust_tier).toBe(2);
    expect(byField.cadence.is_judgment).toBe(false);

    // recommendation binds to a tier-5 (model_generated_recommendation) artifact.
    expect(byField.recommendation.trust_tier).toBe(5);
    expect(byField.recommendation.is_judgment).toBe(false);

    // caveat is non-artifact-backed prose: surfaced AS a labeled judgment (§5).
    expect(byField.caveat.is_judgment).toBe(true);
    expect(byField.caveat.artifact_id).toBeUndefined();
    expect(byField.caveat.trust_tier).toBeUndefined();
    expect(rendered.answer_text).toContain('[judgment]');
  });

  it('renders from artifact.text when a binding supplies no rendered_value', () => {
    const b = provenBundle();
    delete (b.final_answer_bindings[0] as { rendered_value?: string }).rendered_value;
    const rendered = renderAnswer(b);
    // Falls back to the source artifact's text — still a faithful projection.
    expect(rendered.rendered_fields[0].rendered_value).toBe('renews annually');
  });

  it('exposes the per-field source_artifact snapshot Phase 3.2 will diff for drift', () => {
    const rendered = renderAnswer(provenBundle());
    const cadence = rendered.rendered_fields.find(f => f.field === 'cadence')!;
    // The wiring point: rendered_value alongside the resolved source artifact.
    expect(cadence.rendered_value).toBe('renews annually');
    expect(cadence.source_artifact?.text).toBe('renews annually');
    // Phase 3.1 does NOT compare them — drift detection is dvp-p3-2.
  });
});

// ─── 2. HOST-GRADE TRUST (§3) ─────────────────────────────────────────────────

describe('host-grade trust (§3): proof rests ONLY on tier-1/2 strong artifacts', () => {
  it('isHostGradeProof: tier-1/2 strong claim true; weak or model-tier false', () => {
    expect(isHostGradeProof({ id: 'c', provenance: 'host_extracted', kind: 'claim', grounding_level: 'strong' })).toBe(true);
    expect(isHostGradeProof({ id: 's', provenance: 'host_authored', kind: 'source_span' })).toBe(true);
    // tier-1/2 but weak grounding → not proof-grade (§4)
    expect(isHostGradeProof({ id: 'c', provenance: 'host_extracted', kind: 'claim', grounding_level: 'weak' })).toBe(false);
    // model-tier strong claim → still not proof-grade
    expect(isHostGradeProof({ id: 'c', provenance: 'model_generated_reasoning', kind: 'claim', grounding_level: 'strong' })).toBe(false);
  });

  it('PASS-grade: a proof-grade requirement backed by a HOST-ANCHORED tier-2 strong claim is satisfied', () => {
    const r = evaluateHostGradeTrust(provenBundle(), {
      proof_grade_requirements: ['cadence'],
      host_evidence: hostEvidence,
    });
    expect(r.proof_grade_satisfied).toBe(true);
    expect(r.blocking_issues).toHaveLength(0);
    expect(r.evaluated[0]).toMatchObject({ requirement_id: 'cadence', satisfied: true, backing_trust_tier: 2 });
  });

  it('FORGERY HOLE: a host_extracted+strong claim with NO matching host source is NOT proof-grade', () => {
    // The label says host_extracted/strong, but no host_evidence anchors it: the
    // provenance is a claim, not a fact, so it must NOT carry a proof-grade PASS.
    const r = evaluateHostGradeTrust(provenBundle(), { proof_grade_requirements: ['cadence'] });
    expect(r.proof_grade_satisfied).toBe(false);
    expect(r.blocking_issues[0].mechanism).toBe('host_grade_proof_required');
    expect(r.blocking_issues[0].description).toMatch(/not authenticated|CLAIM/i);
  });

  it('BLOCK: a tier-3..5 artifact must NOT yield a proof-grade PASS even if internally consistent', () => {
    // The recommendation requirement rests only on a tier-5 (model-authored) artifact.
    const r = evaluateHostGradeTrust(provenBundle(), {
      proof_grade_requirements: ['recommendation'],
      host_evidence: hostEvidence,
    });
    expect(r.proof_grade_satisfied).toBe(false);
    expect(r.blocking_issues).toHaveLength(1);
    expect(r.blocking_issues[0].mechanism).toBe('host_grade_proof_required');
    expect(r.blocking_issues[0].description).toMatch(/tier 5/);
  });

  it('BLOCK: a requirement backed only by a judgment is not proof-grade', () => {
    const r = evaluateHostGradeTrust(provenBundle(), {
      proof_grade_requirements: ['caveat'],
      host_evidence: hostEvidence,
    });
    expect(r.proof_grade_satisfied).toBe(false);
    expect(r.blocking_issues[0].description).toMatch(/judgment|no binding/);
  });

  it('anti-dodge: a weaker self-declared profile does NOT relax the host proof set', () => {
    // Even if the agent downgraded its OWN claim to tier-4, the HOST's proof_grade_requirements
    // still demand tier-1/2 — the bundle just fails it. The model cannot escape the rule.
    const b = provenBundle();
    (b.artifacts[1] as { provenance: string }).provenance = 'model_generated_reasoning';
    const r = evaluateHostGradeTrust(b, {
      proof_grade_requirements: ['cadence'],
      host_evidence: hostEvidence,
    });
    expect(r.proof_grade_satisfied).toBe(false);
    expect(r.blocking_issues[0].description).toMatch(/tier 4/);
  });

  it('no-op when the host declares no proof-grade requirements (§2: nothing blocks unproven)', () => {
    const r = evaluateHostGradeTrust(provenBundle(), {});
    expect(r.proof_grade_satisfied).toBe(true);
    expect(r.evaluated).toHaveLength(0);
  });
});

// ─── 3. PLAN_TOKEN (§3.1) ─────────────────────────────────────────────────────

const baseContract = (over: Partial<DeliverableContract> = {}): DeliverableContract => ({
  contract_id: 'q1',
  contract_authority: 'agent',
  profile_source: 'agent_declared',
  original_request_text: 'Is Redis single-threaded for command execution?',
  task_type: 'factual_qa',
  evidence_level: 'cited',
  risk_level: 'low',
  claims: [{ id: 'c1', text: 'Redis executes commands single-threaded' }],
  must_include: ['single-threaded'],
  ...over,
});

const groundedFinalizeInput = (contract: DeliverableContract, extra: Record<string, unknown> = {}) => ({
  contract,
  answer_text: 'Redis is single-threaded for command execution.',
  sources: [{ id: 's1', text: 'Redis is single-threaded for command execution.' }],
  claims: [
    {
      claim_id: 'c1',
      claim_text: 'Redis executes commands single-threaded',
      source_id: 's1',
      quoted_span: 'Redis is single-threaded for command execution',
      supporting_token: 'single-threaded',
      claim_kind: 'status',
    },
  ],
  ...extra,
});

describe('plan_token (§3.1): contract→artifacts→answer chain for a raw MCP client', () => {
  it('is order-independent and obligation-bearing-only', () => {
    const a = computePlanToken(baseContract());
    // Reordering keys does not change the token (canonical JSON).
    const b = computePlanToken({ ...baseContract() });
    expect(a).toBe(b);
    // Changing an obligation-bearing field DOES change it.
    expect(computePlanToken(baseContract({ evidence_level: 'none' }))).not.toBe(a);
    expect(computePlanToken(baseContract({ must_include: ['threaded'] }))).not.toBe(a);
    expect(contractIdentity(baseContract()).contract_id).toBe('q1');
  });

  it('plan_checks issues a token only when a full contract is supplied', () => {
    const withContract = handlePlanChecks({ contract: baseContract() });
    expect(typeof withContract.plan_token).toBe('string');
    // A bare profile probe has no contract to bind — no token.
    const probe = handlePlanChecks({ contract: { task_type: 'factual_qa', evidence_level: 'cited', risk_level: 'low' } });
    expect(probe.plan_token).toBeUndefined();
  });

  it('happy path: plan_checks token round-trips through finalize (raw client, no host)', () => {
    const plan = handlePlanChecks({ contract: baseContract() });
    const out = handleFinalizeDeliverable(
      groundedFinalizeInput(baseContract(), { plan_token: plan.plan_token }),
      engine(),
    );
    expect(out.finalize_verdict).toBe('PASS');
    // finalize re-issues the same token over the contract it actually checked.
    expect(out.plan_token).toBe(plan.plan_token);
    expect(verifyPlanToken(baseContract(), out.plan_token)).toBe(true);
  });

  it('tamper: a downgraded contract at finalize BLOCKS on plan_token mismatch', () => {
    // Plan against the STRONG contract (cited + must_include + a claim)...
    const plan = handlePlanChecks({ contract: baseContract() });
    // ...then finalize against a quietly WEAKER one (evidence none, no claims/must_include),
    // carrying the strong token. The contract→answer chain catches the silent downgrade.
    const weakened = baseContract({ evidence_level: 'none', claims: [], must_include: [] });
    const out = handleFinalizeDeliverable(
      {
        contract: weakened,
        answer_text: 'Redis is single-threaded for command execution.',
        plan_token: plan.plan_token,
      },
      engine(),
    );
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(out.enforcement?.blocking_issues.some(i => i.mechanism === 'plan_token_mismatch')).toBe(true);
    expect(out.enforcement?.blocking_issues.find(i => i.mechanism === 'plan_token_mismatch')?.taxonomy).toBe(
      'PROFILE_DOWNGRADE',
    );
  });

  it('forged: a fabricated plan_token BLOCKS', () => {
    const out = handleFinalizeDeliverable(
      groundedFinalizeInput(baseContract(), { plan_token: 'ctmcp.plan_token.v1.deadbeef' }),
      engine(),
    );
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(out.enforcement?.blocking_issues.some(i => i.mechanism === 'plan_token_mismatch')).toBe(true);
  });

  it('absent token is NOT a block (backward compatible) but finalize still returns one', () => {
    const out = handleFinalizeDeliverable(groundedFinalizeInput(baseContract()), engine());
    expect(out.finalize_verdict).toBe('PASS');
    expect(verifyPlanToken(baseContract(), out.plan_token)).toBe(true);
  });
});
