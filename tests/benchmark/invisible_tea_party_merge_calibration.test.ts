import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

function createBundle(root: string, label: string): string {
  const bundleDir = resolve(root, label);
  mkdirSync(bundleDir, { recursive: true });
  writeJson(resolve(bundleDir, 'pass1.reasoning_state.json'), { raw_text: 'Pass 1 text' });
  writeJson(resolve(bundleDir, 'pass2.reasoning_state.json'), { raw_text: 'Pass 2 text' });
  writeJson(resolve(bundleDir, 'pass3.reasoning_state.json'), { raw_text: 'Pass 3 text' });
  writeJson(resolve(bundleDir, 'deterministic_verification.json'), {});
  writeJson(resolve(bundleDir, 'arbiter_verification.json'), {});
  writeJson(resolve(bundleDir, 'final_verification.json'), {});
  return bundleDir;
}

function createManifest(root: string, results: unknown[]): void {
  writeJson(resolve(root, 'calibration_manifest.json'), {
    schema_version: 'v1.0',
    benchmark_id: 'invisible-tea-party',
    created_at: '2026-04-07T00:00:00.000Z',
    threshold_profile_id: 'v1_provisional',
    total_runs: results.length,
    successful_runs: results.filter((result: any) => result.status === 'success').length,
    failed_runs: results.filter((result: any) => result.status === 'failed').length,
    results,
  });
}

describe('Invisible Tea Party: merge calibration artifacts', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('prefers a successful duplicate cell and uses a neutral inclusive report title', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'tea-merge-test-'));
    tempRoots.push(root);

    const smokeDir = resolve(root, 'smoke');
    const fullDir = resolve(root, 'full');
    const outDir = resolve(root, 'merged');
    mkdirSync(smokeDir, { recursive: true });
    mkdirSync(fullDir, { recursive: true });

    const successBundle = createBundle(smokeDir, 'gemini_official_api/tea_001_ontology_spill');
    const failedBundle = createBundle(fullDir, 'gemini_official_api/tea_001_ontology_spill');

    createManifest(smokeDir, [{
      profile_id: 'gemini_official_api',
      scenario_id: 'tea_001_ontology_spill',
      status: 'success',
      core_final_score: 0.5733333333333334,
      arbiter_pass_status: 'AVAILABLE',
      leaderboard_status: 'official_certified_arbiter',
      contradiction_overlap: 0.6666666666666666,
      gap_closure_rate: 0.5,
      evasion_penalty_normalized: 0,
      semantic_density_drop_flag: false,
      caps_applied: [],
      bundle_dir: successBundle,
    }]);

    createManifest(fullDir, [{
      profile_id: 'gemini_official_api',
      scenario_id: 'tea_001_ontology_spill',
      status: 'failed',
      core_final_score: null,
      arbiter_pass_status: null,
      leaderboard_status: null,
      contradiction_overlap: null,
      gap_closure_rate: null,
      evasion_penalty_normalized: null,
      semantic_density_drop_flag: null,
      caps_applied: [],
      bundle_dir: failedBundle,
      error_category: 'executor_failure',
      error_message: '503 unavailable',
    }]);

    execFileSync(
      'node',
      [
        '--import',
        'tsx',
        'benchmark/invisible-tea-party/ts/src/mergeCalibrationArtifacts.ts',
        '--source-dirs',
        `${smokeDir},${fullDir}`,
        '--out-dir',
        outDir,
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
      },
    );

    const merged = JSON.parse(readFileSync(resolve(outDir, 'calibration_manifest.json'), 'utf-8'));
    const report = readFileSync(resolve(outDir, 'inclusive_run_report.md'), 'utf-8');

    expect(merged.total_runs).toBe(1);
    expect(merged.successful_runs).toBe(1);
    expect(merged.failed_runs).toBe(0);
    expect(merged.results).toHaveLength(1);
    expect(merged.results[0].status).toBe('success');
    expect(merged.results[0].core_final_score).toBeCloseTo(0.5733333333333334);
    expect(report).toContain('# Invisible Tea Party — Inclusive Calibration Report');
    expect(report).not.toContain('Live Claude');
  });
});
