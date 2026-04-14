import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadNormalizedScenarios } from '../../benchmark/invisible-tea-party/ts/src/scenarioRegistry.js';
import { loadThresholdProfile } from '../../benchmark/invisible-tea-party/ts/src/config.js';
import { DeterministicVerifier } from '../../benchmark/invisible-tea-party/ts/src/deterministic.js';
import { ArbiterVerifier } from '../../benchmark/invisible-tea-party/ts/src/arbiter.js';
import { Reconciler } from '../../benchmark/invisible-tea-party/ts/src/reconcile.js';
import { buildReasoningState } from '../../benchmark/invisible-tea-party/ts/src/reasoningState.js';
import { buildPass1Prompt, buildPass2Prompt, buildPass3Prompt } from '../../benchmark/invisible-tea-party/ts/src/passPrompts.js';
import { createOfficialRunAttestation, writeRunManifest } from '../../benchmark/invisible-tea-party/ts/src/attestation.js';
import { ingestBundle } from '../../benchmark/invisible-tea-party/ts/src/ingest.js';
import {
  assertValid,
  validateReasoningState,
  validateDeterministicVerification,
  validateArbiterVerification,
  validateFinalVerification,
  validateLeaderboardSubmission,
} from '../../benchmark/invisible-tea-party/ts/src/schemaValidation.js';
import { createPassExecutor } from '../../benchmark/invisible-tea-party/ts/fixtures/staticPassExecutor.js';
import { createArbiterEvaluator } from '../../benchmark/invisible-tea-party/ts/fixtures/staticArbiterEvaluator.js';
import type { BringYourOwnEvaluator, Pass4BRequest } from '../../benchmark/invisible-tea-party/ts/src/arbiter.js';

describe('Invisible Tea Party: Pipeline', () => {
  const scenarios = loadNormalizedScenarios();
  const scenario = scenarios.find(s => s.scenario_id === 'tea_001_ontology_spill')!;
  const profile = loadThresholdProfile('v1_provisional');
  const executor = createPassExecutor();
  const evaluator = createArbiterEvaluator();

  async function runFullPipeline() {
    const lineageId = randomUUID();
    const metadata = executor.metadata();

    const pass1Prompt = buildPass1Prompt(scenario);
    const pass1Result = await executor.runPass1({ scenario, prompt: pass1Prompt });
    const pass1 = buildReasoningState({
      scenario,
      passId: 'pass1_answer',
      executorResult: pass1Result,
      executorMetadata: metadata,
      lineageId,
      parentArtifactId: null,
      critiqueTargetArtifactId: null,
    });

    const pass2Prompt = buildPass2Prompt(scenario, pass1);
    const pass2Result = await executor.runPass2({ scenario, pass1, prompt: pass2Prompt });
    const pass2 = buildReasoningState({
      scenario,
      passId: 'pass2_critique',
      executorResult: pass2Result,
      executorMetadata: metadata,
      lineageId,
      parentArtifactId: pass1.artifact_id,
      critiqueTargetArtifactId: pass1.artifact_id,
    });

    const pass3Prompt = buildPass3Prompt(scenario, pass1, pass2);
    const pass3Result = await executor.runPass3({ scenario, pass1, pass2, prompt: pass3Prompt });
    const pass3 = buildReasoningState({
      scenario,
      passId: 'pass3_repair',
      executorResult: pass3Result,
      executorMetadata: metadata,
      lineageId,
      parentArtifactId: pass2.artifact_id,
      critiqueTargetArtifactId: null,
    });

    const deterministicVerifier = new DeterministicVerifier(profile);
    const deterministic = deterministicVerifier.verify(scenario, pass1, pass2, pass3);

    const arbiterVerifier = new ArbiterVerifier(evaluator, profile);
    const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);

    const reconciler = new Reconciler(profile);
    const final = reconciler.reconcile(deterministic, arbiter, pass3.expressed_confidence, pass3.internal_confidence);

    return { pass1, pass2, pass3, deterministic, arbiter, final };
  }

  it('runs end-to-end fixture pipeline and all artifacts validate', async () => {
    const { pass1, pass2, pass3, deterministic, arbiter, final } = await runFullPipeline();

    assertValid('pass1', validateReasoningState(pass1));
    assertValid('pass2', validateReasoningState(pass2));
    assertValid('pass3', validateReasoningState(pass3));
    assertValid('deterministic', validateDeterministicVerification(deterministic));
    assertValid('arbiter', validateArbiterVerification(arbiter));
    assertValid('final', validateFinalVerification(final));
  });

  it('deterministic verification validates against schema', async () => {
    const { deterministic } = await runFullPipeline();
    const result = validateDeterministicVerification(deterministic);
    expect(result.valid).toBe(true);
    expect(deterministic.contradiction_overlap).toBeGreaterThanOrEqual(0);
    expect(deterministic.contradiction_overlap).toBeLessThanOrEqual(1);
    expect(deterministic.gap_closure_rate).toBeGreaterThanOrEqual(0);
    expect(deterministic.gap_closure_rate).toBeLessThanOrEqual(1);
  });

  it('final verification includes required fields', async () => {
    const { final } = await runFullPipeline();
    expect(final).toHaveProperty('core_final_score');
    expect(final).toHaveProperty('arbiter_pass_status');
    expect(final).toHaveProperty('leaderboard_status');
    expect(final.core_final_score).toBeGreaterThanOrEqual(0);
    expect(final.core_final_score).toBeLessThanOrEqual(1);
  });

  it('arbiter unavailable path fails open correctly', async () => {
    const unavailableEvaluator: BringYourOwnEvaluator = {
      async evaluate_pass_4b(_request: Pass4BRequest) {
        return {
          pass_status: 'UNAVAILABLE' as const,
          errors: ['Simulated arbiter failure for testing.'],
        };
      },
      async metadata() {
        return {
          arbiter_model_id: 'test-model',
          arbiter_provider: 'test-provider',
        };
      },
    };

    const lineageId = randomUUID();
    const metadata = executor.metadata();

    const pass1Prompt = buildPass1Prompt(scenario);
    const pass1Result = await executor.runPass1({ scenario, prompt: pass1Prompt });
    const pass1 = buildReasoningState({
      scenario,
      passId: 'pass1_answer',
      executorResult: pass1Result,
      executorMetadata: metadata,
      lineageId,
      parentArtifactId: null,
      critiqueTargetArtifactId: null,
    });
    const pass2Prompt = buildPass2Prompt(scenario, pass1);
    const pass2Result = await executor.runPass2({ scenario, pass1, prompt: pass2Prompt });
    const pass2 = buildReasoningState({
      scenario,
      passId: 'pass2_critique',
      executorResult: pass2Result,
      executorMetadata: metadata,
      lineageId,
      parentArtifactId: pass1.artifact_id,
      critiqueTargetArtifactId: pass1.artifact_id,
    });
    const pass3Prompt = buildPass3Prompt(scenario, pass1, pass2);
    const pass3Result = await executor.runPass3({ scenario, pass1, pass2, prompt: pass3Prompt });
    const pass3 = buildReasoningState({
      scenario,
      passId: 'pass3_repair',
      executorResult: pass3Result,
      executorMetadata: metadata,
      lineageId,
      parentArtifactId: pass2.artifact_id,
      critiqueTargetArtifactId: null,
    });

    const deterministicVerifier = new DeterministicVerifier(profile);
    const deterministic = deterministicVerifier.verify(scenario, pass1, pass2, pass3);

    const arbiterVerifier = new ArbiterVerifier(unavailableEvaluator, profile);
    const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);

    expect(arbiter.pass_status).toBe('UNAVAILABLE');
    assertValid('arbiter_unavailable', validateArbiterVerification(arbiter));

    const reconciler = new Reconciler(profile);
    const final = reconciler.reconcile(deterministic, arbiter, pass3.expressed_confidence, pass3.internal_confidence);
    assertValid('final_unavailable', validateFinalVerification(final));
    expect(final.arbiter_pass_status).toBe('UNAVAILABLE');
  });

  it('certified arbiter remains unofficial without explicit attestation', async () => {
    const { final } = await runFullPipeline();
    expect(final.arbiter_metadata.certified).toBe(true);
    expect(final.arbiter_metadata.official_run_attested).toBe(false);
    expect(final.arbiter_metadata.official_score_eligible).toBe(false);
    expect(final.leaderboard_status).toBe('unofficial_custom_arbiter');
  });

  it('unofficial arbiter status resolves correctly for custom arbiter', async () => {
    const customEvaluator: BringYourOwnEvaluator = {
      async evaluate_pass_4b(_request: Pass4BRequest) {
        return {
          pass_status: 'AVAILABLE' as const,
          payload: {
            premise_rejection_quality: 'generic',
            repair_quality: 'partial',
            sycophancy_triggered: false,
            type_error_severity: 'low',
            causal_reasoning_integrity: 'weak',
            justification: 'Custom arbiter evaluation.',
            cited_span_refs: [],
          },
        };
      },
      async metadata() {
        return {
          arbiter_model_id: 'custom-model-v1',
          arbiter_provider: 'custom-provider',
        };
      },
    };

    const lineageId = randomUUID();
    const metadata = executor.metadata();

    const pass1Prompt = buildPass1Prompt(scenario);
    const pass1Result = await executor.runPass1({ scenario, prompt: pass1Prompt });
    const pass1 = buildReasoningState({
      scenario,
      passId: 'pass1_answer',
      executorResult: pass1Result,
      executorMetadata: metadata,
      lineageId,
      parentArtifactId: null,
      critiqueTargetArtifactId: null,
    });
    const pass2Prompt = buildPass2Prompt(scenario, pass1);
    const pass2Result = await executor.runPass2({ scenario, pass1, prompt: pass2Prompt });
    const pass2 = buildReasoningState({
      scenario,
      passId: 'pass2_critique',
      executorResult: pass2Result,
      executorMetadata: metadata,
      lineageId,
      parentArtifactId: pass1.artifact_id,
      critiqueTargetArtifactId: pass1.artifact_id,
    });
    const pass3Prompt = buildPass3Prompt(scenario, pass1, pass2);
    const pass3Result = await executor.runPass3({ scenario, pass1, pass2, prompt: pass3Prompt });
    const pass3 = buildReasoningState({
      scenario,
      passId: 'pass3_repair',
      executorResult: pass3Result,
      executorMetadata: metadata,
      lineageId,
      parentArtifactId: pass2.artifact_id,
      critiqueTargetArtifactId: null,
    });

    const deterministicVerifier = new DeterministicVerifier(profile);
    const deterministic = deterministicVerifier.verify(scenario, pass1, pass2, pass3);
    const arbiterVerifier = new ArbiterVerifier(customEvaluator, profile);
    const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);
    const reconciler = new Reconciler(profile);
    const final = reconciler.reconcile(deterministic, arbiter, pass3.expressed_confidence, pass3.internal_confidence);

    expect(final.arbiter_metadata.certified).toBe(false);
    expect(final.arbiter_metadata.official_run_attested).toBe(false);
    expect(final.arbiter_metadata.official_score_eligible).toBe(false);
    expect(final.leaderboard_status).toBe('unofficial_custom_arbiter');
    expect(final.arbiter_metadata.certification_label).toBeNull();
  });

  it('canonicalizes arbiter cited spans to real artifact IDs and offsets', async () => {
    const { pass3, arbiter } = await runFullPipeline();
    expect(arbiter.cited_span_refs).toHaveLength(1);
    const span = arbiter.cited_span_refs[0];
    expect(span.artifact_id).toBe(pass3.artifact_id);
    expect(span.excerpt).toBe(pass3.raw_text.slice(span.start_char, span.end_char));
  });

  it('normalizes structured arbiter rubric objects into flat scoring fields', async () => {
    const structuredEvaluator: BringYourOwnEvaluator = {
      async evaluate_pass_4b(_request: Pass4BRequest) {
        return {
          pass_status: 'AVAILABLE' as const,
          payload: {
            premise_rejection_quality: {
              value: 'specific',
              evidence: [{ artifact_id: 'pass3', excerpt: 'The scenario contains three fundamental violations:' }],
              rationale: 'Specific mechanical boundary identified.',
            },
            repair_quality: {
              value: 'substantive',
              evidence: [{ artifact_id: 'pass3', excerpt: 'The scenario contains three fundamental violations:' }],
              rationale: 'Substantive rewrite.',
            },
            type_error_severity: {
              value: 'high',
              evidence: [{ artifact_id: 'pass1', excerpt: 'The scenario contains three fundamental violations:' }],
              rationale: 'High-severity ontology collapse.',
            },
            causal_reasoning_integrity: {
              value: 'strong',
              evidence: [{ artifact_id: 'pass3', excerpt: 'The scenario contains three fundamental violations:' }],
              rationale: 'Causal reasoning stayed grounded.',
            },
          },
        };
      },
      async metadata() {
        return {
          arbiter_model_id: 'custom-structured',
          arbiter_provider: 'custom-provider',
        };
      },
    };

    const { pass1, pass2, pass3, deterministic } = await runFullPipeline();
    const arbiterVerifier = new ArbiterVerifier(structuredEvaluator, profile);
    const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);

    expect(arbiter.pass_status).toBe('AVAILABLE');
    expect(arbiter.premise_rejection_quality).toBe('specific');
    expect(arbiter.repair_quality).toBe('substantive');
    expect(arbiter.type_error_severity).toBe('high');
    expect(arbiter.causal_reasoning_integrity).toBe('strong');
    expect(arbiter.sycophancy_triggered).toBe(false);
    expect(arbiter.justification.length).toBeGreaterThan(0);
    expect(arbiter.cited_span_refs.length).toBeGreaterThan(0);
  });

  it('normalizes top-level scores wrappers with citations arrays', async () => {
    const scoresWrapperEvaluator: BringYourOwnEvaluator = {
      async evaluate_pass_4b(_request: Pass4BRequest) {
        return {
          pass_status: 'AVAILABLE' as const,
          payload: {
            scenario_id: 'tea_001_ontology_spill',
            scores: {
              premise_rejection_quality: {
                value: 'specific',
                justification: 'Specific rejection.',
                cited_span: { artifact_id: 'pass3', excerpt: 'The scenario contains three fundamental violations:' },
              },
              repair_quality: {
                value: 'substantive',
                justification: 'Substantive repair.',
                supporting_span: { artifact_id: 'pass3', excerpt: 'The scenario contains three fundamental violations:' },
              },
              type_error_severity: {
                value: 'high',
                justification: 'High-severity type error.',
                cited_spans: [{ artifact_id: 'pass1', excerpt: 'The scenario contains three fundamental violations:' }],
              },
              causal_reasoning_integrity: {
                value: 'strong',
                justification: 'Strong causal reasoning.',
                supporting_spans: [{ artifact_id: 'pass3', excerpt: 'The scenario contains three fundamental violations:' }],
              },
            },
          },
        };
      },
      async metadata() {
        return {
          arbiter_model_id: 'custom-scores-wrapper',
          arbiter_provider: 'custom-provider',
        };
      },
    };

    const { pass1, pass2, pass3, deterministic } = await runFullPipeline();
    const arbiterVerifier = new ArbiterVerifier(scoresWrapperEvaluator, profile);
    const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);

    expect(arbiter.pass_status).toBe('AVAILABLE');
    expect(arbiter.premise_rejection_quality).toBe('specific');
    expect(arbiter.repair_quality).toBe('substantive');
    expect(arbiter.type_error_severity).toBe('high');
    expect(arbiter.causal_reasoning_integrity).toBe('strong');
    expect(arbiter.cited_span_refs.length).toBeGreaterThan(0);
  });

  it('normalizes flat enum fields with sibling evidence objects and singular citation aliases', async () => {
    const siblingEvidenceEvaluator: BringYourOwnEvaluator = {
      async evaluate_pass_4b(_request: Pass4BRequest) {
        return {
          pass_status: 'AVAILABLE' as const,
          payload: {
            premise_rejection_quality: 'specific',
            premise_rejection_quality_evidence: {
              artifact_id: 'pass3',
              excerpt: 'The scenario contains three fundamental violations:',
              rationale: 'Pass 3 identifies the exact ontological boundary crossing.',
            },
            repair_quality: 'substantive',
            repair_quality_evidence: {
              citation: {
                artifact_id: 'pass3',
                excerpt: 'The scenario contains three fundamental violations:',
                rationale: 'Pass 3 rewrites the scenario instead of smoothing it over.',
              },
            },
            type_error_severity: 'high',
            type_error_severity_evidence: {
              artifact_id: 'pass1',
              excerpt: 'The scenario contains three fundamental violations:',
              note: 'The failure is a hard cross-domain type collapse.',
            },
            causal_reasoning_integrity: 'strong',
            causal_reasoning_integrity_evidence: {
              artifact_id: 'pass3',
              excerpt: 'The scenario contains three fundamental violations:',
              justification: 'The revised causal chain is grounded and explicit.',
            },
          },
        };
      },
      async metadata() {
        return {
          arbiter_model_id: 'custom-sibling-evidence',
          arbiter_provider: 'custom-provider',
        };
      },
    };

    const { pass1, pass2, pass3, deterministic } = await runFullPipeline();
    const arbiterVerifier = new ArbiterVerifier(siblingEvidenceEvaluator, profile);
    const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);

    expect(arbiter.pass_status).toBe('AVAILABLE');
    expect(arbiter.premise_rejection_quality).toBe('specific');
    expect(arbiter.repair_quality).toBe('substantive');
    expect(arbiter.type_error_severity).toBe('high');
    expect(arbiter.causal_reasoning_integrity).toBe('strong');
    expect(arbiter.justification.length).toBeGreaterThan(0);
    expect(arbiter.cited_span_refs.length).toBeGreaterThan(0);
  });

  it('accepts evidence objects that use artifact alias instead of artifact_id', async () => {
    const artifactAliasEvaluator: BringYourOwnEvaluator = {
      async evaluate_pass_4b(_request: Pass4BRequest) {
        return {
          pass_status: 'AVAILABLE' as const,
          payload: {
            premise_rejection_quality: 'specific',
            premise_rejection_quality_evidence: {
              artifact: 'pass1',
              excerpt: 'The scenario contains three fundamental violations:',
              rationale: 'Pass 1 identifies the contradiction specifically.',
            },
            repair_quality: 'substantive',
            repair_quality_evidence: {
              artifact: 'pass3',
              excerpt: 'The scenario contains three fundamental violations:',
              rationale: 'Pass 3 repairs the failure directly.',
            },
            type_error_severity: 'high',
            type_error_severity_evidence: {
              artifact: 'pass3',
              excerpt: 'The scenario contains three fundamental violations:',
              rationale: 'Type violation is load-bearing.',
            },
            causal_reasoning_integrity: 'strong',
            causal_reasoning_integrity_evidence: {
              artifact: 'pass3',
              excerpt: 'The scenario contains three fundamental violations:',
              rationale: 'Causal chain remains grounded.',
            },
          },
        };
      },
      async metadata() {
        return {
          arbiter_model_id: 'custom-artifact-alias',
          arbiter_provider: 'custom-provider',
        };
      },
    };

    const { pass1, pass2, pass3, deterministic } = await runFullPipeline();
    const arbiterVerifier = new ArbiterVerifier(artifactAliasEvaluator, profile);
    const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);

    expect(arbiter.pass_status).toBe('AVAILABLE');
    expect(arbiter.cited_span_refs.length).toBeGreaterThan(0);
  });

  it('normalizes score wrappers and synthesizes justification from evidence notes', async () => {
    const scoreAliasEvaluator: BringYourOwnEvaluator = {
      async evaluate_pass_4b(_request: Pass4BRequest) {
        return {
          pass_status: 'AVAILABLE' as const,
          payload: {
            scores: {
              premise_rejection_quality: {
                score: 'specific',
                citations: [{ artifact_id: 'pass1', excerpt: 'The scenario contains three fundamental violations:', note: 'Specific boundary identified.' }],
              },
              repair_quality: {
                score: 'substantive',
                evidence: [{ artifact_id: 'pass3', excerpt: 'The scenario contains three fundamental violations:', note: 'Repair is substantive.' }],
              },
              type_error_severity: {
                score: 'high',
                citation: { artifact_id: 'pass1', excerpt: 'The scenario contains three fundamental violations:', note: 'High-severity type collapse.' },
              },
              causal_reasoning_integrity: {
                score: 'strong',
                supporting_spans: [{ artifact_id: 'pass3', excerpt: 'The scenario contains three fundamental violations:', note: 'Causal chain remains grounded.' }],
              },
            },
          },
        };
      },
      async metadata() {
        return {
          arbiter_model_id: 'custom-score-aliases',
          arbiter_provider: 'custom-provider',
        };
      },
    };

    const { pass1, pass2, pass3, deterministic } = await runFullPipeline();
    const arbiterVerifier = new ArbiterVerifier(scoreAliasEvaluator, profile);
    const arbiter = await arbiterVerifier.verify(scenario, pass1, pass2, pass3, deterministic);

    expect(arbiter.pass_status).toBe('AVAILABLE');
    expect(arbiter.premise_rejection_quality).toBe('specific');
    expect(arbiter.repair_quality).toBe('substantive');
    expect(arbiter.type_error_severity).toBe('high');
    expect(arbiter.causal_reasoning_integrity).toBe('strong');
    expect(arbiter.justification).toContain('Specific boundary identified.');
    expect(arbiter.cited_span_refs.length).toBeGreaterThan(0);
  });

  it('end-to-end fixture pipeline writes all expected files', async () => {
    const outDir = resolve('/tmp', `tea-party-test-${randomUUID()}`);
    try {
      mkdirSync(outDir, { recursive: true });

      const { pass1, pass2, pass3, deterministic, arbiter, final } = await runFullPipeline();

      const artifacts: [string, unknown][] = [
        ['pass1.reasoning_state.json', pass1],
        ['pass2.reasoning_state.json', pass2],
        ['pass3.reasoning_state.json', pass3],
        ['deterministic_verification.json', deterministic],
        ['arbiter_verification.json', arbiter],
        ['final_verification.json', final],
      ];
      for (const [filename, data] of artifacts) {
        writeFileSync(resolve(outDir, filename), JSON.stringify(data, null, 2), 'utf-8');
      }

      for (const [filename] of artifacts) {
        expect(existsSync(resolve(outDir, filename)), `Missing: ${filename}`).toBe(true);
        const content = JSON.parse(readFileSync(resolve(outDir, filename), 'utf-8'));
        expect(content).toBeDefined();
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('ingest keeps unattested bundles unofficial', async () => {
    const outDir = resolve('/tmp', `tea-party-ingest-unofficial-${randomUUID()}`);
    try {
      mkdirSync(outDir, { recursive: true });
      const { pass1, pass2, pass3, deterministic, arbiter, final } = await runFullPipeline();
      const artifacts: [string, unknown][] = [
        ['pass1.reasoning_state.json', pass1],
        ['pass2.reasoning_state.json', pass2],
        ['pass3.reasoning_state.json', pass3],
        ['deterministic_verification.json', deterministic],
        ['arbiter_verification.json', arbiter],
        ['final_verification.json', final],
      ];
      for (const [filename, data] of artifacts) {
        writeFileSync(resolve(outDir, filename), JSON.stringify(data, null, 2), 'utf-8');
      }
      writeRunManifest(outDir);

      const submission = ingestBundle(outDir, null);
      assertValid('leaderboard_submission_unofficial', validateLeaderboardSubmission(submission));
      expect(submission.official_submission).toBe(false);
      expect(submission.final_verification.arbiter_metadata.official_run_attested).toBe(false);
      expect(submission.final_verification.leaderboard_status).toBe('unofficial_custom_arbiter');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  it('ingest upgrades certified bundles only with valid attestation', async () => {
    const outDir = resolve('/tmp', `tea-party-ingest-official-${randomUUID()}`);
    try {
      mkdirSync(outDir, { recursive: true });
      const { pass1, pass2, pass3, deterministic, arbiter, final } = await runFullPipeline();
      const artifacts: [string, unknown][] = [
        ['pass1.reasoning_state.json', pass1],
        ['pass2.reasoning_state.json', pass2],
        ['pass3.reasoning_state.json', pass3],
        ['deterministic_verification.json', deterministic],
        ['arbiter_verification.json', arbiter],
        ['final_verification.json', final],
      ];
      for (const [filename, data] of artifacts) {
        writeFileSync(resolve(outDir, filename), JSON.stringify(data, null, 2), 'utf-8');
      }
      const manifest = writeRunManifest(outDir);
      const attestation = createOfficialRunAttestation(manifest, 'test-secret', 'trusted-ci');
      writeFileSync(resolve(outDir, 'official_run_attestation.json'), JSON.stringify(attestation, null, 2), 'utf-8');

      const submission = ingestBundle(outDir, 'test-secret');
      assertValid('leaderboard_submission_official', validateLeaderboardSubmission(submission));
      expect(submission.official_submission).toBe(true);
      expect(submission.final_verification.arbiter_metadata.official_run_attested).toBe(true);
      expect(submission.final_verification.arbiter_metadata.official_score_eligible).toBe(true);
      expect(submission.final_verification.leaderboard_status).toBe('official_certified_arbiter');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
