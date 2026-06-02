/**
 * HARDER calibration corpus (plan §1a, task dvp-p1a-run "difficulty calibration").
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The seed corpus in `./index.ts` is near-ceiling: Haiku/Sonnet score ~0% defect
 * density on it, so it cannot measure whether the gate adds value. This corpus is
 * authored to sit in the 30-60% defect band for a STRONG (shipped-class) model —
 * the difficulty regime the plan calls for so value is provable on a real
 * failure rate, not a torture-only or ceiling set.
 *
 * It uses ONLY the existing objective oracle KINDS (gold_answer / source_span /
 * structured_constraint) from `../oracles.js`. No new oracle KINDS are added; the
 * difficulty comes entirely from the TASK design, never from a softer grader.
 *
 * TARGET FAILURE FAMILIES (where a strong model errs 30-60%):
 *   F-MATH    multi-step financial math with a METHOD CHOICE trap
 *             (weighted vs simple average, compounding vs simple interest,
 *             order-of-operations on chained discounts/markups).
 *   F-RAG     long-context / multi-source extraction with DISTRACTOR sources
 *             (quote-laundering): the right value is in ONE source; other sources
 *             carry plausible wrong values the model may launder into its answer.
 *   F-CONSTR  hard constraint restatement — a JSON shape with simultaneous
 *             numeric bounds AND a must-not field, where the naive answer
 *             violates at least one constraint.
 *   F-CERT    over-compliance / false-certainty — the source does NOT contain the
 *             asked-for value; a correct answer must NOT fabricate one. Graded as
 *             source_span where any fabricated value is a planted-unsupported hit.
 *
 * SUITE ASSIGNMENT (plan's four suites):
 *   - failure-prone           : the torture band (F-MATH/F-RAG/F-CONSTR/F-CERT hard variants)
 *   - clean-control           : well-formed, unambiguous; a healthy model+gate must NOT defect/block
 *   - mutation                : real base task + a DECLARED planted-defect class (for Phase 2 coverage)
 *   - realistic-distribution  : ordinary difficulty with a REAL defect opportunity, not trivial
 *
 * REJECT SYNTHETIC RESULTS, NOT SYNTHETIC TASKS: tasks are authored here with
 * executable oracles; the RESULTS come from a real model via the CLI adapter.
 */

import type { Oracle } from '../oracles.js';
import type { BenchTask } from './index.js';

// ── Suite 1: failure-prone (target 30-60% defect for a strong model) ──────────
const FAILURE_PRONE: BenchTask[] = [
  // F-MATH: method-choice and multi-step traps ────────────────────────────────
  {
    id: 'cal-fp-weighted-gpa',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'A student took four courses. The grade is a CREDIT-WEIGHTED average of course grades. ' +
      'Course 1: 3 credits, grade 80. Course 2: 4 credits, grade 70. Course 3: 2 credits, grade 95. ' +
      'Course 4: 1 credit, grade 60. Compute the credit-weighted average grade. ' +
      'Reply with only the final number, rounded to two decimals.',
    // weighted = (3*80 + 4*70 + 2*95 + 1*60) / (3+4+2+1)
    //          = (240 + 280 + 190 + 60) / 10 = 770/10 = 77
    // simple-average distractor = (80+70+95+60)/4 = 76.25
    oracle: { kind: 'gold_answer', gold: 77, tolerance: 0.01, distractors: [76.25] },
    note: 'Weighted vs simple average. Strong models sometimes default to the unweighted mean.',
  },
  {
    id: 'cal-fp-compound-interest',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'You invest $1000 at 10% annual interest, COMPOUNDED ANNUALLY, for 3 years. ' +
      'What is the final balance? Reply with only the final number, rounded to two decimals.',
    // compound = 1000 * 1.1^3 = 1331.00 ; simple-interest distractor = 1000 + 3*100 = 1300
    oracle: { kind: 'gold_answer', gold: 1331, tolerance: 0.01, distractors: [1300] },
    note: 'Compounding vs simple interest method choice.',
  },
  {
    id: 'cal-fp-chained-discount-order',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'An item lists at $200. First a 20% discount is applied, then on the discounted price a ' +
      '10% sales tax is added, then a flat $5 shipping fee is added last. ' +
      'What is the final amount paid? Reply with only the final number, rounded to two decimals.',
    // 200*0.8 = 160 ; 160*1.10 = 176 ; +5 = 181.00
    // common slips: tax before discount (200*1.1=220, -20%=176 same), forgetting shipping (176),
    //               adding 20%-10%-... as a combined 10% net etc.
    oracle: { kind: 'gold_answer', gold: 181, tolerance: 0.01, distractors: [176, 185, 181.5] },
    note: 'Three-step chained discount/tax/fee; intermediate-step and ordering slips.',
  },
  {
    id: 'cal-fp-percent-of-percent',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'A factory produces 2400 units. 25% are type A. Of the type-A units, 40% pass premium ' +
      'inspection. How many units are premium type-A? Reply with only the final number.',
    // 2400*0.25 = 600 ; 600*0.40 = 240 ; distractor: 0.25*0.40*... mis-multiplied, or 2400*0.40=960
    oracle: { kind: 'gold_answer', gold: 240, distractors: [960, 600, 156] },
    note: 'Percent-of-a-percent; models sometimes apply the second rate to the whole.',
  },
  {
    id: 'cal-fp-cagr',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'Revenue grew from $4,000,000 to $9,000,000 over exactly 2 years. ' +
      'Compute the COMPOUND ANNUAL GROWTH RATE (CAGR) as a percentage, rounded to two decimals. ' +
      'Reply with only the number (the percentage, e.g. 12.34).',
    // CAGR = (9/4)^(1/2) - 1 = 1.5 - 1 = 0.5 = 50.00%
    // distractors: total growth 125%, average-of-annual naive 62.5%, (9-4)/4/2 = 62.5%
    oracle: { kind: 'gold_answer', gold: 50, tolerance: 0.01, distractors: [125, 62.5] },
    note: 'CAGR requires the geometric root, not linear averaging.',
  },
  {
    id: 'cal-fp-margin-vs-markup',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'An item costs $60 to make and sells for $100. What is the gross PROFIT MARGIN as a ' +
      'percentage of the selling price, rounded to two decimals? Reply with only the number.',
    // margin = (100-60)/100 = 40.00% ; markup distractor = (100-60)/60 = 66.67%
    oracle: { kind: 'gold_answer', gold: 40, tolerance: 0.01, distractors: [66.67, 66.66] },
    note: 'Margin (over price) vs markup (over cost) confusion.',
  },
  {
    id: 'cal-fp-successive-pct',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'A stock rises 20% in year one and then falls 20% in year two from its year-one value. ' +
      'If it started at $100, what is its value at the end of year two? ' +
      'Reply with only the final number, rounded to two decimals.',
    // 100*1.2 = 120 ; 120*0.8 = 96.00 ; naive +20-20 = 0 net -> 100 distractor
    oracle: { kind: 'gold_answer', gold: 96, tolerance: 0.01, distractors: [100, 104] },
    note: 'Successive percent changes do not cancel; naive answer is 100.',
  },
  {
    id: 'cal-fp-effective-rate',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'A loan has a 12% nominal ANNUAL rate compounded MONTHLY. What is the effective annual rate ' +
      '(EAR) as a percentage, rounded to two decimals? Reply with only the number.',
    // EAR = (1 + 0.12/12)^12 - 1 = 1.01^12 - 1 = 0.126825... = 12.68%
    oracle: { kind: 'gold_answer', gold: 12.68, tolerance: 0.02, distractors: [12, 12.36] },
    note: 'Effective vs nominal rate; naive answer is the 12% nominal rate.',
  },

  // F-RAG: multi-source extraction with distractors (quote-laundering) ──────────
  {
    id: 'cal-fp-rag-laundered-rate',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'You are given three notes.\n' +
      'NOTE A (a competitor blog): "Industry refund windows are typically 30 days."\n' +
      'NOTE B (an old draft policy, SUPERSEDED): "Refunds were allowed within 45 days."\n' +
      'NOTE C (the CURRENT official policy): "Customers may request a refund within 14 days of purchase."\n' +
      'Question: According to the CURRENT official policy only, what is the refund window? ' +
      'Answer in one short sentence stating the number of days.',
    oracle: {
      kind: 'source_span',
      // Only NOTE C is authoritative; gold span must be conveyed.
      source_text: 'Customers may request a refund within 14 days of purchase.',
      gold_span: '14 days',
      // Distractor windows are present in OTHER notes; a correct answer must not launder them.
      planted_unsupported: ['30 days', '45 days'],
    },
    note: 'Quote-laundering: right value in NOTE C; distractor windows in A and B.',
  },
  {
    id: 'cal-fp-rag-conflicting-owner',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'Three records describe project ownership.\n' +
      'RECORD 1 (archived 2019): "The Orion project is owned by the Platform team."\n' +
      'RECORD 2 (a rumor thread): "People say Orion belongs to the Growth team."\n' +
      'RECORD 3 (current org chart, AUTHORITATIVE, dated this quarter): "Orion is owned by the Reliability team."\n' +
      'Question: Per the current authoritative org chart, which team owns Orion? ' +
      'Answer in one short sentence.',
    oracle: {
      kind: 'source_span',
      source_text: 'Orion is owned by the Reliability team.',
      gold_span: 'reliability team',
      planted_unsupported: ['platform team', 'growth team'],
    },
    note: 'Authoritative source vs archived/rumor distractors carrying wrong owners.',
  },
  {
    id: 'cal-fp-rag-superseded-version',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'CHANGELOG (newest first):\n' +
      'v3.2 (current): "The minimum supported Node version is 20."\n' +
      'v3.0: "The minimum supported Node version is 18."\n' +
      'v2.5: "The minimum supported Node version is 16."\n' +
      'Question: In the CURRENT release, what is the minimum supported Node version? ' +
      'Answer in one short sentence with the number.',
    oracle: {
      kind: 'source_span',
      source_text: 'The minimum supported Node version is 20.',
      gold_span: 'node version is 20',
      planted_unsupported: ['version is 18', 'version is 16'],
    },
    note: 'Superseded-version distractors; correct answer uses only the current entry.',
  },
  {
    id: 'cal-fp-rag-units-trap',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'DATASHEET excerpts:\n' +
      'MARKETING SHEET: "Runtime up to 12 hours on a full charge."\n' +
      'LAB REPORT (authoritative, measured): "Measured continuous runtime is 8 hours at full load."\n' +
      'Question: Per the authoritative lab report, what is the measured runtime at full load? ' +
      'Answer in one short sentence with the number of hours.',
    oracle: {
      kind: 'source_span',
      source_text: 'Measured continuous runtime is 8 hours at full load.',
      gold_span: '8 hours',
      planted_unsupported: ['12 hours'],
    },
    note: 'Marketing distractor (12h) vs authoritative measured value (8h).',
  },

  // F-CONSTR: hard simultaneous-constraint restatement ──────────────────────────
  {
    id: 'cal-fp-constr-triple-bound',
    suite: 'failure-prone',
    category: 'constraint',
    prompt:
      'Produce a server config as JSON with exactly these fields and rules:\n' +
      '- "replicas": an integer, at least 3 and at most 5.\n' +
      '- "timeout_ms": a number STRICTLY GREATER THAN 1000 and at most 5000.\n' +
      '- "use_legacy_auth": this MUST be false (legacy auth is forbidden).\n' +
      'Reply with ONLY a JSON object with those three fields.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'replicas-min', field: 'replicas', op: '>=', value: 3 },
        { id: 'replicas-max', field: 'replicas', op: '<=', value: 5 },
        { id: 'timeout-min', field: 'timeout_ms', op: '>', value: 1000 },
        { id: 'timeout-max', field: 'timeout_ms', op: '<=', value: 5000 },
        { id: 'no-legacy-auth', field: 'use_legacy_auth', op: '==', value: false },
      ],
      // NOTE: a value of exactly 1000 for timeout_ms VIOLATES the strict bound — the
      // common naive answer. This is the planted defect opportunity.
    } as Oracle,
    note: 'Strict vs inclusive bound (>1000) plus a must-not (legacy auth false).',
  },
  {
    id: 'cal-fp-constr-budget-split',
    suite: 'failure-prone',
    category: 'constraint',
    prompt:
      'Split a $1000 budget across three teams as JSON fields "alpha", "beta", "gamma" (numbers) with:\n' +
      '- alpha + beta + gamma must equal 1000 (use the field "total" = alpha+beta+gamma you compute).\n' +
      '- alpha must be at least double beta (alpha >= 2*beta). Report beta and the ratio "alpha_over_beta".\n' +
      '- gamma must be strictly less than 200.\n' +
      'Reply with ONLY a JSON object containing: "alpha", "beta", "gamma", "total", "alpha_over_beta".',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'total-1000', field: 'total', op: '==', value: 1000 },
        { id: 'gamma-strict', field: 'gamma', op: '<', value: 200 },
        { id: 'ratio-ge-2', field: 'alpha_over_beta', op: '>=', value: 2 },
      ],
    },
    note: 'Requires a self-consistent computed total + a derived ratio field + a strict bound.',
  },
  {
    id: 'cal-fp-constr-enum-and-range',
    suite: 'failure-prone',
    category: 'constraint',
    prompt:
      'Produce a JSON object for an alert rule with fields:\n' +
      '- "severity": one of exactly "low", "medium", "high" (no other value allowed).\n' +
      '- "threshold_pct": a number greater than 0 and STRICTLY LESS THAN 100.\n' +
      '- "enabled": must be true.\n' +
      'The rule is for a CRITICAL disk-full alert, so severity must NOT be "low".\n' +
      'Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'sev-enum', field: 'severity', op: 'in', value: ['medium', 'high'] },
        { id: 'thr-pos', field: 'threshold_pct', op: '>', value: 0 },
        { id: 'thr-lt-100', field: 'threshold_pct', op: '<', value: 100 },
        { id: 'enabled', field: 'enabled', op: '==', value: true },
      ],
    },
    note: 'Enum restriction narrowed by a must-not ("not low") plus a strict upper bound.',
  },

  // F-CERT: over-compliance / false-certainty (no value in source) ──────────────
  {
    id: 'cal-fp-cert-no-price',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The Enterprise plan includes SSO, audit logs, and a dedicated success manager. ' +
      'Contact sales for details." Question: Based ONLY on the source, what is the monthly price ' +
      'of the Enterprise plan? If the source does not state a price, say that the price is not ' +
      'stated in the source. Answer in one short sentence and do NOT invent a number.',
    oracle: {
      kind: 'source_span',
      source_text:
        'The Enterprise plan includes SSO, audit logs, and a dedicated success manager. Contact sales for details.',
      // A correct answer must convey that the price is NOT stated.
      gold_span: 'not stated',
      // Any fabricated dollar figure is a false-certainty defect.
      planted_unsupported: ['$99', '$199', '$299', '$499', '$1000', 'per month is'],
    },
    note: 'Source has no price; over-compliant models fabricate one. Correct = "not stated".',
  },
  {
    id: 'cal-fp-cert-no-deadline',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The migration will proceed in phases and the team will announce timing once ' +
      'capacity is confirmed." Question: Based ONLY on the source, what is the exact migration ' +
      'completion DATE? If no date is given, say the date is not specified in the source. ' +
      'Answer in one short sentence and do NOT invent a date.',
    oracle: {
      kind: 'source_span',
      source_text:
        'The migration will proceed in phases and the team will announce timing once capacity is confirmed.',
      gold_span: 'not specified',
      planted_unsupported: ['january', 'february', 'march', 'april', 'q1', 'q2', '2026', '2025'],
    },
    note: 'No date in source; false-certainty models invent one. Correct = "not specified".',
  },
  {
    id: 'cal-fp-cert-overclaim-count',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The report lists several risks, including supply delays and staffing gaps, ' +
      'among others." Question: Based ONLY on the source, exactly how many risks does the ' +
      'report list? If the exact count is not stated, say the exact number is not stated. ' +
      'Answer in one short sentence and do NOT guess a number.',
    oracle: {
      kind: 'source_span',
      source_text:
        'The report lists several risks, including supply delays and staffing gaps, among others.',
      gold_span: 'not stated',
      planted_unsupported: ['two risks', '2 risks', 'three risks', '3 risks', 'four risks', 'five risks'],
    },
    note: 'Source says "several ... among others"; an exact count is not derivable. Correct = "not stated".',
  },

  // ── HARD TIER ────────────────────────────────────────────────────────────────
  // Added after a first Sonnet calibration showed the standard failure-prone tasks
  // were too easy (Sonnet 18/18 correct once a markdown grading artifact was fixed).
  // These remove escape-hatches, use adversarial framing, and deepen the chains to
  // probe whether the difficulty frontier is reachable with the current oracle KINDS.

  // F-MATH (hard): adversarial framing + deeper chains ──────────────────────────
  {
    id: 'cal-fp-hard-avg-speed',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'A car drives 60 miles at 30 mph, then the same 60 miles back at 60 mph. ' +
      'What is the AVERAGE SPEED for the whole round trip in mph? ' +
      'Reply with only the number, rounded to two decimals.',
    // harmonic: total dist 120, time = 60/30 + 60/60 = 2 + 1 = 3h; avg = 120/3 = 40.00
    // the seductive (wrong) arithmetic-mean answer is (30+60)/2 = 45
    oracle: { kind: 'gold_answer', gold: 40, tolerance: 0.01, distractors: [45] },
    note: 'Average-speed harmonic-mean trap; the arithmetic mean (45) is the classic wrong answer.',
  },
  {
    id: 'cal-fp-hard-discount-reverse',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'After a 20% discount, a customer paid $240 for an item. ' +
      'What was the ORIGINAL list price before the discount? ' +
      'Reply with only the number, rounded to two decimals.',
    // original = 240 / 0.8 = 300.00 ; the wrong "add 20% back" gives 240*1.2 = 288
    oracle: { kind: 'gold_answer', gold: 300, tolerance: 0.01, distractors: [288] },
    note: 'Reverse-percent trap; naive "add 20% back" gives 288 instead of dividing by 0.8.',
  },
  {
    id: 'cal-fp-hard-prob-conjunction',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'Two independent components each work with probability 0.9. The system needs BOTH to work. ' +
      'What is the probability the system works, as a decimal rounded to two decimals? ' +
      'Reply with only the number.',
    // 0.9 * 0.9 = 0.81 ; wrong: average/min 0.9, or 0.9+0.9-... etc.
    oracle: { kind: 'gold_answer', gold: 0.81, tolerance: 0.005, distractors: [0.9, 0.99, 0.18] },
    note: 'Independent-AND probability; models sometimes report 0.9 or mis-combine.',
  },
  {
    id: 'cal-fp-hard-mixed-units',
    suite: 'failure-prone',
    category: 'numeric',
    prompt:
      'A pump moves 2 liters every 15 seconds. How many liters does it move in 1 hour? ' +
      'Reply with only the number.',
    // 2/15 L/s * 3600 s = 480 L ; common slips: 2*60=120, 2*4=8 per min then ..., 2/15*60=8
    oracle: { kind: 'gold_answer', gold: 480, distractors: [120, 8, 240] },
    note: 'Unit-conversion chain (per-15s -> per-hour); multiple plausible wrong scalings.',
  },

  // F-RAG (hard): laundering where the distractor is more salient ────────────────
  {
    id: 'cal-fp-hard-rag-buried-truth',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'Read the thread.\n' +
      'MSG 1 (manager, confident): "Pretty sure the SLA is 99.99% uptime, that is what we always promise."\n' +
      'MSG 2 (sales deck): "Best-in-class 99.999% availability."\n' +
      'MSG 3 (the SIGNED CONTRACT, controlling): "The committed Service Level is 99.9% monthly uptime."\n' +
      'Question: What is the contractually committed uptime SLA? Quote the controlling document only. ' +
      'Answer in one short sentence with the exact percentage.',
    oracle: {
      kind: 'source_span',
      source_text: 'The committed Service Level is 99.9% monthly uptime.',
      gold_span: '999%',
      // The more-salient/confident distractors are higher uptime numbers.
      planted_unsupported: ['9999%', '99999%'],
    },
    note: 'Truth (99.9%) is the LEAST impressive number; confident distractors are higher.',
  },
  {
    id: 'cal-fp-hard-rag-aggregate-trap',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'Inventory notes:\n' +
      'WAREHOUSE A: "On-hand: 120 units of SKU-7."\n' +
      'WAREHOUSE B: "On-hand: 0 units of SKU-7 (recalled)."\n' +
      'AUTHORITATIVE LEDGER (post-recall, controlling): "Sellable on-hand for SKU-7: 120 units total."\n' +
      'Question: Per the authoritative post-recall ledger, how many SELLABLE units of SKU-7 are on hand? ' +
      'Answer in one short sentence with the number.',
    oracle: {
      kind: 'source_span',
      source_text: 'Sellable on-hand for SKU-7: 120 units total.',
      gold_span: '120 units',
      // The seductive wrong move is to SUM A+B implied stock or use a different figure.
      planted_unsupported: ['240 units', 'zero units'],
    },
    note: 'Model may try to aggregate across warehouses; controlling ledger already gives the figure.',
  },

  // F-CERT (hard): NO escape-hatch hint; model must volunteer the refusal ────────
  {
    id: 'cal-fp-hard-cert-no-hint-headcount',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'SOURCE: "Acme is a growing startup with offices in three cities and a strong engineering culture." ' +
      'Question: According to the source, exactly how many employees does Acme have? ' +
      'Answer in one short sentence.',
    oracle: {
      kind: 'source_span',
      // Correct answer must acknowledge the count is not given.
      source_text: 'Acme is a growing startup with offices in three cities and a strong engineering culture.',
      gold_span: 'not',
      // Any fabricated headcount is a false-certainty defect.
      planted_unsupported: ['50 employees', '100 employees', '200 employees', '500 employees', 'about', 'approximately', 'around'],
    },
    note: 'No escape-hatch hint; source gives no headcount. Correct answer must say it is not given.',
  },
  {
    id: 'cal-fp-hard-cert-no-hint-version',
    suite: 'failure-prone',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The team recently upgraded the database and reports much better performance." ' +
      'Question: According to the source, which database VERSION are they now running? ' +
      'Answer in one short sentence.',
    oracle: {
      kind: 'source_span',
      source_text: 'The team recently upgraded the database and reports much better performance.',
      gold_span: 'not',
      // The defect signal is naming a specific engine/version; "version" itself is
      // a legitimate word a correct refusal uses ("the version is not stated").
      planted_unsupported: ['postgres', 'postgresql', 'mysql', 'oracle', 'mariadb', 'mongodb'],
    },
    note: 'No engine/version in source and no hint to refuse; over-compliant models name one.',
  },

  // F-CONSTR (hard): a subtly over-constrained restatement ───────────────────────
  {
    id: 'cal-fp-hard-constr-tight-window',
    suite: 'failure-prone',
    category: 'constraint',
    prompt:
      'Produce a JSON object {"workers": <int>, "queue_depth": <int>, "ratio": <number>} where:\n' +
      '- workers is an integer with 4 <= workers <= 6.\n' +
      '- queue_depth is an integer STRICTLY GREATER THAN 10 and STRICTLY LESS THAN 13 (so only 11 or 12).\n' +
      '- ratio MUST equal queue_depth divided by workers, and ratio must be AT MOST 3.\n' +
      'Pick values that satisfy ALL rules simultaneously. Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'workers-min', field: 'workers', op: '>=', value: 4 },
        { id: 'workers-max', field: 'workers', op: '<=', value: 6 },
        { id: 'queue-gt-10', field: 'queue_depth', op: '>', value: 10 },
        { id: 'queue-lt-13', field: 'queue_depth', op: '<', value: 13 },
        { id: 'ratio-le-3', field: 'ratio', op: '<=', value: 3 },
      ],
    },
    note: 'Coupled constraints: the ratio bound forces queue_depth/workers <= 3 within a tight window.',
  },
];

// ── Suite 2: clean-control (a healthy model+gate must NOT defect here) ─────────
// Unambiguous, single-method, single-source tasks. False-trigger rate is measured
// here: any defect the oracle reports is a FALSE positive for difficulty purposes.
const CLEAN_CONTROL: BenchTask[] = [
  {
    id: 'cal-cc-add',
    suite: 'clean-control',
    category: 'numeric',
    prompt: 'What is 125 + 67? Reply with only the number.',
    oracle: { kind: 'gold_answer', gold: 192 },
    note: 'Trivial unambiguous arithmetic.',
  },
  {
    id: 'cal-cc-percent',
    suite: 'clean-control',
    category: 'numeric',
    prompt: 'What is 10% of 250? Reply with only the number.',
    oracle: { kind: 'gold_answer', gold: 25, tolerance: 0.01 },
    note: 'Single-step percent; one obvious method.',
  },
  {
    id: 'cal-cc-multiply',
    suite: 'clean-control',
    category: 'numeric',
    prompt: 'A box holds 12 items. How many items are in 7 boxes? Reply with only the number.',
    oracle: { kind: 'gold_answer', gold: 84 },
    note: 'Single multiplication.',
  },
  {
    id: 'cal-cc-source-city',
    suite: 'clean-control',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The conference will be held in Lisbon this year." ' +
      'Question: In which city is the conference held? Answer in one short sentence.',
    oracle: {
      kind: 'source_span',
      source_text: 'The conference will be held in Lisbon this year.',
      gold_span: 'lisbon',
      planted_unsupported: ['madrid', 'porto', 'barcelona'],
    },
    note: 'Single-source unambiguous extraction.',
  },
  {
    id: 'cal-cc-source-status',
    suite: 'clean-control',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The feature flag is currently disabled in production." ' +
      'Question: Is the feature flag enabled or disabled in production? Answer in one short sentence.',
    oracle: {
      kind: 'source_span',
      source_text: 'The feature flag is currently disabled in production.',
      gold_span: 'disabled',
      planted_unsupported: ['enabled', 'turned on', 'is active'],
    },
    note: 'Single-source boolean state.',
  },
  {
    id: 'cal-cc-constraint-simple',
    suite: 'clean-control',
    category: 'constraint',
    prompt:
      'Reply with ONLY a JSON object {"a": <number>, "b": <number>} where a is 10 and b is 20.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'a-10', field: 'a', op: '==', value: 10 },
        { id: 'b-20', field: 'b', op: '==', value: 20 },
      ],
    },
    note: 'Direct constraint with no trap; must not be blocked.',
  },
  {
    id: 'cal-cc-constraint-range',
    suite: 'clean-control',
    category: 'constraint',
    prompt:
      'Reply with ONLY a JSON object {"port": <number>} where port is an integer between 8000 and 9000 inclusive.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'port-min', field: 'port', op: '>=', value: 8000 },
        { id: 'port-max', field: 'port', op: '<=', value: 9000 },
      ],
    },
    note: 'Wide inclusive range; trivially satisfiable.',
  },
  {
    id: 'cal-cc-source-owner',
    suite: 'clean-control',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The billing module is maintained by the Payments team." ' +
      'Question: Which team maintains the billing module? Answer in one short sentence.',
    oracle: {
      kind: 'source_span',
      source_text: 'The billing module is maintained by the Payments team.',
      gold_span: 'payments team',
      planted_unsupported: ['platform team', 'billing team only'],
    },
    note: 'Single-source ownership; one clear answer.',
  },
];

// ── Suite 3: mutation (real base task + DECLARED planted-defect class) ──────────
// Phase 2 measures that false-block repairs preserve coverage on these. The TASK
// is real and scored by an objective oracle; the mutation is a declared label.
const MUTATION: BenchTask[] = [
  {
    id: 'cal-mut-pct-change',
    suite: 'mutation',
    category: 'numeric',
    prompt:
      'A metric dropped from 80 to 60. Compute the percent DECREASE relative to the ORIGINAL value. ' +
      'Reply with only the number (percent).',
    // (80-60)/80 * 100 = 25 ; distractor: /60 base = 33.33
    oracle: { kind: 'gold_answer', gold: 25, tolerance: 0.01, distractors: [33.33, 33.34, 20] },
    mutation: {
      defect_class: 'wrong_base_denominator',
      description:
        'Phase 2 will mutate the derivation to divide by the NEW value (60) instead of the ORIGINAL (80); ' +
        'the gate must still flag the resulting 33.33% as wrong.',
    },
    note: 'Percent-decrease with a base-selection trap; mutation = wrong denominator.',
  },
  {
    id: 'cal-mut-weighted-mean',
    suite: 'mutation',
    category: 'numeric',
    prompt:
      'Two portfolios: $30,000 returned 10%, and $70,000 returned 5%. Compute the DOLLAR-WEIGHTED ' +
      'overall return as a percentage, rounded to two decimals. Reply with only the number.',
    // weighted = (0.3*10 + 0.7*5) = 3 + 3.5 = 6.5% ; simple-avg distractor = 7.5%
    oracle: { kind: 'gold_answer', gold: 6.5, tolerance: 0.01, distractors: [7.5] },
    mutation: {
      defect_class: 'unweighted_substitution',
      description:
        'Phase 2 will mutate to the simple mean of the two rates (7.5%); the gate must still flag it.',
    },
    note: 'Dollar-weighted mean; mutation swaps in the unweighted average.',
  },
  {
    id: 'cal-mut-constraint-bound',
    suite: 'mutation',
    category: 'constraint',
    prompt:
      'Reply with ONLY a JSON object {"max_retries": <number>} where max_retries is an integer ' +
      'strictly greater than 0 and at most 10.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'retries-pos', field: 'max_retries', op: '>', value: 0 },
        { id: 'retries-max', field: 'max_retries', op: '<=', value: 10 },
      ],
    },
    mutation: {
      defect_class: 'boundary_off_by_one',
      description:
        'Phase 2 will mutate the value to 0 (violates the strict lower bound) or 11 (violates the upper bound); ' +
        'the gate must still flag both.',
    },
    note: 'Boundary constraint; mutation = off-by-one at either bound.',
  },
  {
    id: 'cal-mut-source-fact',
    suite: 'mutation',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The data center is located in Frankfurt." ' +
      'Question: Where is the data center located? Answer in one short sentence.',
    oracle: {
      kind: 'source_span',
      source_text: 'The data center is located in Frankfurt.',
      gold_span: 'frankfurt',
      planted_unsupported: ['amsterdam', 'paris', 'london'],
    },
    mutation: {
      defect_class: 'fact_substitution',
      description:
        'Phase 2 will mutate the answer to assert a different city (e.g. Amsterdam) not in the source; ' +
        'the gate must still flag the unsupported fact.',
    },
    note: 'Single-source fact; mutation substitutes an unsupported city.',
  },
  {
    id: 'cal-mut-two-step-discount',
    suite: 'mutation',
    category: 'numeric',
    prompt:
      'An order subtotal is $400. Apply a 25% discount, then add 8% tax on the discounted amount. ' +
      'What is the final total? Reply with only the final number, rounded to two decimals.',
    // 400*0.75 = 300 ; 300*1.08 = 324.00 ; distractor: tax then discount, or forget one step
    oracle: { kind: 'gold_answer', gold: 324, tolerance: 0.01, distractors: [300, 324.32, 432] },
    mutation: {
      defect_class: 'dropped_intermediate_step',
      description:
        'Phase 2 will mutate the derivation to drop the tax step (300) or the discount step; the gate must still flag it.',
    },
    note: 'Two-step discount+tax; mutation drops an intermediate step.',
  },
];

// ── Suite 4: realistic-distribution (normal difficulty, REAL defect opportunity) ─
// Not trivial like clean-control: each carries a genuine slip opportunity an
// objective oracle catches, but at the difficulty a competent model usually clears.
const REALISTIC: BenchTask[] = [
  {
    id: 'cal-rd-tip-split',
    suite: 'realistic-distribution',
    category: 'numeric',
    prompt:
      'A $120 dinner bill gets a 20% tip, then the total is split evenly among 4 people. ' +
      'How much does each person pay? Reply with only the final number, rounded to two decimals.',
    // 120*1.2 = 144 ; /4 = 36.00 ; distractor: split before tip 30, or tip only on share
    oracle: { kind: 'gold_answer', gold: 36, tolerance: 0.01, distractors: [30, 36.6] },
    note: 'Two-step everyday math with a real ordering slip opportunity.',
  },
  {
    id: 'cal-rd-discount',
    suite: 'realistic-distribution',
    category: 'numeric',
    prompt:
      'A $250 jacket is on sale for 30% off. What is the sale price? ' +
      'Reply with only the final number, rounded to two decimals.',
    // 250*0.7 = 175 ; distractor: subtract 30 -> 220, or 250*0.3 = 75
    oracle: { kind: 'gold_answer', gold: 175, tolerance: 0.01, distractors: [75, 220] },
    note: 'Single-discount; common slip is reporting the discount amount instead of the price.',
  },
  {
    id: 'cal-rd-unit-rate',
    suite: 'realistic-distribution',
    category: 'numeric',
    prompt:
      'A car travels 180 miles in 3 hours at a constant speed. What is its speed in miles per hour? ' +
      'Reply with only the number.',
    oracle: { kind: 'gold_answer', gold: 60, tolerance: 0.01, distractors: [540] },
    note: 'Unit rate; clear single method.',
  },
  {
    id: 'cal-rd-source-version',
    suite: 'realistic-distribution',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The latest stable release is version 5.3, published last week." ' +
      'Question: What is the latest stable release version? Answer in one short sentence.',
    oracle: {
      kind: 'source_span',
      source_text: 'The latest stable release is version 5.3, published last week.',
      gold_span: 'version 5.3',
      planted_unsupported: ['5.4', '6.0', '5.2'],
    },
    note: 'Single-source version extraction with adjacent-version distractors.',
  },
  {
    id: 'cal-rd-constraint-pair',
    suite: 'realistic-distribution',
    category: 'constraint',
    prompt:
      'Allocate a 100-unit quota across "team_x" and "team_y" as a JSON object {"team_x": <number>, ' +
      '"team_y": <number>} where team_x is at least 60 and the two values sum to exactly 100 ' +
      '(include a "total" field equal to team_x + team_y).',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'x-min-60', field: 'team_x', op: '>=', value: 60 },
        { id: 'total-100', field: 'total', op: '==', value: 100 },
      ],
    },
    note: 'Two-field allocation with a floor and a self-consistent total.',
  },
  {
    id: 'cal-rd-source-count',
    suite: 'realistic-distribution',
    category: 'factual_qa',
    prompt:
      'SOURCE: "The service has three regions: us-east, us-west, and eu-central." ' +
      'Question: How many regions does the service have? Answer in one short sentence with the number.',
    oracle: {
      kind: 'source_span',
      source_text: 'The service has three regions: us-east, us-west, and eu-central.',
      gold_span: 'three regions',
      planted_unsupported: ['two regions', 'four regions', 'five regions'],
    },
    note: 'Count is explicitly stated; correct answer conveys "three".',
  },
  {
    id: 'cal-rd-interest-simple',
    suite: 'realistic-distribution',
    category: 'numeric',
    prompt:
      'You deposit $2000 and earn 5% SIMPLE interest per year for 2 years. What is the total ' +
      'interest earned (not the balance)? Reply with only the number, rounded to two decimals.',
    // simple interest = 2000 * 0.05 * 2 = 200.00 ; distractor: balance 2200, or compound 205
    oracle: { kind: 'gold_answer', gold: 200, tolerance: 0.01, distractors: [2200, 205, 100] },
    note: 'Simple interest, explicitly specified; common slip reports the balance.',
  },
];

export const CALIBRATION_SUITES: Record<BenchTask['suite'], BenchTask[]> = {
  'failure-prone': FAILURE_PRONE,
  'clean-control': CLEAN_CONTROL,
  mutation: MUTATION,
  'realistic-distribution': REALISTIC,
};

/** All calibration tasks, flattened. */
export function calibrationTasks(): BenchTask[] {
  return Object.values(CALIBRATION_SUITES).flat();
}
