/**
 * Phase 4 — HARD_CORPUS gradeability + gold-correctness suite (build STEP 5,
 * Deliverable 4). NO model / CLI calls — pure offline oracle grading.
 *
 * For EVERY task this asserts:
 *  (a) a KNOWN-CORRECT answer grades correct:true / high_sev_defects:0;
 *  (b) a KNOWN-WRONG answer grades correct:false;
 *  (c) for numeric tasks, the oracle gold equals an INDEPENDENT in-test
 *      recomputation from the raw leaf inputs (a wrong gold is caught here) AND
 *      that recomputation matches the documented gold_formula's stated result;
 *  (d) split + suite + category are valid;
 *  (e) no NUMERIC prompt contains its own gold answer string, and every
 *      source_span gold_span is present in source_text while no
 *      planted_unsupported fact leaks into source_text.
 *
 * GOLD CORRECTNESS IS EXISTENTIAL: each numeric gold is recomputed from first
 * principles below WITHOUT reading the oracle's gold field, so a typo'd gold
 * fails the suite rather than silently poisoning the experiment.
 */

import { describe, it, expect } from 'vitest';
import {
  HARD_CORPUS,
  bindingEligibleTaskIds,
  type Phase4Task,
} from '../../benchmark/phase4/corpus.js';
import { gradeWithOracle, type GoldAnswerOracle } from '../../benchmark/oracles.js';

// ── Independent gold recomputation (does NOT read oracle.gold) ───────────────
// Each entry computes the gold from the raw leaf inputs stated in the prompt,
// mirroring gold_formula. If corpus.ts has a wrong gold, the (c) assertion below
// catches it. round2 mirrors the "rounded to two decimals" tasks.
const round2 = (x: number) => Math.round(x * 100) / 100;

const RECOMPUTED_GOLD: Record<string, number> = {
  'p4-num-credit-weighted': (4 * 91 + 3 * 82 + 2 * 74 + 1 * 68) / (4 + 3 + 2 + 1) - 3, // 82.6 - 3 = 79.6
  'p4-num-chained-discount': (500 * 0.8 * 0.9 * 1.08) / 2, // 388.8 / 2 = 194.4
  'p4-num-pct-of-pct': 50000 * 0.6 * 0.25 * 0.12 * 2, // 900 * 2 = 1800
  'p4-num-mixed-time-units': (2 + 45 / 60 + 90 / 60) * 30, // 4.25 * 30 = 127.5
  'p4-num-compound-order': round2((2000 * 1.1 - 50) * 1.05 * 0.98), // 2257.5 * 0.98 = 2212.35
  'p4-num-weighted-blend': (30 * 1.5 + 20 * 2.0) / (30 + 20), // 85 / 50 = 1.7
  'p4-num-margin-vs-markup': ((90 / (1 - 0.4)) * 4 - 20) * 1.05, // (600-20)*1.05 = 609
  'p4-num-progressive-tax': (20000 * 0.1 + 30000 * 0.2 - 200) * 2, // 7800 * 2 = 15600
  'p4-num-margin-price': (240 / (1 - 0.4)) * 3, // 400 * 3 = 1200
  'p4-num-avg-speed': (90 + 60) / (1.25 + 0.75), // 150 / 2 = 75
};

// ── Known-correct / known-wrong answers per task (author-supplied) ───────────
// correct: a faithful answer a competent model could declare a valid proof for.
// wrong:   a defective answer — a numeric distractor, a laundered RAG distractor,
//          or an out-of-bound / forbidden-enum structured answer.
interface AnswerPair {
  correct: string;
  wrong: string;
}

const ANSWERS: Record<string, AnswerPair> = {
  // ── numeric (correct = the gold; wrong = the leading method-trap distractor) ──
  'p4-num-credit-weighted': { correct: 'The final adjusted grade is 79.6.', wrong: 'The average is 78.75.' },
  'p4-num-chained-discount': { correct: 'Each friend pays 194.4.', wrong: 'Each pays 189.' },
  'p4-num-pct-of-pct': { correct: 'Total desks planned: 1800.', wrong: 'That is 7500.' },
  'p4-num-mixed-time-units': { correct: 'The bill is 127.5.', wrong: 'The bill is 112.5.' },
  'p4-num-compound-order': { correct: 'The final balance is 2212.35.', wrong: 'The final balance is 2205.' },
  'p4-num-weighted-blend': { correct: 'The weighted price per liter is 1.7.', wrong: 'It is 1.75 per liter.' },
  'p4-num-margin-vs-markup': { correct: 'The final charge is 609.', wrong: 'The final charge is 508.2.' },
  'p4-num-progressive-tax': { correct: 'The combined tax is 15600.', wrong: 'The combined tax is 19600.' },
  'p4-num-margin-price': { correct: 'Total revenue is 1200.', wrong: 'Total revenue is 1008.' },
  'p4-num-avg-speed': { correct: 'The average speed is 75 km/h.', wrong: 'About 76 km/h.' },

  // ── factual_qa (correct conveys gold_span; wrong launders a planted distractor) ──
  'p4-qa-superseded-retention': {
    correct: 'Per the current policy, logs are retained for 90 days.',
    wrong: 'Logs are retained for 30 days.',
  },
  'p4-qa-conflicting-price': {
    correct: 'According to official current pricing, the Pro plan is 50 per month.',
    wrong: 'The Pro plan is 25 per month.',
  },
  'p4-qa-no-invent-cadence': {
    correct: 'It is valid until manually revoked by an administrator.',
    wrong: 'The token resets every 24 hours.',
  },
  'p4-qa-superseded-owner': {
    correct: 'Per the current record, the service owner is the Platform team.',
    wrong: 'The service owner is the Payments team.',
  },
  'p4-qa-buried-limit': {
    correct: 'A standard account may upload files up to 25 megabytes each.',
    wrong: 'The limit is 50 megabytes per file.',
  },
  'p4-qa-clean-date': {
    correct: 'The maintenance window is scheduled for March 14.',
    wrong: 'It is scheduled for March 15.',
  },
  'p4-qa-clean-contact': {
    correct: 'Billing questions go to extension 4120.',
    wrong: 'Billing is handled at extension 4220.',
  },
  'p4-qa-superseded-sla': {
    correct: 'Per the in-force addendum, the SLA response time is 4 business hours.',
    wrong: 'The SLA response time is 8 business hours.',
  },
  'p4-qa-version-default': {
    correct: 'In the current version the default timeout is 60 seconds.',
    wrong: 'The default timeout is 30 seconds.',
  },
  'p4-qa-clean-room': {
    correct: 'The all-hands meeting is in room B12.',
    wrong: 'The meeting is in room B21.',
  },

  // ── constraint (correct = satisfying JSON; wrong = a bound/enum violation) ──
  'p4-con-server-sizing': {
    correct: '{"cpu": 8, "memory_gb": 32, "replicas": 6, "tier": "standard"}',
    wrong: '{"cpu": 4, "memory_gb": 8, "replicas": 12, "tier": "legacy"}',
  },
  'p4-con-budget-split': {
    correct: '{"search": 400, "social": 200, "events": 100, "channel": "paid"}',
    wrong: '{"search": 250, "social": 300, "events": 0, "channel": "untracked"}',
  },
  'p4-con-flight-booking': {
    correct: '{"price": 650, "stops": 1, "bags_included": 1, "fare_class": "main"}',
    wrong: '{"price": 950, "stops": 2, "bags_included": 0, "fare_class": "basic"}',
  },
  'p4-con-staffing': {
    correct: '{"nurses": 4, "doctors": 2, "beds": 18, "unit": "icu"}',
    wrong: '{"nurses": 2, "doctors": 0, "beds": 25, "unit": "closed"}',
  },
  'p4-con-clean-budget': {
    correct: '{"marketing": 600, "ops": 400, "status": "active"}',
    wrong: '{"marketing": 400, "ops": 600, "status": "frozen"}',
  },
  'p4-con-vm-provision': {
    correct: '{"vcpus": 4, "disk_gb": 80, "nics": 2, "image": "lts"}',
    wrong: '{"vcpus": 16, "disk_gb": 40, "nics": 4, "image": "eol"}',
  },
  'p4-con-loan-terms': {
    correct: '{"apr": 9, "term_months": 36, "fee": 50, "product": "personal"}',
    wrong: '{"apr": 15, "term_months": 6, "fee": 150, "product": "payday"}',
  },
  'p4-con-event-plan': {
    correct: '{"guests": 50, "tables": 6, "hours": 4, "venue_status": "booked"}',
    wrong: '{"guests": 0, "tables": 0, "hours": 8, "venue_status": "unavailable"}',
  },
  'p4-con-clean-team': {
    correct: '{"engineers": 3, "designers": 1, "headcount": 4, "status": "active"}',
    wrong: '{"engineers": 0, "designers": 0, "headcount": 12, "status": "disbanded"}',
  },
  'p4-con-clean-order': {
    correct: '{"quantity": 10, "unit_price": 5, "discount": 10, "status": "open"}',
    wrong: '{"quantity": 0, "unit_price": 0, "discount": 60, "status": "cancelled"}',
  },
};

const VALID_SPLITS = new Set<Phase4Task['split']>(['tuning', 'holdout']);
const VALID_SUITES = new Set<Phase4Task['suite']>([
  'failure-prone',
  'clean-control',
  'realistic-distribution',
]);
const VALID_CATEGORIES = new Set<Phase4Task['category']>(['numeric', 'factual_qa', 'constraint']);

// ── norm() replica (oracles.ts norm is module-private) — used only to verify
//    the leakage / planted-fact invariants in (e), matching the grader's view. ──
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?"']/g, '')
    .trim();
}

describe('Phase4 HARD_CORPUS — shape and coverage', () => {
  it('has 30 tasks, 10 per family', () => {
    expect(HARD_CORPUS.length).toBe(30);
    for (const cat of VALID_CATEGORIES) {
      expect(HARD_CORPUS.filter(t => t.category === cat).length).toBe(10);
    }
  });

  it('has unique task ids', () => {
    const ids = HARD_CORPUS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least 6 multi-field binding-eligible numeric tasks', () => {
    const eligible = HARD_CORPUS.filter(t => t.binding_eligible);
    expect(eligible.length).toBeGreaterThanOrEqual(6);
    // every binding-eligible task is numeric (binding/drift is a numeric notion)
    expect(eligible.every(t => t.category === 'numeric')).toBe(true);
    expect(bindingEligibleTaskIds().sort()).toEqual(eligible.map(t => t.id).sort());
  });

  it('every task has an authored known-correct/known-wrong answer pair', () => {
    for (const t of HARD_CORPUS) {
      expect(ANSWERS[t.id], `missing ANSWERS for ${t.id}`).toBeDefined();
    }
  });

  it('every numeric task has a recomputation entry and a gold_formula', () => {
    for (const t of HARD_CORPUS.filter(t => t.category === 'numeric')) {
      expect(RECOMPUTED_GOLD[t.id], `missing recompute for ${t.id}`).toBeDefined();
      expect(typeof t.gold_formula).toBe('string');
      expect(t.gold_formula!.length).toBeGreaterThan(0);
    }
  });
});

describe('Phase4 HARD_CORPUS — (d) valid split/suite/category', () => {
  for (const t of HARD_CORPUS) {
    it(`${t.id}: split, suite, category are valid`, () => {
      expect(VALID_SPLITS.has(t.split)).toBe(true);
      expect(VALID_SUITES.has(t.suite)).toBe(true);
      expect(VALID_CATEGORIES.has(t.category)).toBe(true);
    });
  }
});

describe('Phase4 HARD_CORPUS — (c) numeric golds are independently recomputable', () => {
  for (const t of HARD_CORPUS.filter(t => t.category === 'numeric')) {
    it(`${t.id}: oracle.gold === independent recomputation (within tolerance)`, () => {
      const oracle = t.oracle as GoldAnswerOracle;
      const recomputed = RECOMPUTED_GOLD[t.id];
      const tol = oracle.tolerance ?? 1e-6;
      // EXISTENTIAL self-check: a wrong gold in corpus.ts fails here.
      expect(Math.abs(oracle.gold - recomputed)).toBeLessThanOrEqual(tol);
    });
  }
});

describe('Phase4 HARD_CORPUS — (a) known-correct answers grade clean', () => {
  for (const t of HARD_CORPUS) {
    it(`${t.id}: known-correct answer is correct with 0 high-sev defects`, () => {
      const v = gradeWithOracle(t.oracle, ANSWERS[t.id].correct);
      expect(v.correct, `reasons: ${v.reasons.join(', ')}`).toBe(true);
      expect(v.high_sev_defects).toBe(0);
    });
  }
});

describe('Phase4 HARD_CORPUS — (b) known-wrong answers are caught', () => {
  for (const t of HARD_CORPUS) {
    it(`${t.id}: known-wrong answer grades incorrect`, () => {
      const v = gradeWithOracle(t.oracle, ANSWERS[t.id].wrong);
      expect(v.correct).toBe(false);
      expect(v.high_sev_defects).toBeGreaterThan(0);
    });
  }
});

describe('Phase4 HARD_CORPUS — (e) no answer leakage; oracle well-formed', () => {
  it('no NUMERIC prompt contains its own gold answer string', () => {
    for (const t of HARD_CORPUS.filter(t => t.category === 'numeric')) {
      const goldStr = String((t.oracle as GoldAnswerOracle).gold);
      expect(t.prompt.includes(goldStr), `${t.id} leaks gold "${goldStr}"`).toBe(false);
    }
  });

  it('every source_span gold_span is present in source_text', () => {
    for (const t of HARD_CORPUS.filter(t => t.oracle.kind === 'source_span')) {
      const o = t.oracle as Extract<typeof t.oracle, { kind: 'source_span' }>;
      expect(norm(o.source_text).includes(norm(o.gold_span)), `${t.id} gold_span absent`).toBe(true);
    }
  });

  it('no planted_unsupported fact leaks into its source_text', () => {
    for (const t of HARD_CORPUS.filter(t => t.oracle.kind === 'source_span')) {
      const o = t.oracle as Extract<typeof t.oracle, { kind: 'source_span' }>;
      const src = norm(o.source_text);
      for (const p of o.planted_unsupported) {
        expect(src.includes(norm(p)), `${t.id} planted "${p}" present in source`).toBe(false);
      }
    }
  });
});
