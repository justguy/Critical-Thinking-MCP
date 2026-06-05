/**
 * Phase 5 — metrics + the FROZEN kill rule on INLINE fixtures.
 *
 * Pre-registration: PHASE5_PREREGISTRATION.md §3/§4/§6. Verifies phase5Metrics and
 * evaluateKillRule compute correctly and that the kill rule reads ONLY the frozen
 * thresholds (false_release_reduction >= 0.50 AND Wilson LB > 0 AND
 * realism_false_block <= 0.05 AND spine_required == false AND
 * natural_violation_rate > 0). A PASS fixture and a KILL fixture are exercised.
 *
 * Pure: no model / claude-CLI / ct-enforce calls — only the metric functions over
 * hand-built rows.
 */

import { describe, it, expect } from 'vitest';

import {
  phase5Metrics,
  evaluateKillRule,
  contractBurden,
  FROZEN_THRESHOLDS,
  type GateRow,
  type RealismRow,
} from '../../benchmark/phase5/metrics.js';

// ── Row builders ─────────────────────────────────────────────────────────────
function satRow(id: string, decision: GateRow['decision'], heavy = false): GateRow {
  return {
    scenario_id: id,
    deliverable_type: 'config_spec',
    ground_truth: 'satisfying',
    decision,
    reason: decision === 'RELEASE' ? 'released' : 'gate_block',
    blocking_mechanisms: decision === 'RELEASE' ? [] : ['constraint'],
    heavy_artifact_spine: heavy,
  };
}
function vioRow(id: string, decision: GateRow['decision']): GateRow {
  return {
    scenario_id: id,
    deliverable_type: 'config_spec',
    ground_truth: 'violating',
    violation_label: 'broken constraint',
    decision,
    reason: decision === 'REJECT' ? 'gate_block' : 'released',
    blocking_mechanisms: decision === 'REJECT' ? ['constraint'] : [],
  };
}
function realRow(
  id: string,
  gt: RealismRow['ground_truth'],
  decision: RealismRow['decision'],
  gens?: number,
): RealismRow {
  return {
    scenario_id: id,
    deliverable_type: 'config_spec',
    ground_truth: gt,
    decision,
    reason: decision === 'RELEASE' ? 'released' : 'gate_block',
    generations_to_release: gens,
  };
}

describe('contractBurden', () => {
  it('counts required_fields as fields and the rest as checks', () => {
    const b = contractBurden({
      required_fields: ['a', 'b'],
      claims: [{}],
      must_include: ['x'],
      must_not_include: ['y'],
      constraints: [{}, {}],
      freshness: { max_age_seconds: 1, requires_dated_sources: true },
    });
    expect(b.fields).toBe(2);
    // claims(1) + must_include(1) + must_not_include(1) + constraints(2) + freshness(1)
    expect(b.checks).toBe(6);
  });
});

describe('phase5Metrics — primary + sanity on curated rows', () => {
  it('computes false_release_reduction and curated_false_block correctly', () => {
    const rows: GateRow[] = [
      satRow('s1', 'RELEASE'),
      satRow('s2', 'RELEASE'),
      vioRow('s1', 'REJECT'),
      vioRow('s2', 'REJECT'),
      vioRow('s3', 'RELEASE'), // a missed false release
    ];
    const m = phase5Metrics(rows);
    expect(m.false_release_reduction.rejected).toBe(2);
    expect(m.false_release_reduction.total).toBe(3);
    expect(m.false_release_reduction.rate).toBeCloseTo(2 / 3, 6);
    expect(m.curated_false_block.blocked).toBe(0);
    expect(m.curated_false_block.total).toBe(2);
    expect(m.curated_false_block.rate).toBe(0);
  });

  it('flags spine_required when a satisfying RELEASE carried a heavy spine', () => {
    const rows: GateRow[] = [satRow('s1', 'RELEASE', true), vioRow('s1', 'REJECT')];
    const m = phase5Metrics(rows);
    expect(m.spine_required).toBe(true);
    expect(m.spine_evidence.curated_heavy_spine_scenarios).toContain('s1');
  });

  it('realism metrics are null without realism rows', () => {
    const m = phase5Metrics([satRow('s1', 'RELEASE'), vioRow('s1', 'REJECT')]);
    expect(m.realism_false_block).toBeNull();
    expect(m.natural_violation_rate).toBeNull();
  });

  it('realism metrics: natural_violation_rate excludes no_answer rows', () => {
    const gate: GateRow[] = [satRow('s1', 'RELEASE'), vioRow('s1', 'REJECT')];
    const real: RealismRow[] = [
      realRow('s1', 'satisfies_intent', 'RELEASE', 1),
      realRow('s2', 'violates', 'REJECT'),
      realRow('s3', 'no_answer', 'ERROR'),
    ];
    const m = phase5Metrics(gate, real);
    // no_answer excluded -> 1 violation / 2 gradeable.
    expect(m.natural_violation_rate!.violations).toBe(1);
    expect(m.natural_violation_rate!.total).toBe(2);
    // satisfies_intent: 1, none blocked -> realism_false_block 0.
    expect(m.realism_false_block!.blocked).toBe(0);
    expect(m.realism_false_block!.total_satisfies_intent).toBe(1);
  });
});

describe('evaluateKillRule — frozen thresholds', () => {
  // ── PASS fixture: every frozen threshold satisfied ──────────────────────────
  function passInputs() {
    const gate: GateRow[] = [];
    // 12 violating, all REJECTed -> reduction 1.0, Wilson LB > 0.
    for (let i = 0; i < 12; i++) gate.push(vioRow(`v${i}`, 'REJECT'));
    // 12 satisfying, all RELEASE, no heavy spine.
    for (let i = 0; i < 12; i++) gate.push(satRow(`s${i}`, 'RELEASE', false));
    const real: RealismRow[] = [];
    // 8 satisfies_intent, all RELEASE single-shot -> realism_false_block 0.
    for (let i = 0; i < 8; i++) real.push(realRow(`rs${i}`, 'satisfies_intent', 'RELEASE', 1));
    // 4 genuine violations -> natural_violation_rate > 0.
    for (let i = 0; i < 4; i++) real.push(realRow(`rv${i}`, 'violates', 'REJECT'));
    return { gate, real };
  }

  it('SHIP-WORTHY when reduction >= .5 (LB>0), realism_false_block <= .05, no spine, nvr > 0', () => {
    const { gate, real } = passInputs();
    const m = phase5Metrics(gate, real);
    const verdict = evaluateKillRule(m);
    expect(verdict.ship_worthy).toBe(true);
    expect(verdict.reasons).toEqual([]);
    expect(verdict.thresholds.min_reduction).toBe(FROZEN_THRESHOLDS.MIN_REDUCTION);
  });

  it('KILL when false_release_reduction is below 0.50', () => {
    const gate: GateRow[] = [];
    // 10 violating, only 4 REJECTed -> reduction 0.40 < 0.50.
    for (let i = 0; i < 4; i++) gate.push(vioRow(`r${i}`, 'REJECT'));
    for (let i = 0; i < 6; i++) gate.push(vioRow(`m${i}`, 'RELEASE'));
    for (let i = 0; i < 8; i++) gate.push(satRow(`s${i}`, 'RELEASE'));
    const real: RealismRow[] = [
      realRow('rs0', 'satisfies_intent', 'RELEASE', 1),
      realRow('rv0', 'violates', 'REJECT'),
    ];
    const m = phase5Metrics(gate, real);
    const verdict = evaluateKillRule(m);
    expect(verdict.ship_worthy).toBe(false);
    expect(verdict.reasons.some(r => r.includes('false_release_reduction'))).toBe(true);
  });

  it('KILL when realism_false_block exceeds 0.05 (the friction arm fails)', () => {
    const gate: GateRow[] = [];
    for (let i = 0; i < 12; i++) gate.push(vioRow(`v${i}`, 'REJECT'));
    for (let i = 0; i < 12; i++) gate.push(satRow(`s${i}`, 'RELEASE'));
    const real: RealismRow[] = [];
    // 9 satisfies_intent, 1 blocked -> realism_false_block ~0.111 > 0.05.
    for (let i = 0; i < 8; i++) real.push(realRow(`rs${i}`, 'satisfies_intent', 'RELEASE', 1));
    real.push(realRow('rsBlocked', 'satisfies_intent', 'REJECT'));
    real.push(realRow('rv0', 'violates', 'REJECT'));
    const m = phase5Metrics(gate, real);
    const verdict = evaluateKillRule(m);
    expect(verdict.ship_worthy).toBe(false);
    expect(verdict.reasons.some(r => r.includes('realism_false_block'))).toBe(true);
  });

  it('KILL when spine_required is true', () => {
    const gate: GateRow[] = [];
    for (let i = 0; i < 12; i++) gate.push(vioRow(`v${i}`, 'REJECT'));
    for (let i = 0; i < 11; i++) gate.push(satRow(`s${i}`, 'RELEASE', false));
    gate.push(satRow('sHeavy', 'RELEASE', true)); // needed a heavy spine
    const real: RealismRow[] = [
      realRow('rs0', 'satisfies_intent', 'RELEASE', 1),
      realRow('rv0', 'violates', 'REJECT'),
    ];
    const m = phase5Metrics(gate, real);
    const verdict = evaluateKillRule(m);
    expect(verdict.ship_worthy).toBe(false);
    expect(verdict.reasons.some(r => r.includes('spine_required'))).toBe(true);
  });

  it('KILL when natural_violation_rate is 0 (the reduction is theoretical)', () => {
    const gate: GateRow[] = [];
    for (let i = 0; i < 12; i++) gate.push(vioRow(`v${i}`, 'REJECT'));
    for (let i = 0; i < 12; i++) gate.push(satRow(`s${i}`, 'RELEASE'));
    const real: RealismRow[] = [];
    // All live deliverables satisfy -> nvr = 0.
    for (let i = 0; i < 6; i++) real.push(realRow(`rs${i}`, 'satisfies_intent', 'RELEASE', 1));
    const m = phase5Metrics(gate, real);
    const verdict = evaluateKillRule(m);
    expect(verdict.ship_worthy).toBe(false);
    expect(verdict.reasons.some(r => r.includes('natural_violation_rate'))).toBe(true);
  });

  it('KILL (cannot decide) when the realism arm has not been run', () => {
    const gate: GateRow[] = [];
    for (let i = 0; i < 12; i++) gate.push(vioRow(`v${i}`, 'REJECT'));
    for (let i = 0; i < 12; i++) gate.push(satRow(`s${i}`, 'RELEASE'));
    const m = phase5Metrics(gate); // no realism rows
    const verdict = evaluateKillRule(m);
    expect(verdict.ship_worthy).toBe(false);
    expect(verdict.reasons.some(r => r.includes('realism_false_block unavailable'))).toBe(true);
    expect(verdict.reasons.some(r => r.includes('natural_violation_rate unavailable'))).toBe(true);
  });
});
