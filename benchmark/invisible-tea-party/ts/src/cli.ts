import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadNormalizedScenarios } from './scenarioRegistry.js';
import { loadThresholdProfile } from './config.js';
import { loadPassExecutorModule, loadArbiterModule } from './moduleLoader.js';
import { writeRunManifest } from './attestation.js';
import { buildReasoningState } from './reasoningState.js';
import { buildPass1Prompt, buildPass2Prompt, buildPass3Prompt } from './passPrompts.js';
import { DeterministicVerifier } from './deterministic.js';
import { ArbiterVerifier } from './arbiter.js';
import { Reconciler } from './reconcile.js';
import {
  assertValid,
  validateReasoningState,
  validateDeterministicVerification,
  validateArbiterVerification,
  validateFinalVerification,
} from './schemaValidation.js';
import type { PassExecutor } from './passExecutor.js';
import type { Scenario } from './models.js';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') && i + 1 < argv.length) {
      const key = arg.slice(2);
      args[key] = argv[++i];
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const scenarioId = args['scenario-id'];
  const outDir = args['out-dir'] || '/tmp/invisible-tea-party-output';
  const debugLogDir = resolve(outDir, 'diagnostics');
  const passExecutorModulePath = args['pass-executor-module'];
  const arbiterModulePath = args['arbiter-module'];
  const thresholdProfileId = args['threshold-profile'] || 'v1_provisional';

  if (!scenarioId) {
    console.error('Error: --scenario-id is required.');
    process.exit(1);
  }
  if (!passExecutorModulePath) {
    console.error('Error: --pass-executor-module is required.');
    process.exit(1);
  }
  if (!arbiterModulePath) {
    console.error('Error: --arbiter-module is required.');
    process.exit(1);
  }

  const scenarios = loadNormalizedScenarios();
  const scenario = scenarios.find(s => s.scenario_id === scenarioId);
  if (!scenario) {
    console.error(`Error: Unknown scenario_id "${scenarioId}". Available: ${scenarios.map(s => s.scenario_id).join(', ')}`);
    process.exit(1);
  }

  console.log(`Loading pass executor from ${passExecutorModulePath}...`);
  const executor = await loadPassExecutorModule(passExecutorModulePath, {
    debug_log_dir: debugLogDir,
  });

  console.log(`Loading arbiter evaluator from ${arbiterModulePath}...`);
  const evaluator = await loadArbiterModule(arbiterModulePath, {
    debug_log_dir: debugLogDir,
  });

  const profile = loadThresholdProfile(thresholdProfileId);
  const lineageId = randomUUID();
  const metadata = executor.metadata();

  console.log(`Running scenario: ${scenarioId}`);
  console.log(`Lineage: ${lineageId}`);

  // Pass 1
  console.log('Running Pass 1 (Answer)...');
  const pass1Prompt = buildPass1Prompt(scenario);
  const pass1Result = await executor.runPass1({
    scenario,
    prompt: pass1Prompt,
  });
  const pass1 = buildReasoningState({
    scenario,
    passId: 'pass1_answer',
    executorResult: pass1Result,
    executorMetadata: metadata,
    lineageId,
    parentArtifactId: null,
    critiqueTargetArtifactId: null,
  });
  assertValid('pass1.reasoning_state', validateReasoningState(pass1));
  console.log(`  Pass 1 artifact: ${pass1.artifact_id} (${pass1.word_count} words)`);

  // Pass 2
  console.log('Running Pass 2 (Critique)...');
  const pass2Prompt = buildPass2Prompt(scenario, pass1);
  const pass2Result = await executor.runPass2({
    scenario,
    pass1,
    prompt: pass2Prompt,
  });
  const pass2 = buildReasoningState({
    scenario,
    passId: 'pass2_critique',
    executorResult: pass2Result,
    executorMetadata: metadata,
    lineageId,
    parentArtifactId: pass1.artifact_id,
    critiqueTargetArtifactId: pass1.artifact_id,
  });
  assertValid('pass2.reasoning_state', validateReasoningState(pass2));
  console.log(`  Pass 2 artifact: ${pass2.artifact_id} (${pass2.word_count} words)`);

  // Pass 3
  console.log('Running Pass 3 (Repair)...');
  const pass3Prompt = buildPass3Prompt(scenario, pass1, pass2);
  const pass3Result = await executor.runPass3({
    scenario,
    pass1,
    pass2,
    prompt: pass3Prompt,
  });
  const pass3 = buildReasoningState({
    scenario,
    passId: 'pass3_repair',
    executorResult: pass3Result,
    executorMetadata: metadata,
    lineageId,
    parentArtifactId: pass2.artifact_id,
    critiqueTargetArtifactId: null,
  });
  assertValid('pass3.reasoning_state', validateReasoningState(pass3));
  console.log(`  Pass 3 artifact: ${pass3.artifact_id} (${pass3.word_count} words)`);

  // Pass 4A: Deterministic verification
  console.log('Running Pass 4A (Deterministic Verification)...');
  const deterministicVerifier = new DeterministicVerifier(profile);
  const deterministic = deterministicVerifier.verify(scenario, pass1, pass2, pass3);
  assertValid('deterministic_verification', validateDeterministicVerification(deterministic));
  console.log(`  Contradiction overlap: ${deterministic.contradiction_overlap.toFixed(3)}`);
  console.log(`  Gap closure rate: ${deterministic.gap_closure_rate.toFixed(3)}`);

  // Pass 4B: Arbiter verification
  console.log('Running Pass 4B (Arbiter Verification)...');
  const arbiterVerifier = new ArbiterVerifier(evaluator, profile);
  const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);
  assertValid('arbiter_verification', validateArbiterVerification(arbiter));
  console.log(`  Arbiter status: ${arbiter.pass_status}`);

  // Pass 4C: Reconciliation
  console.log('Running Pass 4C (Reconciliation)...');
  const reconciler = new Reconciler(profile);
  const final = reconciler.reconcile(deterministic, arbiter, pass3.expressed_confidence, pass3.internal_confidence);
  assertValid('final_verification', validateFinalVerification(final));
  console.log(`  Core final score: ${final.core_final_score.toFixed(4)}`);
  console.log(`  Arbiter pass status: ${final.arbiter_pass_status}`);
  console.log(`  Leaderboard status: ${final.leaderboard_status}`);

  // Write artifacts
  mkdirSync(outDir, { recursive: true });
  const artifacts: [string, unknown][] = [
    ['pass1.reasoning_state.json', pass1],
    ['pass2.reasoning_state.json', pass2],
    ['pass3.reasoning_state.json', pass3],
    ['deterministic_verification.json', deterministic],
    ['arbiter_verification.json', arbiter],
    ['final_verification.json', final],
  ];
  for (const [filename, data] of artifacts) {
    const filepath = resolve(outDir, filename);
    writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`  Wrote ${filepath}`);
  }
  const manifest = writeRunManifest(outDir);
  console.log(`  Wrote ${resolve(outDir, 'run_manifest.json')}`);
  console.log(`  Bundle hash: ${manifest.bundle_hash}`);

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
