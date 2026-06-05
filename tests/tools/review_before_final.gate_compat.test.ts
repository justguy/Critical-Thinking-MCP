/**
 * Gate-compatibility proof for review_before_final's artifact_templates.
 *
 * For EACH per-task_type artifact_template the facade returns, this test:
 *   1. FILLS the template with a satisfying example (valid content), pairs it with an
 *      appropriate HOST-authored ContractSpec, and asserts the REAL gate
 *      (enforceDeliverable, src/host/enforcement_host.ts) RELEASEs it; and
 *   2. MUTATES the fill (wrong value / non-verbatim quoted_span / missing field) and
 *      asserts the same gate REJECTs.
 *
 * This proves the templates scaffold RELEASABLE deliverables while the gate still
 * catches violations. It also pins the numeric default as the LIGHT
 * { answer_text, structured_answer } shape, NOT a numeric_derivation DAG.
 *
 * NO model / claude-CLI calls — enforceDeliverable is pure/deterministic.
 */

import { describe, it, expect } from 'vitest';

import {
  handleReviewBeforeFinal,
  type ReviewBeforeFinalOutput,
} from '../../src/tools/review_before_final.js';
import {
  enforceDeliverable,
  type ContractSpec,
  type DeliverableArtifacts,
} from '../../src/host/enforcement_host.js';
import type { ReviewTaskType } from '../../src/mcp/prompts.js';

function template(task_type: ReviewTaskType): Record<string, unknown> {
  const out: ReviewBeforeFinalOutput = handleReviewBeforeFinal({
    task_type,
    original_request: 'r',
    draft_answer: 'd',
    mode: 'artifact',
  });
  return out.artifact_template as Record<string, unknown>;
}

// strict_release defaults true (the real ship path); every contract here is
// host-authored so contract_strength is host_anchored.
function gate(spec: ContractSpec, artifacts: DeliverableArtifacts) {
  return enforceDeliverable(spec, artifacts);
}

describe('review_before_final artifact_templates are gate-compatible (RELEASE) and still catch violations (REJECT)', () => {
  // ── research → grounded-citation shape (evidence_level 'cited') ──────────────
  it('research template: a verbatim-grounded fill RELEASEs; a non-verbatim span REJECTs', () => {
    const tpl = template('research');
    // Sanity: the skeleton carries the GroundingClaim field names the gate checks.
    expect((tpl.claims as any[])[0]).toMatchObject({
      claim_id: '',
      claim_text: '',
      source_id: '',
      quoted_span: '',
      supporting_token: '',
      claim_kind: 'status',
    });
    expect((tpl.sources as any[])[0]).toMatchObject({ origin: 'host_supplied' });

    const spec: ContractSpec = {
      contract_id: 'rbf-research',
      original_request_text: 'What is the refund window for the Pro plan? Answer only from the policy doc.',
      task_type: 'factual_qa',
      evidence_level: 'cited',
      risk_level: 'high',
      claims: [{ id: 'c1', text: 'The Pro plan refund window is 30 days', claim_kind: 'status' }],
    };

    // FILL the template (verbatim quoted_span substring of the source text).
    const filled: DeliverableArtifacts = {
      answer_text: 'The Pro plan refund window is 30 days from purchase.',
      sources: [
        {
          id: 'policy',
          text: 'Pro plan customers may request a refund within 30 days of purchase.',
          origin: 'host_supplied',
        },
      ],
      claims: [
        {
          claim_id: 'c1',
          claim_text: 'The Pro plan refund window is 30 days',
          source_id: 'policy',
          quoted_span: 'refund within 30 days of purchase',
          supporting_token: '30 days',
          claim_kind: 'status',
        },
      ],
    };
    expect(gate(spec, filled).decision).toBe('RELEASE');

    // MUTATE: quoted_span no longer appears verbatim in the source → REJECT.
    const mutated: DeliverableArtifacts = {
      ...filled,
      answer_text: 'The Pro plan refund window is 60 days from purchase.',
      claims: [
        {
          ...filled.claims![0],
          quoted_span: 'refund within 60 days of purchase',
          supporting_token: '60 days',
        },
      ],
    };
    const rej = gate(spec, mutated);
    expect(rej.decision).toBe('REJECT');
    expect(rej.blocking_issues.length).toBeGreaterThan(0);
  });

  // ── numeric → LIGHT value/constraint shape (default), NOT a DAG ─────────────
  it('numeric template DEFAULTS to { answer_text, structured_answer } — not a numeric_derivation DAG', () => {
    const tpl = template('numeric');
    expect(tpl).toMatchObject({ answer_text: '', structured_answer: {} });
    expect(tpl.numeric_derivation).toBeUndefined();
    expect(tpl.arithmetic_checks).toBeUndefined();
    expect(tpl.inputs).toBeUndefined();
  });

  it('numeric template: a correct structured value RELEASEs (spine-free); a wrong value REJECTs', () => {
    // Per HOST_CONTRACT_AUTHORING.md: the host pins the value as a `==` constraint on a
    // structured field; the deliverable just states it. The light template fills exactly this.
    const spec: ContractSpec = {
      contract_id: 'rbf-numeric',
      original_request_text:
        'Compute the total expenses from line items: Travel 1200, Software 3400, Salaries 18000. ' +
        'The total_expenses field must equal 22600.',
      task_type: 'decision',
      evidence_level: 'asserted',
      risk_level: 'medium',
      required_fields: ['total_expenses'],
      constraints: [
        { field: 'total_expenses', op: '==', value: 22600, source_quote: 'must equal 22600' },
      ],
    };

    // FILL the light template.
    const filled: DeliverableArtifacts = {
      answer_text: 'Total expenses: 22600.',
      structured_answer: { total_expenses: 22600 },
    };
    expect(gate(spec, filled).decision).toBe('RELEASE');

    // MUTATE: wrong value → the `==` constraint fails → REJECT.
    const wrongValue = gate(spec, {
      answer_text: 'Total expenses: 22500.',
      structured_answer: { total_expenses: 22500 },
    });
    expect(wrongValue.decision).toBe('REJECT');
    expect(wrongValue.blocking_issues.length).toBeGreaterThan(0);

    // MUTATE: missing required field → REJECT.
    const missingField = gate(spec, {
      answer_text: 'See the attached breakdown.',
      structured_answer: { travel: 1200, software: 3400, salaries: 18000 },
    });
    expect(missingField.decision).toBe('REJECT');
    expect(missingField.blocking_issues.length).toBeGreaterThan(0);
  });

  // ── decision / plan / architecture / general → light structured skeletons ────
  // Where the gate checks structure, fill structured_answer with the host's required
  // fields/constraints. Decision is advisory (not gate-blocking) but the light fill
  // still RELEASEs through the real gate when a host DOES pin a structured requirement.
  for (const task_type of ['decision', 'plan', 'architecture', 'general'] as ReviewTaskType[]) {
    it(`${task_type} template: a fill that meets a host constraint RELEASEs; a violating fill REJECTs`, () => {
      const tpl = template(task_type);
      // Each light skeleton carries the gate-checked surface.
      expect(tpl).toMatchObject({ answer_text: '', structured_answer: {} });
      // None of them default to the heavy numeric DAG spine.
      expect(tpl.numeric_derivation).toBeUndefined();
      expect(tpl.arithmetic_checks).toBeUndefined();

      const spec: ContractSpec = {
        contract_id: `rbf-${task_type}`,
        original_request_text: 'Approve the deal only if gross_margin_pct >= 20. Quoted margin 24.',
        task_type: 'decision',
        evidence_level: 'asserted',
        risk_level: 'high',
        required_fields: ['gross_margin_pct'],
        constraints: [
          { field: 'gross_margin_pct', op: '>=', value: 20, source_quote: 'gross_margin_pct >= 20' },
        ],
      };

      // FILL: state the answer + the required structured field meeting the constraint.
      const filled: DeliverableArtifacts = {
        answer_text: 'Deal approved. gross_margin_pct 24.',
        structured_answer: { gross_margin_pct: 24 },
      };
      expect(gate(spec, filled).decision).toBe('RELEASE');

      // MUTATE: value below the floor → constraint fails → REJECT.
      const rej = gate(spec, {
        answer_text: 'Deal approved. gross_margin_pct 18.',
        structured_answer: { gross_margin_pct: 18 },
      });
      expect(rej.decision).toBe('REJECT');
      expect(rej.blocking_issues.length).toBeGreaterThan(0);
    });
  }
});
