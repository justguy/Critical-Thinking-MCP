/**
 * Objective-oracle tests (plan §1a "Oracles, not proxies").
 *
 * Proves the scored graders are objective predicates, NOT substring presence:
 * a gold-answer oracle rejects an answer that merely *contains* the gold token
 * but concludes a different number, etc.
 *
 * No LLM / CLI calls — pure deterministic grading.
 */

import { describe, it, expect } from 'vitest';
import {
  gradeWithOracle,
  extractNumericAnswer,
  extractJsonObject,
  type Oracle,
} from '../../benchmark/oracles.js';

describe('extractNumericAnswer', () => {
  it('prefers an explicit final-answer marker', () => {
    expect(extractNumericAnswer('First 83, but the final answer is 77.')).toBe(77);
  });
  it('falls back to the last number when no marker', () => {
    expect(extractNumericAnswer('30 + 27 + 20 = 77')).toBe(77);
  });
  it('strips currency and thousands separators', () => {
    expect(extractNumericAnswer('Total: $1,294.50')).toBe(1294.5);
  });
  it('returns null when no number present', () => {
    expect(extractNumericAnswer('no numbers here')).toBeNull();
  });
});

describe('gold_answer oracle is NOT a substring proxy', () => {
  const oracle: Oracle = { kind: 'gold_answer', gold: 77, distractors: [83.33] };

  it('accepts a correct concluded answer', () => {
    const v = gradeWithOracle(oracle, 'The weighted grade is 77.');
    expect(v.correct).toBe(true);
    expect(v.high_sev_defects).toBe(0);
  });

  it('rejects the unweighted distractor even though it is a number', () => {
    const v = gradeWithOracle(oracle, 'The average is 83.33.');
    expect(v.correct).toBe(false);
    expect(v.reasons).toContain('matched_known_distractor');
  });

  it('rejects when gold appears mid-text but a wrong number is concluded', () => {
    // "77" appears, but the FINAL answer is 83 — a substring check would pass,
    // the objective oracle must fail.
    const v = gradeWithOracle(oracle, 'Some say 77 but the final answer is 83.');
    expect(v.correct).toBe(false);
  });
});

describe('source_span oracle', () => {
  const oracle: Oracle = {
    kind: 'source_span',
    source_text: 'The token is valid until it is manually revoked by an administrator.',
    gold_span: 'manually revoked',
    planted_unsupported: ['every 24 hours', 'every 90 days'],
  };

  it('accepts a grounded answer', () => {
    const v = gradeWithOracle(oracle, 'It is valid until manually revoked by an admin.');
    expect(v.correct).toBe(true);
  });

  it('flags fabricated unsupported cadence', () => {
    const v = gradeWithOracle(oracle, 'The token expires and resets every 24 hours.');
    expect(v.correct).toBe(false);
    expect(v.reasons.some(r => r.includes('asserted_unsupported'))).toBe(true);
  });

  it('flags a missing gold span', () => {
    const v = gradeWithOracle(oracle, 'The token never expires.');
    expect(v.correct).toBe(false);
    expect(v.reasons).toContain('missing_gold_span');
  });
});

describe('structured_constraint oracle', () => {
  const oracle: Oracle = {
    kind: 'structured_constraint',
    checks: [
      { id: 'mkt-gt', field: 'marketing', op: '>', value: 500 },
      { id: 'ops-lt', field: 'ops', op: '<', value: 500 },
    ],
  };

  it('accepts a satisfying JSON answer', () => {
    const v = gradeWithOracle(oracle, '{"marketing": 600, "ops": 400}');
    expect(v.correct).toBe(true);
  });

  it('accepts JSON inside a code fence', () => {
    const v = gradeWithOracle(oracle, 'Here:\n```json\n{"marketing": 700, "ops": 300}\n```');
    expect(v.correct).toBe(true);
  });

  it('flags a constraint violation', () => {
    const v = gradeWithOracle(oracle, '{"marketing": 400, "ops": 600}');
    expect(v.correct).toBe(false);
    expect(v.high_sev_defects).toBe(2);
  });

  it('flags an unparseable answer', () => {
    const v = gradeWithOracle(oracle, 'marketing is 600 and ops is 400');
    expect(v.correct).toBe(false);
    expect(v.reasons).toContain('no_structured_object_parsed');
  });
});

describe('extractJsonObject', () => {
  it('extracts a bare object', () => {
    expect(extractJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });
  it('extracts from a fenced block with prose', () => {
    expect(extractJsonObject('text ```{"a": 2}``` more')).toEqual({ a: 2 });
  });
  it('returns null when no object', () => {
    expect(extractJsonObject('[1,2,3]')).toBeNull();
  });
});
