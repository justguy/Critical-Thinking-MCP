/**
 * Phase 5 — the live-realism PROMPT shape (EDIT 2), tested WITHOUT any model call.
 *
 * The as-run live arm had 5 `unparseable_deliverable` rows: the model emitted prose
 * instead of one JSON deliverable object for RAG / compliance / freshness scenarios.
 * The corrected prompt is explicit ("Output ONLY a single JSON object, no prose, no
 * code fence") and gives the EXACT keys per deliverable_type. This file asserts the
 * prompt asks for the right shape per type and that the SAME parser
 * (parseDeliverable) round-trips a bare JSON object (no fence) for each shape.
 *
 * PURE: imports run_realism (import-safe — no model/CLI on import) and exercises only
 * buildRealismPrompt + parseDeliverable. NO model / claude-CLI calls.
 */

import { describe, it, expect } from 'vitest';

import { PHASE5_SCENARIOS } from '../../benchmark/phase5/scenarios.js';
import { buildRealismPrompt, parseDeliverable } from '../../benchmark/phase5/run_realism.js';

function byId(id: string) {
  const s = PHASE5_SCENARIOS.find(x => x.id === id);
  if (!s) throw new Error(`scenario ${id} missing`);
  return s;
}

describe('Phase 5 realism prompt — single parseable JSON, no prose, no fence', () => {
  it('every prompt forbids prose and a code fence (the unparseable_deliverable fix)', () => {
    for (const s of PHASE5_SCENARIOS) {
      const p = buildRealismPrompt(s);
      expect(p, s.id).toContain('Output ONLY a single JSON object, no prose, no code fence');
      expect(p, s.id).toContain('Start your response with { and end it with }');
      expect(p, s.id).toContain(s.surface_task);
    }
  });

  it('financial/config prompts ask for answer_text + structured_answer (NOT a DAG)', () => {
    for (const s of PHASE5_SCENARIOS.filter(
      x => x.deliverable_type === 'financial_summary' || x.deliverable_type === 'config_spec',
    )) {
      const p = buildRealismPrompt(s);
      expect(p, s.id).toContain('"answer_text"');
      expect(p, s.id).toContain('"structured_answer"');
      // The re-framed corpus never asks the agent to author a numeric trace.
      expect(p, s.id).not.toContain('numeric_derivation');
      expect(p, s.id).not.toContain('arithmetic_checks');
    }
  });

  it('RAG prompts ask for answer_text + sources + claims with a verbatim quoted_span', () => {
    for (const s of PHASE5_SCENARIOS.filter(x => x.deliverable_type === 'rag_customer_answer')) {
      const p = buildRealismPrompt(s);
      expect(p, s.id).toContain('"answer_text"');
      expect(p, s.id).toContain('"sources"');
      expect(p, s.id).toContain('"claims"');
      expect(p, s.id).toContain('"quoted_span"');
      expect(p, s.id).toContain('VERBATIM');
    }
  });

  it('freshness prompts ask for dated sources (published_at)', () => {
    for (const s of PHASE5_SCENARIOS.filter(x => x.host_contract.freshness)) {
      const p = buildRealismPrompt(s);
      expect(p, s.id).toContain('"published_at"');
      expect(p, s.id).toContain('"claims"');
    }
  });

  it('plain compliance prompts ask for answer_text only', () => {
    for (const s of PHASE5_SCENARIOS.filter(
      x => x.deliverable_type === 'compliance_format' && !x.host_contract.freshness,
    )) {
      const p = buildRealismPrompt(s);
      expect(p, s.id).toContain('"answer_text"');
      expect(p, s.id).not.toContain('"structured_answer"');
      expect(p, s.id).not.toContain('"sources"');
    }
  });
});

describe('Phase 5 realism parser — bare JSON object (no fence) round-trips', () => {
  it('parses the re-framed fin_numeric_dag structured_answer shape from bare JSON', () => {
    const text = JSON.stringify({
      answer_text: 'Total expenses: 22600.',
      structured_answer: { total_expenses: 22600 },
    });
    const d = parseDeliverable(text);
    expect(d).not.toBeNull();
    expect(d!.answer_text).toContain('22600');
    expect((d!.structured_answer as Record<string, unknown>).total_expenses).toBe(22600);
  });

  it('parses a RAG shape with sources + claims from bare JSON (no fence)', () => {
    const text = JSON.stringify({
      answer_text: 'The Pro plan refund window is 30 days from purchase.',
      sources: [{ id: 'policy', text: 'refund within 30 days of purchase', origin: 'host_supplied' }],
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
    });
    const d = parseDeliverable(text);
    expect(d).not.toBeNull();
    expect(d!.claims!.length).toBe(1);
    expect(d!.sources!.length).toBe(1);
  });

  it('rejects a prose-only (non-JSON) answer as unparseable', () => {
    expect(parseDeliverable('The refund window is 30 days. Hope this helps!')).toBeNull();
  });
});
