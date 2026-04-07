import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadNormalizedScenarios } from './scenarioRegistry.js';
import { loadThresholdProfile } from './config.js';
import { loadPassExecutorModule, loadArbiterModule } from './moduleLoader.js';
import { writeOfficialRunAttestation, writeRunManifest } from './attestation.js';
import { buildReasoningState } from './reasoningState.js';
import { buildPass1Prompt, buildPass2Prompt, buildPass3Prompt } from './passPrompts.js';
import { DeterministicVerifier } from './deterministic.js';
import { ArbiterVerifier } from './arbiter.js';
import { Reconciler } from './reconcile.js';
import { ingestBundle } from './ingest.js';
import {
  assertValid,
  validateReasoningState,
  validateDeterministicVerification,
  validateArbiterVerification,
  validateFinalVerification,
} from './schemaValidation.js';
import type { PassExecutor } from './passExecutor.js';
import type { BringYourOwnEvaluator } from './arbiter.js';
import type { Scenario } from './models.js';

const CALIBRATION_SECRET_ENV = 'TEA_PARTY_OFFICIAL_ATTESTATION_SECRET';
const CALIBRATION_ATTESTOR_ID_ENV = 'TEA_PARTY_OFFICIAL_ATTESTATION_ATTESTOR_ID';
const DEFAULT_CALIBRATION_ATTESTOR_ID = 'calibration-runner';

export interface ModelProfile {
  profile_id: string;
  description: string;
  pass_executor_module: string;
  arbiter_module: string;
  executor_args?: Record<string, unknown>;
  arbiter_args?: Record<string, unknown>;
  attempt_ingest?: boolean;
  expected_official?: boolean;
}

export interface ModelProfilesConfig {
  profiles: ModelProfile[];
}

export type ErrorCategory =
  | 'executor_failure'
  | 'arbiter_failure'
  | 'schema_validation_failure'
  | 'ingest_failure'
  | 'unexpected_failure';

export interface CalibrationRunConfig {
  scenarioIds: string[] | 'all';
  profileConfigPath: string;
  outDir: string;
  thresholdProfileId?: string;
  arbiterModuleOverride?: string;
}

export interface CalibrationRunResult {
  profile_id: string;
  scenario_id: string;
  status: 'success' | 'failed';
  core_final_score: number | null;
  arbiter_pass_status: string | null;
  leaderboard_status: string | null;
  contradiction_overlap: number | null;
  gap_closure_rate: number | null;
  evasion_penalty_normalized: number | null;
  semantic_density_drop_flag: boolean | null;
  caps_applied: string[];
  bundle_dir: string;
  error_category?: ErrorCategory;
  error_message?: string;
}

export interface CalibrationManifest {
  schema_version: string;
  benchmark_id: 'invisible-tea-party';
  created_at: string;
  threshold_profile_id: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  results: CalibrationRunResult[];
}

interface CalibrationProgress {
  schema_version: 'v1.0';
  benchmark_id: 'invisible-tea-party';
  started_at: string;
  updated_at: string;
  total_runs: number;
  completed_runs: number;
  successful_runs: number;
  failed_runs: number;
  active_profile_id: string | null;
  active_scenario_id: string | null;
  active_step: string | null;
  active_state: 'starting' | 'running' | 'completed' | 'failed' | 'done';
  last_event: string;
}

function loadModelProfilesConfig(configPath: string): ModelProfilesConfig {
  const absPath = resolve(process.cwd(), configPath);
  const raw = readFileSync(absPath, 'utf-8');
  const data = JSON.parse(raw) as ModelProfilesConfig;
  if (!data.profiles || !Array.isArray(data.profiles)) {
    throw new Error(`Invalid model profiles config: missing "profiles" array in ${configPath}`);
  }
  for (const profile of data.profiles) {
    if (!profile.profile_id || !profile.pass_executor_module || !profile.arbiter_module) {
      throw new Error(`Invalid model profile: missing required fields in ${configPath}`);
    }
  }
  return data;
}

function classifyError(err: unknown): { category: ErrorCategory; message: string } {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes('executor') || lower.includes('runpass')) {
    return { category: 'executor_failure', message };
  }
  if (lower.includes('arbiter') || lower.includes('evaluate_pass_4b')) {
    return { category: 'arbiter_failure', message };
  }
  if (lower.includes('schema') || lower.includes('validation failed')) {
    return { category: 'schema_validation_failure', message };
  }
  if (lower.includes('ingest')) {
    return { category: 'ingest_failure', message };
  }
  return { category: 'unexpected_failure', message };
}

async function runSingleScenario(
  scenario: Scenario,
  executor: PassExecutor,
  evaluator: BringYourOwnEvaluator,
  profileId: string,
  thresholdProfileId: string,
  bundleDir: string,
  onProgress?: (step: string) => void,
): Promise<CalibrationRunResult> {
  const profile = loadThresholdProfile(thresholdProfileId);
  const lineageId = randomUUID();
  onProgress?.('executor metadata');
  const metadata = executor.metadata();

  onProgress?.('pass1');
  const pass1Prompt = buildPass1Prompt(scenario);
  const pass1Result = await executor.runPass1({ scenario, prompt: pass1Prompt });
  const pass1 = buildReasoningState({
    scenario, passId: 'pass1_answer', executorResult: pass1Result,
    executorMetadata: metadata, lineageId, parentArtifactId: null, critiqueTargetArtifactId: null,
  });
  assertValid('pass1.reasoning_state', validateReasoningState(pass1));

  onProgress?.('pass2');
  const pass2Prompt = buildPass2Prompt(scenario, pass1);
  const pass2Result = await executor.runPass2({ scenario, pass1, prompt: pass2Prompt });
  const pass2 = buildReasoningState({
    scenario, passId: 'pass2_critique', executorResult: pass2Result,
    executorMetadata: metadata, lineageId, parentArtifactId: pass1.artifact_id, critiqueTargetArtifactId: pass1.artifact_id,
  });
  assertValid('pass2.reasoning_state', validateReasoningState(pass2));

  onProgress?.('pass3');
  const pass3Prompt = buildPass3Prompt(scenario, pass1, pass2);
  const pass3Result = await executor.runPass3({ scenario, pass1, pass2, prompt: pass3Prompt });
  const pass3 = buildReasoningState({
    scenario, passId: 'pass3_repair', executorResult: pass3Result,
    executorMetadata: metadata, lineageId, parentArtifactId: pass2.artifact_id, critiqueTargetArtifactId: null,
  });
  assertValid('pass3.reasoning_state', validateReasoningState(pass3));

  onProgress?.('deterministic verification');
  const deterministicVerifier = new DeterministicVerifier(profile);
  const deterministic = deterministicVerifier.verify(scenario, pass1, pass2, pass3);
  assertValid('deterministic_verification', validateDeterministicVerification(deterministic));

  onProgress?.('arbiter verification');
  const arbiterVerifier = new ArbiterVerifier(evaluator, profile);
  const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);
  assertValid('arbiter_verification', validateArbiterVerification(arbiter));

  onProgress?.('reconciliation');
  const reconciler = new Reconciler(profile);
  const final = reconciler.reconcile(deterministic, arbiter, pass3.expressed_confidence, pass3.internal_confidence);
  assertValid('final_verification', validateFinalVerification(final));

  onProgress?.('writing artifacts');
  mkdirSync(bundleDir, { recursive: true });
  const artifacts: [string, unknown][] = [
    ['pass1.reasoning_state.json', pass1],
    ['pass2.reasoning_state.json', pass2],
    ['pass3.reasoning_state.json', pass3],
    ['deterministic_verification.json', deterministic],
    ['arbiter_verification.json', arbiter],
    ['final_verification.json', final],
  ];
  for (const [filename, data] of artifacts) {
    writeFileSync(resolve(bundleDir, filename), JSON.stringify(data, null, 2) + '\n', 'utf-8');
  }
  writeRunManifest(bundleDir);

  return {
    profile_id: profileId,
    scenario_id: scenario.scenario_id,
    status: 'success',
    core_final_score: final.core_final_score,
    arbiter_pass_status: final.arbiter_pass_status,
    leaderboard_status: final.leaderboard_status,
    contradiction_overlap: deterministic.contradiction_overlap,
    gap_closure_rate: deterministic.gap_closure_rate,
    evasion_penalty_normalized: deterministic.evasion_penalty_normalized,
    semantic_density_drop_flag: deterministic.semantic_density_drop_flag,
    caps_applied: final.caps_applied.map(c => c.rule_id),
    bundle_dir: bundleDir,
  };
}

function writeIngestArtifacts(
  bundleDir: string,
  officialSubmission: ReturnType<typeof ingestBundle>,
): void {
  writeFileSync(
    resolve(bundleDir, 'leaderboard_submission.json'),
    JSON.stringify(officialSubmission, null, 2) + '\n',
    'utf-8',
  );
  writeFileSync(
    resolve(bundleDir, 'final_verification.ingested.json'),
    JSON.stringify(officialSubmission.final_verification, null, 2) + '\n',
    'utf-8',
  );
}

function attemptCalibrationIngest(
  bundleDir: string,
  modelProfile: ModelProfile,
): { leaderboard_status: string } {
  const secret = process.env[CALIBRATION_SECRET_ENV] ?? null;
  if (secret) {
    const attestorId = process.env[CALIBRATION_ATTESTOR_ID_ENV] ?? DEFAULT_CALIBRATION_ATTESTOR_ID;
    writeOfficialRunAttestation(bundleDir, secret, attestorId);
  }

  const submission = ingestBundle(bundleDir, secret);
  writeIngestArtifacts(bundleDir, submission);

  if (modelProfile.expected_official && !submission.official_submission) {
    throw new Error(`Ingest failure: profile ${modelProfile.profile_id} expected an official submission, but ingest returned unofficial (${submission.status_reason}).`);
  }

  return {
    leaderboard_status: submission.final_verification.leaderboard_status,
  };
}

function makeFailedResultFromSuccessfulRun(
  result: CalibrationRunResult,
  category: ErrorCategory,
  message: string,
): CalibrationRunResult {
  return {
    ...result,
    status: 'failed',
    error_category: category,
    error_message: message,
  };
}

function makeFailedResult(
  profileId: string,
  scenarioId: string,
  bundleDir: string,
  category: ErrorCategory,
  message: string,
): CalibrationRunResult {
  return {
    profile_id: profileId,
    scenario_id: scenarioId,
    status: 'failed',
    core_final_score: null,
    arbiter_pass_status: null,
    leaderboard_status: null,
    contradiction_overlap: null,
    gap_closure_rate: null,
    evasion_penalty_normalized: null,
    semantic_density_drop_flag: null,
    caps_applied: [],
    bundle_dir: bundleDir,
    error_category: category,
    error_message: message,
  };
}

function withScenarioDebugLogDir(
  args: Record<string, unknown> | undefined,
  bundleDir: string,
): Record<string, unknown> {
  return {
    ...(args ?? {}),
    debug_log_dir: resolve(bundleDir, 'diagnostics'),
  };
}

function progressJsonPath(outDir: string): string {
  return resolve(outDir, 'calibration_progress.json');
}

function progressLogPath(outDir: string): string {
  return resolve(outDir, 'calibration_progress.log');
}

function writeProgressState(outDir: string, progress: CalibrationProgress): void {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(progressJsonPath(outDir), JSON.stringify(progress, null, 2) + '\n', 'utf-8');
}

function appendProgressEvent(outDir: string, message: string): void {
  mkdirSync(outDir, { recursive: true });
  appendFileSync(progressLogPath(outDir), `${new Date().toISOString()} ${message}\n`, 'utf-8');
}

function emitProgress(message: string): void {
  process.stderr.write(`${message}\n`);
}

function updateProgressState(
  outDir: string,
  progress: CalibrationProgress,
  updates: Partial<CalibrationProgress>,
): void {
  Object.assign(progress, updates, { updated_at: new Date().toISOString() });
  writeProgressState(outDir, progress);
  if (typeof updates.last_event === 'string') {
    appendProgressEvent(outDir, updates.last_event);
  }
}

export async function runCalibrationMatrix(config: CalibrationRunConfig): Promise<CalibrationRunResult[]> {
  const profilesConfig = loadModelProfilesConfig(config.profileConfigPath);
  const allScenarios = loadNormalizedScenarios();
  const thresholdProfileId = config.thresholdProfileId || 'v1_provisional';

  let scenarioIds: string[];
  if (config.scenarioIds === 'all') {
    scenarioIds = allScenarios.map(s => s.scenario_id);
  } else {
    scenarioIds = config.scenarioIds;
    for (const id of scenarioIds) {
      if (!allScenarios.find(s => s.scenario_id === id)) {
        throw new Error(`Unknown scenario_id: ${id}. Available: ${allScenarios.map(s => s.scenario_id).join(', ')}`);
      }
    }
  }

  const results: CalibrationRunResult[] = [];
  const totalRuns = profilesConfig.profiles.length * scenarioIds.length;
  const progress: CalibrationProgress = {
    schema_version: 'v1.0',
    benchmark_id: 'invisible-tea-party',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    total_runs: totalRuns,
    completed_runs: 0,
    successful_runs: 0,
    failed_runs: 0,
    active_profile_id: null,
    active_scenario_id: null,
    active_step: null,
    active_state: 'starting',
    last_event: 'Calibration initialized.',
  };
  writeProgressState(config.outDir, progress);
  appendProgressEvent(config.outDir, progress.last_event);

  for (const modelProfile of profilesConfig.profiles) {
    console.log(`\n=== Profile: ${modelProfile.profile_id} ===`);
    console.log(`  Executor: ${modelProfile.pass_executor_module}`);
    const arbiterModulePath = config.arbiterModuleOverride ?? modelProfile.arbiter_module;
    console.log(`  Arbiter: ${arbiterModulePath}`);
    emitProgress(`=== Profile: ${modelProfile.profile_id} ===`);
    emitProgress(`  Executor: ${modelProfile.pass_executor_module}`);
    emitProgress(`  Arbiter: ${arbiterModulePath}`);
    updateProgressState(config.outDir, progress, {
      active_profile_id: modelProfile.profile_id,
      active_scenario_id: null,
      active_step: null,
      active_state: 'running',
      last_event: `Starting profile ${modelProfile.profile_id}.`,
    });

    for (const scenarioId of scenarioIds) {
      const scenario = allScenarios.find(s => s.scenario_id === scenarioId)!;
      const bundleDir = resolve(config.outDir, modelProfile.profile_id, scenarioId);
      console.log(`\n  Scenario: ${scenarioId}`);
      emitProgress(`  Scenario: ${scenarioId}`);
      updateProgressState(config.outDir, progress, {
        active_profile_id: modelProfile.profile_id,
        active_scenario_id: scenarioId,
        active_step: 'scenario setup',
        active_state: 'running',
        last_event: `Running ${modelProfile.profile_id}/${scenarioId}.`,
      });

      try {
        const executor = await loadPassExecutorModule(
          modelProfile.pass_executor_module,
          withScenarioDebugLogDir(modelProfile.executor_args, bundleDir),
        );
        const evaluator = await loadArbiterModule(
          arbiterModulePath,
          withScenarioDebugLogDir(modelProfile.arbiter_args, bundleDir),
        );
        const result = await runSingleScenario(
          scenario, executor, evaluator,
          modelProfile.profile_id, thresholdProfileId, bundleDir,
          (step) => {
            const message = `Running ${modelProfile.profile_id}/${scenarioId} (${step}).`;
            emitProgress(`    Step: ${step}`);
            updateProgressState(config.outDir, progress, {
              active_profile_id: modelProfile.profile_id,
              active_scenario_id: scenarioId,
              active_step: step,
              active_state: 'running',
              last_event: message,
            });
          },
        );
        let finalizedResult = result;

        if (modelProfile.attempt_ingest) {
          try {
            emitProgress('    Step: ingest');
            updateProgressState(config.outDir, progress, {
              active_profile_id: modelProfile.profile_id,
              active_scenario_id: scenarioId,
              active_step: 'ingest',
              active_state: 'running',
              last_event: `Running ${modelProfile.profile_id}/${scenarioId} (ingest).`,
            });
            const ingested = attemptCalibrationIngest(bundleDir, modelProfile);
            finalizedResult = {
              ...result,
              leaderboard_status: ingested.leaderboard_status,
            };
          } catch (err) {
            const classified = classifyError(err);
            console.error(`    INGEST FAILED [${classified.category}]: ${classified.message}`);
            results.push(makeFailedResultFromSuccessfulRun(result, classified.category, classified.message));
            continue;
          }
        }

        console.log(`    Score: ${finalizedResult.core_final_score?.toFixed(4)}`);
        console.log(`    Arbiter: ${finalizedResult.arbiter_pass_status}`);
        console.log(`    Overlap: ${finalizedResult.contradiction_overlap?.toFixed(3)}, GCR: ${finalizedResult.gap_closure_rate?.toFixed(3)}`);
        emitProgress(`    Score: ${finalizedResult.core_final_score?.toFixed(4)}`);
        emitProgress(`    Arbiter: ${finalizedResult.arbiter_pass_status}`);
        emitProgress(`    Overlap: ${finalizedResult.contradiction_overlap?.toFixed(3)}, GCR: ${finalizedResult.gap_closure_rate?.toFixed(3)}`);
        results.push(finalizedResult);
        updateProgressState(config.outDir, progress, {
          completed_runs: progress.completed_runs + 1,
          successful_runs: progress.successful_runs + 1,
          active_profile_id: modelProfile.profile_id,
          active_scenario_id: scenarioId,
          active_step: 'complete',
          active_state: 'completed',
          last_event: `Completed ${modelProfile.profile_id}/${scenarioId} with score ${finalizedResult.core_final_score?.toFixed(4) ?? 'n/a'}.`,
        });
      } catch (err) {
        const classified = classifyError(err);
        console.error(`    FAILED [${classified.category}]: ${classified.message}`);
        emitProgress(`    FAILED [${classified.category}]: ${classified.message}`);
        results.push(makeFailedResult(
          modelProfile.profile_id, scenarioId, bundleDir,
          classified.category, classified.message,
        ));
        updateProgressState(config.outDir, progress, {
          completed_runs: progress.completed_runs + 1,
          failed_runs: progress.failed_runs + 1,
          active_profile_id: modelProfile.profile_id,
          active_scenario_id: scenarioId,
          active_step: 'failed',
          active_state: 'failed',
          last_event: `Failed ${modelProfile.profile_id}/${scenarioId}: ${classified.category}.`,
        });
      }
    }
  }

  const successfulRuns = results.filter(r => r.status === 'success');
  const manifest: CalibrationManifest = {
    schema_version: 'v1.0',
    benchmark_id: 'invisible-tea-party',
    created_at: new Date().toISOString(),
    threshold_profile_id: thresholdProfileId,
    total_runs: results.length,
    successful_runs: successfulRuns.length,
    failed_runs: results.length - successfulRuns.length,
    results,
  };

  mkdirSync(config.outDir, { recursive: true });
  writeFileSync(
    resolve(config.outDir, 'calibration_manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n', 'utf-8',
  );

  // Also write calibration_matrix.json (same data, different name for discoverability)
  writeFileSync(
    resolve(config.outDir, 'calibration_matrix.json'),
    JSON.stringify(manifest, null, 2) + '\n', 'utf-8',
  );

  updateProgressState(config.outDir, progress, {
    active_profile_id: null,
    active_scenario_id: null,
    active_step: null,
    active_state: 'done',
    last_event: `Calibration finished: ${successfulRuns.length} successful, ${results.length - successfulRuns.length} failed.`,
  });

  console.log(`\nCalibration manifest written to ${resolve(config.outDir, 'calibration_manifest.json')}`);
  console.log(`Total: ${results.length} runs, ${successfulRuns.length} successful, ${results.length - successfulRuns.length} failed`);
  emitProgress(`Calibration manifest written to ${resolve(config.outDir, 'calibration_manifest.json')}`);
  emitProgress(`Total: ${results.length} runs, ${successfulRuns.length} successful, ${results.length - successfulRuns.length} failed`);

  return results;
}
