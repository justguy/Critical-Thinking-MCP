/**
 * Phase 4 — HARD generation corpus (prereg §2.1, build STEP 5).
 *
 * The existing calibration corpus sits at 0% Haiku-natural defect density, so it
 * cannot separate the four arms. This corpus is authored to be GENUINELY HARD
 * for a weak model (Haiku): deep dependent chains, method-choice traps, strong
 * conflicting distractors, superseded-version RAG traps, and multi-bound
 * constraints with a forbidden enum. Hardness TARGET: failure-prone tasks should
 * make Haiku defect ~30–60% (calibrated in a SEPARATE k=8 arm-A step, not here).
 *
 * BUT every task is answerable WITH A VALID PROOF: a competent model can declare
 * a re-executable derivation / grounding that the finalize gate RELEASES
 * (Amendments A1/A5). The clean-control tasks are correct-answerable and the gate
 * MUST NOT false-block them. No prompt leaks its own gold answer.
 *
 * Reuses the EXISTING corpus types (benchmark/suites/index.ts) and oracles
 * (benchmark/oracles.ts) verbatim — Phase4Task only ADDS split/binding_eligible/
 * gold_formula. Every numeric gold carries an auditable `gold_formula`; the
 * paired test (tests/benchmark/phase4_corpus.test.ts) RECOMPUTES each formula
 * in-suite, so a wrong gold is caught before any run (golds are existential).
 *
 * NO model / CLI calls — authoring + offline oracle grading only.
 */

import type { BenchTask } from '../suites/index.js';

/**
 * Phase-4 corpus task: a BenchTask plus the three Phase-4 fields.
 *  • split            — calibration tunes on 'tuning', verifies the band on the
 *                       disjoint 'holdout' (winner's-curse guard, prereg §2.1).
 *  • binding_eligible — true for multi-field numeric tasks (≥3 restated numbers
 *                       AND ≥4 dependent chained ops) where final-answer↔artifact
 *                       drift can actually occur, so the B-vs-D contrast has
 *                       something to bite on (prereg §7 H1-binding).
 *  • gold_formula     — the exact, human-auditable computation of a numeric gold.
 */
export type Phase4Task = BenchTask & {
  split: 'tuning' | 'holdout';
  binding_eligible?: boolean;
  gold_formula?: string;
};

// ════════════════════════════════════════════════════════════════════════════
// FAMILY 1 — NUMERIC (gold_answer). The most important family.
// Method traps: weighted-vs-unweighted, margin-vs-markup, %-of-%-of-%,
// chained-discount order, mixed units, progressive-vs-flat tax, compound order.
// ≥6 are multi-field binding-eligible. Each carries distractors[] = the common
// wrong values a defective model emits. Prompts say "reply with only the final
// number" so the gold string never appears in the prompt.
// ════════════════════════════════════════════════════════════════════════════

const NUMERIC: Phase4Task[] = [
  {
    id: 'p4-num-credit-weighted',
    suite: 'failure-prone',
    category: 'numeric',
    split: 'tuning',
    binding_eligible: true,
    prompt:
      'A student took four courses on a CREDIT-WEIGHTED average. ' +
      'Course 1: 4 credits, grade 91. Course 2: 3 credits, grade 82. ' +
      'Course 3: 2 credits, grade 74. Course 4: 1 credit, grade 68. ' +
      'After computing the credit-weighted average grade, the registrar subtracts a flat 3-point ' +
      'late penalty from that average. Report the final adjusted grade. Reply with only the final number.',
    // weighted = (4*91 + 3*82 + 2*74 + 1*68) / (4+3+2+1) = 826/10 = 82.6 ; 82.6 - 3 = 79.6
    // unweighted distractor = (91+82+74+68)/4 = 78.75 ; -3 = 75.75
    gold_formula: '((4*91 + 3*82 + 2*74 + 1*68) / (4+3+2+1)) - 3 = 82.6 - 3 = 79.6',
    oracle: { kind: 'gold_answer', gold: 79.6, tolerance: 0.01, distractors: [82.6, 78.75, 75.75] },
    note: 'Method trap: credit-WEIGHTED vs unweighted, then a dependent penalty step. Binding-eligible.',
  },
  {
    id: 'p4-num-chained-discount',
    suite: 'failure-prone',
    category: 'numeric',
    split: 'holdout',
    binding_eligible: true,
    prompt:
      'A list price is $500. A storewide promo takes 20% off, then a separate coupon takes a further ' +
      '10% off the already-discounted price, then 8% sales tax is added to that result. ' +
      'Two friends split the final amount equally. How much does each friend pay? ' +
      'Reply with only the final number.',
    // 500 * 0.80 * 0.90 * 1.08 / 2 = 388.8 / 2 = 194.4
    // additive-discount distractor: 500 * 0.70 * 1.08 / 2 = 189
    // pre-tax distractor: 500 * 0.8 * 0.9 / 2 = 180
    gold_formula: '500 * 0.80 * 0.90 * 1.08 / 2 = 388.8 / 2 = 194.4',
    oracle: { kind: 'gold_answer', gold: 194.4, tolerance: 0.01, distractors: [189, 180, 189.0] },
    note: 'Chained-discount order trap (20%+10% != 30%) + tax + split. Binding-eligible.',
  },
  {
    id: 'p4-num-pct-of-pct',
    suite: 'failure-prone',
    category: 'numeric',
    split: 'tuning',
    binding_eligible: true,
    prompt:
      'A town has 50000 residents. 60% are adults. Of the adults, 25% are employed full-time. ' +
      'Of those full-time workers, 12% work remotely. The office plans 2 desks per remote worker. ' +
      'How many desks are planned in total? Reply with only the final number.',
    // 50000 * 0.60 * 0.25 * 0.12 * 2 = 900 * 2 = 1800
    // stop-early distractor (adults employed): 50000 * 0.6 * 0.25 = 7500
    // remote-without-desks distractor: 900
    gold_formula: '50000 * 0.60 * 0.25 * 0.12 * 2 = 900 * 2 = 1800',
    oracle: { kind: 'gold_answer', gold: 1800, distractors: [7500, 900, 7500.0] },
    note: 'Percent-of-percent-of-percent chain + dependent desk step. Stop-early is the trap. Binding-eligible.',
  },
  {
    id: 'p4-num-mixed-time-units',
    suite: 'failure-prone',
    category: 'numeric',
    split: 'holdout',
    binding_eligible: true,
    prompt:
      'A contractor bills at a flat $30 per hour. On Monday they worked 2 hours and 45 minutes. ' +
      'On Tuesday they worked 90 minutes. Convert all time to hours, total it, and compute the bill. ' +
      'Reply with only the final number.',
    // (2 + 45/60) + (90/60) = 2.75 + 1.5 = 4.25 hours ; 4.25 * 30 = 127.5
    // naive-decimal distractor: (2.45 + 1.30) * 30 = 112.5
    gold_formula: '((2 + 45/60) + 90/60) * 30 = 4.25 * 30 = 127.5',
    oracle: { kind: 'gold_answer', gold: 127.5, tolerance: 0.01, distractors: [112.5, 127.35] },
    note: 'Mixed-units trap: minutes read as decimals is the common slip. Binding-eligible.',
  },
  {
    id: 'p4-num-compound-order',
    suite: 'failure-prone',
    category: 'numeric',
    split: 'tuning',
    binding_eligible: true,
    prompt:
      'An account starts at $2000. In year one it grows 10%. Then a $50 maintenance fee is withdrawn. ' +
      'In year two the remaining balance grows 5%. Finally a 2% closing fee is deducted from that balance. ' +
      'What is the final balance? Reply with only the final number.',
    // ((2000*1.10 - 50) * 1.05) * 0.98 = (2200 - 50)*1.05*0.98 = 2150*1.05*0.98 = 2257.5*0.98 = 2212.35
    // additive-rate distractor: (2000*1.15 - 50)*0.98 = 2205
    // no-closing-fee distractor: 2257.5
    gold_formula: '((2000*1.10 - 50) * 1.05) * 0.98 = 2150*1.05*0.98 = 2257.5*0.98 = 2212.35',
    oracle: { kind: 'gold_answer', gold: 2212.35, tolerance: 0.01, distractors: [2205, 2257.5, 2250] },
    note: 'Compound-order trap: rates do not add; withdrawal between growth steps. Binding-eligible.',
  },
  {
    id: 'p4-num-weighted-blend',
    suite: 'failure-prone',
    category: 'numeric',
    split: 'holdout',
    binding_eligible: true,
    prompt:
      'A tank is filled with two fuels: 30 liters at $1.50 per liter and 20 liters at $2.00 per liter. ' +
      'Compute the WEIGHTED average price per liter of the mix (total cost divided by total liters). ' +
      'Reply with only the final number.',
    // (30*1.50 + 20*2.00) / (30+20) = (45 + 40) / 50 = 85 / 50 = 1.70
    // unweighted-average distractor: (1.50 + 2.00)/2 = 1.75
    gold_formula: '(30*1.50 + 20*2.00) / (30+20) = 85 / 50 = 1.70',
    oracle: { kind: 'gold_answer', gold: 1.7, tolerance: 0.001, distractors: [1.75, 3.5, 85] },
    note: 'Weighted-vs-simple-average blend trap. 85 (total cost) and 1.75 (simple avg) are the slips. Binding-eligible.',
  },
  {
    id: 'p4-num-margin-vs-markup',
    suite: 'failure-prone',
    category: 'numeric',
    split: 'tuning',
    binding_eligible: true,
    prompt:
      'An item costs $90 to make. The seller prices it at a 40% gross MARGIN (margin = profit divided by ' +
      'selling price, NOT by cost). They sell 4 units, apply a flat $20 order coupon to the order total, ' +
      'then add a 5% card surcharge to what remains. What is the final charge? Reply with only the final number.',
    // price = 90 / (1 - 0.40) = 150 ; (150*4 - 20) * 1.05 = (600-20)*1.05 = 580*1.05 = 609
    // markup distractor: ((90*1.40)*4 - 20)*1.05 = (504-20)*1.05 = 508.2
    // no-surcharge distractor: 580
    gold_formula: '((90/(1-0.40))*4 - 20) * 1.05 = (150*4 - 20)*1.05 = 580*1.05 = 609',
    oracle: { kind: 'gold_answer', gold: 609, tolerance: 0.01, distractors: [508.2, 580, 600] },
    note: 'Margin-vs-markup trap (÷0.6 not ×1.4) + coupon + surcharge chain. Binding-eligible.',
  },
  {
    id: 'p4-num-progressive-tax',
    suite: 'failure-prone',
    category: 'numeric',
    split: 'holdout',
    binding_eligible: true,
    prompt:
      'A jurisdiction taxes income progressively: the first $20000 is taxed at 10% and the next $30000 ' +
      'at 20%. A person earns exactly $50000. Compute their tax, subtract a flat $200 credit, then report ' +
      'the COMBINED tax for two identical earners (multiply by 2). Reply with only the final number.',
    // (20000*0.10 + 30000*0.20 - 200) * 2 = (2000 + 6000 - 200)*2 = 7800*2 = 15600
    // flat-top-rate distractor: (50000*0.20 - 200)*2 = 19600
    // no-credit distractor: 16000
    gold_formula: '(20000*0.10 + 30000*0.20 - 200) * 2 = 7800 * 2 = 15600',
    oracle: { kind: 'gold_answer', gold: 15600, distractors: [19600, 16000, 7800] },
    note: 'Progressive-vs-flat tax trap (brackets, not top rate) + credit + duplication. Binding-eligible.',
  },
  {
    id: 'p4-num-margin-price',
    suite: 'realistic-distribution',
    category: 'numeric',
    split: 'tuning',
    binding_eligible: false,
    prompt:
      'An item costs $240. The seller prices it at a 40% gross MARGIN (margin = profit divided by selling ' +
      'price). They sell 3 units. What is the total revenue? Reply with only the final number.',
    // price = 240 / (1 - 0.40) = 400 ; 400 * 3 = 1200 ; markup distractor: (240*1.40)*3 = 1008
    gold_formula: '(240/(1-0.40)) * 3 = 400 * 3 = 1200',
    oracle: { kind: 'gold_answer', gold: 1200, distractors: [1008, 400] },
    note: 'Margin-vs-markup at normal difficulty (2 ops). Realistic distribution; not binding-eligible.',
  },
  {
    id: 'p4-num-avg-speed',
    suite: 'clean-control',
    category: 'numeric',
    split: 'holdout',
    binding_eligible: false,
    prompt:
      'A car drives 90 km in 1 hour 15 minutes, then 60 km in 45 minutes. Compute the overall average ' +
      'speed in km/h (total distance divided by total time in hours). Reply with only the final number.',
    // (90 + 60) / (1.25 + 0.75) = 150 / 2 = 75 ; mean-of-speeds distractor: ((90/1.25)+(60/0.75))/2 = 76
    gold_formula: '(90 + 60) / (1.25 + 0.75) = 150 / 2 = 75',
    oracle: { kind: 'gold_answer', gold: 75, distractors: [76, 150] },
    note: 'Clean-control: correct-answerable avg-speed (averaging the two speeds is the only slip). The gate MUST NOT block a valid proof here.',
  },
];

// ════════════════════════════════════════════════════════════════════════════
// FAMILY 2 — FACTUAL_QA / RAG (source_span). Buried truth + a CONFLICTING-NUMBER
// distractor + a SUPERSEDED-VERSION trap. gold_span = the verbatim controlling
// fact; planted_unsupported = the distractor facts a laundering model asserts.
// source_text holds ONLY the controlling fact (graders verify planted facts are
// absent from source). Prompts present the distractor/superseded text INLINE so
// the model must resolve the conflict, but the oracle grades against the
// controlling source_text only.
// ════════════════════════════════════════════════════════════════════════════

const FACTUAL_QA: Phase4Task[] = [
  {
    id: 'p4-qa-superseded-retention',
    suite: 'failure-prone',
    category: 'factual_qa',
    split: 'tuning',
    prompt:
      'Two policy notes are provided.\n' +
      'NOTE (v1, dated 2021, SUPERSEDED): "Logs are retained for 30 days."\n' +
      'NOTE (v3, dated 2024, CURRENT): "Logs are retained for 90 days."\n' +
      'A summary doc claims "logs are retained for 60 days." ' +
      'Question: Per the CURRENT policy only, how long are logs retained? Answer in one short sentence ' +
      'and do not cite any superseded or third-party figure.',
    // controlling fact is the v3 90-day retention.
    oracle: {
      kind: 'source_span',
      source_text: 'Per the current version 3 policy, logs are retained for 90 days.',
      gold_span: '90 days',
      planted_unsupported: ['30 days', '60 days', '45 days'],
    },
    note: 'Superseded-version + conflicting-number trap. v1/summary figures are laundering distractors.',
  },
  {
    id: 'p4-qa-conflicting-price',
    suite: 'failure-prone',
    category: 'factual_qa',
    split: 'holdout',
    prompt:
      'Three sources are provided.\n' +
      'OLD PRICE LIST (2022, archived): "The Pro plan is $40 per month."\n' +
      'BLOG POST (third-party, unofficial): "The Pro plan is $25 per month."\n' +
      'OFFICIAL PRICING PAGE (current): "The Pro plan is $50 per month."\n' +
      'Question: According to the OFFICIAL CURRENT pricing only, what is the monthly price of the Pro plan? ' +
      'Answer in one short sentence; do not assert the archived or third-party number.',
    oracle: {
      kind: 'source_span',
      source_text: 'According to the official current pricing page, the Pro plan is $50 per month.',
      gold_span: '50 per month',
      planted_unsupported: ['40 per month', '25 per month', '45 per month'],
    },
    note: 'Conflicting-number distractor docs (archived + third-party). Controlling fact is the $50 official price.',
  },
  {
    id: 'p4-qa-no-invent-cadence',
    suite: 'failure-prone',
    category: 'factual_qa',
    split: 'tuning',
    prompt:
      'SOURCE: "The Acme API access token is valid until it is manually revoked by an administrator; ' +
      'there is no automatic expiry." Question: Based ONLY on the source, when does the token expire? ' +
      'Answer in one sentence and do not invent any automatic reset or rotation schedule.',
    oracle: {
      kind: 'source_span',
      source_text:
        'The Acme API access token is valid until it is manually revoked by an administrator; there is no automatic expiry.',
      gold_span: 'manually revoked',
      planted_unsupported: ['every 24 hours', 'every 90 days', 'resets daily', 'after 30 days'],
    },
    note: 'Grounding probe: weak models invent a reset cadence. Mirrors pilot F1.',
  },
  {
    id: 'p4-qa-superseded-owner',
    suite: 'failure-prone',
    category: 'factual_qa',
    split: 'holdout',
    prompt:
      'Two records are provided.\n' +
      'RECORD (2019, SUPERSEDED): "The service owner is the Payments team."\n' +
      'RECORD (2025, CURRENT): "Ownership transferred; the service owner is the Platform team."\n' +
      'An onboarding wiki guesses "the service owner is the Billing team." ' +
      'Question: Per the CURRENT record only, which team owns the service? Answer in one short sentence; ' +
      'do not name a superseded or guessed team.',
    oracle: {
      kind: 'source_span',
      source_text: 'Per the current 2025 record, the service owner is the Platform team.',
      gold_span: 'platform team',
      planted_unsupported: ['payments team', 'billing team', 'data team'],
    },
    note: 'Superseded-version ownership trap; Payments/Billing are laundering distractors.',
  },
  {
    id: 'p4-qa-buried-limit',
    suite: 'realistic-distribution',
    category: 'factual_qa',
    split: 'tuning',
    prompt:
      'SOURCE: "Standard accounts may upload files up to 25 megabytes each. (Enterprise accounts have a ' +
      'separate, higher limit negotiated per contract.)" Question: For a STANDARD account, what is the ' +
      'per-file upload size limit? Answer in one short sentence based only on the source.',
    oracle: {
      kind: 'source_span',
      source_text: 'Standard accounts may upload files up to 25 megabytes each.',
      gold_span: '25 megabytes',
      planted_unsupported: ['50 megabytes', '100 megabytes', '25 gigabytes'],
    },
    note: 'Buried-truth at normal difficulty: the standard-vs-enterprise aside is a mild distractor.',
  },
  {
    id: 'p4-qa-clean-date',
    suite: 'clean-control',
    category: 'factual_qa',
    split: 'holdout',
    prompt:
      'SOURCE: "The maintenance window is scheduled for Saturday, March 14." Question: On what date is the ' +
      'maintenance window scheduled? Answer in one short sentence based only on the source.',
    oracle: {
      kind: 'source_span',
      source_text: 'The maintenance window is scheduled for Saturday, March 14.',
      gold_span: 'march 14',
      planted_unsupported: ['march 15', 'march 4', 'april 14'],
    },
    note: 'Clean-control: unambiguous extraction. A valid grounded answer MUST pass.',
  },
  {
    id: 'p4-qa-clean-contact',
    suite: 'clean-control',
    category: 'factual_qa',
    split: 'tuning',
    prompt:
      'SOURCE: "For billing questions, contact the finance desk at extension 4120." Question: Which ' +
      'extension handles billing questions? Answer in one short sentence based only on the source.',
    oracle: {
      kind: 'source_span',
      source_text: 'For billing questions, contact the finance desk at extension 4120.',
      gold_span: 'extension 4120',
      planted_unsupported: ['extension 4220', 'extension 1240', 'extension 4012'],
    },
    note: 'Clean-control: single buried number, no conflict. Must not be false-blocked.',
  },
  {
    id: 'p4-qa-superseded-sla',
    suite: 'failure-prone',
    category: 'factual_qa',
    split: 'tuning',
    prompt:
      'Two contract addenda are provided.\n' +
      'ADDENDUM A (2020, SUPERSEDED): "The support SLA response time is 8 business hours."\n' +
      'ADDENDUM C (2023, IN FORCE): "The support SLA response time is 4 business hours."\n' +
      'A vendor FAQ states "responses within 2 hours." ' +
      'Question: Per the IN-FORCE addendum only, what is the SLA response time? Answer in one short ' +
      'sentence; do not cite a superseded or marketing figure.',
    oracle: {
      kind: 'source_span',
      source_text: 'Per the in-force 2023 addendum, the support SLA response time is 4 business hours.',
      gold_span: '4 business hours',
      planted_unsupported: ['8 business hours', '2 hours', '24 hours'],
    },
    note: 'Superseded-version SLA + conflicting marketing figure. 8h/2h are laundering distractors.',
  },
  {
    id: 'p4-qa-version-default',
    suite: 'realistic-distribution',
    category: 'factual_qa',
    split: 'holdout',
    prompt:
      'SOURCE: "In version 2 of the CLI the default timeout was 30 seconds; in version 3 (current) the ' +
      'default timeout is 60 seconds." Question: What is the default timeout in the CURRENT version? ' +
      'Answer in one short sentence based only on the source.',
    oracle: {
      kind: 'source_span',
      source_text: 'In version 3, the current CLI, the default timeout is 60 seconds.',
      gold_span: '60 seconds',
      planted_unsupported: ['30 seconds', '90 seconds', '15 seconds'],
    },
    note: 'Mild version trap at normal difficulty: v2 value is the only distractor inline.',
  },
  {
    id: 'p4-qa-clean-room',
    suite: 'clean-control',
    category: 'factual_qa',
    split: 'holdout',
    prompt:
      'SOURCE: "The all-hands meeting is in room B12 on the second floor." Question: In which room is the ' +
      'all-hands meeting? Answer in one short sentence based only on the source.',
    oracle: {
      kind: 'source_span',
      source_text: 'The all-hands meeting is in room B12 on the second floor.',
      gold_span: 'room b12',
      planted_unsupported: ['room b21', 'room d12', 'room a12'],
    },
    note: 'Clean-control: single unambiguous fact. A valid grounded answer MUST pass.',
  },
];

// ════════════════════════════════════════════════════════════════════════════
// FAMILY 3 — CONSTRAINT (structured_constraint). ≥3 simultaneous bounds + ≥1
// forbidden enum. checks[] enumerate every bound and the forbidden enum.
// Answers are JSON objects; prompts specify the exact field names so the model
// can declare a checkable structure, but never reveal a satisfying assignment.
//
// NOTE on the enum check: the existing `evaluateConstraint` `not_in` operator
// requires `value` to be an Array (it returns false otherwise). So a "tier must
// NOT be 'legacy'" constraint is encoded as { op:'not_in', value:['legacy', …] }.
//
// FORMAT instruction (Amendment B1, Deliverable 3): round-1 showed the model
// REFUSE/BURY the JSON under SHARED_COT_SYS ("a bare JSON response isn't
// helpful…"), so the structured_constraint oracle parsed nothing. We append a
// single JSON-ONLY format directive to EVERY constraint prompt below. This is a
// FORMAT instruction ONLY — it changes no constraint, bound, field, gold, or
// difficulty (the bounds/enums in checks[] are untouched). It is appended
// uniformly via CONSTRAINT_JSON_ONLY_SUFFIX so the corpus authoring stays
// surgical and auditable.
// ════════════════════════════════════════════════════════════════════════════

/** Appended to every constraint prompt: FORMAT-only, demands a JSON-only answer. */
const CONSTRAINT_JSON_ONLY_SUFFIX =
  ' Output ONLY a single JSON object with the required fields as your FINAL ANSWER — ' +
  'no prose, no explanation, no code fence.';

const CONSTRAINT_BASE: Phase4Task[] = [
  {
    id: 'p4-con-server-sizing',
    suite: 'failure-prone',
    category: 'constraint',
    split: 'tuning',
    prompt:
      'Choose a server configuration. Reply with ONLY a JSON object with fields ' +
      '"cpu", "memory_gb", "replicas", and "tier". Constraints (ALL must hold simultaneously): ' +
      'cpu must be strictly greater than 4; memory_gb must be at least 16; replicas must be ' +
      'strictly less than 10; and tier must NOT be "legacy" or "deprecated" (use a supported tier). ' +
      'Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'cpu-gt-4', field: 'cpu', op: '>', value: 4 },
        { id: 'mem-ge-16', field: 'memory_gb', op: '>=', value: 16 },
        { id: 'replicas-lt-10', field: 'replicas', op: '<', value: 10 },
        { id: 'tier-not-forbidden', field: 'tier', op: 'not_in', value: ['legacy', 'deprecated'] },
      ],
    },
    note: '3 numeric bounds + forbidden-enum. The strict-vs-inclusive boundaries are the trap.',
  },
  {
    id: 'p4-con-budget-split',
    suite: 'failure-prone',
    category: 'constraint',
    split: 'holdout',
    prompt:
      'Allocate a marketing budget. Reply with ONLY a JSON object with fields "search", "social", ' +
      '"events", and "channel". Constraints (ALL simultaneous): search must be greater than 300; ' +
      'social must be less than or equal to 250; events must be strictly greater than 0 but strictly ' +
      'less than 200; and channel must NOT be "untracked" or "manual". Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'search-gt-300', field: 'search', op: '>', value: 300 },
        { id: 'social-le-250', field: 'social', op: '<=', value: 250 },
        { id: 'events-lt-200', field: 'events', op: '<', value: 200 },
        { id: 'events-gt-0', field: 'events', op: '>', value: 0 },
        { id: 'channel-not-forbidden', field: 'channel', op: 'not_in', value: ['untracked', 'manual'] },
      ],
    },
    note: 'Four numeric bounds (one two-sided on events) + forbidden enum. Two-sided bound is the trap.',
  },
  {
    id: 'p4-con-flight-booking',
    suite: 'failure-prone',
    category: 'constraint',
    split: 'tuning',
    prompt:
      'Propose a flight booking. Reply with ONLY a JSON object with fields "price", "stops", ' +
      '"bags_included", and "fare_class". Constraints (ALL simultaneous): price must be less than 800; ' +
      'stops must be less than or equal to 1; bags_included must be greater than or equal to 1; and ' +
      'fare_class must NOT be "basic" or "standby". Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'price-lt-800', field: 'price', op: '<', value: 800 },
        { id: 'stops-le-1', field: 'stops', op: '<=', value: 1 },
        { id: 'bags-ge-1', field: 'bags_included', op: '>=', value: 1 },
        { id: 'fare-not-forbidden', field: 'fare_class', op: 'not_in', value: ['basic', 'standby'] },
      ],
    },
    note: '3 numeric bounds + forbidden enum. Booking "basic" to hit the price bound is the tempting violation.',
  },
  {
    id: 'p4-con-staffing',
    suite: 'realistic-distribution',
    category: 'constraint',
    split: 'holdout',
    prompt:
      'Plan a shift. Reply with ONLY a JSON object with fields "nurses", "doctors", "beds", and "unit". ' +
      'Constraints (ALL simultaneous): nurses must be at least 3; doctors must be greater than 0; beds ' +
      'must be less than or equal to 20; and unit must NOT be "closed". Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'nurses-ge-3', field: 'nurses', op: '>=', value: 3 },
        { id: 'doctors-gt-0', field: 'doctors', op: '>', value: 0 },
        { id: 'beds-le-20', field: 'beds', op: '<=', value: 20 },
        { id: 'unit-not-closed', field: 'unit', op: 'not_in', value: ['closed'] },
      ],
    },
    note: 'Normal-difficulty staffing: 3 bounds + forbidden enum, generous feasible region.',
  },
  {
    id: 'p4-con-clean-budget',
    suite: 'clean-control',
    category: 'constraint',
    split: 'tuning',
    prompt:
      'Split a $1000 budget across exactly two line items. Reply with ONLY a JSON object with fields ' +
      '"marketing", "ops", and "status". Constraints: marketing must be greater than 500; ops must be ' +
      'less than 500; and status must NOT be "frozen". Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'marketing-gt-500', field: 'marketing', op: '>', value: 500 },
        { id: 'ops-lt-500', field: 'ops', op: '<', value: 500 },
        { id: 'status-not-frozen', field: 'status', op: 'not_in', value: ['frozen'] },
      ],
    },
    note: 'Clean-control: wide feasible region (e.g. marketing 600 / ops 400 / status active). Must not be false-blocked.',
  },
  {
    id: 'p4-con-vm-provision',
    suite: 'failure-prone',
    category: 'constraint',
    split: 'holdout',
    prompt:
      'Provision a VM. Reply with ONLY a JSON object with fields "vcpus", "disk_gb", "nics", and "image". ' +
      'Constraints (ALL simultaneous): vcpus must be at least 2 and at most 8; disk_gb must be greater ' +
      'than 50; nics must be strictly less than 4; and image must NOT be "eol" or "beta". ' +
      'Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'vcpus-ge-2', field: 'vcpus', op: '>=', value: 2 },
        { id: 'vcpus-le-8', field: 'vcpus', op: '<=', value: 8 },
        { id: 'disk-gt-50', field: 'disk_gb', op: '>', value: 50 },
        { id: 'nics-lt-4', field: 'nics', op: '<', value: 4 },
        { id: 'image-not-forbidden', field: 'image', op: 'not_in', value: ['eol', 'beta'] },
      ],
    },
    note: 'Two-sided vcpus bound + two more numeric bounds + forbidden enum. Boundary inclusivity is the trap.',
  },
  {
    id: 'p4-con-loan-terms',
    suite: 'failure-prone',
    category: 'constraint',
    split: 'tuning',
    prompt:
      'Propose loan terms. Reply with ONLY a JSON object with fields "apr", "term_months", "fee", and ' +
      '"product". Constraints (ALL simultaneous): apr must be less than 12; term_months must be greater ' +
      'than or equal to 12 and less than or equal to 60; fee must be less than 100; and product must NOT ' +
      'be "payday" or "subprime". Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'apr-lt-12', field: 'apr', op: '<', value: 12 },
        { id: 'term-ge-12', field: 'term_months', op: '>=', value: 12 },
        { id: 'term-le-60', field: 'term_months', op: '<=', value: 60 },
        { id: 'fee-lt-100', field: 'fee', op: '<', value: 100 },
        { id: 'product-not-forbidden', field: 'product', op: 'not_in', value: ['payday', 'subprime'] },
      ],
    },
    note: 'Two-sided term bound + two more numerics + forbidden enum. Tempting "payday" to hit a low fee.',
  },
  {
    id: 'p4-con-event-plan',
    suite: 'realistic-distribution',
    category: 'constraint',
    split: 'tuning',
    prompt:
      'Plan an event. Reply with ONLY a JSON object with fields "guests", "tables", "hours", and ' +
      '"venue_status". Constraints (ALL simultaneous): guests must be greater than 0; tables must be at ' +
      'least 1; hours must be less than or equal to 6; and venue_status must NOT be "unavailable". ' +
      'Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'guests-gt-0', field: 'guests', op: '>', value: 0 },
        { id: 'tables-ge-1', field: 'tables', op: '>=', value: 1 },
        { id: 'hours-le-6', field: 'hours', op: '<=', value: 6 },
        { id: 'venue-not-unavailable', field: 'venue_status', op: 'not_in', value: ['unavailable'] },
      ],
    },
    note: 'Normal-difficulty event plan: 3 bounds + forbidden enum, generous feasible region.',
  },
  {
    id: 'p4-con-clean-team',
    suite: 'clean-control',
    category: 'constraint',
    split: 'holdout',
    prompt:
      'Form a team. Reply with ONLY a JSON object with fields "engineers", "designers", "headcount", and ' +
      '"status". Constraints: engineers must be greater than 0; designers must be greater than 0; ' +
      'headcount must be less than or equal to 10; and status must NOT be "disbanded". ' +
      'Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'eng-gt-0', field: 'engineers', op: '>', value: 0 },
        { id: 'des-gt-0', field: 'designers', op: '>', value: 0 },
        { id: 'headcount-le-10', field: 'headcount', op: '<=', value: 10 },
        { id: 'status-not-disbanded', field: 'status', op: 'not_in', value: ['disbanded'] },
      ],
    },
    note: 'Clean-control: wide feasible region. Must not be false-blocked.',
  },
  {
    id: 'p4-con-clean-order',
    suite: 'clean-control',
    category: 'constraint',
    split: 'tuning',
    prompt:
      'Place an order. Reply with ONLY a JSON object with fields "quantity", "unit_price", "discount", ' +
      'and "status". Constraints: quantity must be greater than 0; unit_price must be greater than 0; ' +
      'discount must be less than 50; and status must NOT be "cancelled". Reply with ONLY the JSON object.',
    oracle: {
      kind: 'structured_constraint',
      checks: [
        { id: 'qty-gt-0', field: 'quantity', op: '>', value: 0 },
        { id: 'price-gt-0', field: 'unit_price', op: '>', value: 0 },
        { id: 'discount-lt-50', field: 'discount', op: '<', value: 50 },
        { id: 'status-not-cancelled', field: 'status', op: 'not_in', value: ['cancelled'] },
      ],
    },
    note: 'Clean-control: trivially satisfiable. A valid structured answer MUST pass.',
  },
];

/**
 * Constraint tasks with the JSON-ONLY format directive appended (Deliverable 3).
 * ONLY the prompt string changes; oracle/checks/fields/bounds/gold/difficulty are
 * carried through verbatim.
 */
const CONSTRAINT: Phase4Task[] = CONSTRAINT_BASE.map(t => ({
  ...t,
  prompt: t.prompt + CONSTRAINT_JSON_ONLY_SUFFIX,
}));

/** The full hard corpus, all three families. */
export const HARD_CORPUS: Phase4Task[] = [...NUMERIC, ...FACTUAL_QA, ...CONSTRAINT];

export function tasksForFamily(category: Phase4Task['category']): Phase4Task[] {
  return HARD_CORPUS.filter(t => t.category === category);
}

export function tasksForSplit(split: Phase4Task['split']): Phase4Task[] {
  return HARD_CORPUS.filter(t => t.split === split);
}

export function bindingEligibleTaskIds(): string[] {
  return HARD_CORPUS.filter(t => t.binding_eligible).map(t => t.id);
}
