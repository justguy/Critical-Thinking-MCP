/**
 * Tier-2 hardenings (steps #5/#6/#9):
 *  - widened claimed-confidence extraction (returns the max stated certainty)
 *  - confidence/hedge contradiction
 *  - falsification↔assumption binding (floating-condition warning)
 *  - tautology / bare-negation guard
 *
 * All BLOCK-bearing behavior stays unforgeable/within-request; binding+tautology are
 * WARNING-only; hedge contradiction BLOCKs only at claimed ≥ 0.9 + heavy hedging.
 */

import { describe, it, expect } from 'vitest';

import {
  EnforcementEngine,
  computeConfidenceProduct,
  checkConfidenceHedgeConsistency,
  isBoundToAssumption,
  isTautological,
} from '../../src/enforcement/index.js';
import { handleValidateConfidence } from '../../src/tools/validate_confidence.js';

const engine = new EnforcementEngine();
const claimed = (text: string) =>
  computeConfidenceProduct([{ description: 'x', confidence: 0.5 }], text).claimed_confidence;

describe('widened claimed-confidence extraction', () => {
  it('legacy phrases still work', () => {
    expect(claimed('I am very confident this works')).toBe(0.9);
    expect(claimed('90% confident in this')).toBeCloseTo(0.9, 5);
  });
  it('new numeric forms: p=, N out of 10', () => {
    expect(claimed('the probability of success is p = 0.95 here')).toBeCloseTo(0.95, 5);
    expect(claimed('I rate this 9 out of 10')).toBeCloseTo(0.9, 5);
  });
  it('new anchored phrases', () => {
    expect(claimed('I am certain this will hold')).toBe(0.97);
    expect(claimed('this is almost certainly correct')).toBe(0.9);
    expect(claimed('we are confident in the rollout')).toBe(0.8);
  });
  it('returns the MAX over multiple signals', () => {
    expect(claimed('I am 70% confident, but honestly I am certain')).toBe(0.97);
  });
  it('does not fire on incidental hedged prose', () => {
    expect(claimed('this will probably help and might work')).toBeNull();
  });
  it('polarity guard: negated certainty is NOT read as high confidence', () => {
    expect(claimed('it is almost certainly not a memory leak')).toBeNull();
    expect(claimed('I am not confident this is correct')).toBeNull();
    expect(claimed('we are certainly not sure about this')).toBeNull();
  });
});

describe('confidence/hedge contradiction', () => {
  const heavy = { hedge_density: 0.6, severity: 'heavy' as const, hedged_sentences: [] };
  const moderate = { hedge_density: 0.3, severity: 'moderate' as const, hedged_sentences: [] };
  const clean = { hedge_density: 0.0, severity: 'clean' as const, hedged_sentences: [] };

  it('claimed ≥0.9 + heavy → blocking', () => {
    expect(checkConfidenceHedgeConsistency(0.95, heavy).severity).toBe('blocking');
  });
  it('claimed ≥0.8 + moderate → warning', () => {
    expect(checkConfidenceHedgeConsistency(0.85, moderate).severity).toBe('warning');
  });
  it('claimed ≥0.9 + clean → none', () => {
    expect(checkConfidenceHedgeConsistency(0.95, clean).severity).toBe('none');
  });
  it('null claim → none', () => {
    expect(checkConfidenceHedgeConsistency(null, heavy).severity).toBe('none');
  });
});

describe('falsification↔assumption binding', () => {
  it('a condition sharing the assumption subject is bound', () => {
    expect(
      isBoundToAssumption('RedisCache p99 stays low', 'RedisCache p99 exceeds 50ms for 5 minutes'),
    ).toBe(true);
  });
  it('a free-floating threshold not tied to the subject is unbound', () => {
    expect(isBoundToAssumption('The database handles load', 'latency exceeds 200ms for 5 minutes')).toBe(false);
  });
});

describe('tautology / bare-negation guard', () => {
  it('flags a bare negation with no measurable marker', () => {
    expect(isTautological('The cache works', 'fails if it does not work')).toBe(true);
  });
  it('flags a vague-degree condition', () => {
    expect(isTautological('The API is fast', 'it is too slow')).toBe(true);
  });
  it('does NOT flag a real threshold-bearing condition', () => {
    expect(isTautological('The API is fast', 'p99 latency exceeds 200ms')).toBe(false);
  });
  it('does NOT flag a specific negative condition that names a real behavior', () => {
    expect(
      isTautological('The parser handles UTF-8 input', 'the parser does not correctly decode UTF-8 multibyte sequences'),
    ).toBe(false);
  });
  it('flags a near-restatement of the assumption', () => {
    expect(isTautological('the queue drains within budget', 'the queue does not drain within budget')).toBe(true);
  });
});

describe('validate_confidence integration', () => {
  it('floating measurable condition → WARNING (not a block on its own)', () => {
    const out = handleValidateConfidence(
      {
        assumptions: [
          {
            description: 'The database handles load',
            confidence: 0.6,
            falsification_condition: 'latency exceeds 200ms for 5 minutes',
          },
        ],
        response_text: 'The system should handle the projected load.',
      },
      engine,
    );
    expect(out.enforcement?.warnings.some(w => w.includes('floating falsification condition'))).toBe(true);
  });

  const heavyHedgeContradiction = {
    assumptions: [
      {
        description: 'RedisCache p99 stays under 50ms',
        confidence: 0.95,
        falsification_condition: 'RedisCache p99 latency exceeds 50ms for >1% of requests in a 5-minute window',
      },
    ],
    // claimed 0.95 (no inflation vs ceiling 0.95) but majority-hedged sentences → heavy
    response_text: 'I am 95% confident. This might work. It could possibly fail. Perhaps it may vary under load.',
  };

  it('high claimed confidence + heavy hedging → WARNING by default (no new default BLOCK)', () => {
    const out = handleValidateConfidence(heavyHedgeContradiction, engine);
    expect(out.status).toBe('PASS');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'confidence_hedge') ?? false).toBe(false);
    expect(out.enforcement?.warnings.some(w => w.includes('hedging'))).toBe(true);
  });

  it('same case under strict:true → BLOCK via confidence_hedge', () => {
    const out = handleValidateConfidence({ ...heavyHedgeContradiction, strict: true }, engine);
    expect(out.status).toBe('ENFORCEMENT_FAIL');
    expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'confidence_hedge')).toBe(true);
  });

  it('assertive-but-cautious technical prose does NOT block (clean control)', () => {
    const cautious = [
      'I am highly confident this is the right migration path, but there are deployment risks.',
      'We are confident in the benchmark result, assuming the same hardware profile.',
      'This is almost certainly correct; still validate against production traffic.',
    ];
    for (const text of cautious) {
      // strict mode on, to prove even strict does not block ordinary cautious prose
      const out = handleValidateConfidence(
        {
          assumptions: [{ description: 'the migration is safe', confidence: 0.8, falsification_condition: 'rollback rate exceeds 1% within a 30-minute window' }],
          response_text: text,
          strict: true,
        },
        engine,
      );
      expect(out.enforcement?.blocking_issues.some(b => b.mechanism === 'confidence_hedge') ?? false).toBe(false);
    }
  });
});
