/**
 * Phase 4 STEP 4 — textbook-fixture tests for the CI library
 * (benchmark/phase4/stats.ts). Per PHASE4_PREREGISTRATION.md §9 frozen-invariant
 * #11: the CI library (Wilson, Newcombe method-10, exact McNemar,
 * cluster-by-base bootstrap) is unit-tested vs TEXTBOOK fixtures with KNOWN
 * answers. Every fixture cites its source value in a comment.
 *
 * NO model / LLM / claude-CLI calls anywhere — this is pure math.
 */

import { describe, it, expect } from 'vitest';

import {
  wilsonInterval,
  newcombeDiff,
  exactMcNemar,
  clusterBootstrap,
  proportionReport,
  mulberry32,
  FROZEN_SEED,
} from '../../benchmark/phase4/stats.js';

// Helper: assert two numbers are close to a documented number of places.
const near = (actual: number, expected: number, places = 4) =>
  expect(actual).toBeCloseTo(expected, places);

describe('wilsonInterval — Wilson (1927) score interval, z=1.96 (95%)', () => {
  it('Wilson(0, 41) -> lower 0, upper ~0.0857 (0/n clean-control edge)', () => {
    // Source: Wilson score interval at p_hat=0, n=41, z=1.96. The prereg quotes
    // false_block 0/41 -> [0, ~0.086]. Direct computation gives upper 0.08567.
    const w = wilsonInterval(0, 41);
    near(w.point, 0);
    near(w.lower, 0);
    near(w.upper, 0.0857, 3);
  });

  it('Wilson(106, 106) -> upper 1, lower ~0.965 (n/n recall edge)', () => {
    // Source: Wilson at p_hat=1, n=106, z=1.96 -> lower 0.96503, upper clamps to 1.
    const w = wilsonInterval(106, 106);
    near(w.point, 1);
    near(w.upper, 1);
    near(w.lower, 0.9650, 3);
  });

  it('Wilson(8, 10) -> ~[0.490, 0.943] (standard textbook small-sample example)', () => {
    // Source: Wilson score interval for 8/10 at 95% is widely tabulated as
    // [0.490, 0.943] (e.g. Brown, Cai & DasGupta 2001 worked examples; matches
    // R binom::binom.wilson(8,10)).
    const w = wilsonInterval(8, 10);
    near(w.point, 0.8);
    near(w.lower, 0.4902, 3);
    near(w.upper, 0.9433, 3);
  });

  it('Wilson(81, 263) -> ~[0.255, 0.366] (Wallis 2013 worked example)', () => {
    // Source: Wallis (2013), "Binomial confidence intervals and contingency
    // tests", p_hat = 81/263 = 0.3080; Wilson 95% CI [0.2553, 0.3662].
    const w = wilsonInterval(81, 263);
    near(w.point, 0.3080, 3);
    near(w.lower, 0.2553, 3);
    near(w.upper, 0.3662, 3);
  });

  it('is symmetric under success<->failure reflection', () => {
    // Property check: Wilson(s,n) and Wilson(n-s,n) are mirror images about 0.5.
    const a = wilsonInterval(8, 10);
    const b = wilsonInterval(2, 10);
    near(a.lower, 1 - b.upper);
    near(a.upper, 1 - b.lower);
  });

  it('n=0 yields the no-information interval [0,1]', () => {
    const w = wilsonInterval(0, 0);
    expect(w.lower).toBe(0);
    expect(w.upper).toBe(1);
  });

  it('rejects out-of-range inputs', () => {
    expect(() => wilsonInterval(5, 4)).toThrow();
    expect(() => wilsonInterval(-1, 10)).toThrow();
  });
});

describe('newcombeDiff — Newcombe (1998) method 10, independent proportions', () => {
  it('56/70 vs 48/80 -> diff 0.200, CI [0.0524, 0.3339] (Newcombe 1998 Table II)', () => {
    // Source: Newcombe RG (1998), Statistics in Medicine 17:873-890, method 10
    // worked example: p1=56/70=0.800, p2=48/80=0.600, diff 0.200,
    // 95% CI (0.0524, 0.3339).
    const r = newcombeDiff(56, 70, 48, 80);
    near(r.diff, 0.2, 4);
    near(r.lower, 0.0524, 3);
    near(r.upper, 0.3339, 3);
  });

  it('15/148 vs 1/132 -> diff 0.0938, CI ~[0.0420, 0.1532] (Newcombe 1998)', () => {
    // Source: Newcombe (1998) worked example for a small second proportion:
    // p1=15/148=0.1014, p2=1/132=0.0076, diff 0.0938, method-10 CI ~(0.0420, 0.1532).
    const r = newcombeDiff(15, 148, 1, 132);
    near(r.diff, 0.0938, 3);
    near(r.lower, 0.0420, 3);
    near(r.upper, 0.1532, 3);
  });

  it('is sign-antisymmetric: diff and CI of (2 vs 1) mirror (1 vs 2)', () => {
    const ab = newcombeDiff(56, 70, 48, 80);
    const ba = newcombeDiff(48, 80, 56, 70);
    near(ba.diff, -ab.diff);
    near(ba.lower, -ab.upper);
    near(ba.upper, -ab.lower);
  });

  it('rejects empty samples', () => {
    expect(() => newcombeDiff(1, 0, 1, 5)).toThrow();
  });
});

describe('exactMcNemar — exact binomial McNemar (McNemar 1947; exact variant)', () => {
  it('b=3, c=0 -> two-sided exact p = 0.25', () => {
    // Source: under H0 the 3 discordant pairs are Binomial(3, 0.5); the only
    // outcomes at least as extreme as 3-of-3 are {0,3}, p = 2 * 0.5^3 = 0.25.
    expect(exactMcNemar(3, 0).p_value).toBeCloseTo(0.25, 10);
  });

  it('b=5, c=0 -> two-sided exact p = 0.0625', () => {
    // Source: 2 * 0.5^5 = 0.0625 (Binomial(5,0.5), tails {0,5}).
    expect(exactMcNemar(5, 0).p_value).toBeCloseTo(0.0625, 10);
  });

  it('b=12, c=2 -> two-sided exact p ~ 0.0129 (cited reference)', () => {
    // Source: exact two-sided McNemar on discordants (12,2), n=14, p=0.5. The
    // exact p-value is 0.01294 (matches R exact2x2::mcnemar.exact and
    // statsmodels.stats.contingency_tables.mcnemar(exact=True)).
    expect(exactMcNemar(12, 2).p_value).toBeCloseTo(0.01294, 4);
  });

  it('b=0, c=0 -> p = 1 (no discordant pairs, no evidence)', () => {
    expect(exactMcNemar(0, 0).p_value).toBe(1);
  });

  it('b=1, c=0 -> p = 1 (single discordant pair is uninformative)', () => {
    // Binomial(1,0.5): both outcomes {0,1} are as extreme -> p = 1.
    expect(exactMcNemar(1, 0).p_value).toBeCloseTo(1, 10);
  });

  it('is symmetric in (b, c)', () => {
    expect(exactMcNemar(12, 2).p_value).toBeCloseTo(exactMcNemar(2, 12).p_value, 12);
  });

  it('echoes back the input cell counts', () => {
    const r = exactMcNemar(12, 2);
    expect(r.b).toBe(12);
    expect(r.c).toBe(2);
  });

  it('rejects non-integer / negative cells', () => {
    expect(() => exactMcNemar(1.5, 0)).toThrow();
    expect(() => exactMcNemar(-1, 0)).toThrow();
  });
});

describe('clusterBootstrap — cluster (block) bootstrap, seeded (Davison & Hinkley 1997)', () => {
  // Mean over a flattened sample (the simplest statFn for testing).
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('DETERMINISM: same seed -> identical CI', () => {
    const clusters = [
      [1, 0, 1],
      [0, 0, 1],
      [1, 1, 1],
      [0, 1, 0],
    ];
    const a = clusterBootstrap(clusters, mean, { seed: FROZEN_SEED, iters: 1000 });
    const b = clusterBootstrap(clusters, mean, { seed: FROZEN_SEED, iters: 1000 });
    expect(a.lower).toBe(b.lower);
    expect(a.upper).toBe(b.upper);
    expect(a.point).toBe(b.point);
    expect(a.iters).toBe(1000);
  });

  it('different seed -> different but bounded CI', () => {
    const clusters = [
      [1, 0, 1],
      [0, 0, 1],
      [1, 1, 1],
      [0, 1, 0],
    ];
    const a = clusterBootstrap(clusters, mean, { seed: 42, iters: 1000 });
    const b = clusterBootstrap(clusters, mean, { seed: 7, iters: 1000 });
    // Different seeds must move the percentile endpoints...
    expect(a.lower !== b.lower || a.upper !== b.upper).toBe(true);
    // ...but the point statistic (no resampling) is identical...
    expect(a.point).toBe(b.point);
    // ...and both CIs stay inside the valid [0,1] support of a mean of 0/1s.
    for (const r of [a, b]) {
      expect(r.lower).toBeGreaterThanOrEqual(0);
      expect(r.upper).toBeLessThanOrEqual(1);
      expect(r.lower).toBeLessThanOrEqual(r.point);
      expect(r.upper).toBeGreaterThanOrEqual(r.point);
    }
  });

  it('SANITY: all clusters identical -> zero-width CI at the point', () => {
    // Every resample is the same multiset, so every bootstrap stat equals the
    // point estimate -> lower == upper == point.
    const clusters = [
      [1, 0],
      [1, 0],
      [1, 0],
      [1, 0],
    ];
    const r = clusterBootstrap(clusters, mean, { seed: FROZEN_SEED });
    near(r.point, 0.5);
    expect(r.lower).toBeCloseTo(r.point, 12);
    expect(r.upper).toBeCloseTo(r.point, 12);
  });

  it('defaults to the frozen seed (42) when none is given', () => {
    const clusters = [[1, 0, 1], [0, 0], [1, 1, 1, 0]];
    const withDefault = clusterBootstrap(clusters, mean, { iters: 500 });
    const withSeed42 = clusterBootstrap(clusters, mean, { iters: 500, seed: FROZEN_SEED });
    expect(withDefault.lower).toBe(withSeed42.lower);
    expect(withDefault.upper).toBe(withSeed42.upper);
  });

  it('resamples WHOLE clusters (honest effective n), not elements', () => {
    // Two clusters whose internal means are 0 and 1. Whole-cluster resampling can
    // only ever produce sample means in {0, 0.5, 1}; element resampling could not
    // hold a cluster together. With 2 clusters, a wide CkI spanning toward both
    // extremes proves clusters move as units.
    const clusters = [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
    ];
    const r = clusterBootstrap(clusters, mean, { seed: FROZEN_SEED, iters: 2000 });
    near(r.point, 0.5);
    // Endpoints land on achievable whole-cluster means (0 or 1), never a within-
    // cluster fraction like 0.25.
    expect(r.lower).toBeCloseTo(0, 12);
    expect(r.upper).toBeCloseTo(1, 12);
  });

  it('rejects empty cluster lists and non-positive iters', () => {
    expect(() => clusterBootstrap([], mean)).toThrow();
    expect(() => clusterBootstrap([[1]], mean, { iters: 0 })).toThrow();
  });
});

describe('mulberry32 — seeded deterministic PRNG (not the global Math.random)', () => {
  it('is reproducible and stays in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 5; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('different seeds diverge', () => {
    expect(mulberry32(42)()).not.toBe(mulberry32(43)());
  });
});

describe('proportionReport — block-accounting helper (0/n WITH its Wilson upper bound)', () => {
  it('0/41 reports rate 0 with a NON-zero Wilson upper bound (~0.086)', () => {
    // Per the prereg block-accounting rule: a 0/n outcome is reported with its
    // Wilson upper bound, never as a certain 0.
    const r = proportionReport(0, 41);
    expect(r.rate).toBe(0);
    expect(r.n).toBe(41);
    near(r.ci[0], 0);
    near(r.ci[1], 0.0857, 3);
    expect(r.ci[1]).toBeGreaterThan(0);
  });

  it('106/106 reports rate 1 with Wilson lower ~0.965 and upper 1', () => {
    const r = proportionReport(106, 106);
    expect(r.rate).toBe(1);
    near(r.ci[0], 0.9650, 3);
    near(r.ci[1], 1);
  });
});
