import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import {
  collectCalibrationMetricObservations,
  normaliseToolCombo,
} from './calibration.js';
import type {
  CalibrationProfile,
  CalibrationRuntimeContext,
  OrchestratorResult,
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
    const released = input.runtime.released ? 1 : 0;

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
