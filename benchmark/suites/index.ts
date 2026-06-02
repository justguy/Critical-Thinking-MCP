/**
 * Four-suite corpus for the real-output harness (plan §1a).
 *
 *   1. failure-prone          — torture tasks where weak models reliably defect;
 *                               does the gate catch real defects?
 *   2. clean-control          — well-formed, correct-answerable tasks; does the
 *                               gate block correct work? (target false-block ≤2%)
 *   3. mutation               — clean tasks paired with a planted mutation, so
 *                               Phase 2 can measure mutation-coverage. The TASK
 *                               is real; only the *defect injection* is declared.
 *   4. realistic-distribution — ordinary tasks at normal difficulty, so value is
 *                               not proven only on a 30–60% torture set.
 *
 * Each task carries an OBJECTIVE oracle (gold answer / source span / structured
 * constraint). NO substring proxies. Seeded SMALL and structured for later
 * statistical expansion (Phase 1a remainder: powered n + confidence interval).
 *
 * NOTE ON SYNTHETIC: per the plan, we reject synthetic RESULTS, not synthetic
 * TASKS. These tasks are authored with executable oracles; the RESULTS come from
 * a real model via the CLI adapter.
 */

import type { Oracle } from '../oracles.js';

export type SuiteName =
  | 'failure-prone'
  | 'clean-control'
  | 'mutation'
  | 'realistic-distribution';

export interface BenchTask {
  id: string;
  suite: SuiteName;
  category: 'numeric' | 'factual_qa' | 'constraint';
  /** The prompt sent verbatim to the model (after optional condition prefix). */
  prompt: string;
  /** The objective oracle that grades the model's answer. */
  oracle: Oracle;
  /** For mutation suite: a description of the planted defect this task targets. */
  mutation?: { defect_class: string; description: string };
  note: string;
}

// ── Suite 1: failure-prone ──────────────────────────────────────────────────
// Weak models reliably defect here: wrong method (unweighted vs weighted),
// multi-step derivation slips, and source-grounding fabrication.
const FAILURE_PRONE: BenchTask[] = [
  {
    id: 'fp-num-weighted-avg',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'Three exam sections are weighted: section A is 50% of the grade and the student scored 60; ' +
      'section B is 30% and the student scored 90; section C is 20% and the student scored 100. ' +
      'Compute the weighted final grade. Reply with only the final number.',
    // weighted = 0.5*60 + 0.3*90 + 0.2*100 = 30 + 27 + 20 = 77
    // unweighted distractor = (60+90+100)/3 = 83.333...
    oracle: { kind: 'gold_answer', gold: 77, distractors: [83.33, 83.333] },
    note: 'Wrong-method probe (unweighted vs weighted). Mirrors pilot N4 failure mode.',
  },
  {
    id: 'fp-num-two-step',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'A subscription costs $360 per year. A promo gives 15% off the annual price, then an extra ' +
      '$12 loyalty credit off the discounted price. What is the final amount paid? ' +
      'Reply with only the final number.',
    // 360 * 0.85 = 306; 306 - 12 = 294
    oracle: { kind: 'gold_answer', gold: 294, distractors: [306, 294 - 0, 348] },
    note: 'Two-step derivation; intermediate slip is common. Mirrors pilot N2.',
  },
  {
    id: 'fp-qa-no-invent-cadence',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The Acme API access token is valid for use until it is manually revoked by an ' +
      'administrator." Question: Based ONLY on the source, when does the token expire? ' +
      'Answer in one sentence and do not invent any automatic reset schedule.',
    oracle: {
      kind: 'source_span',
      source_text:
        'The Acme API access token is valid for use until it is manually revoked by an administrator.',
      gold_span: 'manually revoked',
      planted_unsupported: ['every 24 hours', 'every 90 days', 'resets daily', 'expires after 30 days'],
    },
    note: 'Grounding probe; weak models invent a reset cadence. Mirrors pilot F1.',
  },
];

// ── Suite 2: clean-control ──────────────────────────────────────────────────
// Correct, well-formed tasks. A healthy gate must NOT block these.
const CLEAN_CONTROL: BenchTask[] = [
  {
    id: 'cc-num-simple',
    suite: 'clean-control',
    category: 'numeric',
    prompt: 'What is 144 divided by 12? Reply with only the number.',
    oracle: { kind: 'gold_answer', gold: 12 },
    note: 'Trivial correct-answerable arithmetic.',
  },
  {
    id: 'cc-qa-date',
    suite: 'clean-control',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The maintenance window is scheduled for Saturday, March 14." ' +
      'Question: On what day is the maintenance window scheduled? Answer in one short sentence.',
    oracle: {
      kind: 'source_span',
      source_text: 'The maintenance window is scheduled for Saturday, March 14.',
      gold_span: 'march 14',
      planted_unsupported: ['march 15', 'sunday', 'april'],
    },
    note: 'Clean factual extraction. Mirrors pilot F2.',
  },
];

// ── Suite 3: mutation ─────────────────────────────────────────────────────────
// Clean base task + a declared planted mutation. The mutation suite exists so
// Phase 2 can measure that repairs preserve defect coverage. We seed the base
// (un-mutated) task with its oracle here; Phase 1b/2 will attach mutated
// artifact variants once the thin contract schema lands.
const MUTATION: BenchTask[] = [
  {
    id: 'mut-num-base',
    suite: 'mutation',
    category: 'numeric',
    prompt:
      'A report says revenue grew from 200 to 250. Compute the percent change. ' +
      'Reply with only the number (percent).',
    // (250-200)/200 * 100 = 25
    oracle: { kind: 'gold_answer', gold: 25, distractors: [20, 50] },
    mutation: {
      defect_class: 'numeric_flattening',
      description:
        'Phase 2 will mutate the derivation artifact (e.g. wrong base 250) and confirm the gate ' +
        'still flags it; base task here grades the correct percent change. Mirrors pilot N1.',
    },
    note: 'Mutation-suite seed: real percent-change task; mutation attached in Phase 1b/2.',
  },
];

// ── Suite 4: realistic-distribution ───────────────────────────────────────────
// Ordinary tasks at normal difficulty, where a competent model usually succeeds.
const REALISTIC: BenchTask[] = [
  {
    id: 'rd-num-tip',
    suite: 'realistic-distribution',
    category: 'numeric',
    prompt:
      'A restaurant bill is $80 before tip. Add an 18% tip. What is the total? ' +
      'Reply with only the final number.',
    // 80 * 1.18 = 94.4
    oracle: { kind: 'gold_answer', gold: 94.4, tolerance: 0.01 },
    note: 'Everyday arithmetic at normal difficulty.',
  },
  {
    id: 'rd-constraint-budget',
    suite: 'realistic-distribution',
    category: 'constraint',
    prompt:
      'You are allocating a $1000 budget across exactly two line items, "marketing" and "ops". ' +
      'Marketing must be strictly greater than ops, and the two must sum to 1000. ' +
      'Reply with ONLY a JSON object: {"marketing": <number>, "ops": <number>}.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'sums-to-1000', field: 'marketing', op: '>', value: 500 },
        { id: 'ops-under-500', field: 'ops', op: '<', value: 500 },
      ],
    },
    note: 'Structured-constraint task graded by evaluateConstraint on parsed fields.',
  },
];

export const SUITES: Record<SuiteName, BenchTask[]> = {
  'failure-prone': FAILURE_PRONE,
  'clean-control': CLEAN_CONTROL,
  mutation: MUTATION,
  'realistic-distribution': REALISTIC,
};

export function allTasks(): BenchTask[] {
  return Object.values(SUITES).flat();
}

export function tasksForSuite(suite: SuiteName): BenchTask[] {
  return SUITES[suite];
}
