import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  collectCalibrationMetricObservations,
  normaliseToolCombo,
} from './calibration.js';
import type {
  AdaptiveMetricGateOverride,
  CalibrationProfile,
  CalibrationRuntimeContext,
  OrchestratorResult,
  OrchestratorToolName,
} from './types.js';

interface AggregateRow {
  sample_count: number;
  mean_value: number;
  min_value: number;
  max_value: number;
}

interface ColumnInfo {
  name: string;
}

export interface RecordCalibrationRunInput {
  db_path: string;
  runtime: CalibrationRuntimeContext;
  profile: CalibrationProfile;
  result: OrchestratorResult;
}

export interface HistoricalTurn3Stats {
  sample_count: number;
  released_count: number;
  human_review_count: number;
  success_rate: number;
  mean_delta_from_prior_turn: number | null;
}

export interface ReleasedMetricWindowStats {
  sample_count: number;
  mean_value: number | null;
  stddev_value: number | null;
  min_value: number | null;
  max_value: number | null;
  recommended_min_threshold: number | null;
  recommended_max_threshold: number | null;
  window_days: number;
}

export interface TurnSalvageStats {
  paired_chain_count: number;
  turn_1_released_count: number;
  turn_2_released_count: number;
  eligible_turn_1_failure_count: number;
  salvage_count: number;
  salvage_rate: number;
  mean_metric_delta: number | null;
}

export interface ToolRedundancyRecommendation {
  anchor_tool: OrchestratorToolName;
  candidate_tool: OrchestratorToolName;
  paired_run_count: number;
  anchor_signal_count: number;
  candidate_signal_count: number;
  candidate_independent_signal_count: number;
  candidate_independent_signal_rate: number;
}

interface MetricSampleRow {
  metric_value: number;
}

interface TurnChainRow {
  turn_chain_id: string;
  iteration_number: number;
  released: number;
  selected_metric_value: number | null;
  delta_from_prior_turn: number | null;
}

interface ToolSignalMetricRow {
  run_id: number;
  tool_name: OrchestratorToolName;
  metric_value: number;
}

type SqliteRow = Record<string, unknown>;

interface GateAdaptationMapping {
  tool: OrchestratorToolName;
  gate_key: string;
  metric_name: string;
  comparator: '>=' | '<=';
}

interface AdaptCalibrationProfileFromHistoryInput {
  db_path: string;
  runtime: CalibrationRuntimeContext;
  profile: CalibrationProfile;
  window_days?: number;
  minimum_sample_count?: number;
  sigma_multiplier?: number;
}

export interface AdaptCalibrationProfileFromHistoryResult {
  profile: CalibrationProfile;
  adaptive_metric_overrides: AdaptiveMetricGateOverride[];
}

const ADAPTIVE_GATE_MAPPINGS: GateAdaptationMapping[] = [
  {
    tool: 'validate_confidence',
    gate_key: 'max_gap',
    metric_name: 'gap',
    comparator: '<=',
  },
  {
    tool: 'validate_confidence',
    gate_key: 'min_falsifiability_score',
    metric_name: 'falsifiability_score',
    comparator: '>=',
  },
  {
    tool: 'validate_reasoning_chain',
    gate_key: 'min_grounding_score',
    metric_name: 'grounding_score',
    comparator: '>=',
  },
  {
    tool: 'validate_reasoning_chain',
    gate_key: 'max_cycle_count',
    metric_name: 'cycle_count',
    comparator: '<=',
  },
  {
    tool: 'validate_reasoning_chain',
    gate_key: 'max_orphaned_conclusions',
    metric_name: 'orphaned_conclusion_count',
    comparator: '<=',
  },
  {
    tool: 'check_plan_validity',
    gate_key: 'min_completeness_score',
    metric_name: 'completeness_score',
    comparator: '>=',
  },
  {
    tool: 'check_plan_validity',
    gate_key: 'max_circular_dependencies',
    metric_name: 'circular_dependency_count',
    comparator: '<=',
  },
  {
    tool: 'check_plan_validity',
    gate_key: 'max_missing_prerequisites',
    metric_name: 'missing_prerequisite_count',
    comparator: '<=',
  },
  {
    tool: 'check_plan_validity',
    gate_key: 'max_resource_conflicts',
    metric_name: 'resource_conflict_count',
    comparator: '<=',
  },
  {
    tool: 'detect_concurrency_patterns',
    gate_key: 'max_hazard_count',
    metric_name: 'hazard_count',
    comparator: '<=',
  },
  {
    tool: 'detect_concurrency_patterns',
    gate_key: 'max_critical_count',
    metric_name: 'critical_count',
    comparator: '<=',
  },
  {
    tool: 'score_response_quality',
    gate_key: 'min_overall_score',
    metric_name: 'overall_score',
    comparator: '>=',
  },
  {
    tool: 'score_response_quality',
    gate_key: 'min_substance_score',
    metric_name: 'substance_score',
    comparator: '>=',
  },
  {
    tool: 'score_response_quality',
    gate_key: 'min_specificity_score',
    metric_name: 'specificity_score',
    comparator: '>=',
  },
  {
    tool: 'score_response_quality',
    gate_key: 'min_structure_score',
    metric_name: 'structure_score',
    comparator: '>=',
  },
  {
    tool: 'score_response_quality',
    gate_key: 'max_hedge_density',
    metric_name: 'hedge_density',
    comparator: '<=',
  },
];

function ensureSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS orchestrator_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_family TEXT NOT NULL,
      session_mode TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      orchestrator_mode TEXT NOT NULL,
      policy_decision TEXT NOT NULL,
      iteration_number INTEGER NOT NULL,
      session_depth INTEGER NOT NULL DEFAULT 1,
      warning_route_revision_threshold INTEGER NOT NULL,
      routed_tool_count INTEGER NOT NULL,
      shadow_tool_count INTEGER NOT NULL,
      schema_failure_count INTEGER NOT NULL,
      would_have_escalated INTEGER NOT NULL,
      metric_gate_failure_count INTEGER NOT NULL,
      tool_combo TEXT NOT NULL,
      revised INTEGER NOT NULL,
      human_review INTEGER NOT NULL,
      turn_chain_id TEXT,
      selected_metric_tool TEXT,
      selected_metric_name TEXT,
      selected_metric_value REAL,
      selected_metric_threshold REAL,
      delta_from_prior_turn REAL,
      released INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orchestrator_metrics (
      run_id INTEGER NOT NULL,
      scope TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      FOREIGN KEY(run_id) REFERENCES orchestrator_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_lookup
      ON orchestrator_runs(model, prompt_family, session_mode, profile_id, recorded_at);

    CREATE INDEX IF NOT EXISTS idx_orchestrator_metrics_run
      ON orchestrator_metrics(run_id);

    CREATE TABLE IF NOT EXISTS daily_metric_aggregates (
      bucket_date TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_family TEXT NOT NULL,
      session_mode TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      sample_count INTEGER NOT NULL,
      mean_value REAL NOT NULL,
      min_value REAL NOT NULL,
      max_value REAL NOT NULL,
      PRIMARY KEY (
        bucket_date,
        model,
        prompt_family,
        session_mode,
        profile_id,
        scope,
        tool_name,
        metric_name
      )
    );
  `);

  const existingColumns = new Set(
    (
      db.prepare('PRAGMA table_info(orchestrator_runs)').all() as unknown as ColumnInfo[]
    ).map(column => column.name),
  );
  const missingColumnStatements: Array<[string, string]> = [
    ['turn_chain_id', 'ALTER TABLE orchestrator_runs ADD COLUMN turn_chain_id TEXT'],
    ['selected_metric_tool', 'ALTER TABLE orchestrator_runs ADD COLUMN selected_metric_tool TEXT'],
    ['selected_metric_name', 'ALTER TABLE orchestrator_runs ADD COLUMN selected_metric_name TEXT'],
    ['selected_metric_value', 'ALTER TABLE orchestrator_runs ADD COLUMN selected_metric_value REAL'],
    ['selected_metric_threshold', 'ALTER TABLE orchestrator_runs ADD COLUMN selected_metric_threshold REAL'],
    ['delta_from_prior_turn', 'ALTER TABLE orchestrator_runs ADD COLUMN delta_from_prior_turn REAL'],
    ['released', 'ALTER TABLE orchestrator_runs ADD COLUMN released INTEGER NOT NULL DEFAULT 0'],
    ['session_depth', 'ALTER TABLE orchestrator_runs ADD COLUMN session_depth INTEGER NOT NULL DEFAULT 1'],
  ];

  for (const [columnName, statement] of missingColumnStatements) {
    if (!existingColumns.has(columnName)) {
      db.exec(statement);
    }
  }
}

function computeMean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeStddev(values: number[], mean: number): number | null {
  if (values.length === 0) return null;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function roundMetric(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function asSqliteRows(value: unknown): SqliteRow[] {
  return value as SqliteRow[];
}

function toFiniteNumber(value: unknown): number | null {
  const candidate = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(candidate) ? candidate : null;
}

function deriveReleasedLabel(
  runtime: CalibrationRuntimeContext,
  result: OrchestratorResult,
): number {
  if (typeof runtime.released === 'boolean') {
    return runtime.released ? 1 : 0;
  }
  return result.policy_decision === 'PASS' || result.policy_decision === 'WARN'
    ? 1
    : 0;
}

function pruneRawRuns(
  db: DatabaseSync,
  retainDays: number,
): void {
  const cutoff = new Date(
    Date.now() - retainDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const staleRunIds = db
    .prepare(
      `
        SELECT id
        FROM orchestrator_runs
        WHERE recorded_at < ?
      `,
    )
    .all(cutoff) as Array<{ id: number }>;

  const deleteMetrics = db.prepare(`
    DELETE FROM orchestrator_metrics
    WHERE run_id = ?
  `);
  const deleteRun = db.prepare(`
    DELETE FROM orchestrator_runs
    WHERE id = ?
  `);

  for (const row of staleRunIds) {
    deleteMetrics.run(row.id);
    deleteRun.run(row.id);
  }
}

function upsertDailyAggregate(
  db: DatabaseSync,
  params: {
    bucket_date: string;
    model: string;
    prompt_family: string;
    session_mode: string;
    profile_id: string;
    scope: string;
    tool_name: string;
    metric_name: string;
    metric_value: number;
  },
): void {
  const lookup = db
    .prepare(
      `
        SELECT sample_count, mean_value, min_value, max_value
        FROM daily_metric_aggregates
        WHERE bucket_date = ?
          AND model = ?
          AND prompt_family = ?
          AND session_mode = ?
          AND profile_id = ?
          AND scope = ?
          AND tool_name = ?
          AND metric_name = ?
      `,
    )
    .get(
      params.bucket_date,
      params.model,
      params.prompt_family,
      params.session_mode,
      params.profile_id,
      params.scope,
      params.tool_name,
      params.metric_name,
    ) as AggregateRow | undefined;

  if (!lookup) {
    db.prepare(
      `
        INSERT INTO daily_metric_aggregates (
          bucket_date,
          model,
          prompt_family,
          session_mode,
          profile_id,
          scope,
          tool_name,
          metric_name,
          sample_count,
          mean_value,
          min_value,
          max_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `,
    ).run(
      params.bucket_date,
      params.model,
      params.prompt_family,
      params.session_mode,
      params.profile_id,
      params.scope,
      params.tool_name,
      params.metric_name,
      params.metric_value,
      params.metric_value,
      params.metric_value,
    );
    return;
  }

  const nextCount = lookup.sample_count + 1;
  const nextMean =
    (lookup.mean_value * lookup.sample_count + params.metric_value) / nextCount;
  const nextMin = Math.min(lookup.min_value, params.metric_value);
  const nextMax = Math.max(lookup.max_value, params.metric_value);

  db.prepare(
    `
      UPDATE daily_metric_aggregates
      SET sample_count = ?,
          mean_value = ?,
          min_value = ?,
          max_value = ?
      WHERE bucket_date = ?
        AND model = ?
        AND prompt_family = ?
        AND session_mode = ?
        AND profile_id = ?
        AND scope = ?
        AND tool_name = ?
        AND metric_name = ?
    `,
  ).run(
    nextCount,
    nextMean,
    nextMin,
    nextMax,
    params.bucket_date,
    params.model,
    params.prompt_family,
    params.session_mode,
    params.profile_id,
    params.scope,
    params.tool_name,
    params.metric_name,
  );
}

export function recordCalibrationRun(
  input: RecordCalibrationRunInput,
): number {
  mkdirSync(dirname(input.db_path), { recursive: true });
  const db = new DatabaseSync(input.db_path);

  try {
    ensureSchema(db);
    db.exec('BEGIN');

    const recordedAt = new Date().toISOString();
    const promptFamily = input.runtime.prompt_family ?? 'operational_claim';
    const toolCombo = normaliseToolCombo(input.result);
    const revised = input.result.policy_decision === 'REVISE' ? 1 : 0;
    const humanReview = input.result.policy_decision === 'HUMAN_REVIEW' ? 1 : 0;
    const released = deriveReleasedLabel(input.runtime, input.result);

    const runInfo = db
      .prepare(
        `
          INSERT INTO orchestrator_runs (
            recorded_at,
            model,
            prompt_family,
            session_mode,
            profile_id,
            orchestrator_mode,
            policy_decision,
            iteration_number,
            session_depth,
            warning_route_revision_threshold,
            routed_tool_count,
            shadow_tool_count,
            schema_failure_count,
            would_have_escalated,
            metric_gate_failure_count,
            tool_combo,
            revised,
            human_review,
            turn_chain_id,
            selected_metric_tool,
            selected_metric_name,
            selected_metric_value,
            selected_metric_threshold,
            delta_from_prior_turn,
            released
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        recordedAt,
        input.runtime.model,
        promptFamily,
        input.runtime.session_mode,
        input.profile.profile_id,
        input.result.mode,
        input.result.policy_decision,
        input.result.telemetry.iteration_number,
        input.runtime.session_depth ?? 1,
        input.profile.warning_route_revision_threshold,
        input.result.telemetry.routed_tools.length,
        input.result.telemetry.tools_executed_only_in_shadow.length,
        input.result.telemetry.schema_failures.length,
        input.result.telemetry.would_have_escalated ? 1 : 0,
        input.result.calibration?.metric_gate_failures.length ?? 0,
        toolCombo,
        revised,
        humanReview,
        input.runtime.turn_chain_id ?? null,
        input.runtime.selected_metric_tool ?? null,
        input.runtime.selected_metric_name ?? null,
        input.runtime.selected_metric_value ?? null,
        input.runtime.selected_metric_threshold ?? null,
        input.runtime.delta_from_prior_turn ?? null,
        released,
      );

    const runId = Number(runInfo.lastInsertRowid);
    const observations = collectCalibrationMetricObservations(input.result);
    const insertMetric = db.prepare(
      `
        INSERT INTO orchestrator_metrics (
          run_id,
          scope,
          tool_name,
          metric_name,
          metric_value
        ) VALUES (?, ?, ?, ?, ?)
      `,
    );

    const bucketDate = recordedAt.slice(0, 10);
    for (const observation of observations) {
      insertMetric.run(
        runId,
        observation.scope,
        observation.tool,
        observation.metric_name,
        observation.metric_value,
      );

      upsertDailyAggregate(db, {
        bucket_date: bucketDate,
        model: input.runtime.model,
        prompt_family: promptFamily,
        session_mode: input.runtime.session_mode,
        profile_id: input.profile.profile_id,
        scope: observation.scope,
        tool_name: observation.tool,
        metric_name: observation.metric_name,
        metric_value: observation.metric_value,
      });
    }

    const retainDays =
      input.runtime.prune_raw_run_days ?? input.profile.prune_raw_run_days ?? null;
    if (typeof retainDays === 'number' && retainDays >= 0) {
      pruneRawRuns(db, retainDays);
    }

    db.exec('COMMIT');
    return runId;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
    }
}

export function getHistoricalTurn3Stats(
  input: {
    db_path: string;
    model: string;
    prompt_family: string;
    session_mode: string;
    selected_metric_tool?: string;
    selected_metric_name?: string;
  },
): HistoricalTurn3Stats {
  const db = new DatabaseSync(input.db_path);

  try {
    ensureSchema(db);

    const clauses = [
      'model = ?',
      'prompt_family = ?',
      'session_mode = ?',
      'iteration_number = 3',
    ];
    const params: Array<string | number> = [
      input.model,
      input.prompt_family,
      input.session_mode,
    ];

    if (input.selected_metric_name) {
      clauses.push('selected_metric_name = ?');
      params.push(input.selected_metric_name);
    }
    if (input.selected_metric_tool) {
      clauses.push('selected_metric_tool = ?');
      params.push(input.selected_metric_tool);
    }

    const row = db
      .prepare(
        `
          SELECT
            COUNT(*) AS sample_count,
            COALESCE(SUM(released), 0) AS released_count,
            COALESCE(SUM(human_review), 0) AS human_review_count,
            AVG(delta_from_prior_turn) AS mean_delta_from_prior_turn
          FROM orchestrator_runs
          WHERE ${clauses.join(' AND ')}
        `,
      )
      .get(...params) as {
        sample_count: number;
        released_count: number;
        human_review_count: number;
        mean_delta_from_prior_turn: number | null;
      };

    const sampleCount = Number(row.sample_count ?? 0);
    const releasedCount = Number(row.released_count ?? 0);
    const humanReviewCount = Number(row.human_review_count ?? 0);

    return {
      sample_count: sampleCount,
      released_count: releasedCount,
      human_review_count: humanReviewCount,
      success_rate: sampleCount > 0 ? releasedCount / sampleCount : 0,
      mean_delta_from_prior_turn:
        typeof row.mean_delta_from_prior_turn === 'number'
          ? row.mean_delta_from_prior_turn
          : null,
    };
  } finally {
    db.close();
  }
}

export function getReleasedMetricWindowStats(
  input: {
    db_path: string;
    model: string;
    prompt_family: string;
    session_mode: string;
    tool_name: OrchestratorToolName;
    metric_name: string;
    profile_id?: string;
    scope?: 'routed' | 'shadow' | 'summary';
    window_days?: number;
    sigma_multiplier?: number;
  },
): ReleasedMetricWindowStats {
  const db = new DatabaseSync(input.db_path);

  try {
    ensureSchema(db);

    const windowDays = input.window_days ?? 7;
    const sigmaMultiplier = input.sigma_multiplier ?? 1;
    const cutoff = new Date(
      Date.now() - windowDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const scope = input.scope ?? 'routed';
    const clauses = [
      'r.model = ?',
      'r.prompt_family = ?',
      'r.session_mode = ?',
      'r.released = 1',
      'r.recorded_at >= ?',
      'm.scope = ?',
      'm.tool_name = ?',
      'm.metric_name = ?',
    ];
    const params: Array<string | number> = [
      input.model,
      input.prompt_family,
      input.session_mode,
      cutoff,
      scope,
      input.tool_name,
      input.metric_name,
    ];

    if (input.profile_id) {
      clauses.push('r.profile_id = ?');
      params.push(input.profile_id);
    }

    const rows = db
      .prepare(
        `
          SELECT m.metric_value
          FROM orchestrator_metrics m
          INNER JOIN orchestrator_runs r
            ON r.id = m.run_id
          WHERE ${clauses.join(' AND ')}
          ORDER BY r.recorded_at DESC, r.id DESC
        `,
      )
      .all(...params);
    const values = rows
      .flatMap(row => {
        const metricValue = toFiniteNumber(
          (row as SqliteRow).metric_value,
        );
        return metricValue === null ? [] : [metricValue];
      });

    if (values.length === 0) {
      return {
        sample_count: 0,
        mean_value: null,
        stddev_value: null,
        min_value: null,
        max_value: null,
        recommended_min_threshold: null,
        recommended_max_threshold: null,
        window_days: windowDays,
      };
    }

    const meanValue = computeMean(values);
    if (meanValue === null) {
      return {
        sample_count: 0,
        mean_value: null,
        stddev_value: null,
        min_value: null,
        max_value: null,
        recommended_min_threshold: null,
        recommended_max_threshold: null,
        window_days: windowDays,
      };
    }

    const stddevValue = computeStddev(values, meanValue) ?? 0;

    return {
      sample_count: values.length,
      mean_value: roundMetric(meanValue),
      stddev_value: roundMetric(stddevValue),
      min_value: roundMetric(Math.min(...values)),
      max_value: roundMetric(Math.max(...values)),
      recommended_min_threshold: roundMetric(
        Math.max(0, meanValue - sigmaMultiplier * stddevValue),
      ),
      recommended_max_threshold: roundMetric(meanValue + sigmaMultiplier * stddevValue),
      window_days: windowDays,
    };
  } finally {
    db.close();
  }
}

export function getTurnSalvageStats(
  input: {
    db_path: string;
    model: string;
    prompt_family: string;
    session_mode: string;
    from_iteration?: number;
    to_iteration?: number;
    selected_metric_tool?: string;
    selected_metric_name?: string;
  },
): TurnSalvageStats {
  const db = new DatabaseSync(input.db_path);

  try {
    ensureSchema(db);

    const fromIteration = input.from_iteration ?? 1;
    const toIteration = input.to_iteration ?? 2;
    const clauses = [
      'model = ?',
      'prompt_family = ?',
      'session_mode = ?',
      'turn_chain_id IS NOT NULL',
      'iteration_number IN (?, ?)',
    ];
    const params: Array<string | number> = [
      input.model,
      input.prompt_family,
      input.session_mode,
      fromIteration,
      toIteration,
    ];

    if (input.selected_metric_tool) {
      clauses.push('selected_metric_tool = ?');
      params.push(input.selected_metric_tool);
    }
    if (input.selected_metric_name) {
      clauses.push('selected_metric_name = ?');
      params.push(input.selected_metric_name);
    }

    const rows = db
      .prepare(
        `
          SELECT
            turn_chain_id,
            iteration_number,
            released,
            selected_metric_value,
            delta_from_prior_turn
          FROM orchestrator_runs
          WHERE ${clauses.join(' AND ')}
          ORDER BY recorded_at ASC, id ASC
        `,
      )
      .all(...params);

    const chains = new Map<
      string,
      Partial<Record<number, TurnChainRow>>
    >();
    for (const row of asSqliteRows(rows)) {
      const turnChainId =
        typeof row.turn_chain_id === 'string' ? row.turn_chain_id : null;
      const iterationNumber = toFiniteNumber(row.iteration_number);
      const released = toFiniteNumber(row.released);
      if (turnChainId === null || iterationNumber === null || released === null) {
        continue;
      }
      const typedRow: TurnChainRow = {
        turn_chain_id: turnChainId,
        iteration_number: iterationNumber,
        released,
        selected_metric_value: toFiniteNumber(row.selected_metric_value),
        delta_from_prior_turn: toFiniteNumber(row.delta_from_prior_turn),
      };
      const chain = chains.get(typedRow.turn_chain_id) ?? {};
      chain[typedRow.iteration_number] = typedRow;
      chains.set(typedRow.turn_chain_id, chain);
    }

    let pairedChainCount = 0;
    let turn1ReleasedCount = 0;
    let turn2ReleasedCount = 0;
    let eligibleTurn1FailureCount = 0;
    let salvageCount = 0;
    const metricDeltas: number[] = [];

    for (const chain of chains.values()) {
      const fromRow = chain[fromIteration];
      const toRow = chain[toIteration];
      if (!fromRow || !toRow) continue;

      pairedChainCount += 1;
      if (fromRow.released === 1) turn1ReleasedCount += 1;
      if (toRow.released === 1) turn2ReleasedCount += 1;

      if (fromRow.released === 0) {
        eligibleTurn1FailureCount += 1;
        if (toRow.released === 1) {
          salvageCount += 1;
        }
      }

      const metricDelta =
        typeof toRow.delta_from_prior_turn === 'number'
          ? toRow.delta_from_prior_turn
          : typeof fromRow.selected_metric_value === 'number' &&
              typeof toRow.selected_metric_value === 'number'
            ? toRow.selected_metric_value - fromRow.selected_metric_value
            : null;
      if (typeof metricDelta === 'number' && Number.isFinite(metricDelta)) {
        metricDeltas.push(metricDelta);
      }
    }

    const meanMetricDelta = computeMean(metricDeltas);

    return {
      paired_chain_count: pairedChainCount,
      turn_1_released_count: turn1ReleasedCount,
      turn_2_released_count: turn2ReleasedCount,
      eligible_turn_1_failure_count: eligibleTurn1FailureCount,
      salvage_count: salvageCount,
      salvage_rate:
        eligibleTurn1FailureCount > 0
          ? salvageCount / eligibleTurn1FailureCount
          : 0,
      mean_metric_delta:
        typeof meanMetricDelta === 'number' ? roundMetric(meanMetricDelta) : null,
    };
  } finally {
    db.close();
  }
}

export function getToolRedundancyRecommendations(
  input: {
    db_path: string;
    model: string;
    prompt_family: string;
    session_mode: string;
    profile_id?: string;
    window_days?: number;
    min_paired_runs?: number;
  },
): ToolRedundancyRecommendation[] {
  const db = new DatabaseSync(input.db_path);

  try {
    ensureSchema(db);

    const cutoff = new Date(
      Date.now() - (input.window_days ?? 30) * 24 * 60 * 60 * 1000,
    ).toISOString();
    const clauses = [
      'r.model = ?',
      'r.prompt_family = ?',
      'r.session_mode = ?',
      'r.recorded_at >= ?',
      "m.scope = 'routed'",
      "m.metric_name IN ('warning_count', 'blocking_issue_count')",
    ];
    const params: Array<string | number> = [
      input.model,
      input.prompt_family,
      input.session_mode,
      cutoff,
    ];

    if (input.profile_id) {
      clauses.push('r.profile_id = ?');
      params.push(input.profile_id);
    }

    const rows = db
      .prepare(
        `
          SELECT
            r.id AS run_id,
            m.tool_name,
            m.metric_name,
            m.metric_value
          FROM orchestrator_metrics m
          INNER JOIN orchestrator_runs r
            ON r.id = m.run_id
          WHERE ${clauses.join(' AND ')}
          ORDER BY r.id ASC
        `,
      )
      .all(...params);

    const runSignals = new Map<number, Map<OrchestratorToolName, boolean>>();
    for (const row of asSqliteRows(rows)) {
      const runId = toFiniteNumber(row.run_id);
      const toolName =
        typeof row.tool_name === 'string'
          ? (row.tool_name as OrchestratorToolName)
          : null;
      const metricValue = toFiniteNumber(row.metric_value);
      if (runId === null || toolName === null || metricValue === null) {
        continue;
      }
      const toolSignals = runSignals.get(runId) ?? new Map();
      const current = toolSignals.get(toolName) ?? false;
      toolSignals.set(toolName, current || metricValue > 0);
      runSignals.set(runId, toolSignals);
    }

    const pairStats = new Map<
      string,
      {
        anchor_tool: OrchestratorToolName;
        candidate_tool: OrchestratorToolName;
        paired_run_count: number;
        anchor_signal_count: number;
        candidate_signal_count: number;
        candidate_independent_signal_count: number;
      }
    >();

    for (const toolSignals of runSignals.values()) {
      const tools = [...toolSignals.keys()].sort();
      for (const anchorTool of tools) {
        const anchorSignal = toolSignals.get(anchorTool) ?? false;
        for (const candidateTool of tools) {
          if (anchorTool === candidateTool) continue;
          const candidateSignal = toolSignals.get(candidateTool) ?? false;
          const key = `${anchorTool}->${candidateTool}`;
          const current = pairStats.get(key) ?? {
            anchor_tool: anchorTool,
            candidate_tool: candidateTool,
            paired_run_count: 0,
            anchor_signal_count: 0,
            candidate_signal_count: 0,
            candidate_independent_signal_count: 0,
          };

          current.paired_run_count += 1;
          if (anchorSignal) current.anchor_signal_count += 1;
          if (candidateSignal) current.candidate_signal_count += 1;
          if (candidateSignal && !anchorSignal) {
            current.candidate_independent_signal_count += 1;
          }

          pairStats.set(key, current);
        }
      }
    }

    const minPairedRuns = input.min_paired_runs ?? 10;
    return [...pairStats.values()]
      .filter(
        pair =>
          pair.paired_run_count >= minPairedRuns &&
          pair.candidate_independent_signal_count === 0,
      )
      .map(pair => ({
        ...pair,
        candidate_independent_signal_rate:
          pair.paired_run_count > 0
            ? pair.candidate_independent_signal_count / pair.paired_run_count
            : 0,
      }))
      .sort((a, b) => b.paired_run_count - a.paired_run_count);
  } finally {
    db.close();
  }
}

export function adaptCalibrationProfileFromHistory(
  input: AdaptCalibrationProfileFromHistoryInput,
): AdaptCalibrationProfileFromHistoryResult {
  const adaptedProfile: CalibrationProfile = {
    ...input.profile,
    selectors: { ...input.profile.selectors },
    metric_gates: {
      validate_confidence: input.profile.metric_gates.validate_confidence
        ? { ...input.profile.metric_gates.validate_confidence }
        : undefined,
      validate_reasoning_chain: input.profile.metric_gates.validate_reasoning_chain
        ? { ...input.profile.metric_gates.validate_reasoning_chain }
        : undefined,
      check_plan_validity: input.profile.metric_gates.check_plan_validity
        ? { ...input.profile.metric_gates.check_plan_validity }
        : undefined,
      detect_concurrency_patterns: input.profile.metric_gates.detect_concurrency_patterns
        ? { ...input.profile.metric_gates.detect_concurrency_patterns }
        : undefined,
      score_response_quality: input.profile.metric_gates.score_response_quality
        ? { ...input.profile.metric_gates.score_response_quality }
        : undefined,
    },
  };
  const adaptiveMetricOverrides: AdaptiveMetricGateOverride[] = [];
  const minimumSampleCount = input.minimum_sample_count ?? 5;
  const sigmaMultiplier = input.sigma_multiplier ?? 1;
  const windowDays = input.window_days ?? 7;

  for (const mapping of ADAPTIVE_GATE_MAPPINGS) {
    const toolGates = (
      adaptedProfile.metric_gates as Record<string, Record<string, unknown> | undefined>
    )[mapping.tool];
    if (!toolGates) continue;
    const baselineThreshold = toolGates[mapping.gate_key];
    if (typeof baselineThreshold !== 'number') continue;

    const stats = getReleasedMetricWindowStats({
      db_path: input.db_path,
      model: input.runtime.model,
      prompt_family: input.runtime.prompt_family ?? 'operational_claim',
      session_mode: input.runtime.session_mode,
      tool_name: mapping.tool,
      metric_name: mapping.metric_name,
      window_days: windowDays,
      sigma_multiplier: sigmaMultiplier,
    });
    if (stats.sample_count < minimumSampleCount) continue;

    const adaptedThreshold =
      mapping.comparator === '>='
        ? stats.recommended_min_threshold
        : stats.recommended_max_threshold;
    if (
      typeof adaptedThreshold !== 'number' ||
      !Number.isFinite(adaptedThreshold) ||
      Math.abs(adaptedThreshold - baselineThreshold) < 0.0001
    ) {
      continue;
    }

    toolGates[mapping.gate_key] = adaptedThreshold;
    adaptiveMetricOverrides.push({
      tool: mapping.tool,
      metric_name: mapping.metric_name,
      comparator: mapping.comparator,
      baseline_threshold: baselineThreshold,
      adapted_threshold: adaptedThreshold,
      sample_count: stats.sample_count,
      mean_value: stats.mean_value ?? adaptedThreshold,
      stddev_value: stats.stddev_value ?? 0,
      window_days: stats.window_days,
    });
  }

  return {
    profile: adaptedProfile,
    adaptive_metric_overrides: adaptiveMetricOverrides,
  };
}
