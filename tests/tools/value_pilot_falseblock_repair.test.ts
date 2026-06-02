/**
 * Phase 2 (DETERMINISTIC_VALUE_PLAN.md §2/§7/§8) — false-block repair +
 * mutation-coverage preservation, on the value-pilot tasks that historically
 * false-blocked CORRECT numeric answers (benchmark/value_pilot/PILOT_RESULTS.md):
 *
 *   N1 (% change), N2 (multi-step savings), N4 (weighted per-person).
 *
 * Two checks, never one (§2):
 *   1. REGRESSION  — the formerly false-blocked CORRECT answers now PASS via the
 *      numeric_derivation DAG (the 5 historical false-blocks → 0).
 *   2. COVERAGE PRESERVATION — output-level mutated-WRONG variants (§8) of those
 *      same answers STILL BLOCK, each carrying the correct §7 taxonomy code.
 *
 * Plus: a clean-control set with a SEVERITY-WEIGHTED false-block rate ≤2% (§2),
 * and the invariant that every BLOCK path emits a §7 taxonomy code.
 *
 * HARD CONSTRAINT: the repair must not be a permissive downgrade — every mutant
 * below still blocks. All deterministic; no LLM/CLI calls.
 */

import { describe, it, expect } from 'vitest';

import { EnforcementEngine } from '../../src/enforcement/index.js';
import { handleFinalizeDeliverable } from '../../src/tools/finalize_deliverable.js';
import type { FinalizeOutput } from '../../src/tools/finalize_deliverable.js';
import { BLOCKER_TAXONOMY_CODES } from '../../src/enforcement/blocker_taxonomy.js';

const engine = new EnforcementEngine();

const NUMERIC_CONTRACT = {
  task_type: 'numeric_analysis' as const,
  evidence_level: 'rederived' as const,
  risk_level: 'high' as const,
};

function blocks(out: FinalizeOutput) {
  return out.enforcement?.blocking_issues ?? [];
}
function taxonomies(out: FinalizeOutput): string[] {
  return blocks(out).map(b => b.taxonomy!).filter(Boolean);
}

// ─── The CORRECT answers, as numeric_derivation DAGs (the repair) ───────────────

/** N1: 80→100 = +25%; 100→80 = -20% (NOT -25%). Signed % rendered as magnitude. */
function n1Correct() {
  return {
    contract: {
      contract_id: 'N1_pctchange',
      original_request_text:
        'A metric rose from 80 to 100, then fell from 100 back to 80. State (a) the percentage increase in the first step and (b) the percentage decrease in the second step.',
      ...NUMERIC_CONTRACT,
    },
    answer_text: '(a) The first step is a 25% increase. (b) The second step is a 20% decrease.',
    numeric_derivation: {
      nodes: [
        { id: 'a0', role: 'input', value: 80 },
        { id: 'a1', role: 'input', value: 100 },
        { id: 'inc', role: 'final', value: 25, op: 'percent_change', input_refs: ['a0', 'a1'], magnitude_binding: true, answer_text_quote: '25% increase' },
        { id: 'dec', role: 'final', value: -20, op: 'percent_change', input_refs: ['a1', 'a0'], magnitude_binding: true, answer_text_quote: '20% decrease' },
      ],
      final_refs: ['inc', 'dec'],
    },
    arithmetic_checks: [
      { claim_type: 'percent_change', values: [80, 100], claimed_result: 25 },
      { claim_type: 'percent_change', values: [100, 80], claimed_result: -20 },
    ],
  };
}

/** N2: competitor 30*12=360; 360-120=240 cheaper. 12 = unit-conversion constant. */
function n2Correct() {
  return {
    contract: {
      contract_id: 'N2_savings',
      original_request_text:
        'A subscription costs $120 per year. A competitor charges $30 per month. Over one full year, how many dollars cheaper is the annual subscription than the competitor?',
      ...NUMERIC_CONTRACT,
    },
    answer_text: 'The competitor costs 360 per year, so the annual subscription is 240 dollars cheaper.',
    numeric_derivation: {
      nodes: [
        { id: 'annual', role: 'input', value: 120 },
        { id: 'monthly', role: 'input', value: 30 },
        { id: 'months', role: 'input', value: 12, unit_constant: true },
        { id: 'competitor', role: 'intermediate', value: 360, op: 'product', input_refs: ['monthly', 'months'] },
        { id: 'savings', role: 'final', value: 240, op: 'diff', input_refs: ['competitor', 'annual'] },
      ],
      final_refs: ['savings'],
    },
    arithmetic_checks: [
      { claim_type: 'product', values: [30, 12], claimed_result: 360, unit_constants: [12] },
    ],
  };
}

/** N4: weighted per-person (90*1+60*2+30*7)/10 = 42. Unweighted 60 is WRONG. */
function n4Correct() {
  return {
    contract: {
      contract_id: 'N4_weighted',
      original_request_text:
        'Three teams scored 90, 60, and 30 on a test. The teams have 1, 2, and 7 members respectively. What is the average score PER PERSON across all members?',
      ...NUMERIC_CONTRACT,
    },
    answer_text: 'The weighted per-person average is 42.',
    numeric_derivation: {
      nodes: [
        { id: 's1', role: 'input', value: 90 },
        { id: 's2', role: 'input', value: 60 },
        { id: 's3', role: 'input', value: 30 },
        { id: 'perPerson', role: 'final', value: 42, op: 'weighted_average', input_refs: ['s1', 's2', 's3'], weights: [1, 2, 7] },
      ],
      final_refs: ['perPerson'],
    },
    arithmetic_checks: [
      { claim_type: 'weighted_average', values: [90, 60, 30], weights: [1, 2, 7], claimed_result: 42 },
    ],
  };
}

// ════════════════════════════════════════════════════════════════════════════
// 1. REGRESSION — the historically false-blocked CORRECT answers now PASS.
// ════════════════════════════════════════════════════════════════════════════

describe('Phase 2 regression — formerly false-blocked correct answers now PASS', () => {
  it('N1 (%-change) PASSes with a percent_change DAG + magnitude binding', () => {
    const out = handleFinalizeDeliverable(n1Correct(), engine);
    expect(out.finalize_verdict).toBe('PASS');
    expect(out.re_executed).toContain('trace_conclusion_numbers');
    expect(out.re_executed).toContain('verify_arithmetic');
  });

  it('N2 (multi-step savings) PASSes with a 12-months unit-conversion constant', () => {
    const out = handleFinalizeDeliverable(n2Correct(), engine);
    expect(out.finalize_verdict).toBe('PASS');
  });

  it('N4 (weighted per-person) PASSes with a weighted_average DAG', () => {
    const out = handleFinalizeDeliverable(n4Correct(), engine);
    expect(out.finalize_verdict).toBe('PASS');
  });

  it('the 5 historical false-blocks (N1×2 runs, N2×1, N4×2 runs) now total 0', () => {
    // PILOT_RESULTS.md tally: sonnet false-blocked N1,N2,N4; haiku false-blocked N1,N4.
    const verdicts = [
      handleFinalizeDeliverable(n1Correct(), engine).finalize_verdict, // sonnet N1
      handleFinalizeDeliverable(n2Correct(), engine).finalize_verdict, // sonnet N2
      handleFinalizeDeliverable(n4Correct(), engine).finalize_verdict, // sonnet N4
      handleFinalizeDeliverable(n1Correct(), engine).finalize_verdict, // haiku N1
      handleFinalizeDeliverable(n4Correct(), engine).finalize_verdict, // haiku N4
    ];
    expect(verdicts.filter(v => v === 'BLOCK')).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. COVERAGE PRESERVATION — output-level mutants (§8) STILL BLOCK, with the
//    correct §7 taxonomy code. No coverage may be lost to the repair.
// ════════════════════════════════════════════════════════════════════════════

interface Mutant {
  name: string;
  mutate: () => Record<string, unknown>;
  expectTaxonomy: string;
}

const MUTANTS: Mutant[] = [
  // ── N1 ──
  {
    name: 'N1 changed final number: -20% rendered as -25% (wrong magnitude)',
    expectTaxonomy: 'NUMERIC_MISMATCH',
    mutate: () => {
      const t: any = n1Correct();
      t.answer_text = '(a) 25% increase. (b) 25% decrease.';
      t.numeric_derivation.nodes[3].value = -25;
      t.numeric_derivation.nodes[3].answer_text_quote = '25% decrease';
      t.arithmetic_checks[1].claimed_result = -25;
      return t;
    },
  },
  {
    name: 'N1 wrong operation: percent_change of the wrong direction declared as +20',
    expectTaxonomy: 'NUMERIC_MISMATCH',
    mutate: () => {
      const t: any = n1Correct();
      // claim the 2nd step is -20 but recompute over (a0,a1) which yields +25
      t.numeric_derivation.nodes[3].input_refs = ['a0', 'a1'];
      return t;
    },
  },
  {
    name: 'N1 final-answer drift: DAG correct (-20) but answer renders "30% decrease"',
    expectTaxonomy: 'FINAL_ANSWER_ARTIFACT_DRIFT',
    mutate: () => {
      const t: any = n1Correct();
      t.answer_text = '(a) 25% increase. (b) 30% decrease.';
      t.numeric_derivation.nodes[3].answer_text_quote = '30% decrease';
      return t;
    },
  },
  // ── N2 ──
  {
    name: 'N2 changed final number: savings claimed 250 instead of 240',
    expectTaxonomy: 'NUMERIC_MISMATCH',
    mutate: () => {
      const t: any = n2Correct();
      t.answer_text = 'The competitor costs 360 per year, so it is 250 dollars cheaper.';
      t.numeric_derivation.nodes[4].value = 250;
      return t;
    },
  },
  {
    name: 'N2 bad/flattened input: output 240 laundered in as a unit_constant',
    expectTaxonomy: 'NUMERIC_MISMATCH',
    mutate: () => {
      const t: any = n2Correct();
      t.numeric_derivation.nodes = [
        { id: 'annual', role: 'input', value: 120 },
        { id: 'launder', role: 'input', value: 240, unit_constant: true },
        { id: 'savings', role: 'final', value: 240, op: 'identity', input_refs: ['launder'] },
      ];
      t.numeric_derivation.final_refs = ['savings'];
      t.arithmetic_checks = [{ claim_type: 'sum', values: [120, 240], claimed_result: 240 }];
      return t;
    },
  },
  {
    name: 'N2 wrong operation: competitor computed as 30+12 (sum) not 30*12',
    expectTaxonomy: 'NUMERIC_MISMATCH',
    mutate: () => {
      const t: any = n2Correct();
      t.numeric_derivation.nodes[3].op = 'sum'; // 30+12=42 ≠ claimed 360
      return t;
    },
  },
  // ── N4 ──
  {
    name: 'N4 changed final number: unweighted mean 60 declared under weighted_average op',
    expectTaxonomy: 'NUMERIC_MISMATCH',
    mutate: () => {
      const t: any = n4Correct();
      t.answer_text = 'The average is 60.';
      t.numeric_derivation.nodes[3].value = 60;
      t.arithmetic_checks[0].claimed_result = 60;
      return t;
    },
  },
  {
    name: 'N4 wrong weights: per-person 42 but weights [1,1,1] (recomputes 60)',
    expectTaxonomy: 'NUMERIC_MISMATCH',
    mutate: () => {
      const t: any = n4Correct();
      t.numeric_derivation.nodes[3].weights = [1, 1, 1];
      t.arithmetic_checks[0].weights = [1, 1, 1];
      return t;
    },
  },
  {
    name: 'N4 final-answer drift: DAG correct (42) but answer renders 48',
    expectTaxonomy: 'FINAL_ANSWER_ARTIFACT_DRIFT',
    mutate: () => {
      const t: any = n4Correct();
      t.answer_text = 'The weighted per-person average is 48.';
      return t;
    },
  },
];

describe('Phase 2 coverage preservation — output-level mutants STILL BLOCK (§8)', () => {
  it.each(MUTANTS)('blocks mutant: $name', ({ mutate, expectTaxonomy }) => {
    const out = handleFinalizeDeliverable(mutate(), engine);
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(taxonomies(out)).toContain(expectTaxonomy);
  });

  it('the laundering hardening is NOT relaxed: unit_constant cannot equal a derived value', () => {
    const t: any = n2Correct();
    // Tag the intermediate output (360) as a constant — must NOT exempt it.
    t.numeric_derivation.nodes[2] = { id: 'months', role: 'input', value: 12, unit_constant: true };
    t.numeric_derivation.nodes.push({ id: 'sneak', role: 'input', value: 360, unit_constant: true });
    t.numeric_derivation.nodes[3] = { id: 'competitor', role: 'intermediate', value: 360, op: 'identity', input_refs: ['sneak'] };
    const out = handleFinalizeDeliverable(t, engine);
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(taxonomies(out)).toContain('NUMERIC_MISMATCH');
  });

  it('magnitude_binding cannot rescue a wrong magnitude (25 ≠ 20)', () => {
    const t: any = n1Correct();
    // Keep the DAG value correct (-20) but render "25% decrease": drift, must block.
    t.answer_text = '(a) 25% increase. (b) 25% decrease.';
    t.numeric_derivation.nodes[3].answer_text_quote = '25% decrease';
    const out = handleFinalizeDeliverable(t, engine);
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(taxonomies(out)).toContain('FINAL_ANSWER_ARTIFACT_DRIFT');
  });

  it('magnitude_binding requires a direction word agreeing with the sign', () => {
    const t: any = n1Correct();
    // -20 with an INCREASE word must not bind via magnitude path.
    t.answer_text = '(a) 25% increase. (b) a 20% increase.';
    t.numeric_derivation.nodes[3].answer_text_quote = '20% increase';
    const out = handleFinalizeDeliverable(t, engine);
    expect(out.finalize_verdict).toBe('BLOCK');
    expect(taxonomies(out)).toContain('FINAL_ANSWER_ARTIFACT_DRIFT');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. CLEAN-CONTROL — severity-weighted false-block rate ≤ 2% (§2).
//    A minor format nit must NOT weigh the same as impossible numeric provenance.
// ════════════════════════════════════════════════════════════════════════════

describe('Phase 2 clean-control — severity-weighted false-block rate ≤ 2%', () => {
  // Clean correct deliverables that must all PASS. The three repaired pilot tasks
  // plus the pilot's existing clean numeric control (N3 sum/average).
  const cleanControls: Array<{ name: string; weight: number; build: () => Record<string, unknown> }> = [
    { name: 'N1 % change (correct)', weight: 1.0, build: n1Correct },
    { name: 'N2 savings (correct)', weight: 1.0, build: n2Correct },
    { name: 'N4 weighted per-person (correct)', weight: 1.0, build: n4Correct },
    {
      name: 'N3 clean sum/average (pilot clean control)',
      weight: 1.0,
      build: () => ({
        contract: {
          contract_id: 'N3_clean_sum',
          original_request_text: 'Sum the monthly costs 12, 15, and 18, and give both the total and the average.',
          ...NUMERIC_CONTRACT,
        },
        answer_text: 'The total is 45 and the average is 15.',
        numeric_derivation: {
          nodes: [
            { id: 'c1', role: 'input', value: 12 },
            { id: 'c2', role: 'input', value: 15 },
            { id: 'c3', role: 'input', value: 18 },
            { id: 'total', role: 'final', value: 45, op: 'sum', input_refs: ['c1', 'c2', 'c3'] },
            { id: 'avg', role: 'final', value: 15, op: 'mean', input_refs: ['c1', 'c2', 'c3'] },
          ],
          final_refs: ['total', 'avg'],
        },
        arithmetic_checks: [
          { claim_type: 'sum', values: [12, 15, 18], claimed_result: 45 },
          // A plain mean expressed as a uniform-weight average: weight 1 is the
          // canonical unit constant, declared so it is not mistaken for a laundered input.
          { claim_type: 'weighted_average', values: [12, 15, 18], weights: [1, 1, 1], claimed_result: 15, unit_constants: [1] },
        ],
      }),
    },
    {
      // Same correct N4, but rendered with a harmless trailing-zero format ("42.0").
      // Numerically identical → must still PASS; proves the gate doesn't false-block
      // on a minor FORMAT nit (the low-severity class §2 says must not dominate).
      name: 'N4 correct with 42.0 format nit',
      weight: 0.1,
      build: () => {
        const t: any = n4Correct();
        t.answer_text = 'The weighted per-person average is 42.0.';
        return t;
      },
    },
  ];

  // SEVERITY WEIGHTS (§2): a false-block on impossible-provenance numeric work is a
  // full unit; a false-block that is merely a low-severity format nit is 0.1.
  it('every clean control PASSes (so the unweighted false-block count is 0)', () => {
    for (const c of cleanControls) {
      const out = handleFinalizeDeliverable(c.build(), engine);
      expect(out.finalize_verdict, `${c.name} should PASS`).toBe('PASS');
    }
  });

  it('severity-weighted false-block rate is ≤ 2%', () => {
    const totalWeight = cleanControls.reduce((s, c) => s + c.weight, 0);
    let falseBlockWeight = 0;
    for (const c of cleanControls) {
      const out = handleFinalizeDeliverable(c.build(), engine);
      if (out.finalize_verdict === 'BLOCK') falseBlockWeight += c.weight;
    }
    const rate = falseBlockWeight / totalWeight;
    expect(rate).toBeLessThanOrEqual(0.02);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. EVERY BLOCK PATH EMITS A §7 TAXONOMY CODE.
// ════════════════════════════════════════════════════════════════════════════

describe('Phase 2 invariant — every BLOCK carries exactly one §7 taxonomy code', () => {
  it('every blocking issue across all mutants has a valid §7 code', () => {
    for (const m of MUTANTS) {
      const out = handleFinalizeDeliverable(m.mutate(), engine);
      expect(out.finalize_verdict).toBe('BLOCK');
      for (const b of blocks(out)) {
        expect(b.severity).toBe('blocking');
        expect(b.taxonomy).toBeDefined();
        expect(BLOCKER_TAXONOMY_CODES).toContain(b.taxonomy);
      }
    }
  });

  it('a PASS carries no blocking issues (and thus no spurious taxonomy codes)', () => {
    const out = handleFinalizeDeliverable(n1Correct(), engine);
    expect(out.finalize_verdict).toBe('PASS');
    expect(blocks(out)).toHaveLength(0);
  });
});
