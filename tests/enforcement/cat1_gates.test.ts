/**
 * Phase 3.2 — highest-confidence deterministic Cat-1 gates (dvp-p3-2).
 *
 * Three blocking gates, each consuming the binding spine and passing the
 * No-Semantic-Miracle test (§2). For EVERY blocking check the suite proves the
 * red+green+mutation triad (the gate):
 *   - GREEN  — a clean control PASSes (no false block).
 *   - RED    — a planted defect BLOCKs with the right §7 taxonomy code.
 *   - MUTATION — a further-mutated wrong variant STILL BLOCKs (no quiet permissiveness).
 *
 * 1. FINAL-ANSWER ↔ ARTIFACT DRIFT (detectFinalAnswerDrift) — §3.2/§5/§7.
 * 2. STRONG vs WEAK source-span grounding (checkStrongGrounding) — §4. Includes the
 *    HARD CONSTRAINT proof: weak grounding can NEVER block.
 * 3. REQUIREMENT COVERAGE (checkRequirementCoverage) — §9.
 * 4. §9 wiring through finalize_deliverable.
 *
 * Plan refs: DETERMINISTIC_VALUE_PLAN.md §2 (laws + No-Semantic-Miracle), §3 (trust),
 * §4 (grounding levels), §5 (renderer), §7 (taxonomy), §9 (profile matrix).
 */

import { describe, it, expect } from 'vitest';

import type { ArtifactBundle, DeliverableContract } from '../../src/enforcement/types.js';
import { renderAnswer } from '../../src/enforcement/answer_renderer.js';
import {
  detectFinalAnswerDrift,
  checkRequirementCoverage,
} from '../../src/enforcement/drift_detector.js';
import {
  checkStrongGrounding,
  type LeveledGroundingClaim,
} from '../../src/tools/check_quote_grounding.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';
import { stampTaxonomy } from '../../src/enforcement/blocker_taxonomy.js';
import { EnforcementEngine } from '../../src/enforcement/index.js';

const engine = () => new EnforcementEngine();

const drift = (b: ArtifactBundle) => detectFinalAnswerDrift(renderAnswer(b).rendered_fields);

// ─── Fixtures ───────────────────────────────────────────────────────────────

/** A clean numeric/cadence/recommendation bundle every rendered field matches. */
function cleanBundle(): ArtifactBundle {
  return {
    contract_id: 'c-1',
    requirements: [
      { id: 'total_cost', text: 'State the annual total cost.' },
      { id: 'cadence', text: 'State the renewal cadence.' },
      { id: 'recommendation', text: 'Recommend an action.' },
    ],
    artifacts: [
      { id: 'src-1', provenance: 'host_extracted', kind: 'source_span', text: 'The contract renews annually at $14,250 per year.' },
      { id: 'deriv-1', provenance: 'host_extracted', kind: 'derivation', text: '$14,250' },
      {
        id: 'claim-cadence',
        provenance: 'host_extracted',
        kind: 'claim',
        grounding_level: 'strong',
        text: 'renews annually',
        source_span_id: 'src-1',
        quoted_span: 'renews annually',
      },
      { id: 'opt-a', provenance: 'host_authored', kind: 'option', text: 'Renegotiate before renewal.' },
      {
        id: 'rec-1',
        provenance: 'model_generated_recommendation',
        kind: 'claim',
        grounding_level: 'weak',
        text: 'Choose opt-a.',
        option_refs: ['opt-a'],
      },
    ],
    final_answer_bindings: [
      { field: 'total_cost', binding_kind: 'derivation', artifact_id: 'deriv-1', rendered_value: '$14,250' },
      { field: 'cadence', binding_kind: 'claim', artifact_id: 'claim-cadence', rendered_value: 'renews annually' },
      { field: 'recommendation', binding_kind: 'option', artifact_id: 'rec-1', rendered_value: 'Choose opt-a.' },
    ],
  };
}

function clone(b: ArtifactBundle): ArtifactBundle {
  return JSON.parse(JSON.stringify(b));
}

// ═══ 1. FINAL-ANSWER ↔ ARTIFACT DRIFT ════════════════════════════════════════

describe('drift gate (§3.2/§5): rendered field must match its bound source artifact', () => {
  // GREEN — clean control: every rendered field matches; no block.
  it('GREEN: a faithful projection does not drift', () => {
    const r = drift(cleanBundle());
    expect(r.no_drift).toBe(true);
    expect(r.blocking_issues).toHaveLength(0);
    // The numeric/cadence/recommendation fields were all compared.
    expect(r.evaluated.find(e => e.field === 'total_cost')?.compared).toBe(true);
  });

  // RED — numeric drift: derivation says 14250, answer says 14520.
  it('RED: numeric drift (14250 → 14520) BLOCKs with FINAL_ANSWER_ARTIFACT_DRIFT', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[0].rendered_value = '$14,520'; // transposed digits
    const r = drift(b);
    expect(r.no_drift).toBe(false);
    const issue = r.blocking_issues.find(i => i.mechanism === 'final_answer_artifact_drift');
    expect(issue).toBeDefined();
    expect(issue!.description).toMatch(/14520/);
    stampTaxonomy(r.blocking_issues);
    expect(issue!.taxonomy).toBe('FINAL_ANSWER_ARTIFACT_DRIFT');
  });

  // MUTATION — a DIFFERENT wrong number still blocks (not just the one planted value).
  it('MUTATION: a further-mutated wrong number (99999) STILL BLOCKs', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[0].rendered_value = '$99,999';
    const r = drift(b);
    expect(r.no_drift).toBe(false);
    expect(r.blocking_issues.some(i => i.mechanism === 'final_answer_artifact_drift')).toBe(true);
  });

  // RED — cadence drift: span says "annually", answer says "monthly".
  it('RED: cadence drift (annually → monthly) BLOCKs', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[1].rendered_value = 'renews monthly';
    const r = drift(b);
    expect(r.no_drift).toBe(false);
    expect(r.blocking_issues.some(i => i.description.match(/cadence drift/))).toBe(true);
  });

  // MUTATION — a different wrong cadence (quarterly) still blocks.
  it('MUTATION: a different wrong cadence (quarterly) STILL BLOCKs', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[1].rendered_value = 'renews quarterly';
    const r = drift(b);
    expect(r.no_drift).toBe(false);
    expect(r.blocking_issues.some(i => i.description.match(/cadence drift/))).toBe(true);
  });

  // RED — option drift: recommendation names an option not among the evaluated ones.
  it('RED: option drift (names opt-z, only opt-a evaluated) BLOCKs', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[2].rendered_value = 'Choose opt-z.';
    const r = drift(b);
    expect(r.no_drift).toBe(false);
    expect(r.blocking_issues.some(i => i.description.match(/option drift/))).toBe(true);
  });

  // MUTATION — yet another non-evaluated option id still blocks.
  it('MUTATION: a different non-evaluated option (option-q) STILL BLOCKs', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[2].rendered_value = 'Go with option-q instead.';
    const r = drift(b);
    expect(r.no_drift).toBe(false);
    expect(r.blocking_issues.some(i => i.description.match(/option drift/))).toBe(true);
  });

  it('option drift does NOT fire on a prose recommendation that names no option id', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[2].rendered_value = 'Renegotiate now.';
    const r = drift(b);
    expect(r.no_drift).toBe(true);
  });

  it('an explicit [override] marker opts out of option drift (§4 allowed deviation)', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[2].rendered_value = 'Choose opt-z. [override]';
    const r = drift(b);
    expect(r.no_drift).toBe(true);
  });

  // FALSE-BLOCK GUARD — adding detail that shares the value never blocks.
  it('GREEN: a faithful restatement that adds detail does not drift', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[1].rendered_value = 'renews annually (about every 12 months on the anniversary)';
    const r = drift(b);
    // "annually" shares the cadence value with the source; the extra "months" is not
    // a contradiction because the sets overlap. No block.
    expect(r.no_drift).toBe(true);
  });

  // HARD CONSTRAINT — a WEAK-grounded claim field is never drift-compared.
  it('HARD CONSTRAINT: a weak-grounded claim field is NEVER drift-blocked', () => {
    const b = clone(cleanBundle());
    // Make the recommendation a weak CLAIM whose rendered value contradicts its text
    // on cadence — a weak claim must NOT be compared (it is interpretation, §4).
    b.artifacts[4] = {
      id: 'rec-1',
      provenance: 'model_generated_reasoning',
      kind: 'claim',
      grounding_level: 'weak',
      text: 'This renews annually so act soon.',
    };
    b.final_answer_bindings[2] = {
      field: 'recommendation',
      binding_kind: 'claim',
      artifact_id: 'rec-1',
      rendered_value: 'Given the monthly churn, act now.', // monthly vs annually
    };
    const r = drift(b);
    const recEval = r.evaluated.find(e => e.field === 'recommendation');
    expect(recEval?.compared).toBe(false); // weak claim → not compared
    expect(r.no_drift).toBe(true);
  });

  it('HARD CONSTRAINT: a judgment field is NEVER drift-blocked', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings.push({ field: 'caveat', binding_kind: 'judgment', rendered_value: 'Verify $1 with counsel.' });
    const r = drift(b);
    expect(r.evaluated.find(e => e.field === 'caveat')?.compared).toBe(false);
    expect(r.no_drift).toBe(true);
  });
});

// ═══ 2. STRONG vs WEAK SOURCE-SPAN GROUNDING (§4) ═════════════════════════════

const groundingSources = [{ id: 's1', text: 'The contract renews annually unless cancelled.' }];

function strongClaim(over: Partial<LeveledGroundingClaim> = {}): LeveledGroundingClaim {
  return {
    claim_id: 'c1',
    claim_text: 'The contract renews annually',
    source_id: 's1',
    quoted_span: 'renews annually',
    supporting_token: 'annually',
    claim_kind: 'status',
    grounding_level: 'strong',
    ...over,
  };
}

describe('strong-vs-weak grounding gate (§4): strong BLOCKs, weak is advisory', () => {
  // GREEN — a strong claim whose span verbatim-supports it passes.
  it('GREEN: a strong claim grounded in its span does not block', () => {
    const r = checkStrongGrounding(groundingSources, [strongClaim()], engine());
    expect(r.strong_grounding_satisfied).toBe(true);
    expect(r.blocking_issues).toHaveLength(0);
    expect(r.evaluated[0]).toMatchObject({ grounding_level: 'strong', grounded: true, blocked: false });
  });

  // RED — a strong claim whose quoted_span is not in the source BLOCKs.
  it('RED: a strong claim with a fabricated span BLOCKs (SOURCE_SPAN_MISMATCH)', () => {
    const bad = strongClaim({ quoted_span: 'renews monthly', supporting_token: 'monthly' });
    const r = checkStrongGrounding(groundingSources, [bad], engine());
    expect(r.strong_grounding_satisfied).toBe(false);
    expect(r.blocking_issues.length).toBeGreaterThan(0);
    stampTaxonomy(r.blocking_issues);
    expect(r.blocking_issues[0].taxonomy).toBe('SOURCE_SPAN_MISMATCH');
    expect(r.evaluated[0].blocked).toBe(true);
  });

  // MUTATION — a different fabricated span still blocks.
  it('MUTATION: a different fabricated strong span STILL BLOCKs', () => {
    const bad = strongClaim({ quoted_span: 'renews weekly with discounts', supporting_token: 'weekly' });
    const r = checkStrongGrounding(groundingSources, [bad], engine());
    expect(r.strong_grounding_satisfied).toBe(false);
    expect(r.blocking_issues.length).toBeGreaterThan(0);
  });

  // HARD CONSTRAINT — weak grounding NEVER blocks, even with a fabricated span.
  it('HARD CONSTRAINT: a WEAK claim with a fabricated span is ADVISORY, never blocks', () => {
    const weak = strongClaim({
      claim_id: 'w1',
      claim_text: 'This creates serious renewal risk',
      quoted_span: 'renews monthly', // not in source — would block if strong
      supporting_token: 'monthly',
      claim_kind: 'recommendation',
      grounding_level: 'weak',
    });
    const r = checkStrongGrounding(groundingSources, [weak], engine());
    // Structurally impossible for a weak claim to block.
    expect(r.blocking_issues).toHaveLength(0);
    expect(r.strong_grounding_satisfied).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0); // surfaced as advisory
    expect(r.evaluated[0]).toMatchObject({ grounding_level: 'weak', blocked: false });
  });

  it('HARD CONSTRAINT: mixing a passing strong claim with a failing weak claim blocks NEITHER', () => {
    const weakBad = strongClaim({
      claim_id: 'w2',
      claim_text: 'It is therefore risky',
      quoted_span: 'totally made up span',
      supporting_token: 'made',
      claim_kind: 'causal',
      grounding_level: 'weak',
    });
    const r = checkStrongGrounding(groundingSources, [strongClaim(), weakBad], engine());
    expect(r.strong_grounding_satisfied).toBe(true);
    expect(r.blocking_issues).toHaveLength(0);
  });
});

// ═══ 3. REQUIREMENT COVERAGE (§9) ═════════════════════════════════════════════

describe('requirement coverage gate (§9): every requirement is discharged by a binding', () => {
  // GREEN — every requirement has a matching binding field.
  it('GREEN: full coverage passes', () => {
    const r = checkRequirementCoverage(cleanBundle());
    expect(r.all_requirements_covered).toBe(true);
    expect(r.blocking_issues).toHaveLength(0);
  });

  // RED — a requirement with no binding BLOCKs (MISSING_REQUIREMENT).
  it('RED: a requirement with no binding BLOCKs (MISSING_REQUIREMENT)', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings = b.final_answer_bindings.filter(x => x.field !== 'recommendation');
    const r = checkRequirementCoverage(b);
    expect(r.all_requirements_covered).toBe(false);
    const issue = r.blocking_issues.find(i => i.description.includes('recommendation'));
    expect(issue).toBeDefined();
    stampTaxonomy(r.blocking_issues);
    expect(issue!.taxonomy).toBe('MISSING_REQUIREMENT');
  });

  // MUTATION — dropping a DIFFERENT requirement's binding still blocks.
  it('MUTATION: dropping a different requirement (cadence) STILL BLOCKs', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings = b.final_answer_bindings.filter(x => x.field !== 'cadence');
    const r = checkRequirementCoverage(b);
    expect(r.all_requirements_covered).toBe(false);
    expect(r.blocking_issues.some(i => i.description.includes('cadence'))).toBe(true);
  });
});

// ═══ 4. §9 WIRING THROUGH finalize_deliverable ════════════════════════════════

const ragContract = (over: Partial<DeliverableContract> = {}): DeliverableContract => ({
  contract_id: 'q1',
  contract_authority: 'host',
  profile_source: 'host_supplied',
  original_request_text: 'How often does the contract renew and what is the annual cost?',
  task_type: 'factual_qa',
  evidence_level: 'asserted',
  risk_level: 'low',
  ...over,
});

describe('§9 wiring: finalize_deliverable runs the bundle gates per profile', () => {
  it('absent artifact_bundle is backward compatible (no bundle gate runs, PASS path intact)', () => {
    const out = handleFinalizeDeliverable(
      { contract: ragContract(), answer_text: 'It renews annually at $14,250.' },
      engine(),
    );
    expect(out.finalize_verdict).toBe('PASS');
    expect(out.re_executed).not.toContain('final_answer_artifact_drift');
  });

  it('RAG profile: a drifting bundle BLOCKs through finalize (FINAL_ANSWER_ARTIFACT_DRIFT)', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings[1].rendered_value = 'renews monthly'; // cadence drift
    const out = handleFinalizeDeliverable(
      { contract: ragContract(), answer_text: 'It renews monthly at $14,250.', artifact_bundle: b },
      engine(),
    );
    expect(out.finalize_verdict).toBe('BLOCK');
    const issue = out.enforcement?.blocking_issues.find(i => i.mechanism === 'final_answer_artifact_drift');
    expect(issue?.taxonomy).toBe('FINAL_ANSWER_ARTIFACT_DRIFT');
    expect(out.re_executed).toContain('final_answer_artifact_drift');
  });

  it('RAG profile: a clean bundle PASSes through finalize and records the gates it ran', () => {
    const out = handleFinalizeDeliverable(
      { contract: ragContract(), answer_text: 'It renews annually at $14,250.', artifact_bundle: cleanBundle() },
      engine(),
    );
    expect(out.finalize_verdict).toBe('PASS');
    expect(out.re_executed).toContain('final_answer_artifact_drift');
    expect(out.re_executed).toContain('requirement_coverage');
    expect(out.re_executed).toContain('strong_source_span_grounding');
  });

  it('RAG profile: a missing-requirement bundle BLOCKs through finalize (MISSING_REQUIREMENT)', () => {
    const b = clone(cleanBundle());
    b.final_answer_bindings = b.final_answer_bindings.filter(x => x.field !== 'cadence');
    const out = handleFinalizeDeliverable(
      { contract: ragContract(), answer_text: 'It costs $14,250.', artifact_bundle: b },
      engine(),
    );
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(out.enforcement?.blocking_issues.some(i => i.mechanism === 'requirement_coverage')).toBe(true);
  });

  it('RAG profile: a strong-grounding span mismatch in the bundle BLOCKs through finalize', () => {
    const b = clone(cleanBundle());
    // Break the cited source span so the strong claim's quoted_span ("renews annually")
    // is no longer verbatim-present in its source — a pure grounding defect.
    b.artifacts[0].text = 'The contract renews on some cadence at $14,250 per year.';
    const out = handleFinalizeDeliverable(
      { contract: ragContract(), answer_text: 'It renews annually at $14,250.', artifact_bundle: b },
      engine(),
    );
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(out.enforcement?.blocking_issues.some(i => i.mechanism === 'quote_grounding')).toBe(true);
  });

  it('non-RAG profile (numeric_analysis): strong grounding is OFF; drift + coverage still req', () => {
    const b = clone(cleanBundle());
    // Break ONLY the source span the strong claim cites (so its quoted_span no longer
    // verbatim-matches its source). The rendered value still matches the claim text, so
    // there is NO answer↔artifact drift — the ONLY defect is a grounding one. Under the
    // Math profile strong grounding is OFF, so this must NOT block.
    b.artifacts[0].text = 'The contract renews on some cadence.'; // span no longer contains "renews annually"
    const out = handleFinalizeDeliverable(
      { contract: ragContract({ task_type: 'numeric_analysis' }), answer_text: 'It renews annually at $14,250.', artifact_bundle: b },
      engine(),
    );
    // No strong-grounding gate ran; drift + coverage ran and found nothing.
    expect(out.re_executed).not.toContain('strong_source_span_grounding');
    expect(out.re_executed).toContain('final_answer_artifact_drift');
    expect(out.re_executed).toContain('requirement_coverage');
    expect(out.finalize_verdict).toBe('PASS');

    // CONTROL: the SAME broken-grounding bundle under the RAG profile DOES block.
    const ragOut = handleFinalizeDeliverable(
      { contract: ragContract({ task_type: 'factual_qa' }), answer_text: 'It renews annually at $14,250.', artifact_bundle: b },
      engine(),
    );
    expect(ragOut.finalize_verdict).toBe('BLOCK');
    expect(ragOut.enforcement?.blocking_issues.some(i => i.mechanism === 'quote_grounding')).toBe(true);
  });

  it('a malformed bundle BLOCKs (cannot release on an uncheckable bundle)', () => {
    const out = handleFinalizeDeliverable(
      { contract: ragContract(), answer_text: 'x', artifact_bundle: { contract_id: 'c', requirements: [], artifacts: [], final_answer_bindings: [] } },
      engine(),
    );
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(out.enforcement?.blocking_issues.some(i => i.mechanism === 'final_answer_artifact_drift')).toBe(true);
  });
});
