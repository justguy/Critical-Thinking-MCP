import { describe, it, expect } from 'vitest';
import { loadNormalizedScenarios, loadScenarioRegistry } from '../../benchmark/invisible-tea-party/ts/src/scenarioRegistry.js';
import {
  validateScenario,
  validateReasoningState,
  validateDeterministicVerification,
  validateArbiterVerification,
  validateFinalVerification,
  validateArbiterPayload,
} from '../../benchmark/invisible-tea-party/ts/src/schemaValidation.js';
import { buildReasoningState } from '../../benchmark/invisible-tea-party/ts/src/reasoningState.js';
import type { ReasoningState, Scenario } from '../../benchmark/invisible-tea-party/ts/src/models.js';

describe('Invisible Tea Party: Schema Validation', () => {
  describe('Scenario Registry', () => {
    it('loads all 6 scenarios from registry', () => {
      const entries = loadScenarioRegistry();
      expect(entries).toHaveLength(6);
    });

    it('normalizes all 6 scenarios', () => {
      const scenarios = loadNormalizedScenarios();
      expect(scenarios).toHaveLength(6);
      const ids = scenarios.map(s => s.scenario_id);
      expect(ids).toContain('tea_001_ontology_spill');
      expect(ids).toContain('tea_002_category_fairness');
      expect(ids).toContain('tea_003_consensus_occupant');
      expect(ids).toContain('tea_004_constraint_paradox');
      expect(ids).toContain('tea_005_recursive_role');
      expect(ids).toContain('tea_006_temporal_inversion');
    });

    it('all normalized scenarios pass schema validation', () => {
      const scenarios = loadNormalizedScenarios();
      for (const scenario of scenarios) {
        const result = validateScenario(scenario);
        expect(result.valid, `Scenario ${scenario.scenario_id} failed: ${!result.valid ? result.errors : ''}`).toBe(true);
      }
    });
  });

  describe('ReasoningState validation', () => {
    let scenario: Scenario;

    function makeDummyState(passId: ReasoningState['pass_id']): ReasoningState {
      return buildReasoningState({
        scenario,
        passId,
        executorResult: {
          raw_text: 'The guest does not exist and cannot knock over the teapot. Confidence: 0.85',
          expressed_confidence: null,
          internal_confidence: null,
          internal_confidence_mode: 'external_only',
        },
        executorMetadata: {
          producer_agent_id: 'test-agent',
          producer_model_id: 'test-model',
        },
        lineageId: 'test-lineage-001',
        parentArtifactId: null,
        critiqueTargetArtifactId: null,
      });
    }

    it('generates valid ReasoningState artifacts', () => {
      const scenarios = loadNormalizedScenarios();
      scenario = scenarios[0];
      for (const passId of ['pass1_answer', 'pass2_critique', 'pass3_repair'] as const) {
        const state = makeDummyState(passId);
        const result = validateReasoningState(state);
        expect(result.valid, `Pass ${passId} failed: ${!result.valid ? result.errors : ''}`).toBe(true);
      }
    });

    it('has deterministic artifact_id generation', () => {
      const scenarios = loadNormalizedScenarios();
      scenario = scenarios[0];
      const s1 = makeDummyState('pass1_answer');
      const s2 = makeDummyState('pass1_answer');
      expect(s1.artifact_id).toBe(s2.artifact_id);
      expect(s1.artifact_hash).toBe(s2.artifact_hash);
    });

    it('has stable SHA-256 content hashing', () => {
      const scenarios = loadNormalizedScenarios();
      scenario = scenarios[0];
      const state = makeDummyState('pass1_answer');
      expect(state.artifact_hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Confidence normalization', () => {
    it('expressed_confidence stays in [0,1]', () => {
      const scenarios = loadNormalizedScenarios();
      const scenario = scenarios[0];
      const state = buildReasoningState({
        scenario,
        passId: 'pass1_answer',
        executorResult: {
          raw_text: 'Test text. Confidence: 0.75',
          expressed_confidence: 0.75,
          internal_confidence: null,
          internal_confidence_mode: 'external_only',
        },
        executorMetadata: { producer_agent_id: 'test', producer_model_id: 'test' },
        lineageId: 'test',
        parentArtifactId: null,
        critiqueTargetArtifactId: null,
      });
      expect(state.expressed_confidence).toBe(0.75);
      expect(state.expressed_confidence).toBeGreaterThanOrEqual(0);
      expect(state.expressed_confidence).toBeLessThanOrEqual(1);
    });

    it('clamps out-of-range confidence to [0,1]', () => {
      const scenarios = loadNormalizedScenarios();
      const scenario = scenarios[0];
      const state = buildReasoningState({
        scenario,
        passId: 'pass1_answer',
        executorResult: {
          raw_text: 'Test text.',
          expressed_confidence: 1.5,
          internal_confidence: -0.3,
          internal_confidence_mode: 'internal_and_external',
        },
        executorMetadata: { producer_agent_id: 'test', producer_model_id: 'test' },
        lineageId: 'test',
        parentArtifactId: null,
        critiqueTargetArtifactId: null,
      });
      expect(state.expressed_confidence).toBe(1);
      expect(state.internal_confidence).toBe(0);
      expect(state.parse_warnings.length).toBeGreaterThan(0);
    });

    it('extracts confidence from raw text when not provided', () => {
      const scenarios = loadNormalizedScenarios();
      const scenario = scenarios[0];
      const state = buildReasoningState({
        scenario,
        passId: 'pass1_answer',
        executorResult: {
          raw_text: 'Analysis complete. Confidence: 0.92',
          expressed_confidence: null,
          internal_confidence: null,
          internal_confidence_mode: 'external_only',
        },
        executorMetadata: { producer_agent_id: 'test', producer_model_id: 'test' },
        lineageId: 'test',
        parentArtifactId: null,
        critiqueTargetArtifactId: null,
      });
      expect(state.expressed_confidence).toBe(0.92);
    });
  });

  describe('Arbiter payload validation', () => {
    it('validates a correct arbiter payload', () => {
      const result = validateArbiterPayload({
        premise_rejection_quality: 'specific',
        repair_quality: 'substantive',
        sycophancy_triggered: false,
        type_error_severity: 'none',
        causal_reasoning_integrity: 'strong',
        justification: 'The model correctly identified the core issues.',
        cited_span_refs: [
          {
            artifact_id: 'pass3',
            excerpt: 'The scenario contains three fundamental violations:',
          },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects an invalid arbiter payload', () => {
      const result = validateArbiterPayload({
        premise_rejection_quality: 'invalid_value',
        repair_quality: 'substantive',
        sycophancy_triggered: false,
        type_error_severity: 'none',
        causal_reasoning_integrity: 'strong',
        justification: 'test',
        cited_span_refs: [],
      });
      expect(result.valid).toBe(false);
    });
  });
});
