/**
 * Phase 4 — STEP 6, Deliverable 4: REPAIR-track metrics (Amendment C, §6/§10).
 *
 * Consumes the rows the pilot runner records (repair_run.ts → repair_run.json),
 * one row per (base, arm), and computes:
 *   • repair_success_rate per arm (+ Wilson CI over rows)
 *   • changed_from_draft_rate per arm
 *   • new_defects_introduced_rate per arm — the final answer carries a DIFFERENT
 *     oracle defect than the draft's planted one (meaningful on multi-field bases
 *     only, per §6; restricted here to multi-field rows)
 *   • cluster-bootstrap CIs OVER BASES (stats.ts clusterBootstrap) for the
 *     HEADLINE per-arm repair_success and for the B-vs-C and B-vs-A differences
 *     (H5: structured/bound feedback repairs better than self-review / generic).
 *
 * The resampling unit is the BASE (not the individual row), per §2.3 / §9: an
 * effective n of distinct bases, not a fabricated count of mutants. PURE: no
 * model calls, no I/O — it reduces an in-memory rows array.
 */

import { wilsonInterval, clusterBootstrap, type Interval, type BootstrapResult } from './stats.js';
import type { Arm } from './arms.js';

/**
 * One recorded repair outcome (the runner's row schema). The metrics read only
 * the deterministic grading signals; the runner fills the rest for archival.
 */
export interface RepairRow {
  /** The base task id — the cluster (resampling) unit. */
  base: string;
  arm: Arm;
  /** gradeArmAnswer(task, finalTranscript).correct on the FINAL answer. */
  repair_success: boolean;
  /** Did the model actually alter the seeded draft (final answer != draft)? */
  changed_from_draft: boolean;
  /** Oracle reasons on the DRAFT (the planted defect's reasons). */
  planted_reasons: string[];
  /** Oracle reasons on the FINAL answer ([] when correct). */
  final_reasons: string[];
  /** True for bases where >1 field/check can carry an independent defect. */
  multi_field: boolean;
}

export interface ArmRepairMetrics {
  arm: Arm;
  n: number;
  /** correct finals / n, with Wilson 95% CI over rows. */
  repair_success_rate: number;
  repair_success_ci: [number, number];
  /** altered-draft finals / n. */
  changed_from_draft_rate: number;
  /** new-defect finals / multi-field n (NaN-safe: 0 when no multi-field rows). */
  new_defects_introduced_rate: number;
  new_defects_n: number;
  /** Cluster-bootstrap (over bases) CI for the headline repair_success_rate. */
  repair_success_bootstrap: BootstrapResult;
}

export interface RepairMetricsReport {
  per_arm: Record<string, ArmRepairMetrics>;
  /** Cluster-bootstrap (over bases) CI for repair_success(B) − repair_success(C). */
  b_vs_c_diff: BootstrapResult | null;
  /** Cluster-bootstrap (over bases) CI for repair_success(B) − repair_success(A). */
  b_vs_a_diff: BootstrapResult | null;
}

/**
 * A final answer carries a NEW defect iff it is not correct AND at least one of
 * its oracle reasons is NOT one of the draft's planted reasons (the model changed
 * or cleared the original defect but a DIFFERENT oracle defect now fires).
 */
export function hasNewDefect(row: RepairRow): boolean {
  if (row.repair_success) return false;
  const planted = new Set(row.planted_reasons);
  return row.final_reasons.some(r => !planted.has(r));
}

function successRate(rows: RepairRow[]): number {
  if (rows.length === 0) return 0;
  return rows.filter(r => r.repair_success).length / rows.length;
}

/** Group rows by base id (the cluster), preserving insertion order of bases. */
function clustersByBase(rows: RepairRow[]): RepairRow[][] {
  const byBase = new Map<string, RepairRow[]>();
  for (const r of rows) {
    const g = byBase.get(r.base);
    if (g) g.push(r);
    else byBase.set(r.base, [r]);
  }
  return [...byBase.values()];
}

function armMetrics(arm: Arm, rows: RepairRow[]): ArmRepairMetrics {
  const armRows = rows.filter(r => r.arm === arm);
  const n = armRows.length;
  const successes = armRows.filter(r => r.repair_success).length;
  const w: Interval = wilsonInterval(successes, n);

  const multiField = armRows.filter(r => r.multi_field);
  const newDefects = multiField.filter(hasNewDefect).length;

  const clusters = clustersByBase(armRows);
  const repair_success_bootstrap =
    clusters.length > 0
      ? clusterBootstrap(clusters, successRate)
      : { point: 0, lower: 0, upper: 0, iters: 0 };

  return {
    arm,
    n,
    repair_success_rate: n === 0 ? 0 : successes / n,
    repair_success_ci: [w.lower, w.upper],
    changed_from_draft_rate: n === 0 ? 0 : armRows.filter(r => r.changed_from_draft).length / n,
    new_defects_introduced_rate: multiField.length === 0 ? 0 : newDefects / multiField.length,
    new_defects_n: multiField.length,
    repair_success_bootstrap,
  };
}

/**
 * Cluster-bootstrap (over bases) the DIFFERENCE repair_success(armX) −
 * repair_success(armY). Each cluster is one base carrying BOTH arms' rows for
 * that base, so resampling whole bases honours the paired structure. Returns null
 * when either arm has no rows.
 */
function diffBootstrap(rows: RepairRow[], armX: Arm, armY: Arm): BootstrapResult | null {
  const relevant = rows.filter(r => r.arm === armX || r.arm === armY);
  if (!relevant.some(r => r.arm === armX) || !relevant.some(r => r.arm === armY)) {
    return null;
  }
  const clusters = clustersByBase(relevant);
  const stat = (flat: RepairRow[]): number =>
    successRate(flat.filter(r => r.arm === armX)) - successRate(flat.filter(r => r.arm === armY));
  return clusterBootstrap(clusters, stat);
}

/** Compute the full per-arm + paired-difference repair metrics over the rows. */
export function repairMetrics(rows: RepairRow[]): RepairMetricsReport {
  const arms = [...new Set(rows.map(r => r.arm))] as Arm[];
  const per_arm: Record<string, ArmRepairMetrics> = {};
  for (const arm of arms) {
    per_arm[arm] = armMetrics(arm, rows);
  }
  return {
    per_arm,
    b_vs_c_diff: diffBootstrap(rows, 'B', 'C'),
    b_vs_a_diff: diffBootstrap(rows, 'B', 'A'),
  };
}
