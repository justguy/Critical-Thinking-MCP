/**
 * Phase 5 — the curated gate via the REAL host path.
 *
 * Pre-registration: PHASE5_PREREGISTRATION.md §5. This calls enforceDeliverable
 * (src/host/enforcement_host.ts) DIRECTLY — the same deterministic gate the CLI
 * wraps — so no CLI spawn is needed in-test. It asserts:
 *   - every VIOLATING deliverable REJECTs (this encodes false_release_reduction =
 *     the gate AGREEING with the gate-independent ground truth on would-be false
 *     releases), and
 *   - whether each SATISFYING deliverable RELEASEs is RECORDED (a satisfying block
 *     is surfaced as a FRICTION finding, NOT a hard failure — per the prereg the
 *     friction arm can genuinely fail and that is a measured outcome).
 *
 * strict_release is left at its default true (the real ship path; the contract is
 * host-authored so host_anchored is satisfied). NO model / claude-CLI calls.
 */

import { describe, it, expect } from 'vitest';

import { PHASE5_SCENARIOS } from '../../benchmark/phase5/scenarios.js';
import {
  enforceDeliverable,
  type ReleaseDecision,
} from '../../src/host/enforcement_host.js';

function gate(scenario: (typeof PHASE5_SCENARIOS)[number], artifacts: any): ReleaseDecision {
  return enforceDeliverable(scenario.host_contract, artifacts, {
    eval_time: scenario.eval_time,
  });
}

describe('Phase 5 curated gate — violating deliverables REJECT (false_release_reduction)', () => {
  for (const s of PHASE5_SCENARIOS) {
    for (const v of s.violating) {
      it(`${s.id}: REJECTs "${v.violation_label}"`, () => {
        const decision = gate(s, v.artifacts);
        expect(decision.decision).toBe('REJECT');
        // Every REJECT carries at least one blocking issue.
        expect(decision.blocking_issues.length).toBeGreaterThan(0);
      });
    }
  }

  it('catches 100% of the would-be false releases (block-recall on the violating set)', () => {
    let total = 0;
    let rejected = 0;
    for (const s of PHASE5_SCENARIOS) {
      for (const v of s.violating) {
        total += 1;
        if (gate(s, v.artifacts).decision === 'REJECT') rejected += 1;
      }
    }
    expect(total).toBeGreaterThan(0);
    // The frozen kill rule needs >= 0.50; the corpus is built to catch all of them.
    expect(rejected / total).toBeGreaterThanOrEqual(0.5);
    expect(rejected).toBe(total);
  });
});

describe('Phase 5 curated gate — satisfying deliverables (RECORD, do not hard-fail)', () => {
  it('records the curated false-block set as a friction finding', () => {
    const blocked: Array<{ id: string; reason: string; mechanisms: string[] }> = [];
    let released = 0;
    for (const s of PHASE5_SCENARIOS) {
      const d = gate(s, s.satisfying);
      if (d.decision === 'RELEASE') {
        released += 1;
      } else {
        blocked.push({
          id: s.id,
          reason: d.reason,
          mechanisms: d.blocking_issues.map(i => i.mechanism),
        });
      }
    }
    // Surface the friction set (visible in the test reporter); NOT an assertion
    // failure — a satisfying block is a measured friction outcome, not a test bug.
    if (blocked.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[phase5 friction] ${blocked.length}/${PHASE5_SCENARIOS.length} satisfying deliverables blocked:\n` +
          blocked.map(b => `  - ${b.id} (${b.reason}): ${b.mechanisms.join(', ')}`).join('\n'),
      );
    }
    // Sanity floor: this corpus is authored so satisfying deliverables RELEASE.
    // If this regresses to a wholesale block, that is itself the friction finding.
    expect(released).toBeGreaterThan(0);
  });

  // After applying HOST_CONTRACT_AUTHORING.md, EVERY satisfying deliverable RELEASEs:
  // curated_false_block is 0. (Was a friction finding when fin_numeric_dag was a
  // numeric_analysis+rederived contract; now a == constraint, spine-free.)
  it('every satisfying deliverable RELEASEs (curated_false_block = 0)', () => {
    const blocked = PHASE5_SCENARIOS.filter(s => gate(s, s.satisfying).decision !== 'RELEASE');
    expect(
      blocked.map(s => s.id),
      `satisfying deliverables wrongly blocked: ${blocked.map(s => s.id).join(', ')}`,
    ).toEqual([]);
  });

  // The whole corpus is now spine-free: NO scenario flags a heavy numeric-derivation
  // DAG spine to clear the gate (spine_required -> false in the kill rule).
  it('no scenario requires a heavy artifact spine', () => {
    const spined = PHASE5_SCENARIOS.filter(s => s.heavy_artifact_spine === true);
    expect(spined.map(s => s.id)).toEqual([]);
  });
});

describe('Phase 5 curated gate — re-authored fin_numeric_dag (== constraint, spine-free)', () => {
  const dag = PHASE5_SCENARIOS.find(s => s.id === 'fin_numeric_dag');

  it('exists and is authored as a == constraint, not a rederived numeric trace', () => {
    expect(dag).toBeDefined();
    expect(dag!.host_contract.evidence_level).not.toBe('rederived');
    expect(dag!.host_contract.task_type).not.toBe('numeric_analysis');
    expect(dag!.host_contract.constraints).toEqual([
      { field: 'total_expenses', op: '==', value: 22600, source_quote: 'must equal 22600' },
    ]);
    expect(dag!.heavy_artifact_spine).toBe(false);
  });

  it('satisfying RELEASEs through the REAL gate with NO DAG / arithmetic_checks spine', () => {
    // The satisfying deliverable carries none of the heavy-spine artifacts.
    expect(dag!.satisfying.numeric_derivation).toBeUndefined();
    expect(dag!.satisfying.arithmetic_checks).toBeUndefined();
    const d = gate(dag!, dag!.satisfying);
    expect(d.decision, `blocked: ${d.blocking_issues.map(i => i.mechanism).join(', ')}`).toBe(
      'RELEASE',
    );
  });

  it('violating (wrong total) still REJECTs — catch rate preserved', () => {
    for (const v of dag!.violating) {
      const d = gate(dag!, v.artifacts);
      expect(d.decision).toBe('REJECT');
      expect(d.blocking_issues.length).toBeGreaterThan(0);
    }
  });
});
