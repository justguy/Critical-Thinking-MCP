import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadNormalizedScenarios } from '../../benchmark/invisible-tea-party/ts/src/scenarioRegistry.js';
import { loadThresholdProfile } from '../../benchmark/invisible-tea-party/ts/src/config.js';
import { DeterministicVerifier } from '../../benchmark/invisible-tea-party/ts/src/deterministic.js';
import { ArbiterVerifier } from '../../benchmark/invisible-tea-party/ts/src/arbiter.js';
import { Reconciler } from '../../benchmark/invisible-tea-party/ts/src/reconcile.js';
import { buildReasoningState } from '../../benchmark/invisible-tea-party/ts/src/reasoningState.js';
import { buildPass1Prompt, buildPass2Prompt, buildPass3Prompt } from '../../benchmark/invisible-tea-party/ts/src/passPrompts.js';
import { writeRunManifest } from '../../benchmark/invisible-tea-party/ts/src/attestation.js';
import { ingestBundle } from '../../benchmark/invisible-tea-party/ts/src/ingest.js';
import { createPassExecutor } from '../../benchmark/invisible-tea-party/ts/fixtures/staticPassExecutor.js';
import { createArbiterEvaluator } from '../../benchmark/invisible-tea-party/ts/fixtures/staticArbiterEvaluator.js';
import {
  loadScorecardBundle,
  renderScorecardHtml,
} from '../../benchmark/invisible-tea-party/ts/src/renderScorecard.js';
import type { BringYourOwnEvaluator, Pass4BRequest } from '../../benchmark/invisible-tea-party/ts/src/arbiter.js';

describe('Invisible Tea Party: Scorecard Renderer', () => {
  const bundleDir = resolve('/tmp', `tea-scorecard-test-${randomUUID()}`);
  const scenarios = loadNormalizedScenarios();
  const scenario = scenarios.find(s => s.scenario_id === 'tea_001_ontology_spill')!;
  const profile = loadThresholdProfile('v1_provisional');
  const executor = createPassExecutor();
  const evaluator = createArbiterEvaluator();

  beforeAll(async () => {
    mkdirSync(bundleDir, { recursive: true });
    const lineageId = randomUUID();
    const metadata = executor.metadata();

    const pass1Prompt = buildPass1Prompt(scenario);
    const pass1Result = await executor.runPass1({ scenario, prompt: pass1Prompt });
    const pass1 = buildReasoningState({
      scenario, passId: 'pass1_answer', executorResult: pass1Result,
      executorMetadata: metadata, lineageId, parentArtifactId: null, critiqueTargetArtifactId: null,
    });

    const pass2Prompt = buildPass2Prompt(scenario, pass1);
    const pass2Result = await executor.runPass2({ scenario, pass1, prompt: pass2Prompt });
    const pass2 = buildReasoningState({
      scenario, passId: 'pass2_critique', executorResult: pass2Result,
      executorMetadata: metadata, lineageId, parentArtifactId: pass1.artifact_id, critiqueTargetArtifactId: pass1.artifact_id,
    });

    const pass3Prompt = buildPass3Prompt(scenario, pass1, pass2);
    const pass3Result = await executor.runPass3({ scenario, pass1, pass2, prompt: pass3Prompt });
    const pass3 = buildReasoningState({
      scenario, passId: 'pass3_repair', executorResult: pass3Result,
      executorMetadata: metadata, lineageId, parentArtifactId: pass2.artifact_id, critiqueTargetArtifactId: null,
    });

    const deterministicVerifier = new DeterministicVerifier(profile);
    const deterministic = deterministicVerifier.verify(scenario, pass1, pass2, pass3);
    const arbiterVerifier = new ArbiterVerifier(evaluator, profile);
    const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);
    const reconciler = new Reconciler(profile);
    const final = reconciler.reconcile(deterministic, arbiter, pass3.expressed_confidence, pass3.internal_confidence);

    const artifacts: [string, unknown][] = [
      ['pass1.reasoning_state.json', pass1],
      ['pass2.reasoning_state.json', pass2],
      ['pass3.reasoning_state.json', pass3],
      ['deterministic_verification.json', deterministic],
      ['arbiter_verification.json', arbiter],
      ['final_verification.json', final],
    ];
    for (const [filename, data] of artifacts) {
      writeFileSync(resolve(bundleDir, filename), JSON.stringify(data, null, 2), 'utf-8');
    }
    writeRunManifest(bundleDir);
    ingestBundle(bundleDir, null);
    writeFileSync(
      resolve(bundleDir, 'leaderboard_submission.json'),
      JSON.stringify(ingestBundle(bundleDir, null), null, 2),
      'utf-8',
    );
  });

  it('reads a real fixture bundle and writes HTML', () => {
    const bundle = loadScorecardBundle(bundleDir);
    const html = renderScorecardHtml(bundle);
    const outFile = resolve(bundleDir, 'scorecard.html');
    writeFileSync(outFile, html, 'utf-8');
    expect(existsSync(outFile)).toBe(true);
    expect(html.length).toBeGreaterThan(1000);
  });

  it('rendered HTML includes the core score and leaderboard status', () => {
    const bundle = loadScorecardBundle(bundleDir);
    const html = renderScorecardHtml(bundle);
    expect(html).toContain('Core Final Score');
    expect(html).toContain('%');
    expect(html).toContain('Unofficial');
  });

  it('missing optional fields do not crash rendering', () => {
    const bundle = loadScorecardBundle(bundleDir);
    bundle.leaderboardSubmission = null;
    bundle.pass1 = null;
    bundle.pass2 = null;
    bundle.pass3 = null;
    const html = renderScorecardHtml(bundle);
    expect(html).toContain('Core Final Score');
    expect(html.length).toBeGreaterThan(1000);
  });

  it('arbiter-unavailable runs still render honestly', async () => {
    const unavailDir = resolve('/tmp', `tea-scorecard-unavail-${randomUUID()}`);
    mkdirSync(unavailDir, { recursive: true });
    try {
      const unavailableEvaluator: BringYourOwnEvaluator = {
        async evaluate_pass_4b(_request: Pass4BRequest) {
          return { pass_status: 'UNAVAILABLE' as const, errors: ['Simulated failure.'] };
        },
        async metadata() {
          return { arbiter_model_id: 'test-model', arbiter_provider: 'test-provider' };
        },
      };

      const lineageId = randomUUID();
      const metadata = executor.metadata();

      const pass1Prompt = buildPass1Prompt(scenario);
      const pass1Result = await executor.runPass1({ scenario, prompt: pass1Prompt });
      const pass1 = buildReasoningState({
        scenario, passId: 'pass1_answer', executorResult: pass1Result,
        executorMetadata: metadata, lineageId, parentArtifactId: null, critiqueTargetArtifactId: null,
      });
      const pass2Prompt = buildPass2Prompt(scenario, pass1);
      const pass2Result = await executor.runPass2({ scenario, pass1, prompt: pass2Prompt });
      const pass2 = buildReasoningState({
        scenario, passId: 'pass2_critique', executorResult: pass2Result,
        executorMetadata: metadata, lineageId, parentArtifactId: pass1.artifact_id, critiqueTargetArtifactId: pass1.artifact_id,
      });
      const pass3Prompt = buildPass3Prompt(scenario, pass1, pass2);
      const pass3Result = await executor.runPass3({ scenario, pass1, pass2, prompt: pass3Prompt });
      const pass3 = buildReasoningState({
        scenario, passId: 'pass3_repair', executorResult: pass3Result,
        executorMetadata: metadata, lineageId, parentArtifactId: pass2.artifact_id, critiqueTargetArtifactId: null,
      });

      const deterministicVerifier = new DeterministicVerifier(profile);
      const deterministic = deterministicVerifier.verify(scenario, pass1, pass2, pass3);
      const arbiterVerifier = new ArbiterVerifier(unavailableEvaluator, profile);
      const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);
      const reconciler = new Reconciler(profile);
      const final = reconciler.reconcile(deterministic, arbiter, pass3.expressed_confidence, pass3.internal_confidence);

      const artifacts: [string, unknown][] = [
        ['pass1.reasoning_state.json', pass1],
        ['pass2.reasoning_state.json', pass2],
        ['pass3.reasoning_state.json', pass3],
        ['deterministic_verification.json', deterministic],
        ['arbiter_verification.json', arbiter],
        ['final_verification.json', final],
      ];
      for (const [filename, data] of artifacts) {
        writeFileSync(resolve(unavailDir, filename), JSON.stringify(data, null, 2), 'utf-8');
      }

      const bundle = loadScorecardBundle(unavailDir);
      const html = renderScorecardHtml(bundle);
      expect(html).toContain('Arbiter Unavailable');
      expect(html).toContain('UNAVAILABLE');
      expect(html).toContain('Core Final Score');
    } finally {
      rmSync(unavailDir, { recursive: true, force: true });
    }
  });

  it('uses canonical scenario metadata for prompt family labels', async () => {
    const familyDir = resolve('/tmp', `tea-scorecard-family-${randomUUID()}`);
    mkdirSync(familyDir, { recursive: true });
    try {
      const familyScenario = scenarios.find(s => s.scenario_id === 'tea_003_consensus_occupant')!;
      const lineageId = randomUUID();
      const metadata = executor.metadata();

      const pass1Prompt = buildPass1Prompt(familyScenario);
      const pass1Result = await executor.runPass1({ scenario: familyScenario, prompt: pass1Prompt });
      const pass1 = buildReasoningState({
        scenario: familyScenario, passId: 'pass1_answer', executorResult: pass1Result,
        executorMetadata: metadata, lineageId, parentArtifactId: null, critiqueTargetArtifactId: null,
      });
      const pass2Prompt = buildPass2Prompt(familyScenario, pass1);
      const pass2Result = await executor.runPass2({ scenario: familyScenario, pass1, prompt: pass2Prompt });
      const pass2 = buildReasoningState({
        scenario: familyScenario, passId: 'pass2_critique', executorResult: pass2Result,
        executorMetadata: metadata, lineageId, parentArtifactId: pass1.artifact_id, critiqueTargetArtifactId: pass1.artifact_id,
      });
      const pass3Prompt = buildPass3Prompt(familyScenario, pass1, pass2);
      const pass3Result = await executor.runPass3({ scenario: familyScenario, pass1, pass2, prompt: pass3Prompt });
      const pass3 = buildReasoningState({
        scenario: familyScenario, passId: 'pass3_repair', executorResult: pass3Result,
        executorMetadata: metadata, lineageId, parentArtifactId: pass2.artifact_id, critiqueTargetArtifactId: null,
      });

      const deterministicVerifier = new DeterministicVerifier(profile);
      const deterministic = deterministicVerifier.verify(familyScenario, pass1, pass2, pass3);
      const arbiterVerifier = new ArbiterVerifier(evaluator, profile);
      const arbiter = await arbiterVerifier.verify(familyScenario, pass1, pass2, pass3, deterministic);
      const reconciler = new Reconciler(profile);
      const final = reconciler.reconcile(deterministic, arbiter, pass3.expressed_confidence, pass3.internal_confidence);

      const artifacts: [string, unknown][] = [
        ['pass1.reasoning_state.json', pass1],
        ['pass2.reasoning_state.json', pass2],
        ['pass3.reasoning_state.json', pass3],
        ['deterministic_verification.json', deterministic],
        ['arbiter_verification.json', arbiter],
        ['final_verification.json', final],
      ];
      for (const [filename, data] of artifacts) {
        writeFileSync(resolve(familyDir, filename), JSON.stringify(data, null, 2), 'utf-8');
      }

      const bundle = loadScorecardBundle(familyDir);
      const html = renderScorecardHtml(bundle);
      expect(html).toContain('social_consensus');
    } finally {
      rmSync(familyDir, { recursive: true, force: true });
    }
  });

  // Cleanup
  afterAll(() => {
    rmSync(bundleDir, { recursive: true, force: true });
  });
});
