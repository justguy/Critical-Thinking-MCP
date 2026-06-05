/**
 * Phase 5 — metrics + the FROZEN kill-rule evaluation.
 *
 * Pre-registration: docs/designs/PHASE5_PREREGISTRATION.md §3 (metrics), §4
 * (hypotheses), §6/§8 (the mechanical kill rule). PURE functions — no model
 * calls, no I/O. Wilson CIs come from the Phase-4 stats library (the one CI
 * library the program names); no statistic is invented here.
 *
 * The kill rule is read ONLY against the frozen thresholds — no goalpost moving:
 *
 *   SHIP-WORTHY  iff   false_release_reduction >= 0.50
 *                AND   Wilson 95% lower bound of the reduction > 0
 *                AND   realism_false_block <= 0.05
 *                AND   spine_required == false
 *                AND   natural_violation_rate > 0
 *   otherwise    KILL / ARCHIVE  (with the failing reason(s) recorded).
 *
 * Note on the two false-block measures:
 *   - `curated_false_block` is the SANITY measure on the hand-authored satisfying
 *     deliverables (run_gate.ts). It is reported, but it is NOT the kill-rule input.
 *   - `realism_false_block` is the REAL friction input (run_realism.ts): good-faith
 *     LIVE deliverables that satisfy the contract's intent yet the gate REJECTs.
 *     The kill rule consumes THIS. When the realism arm has not been run, the
 *     kill rule cannot pass H2's friction arm and reports `realism_arm_missing`.
 */

import { wilsonInterval, proportionReport } from '../phase4/stats.js';

/** One curated gate row: a (contract, deliverable) pair through the real ct-enforce. */
export interface GateRow {
  scenario_id: string;
  deliverable_type: string;
  /** 'satisfying' or 'violating' — the GROUND-TRUTH class (independent of the gate). */
  ground_truth: 'satisfying' | 'violating';
  /** The label of the broken requirement (violating rows only). */
  violation_label?: string;
  /** The gate's decision. */
  decision: 'RELEASE' | 'REJECT' | 'ERROR';
  /** The gate's reason / blocking code. */
  reason: string;
  /** The blocking mechanisms returned by the gate (for the per-row audit). */
  blocking_mechanisms: string[];
  /** True when the satisfying deliverable needed a heavy artifact spine to clear. */
  heavy_artifact_spine?: boolean;
}

/** One live-realism row: a model-produced single-shot deliverable through the gate. */
export interface RealismRow {
  scenario_id: string;
  deliverable_type: string;
  /**
   * GROUND-TRUTH grade of the LIVE deliverable's artifacts against the host
   * contract, computed INDEPENDENTLY of the gate. 'satisfies_intent' = the
   * deliverable genuinely meets the contract; 'violates' = it genuinely breaks it;
   * 'no_answer' = the model produced no usable deliverable.
   */
  ground_truth: 'satisfies_intent' | 'violates' | 'no_answer';
  /** The gate's decision on the live deliverable. */
  decision: 'RELEASE' | 'REJECT' | 'ERROR';
  reason: string;
  /** Generations needed to reach RELEASE (1 = single-shot; >1 = a spine was used). */
  generations_to_release?: number;
}

export interface Phase5Metrics {
  scenario_count: number;
  // ── Primary: false-release reduction (block-recall on the violating set) ──
  false_release_reduction: {
    rate: number;
    ci: [number, number];
    rejected: number;
    total: number;
  };
  // ── Sanity: curated false-block on the hand-authored satisfying set ──
  curated_false_block: {
    rate: number;
    ci: [number, number];
    blocked: number;
    total: number;
    /** The satisfying scenario ids the gate wrongly REJECTed (friction surfacing). */
    blocked_ids: string[];
  };
  // ── Friction (the kill-rule input) — present only when the realism arm ran ──
  realism_false_block: {
    rate: number;
    ci: [number, number];
    blocked: number;
    total_satisfies_intent: number;
  } | null;
  natural_violation_rate: {
    rate: number;
    ci: [number, number];
    violations: number;
    total: number;
  } | null;
  // ── spine_required: did ANY scenario need a heavy spine / >1 generation? ──
  spine_required: boolean;
  /** Provenance of the spine_required signal. */
  spine_evidence: {
    curated_heavy_spine_scenarios: string[];
    realism_multi_generation_scenarios: string[];
  };
  // ── host-contract authoring burden (proxy for adoption cost) ──
  host_contract_burden: {
    avg_fields_per_contract: number;
    avg_checks_per_contract: number;
  };
}

interface ContractLike {
  claims?: unknown[];
  must_include?: unknown[];
  must_not_include?: unknown[];
  required_fields?: unknown[];
  constraints?: unknown[];
  freshness?: unknown;
}

/** Count the host-authored obligation surface of one contract (the burden proxy). */
export function contractBurden(contract: ContractLike): { fields: number; checks: number } {
  const fields = contract.required_fields?.length ?? 0;
  const checks =
    (contract.claims?.length ?? 0) +
    (contract.must_include?.length ?? 0) +
    (contract.must_not_include?.length ?? 0) +
    (contract.constraints?.length ?? 0) +
    (contract.freshness ? 1 : 0);
  return { fields, checks };
}

/**
 * Compute the §3 metrics from curated gate rows and (optionally) live-realism rows.
 * Pure: it derives everything from the supplied rows. The realism-derived metrics
 * are null when no realism rows are supplied (the arm was built but not run).
 */
export function phase5Metrics(
  gateRows: GateRow[],
  realismRows?: RealismRow[],
  contracts?: ContractLike[],
): Phase5Metrics {
  const violating = gateRows.filter(r => r.ground_truth === 'violating');
  const satisfying = gateRows.filter(r => r.ground_truth === 'satisfying');

  // Primary: fraction of would-be false releases the gate caught (REJECTed).
  const rejected = violating.filter(r => r.decision === 'REJECT').length;
  const reductionW = wilsonInterval(rejected, violating.length);

  // Sanity: satisfying deliverables the gate wrongly REJECTed.
  const blocked = satisfying.filter(r => r.decision !== 'RELEASE');
  const curatedW = wilsonInterval(blocked.length, satisfying.length);

  // Friction (kill-rule input): live good-faith deliverables that satisfy the
  // contract's intent but the gate REJECTed.
  let realism_false_block: Phase5Metrics['realism_false_block'] = null;
  let natural_violation_rate: Phase5Metrics['natural_violation_rate'] = null;
  const realismMultiGen: string[] = [];
  if (realismRows && realismRows.length > 0) {
    const satisfiesIntent = realismRows.filter(r => r.ground_truth === 'satisfies_intent');
    const falseBlocked = satisfiesIntent.filter(r => r.decision !== 'RELEASE');
    const rfbW = wilsonInterval(falseBlocked.length, satisfiesIntent.length);
    realism_false_block = {
      rate: rfbW.point,
      ci: [rfbW.lower, rfbW.upper],
      blocked: falseBlocked.length,
      total_satisfies_intent: satisfiesIntent.length,
    };

    // natural_violation_rate: live deliverables whose artifacts violate the host
    // contract (graded by GROUND TRUTH). A no_answer is NOT a contract violation
    // of the catchable kind — exclude it from both numerator and denominator so
    // the rate measures the real defect opportunity, not delivery failure.
    const gradeable = realismRows.filter(r => r.ground_truth !== 'no_answer');
    const nvViolations = gradeable.filter(r => r.ground_truth === 'violates').length;
    const nvW = wilsonInterval(nvViolations, gradeable.length);
    natural_violation_rate = {
      rate: nvW.point,
      ci: [nvW.lower, nvW.upper],
      violations: nvViolations,
      total: gradeable.length,
    };

    for (const r of realismRows) {
      if ((r.generations_to_release ?? 1) > 1) realismMultiGen.push(r.scenario_id);
    }
  }

  // spine_required: a satisfying deliverable needed a heavy artifact spine to clear
  // the curated gate, OR a live deliverable needed >1 generation to RELEASE.
  const curatedHeavy = satisfying
    .filter(r => r.heavy_artifact_spine === true && r.decision === 'RELEASE')
    .map(r => r.scenario_id);
  const spine_required = curatedHeavy.length > 0 || realismMultiGen.length > 0;

  // Host-contract burden.
  const burdenContracts = contracts ?? [];
  let avg_fields = 0;
  let avg_checks = 0;
  if (burdenContracts.length > 0) {
    let sumF = 0;
    let sumC = 0;
    for (const c of burdenContracts) {
      const b = contractBurden(c);
      sumF += b.fields;
      sumC += b.checks;
    }
    avg_fields = sumF / burdenContracts.length;
    avg_checks = sumC / burdenContracts.length;
  }

  const curatedReport = proportionReport(blocked.length, satisfying.length);

  return {
    scenario_count: new Set(gateRows.map(r => r.scenario_id)).size,
    false_release_reduction: {
      rate: reductionW.point,
      ci: [reductionW.lower, reductionW.upper],
      rejected,
      total: violating.length,
    },
    curated_false_block: {
      rate: curatedReport.rate,
      ci: curatedReport.ci,
      blocked: blocked.length,
      total: satisfying.length,
      blocked_ids: blocked.map(r => r.scenario_id),
    },
    realism_false_block,
    natural_violation_rate,
    spine_required,
    spine_evidence: {
      curated_heavy_spine_scenarios: curatedHeavy,
      realism_multi_generation_scenarios: realismMultiGen,
    },
    host_contract_burden: {
      avg_fields_per_contract: avg_fields,
      avg_checks_per_contract: avg_checks,
    },
  };
}

export interface KillRuleVerdict {
  ship_worthy: boolean;
  /** The reasons a SHIP fails (empty when ship_worthy is true). */
  reasons: string[];
  /** The frozen thresholds, echoed for the audit record. */
  thresholds: {
    min_reduction: number;
    reduction_wilson_lower_must_exceed: number;
    max_realism_false_block: number;
    spine_required_must_be: boolean;
    min_natural_violation_rate: number;
  };
}

/** The FROZEN thresholds (PHASE5_PREREGISTRATION.md §6/§8). */
export const FROZEN_THRESHOLDS = {
  MIN_REDUCTION: 0.5,
  REDUCTION_WILSON_LOWER_FLOOR: 0,
  MAX_REALISM_FALSE_BLOCK: 0.05,
  SPINE_REQUIRED_MUST_BE: false,
  MIN_NATURAL_VIOLATION_RATE: 0,
} as const;

/**
 * Apply the frozen kill rule mechanically. The decision is read ONLY against the
 * frozen thresholds — there is no goalpost-moving here.
 */
export function evaluateKillRule(metrics: Phase5Metrics): KillRuleVerdict {
  const reasons: string[] = [];

  // H1 — false-release reduction.
  if (metrics.false_release_reduction.rate < FROZEN_THRESHOLDS.MIN_REDUCTION) {
    reasons.push(
      `false_release_reduction ${metrics.false_release_reduction.rate.toFixed(3)} < ${FROZEN_THRESHOLDS.MIN_REDUCTION}`,
    );
  }
  if (metrics.false_release_reduction.ci[0] <= FROZEN_THRESHOLDS.REDUCTION_WILSON_LOWER_FLOOR) {
    reasons.push(
      `false_release_reduction Wilson lower bound ${metrics.false_release_reduction.ci[0].toFixed(3)} ` +
        `<= ${FROZEN_THRESHOLDS.REDUCTION_WILSON_LOWER_FLOOR}`,
    );
  }

  // H3 — the defect opportunity must be real (natural_violation_rate > 0).
  if (metrics.natural_violation_rate === null) {
    reasons.push('natural_violation_rate unavailable: the live-realism arm has not been run');
  } else if (metrics.natural_violation_rate.rate <= FROZEN_THRESHOLDS.MIN_NATURAL_VIOLATION_RATE) {
    reasons.push(
      `natural_violation_rate ${metrics.natural_violation_rate.rate.toFixed(3)} ` +
        `<= ${FROZEN_THRESHOLDS.MIN_NATURAL_VIOLATION_RATE}: the reduction is theoretical`,
    );
  }

  // H2 — friction: realism_false_block <= 0.05 AND spine_required == false.
  if (metrics.realism_false_block === null) {
    reasons.push('realism_false_block unavailable: the live-realism arm has not been run');
  } else if (metrics.realism_false_block.rate > FROZEN_THRESHOLDS.MAX_REALISM_FALSE_BLOCK) {
    reasons.push(
      `realism_false_block ${metrics.realism_false_block.rate.toFixed(3)} > ${FROZEN_THRESHOLDS.MAX_REALISM_FALSE_BLOCK}`,
    );
  }
  if (metrics.spine_required !== FROZEN_THRESHOLDS.SPINE_REQUIRED_MUST_BE) {
    reasons.push(
      `spine_required is ${metrics.spine_required}; single-call ct-enforce required a heavy artifact spine`,
    );
  }

  return {
    ship_worthy: reasons.length === 0,
    reasons,
    thresholds: {
      min_reduction: FROZEN_THRESHOLDS.MIN_REDUCTION,
      reduction_wilson_lower_must_exceed: FROZEN_THRESHOLDS.REDUCTION_WILSON_LOWER_FLOOR,
      max_realism_false_block: FROZEN_THRESHOLDS.MAX_REALISM_FALSE_BLOCK,
      spine_required_must_be: FROZEN_THRESHOLDS.SPINE_REQUIRED_MUST_BE,
      min_natural_violation_rate: FROZEN_THRESHOLDS.MIN_NATURAL_VIOLATION_RATE,
    },
  };
}
