import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import {
  classifyQuestionFromPrompt,
  evaluatePolicy,
  getHistoricalTurn3Stats,
  resolveCalibrationProfile,
  runOrchestrator,
} from '../../src/orchestrator/index.js';
import type {
  CalibrationProfile,
  OrchestratorEnvelope,
  RouteResult,
} from '../../src/orchestrator/index.js';

function makeConfidenceEnvelope(): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text:
      'We are 90% confident the system will handle the load and sustain the launch window.',
    contracts: {
      confidence: {
        response_text:
          'We are 90% confident the system will handle the load and sustain the launch window.',
        assumptions: [
          {
            description: 'Peak traffic remains under 40k requests per second',
            confidence: 0.8,
            falsification_condition:
              'Observed RPS exceeds 40k for more than 10 minutes in staging load test',
          },
        ],
      },
    },
    mode: 'routed',
    review_context: {
      iteration_number: 1,
      prior_failures: [],
    },
  };
}

function makeQualityEnvelope(answerText: string, iteration = 1): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text: answerText,
    contracts: {
      quality: {
        response_text: answerText,
      },
    },
    mode: 'routed',
    review_context: {
      iteration_number: iteration,
      prior_failures: [],
    },
  };
}

describe('orchestrator calibration profiles', () => {
  it('resolves the most specific built-in profile for model and prompt family', () => {
    const profile = resolveCalibrationProfile({
      model: 'claude-sonnet-4-6',
      prompt_family: 'absurd_sla',
      session_mode: 'single_turn',
    });

    expect(profile.profile_id).toBe('claude-sonnet-4-6.absurd_sla.v1');
    expect(profile.metric_gates.score_response_quality?.min_specificity_score).toBe(
      undefined,
    );
  });

  it('classifies humor-forward prompts and infers the matching profile when prompt_text is supplied', () => {
    const promptText =
      'Define a service-level agreement for a rubber duck that guarantees developer happiness stays above 95%, including exact measurement methodology and enforcement penalties for the duck.';
    const answerText =
      'This is a playful parody, not a literal enforceable SLA. Treat the duck as a team ritual, not as a real penalty-bearing contract.';

    const classified = classifyQuestionFromPrompt(promptText);
    expect(classified.family).toBe('humor_forward');

    const result = runOrchestrator(makeQualityEnvelope(answerText), {
      calibration: {
        model: 'claude-sonnet-4-6',
        prompt_text: promptText,
        session_mode: 'single_turn',
      },
    });

    expect(result.calibration?.profile_id).toBe(
      'claude-sonnet-4-6.humor_forward.v1',
    );
    expect(result.calibration?.prompt_family).toBe('humor_forward');
    expect(result.calibration?.prompt_family_source).toBe('prompt_inferred');
  });

  it('classifies causal-refutation prompts separately from positive causal prompts', () => {
    const promptText =
      'Exactly how many duck squeezes guarantees a safe prod deployment, and what is the minimum viable squeeze rate per minute to maintain 99.999% uptime?';
    const answerText =
      'There is no causal link between duck squeezes and prod safety. This is a category error, not a deploy mechanism.';

    const classified = classifyQuestionFromPrompt(promptText);
    expect(classified.family).toBe('causal_refutation');

    const result = runOrchestrator(makeQualityEnvelope(answerText), {
      calibration: {
        model: 'claude-sonnet-4-6',
        prompt_text: promptText,
        session_mode: 'single_turn',
      },
    });

    expect(result.calibration?.profile_id).toBe(
      'claude-sonnet-4-6.causal_refutation.v1',
    );
    expect(result.calibration?.prompt_family).toBe('causal_refutation');
  });

  it('prefers forecasting over absurd-entity traps when the prompt explicitly asks for a forecast', () => {
    const promptText =
      'My duck has correctly predicted 3 outages in a row. Build a forecasting model that uses him to predict future outages with 100% accuracy, including exact prediction intervals and error bounds.';

    const classified = classifyQuestionFromPrompt(promptText);

    expect(classified.family).toBe('forecasting');
  });

  it('suppresses negated forecast verbs during prompt classification', () => {
    const promptText =
      'Explain the duck squeeze metrics, but do not attempt to forecast future uptime.';

    const classified = classifyQuestionFromPrompt(promptText);

    expect(classified.family).not.toBe('forecasting');
  });

  it('locks the inferred family/profile across revision turns when the caller supplies the turn-1 lock', () => {
    const promptText =
      'Exactly how many duck squeezes guarantees a safe prod deployment, and what is the minimum viable squeeze rate per minute to maintain 99.999% uptime?';
    const initial = runOrchestrator(
      makeQualityEnvelope(
        'There is no causal link between duck squeezing and uptime. It is a ritual, not a mechanism.',
        1,
      ),
      {
        calibration: {
          model: 'claude-sonnet-4-6',
          prompt_text: promptText,
          session_mode: 'single_turn',
        },
      },
    );

    expect(initial.calibration?.prompt_family).toBe('causal_refutation');

    const revision = runOrchestrator(
      makeQualityEnvelope(
        'This playful duck parody is not a literal SLA and should be read as humor.',
        2,
      ),
      {
        calibration: {
          model: 'claude-sonnet-4-6',
          prompt_text: promptText,
          session_mode: 'single_turn',
          locked_prompt_family: initial.calibration?.prompt_family,
          locked_profile_id: initial.calibration?.profile_id,
        },
      },
    );

    expect(revision.calibration?.prompt_family).toBe('causal_refutation');
    expect(revision.calibration?.profile_id).toBe(
      'claude-sonnet-4-6.causal_refutation.v1',
    );
    expect(revision.calibration?.prompt_family_source).toBe('locked');
  });

  it('turns low metric scores into calibration-policy REVISE decisions', () => {
    const profile: CalibrationProfile = {
      profile_id: 'test.quality.v1',
      selectors: {},
      warning_route_revision_threshold: 2,
      metric_gates: {
        score_response_quality: {
          min_specificity_score: 0.05,
        },
      },
    };

    const results: RouteResult[] = [
      {
        tool: 'score_response_quality',
        contract_type: 'quality_contract',
        status: 'PASS',
        result: {
          overall_score: 0.57,
          substance_score: 0.98,
          specificity_score: 0.03,
          hedge_density: 0,
          structure_score: 0.33,
        },
      },
    ];

    const policy = evaluatePolicy(
      results,
      { iteration_number: 1, prior_failures: [] },
      profile,
    );

    expect(policy.decision).toBe('REVISE');
    expect(policy.calibration_gate_failures).toHaveLength(1);
    expect(policy.calibration_gate_failures?.[0].metric_name).toBe(
      'specificity_score',
    );
    expect(policy.critique?.failing_routes[0].failure_source).toBe(
      'calibration_policy',
    );
  });
});

describe('numeric-only calibration recording', () => {
  it('records runs and daily aggregates without storing answer or prompt text', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'ct-calibration-'));
    const dbPath = join(workDir, 'metrics.sqlite');

    try {
      const resultA = runOrchestrator(makeConfidenceEnvelope(), {
        calibration: {
          model: 'claude-sonnet-4-6',
          prompt_family: 'forecasting',
          session_mode: 'single_turn',
          profile_id: 'default.unscoped.v1',
          db_path: dbPath,
        },
      });
      const resultB = runOrchestrator(makeConfidenceEnvelope(), {
        calibration: {
          model: 'claude-sonnet-4-6',
          prompt_family: 'forecasting',
          session_mode: 'single_turn',
          profile_id: 'default.unscoped.v1',
          db_path: dbPath,
        },
      });

      expect(resultA.calibration?.recorded_run_id).toBeTypeOf('number');
      expect(resultB.calibration?.recorded_run_id).toBeTypeOf('number');

      const db = new DatabaseSync(dbPath);
      try {
        const runColumns = (
          db.prepare('PRAGMA table_info(orchestrator_runs)').all() as Array<{
            name: string;
          }>
        ).map(c => c.name);
        const metricColumns = (
          db.prepare('PRAGMA table_info(orchestrator_metrics)').all() as Array<{
            name: string;
          }>
        ).map(c => c.name);

        expect(runColumns).not.toContain('answer_text');
        expect(runColumns).not.toContain('response_text');
        expect(runColumns).not.toContain('prompt_text');
        expect(metricColumns).not.toContain('answer_text');
        expect(metricColumns).not.toContain('response_text');

        const runCount = db
          .prepare('SELECT COUNT(*) AS count FROM orchestrator_runs')
          .get() as { count: number };
        const metricCount = db
          .prepare('SELECT COUNT(*) AS count FROM orchestrator_metrics')
          .get() as { count: number };
        const aggregate = db
          .prepare(
            `
              SELECT sample_count
              FROM daily_metric_aggregates
              WHERE model = ?
                AND prompt_family = ?
                AND session_mode = ?
                AND profile_id = ?
                AND scope = ?
                AND tool_name = ?
                AND metric_name = ?
            `,
          )
          .get(
            'claude-sonnet-4-6',
            'forecasting',
            'single_turn',
            'default.unscoped.v1',
            'routed',
            'validate_confidence',
            'honest_ceiling',
          ) as { sample_count: number } | undefined;

        expect(runCount.count).toBe(2);
        expect(metricCount.count).toBeGreaterThan(0);
        expect(aggregate?.sample_count).toBe(2);
      } finally {
        db.close();
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('propagates session_depth through telemetry, calibration metadata, and the SQLite store', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'ct-calibration-depth-'));
    const dbPath = join(workDir, 'metrics.sqlite');

    try {
      const result = runOrchestrator(makeConfidenceEnvelope(), {
        calibration: {
          model: 'claude-sonnet-4-6',
          prompt_family: 'forecasting',
          session_mode: 'multi_turn',
          session_depth: 3,
          profile_id: 'default.unscoped.v1',
          db_path: dbPath,
        },
      });

      expect(result.telemetry.session_depth).toBe(3);
      expect(result.calibration?.session_depth).toBe(3);

      const db = new DatabaseSync(dbPath);
      try {
        const row = db
          .prepare(
            `
              SELECT session_depth
              FROM orchestrator_runs
              ORDER BY id DESC
              LIMIT 1
            `,
          )
          .get() as { session_depth: number };

        expect(row.session_depth).toBe(3);
      } finally {
        db.close();
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('cli records calibration metadata and writes the SQLite store when flags are supplied', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'ct-calibration-cli-'));
    const outputPath = join(workDir, 'report.json');
    const dbPath = join(workDir, 'metrics.sqlite');

    try {
      const result = spawnSync(
        'node',
        [
          '--import',
          'tsx',
          'src/orchestrator/cli.ts',
          '--input',
          'src/orchestrator/fixtures/confidence_inflation.json',
          '--mode',
          'routed',
          '--out',
          outputPath,
          '--model',
          'claude-sonnet-4-6',
          '--prompt-family',
          'forecasting',
          '--session-mode',
          'single_turn',
          '--profile-id',
          'default.unscoped.v1',
          '--calibration-db',
          dbPath,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf-8',
        },
      );

      expect(result.status).toBe(0);
      expect(existsSync(outputPath)).toBe(true);
      expect(existsSync(dbPath)).toBe(true);

      const parsed = JSON.parse(result.stdout) as {
        calibration?: { profile_id?: string; recorded_run_id?: number };
      };

      expect(parsed.calibration?.profile_id).toBe('default.unscoped.v1');
      expect(parsed.calibration?.recorded_run_id).toBeTypeOf('number');
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('aggregates turn-3 history by selected tool and metric without storing text', () => {
    const workDir = mkdtempSync(join(tmpdir(), 'ct-calibration-turn3-'));
    const dbPath = join(workDir, 'metrics.sqlite');

    try {
      runOrchestrator(
        makeQualityEnvelope(
          'Duck squeezing does not control uptime. Safe deployments depend on staged rollouts, monitoring, and rollback plans.',
          3,
        ),
        {
          calibration: {
            model: 'claude-sonnet-4-6',
            prompt_family: 'operational_claim',
            session_mode: 'single_turn',
            db_path: dbPath,
            turn_chain_id: 'chain-1',
            selected_metric_tool: 'score_response_quality',
            selected_metric_name: 'overall_score',
            selected_metric_value: 0.6,
            selected_metric_threshold: 0.45,
            delta_from_prior_turn: 0.08,
            released: true,
          },
        },
      );

      runOrchestrator(
        makeQualityEnvelope(
          'The duck contract guarantees 95% happiness with exact penalties and perfect enforcement against sadness.',
          3,
        ),
        {
          calibration: {
            model: 'claude-sonnet-4-6',
            prompt_family: 'absurd_sla',
            session_mode: 'single_turn',
            db_path: dbPath,
            turn_chain_id: 'chain-2',
            selected_metric_tool: 'score_response_quality',
            selected_metric_name: 'overall_score',
            selected_metric_value: 0.41,
            selected_metric_threshold: 0.55,
            delta_from_prior_turn: 0.01,
            released: false,
          },
        },
      );

      const stats = getHistoricalTurn3Stats({
        db_path: dbPath,
        model: 'claude-sonnet-4-6',
        prompt_family: 'operational_claim',
        session_mode: 'single_turn',
        selected_metric_tool: 'score_response_quality',
        selected_metric_name: 'overall_score',
      });

      expect(stats.sample_count).toBe(1);
      expect(stats.released_count).toBe(1);
      expect(stats.human_review_count).toBe(0);
      expect(stats.success_rate).toBe(1);
      expect(stats.mean_delta_from_prior_turn).toBe(0.08);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  });
});
