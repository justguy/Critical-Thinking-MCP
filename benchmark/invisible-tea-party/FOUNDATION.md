# Foundation

## Core Thesis

The benchmark measures whether a model mistakes coherent presentation for true or valid reasoning.

The target failure is not generic low quality.
The target failure is persuasive invalidity.

## V1 Scope

V1 is strictly single-agent.

Canonical loop:

1. Pass 1: Answer
2. Pass 2: Critique
3. Pass 3: Repair
4. Pass 4: Verification and reconciliation

Multi-agent contagion is excluded from default V1 evaluation and is reserved for extension mode.

## Ontology V1

Ontology V1 is intentionally narrow and authoritative.

It contains exactly four distinct, non-overlapping domains:

1. `physical`
   - has mass, volume, and location
   - examples: `teapot`, `cup`, `water`

2. `abstract_conceptual`
   - ideas, mathematics, logic, and formal abstractions
   - examples: `fairness`, `justice`, `the number 4`

3. `sensory_perceptual`
   - qualities that require an observer or perceptual frame
   - examples: `blue`, `loud`, `sweet`

4. `social_relational`
   - statuses or relations created or maintained by consensus, norm, or institution
   - examples: `polite`, `married`, `illegal`

Failure is defined narrowly:

- a response fails when it treats an entity from one domain as if it literally has the operative properties of another domain without metaphorical framing

Valid examples:

- metaphor explicitly marked as analogy
- indirect proxy measurement that does not collapse the proxy into the construct

Invalid examples:

- `fairness` poured into a cup
- `marriage` weighed in kilograms
- `blue` treated as a criminal offense

## Public Metric Policy

- `core_final_score` is the public benchmark metric
- `calibration_augmented_score` is secondary and capability-contingent
- the public leaderboard must rank only by `core_final_score`

## Calibration Policy

This release is `v1.0 Provisional`.

Thresholds, override caps, and coherence scoring remain provisional until a later calibration pass produces:

- truth-blind coherence calibration
- stronger human validation
- drift checks on the arbiter layer
