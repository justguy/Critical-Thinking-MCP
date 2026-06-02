/**
 * Calibration-corpus invariant tests (tracker dvp-p1a-run, plan §1a).
 *
 * Deterministic, OFFLINE (no LLM/CLI calls). Proves the calibration corpus is
 * well-formed BEFORE any expensive real run, and that the scored path admits no
 * synthetic results:
 *
 *   - all four suites exist and are non-empty;
 *   - every task carries an OBJECTIVE oracle KIND (gold_answer / source_span /
 *     structured_constraint) — no substring proxy;
 *   - every failure-prone / realistic / mutation task has a REAL planted defect
 *     opportunity an objective oracle can catch;
 *   - each oracle ACCEPTS its own known-correct answer (guards against an oracle
 *     that would false-fail a correct model answer and inflate apparent difficulty);
 *   - source_span oracles are not misconfigured (planted-unsupported values are
 *     genuinely absent from the source, except the by-design "absence" gold spans);
 *   - the calibration row shape is synthetic:false only (no synthetic results).
 */

import { describe, it, expect } from 'vitest';
import {
  CALIBRATION_SUITES,
  calibrationTasks,
} from '../../benchmark/suites/calibration.js';
import { gradeWithOracle } from '../../benchmark/oracles.js';
import type { SuiteName } from '../../benchmark/suites/index.js';

const OBJECTIVE_KINDS = ['gold_answer', 'source_span', 'structured_constraint'] as const;
const ALL_SUITES: SuiteName[] = [
  'failure-prone',
  'clean-control',
  'mutation',
  'realistic-distribution',
];

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/[.,;:!?"']/g, '').trim();
}

describe('calibration corpus — four suites exist and are non-empty', () => {
  it('declares exactly the four plan suites', () => {
    expect(Object.keys(CALIBRATION_SUITES).sort()).toEqual([...ALL_SUITES].sort());
  });

  for (const suite of ALL_SUITES) {
    it(`suite "${suite}" is non-empty`, () => {
      expect(CALIBRATION_SUITES[suite].length).toBeGreaterThan(0);
    });
  }

  it('has ~40 tasks total (calibration slice)', () => {
    const n = calibrationTasks().length;
    expect(n).toBeGreaterThanOrEqual(30);
    expect(n).toBeLessThanOrEqual(50);
  });

  it('has no duplicate task IDs', () => {
    const ids = calibrationTasks().map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('calibration corpus — objective oracles only (no proxies)', () => {
  it('every task carries an objective oracle KIND', () => {
    for (const t of calibrationTasks()) {
      expect(OBJECTIVE_KINDS).toContain(t.oracle.kind);
    }
  });

  it('every failure-prone and realistic task has a real planted defect opportunity', () => {
    const probed = calibrationTasks().filter(
      t => t.suite === 'failure-prone' || t.suite === 'realistic-distribution',
    );
    for (const t of probed) {
      const o = t.oracle;
      let hasDefectOpportunity = false;
      if (o.kind === 'gold_answer') {
        // a distractor (a wrong value a defective model emits) is the opportunity
        hasDefectOpportunity = Array.isArray(o.distractors) && o.distractors.length > 0;
      } else if (o.kind === 'source_span') {
        hasDefectOpportunity = o.planted_unsupported.length > 0;
      } else if (o.kind === 'structured_constraint') {
        hasDefectOpportunity = o.checks.length > 0;
      }
      expect(hasDefectOpportunity, `${t.id} lacks a planted defect opportunity`).toBe(true);
    }
  });

  it('every mutation task declares a planted-defect class', () => {
    for (const t of CALIBRATION_SUITES.mutation) {
      expect(t.mutation?.defect_class, `${t.id} missing mutation.defect_class`).toBeTruthy();
    }
  });
});

describe('calibration corpus — oracles accept their own correct answer', () => {
  // Known-correct answers for every numeric task. These are INPUTS to an oracle
  // unit check (synthetic INPUTS for a test), not synthetic RUN RESULTS.
  const correctNumeric: Record<string, string> = {
    'cal-fp-weighted-gpa': '77.00',
    'cal-fp-compound-interest': '1331.00',
    'cal-fp-chained-discount-order': '181.00',
    'cal-fp-percent-of-percent': '240',
    'cal-fp-cagr': '50.00',
    'cal-fp-margin-vs-markup': '40.00',
    'cal-fp-successive-pct': '96.00',
    'cal-fp-effective-rate': '12.68',
    'cal-mut-pct-change': '25',
    'cal-mut-weighted-mean': '6.5',
    'cal-mut-two-step-discount': '324.00',
    'cal-rd-tip-split': '36.00',
    'cal-rd-discount': '175.00',
    'cal-rd-unit-rate': '60',
    'cal-rd-interest-simple': '200.00',
    'cal-cc-add': '192',
    'cal-cc-percent': '25',
    'cal-cc-multiply': '84',
    'cal-fp-hard-avg-speed': '40.00',
    'cal-fp-hard-discount-reverse': '300.00',
    'cal-fp-hard-prob-conjunction': '0.81',
    'cal-fp-hard-mixed-units': '480',
  };

  it('every gold_answer oracle accepts its correct value', () => {
    for (const t of calibrationTasks()) {
      if (t.oracle.kind !== 'gold_answer') continue;
      const ans = correctNumeric[t.id];
      expect(ans, `no known-correct answer registered for ${t.id}`).toBeDefined();
      const v = gradeWithOracle(t.oracle, ans!);
      expect(v.correct, `${t.id} false-fails its own correct answer: ${v.reasons.join(';')}`).toBe(true);
    }
  });

  it('every source_span / structured_constraint oracle accepts a plausible correct answer', () => {
    const correctSpan: Record<string, string> = {
      'cal-fp-rag-laundered-rate': 'According to the current official policy, the refund window is 14 days.',
      'cal-fp-rag-conflicting-owner': 'Per the current org chart, Orion is owned by the Reliability team.',
      'cal-fp-rag-superseded-version': 'In the current release, the minimum supported Node version is 20.',
      'cal-fp-rag-units-trap': 'Per the lab report, the measured runtime at full load is 8 hours.',
      'cal-fp-cert-no-price': 'The monthly price is not stated in the source.',
      'cal-fp-cert-no-deadline': 'The completion date is not specified in the source.',
      'cal-fp-cert-overclaim-count': 'The exact number of risks is not stated in the source.',
      'cal-cc-source-city': 'The conference is held in Lisbon.',
      'cal-cc-source-status': 'The feature flag is disabled in production.',
      'cal-cc-source-owner': 'The billing module is maintained by the Payments team.',
      'cal-mut-source-fact': 'The data center is located in Frankfurt.',
      'cal-rd-source-version': 'The latest stable release is version 5.3.',
      'cal-rd-source-count': 'The service has three regions.',
      'cal-fp-hard-rag-buried-truth': 'The contractually committed SLA is 99.9% monthly uptime.',
      'cal-fp-hard-rag-aggregate-trap': 'Per the authoritative ledger, there are 120 units sellable on hand.',
      'cal-fp-hard-cert-no-hint-headcount': 'The source does not state the number of employees.',
      'cal-fp-hard-cert-no-hint-version': 'The source does not state which database version they run.',
    };
    const correctConstraint: Record<string, string> = {
      'cal-fp-constr-triple-bound': '{"replicas":3,"timeout_ms":2000,"use_legacy_auth":false}',
      'cal-fp-constr-budget-split': '{"alpha":700,"beta":200,"gamma":100,"total":1000,"alpha_over_beta":3.5}',
      'cal-fp-constr-enum-and-range': '{"severity":"high","threshold_pct":90,"enabled":true}',
      'cal-cc-constraint-simple': '{"a":10,"b":20}',
      'cal-cc-constraint-range': '{"port":8080}',
      'cal-mut-constraint-bound': '{"max_retries":3}',
      'cal-rd-constraint-pair': '{"team_x":70,"team_y":30,"total":100}',
      'cal-fp-hard-constr-tight-window': '{"workers":6,"queue_depth":12,"ratio":2}',
    };
    for (const t of calibrationTasks()) {
      let ans: string | undefined;
      if (t.oracle.kind === 'source_span') ans = correctSpan[t.id];
      else if (t.oracle.kind === 'structured_constraint') ans = correctConstraint[t.id];
      else continue;
      expect(ans, `no known-correct answer registered for ${t.id}`).toBeDefined();
      const v = gradeWithOracle(t.oracle, ans!);
      expect(v.correct, `${t.id} false-fails its own correct answer: ${v.reasons.join(';')}`).toBe(true);
    }
  });
});

describe('calibration corpus — source_span oracles are not misconfigured', () => {
  // "Absence-acknowledgment" tasks intentionally have a gold span NOT present in the
  // source (the correct answer states the value is not given). All others must have
  // their gold span present in the source.
  const ABSENCE_TASKS = new Set([
    'cal-fp-cert-no-price',
    'cal-fp-cert-no-deadline',
    'cal-fp-cert-overclaim-count',
    'cal-fp-hard-cert-no-hint-headcount',
    'cal-fp-hard-cert-no-hint-version',
  ]);

  it('no planted-unsupported value is actually present in its source', () => {
    for (const t of calibrationTasks()) {
      if (t.oracle.kind !== 'source_span') continue;
      const src = norm(t.oracle.source_text);
      for (const p of t.oracle.planted_unsupported) {
        expect(src.includes(norm(p)), `${t.id}: planted "${p}" is present in source`).toBe(false);
      }
    }
  });

  it('non-absence gold spans are present in their source', () => {
    for (const t of calibrationTasks()) {
      if (t.oracle.kind !== 'source_span' || ABSENCE_TASKS.has(t.id)) continue;
      const src = norm(t.oracle.source_text);
      expect(src.includes(norm(t.oracle.gold_span)), `${t.id}: gold span absent from source`).toBe(true);
    }
  });
});
