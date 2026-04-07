# Pass Schema

## Purpose

This document defines the canonical machine-readable artifacts for Invisible Tea Party V1.

The benchmark is only auditable if every scoring decision traces back to stable IDs and immutable artifacts.

## Versioning Rules

- every scenario has `scenario_version`
- every benchmark release has `schema_version`
- ontology changes require a new `ontology_version`
- threshold changes require a new `rule_profile_version`
- reconciler logic changes require a new `rule_profile_version`

Cross-version scores must not be compared without explicit remapping.

## Scenario Registry

V1 uses two scenario representations:

1. compact authored registry entries in `scenarios/scenario_registry.json`
2. normalized internal `Scenario` objects used by the verifier

The authored registry optimizes for curation speed:

- `scenario_id`
- `family`
- `difficulty_tier`
- `prompt_text`
- `ground_truth_constraints`
- `expected_failure_modes`
- `injection_vectors`

The normalized internal `Scenario` expands those entries into:

- stable IDs
- typed constraints
- entity annotations
- causal graph structure
- scoring profile metadata

## Scenario

Minimum top-level fields:

- `scenario_id`
- `scenario_version`
- `prompt_family`
- `scenario_text`
- `entities`
- `ontology_version`
- `ground_truth_constraints`
- `expected_failure_modes`
- `causal_graph`
- `adversarial_critique`
- `clean_control`
- `scoring_profile_version`
- `notes`

### Entity Annotation

Required fields:

- `entity_id`
- `label`
- `domain_id`
- `allowed_properties`
- `disallowed_cross_domain_properties`
- `metaphor_allowed`
- `metaphor_markers`

### Constraint

Required fields:

- `constraint_id`
- `constraint_class`
- `description`
- `weight`
- `severity`
- `resolution_test_id`
- `match_hints`

### Failure Mode

Required fields:

- `failure_mode_id`
- `label`
- `linked_constraint_ids`
- `canonical_phrases`
- `allowed_synonyms`
- `severity`

### Causal Graph

Required fields:

- `nodes`
- `edges`

Every edge must have:

- `edge_id`
- `source_id`
- `target_id`
- `relation`
- `required`

## ReasoningState

Each pass produces a `ReasoningState`.

Required fields:

- `artifact_id`
- `artifact_hash`
- `lineage_id`
- `scenario_id`
- `pass_id`
- `raw_text`
- `normalized_text`
- `word_count`
- `expressed_confidence`
- `internal_confidence`
- `internal_confidence_mode`
- `detected_contradictions`
- `claimed_repairs`
- `typed_mappings`
- `causal_claims`
- `span_refs`
- `extraction_version`
- `parse_version`
- `parse_warnings`

Required provenance fields:

- `producer_agent_id`
- `producer_model_id`
- `parent_artifact_id`
- `critique_target_artifact_id`
- `generated_at`
- `normalization_profile`

Optional extension-gated multi-agent fields:

- `peer_agent_id`
- `cross_agent_reference_ids`
- `shared_context_ids`
- `contagion_candidate`

These fields are optional in V1 and only active when extension mode is enabled.

## Verifier Outputs

All verifier outputs must include:

- `schema_version`
- `scenario_id`
- `artifact_ids`
- `rule_profile_version`
- `capability_mode`
- `scoring_timestamp`
- `audit_trace`

## DeterministicVerification

Required scoring fields:

- `contradiction_overlap`
- `matched_failure_mode_ids`
- `identified_failure_mode_ids`
- `ground_truth_failure_mode_ids`
- `gap_closure_rate`
- `identified_error_count`
- `resolved_error_count`
- `unresolved_constraint_ids`
- `unresolved_constraint_count`
- `unresolved_causal_constraint_count`
- `semantic_density_drop_flag`
- `evasion_penalty_raw`
- `evasion_penalty_normalized`
- `word_counts`

## ArbiterVerification

Required semantic fields:

- `pass_status`
- `premise_rejection_quality`
- `repair_quality`
- `sycophancy_triggered`
- `type_error_severity`
- `causal_reasoning_integrity`
- `arbiter_metadata`
- `justification`
- `cited_span_refs`

### Enum Policy

V1 allowed values:

- `premise_rejection_quality`: `generic`, `specific`
- `repair_quality`: `evasive`, `partial`, `substantive`
- `type_error_severity`: `none`, `low`, `high`
- `causal_reasoning_integrity`: `weak`, `strong`

Note:

- `type_error_severity` includes `none` in implementation so clean controls and fully repaired outputs do not need to pretend a residual type error exists

### Arbiter Metadata

Required fields:

- `arbiter_model_id`
- `arbiter_provider`
- `official_run_attested`
- `certified`
- `official_score_eligible`
- `certification_label`

## FinalVerification

Required fields:

- `core_final_score`
- `calibration_augmented_score`
- `arbiter_pass_status`
- `arbiter_metadata`
- `leaderboard_status`
- `score_components`
- `caps_applied`
- `conflicts`
- `audit_trace`

### Public Leaderboard Rule

- rank only on `core_final_score`
- `calibration_augmented_score` must never affect public ranking
- `leaderboard_status` must distinguish official certified-arbiter runs from unofficial custom-arbiter runs

## Run Manifest

Every execution bundle must include a `run_manifest.json`.

Required fields:

- `schema_version`
- `benchmark_id`
- `scenario_id`
- `lineage_id`
- `rule_profile_version`
- `created_at`
- `arbiter_provider`
- `arbiter_model_id`
- `capability_mode`
- `core_final_score`
- `artifact_files`
- `bundle_hash`

This manifest binds the raw benchmark output files into one hashable bundle.

## OfficialRunAttestation

Official leaderboard submission requires a separate `official_run_attestation.json`.

Required fields:

- `schema_version`
- `benchmark_id`
- `attestation_version`
- `attestor_id`
- `attestation_timestamp`
- `scenario_id`
- `lineage_id`
- `arbiter_provider`
- `arbiter_model_id`
- `bundle_hash`
- `signature_algorithm`
- `signature`

V1 attestation uses `hmac-sha256`.

## LeaderboardSubmission

Public leaderboard ingestion must operate on a derived `leaderboard_submission.json`, not on the raw runtime `final_verification.json` alone.

Required fields:

- `schema_version`
- `benchmark_id`
- `submission_timestamp`
- `official_submission`
- `status_reason`
- `run_manifest`
- `official_run_attestation`
- `final_verification`

### Officiality Rule

- raw runtime bundles are unofficial by default
- officiality is granted only during ingest
- ingest must verify:
  - the bundle matches `run_manifest.json`
  - the attestation signature is valid
  - the attested arbiter matches the bundle
  - the arbiter is on the certified arbiter list
  - `arbiter_pass_status == AVAILABLE`
