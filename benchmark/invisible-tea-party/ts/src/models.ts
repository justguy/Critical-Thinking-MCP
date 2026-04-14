export type PassId = 'pass1_answer' | 'pass2_critique' | 'pass3_repair';
export type CapabilityMode = 'internal_and_external' | 'external_only' | 'unsupported';
export type PremiseRejectionQuality = 'generic' | 'specific';
export type RepairQuality = 'evasive' | 'partial' | 'substantive';
export type TypeErrorSeverity = 'none' | 'low' | 'high';
export type CausalReasoningIntegrity = 'weak' | 'strong';
export type LeaderboardStatus = 'official_certified_arbiter' | 'unofficial_custom_arbiter';
export type ArbiterPassStatus = 'AVAILABLE' | 'UNAVAILABLE';

export interface SpanRef {
  artifact_id: string;
  start_char: number;
  end_char: number;
  excerpt?: string | null;
}

export interface EntityAnnotation {
  entity_id: string;
  label: string;
  domain_id: 'physical' | 'abstract_conceptual' | 'sensory_perceptual' | 'social_relational';
  allowed_properties: string[];
  disallowed_cross_domain_properties: string[];
  metaphor_allowed: boolean;
  metaphor_markers: string[];
}

export interface Constraint {
  constraint_id: string;
  constraint_class: 'logical' | 'physical' | 'semantic' | 'causal' | 'ontological';
  description: string;
  weight: number;
  severity: 'low' | 'medium' | 'high';
  resolution_test_id: string;
  match_hints: string[];
}

export interface FailureMode {
  failure_mode_id: string;
  label: string;
  linked_constraint_ids: string[];
  canonical_phrases: string[];
  allowed_synonyms: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface CausalEdge {
  edge_id: string;
  source_id: string;
  target_id: string;
  relation: string;
  required: boolean;
}

export interface CausalGraph {
  nodes: Array<{ node_id: string; label: string }>;
  edges: CausalEdge[];
}

export interface Scenario {
  scenario_id: string;
  scenario_version: string;
  prompt_family: string;
  scenario_text: string;
  entities: EntityAnnotation[];
  ontology_version: string;
  ground_truth_constraints: Constraint[];
  expected_failure_modes: FailureMode[];
  causal_graph: CausalGraph;
  adversarial_critique: string;
  clean_control: boolean;
  scoring_profile_version: string;
  notes: string;
}

export interface TypedMapping {
  source_entity_id: string;
  target_domain_id: EntityAnnotation['domain_id'];
  literal: boolean;
}

export interface CausalClaim {
  claim_id: string;
  description: string;
}

export interface ReasoningState {
  artifact_id: string;
  artifact_hash: string;
  lineage_id: string;
  scenario_id: string;
  pass_id: PassId;
  raw_text: string;
  normalized_text: string;
  word_count: number;
  expressed_confidence: number | null;
  internal_confidence: number | null;
  internal_confidence_mode: CapabilityMode;
  detected_contradictions: string[];
  claimed_repairs: string[];
  typed_mappings: TypedMapping[];
  causal_claims: CausalClaim[];
  span_refs: SpanRef[];
  extraction_version: string;
  parse_version: string;
  parse_warnings: string[];
  producer_agent_id: string;
  producer_model_id: string;
  parent_artifact_id: string | null;
  critique_target_artifact_id: string | null;
  generated_at: string;
  normalization_profile: string;
  peer_agent_id?: string | null;
  cross_agent_reference_ids?: string[];
  shared_context_ids?: string[];
  contagion_candidate?: boolean | null;
}

export interface MatchTrace {
  trace_type: string;
  message: string;
  ref_ids?: string[];
}

export interface ArtifactIds {
  pass1: string;
  pass2: string;
  pass3: string;
}

export interface ArbiterMetadata {
  arbiter_model_id: string;
  arbiter_provider: string;
  official_run_attested: boolean;
  certified: boolean;
  official_score_eligible: boolean;
  certification_label: string | null;
}

export interface DeterministicVerification {
  schema_version: string;
  scenario_id: string;
  artifact_ids: ArtifactIds;
  rule_profile_version: string;
  capability_mode: CapabilityMode;
  scoring_timestamp: string;
  contradiction_overlap: number;
  matched_failure_mode_ids: string[];
  identified_failure_mode_ids: string[];
  ground_truth_failure_mode_ids: string[];
  gap_closure_rate: number;
  identified_error_count: number;
  resolved_error_count: number;
  unresolved_constraint_ids: string[];
  unresolved_constraint_count: number;
  unresolved_causal_constraint_count: number;
  semantic_density_drop_flag: boolean;
  evasion_penalty_raw: number;
  evasion_penalty_normalized: number;
  word_counts: { pass1: number; pass2: number; pass3: number };
  audit_trace: MatchTrace[];
}

export interface ArbiterVerification {
  schema_version: string;
  scenario_id: string;
  artifact_ids: ArtifactIds;
  rule_profile_version: string;
  capability_mode: CapabilityMode;
  scoring_timestamp: string;
  pass_status: ArbiterPassStatus;
  premise_rejection_quality: PremiseRejectionQuality;
  repair_quality: RepairQuality;
  sycophancy_triggered: boolean;
  type_error_severity: TypeErrorSeverity;
  causal_reasoning_integrity: CausalReasoningIntegrity;
  arbiter_metadata: ArbiterMetadata;
  justification: string;
  cited_span_refs: SpanRef[];
  audit_trace: MatchTrace[];
}

export interface ScoreComponent {
  component_id: string;
  raw_score: number;
  weight: number;
  weighted_score: number;
}

export interface AppliedCap {
  rule_id: string;
  field: string;
  applied_value: string | number | boolean;
  reason: string;
}

export interface ConflictResolution {
  field: string;
  deterministic_value: unknown;
  arbiter_value: unknown;
  resolution: string;
}

export interface FinalVerification {
  schema_version: string;
  scenario_id: string;
  artifact_ids: ArtifactIds;
  rule_profile_version: string;
  capability_mode: CapabilityMode;
  scoring_timestamp: string;
  core_final_score: number;
  calibration_augmented_score: number | null;
  arbiter_pass_status: ArbiterPassStatus;
  arbiter_metadata: ArbiterMetadata;
  leaderboard_status: LeaderboardStatus;
  score_components: ScoreComponent[];
  caps_applied: AppliedCap[];
  conflicts: ConflictResolution[];
  audit_trace: MatchTrace[];
}

export interface RunManifestEntry {
  artifact_name: string;
  filename: string;
  sha256: string;
}

export interface RunManifest {
  schema_version: string;
  benchmark_id: 'invisible-tea-party';
  scenario_id: string;
  lineage_id: string;
  rule_profile_version: string;
  created_at: string;
  arbiter_provider: string;
  arbiter_model_id: string;
  capability_mode: CapabilityMode;
  core_final_score: number;
  artifact_files: RunManifestEntry[];
  bundle_hash: string;
}

export interface OfficialRunAttestation {
  schema_version: string;
  benchmark_id: 'invisible-tea-party';
  attestation_version: string;
  attestor_id: string;
  attestation_timestamp: string;
  scenario_id: string;
  lineage_id: string;
  arbiter_provider: string;
  arbiter_model_id: string;
  bundle_hash: string;
  signature_algorithm: 'hmac-sha256';
  signature: string;
}

export interface LeaderboardSubmission {
  schema_version: string;
  benchmark_id: 'invisible-tea-party';
  submission_timestamp: string;
  official_submission: boolean;
  status_reason: string;
  run_manifest: RunManifest;
  official_run_attestation: OfficialRunAttestation | null;
  final_verification: FinalVerification;
}

export interface ScenarioRegistryEntry {
  scenario_id: string;
  family: string;
  difficulty_tier: number;
  prompt_text: string;
  ground_truth_constraints: string[];
  expected_failure_modes: string[];
  injection_vectors: {
    adversarial_critique: string;
    peer_hallucination: string;
  };
}
