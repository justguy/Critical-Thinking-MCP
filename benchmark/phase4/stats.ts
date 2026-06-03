/**
 * Phase 4 — the statistics library (PHASE4_PREREGISTRATION.md §6 metrics,
 * §9 frozen-invariant #11). This is the ONE CI library the prereg names:
 * Wilson score, Newcombe method-10, exact (binomial) McNemar, and a
 * cluster-by-base bootstrap. It is unit-tested against textbook fixtures
 * (tests/benchmark/phase4_stats.test.ts) and is content-hashed.
 *
 * EVERYTHING here is PURE MATH — no model calls, no claude CLI, no I/O.
 * Every formula is standard / textbook and cited in a comment at its function.
 * No statistic is invented.
 *
 * Conventions:
 *   - z=1.96 is the two-sided 95% normal quantile (Phi^-1(0.975)); documented
 *     at every default.
 *   - All proportions live in [0,1]; intervals are clamped to [0,1] where the
 *     parameter is a proportion (Wilson). Newcombe diffs live in [-1,1].
 */

/** A point estimate with a two-sided confidence interval. */
export interface Interval {
  point: number;
  lower: number;
  upper: number;
}

/** A difference-of-proportions estimate with its CI. */
export interface DiffInterval {
  diff: number;
  lower: number;
  upper: number;
}

/**
 * Wilson score interval for a single binomial proportion.
 *
 * Method: Wilson (1927), "Probable inference, the law of succession, and
 * statistical inference", JASA 22:209-212. The interval is the set of p whose
 * score statistic |p_hat - p| / sqrt(p(1-p)/n) <= z. Solving that quadratic
 * gives:
 *
 *   center = (p_hat + z^2/2n) / (1 + z^2/n)
 *   half   = (z / (1 + z^2/n)) * sqrt( p_hat(1-p_hat)/n + z^2/(4 n^2) )
 *
 * Unlike the Wald interval, Wilson is well-behaved at the boundaries: at
 * successes=0 the lower bound is 0 with a finite upper bound, and at
 * successes=n the upper bound is 1 with a finite lower bound. That boundary
 * behaviour is exactly why the prereg requires it for the 0/n clean-control
 * false-block rate (Wilson(0,41) -> upper ~0.0857) and the n/n recall
 * (Wilson(106,106) -> lower ~0.965).
 *
 * @param z two-sided normal quantile. Default 1.96 = 95% (Phi^-1(0.975)).
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): Interval {
  if (!Number.isFinite(successes) || !Number.isFinite(n)) {
    throw new Error('wilsonInterval: successes and n must be finite');
  }
  if (n < 0 || successes < 0 || successes > n) {
    throw new Error(`wilsonInterval: need 0 <= successes(${successes}) <= n(${n})`);
  }
  if (n === 0) {
    // No data: the proportion is undefined. Report a degenerate point at 0 with
    // the whole [0,1] as the interval (we know nothing).
    return { point: 0, lower: 0, upper: 1 };
  }

  const p = successes / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));

  return {
    point: p,
    lower: Math.max(0, center - half),
    upper: Math.min(1, center + half),
  };
}

/**
 * Newcombe method-10 CI for the DIFFERENCE of two INDEPENDENT proportions
 * (p1 - p2). This is the UNPAIRED diff — used for arm-vs-arm density diffs
 * where the two arms' cases are not paired row-for-row.
 *
 * Method: Newcombe (1998), "Interval estimation for the difference between
 * independent proportions: comparison of eleven methods", Statistics in
 * Medicine 17:873-890 — method 10 ("square-and-add", aka the Wilson-based
 * MOVER interval). Let (l1,u1) and (l2,u2) be the Wilson intervals for p1 and
 * p2. Then:
 *
 *   lower(p1 - p2) = (p1 - p2) - sqrt( (p1 - l1)^2 + (u2 - p2)^2 )
 *   upper(p1 - p2) = (p1 - p2) + sqrt( (u1 - p1)^2 + (p2 - l2)^2 )
 *
 * Newcombe's published worked values (used as our fixtures): 56/70 vs 48/80
 * gives diff 0.2000, CI [0.0524, 0.3339]; 15/148 vs 1/132 gives diff 0.0938,
 * CI ~[0.0420, 0.1532].
 *
 * @param z two-sided normal quantile. Default 1.96 = 95% (Phi^-1(0.975)).
 */
export function newcombeDiff(
  s1: number,
  n1: number,
  s2: number,
  n2: number,
  z = 1.96,
): DiffInterval {
  if (n1 <= 0 || n2 <= 0) {
    throw new Error('newcombeDiff: both n1 and n2 must be > 0');
  }
  const w1 = wilsonInterval(s1, n1, z);
  const w2 = wilsonInterval(s2, n2, z);
  const p1 = s1 / n1;
  const p2 = s2 / n2;
  const diff = p1 - p2;

  const lower = diff - Math.sqrt((p1 - w1.lower) ** 2 + (w2.upper - p2) ** 2);
  const upper = diff + Math.sqrt((w1.upper - p1) ** 2 + (p2 - w2.lower) ** 2);

  // A difference of proportions is bounded by [-1, 1].
  return {
    diff,
    lower: Math.max(-1, lower),
    upper: Math.min(1, upper),
  };
}

/**
 * Exact (binomial) McNemar test for a PAIRED 2x2 table, given only the two
 * DISCORDANT cell counts b and c.
 *
 * Method: the exact-binomial form of McNemar's test (McNemar 1947, Psychometrika
 * 12:153-157; exact variant per Edwards 1948 and standard texts e.g. Agresti,
 * "Categorical Data Analysis"). Under H0 (marginal homogeneity) the b discordant
 * pairs of one kind are Binomial(n = b + c, p = 0.5). The two-sided exact p-value
 * is the total probability of every outcome k in {0..n} at least as extreme
 * (i.e. PMF(k) <= PMF(b)) as the observed b:
 *
 *   p = sum_{k: Binom(k;n,0.5) <= Binom(b;n,0.5)} Binom(k; n, 0.5)
 *
 * This is the PAIRED test for the headline within-task arm contrasts
 * (H1-binding B-vs-D, H2-enforcement D-vs-C, H3-structure A-vs-C; §6 H-table).
 * With no discordant pairs (b=c=0) there is no evidence either way -> p=1.
 *
 * Fixtures: b=3,c=0 -> p=0.25 (= 2 * 0.5^3); b=5,c=0 -> p=0.0625 (= 2 * 0.5^5);
 * b=12,c=2 -> p~0.0129 (cited reference value).
 */
export function exactMcNemar(b: number, c: number): { p_value: number; b: number; c: number } {
  if (!Number.isInteger(b) || !Number.isInteger(c) || b < 0 || c < 0) {
    throw new Error('exactMcNemar: b and c must be non-negative integers');
  }
  const n = b + c;
  if (n === 0) {
    return { p_value: 1, b, c };
  }

  const observed = binomialPmf(b, n, 0.5);
  // Tolerance guards against float jitter when symmetric outcomes should tie.
  const tol = observed * 1e-9 + 1e-12;
  let p = 0;
  for (let k = 0; k <= n; k++) {
    const pmf = binomialPmf(k, n, 0.5);
    if (pmf <= observed + tol) {
      p += pmf;
    }
  }

  return { p_value: Math.min(1, p), b, c };
}

/**
 * Binomial PMF Binom(k; n, p) computed in log-space for numerical stability at
 * large n. log C(n,k) is accumulated termwise. Standard combinatorial identity.
 */
function binomialPmf(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return 0;
  let logC = 0;
  for (let i = 0; i < k; i++) {
    logC += Math.log(n - i) - Math.log(i + 1);
  }
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/**
 * mulberry32 — a tiny, fast, SEEDED deterministic 32-bit PRNG (public domain,
 * by Tommy Ettinger / popularized by bryc). Returns a function yielding floats
 * in [0,1). We use a SEEDED generator (NOT the unseeded JS Math.random) so every
 * bootstrap CI is bit-for-bit reproducible, per §9 frozen-invariant #11.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The frozen bootstrap seed (PHASE4_PREREGISTRATION.md §9: SEED=42). */
export const FROZEN_SEED = 42;

export interface BootstrapResult {
  point: number;
  lower: number;
  upper: number;
  iters: number;
}

/**
 * Cluster (block) bootstrap CI that RESAMPLES WHOLE CLUSTERS with replacement.
 *
 * Method: the nonparametric cluster/block bootstrap (Davison & Hinkley 1997,
 * "Bootstrap Methods and their Application", §3.8; Field & Welsh 2007 on cluster
 * resampling). The resampling unit is the CLUSTER, not the individual element:
 * on each iteration we draw `clusters.length` clusters with replacement, flatten
 * the chosen clusters into one sample, and recompute statFn on that flattened
 * sample. The CI is the percentile interval of those bootstrap statistics
 * (2.5/97.5 percentiles for z=1.96).
 *
 * Why clusters and not elements: per Amendment A3 / §9, the injected corpus is
 * ~41 clustered BASES (not 106 independent mutants). Resampling whole bases
 * respects the within-base dependence and yields the HONEST effective n; element
 * resampling would fabricate ~106 independent draws and overstate precision.
 *
 * Determinism: a SEEDED mulberry32 (default seed = FROZEN_SEED = 42) drives every
 * draw, so the same (clusters, statFn, opts) always returns the identical CI.
 *
 * @param clusters array of clusters; each cluster is an array of elements.
 * @param statFn   statistic computed on the FLATTENED resample.
 * @param opts.iters number of bootstrap iterations (default 2000).
 * @param opts.z    two-sided normal quantile (default 1.96 = 95%). Determines the
 *                  percentile pair: alpha = 2*(1 - Phi(z)); CI = [alpha/2, 1-alpha/2].
 * @param opts.seed PRNG seed (default FROZEN_SEED = 42).
 */
export function clusterBootstrap<T>(
  clusters: T[][],
  statFn: (flat: T[]) => number,
  opts: { iters?: number; z?: number; seed?: number } = {},
): BootstrapResult {
  const iters = opts.iters ?? 2000;
  const z = opts.z ?? 1.96;
  const seed = opts.seed ?? FROZEN_SEED;

  if (clusters.length === 0) {
    throw new Error('clusterBootstrap: need at least one cluster');
  }
  if (iters <= 0) {
    throw new Error('clusterBootstrap: iters must be > 0');
  }

  const k = clusters.length;
  const point = statFn(clusters.flat());

  const rng = mulberry32(seed);
  const stats: number[] = new Array(iters);
  for (let it = 0; it < iters; it++) {
    const resampled: T[] = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(rng() * k); // whole-cluster draw with replacement
      const chosen = clusters[idx];
      for (let j = 0; j < chosen.length; j++) {
        resampled.push(chosen[j]);
      }
    }
    stats[it] = statFn(resampled);
  }

  stats.sort((a, b) => a - b);

  // Percentile interval. alpha is the total tail mass implied by z via the
  // standard normal CDF: alpha = 2 * (1 - Phi(z)). For z=1.96 -> alpha~0.05.
  const alpha = 2 * (1 - normalCdf(z));
  const lower = percentile(stats, alpha / 2);
  const upper = percentile(stats, 1 - alpha / 2);

  return { point, lower, upper, iters };
}

/**
 * Linear-interpolated percentile of a SORTED ascending array (the "type-7" /
 * R default quantile definition used by NumPy's default and R's quantile).
 * q in [0,1].
 */
function percentile(sorted: number[], q: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const pos = q * (n - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Standard normal CDF Phi(x) via the Abramowitz & Stegun 7.1.26 erf rational
 * approximation (max abs error ~1.5e-7). Used only to turn a z-quantile into the
 * matching percentile tail mass for the bootstrap.
 */
function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** erf via Abramowitz & Stegun 7.1.26. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

/**
 * Clean proportion-reporting helper. Returns the rate, its Wilson 95% CI, and n.
 * Per the prereg's block-accounting rule (§6): a 0/n outcome is reported WITH its
 * Wilson upper bound, NEVER as a certain 0. E.g. proportionReport(0,41) ->
 * { rate: 0, ci: [0, ~0.0857], n: 41 }.
 *
 * @param z two-sided normal quantile. Default 1.96 = 95%.
 */
export function proportionReport(
  successes: number,
  n: number,
  z = 1.96,
): { rate: number; ci: [number, number]; n: number } {
  const w = wilsonInterval(successes, n, z);
  return { rate: w.point, ci: [w.lower, w.upper], n };
}
