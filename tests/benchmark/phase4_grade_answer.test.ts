/**
 * Phase 4 — Amendment B1, Deliverable 4: dry-run extraction assertion for EVERY
 * arm shape, and the re-grade of the three round-1 mis-graded cases.
 *
 * gradeArmAnswer grades the INTENDED answer per oracle kind (prereg §5 grading
 * row): numeric → the FINAL ANSWER sentinel value; constraint → the extracted
 * JSON object; source_span → full text; refusal/non-answer → a `no_answer`
 * DEFECT. NO model / CLI calls — ArmTranscript fixtures are constructed inline.
 */

import { describe, it, expect } from 'vitest';

import {
  gradeArmAnswer,
  lastBalancedObject,
  extractConstraintObjectString,
} from '../../benchmark/phase4/grade_answer.js';
import type { ArmTranscript } from '../../benchmark/phase4/arm_adapter.js';
import { HARD_CORPUS, type Phase4Task } from '../../benchmark/phase4/corpus.js';

// ── Inline ArmTranscript fixture builder (no model calls) ────────────────────
// Only the fields gradeArmAnswer reads (final_text + final_answer_sentinel) carry
// signal; the rest are filled with empty/zero placeholders matching the type.
function transcript(
  final_text: string,
  final_answer_sentinel: string | null = null,
): ArmTranscript {
  return {
    final_text,
    final_answer_sentinel,
    result_subtype: 'success',
    mcp_servers: [],
    advertised_ct_tools: [],
    tool_uses: [],
    tool_results: [],
    finalize_bindings: [],
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
    num_turns: 1,
    total_cost_usd: null,
    permission_denials: [],
  };
}

function task(id: string): Phase4Task {
  const t = HARD_CORPUS.find(x => x.id === id);
  if (!t) throw new Error(`unknown task ${id}`);
  return t;
}

// ════════════════════════════════════════════════════════════════════════════
// lastBalancedObject / extractConstraintObjectString unit behavior.
// ════════════════════════════════════════════════════════════════════════════

describe('lastBalancedObject', () => {
  it('returns the last balanced object when several appear', () => {
    expect(lastBalancedObject('{"a":1} then {"b":2}')).toBe('{"b":2}');
  });
  it('handles nested braces', () => {
    expect(lastBalancedObject('x {"a":{"b":2}} y')).toBe('{"a":{"b":2}}');
  });
  it('ignores braces inside strings', () => {
    expect(lastBalancedObject('{"note":"a } b","v":1}')).toBe('{"note":"a } b","v":1}');
  });
  it('returns null when no object', () => {
    expect(lastBalancedObject('no braces here')).toBeNull();
  });
});

describe('extractConstraintObjectString', () => {
  it('prefers a fenced json block', () => {
    const s = extractConstraintObjectString('prose\n```json\n{"cpu":8}\n```\nmore');
    expect(s).toBe('{"cpu":8}');
  });
  it('falls back to the object after FINAL ANSWER:', () => {
    const s = extractConstraintObjectString('reasoning {x} ... FINAL ANSWER: {"cpu":8}');
    expect(s).toBe('{"cpu":8}');
  });
  it('falls back to the last balanced object anywhere', () => {
    const s = extractConstraintObjectString('{"draft":1} final {"cpu":8,"tier":"std"}');
    expect(s).toBe('{"cpu":8,"tier":"std"}');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Dry-run extraction assertion for EVERY arm shape.
// ════════════════════════════════════════════════════════════════════════════

describe('gradeArmAnswer — dry-run for every arm shape', () => {
  it('NUMERIC: verbose CoT with "FINAL ANSWER: 75" grades correct (sentinel, not CoT)', () => {
    const t = task('p4-num-avg-speed'); // gold 75, distractor 76
    const tr = transcript(
      'Let me work it out. Distance 90 then 60. Time 1.25 + 0.75 = 2.\n' +
        'Some might average the speeds to get 76, but that is wrong.\n' +
        'FINAL ANSWER: 75',
      '75',
    );
    const v = gradeArmAnswer(t, tr);
    expect(v.correct, `reasons: ${v.reasons.join(', ')}`).toBe(true);
    expect(v.high_sev_defects).toBe(0);
    expect(v.oracle_kind).toBe('gold_answer');
  });

  it('NUMERIC: the sentinel value WINS over an intermediate CoT number', () => {
    const t = task('p4-num-avg-speed');
    // The buried distractor 76 appears mid-text; grading the sentinel avoids it.
    const tr = transcript('Mean of speeds = 76. FINAL ANSWER: 75', '75');
    expect(gradeArmAnswer(t, tr).correct).toBe(true);
  });

  it('NUMERIC: a wrong sentinel is caught as a defect', () => {
    const t = task('p4-num-avg-speed');
    const tr = transcript('FINAL ANSWER: 76', '76');
    const v = gradeArmAnswer(t, tr);
    expect(v.correct).toBe(false);
    expect(v.high_sev_defects).toBeGreaterThan(0);
  });

  it('CONSTRAINT: a fenced JSON block grades via the constraint oracle', () => {
    const t = task('p4-con-server-sizing');
    const tr = transcript(
      "Here is a valid config.\n```json\n{\"cpu\": 8, \"memory_gb\": 32, \"replicas\": 6, \"tier\": \"standard\"}\n```",
    );
    const v = gradeArmAnswer(t, tr);
    expect(v.correct, `reasons: ${v.reasons.join(', ')}`).toBe(true);
    expect(v.oracle_kind).toBe('structured_constraint');
  });

  it('CONSTRAINT: a buried final JSON object (no fence) is still extracted and graded', () => {
    const t = task('p4-con-server-sizing');
    const tr = transcript(
      'I considered {"cpu": 2} first but that violates cpu>4. ' +
        'FINAL ANSWER: {"cpu": 6, "memory_gb": 16, "replicas": 9, "tier": "supported"}',
    );
    expect(gradeArmAnswer(t, tr).correct).toBe(true);
  });

  it('CONSTRAINT: a violating JSON answer is caught as a defect', () => {
    const t = task('p4-con-server-sizing');
    const tr = transcript('```json\n{"cpu": 4, "memory_gb": 8, "replicas": 12, "tier": "legacy"}\n```');
    const v = gradeArmAnswer(t, tr);
    expect(v.correct).toBe(false);
    expect(v.high_sev_defects).toBeGreaterThan(0);
  });

  it('SOURCE_SPAN: grades on the full final_text (post-fix oracle)', () => {
    const t = task('p4-qa-superseded-retention');
    const tr = transcript('Per the current policy, logs are retained for 90 days.');
    const v = gradeArmAnswer(t, tr);
    expect(v.correct, `reasons: ${v.reasons.join(', ')}`).toBe(true);
    expect(v.oracle_kind).toBe('source_span');
  });

  it('SOURCE_SPAN: laundering a planted distractor is a defect', () => {
    const t = task('p4-qa-superseded-retention');
    const tr = transcript('Logs are retained for 90 days, though some say 30 days.');
    const v = gradeArmAnswer(t, tr);
    expect(v.correct).toBe(false);
    expect(v.reasons.some(r => r.includes('asserted_unsupported'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Refusal / non-answer → an HONEST no_answer DEFECT for every oracle kind.
// ════════════════════════════════════════════════════════════════════════════

describe('gradeArmAnswer — refusal / non-answer is a reported defect', () => {
  it('CONSTRAINT refusal (prose, no JSON) → no_answer defect (the round-1 SHARED_COT_SYS case)', () => {
    const t = task('p4-con-server-sizing');
    const tr = transcript("A bare JSON response isn't helpful, so here is my advice instead.");
    const v = gradeArmAnswer(t, tr);
    expect(v.correct).toBe(false);
    expect(v.high_sev_defects).toBe(1);
    expect(v.reasons).toEqual(['no_answer']);
    expect(v.oracle_kind).toBe('structured_constraint');
  });

  it('NUMERIC empty transcript → no_answer defect', () => {
    const t = task('p4-num-avg-speed');
    const v = gradeArmAnswer(t, transcript('', null));
    expect(v.correct).toBe(false);
    expect(v.reasons).toEqual(['no_answer']);
    expect(v.oracle_kind).toBe('gold_answer');
  });

  it('SOURCE_SPAN empty transcript → no_answer defect', () => {
    const t = task('p4-qa-superseded-retention');
    const v = gradeArmAnswer(t, transcript('', null));
    expect(v.correct).toBe(false);
    expect(v.reasons).toEqual(['no_answer']);
    expect(v.oracle_kind).toBe('source_span');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Re-grade the THREE round-1 cases correctly on the FIXED instrument.
// ════════════════════════════════════════════════════════════════════════════

describe('round-1 re-grade on the fixed instrument', () => {
  it('p4-qa-conflicting-price: VERBATIM "$50 per month" answer → CORRECT (was missing_gold_span)', () => {
    const t = task('p4-qa-conflicting-price');
    const tr = transcript('The Pro plan is $50 per month.', 'The Pro plan is $50 per month.');
    const v = gradeArmAnswer(t, tr);
    expect(v.correct, `reasons: ${v.reasons.join(', ')}`).toBe(true);
    expect(v.high_sev_defects).toBe(0);
  });

  it('p4-con-clean-order: a valid JSON answer → CORRECT (was no_structured_object_parsed)', () => {
    const t = task('p4-con-clean-order');
    const tr = transcript('{"quantity": 10, "unit_price": 5, "discount": 10, "status": "open"}');
    const v = gradeArmAnswer(t, tr);
    expect(v.correct, `reasons: ${v.reasons.join(', ')}`).toBe(true);
    expect(v.high_sev_defects).toBe(0);
  });

  it('p4-num-avg-speed: "FINAL ANSWER: 75" → CORRECT (was mis-extracted from CoT)', () => {
    const t = task('p4-num-avg-speed');
    const tr = transcript(
      'Total distance 150 km over 2 h. Averaging the two speeds gives 76, but that is the trap.\n' +
        'FINAL ANSWER: 75',
      '75',
    );
    const v = gradeArmAnswer(t, tr);
    expect(v.correct, `reasons: ${v.reasons.join(', ')}`).toBe(true);
    expect(v.high_sev_defects).toBe(0);
  });
});
