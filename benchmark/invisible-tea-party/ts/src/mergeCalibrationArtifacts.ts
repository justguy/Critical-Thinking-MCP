import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { writeAllReports } from './calibrationReport.js';
import type { CalibrationManifest, CalibrationRunResult } from './calibrationRunner.js';
import { loadScenarioRegistry } from './scenarioRegistry.js';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') && i + 1 < argv.length) {
      args[arg.slice(2)] = argv[++i];
    }
  }
  return args;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function latestDiagnosticFile(bundleDir: string, prefix: string): string | null {
  const diagDir = resolve(bundleDir, 'diagnostics');
  let entries: string[];
  try {
    entries = readdirSync(diagDir);
  } catch {
    return null;
  }
  const file = entries
    .filter(name => name.startsWith(prefix))
    .sort()
    .at(-1);
  return file ? resolve(diagDir, file) : null;
}

function firstSubstantiveLine(text: string): string | null {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith('#'))
    .filter(line => !line.startsWith('|'))
    .filter(line => !line.startsWith('- **'))
    .filter(line => !line.startsWith('**Confidence'));
  return lines[0] ?? null;
}

function publicBundleRef(result: CalibrationRunResult): string {
  return `bundle://${result.profile_id}/${result.scenario_id}`;
}

function mergeResultKey(result: CalibrationRunResult): string {
  return `${result.profile_id}::${result.scenario_id}`;
}

function preferMergedResult(
  existing: CalibrationRunResult | undefined,
  candidate: CalibrationRunResult,
): CalibrationRunResult {
  if (!existing) {
    return candidate;
  }

  const existingSuccess = existing.status === 'success';
  const candidateSuccess = candidate.status === 'success';

  if (existingSuccess && !candidateSuccess) {
    return existing;
  }
  if (!existingSuccess && candidateSuccess) {
    return candidate;
  }

  // When both runs have the same success/failure class, let later source dirs override earlier ones.
  return candidate;
}

function buildMergedManifest(manifests: CalibrationManifest[]): CalibrationManifest {
  const resultOrder: string[] = [];
  const resultsByKey = new Map<string, CalibrationRunResult>();

  for (const manifest of manifests) {
    for (const result of manifest.results) {
      const key = mergeResultKey(result);
      if (!resultsByKey.has(key)) {
        resultOrder.push(key);
      }
      resultsByKey.set(key, preferMergedResult(resultsByKey.get(key), result));
    }
  }

  const results = resultOrder
    .map(key => resultsByKey.get(key))
    .filter((result): result is CalibrationRunResult => Boolean(result));

  return {
    schema_version: 'v1.0',
    benchmark_id: 'invisible-tea-party',
    created_at: new Date().toISOString(),
    threshold_profile_id: manifests[0]?.threshold_profile_id ?? 'v1_provisional',
    total_runs: results.length,
    successful_runs: results.filter(result => result.status === 'success').length,
    failed_runs: results.filter(result => result.status === 'failed').length,
    results,
  };
}

function formatMaybeNumber(value: number | null | undefined, digits: number): string {
  return typeof value === 'number' ? value.toFixed(digits) : 'N/A';
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sourceDirsRaw = args['source-dirs'];
  const outDirArg = args['out-dir'];

  if (!sourceDirsRaw) {
    console.error('Error: --source-dirs is required.');
    process.exit(1);
  }
  if (!outDirArg) {
    console.error('Error: --out-dir is required.');
    process.exit(1);
  }

  const sourceDirs = sourceDirsRaw.split(',').map(value => value.trim()).filter(Boolean);
  const outDir = resolve(outDirArg);
  mkdirSync(outDir, { recursive: true });

  const manifests = sourceDirs.map(dir => readJson<CalibrationManifest>(resolve(dir, 'calibration_manifest.json')));
  const mergedManifest = buildMergedManifest(manifests);

  const scenarioRegistry = loadScenarioRegistry();
  const registryById = new Map(scenarioRegistry.map(entry => [entry.scenario_id, entry]));

  const aggregatedScenarios = mergedManifest.results.map(result => {
    const bundleDir = result.bundle_dir;
    const scenario = registryById.get(result.scenario_id);
    const pass1 = readJson<{ raw_text: string }>(resolve(bundleDir, 'pass1.reasoning_state.json'));
    const pass2 = readJson<{ raw_text: string }>(resolve(bundleDir, 'pass2.reasoning_state.json'));
    const pass3 = readJson<{ raw_text: string }>(resolve(bundleDir, 'pass3.reasoning_state.json'));
    const deterministic = readJson(resolve(bundleDir, 'deterministic_verification.json'));
    const arbiter = readJson(resolve(bundleDir, 'arbiter_verification.json'));
    const finalVerification = readJson(resolve(bundleDir, 'final_verification.json'));

    const pass1DiagPath = latestDiagnosticFile(bundleDir, 'pass1_');
    const pass2DiagPath = latestDiagnosticFile(bundleDir, 'pass2_');
    const pass3DiagPath = latestDiagnosticFile(bundleDir, 'pass3_');
    const arbiterDiagPath = latestDiagnosticFile(bundleDir, 'arbiter_');

    const pass1Diag = pass1DiagPath ? readJson<{ prompt: string }>(pass1DiagPath) : null;
    const pass2Diag = pass2DiagPath ? readJson<{ prompt: string }>(pass2DiagPath) : null;
    const pass3Diag = pass3DiagPath ? readJson<{ prompt: string }>(pass3DiagPath) : null;
    const arbiterDiag = arbiterDiagPath ? readJson<{ prompt: string | null }>(arbiterDiagPath) : null;

    return {
      scenario_id: result.scenario_id,
      family: scenario?.family ?? null,
      difficulty_tier: scenario?.difficulty_tier ?? null,
      authored_prompt: scenario?.prompt_text ?? null,
      expected_failure_modes: scenario?.expected_failure_modes ?? [],
      ground_truth_constraints: scenario?.ground_truth_constraints ?? [],
      source_bundle_dir: publicBundleRef(result),
      scores: {
        core_final_score: result.core_final_score,
        arbiter_pass_status: result.arbiter_pass_status,
        leaderboard_status: result.leaderboard_status,
        contradiction_overlap: result.contradiction_overlap,
        gap_closure_rate: result.gap_closure_rate,
        evasion_penalty_normalized: result.evasion_penalty_normalized,
        semantic_density_drop_flag: result.semantic_density_drop_flag,
        caps_applied: result.caps_applied,
      },
      prompts: {
        pass1: pass1Diag?.prompt ?? null,
        pass2: pass2Diag?.prompt ?? null,
        pass3: pass3Diag?.prompt ?? null,
        arbiter: arbiterDiag?.prompt ?? null,
      },
      responses: {
        pass1: pass1.raw_text,
        pass2: pass2.raw_text,
        pass3: pass3.raw_text,
      },
      pass_gist: {
        pass1: firstSubstantiveLine(pass1.raw_text),
        pass2: firstSubstantiveLine(pass2.raw_text),
        pass3: firstSubstantiveLine(pass3.raw_text),
      },
      verification: {
        deterministic,
        arbiter,
        final: finalVerification,
      },
    };
  });

  const aggregatedRuns = {
    schema_version: 'v1.0',
    benchmark_id: 'invisible-tea-party',
    generated_at: new Date().toISOString(),
    run_label: basename(outDir),
    source_manifests: sourceDirs.map(dir => basename(dir)),
    scenarios: aggregatedScenarios,
  };
  writeFileSync(resolve(outDir, 'aggregated_scenario_runs.json'), JSON.stringify(aggregatedRuns, null, 2));

  const publicResults = mergedManifest.results.map(result => ({
    ...result,
    bundle_dir: publicBundleRef(result),
  }));
  const publicManifest = {
    ...mergedManifest,
    results: publicResults,
  };
  writeFileSync(resolve(outDir, 'calibration_manifest.json'), JSON.stringify(publicManifest, null, 2));
  writeFileSync(resolve(outDir, 'calibration_matrix.json'), JSON.stringify(publicResults, null, 2));

  const reportLines: string[] = [];
  reportLines.push('# Invisible Tea Party — Inclusive Calibration Report');
  reportLines.push('');
  reportLines.push(`Generated: ${aggregatedRuns.generated_at}`);
  reportLines.push('');
  reportLines.push('This report merges one or more calibration runs into a single benchmark view.');
  reportLines.push('');
  for (const scenario of aggregatedScenarios) {
    reportLines.push(`## ${scenario.scenario_id}`);
    reportLines.push('');
    reportLines.push(`- Family: ${scenario.family}`);
    reportLines.push(`- Difficulty tier: ${scenario.difficulty_tier}`);
    reportLines.push(`- Core score: ${formatMaybeNumber(scenario.scores.core_final_score, 4)}`);
    reportLines.push(`- Arbiter: ${scenario.scores.arbiter_pass_status}`);
    reportLines.push(`- Contradiction overlap: ${formatMaybeNumber(scenario.scores.contradiction_overlap, 3)}`);
    reportLines.push(`- Gap closure rate: ${formatMaybeNumber(scenario.scores.gap_closure_rate, 3)}`);
    reportLines.push(`- Bundle: ${scenario.source_bundle_dir}`);
    reportLines.push('');
    reportLines.push('**Scenario Prompt**');
    reportLines.push('');
    reportLines.push(scenario.authored_prompt ?? 'N/A');
    reportLines.push('');
    reportLines.push('**Pass Gist**');
    reportLines.push('');
    reportLines.push(`- Pass 1: ${scenario.pass_gist.pass1 ?? 'N/A'}`);
    reportLines.push(`- Pass 2: ${scenario.pass_gist.pass2 ?? 'N/A'}`);
    reportLines.push(`- Pass 3: ${scenario.pass_gist.pass3 ?? 'N/A'}`);
    reportLines.push('');
  }
  writeFileSync(resolve(outDir, 'inclusive_run_report.md'), reportLines.join('\n'));

  const aggregateReport = writeAllReports(outDir);
  console.log(`Merged ${aggregatedScenarios.length} scenarios into ${outDir}`);
  console.log(`Overall mean: ${aggregateReport.overall_mean.toFixed(4)}`);
  console.log(`Overall median: ${aggregateReport.overall_median.toFixed(4)}`);
}

main();
