import { createHash } from 'node:crypto';
import type {
  CapabilityMode,
  PassId,
  ReasoningState,
  Scenario,
} from './models.js';
import { normalizeText } from './deterministic.js';
import {
  EXTRACTION_VERSION,
  extractCausalClaims,
  extractClaimedRepairs,
  extractDetectedContradictions,
  extractExpressedConfidence,
  extractTypedMappings,
} from './extraction.js';
import type { PassExecutorResult, PassExecutorMetadata } from './passExecutor.js';

const PARSE_VERSION = 'v1.0';
const NORMALIZATION_PROFILE = 'tea_party_v1';

export interface BuildReasoningStateInput {
  scenario: Scenario;
  passId: PassId;
  executorResult: PassExecutorResult;
  executorMetadata: PassExecutorMetadata;
  lineageId: string;
  parentArtifactId: string | null;
  critiqueTargetArtifactId: string | null;
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function generateArtifactId(scenarioId: string, passId: PassId, contentHash: string): string {
  return `${scenarioId}:${passId}:${contentHash.slice(0, 12)}`;
}

export function buildReasoningState(input: BuildReasoningStateInput): ReasoningState {
  const {
    scenario,
    passId,
    executorResult,
    executorMetadata,
    lineageId,
    parentArtifactId,
    critiqueTargetArtifactId,
  } = input;

  const rawText = executorResult.raw_text;
  const normalizedTextValue = normalizeText(rawText);
  const contentHash = sha256(rawText);
  const artifactId = generateArtifactId(scenario.scenario_id, passId, contentHash);
  const wordCount = normalizedTextValue.split(/\s+/).filter(w => w.length > 0).length;

  const parseWarnings: string[] = [];

  const extractedConfidence = extractExpressedConfidence(rawText);
  const expressedConfidence = executorResult.expressed_confidence ?? extractedConfidence;
  if (expressedConfidence !== null && (expressedConfidence < 0 || expressedConfidence > 1)) {
    parseWarnings.push(`expressed_confidence ${expressedConfidence} out of [0,1], clamped.`);
  }
  const clampedExpressed = expressedConfidence !== null
    ? Math.min(Math.max(expressedConfidence, 0), 1)
    : null;

  const internalConfidence = executorResult.internal_confidence ?? null;
  if (internalConfidence !== null && (internalConfidence < 0 || internalConfidence > 1)) {
    parseWarnings.push(`internal_confidence ${internalConfidence} out of [0,1], clamped.`);
  }
  const clampedInternal = internalConfidence !== null
    ? Math.min(Math.max(internalConfidence, 0), 1)
    : null;

  const internalConfidenceMode: CapabilityMode =
    executorResult.internal_confidence_mode ?? (internalConfidence !== null ? 'internal_and_external' : 'external_only');

  const contradictions = extractDetectedContradictions(rawText, scenario.expected_failure_modes, passId);
  parseWarnings.push(...contradictions.warnings);

  const repairs = extractClaimedRepairs(rawText, scenario.ground_truth_constraints, passId);
  parseWarnings.push(...repairs.warnings);

  const causalClaims = extractCausalClaims(rawText, scenario);
  const typedMappings = extractTypedMappings(rawText, scenario);

  return {
    artifact_id: artifactId,
    artifact_hash: contentHash,
    lineage_id: lineageId,
    scenario_id: scenario.scenario_id,
    pass_id: passId,
    raw_text: rawText,
    normalized_text: normalizedTextValue,
    word_count: wordCount,
    expressed_confidence: clampedExpressed,
    internal_confidence: clampedInternal,
    internal_confidence_mode: internalConfidenceMode,
    detected_contradictions: contradictions.ids,
    claimed_repairs: repairs.ids,
    typed_mappings: typedMappings,
    causal_claims: causalClaims,
    span_refs: [],
    extraction_version: EXTRACTION_VERSION,
    parse_version: PARSE_VERSION,
    parse_warnings: parseWarnings,
    producer_agent_id: executorMetadata.producer_agent_id,
    producer_model_id: executorMetadata.producer_model_id,
    parent_artifact_id: parentArtifactId,
    critique_target_artifact_id: critiqueTargetArtifactId,
    generated_at: new Date().toISOString(),
    normalization_profile: NORMALIZATION_PROFILE,
  };
}
