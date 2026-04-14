import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { runCalibrationMatrix } from '../../benchmark/invisible-tea-party/ts/src/calibrationRunner.js';
import { generateAggregateReport, generateMarkdownReport, generateThresholdReview, writeAllReports } from '../../benchmark/invisible-tea-party/ts/src/calibrationReport.js';

describe('Invisible Tea Party: Calibration', () => {
  const outDir = resolve('/tmp', `tea-calibration-test-${randomUUID()}`);
  const profileConfig = resolve('benchmark/invisible-tea-party/config/model_profiles.example.json');

  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it('matrix execution with fixture executor produces per-cell bundles', async () => {
    const results = await runCalibrationMatrix({
      scenarioIds: ['tea_001_ontology_spill', 'tea_003_consensus_occupant'],
      profileConfigPath: profileConfig,
      outDir,
    });

    expect(results).toHaveLength(2);
    expect(results.every(r => r.status === 'success')).toBe(true);

    // Check per-cell bundles exist
    for (const r of results) {
      expect(existsSync(resolve(r.bundle_dir, 'final_verification.json'))).toBe(true);
      expect(existsSync(resolve(r.bundle_dir, 'run_manifest.json'))).toBe(true);
    }

    // Check calibration manifest
    expect(existsSync(resolve(outDir, 'calibration_manifest.json'))).toBe(true);
    expect(existsSync(resolve(outDir, 'calibration_matrix.json'))).toBe(true);
  });

  it('partial failure does not abort the whole run', async () => {
    // Use a non-existent module as a second profile to trigger a failure
    const badProfileDir = resolve('/tmp', `tea-calibration-bad-${randomUUID()}`);
    const badConfigPath = resolve(badProfileDir, 'bad_profiles.json');
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(badProfileDir, { recursive: true });
    writeFileSync(badConfigPath, JSON.stringify({
      profiles: [
        {
          profile_id: 'fixture_v1',
          description: 'Good fixture',
          pass_executor_module: 'benchmark/invisible-tea-party/ts/fixtures/staticPassExecutor.ts',
          arbiter_module: 'benchmark/invisible-tea-party/ts/fixtures/staticArbiterEvaluator.ts',
        },
        {
          profile_id: 'broken_executor',
          description: 'Broken executor for testing',
          pass_executor_module: 'benchmark/invisible-tea-party/ts/fixtures/DOES_NOT_EXIST.ts',
          arbiter_module: 'benchmark/invisible-tea-party/ts/fixtures/staticArbiterEvaluator.ts',
        },
      ],
    }), 'utf-8');

    const failOutDir = resolve('/tmp', `tea-calibration-fail-${randomUUID()}`);
    try {
      const results = await runCalibrationMatrix({
        scenarioIds: ['tea_001_ontology_spill'],
        profileConfigPath: badConfigPath,
        outDir: failOutDir,
      });

      // Should have 2 results (1 good + 1 failed)
      expect(results).toHaveLength(2);
      const good = results.find(r => r.profile_id === 'fixture_v1');
      const bad = results.find(r => r.profile_id === 'broken_executor');
      expect(good?.status).toBe('success');
      expect(bad?.status).toBe('failed');
      expect(bad?.error_category).toBeDefined();
      expect(bad?.error_message).toBeDefined();
      expect(bad?.core_final_score).toBeNull();
    } finally {
      rmSync(badProfileDir, { recursive: true, force: true });
      rmSync(failOutDir, { recursive: true, force: true });
    }
  });

  it('aggregate summary is generated with required metrics', async () => {
    const results = await runCalibrationMatrix({
      scenarioIds: 'all',
      profileConfigPath: profileConfig,
      outDir: resolve(outDir, 'full'),
    });

    const report = generateAggregateReport(results);

    expect(report.total_runs).toBe(6);
    expect(report.successful_runs).toBe(6);
    expect(report.failed_runs).toBe(0);
    expect(results.every(r => r.arbiter_pass_status === 'AVAILABLE')).toBe(true);
    expect(report.overall_mean).toBeGreaterThan(0);
    expect(report.overall_median).toBeGreaterThan(0);
    expect(report.profile_stats.length).toBeGreaterThan(0);
    expect(report.family_stats.length).toBeGreaterThan(0);
    expect(report.tier_stats.length).toBeGreaterThan(0);

    // Verify per-profile stats have new metrics
    const ps = report.profile_stats[0];
    expect(ps).toHaveProperty('completion_rate');
    expect(ps).toHaveProperty('arbiter_unavailable_count');
    expect(ps).toHaveProperty('arbiter_unavailable_rate');
    expect(ps).toHaveProperty('evasion_penalty_count');
    expect(ps).toHaveProperty('evasion_penalty_rate');
  });

  it('markdown summary and threshold review are generated', async () => {
    const results = await runCalibrationMatrix({
      scenarioIds: ['tea_001_ontology_spill'],
      profileConfigPath: profileConfig,
      outDir: resolve(outDir, 'md-test'),
    });

    const report = generateAggregateReport(results);
    const md = generateMarkdownReport(report);
    const review = generateThresholdReview(report);

    expect(md).toContain('# Invisible Tea Party');
    expect(md).toContain('Per-Profile Scores');
    expect(md).toContain('Overall mean');

    expect(review).toContain('Threshold Review');
    expect(review).toContain('Are scores degenerate or useful');
    expect(review).toContain('Which scenarios separate models best');
    expect(review).toContain('Which caps fire most often');
    expect(review).toContain('too strict or too lenient');
  });

  it('writeAllReports produces all required output files', async () => {
    const reportDir = resolve(outDir, 'full');
    // Ensure manifest exists from earlier test
    if (!existsSync(resolve(reportDir, 'calibration_manifest.json'))) {
      await runCalibrationMatrix({
        scenarioIds: 'all',
        profileConfigPath: profileConfig,
        outDir: reportDir,
      });
    }

    const outputDir = resolve(outDir, 'full-report-output');
    writeAllReports(reportDir, undefined, outputDir);

    const expectedFiles = [
      'aggregate_report.json',
      'aggregate_report.md',
      'calibration_summary.json',
      'calibration_summary.md',
      'model_breakdown.json',
      'scenario_breakdown.json',
      'threshold_review.md',
    ];
    for (const file of expectedFiles) {
      expect(existsSync(resolve(outputDir, file)), `Missing: ${file}`).toBe(true);
    }

    // Verify model_breakdown structure
    const modelBreakdown = JSON.parse(readFileSync(resolve(outputDir, 'model_breakdown.json'), 'utf-8'));
    expect(modelBreakdown).toHaveProperty('profile_stats');
    expect(modelBreakdown.profile_stats.length).toBeGreaterThan(0);

    // Verify scenario_breakdown structure
    const scenarioBreakdown = JSON.parse(readFileSync(resolve(outputDir, 'scenario_breakdown.json'), 'utf-8'));
    expect(scenarioBreakdown).toHaveProperty('family_stats');
    expect(scenarioBreakdown).toHaveProperty('tier_stats');
  });

  it('calibration consumes executor_args and optional ingest controls', async () => {
    const cfgDir = resolve('/tmp', `tea-calibration-ingest-${randomUUID()}`);
    const cfgPath = resolve(cfgDir, 'profiles.json');
    const runDir = resolve('/tmp', `tea-calibration-ingest-run-${randomUUID()}`);
    const { mkdirSync, writeFileSync } = await import('node:fs');
    mkdirSync(cfgDir, { recursive: true });
    writeFileSync(cfgPath, JSON.stringify({
      profiles: [
        {
          profile_id: 'fixture_ingested',
          description: 'Fixture executor with ingest enabled',
          pass_executor_module: 'benchmark/invisible-tea-party/ts/fixtures/staticPassExecutor.ts',
          arbiter_module: 'benchmark/invisible-tea-party/ts/fixtures/staticArbiterEvaluator.ts',
          executor_args: {
            producer_model_id: 'fixture-v1-custom',
          },
          attempt_ingest: true,
          expected_official: true,
        },
      ],
    }), 'utf-8');

    const previousSecret = process.env.TEA_PARTY_OFFICIAL_ATTESTATION_SECRET;
    const previousAttestorId = process.env.TEA_PARTY_OFFICIAL_ATTESTATION_ATTESTOR_ID;
    process.env.TEA_PARTY_OFFICIAL_ATTESTATION_SECRET = 'test-secret';
    process.env.TEA_PARTY_OFFICIAL_ATTESTATION_ATTESTOR_ID = 'vitest-calibration';

    try {
      const results = await runCalibrationMatrix({
        scenarioIds: ['tea_001_ontology_spill'],
        profileConfigPath: cfgPath,
        outDir: runDir,
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('success');
      expect(results[0].leaderboard_status).toBe('official_certified_arbiter');

      const pass1 = JSON.parse(readFileSync(resolve(results[0].bundle_dir, 'pass1.reasoning_state.json'), 'utf-8'));
      expect(pass1.producer_model_id).toBe('fixture-v1-custom');
      expect(existsSync(resolve(results[0].bundle_dir, 'leaderboard_submission.json'))).toBe(true);
      expect(existsSync(resolve(results[0].bundle_dir, 'final_verification.ingested.json'))).toBe(true);
      expect(existsSync(resolve(results[0].bundle_dir, 'official_run_attestation.json'))).toBe(true);
    } finally {
      if (previousSecret == null) {
        delete process.env.TEA_PARTY_OFFICIAL_ATTESTATION_SECRET;
      } else {
        process.env.TEA_PARTY_OFFICIAL_ATTESTATION_SECRET = previousSecret;
      }
      if (previousAttestorId == null) {
        delete process.env.TEA_PARTY_OFFICIAL_ATTESTATION_ATTESTOR_ID;
      } else {
        process.env.TEA_PARTY_OFFICIAL_ATTESTATION_ATTESTOR_ID = previousAttestorId;
      }
      rmSync(cfgDir, { recursive: true, force: true });
      rmSync(runDir, { recursive: true, force: true });
    }
  });

  it('no score semantics are changed by calibration', async () => {
    // Run a single scenario and verify the score matches what cli.ts would produce
    const singleDir = resolve(outDir, 'semantics-check');
    const results = await runCalibrationMatrix({
      scenarioIds: ['tea_001_ontology_spill'],
      profileConfigPath: profileConfig,
      outDir: singleDir,
    });

    const r = results[0];
    expect(r.status).toBe('success');
    expect(r.core_final_score).toBeGreaterThan(0);
    expect(r.core_final_score).toBeLessThanOrEqual(1);

    // Read the actual final_verification from the bundle
    const finalJson = JSON.parse(
      readFileSync(resolve(r.bundle_dir, 'final_verification.json'), 'utf-8'),
    );
    expect(finalJson.core_final_score).toBe(r.core_final_score);
  });
});
