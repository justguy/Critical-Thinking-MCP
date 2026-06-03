/**
 * Phase 4 — oracle adversarial-robustness fixtures (build STEP 5, Deliverable 3).
 *
 * A mis-grading oracle poisons the entire experiment, so this hardens the
 * GRADERS against tricky answer prose. NO model / CLI calls.
 *
 * It probes gradeWithOracle / extractNumericAnswer / the source-span checker on:
 *   • trailing-number ("…the result is 42 dollars." → 42, not a stray token)
 *   • negation ("the price is NOT 50; it is 42" → 42)
 *   • "X not Y" phrasing
 *   • a unit-suffixed answer ("42 USD" → 42)
 *   • a multi-number answer where a FINAL-ANSWER sentinel disambiguates
 *   • a source-span answer that laundering-asserts a planted_unsupported
 *     distractor (→ defect)
 *
 * ── FINDING (documented, not silently patched) ──────────────────────────────
 * extractNumericAnswer is robust whenever a final-answer MARKER is present
 * ("answer/result/total/final"), which the Phase-4 corpus and the harness
 * `FINAL ANSWER:` sentinel ALWAYS provide. There is ONE genuine mis-grade in
 * the *marker-less* form `"It is 42, not 50."` (correct value first, a rejected
 * "not Y" value last): the last-number fallback returns the REJECTED value 50.
 * This is pinned below as a characterization test (expected behavior recorded,
 * NOT asserted-correct) plus a guard test proving the marker form rescues it.
 * Per the build scope, oracles.ts is NOT changed here; this is flagged for the
 * freeze record (prereg §9.3 — extractNumericAnswer is load-bearing & hashed).
 */

import { describe, it, expect } from 'vitest';
import {
  gradeWithOracle,
  extractNumericAnswer,
  type Oracle,
} from '../../benchmark/oracles.js';

describe('extractNumericAnswer — trailing number', () => {
  it('takes the concluded trailing number, not a stray earlier token', () => {
    expect(extractNumericAnswer('First we considered 100, but therefore the result is 42 dollars.')).toBe(42);
  });
  it('ignores a unit suffix', () => {
    expect(extractNumericAnswer('The total is 42 USD.')).toBe(42);
  });
  it('handles a currency + thousands-separator answer', () => {
    expect(extractNumericAnswer('Total: $1,294.50')).toBe(1294.5);
  });
});

describe('extractNumericAnswer — negation and "X not Y"', () => {
  it('negation: "the price is NOT 50; it is 42" → 42 (last number, no marker before 50)', () => {
    expect(extractNumericAnswer('the price is NOT 50; it is 42')).toBe(42);
  });

  it('"not Y; the correct value is X" → 42 via the marker-less last-number rule', () => {
    expect(extractNumericAnswer('It is not 50; the correct value is 42.')).toBe(42);
  });

  // CHARACTERIZATION of the documented finding: marker-less "X, not Y" with the
  // rejected value LAST mis-extracts the rejected value. Recorded as the CURRENT
  // behavior (toBe(50)), NOT endorsed as correct — see file header + report.
  it('FINDING: marker-less "It is 42, not 50." mis-extracts the rejected 50 (current behavior)', () => {
    expect(extractNumericAnswer('It is 42, not 50.')).toBe(50);
  });

  // GUARD: any final-answer marker rescues the same sentence — and the Phase-4
  // corpus / harness sentinel always supply one, so the experiment is unaffected.
  it('GUARD: a marker rescues the same case', () => {
    expect(extractNumericAnswer('The answer is 42, not 50.')).toBe(42);
    expect(extractNumericAnswer('The result is 42 not 50')).toBe(42);
    expect(extractNumericAnswer('FINAL ANSWER: 42 (not 50).')).toBe(42);
  });
});

describe('extractNumericAnswer — multi-number disambiguated by FINAL-ANSWER sentinel', () => {
  it('picks the sentinel value over intermediate step numbers', () => {
    expect(extractNumericAnswer('Step 1: 30. Step 2: 27. Step 3: 20. FINAL ANSWER: 77')).toBe(77);
  });
  it('marker beats a trailing footnote number', () => {
    expect(extractNumericAnswer('Answer: 77 is the figure. (See footnote 9.)')).toBe(77);
  });
});

describe('gold_answer grading — sentinel-driven correctness on adversarial prose', () => {
  const oracle: Oracle = { kind: 'gold_answer', gold: 77, tolerance: 0.01, distractors: [83.33] };

  it('grades correct when the FINAL-ANSWER sentinel carries the gold', () => {
    const v = gradeWithOracle(oracle, 'Some might say 83.33. FINAL ANSWER: 77');
    expect(v.correct).toBe(true);
    expect(v.high_sev_defects).toBe(0);
  });

  it('grades incorrect (and labels the distractor) on a unit-suffixed wrong answer', () => {
    const v = gradeWithOracle(oracle, 'The average works out to 83.33 points.');
    expect(v.correct).toBe(false);
    expect(v.reasons).toContain('matched_known_distractor');
  });

  it('a trailing-number wrong answer is caught even without a marker', () => {
    const v = gradeWithOracle(oracle, 'After working it out the figure is 83.33.');
    expect(v.correct).toBe(false);
  });
});

describe('source_span grading — laundering a planted distractor is a defect', () => {
  const oracle: Oracle = {
    kind: 'source_span',
    source_text:
      'The Acme API access token is valid until it is manually revoked by an administrator; there is no automatic expiry.',
    gold_span: 'manually revoked',
    planted_unsupported: ['every 24 hours', 'every 90 days', 'resets daily'],
  };

  it('accepts a grounded answer that conveys the gold span and no distractor', () => {
    const v = gradeWithOracle(oracle, 'It is valid until manually revoked by an administrator.');
    expect(v.correct).toBe(true);
    expect(v.high_sev_defects).toBe(0);
  });

  it('flags an answer that conveys the gold span BUT also launders a planted distractor', () => {
    // Conveys "manually revoked" (so it would pass span-only) yet asserts a
    // fabricated cadence — the grounding predicate must still mark a defect.
    const v = gradeWithOracle(
      oracle,
      'It is valid until manually revoked, and it also automatically resets every 24 hours.',
    );
    expect(v.correct).toBe(false);
    expect(v.reasons.some(r => r.includes('asserted_unsupported:every 24 hours'))).toBe(true);
  });

  it('flags a stripped gold span (controlling fact absent)', () => {
    const v = gradeWithOracle(oracle, 'The token simply never expires.');
    expect(v.correct).toBe(false);
    expect(v.reasons).toContain('missing_gold_span');
  });

  it('refuses to mis-score if a "planted" fact were actually in the source (oracle-misconfig guard)', () => {
    const misconfigured: Oracle = {
      kind: 'source_span',
      source_text: 'The token resets every 24 hours.',
      gold_span: 'resets',
      planted_unsupported: ['every 24 hours'],
    };
    const v = gradeWithOracle(misconfigured, 'The token resets every 24 hours.');
    expect(v.correct).toBe(false);
    expect(v.reasons.some(r => r.startsWith('oracle_misconfig:'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Amendment B1 — source_span matcher is robust to CURRENCY/PUNCTUATION ADJACENCY,
// yet stays STRICT on distractor laundering and missing gold (Deliverable 1).
// Round-1 bug: gold_span "50 per month" did not match a VERBATIM "$50 per month"
// answer because the "$" was glued to the token. The fix peels currency/symbol
// edges WITHOUT loosening into a substring proxy.
// ════════════════════════════════════════════════════════════════════════════

describe('source_span — currency/punctuation adjacency (the round-1 bug)', () => {
  const priceOracle: Oracle = {
    kind: 'source_span',
    source_text: 'According to the official current pricing page, the Pro plan is $50 per month.',
    gold_span: '50 per month',
    planted_unsupported: ['40 per month', '25 per month', '45 per month'],
  };

  it('finds gold "50 per month" in the VERBATIM "$50 per month" answer (was a false defect)', () => {
    const v = gradeWithOracle(priceOracle, 'The Pro plan is $50 per month.');
    expect(v.correct, `reasons: ${v.reasons.join(', ')}`).toBe(true);
    expect(v.high_sev_defects).toBe(0);
  });

  it('finds gold even with a trailing-punctuation / parenthetical answer', () => {
    const v = gradeWithOracle(priceOracle, 'Per official pricing: ($50 per month).');
    expect(v.correct).toBe(true);
  });

  it('STILL fails when the answer launders a planted distractor ("$40 per month")', () => {
    const v = gradeWithOracle(priceOracle, 'The archived list says the Pro plan is $40 per month.');
    expect(v.correct).toBe(false);
    expect(v.reasons.some(r => r.includes('asserted_unsupported:40 per month'))).toBe(true);
  });

  it('STILL fails when the gold fact is genuinely missing', () => {
    const v = gradeWithOracle(priceOracle, 'The Pro plan is reasonably priced.');
    expect(v.correct).toBe(false);
    expect(v.reasons).toContain('missing_gold_span');
  });

  it('a partial-token answer ("$5 per month") does NOT spuriously match "50"', () => {
    // Strictness guard: edge-stripping must not turn "5" into "50".
    const v = gradeWithOracle(priceOracle, 'The Pro plan is $5 per month.');
    expect(v.correct).toBe(false);
    expect(v.reasons).toContain('missing_gold_span');
  });
});

describe('source_span — bare currency, thousands separators, trailing punctuation', () => {
  it('finds a bare-currency gold "42" in "$42"', () => {
    const oracle: Oracle = {
      kind: 'source_span',
      source_text: 'The setup fee is $42 one time.',
      gold_span: '42',
      planted_unsupported: ['24', '420'],
    };
    expect(gradeWithOracle(oracle, 'The setup fee is $42.').correct).toBe(true);
  });

  it('finds a thousands-separated currency gold "1,294.50" in "$1,294.50 USD"', () => {
    const oracle: Oracle = {
      kind: 'source_span',
      source_text: 'The annual total is $1,294.50 USD as invoiced.',
      gold_span: '1,294.50',
      planted_unsupported: ['1,249.50', '2,194.50'],
    };
    expect(gradeWithOracle(oracle, 'The annual total is $1,294.50 USD.').correct).toBe(true);
  });

  it('finds a gold token with answer-side trailing punctuation ("room b12.")', () => {
    const oracle: Oracle = {
      kind: 'source_span',
      source_text: 'The all-hands meeting is in room B12 on the second floor.',
      gold_span: 'room b12',
      planted_unsupported: ['room b21', 'room d12'],
    };
    expect(gradeWithOracle(oracle, 'The meeting is in room B12!').correct).toBe(true);
  });
});
