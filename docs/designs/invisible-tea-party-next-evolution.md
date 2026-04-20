# Invisible Tea Party Next Evolution

Status: Proposed
Date: 2026-04-05
Branch: `invisible-tea-party-pass4-design`

## Purpose

This document reviews the two proposed prompts for the next benchmark evolution and maps them onto the current `ct-mcp` repository. The goal is not to pretend the requested system already exists here. The goal is to define a clean path from the current CT-MCP benchmark to a new benchmark family:

`The Invisible Tea Party: A Benchmark for Coherence vs Truth`

The immediate output of this branch is a design decision:

1. what these prompts get right
2. what they assume that the repo does not yet provide
3. how to sequence the work so the resulting system is implementable and auditable

## Current Repo Baseline

The repo already has three relevant foundations:

1. `benchmark/`
   - A production-oriented CT-MCP benchmark with 56 scenarios, 14 clean controls, and a 6-dimension hybrid scoring model.
   - Deterministic dimensions live in `benchmark/scoring/deterministic_score.ts`.
   - LLM-as-judge dimensions live in `benchmark/scoring/judge_score.ts`.
   - Human validation protocol lives in `benchmark/validation/PROTOCOL.md`.

2. `benchmark/duckexperiments/`
   - A free-text experiment harness built around `baseline`, `prompted`, `critique_initial`, `tool_review`, and `critique_revised`.
   - This is already close to a multi-pass reasoning workflow, but it is not the canonical benchmark architecture and does not define pass-state schemas.

3. `src/`
   - Deterministic enforcement mechanisms for reasoning quality, confidence, arithmetic, concurrency, grounding, and revision contrast.
   - These mechanisms are reusable as sub-signals inside a future verifier, but they are not sufficient on their own to define truth-vs-coherence judgments.

What does not exist yet:

- no `Invisible Tea Party` benchmark package
- no `ReasoningState` schema
- no `VerifierEvaluation` schema
- no Pass 1 / Pass 2 / Pass 3 canonical orchestration
- no Pass 4 deterministic/arbiter/reconciler subsystem
- no ontology or causal graph layer for nonsense acceptance
- no calibration dataset for override thresholds

## Reuse Map To Existing Code

The new benchmark should reuse patterns from the repo selectively.

Use directly or adapt:

- `benchmark/scoring/judge_score.ts`
  - useful as the baseline pattern for strict JSON arbiter prompting, parsing, and validation
  - not sufficient as-is because the new arbiter needs tighter enums, retries, and drift control

- `benchmark/scoring/deterministic_score.ts`
  - useful as a proof that deterministic scoring can sit beside judge scoring
  - not sufficient as-is because the Tea Party verifier needs constraint-level reasoning, not just text-surface features

- `benchmark/validation/PROTOCOL.md`
  - useful as the template for human validation and mismatch documentation
  - should be forked, not edited in place

- `benchmark/duckexperiments/`
  - useful as the closest existing example of a multi-artifact critique and revision loop
  - should inform pass naming and artifact persistence, but should not be treated as the final benchmark schema

- `src/enforcement/revision_contrast.ts`
  - useful candidate helper for Pass 2 to Pass 3 delta extraction

- `src/enforcement/entity_grounding.ts`, `claim_classifier.ts`, `consistency_checker.ts`
  - useful as auxiliary extraction and sanity-check modules
  - should only provide features or warnings, not final truth labels

- `src/enforcement/types.ts`
  - useful as a style reference for typed enforcement outputs
  - likely needs a separate type family for the new benchmark domain

## Prompt Review

### Prompt 1: Formal Mathematical Framework

This prompt is strong as a research foundation brief.

What it gets right:

- It centers the benchmark on the actual failure mode: accepting nonsense because it is fluent.
- It pushes beyond generic benchmark prose into measurable constructs: Bayesian substitution, divergence, weighted constraints, type distance, causal interventions, repair, sycophancy, and calibration.
- It is appropriate as the conceptual basis for a paper and for later implementation choices.

What is missing for implementation:

- It does not define the canonical scenario object.
- It does not say who computes `C` or how `C` is normalized.
- It does not define how validity is encoded in ground truth.
- It assumes internal calibration data may be available, but many target model surfaces will not expose logits.
- It asks for ontology distance and do-calculus, but does not define how the ontology and causal graphs are authored, versioned, or validated.
- It does not specify how contradiction classes and failure modes are enumerated so that later deterministic checks can operate reproducibly.

Net assessment:

- Keep this prompt, but treat it as a foundation-spec task, not as a direct implementation task.
- The output should become a benchmark semantics document plus annotation rules, not code yet.

### Prompt 2: Pass 4 Verification And Reconciliation Layer

This prompt is strong as an engineering-system brief.

What it gets right:

- It separates deterministic evidence, arbiter judgment, and reconciliation instead of letting one judge do everything.
- It explicitly asks for non-overridable facts, bounded overrides, audit trails, failure handling, and schemas.
- It is much closer to a production evaluator than the current repo's general hybrid scorer.

What it assumes that is not true in this repo yet:

- Pass 1 to Pass 3 already exist as stable benchmark stages.
- `Scenario`, `ReasoningState`, and `VerifierEvaluation` schemas already exist.
- ground-truth contradiction inventories and constraint sets are already authored for the new benchmark.
- "mathematically resolved" can already be computed from existing artifacts.

What needs tightening:

- Regex and keyword matching alone are too brittle for contradiction overlap unless every failure mode is canonicalized first.
- `GCR` cannot be based on string replacement; it has to be computed at the constraint-resolution level.
- Arbiter thresholds cannot be justified from first principles alone; they need calibration data.
- Internal-confidence scoring needs a capability fallback when logits are unavailable.

Net assessment:

- This should become the implementation spec for a new Pass 4 subsystem, but only after the benchmark foundation and pass artifacts are defined.

## Decision

Do not bolt this work onto the existing CT-MCP `benchmark/` runner.

Instead, create a new benchmark family under a separate namespace and let it reuse patterns from the current repo where those patterns already work:

- reuse the deterministic vs judge separation
- reuse JSON-schema-first evaluation artifacts
- reuse human-validation discipline
- reuse some deterministic helper signals from `src/enforcement/`

But do not:

- reuse the current 6-dimension publication rubric as the main Tea Party scoring model
- pretend `benchmark/duckexperiments/` is already the final pass architecture
- let the arbiter become the source of truth for bounded, explicit facts

## Recommended Build Sequence

### Phase 1: Foundation Spec

Deliverables:

- `benchmark/invisible-tea-party/FOUNDATION.md`
- canonical failure taxonomy
- ontology authoring rules
- causal graph authoring rules
- coherence and validity normalization spec
- calibration-mode fallback rules

Primary outcome:

- a stable mathematical and annotation language for the benchmark

Ontology policy for V1:

- ontology scope must be strictly narrow
- V1 ontology must contain exactly four distinct, non-overlapping domains
- benchmark validity must not depend on broad philosophical world-model claims

### Phase 2: Pass Artifact Schemas

Deliverables:

- `Scenario`
- `ReasoningState`
- `Pass1Output`
- `Pass2Output`
- `Pass3Output`
- `DeterministicVerification`
- `ArbiterVerification`
- `FinalVerification`

Primary outcome:

- the repo has canonical machine-readable objects before writing verifiers

### Phase 3: Pass 1-3 Orchestration

Deliverables:

- initial-answer pass
- critique pass
- repair pass
- deterministic state isolation rules
- artifact persistence format

Primary outcome:

- Pass 4 has stable inputs instead of free-form text blobs

### Phase 4: Pass 4A / 4B / 4C

Deliverables:

- deterministic verification engine
- arbiter verification engine
- reconciler with bounded override rules
- audit-trace output

Primary outcome:

- reproducible final scoring with explicit authority boundaries

### Phase 5: Calibration And Validation

Deliverables:

- threshold calibration set
- malformed-output recovery tests
- adversarial critique test set
- human validation protocol for the new benchmark

Primary outcome:

- numerical thresholds and override caps are defended by evidence rather than taste

Release note:

- Phase 5 is not a blocker for the first public release
- the first public release should be labeled `The Invisible Tea Party (v1.0 Provisional)`
- publication-grade claims are deferred until the later calibration pass is complete

## Proposed Repo Layout

```text
benchmark/
  invisible-tea-party/
    FOUNDATION.md
    ARCHITECTURE.md
    config/
      ontology.json
      failure_modes.json
      synonym_tables.json
      threshold_profiles.json
      reconciler_rules.json
      certified_arbiters.json
    scenarios/
      *.json
    schemas/
      scenario.schema.json
      reasoning_state.schema.json
      deterministic_verification.schema.json
      arbiter_verification.schema.json
      final_verification.schema.json
    prompts/
      pass1_initial.md
      pass2_critique.md
      pass3_repair.md
      pass4_arbiter.md
    scoring/
      normalize.ts
      deterministic.ts
      arbiter.ts
      reconcile.ts
    validation/
      CALIBRATION_PROTOCOL.md
      HUMAN_VALIDATION.md
    fixtures/
      calibration_cases.json
      malformed_arbiter_cases.json
      replay_cases.json
    ts/
      src/
        models.ts
        deterministic.ts
        arbiter.ts
        reconcile.ts
        pipeline.ts
```

The current CT-MCP benchmark should remain intact until the new benchmark family is independently stable.

## Non-Goals For The First Wave

The first implementation wave should not try to do the following:

- replace the existing CT-MCP benchmark runner
- retroactively rewrite `benchmark/duckexperiments/` into the new benchmark format
- solve full external fact verification
- require logprob access from every evaluated model
- claim publication-grade threshold values before calibration
- make multi-agent contagion part of the default benchmark contract

## V1 Scope Boundary

Invisible Tea Party V1 is strictly single-agent.

Canonical loop:

1. Pass 1: Answer
2. Pass 2: Critique
3. Pass 3: Repair

Scope rule:

- V1 benchmark claims must be derived from the single-agent loop only
- multi-agent contagion evaluation is excluded from the default benchmark and must not affect the public V1 leaderboard or headline claims

Extension rule:

- multi-agent contagion is reserved for V2 or product-specific evaluation
- if implemented early, it must be hidden behind an explicit extension flag such as `--enable-contagion-eval`
- extension-mode outputs must be stored separately from core V1 benchmark runs

## Validation And Release Policy

Invisible Tea Party should launch in two stages.

### Stage 1: `v1.0 Provisional`

What ships:

- synthetic prompt families
- structured scenario annotations
- Pass 1 through Pass 3 loop
- Pass 4 deterministic and arbiter verification
- `core_final_score` as the public metric

What it does not claim:

- publication-grade threshold calibration
- truth-blind human coherence calibration
- final academic-strength inter-rater validation

Required labeling:

- every public artifact must identify this release as `The Invisible Tea Party (v1.0 Provisional)`
- public writeups must state that thresholds and coherence calibration remain provisional

Primary purpose:

- generate real usage
- surface edge cases
- collect disagreement cases
- identify brittle rules and prompt-drift failures

Accepted data sources for post-launch calibration:

- community-submitted benchmark runs
- replayable failing cases
- adjudicated disagreement samples
- targeted human review on a smaller gold subset

### Stage 2: `v1.5 Calibrated`

What changes:

- threshold tuning is updated from observed disagreement cases
- truth-blind human coherence calibration is added
- arbiter drift is measured against a fixed validation set
- publication-facing validation summaries are produced

Rule:

- `v1.0 Provisional` is intended to create momentum and collect evidence
- `v1.5 Calibrated` is the earliest version that should support formal publication-strength claims about score stability or benchmark calibration

## Core Benchmark Objects

### Scenario

Minimum fields:

- `scenario_id`
- `scenario_version`
- `prompt_family`
- `scenario_text`
- `entities`
- `entity_types`
- `ontology_version`
- `ground_truth_constraints`
- `expected_failure_modes`
- `causal_graph`
- `adversarial_critique`
- `clean_control`
- `scoring_profile_version`
- `notes`

Design rule:

- Every scenario must carry enough structured ground truth that a deterministic verifier can operate without re-inferring the whole world model from prose.

Required ontology annotation fields for each entity:

- `entity_id`
- `label`
- `domain_id`
- `allowed_properties`
- `disallowed_cross_domain_properties`
- `metaphor_allowed` boolean
- `metaphor_markers`

Required stable identity fields inside each scenario:

- every constraint must have `constraint_id`
- every failure mode must have `failure_mode_id`
- every repair test must have `resolution_test_id`
- every causal edge must have `edge_id`
- every ontology node must have `type_id`

Minimum constraint object:

- `constraint_id`
- `constraint_class` where class is one of `logical`, `physical`, `semantic`, `causal`, `ontological`
- `description`
- `weight`
- `severity`
- `resolution_test_id`
- `match_hints`

Minimum failure-mode object:

- `failure_mode_id`
- `label`
- `linked_constraint_ids`
- `canonical_phrases`
- `allowed_synonyms`
- `severity`

Design implication:

- `C_o`, `GCR`, unresolved counts, and score caps must operate on stable IDs, not raw prose strings.

### ReasoningState

Minimum fields:

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

Design rule:

- Pass artifacts should preserve original text, but scoring must operate on normalized extracts plus audit references.

Required provenance and lineage fields:

- `producer_agent_id`
- `producer_model_id`
- `parent_artifact_id`
- `critique_target_artifact_id`
- `generated_at`
- `normalization_profile`

Required multi-agent fields when the workflow is collaborative:

- `peer_agent_id` for externally generated critiques
- `cross_agent_reference_ids`
- `shared_context_ids`
- `contagion_candidate` boolean

Design implication:

- Arbiter justifications and deterministic matches must cite `span_refs` against immutable artifact hashes, not mutable text blobs.
- these multi-agent fields are optional in V1 schemas and are activated only in extension mode

### Verifier Outputs

Three distinct outputs are required:

1. `DeterministicVerification`
   - only script-computable facts

2. `ArbiterVerification`
   - only bounded semantic judgments defined by schema enums

3. `FinalVerification`
   - final score, caps, overrides, and complete audit trail

Minimum fields required in every verifier output:

- `schema_version`
- `scenario_id`
- `artifact_ids`
- `rule_profile_version`
- `capability_mode`
- `scoring_timestamp`
- `audit_trace`

## Deterministic vs Arbiter Boundary

This is the core architectural decision.

### Must Be Deterministic

- contradiction overlap against canonical failure IDs
- gap closure rate at the constraint-resolution level
- unresolved constraint count
- word-count and density-drop calculations
- presence or absence of explicit repair references
- schema validation
- normalization and canonicalization
- score caps triggered by hard evidence

### Must Not Be Purely Deterministic

- whether premise rejection is generic versus specific
- whether a rewrite is evasive versus substantive when both texts are semantically plausible
- whether a type error is low versus high severity in context
- whether causal reasoning is weak versus strong when causal language is indirect
- whether an adversarial critique actually induced sycophancy rather than merely helped correction

### Why

Hard evidence should not be vulnerable to prompt drift.
Semantic quality should not be reduced to brittle word matching.
The reconciler exists to enforce this division.

## Arbiter Runtime Policy

Pass 4B must be strictly Bring Your Own Evaluator.

Code-level rule:

- the benchmark defines an abstract evaluator interface
- the executing agent is responsible for sending the arbiter prompt to any chosen model
- the verification layer accepts only schema-valid JSON plus arbiter runtime metadata
- no provider SDK is part of the benchmark core

Methodology-level rule:

- the public leaderboard may certify one or more arbiters for official scoring
- runs using a certified arbiter are eligible for `official` status
- runs using any other arbiter remain valid benchmark executions but are labeled `unofficial / custom arbiter`
- certified arbiters must be pinned to exact provider/model IDs, not floating aliases

Design implication:

- runtime flexibility and leaderboard comparability are separated cleanly
- the code stays provider-agnostic while public scorecards remain apples-to-apples

## How The Two Prompts Should Be Combined

The right dependency direction is:

1. Prompt 1 defines the benchmark semantics.
2. Prompt 2 defines the Pass 4 implementation once those semantics are encoded in schemas.

The wrong dependency direction is:

1. implementing Pass 4 first
2. inventing the ontology and truth model later

That would produce unstable overrides, unclear scenario annotations, and judge drift disguised as rigor.

## Recommended Metric Decisions

These are the main design choices needed to make the prompts executable.

### Coherence And Validity

Represent both as normalized distributions over the same failure-mode basis, not as unrelated scalars.

Recommended basis:

- contradiction consistency
- type discipline
- causal integrity
- premise grounding
- repair validity

Then compute `CVG` with Jensen-Shannon divergence, not plain subtraction.

Important correction:

- coherence must not be defined as validity under softer wording
- coherence needs its own observable signal family

Recommended coherence signal family:

- `surface_fluency`
  - grammaticality and discourse smoothness
- `local_consistency`
  - whether adjacent claims fit together rhetorically
- `narrative_integration`
  - whether entities, quantities, and causal statements form a readable story
- `plausibility_cue_density`
  - counts of concrete detail, specificity markers, and explanatory glue that can make nonsense sound grounded

Recommended implementation:

- `C_obs` should be a calibrated score from a dedicated coherence rubric that is explicitly blind to truth labels
- deterministic text-surface features may support this score, but should not define it alone
- the rubric should be human-calibrated on a fixed set before using arbiter judgments as operational shortcuts

Recommended validity signal family:

- constraint satisfaction
- contradiction rejection
- type discipline
- causal integrity
- repair correctness

Design implication:

- `CVG` becomes meaningful only when `C_obs` and `V_obs` are estimated from different evidence channels
- if the same verifier produces both from the same rubric, the benchmark collapses into a single latent score and loses the target construct

Reason:

- JSD is symmetric
- bounded
- interpretable on normalized distributions
- more stable than KL when one side has zeros

### Fluency Heuristic Substitution

Treat the substitution term `phi(C, E)` as an error term estimated from disagreement between evidence-grounded and coherence-grounded acceptance across benchmark items.

Implementation implication:

- do not require exact cognitive realism in v1
- require computable disagreement traces between evidence-bearing constraints and coherence-bearing surface plausibility

### Gap Closure

Do not score repair by looking for the absence of old words.

Score it by checking whether each identified contradiction maps to one of:

- `resolved`
- `unresolved`
- `partially_resolved`
- `replaced_with_new_error`

This mapping must be grounded in `ground_truth_constraints`.

### Calibration

Internal calibration should be optional.

Support three modes:

1. `internal_and_external`
2. `external_only`
3. `unsupported`

Do not block benchmark execution when logits are unavailable. Instead, record the capability mode and limit the maximum calibration subscore accordingly.

Comparability rule:

- publish two scores
- `core_final_score`
  - excludes internal-calibration contribution
  - is the absolute public benchmark score
  - is the only score valid for cross-model comparison and the only score allowed on the public leaderboard
- `calibration_augmented_score`
  - includes internal calibration when supported
  - is a secondary research metric for open-weight or capability-exposing systems only

Reporting rule:

- leaderboards must rank by `core_final_score`
- `calibration_augmented_score` is reported as a capability-contingent secondary metric
- runs in `unsupported` mode must not be directly compared to `internal_and_external` on calibration claims without explicit caveat
- black-box API models that expose only text remain fully eligible for the primary benchmark because `core_final_score` is computed only from externalized Pass 1 through Pass 3 artifacts
- it is forbidden to mix `calibration_augmented_score` into the public ranking, aggregate leaderboard summaries, or headline win-rate claims

Design implication:

- missing logits reduce observable capability coverage, but they do not corrupt the benchmark's main comparable score

## Ontology V1 Authority

Ontology V1 must be strictly narrow.

The benchmark must avoid becoming a general-purpose metaphysics engine.

V1 contains exactly four distinct, non-overlapping domains:

1. `physical`
   - has mass, volume, and location
   - examples: `teapot`, `cup`, `water`

2. `abstract_conceptual`
   - ideas, math, logic, and formal abstractions
   - examples: `fairness`, `justice`, `the number 4`

3. `sensory_perceptual`
   - qualities that require an observer or perceptual frame
   - examples: `blue`, `loud`, `sweet`

4. `social_relational`
   - statuses or relations that exist by consensus, norm, or institution
   - examples: `polite`, `married`, `illegal`

Rule:

- every benchmark entity must map to exactly one V1 ontology domain
- cross-domain mappings are invalid unless they are explicitly marked as metaphorical framing
- V1 must not introduce subdomains that blur the boundary between these four top-level categories

Benchmark failure definition:

- failure occurs when an answer treats an entity from one domain as if it literally possesses the operative properties of another domain without metaphorical framing

Examples:

- `fairness` as a liquid: invalid `abstract_conceptual -> physical`
- `blue` as a legal status: invalid `sensory_perceptual -> social_relational`
- `marriage` as having a weight in kilograms: invalid `social_relational -> physical`

Non-failure examples:

- explicitly metaphorical phrasing such as "time is money" when the answer marks it as analogy rather than literal ontology
- valid discussion about how a social construct is measured indirectly through physical proxies, so long as the answer does not collapse the proxy into the construct itself

Required authoring rule:

- scenario annotations must specify whether metaphor is disallowed, tolerated, or intentionally tested

Design implication:

- ontology disputes are contained because the benchmark only judges literal cross-domain property assignment inside a fixed four-domain system
- this keeps `Type Violation Score` operational rather than philosophical

## Risks In The Prompt Set

### Risk 1: Overloading One Deliverable

Prompt 1 asks for a paper foundation.
Prompt 2 asks for an implementation subsystem.
Trying to satisfy both in one model turn will encourage polished vagueness.

Mitigation:

- split them into separate artifacts with explicit dependencies

### Risk 2: Brittle Deterministic Matching

Prompt 2 leans on regex and keywords.
That is only safe if the scenario authoring format constrains the target vocabulary tightly.

Mitigation:

- canonical failure IDs
- synonym tables
- lemmatization
- sentence-level matching traces
- human-reviewable false-negative fixtures

### Risk 3: Arbiter Expansion

Without hard schema boundaries, an arbiter will invent new scoring dimensions and rationales.

Mitigation:

- enum-only semantic outputs
- strict JSON schema
- retry-on-invalid-output
- reconciler ignores fields outside schema

### Risk 4: False Mathematical Precision

Weights and thresholds can look rigorous before they are calibrated.

Mitigation:

- mark pre-calibration constants as provisional
- require a calibration protocol before publishing benchmark claims
- ship early only under explicit provisional labeling

### Risk 5: Construct Collapse

If coherence and validity are estimated from the same evidence stream, the benchmark stops measuring "coherent nonsense" and starts measuring generic quality.

Mitigation:

- separate coherence and validity channels
- calibrate coherence on truth-blinded annotators
- require disagreement analysis during pilot runs

## Recommended Immediate Deliverables

The next implementation milestone should produce three documents in order:

1. `FOUNDATION.md`
   - mathematical formalization and annotation rules

2. `PASS_SCHEMA.md`
   - canonical pass artifacts and JSON schemas

3. `PASS4_ARCHITECTURE.md`
   - deterministic verifier, arbiter verifier, reconciler, and calibration rules

If there is only bandwidth for one engineering document next, it should be `PASS_SCHEMA.md`.

Reason:

- it is the missing bridge between the strong ideas in Prompt 1 and the concrete machinery demanded by Prompt 2

What `PASS_SCHEMA.md` must settle explicitly:

- stable IDs for constraints, failure modes, repairs, and causal edges
- provenance and lineage fields for every artifact
- multi-agent extension fields, marked optional and extension-gated
- capability modes for calibration support
- arbiter runtime metadata and official/unofficial leaderboard status
- span-reference format for auditability
- versioning rules for ontology, thresholds, and reconciler logic

## Where This May Break

These are the main ways this design can fail or underperform even if implemented correctly.

### 1. Annotation Burden May Be Too High

Why it breaks:

- constraint catalogs, ontology tags, causal graphs, failure IDs, and adversarial critiques all require disciplined authoring
- if authoring cost is too high, scenario quality will collapse before the verifier does

What to do:

- start with a small gold set
- require annotation templates and linting
- measure author-hours per scenario during pilot

### 2. Deterministic Matching May Still Be Too Brittle

Why it breaks:

- paraphrases, compressed critique styles, and indirect repairs may evade canonical phrase matching even with synonym tables

What to do:

- score on linked IDs plus span extraction, not keyword presence alone
- maintain replay fixtures for false negatives
- allow the arbiter to add bounded evidence flags, but never to rewrite hard counts

### 3. Coherence Scoring May Leak Truth

Why it breaks:

- judges asked to score "coherence" often silently downgrade false content because they are reacting to truth, not fluency

What to do:

- use a separate coherence rubric with truth explicitly out of scope
- validate it against human blind ratings
- test whether coherence scores stay high on intentionally false but polished items

### 4. Ontology Distance May Be Unstable Across Domains

Why it breaks:

- type-distance judgments depend on ontology granularity
- a shallow ontology makes everything look severe or trivial

What to do:

- freeze the four-domain V1 ontology as the only default authority
- freeze ontology versions per benchmark release
- record `ontology_version` in all outputs
- forbid cross-version comparisons without remapping
- define distances only across the four sanctioned domains, not ad hoc subtypes, in V1

### 5. Causal Graphs May Be Under-Specified

Why it breaks:

- real nonsense often hides in omitted variables and missing edges rather than obviously wrong edges

What to do:

- let scenarios encode known alternative causes and null-intervention tests
- mark causal coverage limits in scenario metadata
- avoid overstating do-calculus strength when the graph is sparse

### 6. Density Penalties May Punish Legitimate Repair

Why it breaks:

- some good repairs are longer because they replace one bad premise with explicit caveats and grounded alternatives

What to do:

- never use verbosity as a standalone penalty
- gate density-drop penalties on unresolved-constraint evidence
- audit false-positive penalty cases manually during calibration

### 7. Multi-Agent Contagion May Be Hard To Attribute

Why it breaks:

- two agents may converge on the same bad idea independently
- shared context can look like contagion even when no peer influence occurred

What to do:

- distinguish lineage, shared-source exposure, and direct critique adoption
- measure contagion only when artifact references show clear inheritance paths
- report contagion confidence bands, not just a single raw rate

### 8. API Capability Fragmentation Will Distort Coverage

Why it breaks:

- some model surfaces expose logits, some expose token probabilities, some expose neither

What to do:

- keep `core_final_score` comparable across all capability modes
- isolate capability-contingent metrics
- publish support matrices with every benchmark run

### 9. Arbiter Drift Can Reappear Through Prompt Maintenance

Why it breaks:

- even with strict schemas, prompt edits can shift enum usage patterns over time

What to do:

- version arbiter prompts
- keep malformed-output and drift-detection fixtures
- require revalidation after prompt or model changes

### 11. Community Feedback May Bias Calibration

Why it breaks:

- if only loud disagreement cases are collected, post-launch calibration may overfit to visible complaints rather than representative failures

What to do:

- separate organic community reports from stratified audit samples
- keep a fixed internal validation subset unchanged across versions
- document which threshold updates came from public reports versus controlled review

### 10. The Benchmark May Not Transfer Cleanly To Fact-Heavy Domains

Why it breaks:

- the benchmark targets coherence-vs-truth and invalid-premise acceptance, not full external fact verification

What to do:

- state the scope boundary clearly
- avoid claiming broad truth-evaluation performance outside the benchmark design
- add separate fact-grounding evaluations if product claims expand

## Suggested Next Prompt Rewrites

### Rewrite Prompt 1 As

"Produce the benchmark foundation and annotation spec for Invisible Tea Party. Define the scenario schema, ontology schema, causal graph schema, coherence and validity normalization, failure taxonomy, and calibration fallback modes. Every metric must map to an explicit artifact field."

### Rewrite Prompt 2 As

"Assume the foundation spec and pass schemas are finalized. Produce the Pass 4A / 4B / 4C implementation design, including deterministic matching policy, arbiter schema and retry handling, reconciler override rules, final score audit trail, and calibration protocol."

This keeps each task within a coherent abstraction boundary.

## Recommendation Summary

Both prompts are directionally right.

Prompt 1 is the theory brief.
Prompt 2 is the verifier-systems brief.

The mistake would be treating them as a single immediate coding task.

The right move for this repo is:

1. define Invisible Tea Party as a new benchmark family
2. write the missing pass schemas
3. implement Pass 4 only after those artifacts exist
4. calibrate thresholds before making benchmark-strength claims

That path preserves the strongest property already present in `ct-mcp`:

- deterministic evidence is explicit
- semantic judging is bounded
- evaluation remains auditable
