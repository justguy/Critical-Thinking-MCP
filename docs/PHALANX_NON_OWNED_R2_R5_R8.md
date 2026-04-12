# CT-MCP Non-Ownership Boundary: R-2, R-5, R-8

CT-MCP Non-Negotiable Constraint #6 states: "No capability inflation — Phalanx must not
repurpose a nearby CT-MCP tool as if it solved a different requirement just because the names
sound related." This document records the three requirements where that risk is highest in V1.
CT-MCP does not own R-2, R-5, or R-8. Using any existing ct-mcp tool as a substitute for
these requirements is an integration bug, not a shortcut.

---

## R-2 — Rebuttal Loop Enforcement

### Verbatim requirement (Phalanx CT_MCP_REQUIREMENTS.md)

> Phalanx MUST own typed rebuttal schema validation, rebuttal-cycle caps, and escalation rules.
>
> CT-MCP may be re-invoked on a typed rebuttal payload, but CT-MCP does not own:
> - the 2-cycle cap
> - the escalation target
> - the API boundary schema validation
>
> Rules:
> - rebuttals failing schema validation are rejected by Phalanx before any CT-MCP re-evaluation
> - Phalanx enforces the hard cap, recommended `max 2 iterations`
> - Phalanx decides whether the draft fails, pivots, or returns for scope renegotiation after the cap is hit

### CT-MCP does NOT own this in V1.

### Closest-sounding ct-mcp surface

`validate_reasoning_chain` accepts structured reasoning graphs and can re-evaluate whether a
revised chain has addressed prior objections. This might tempt an integrator to wire it as the
rebuttal-loop enforcer.

It is NOT a substitute because:
- It has no concept of a rebuttal cycle count and cannot enforce a 2-iteration cap.
- It does not validate the `Rebuttal` schema (fields: `objection_id`, `resolution_type`,
  `machine_checkable_basis`, `tradeoff_accepted`, `residual_risk`, `approval_required`).
- It does not decide escalation targets or advancement — it returns verdict signals that
  Phalanx feeds into its own state machine.

### Precise misuse examples

1. Calling `validate_reasoning_chain` with a rebuttal payload and treating a PASS result as
   "the rebuttal was accepted within cap" — ct-mcp has no cycle counter; this check would
   always pass on the first invocation, silently skipping the cap.

2. Routing `machine_checkable_basis` array items through `check_numeric_claims` or
   `verify_arithmetic` as a substitute for Phalanx's schema validation of `Rebuttal.kind`
   enum values — these tools check numbers, not typed rebuttal schemas.

---

## R-5 — Hallucinated Seam Detection

### Verbatim requirement (Phalanx CT_MCP_REQUIREMENTS.md)

> Phalanx MUST own V1 hallucinated-seam detection and must not repurpose `entity_grounding`
> as if it solved repo-grounded seam existence checking.
>
> Required V1 direction:
> - use real file lists
> - use repo-native symbol extraction such as FileAnalyzer output
> - block or warn on non-existent target shells, seam consumers, or symbols according to Phalanx policy
>
> Roadmap note:
> - wait for a real CT-MCP reference-grounding tool before migrating this responsibility

### CT-MCP does NOT own this in V1.

### Closest-sounding ct-mcp surface

`score_response_quality` invokes an internal `entity_grounding` mechanism
(`src/enforcement/entity_grounding.ts`) as part of its quality scoring pipeline. The name
"entity grounding" sounds like it might detect hallucinated file paths or symbols.

It is NOT a substitute because:
- `entity_grounding.ts` operates on entities extracted from `response_text` prose — it checks
  whether entity tokens co-occur with supporting evidence in the same text, not whether those
  entities exist in a repository.
- It has no access to a file system, symbol table, or repo-native FileAnalyzer output.
- Its `score_response_quality` inputSchema accepts `response_text`, `claims`, `evidence`, and
  `context` — no `repo_root`, `file_list`, `symbol_table`, or equivalent.
- Passing a list of seam paths as `evidence` strings and interpreting a high `structure_score`
  as "seams exist" is undefined behavior; the tool measures response text quality, not
  file-system truth.

### Precise misuse examples

1. Calling `score_response_quality` with `response_text` containing proposed seam paths and
   treating a high `specificity_score` as proof that those seams exist in the repo — this tool
   never reads the file system.

2. Passing a `symbol_table` array in the payload (not a defined input property) expecting
   ct-mcp to compare claimed symbols against real ones — the tool will ignore unknown keys and
   score only the response text.

---

## R-8 — Retry Drift

### Verbatim requirement (Phalanx CT_MCP_REQUIREMENTS.md)

> Phalanx MUST own retry-contract drift detection in V1.
>
> Do not repurpose `detect_drift` as if it were a structured contract-diff tool.
>
> Required V1 direction:
> - stable stringify
> - contract hash / diff
> - explicit justification requirement for changed contract fields
>
> Roadmap note:
> - later migration is possible if CT-MCP ships a structured-drift tool purpose-built for
>   contract evolution

### CT-MCP does NOT own this in V1.

### Closest-sounding ct-mcp surface

`detect_drift` applies CUSUM (Cumulative Sum) analysis to a `sequence: number[]` to detect
statistical drift in a numeric time series. "Drift" in the tool name might suggest it can
compare contract revisions across retry cycles.

It is NOT a substitute because:
- Its only input payload is a `sequence` of numbers plus an optional `drift_sensitivity`
  scalar — there is no concept of a contract object, field-level diff, or justification.
- CUSUM is a statistical change-point detector for numeric series (e.g., a score trending
  upward). It cannot distinguish "contract field added with justification" from "contract field
  silently removed."
- It produces `is_improving / is_stalling / is_declining` verdicts over a metric trend, not
  a structured diff of typed contract fields between retry attempts.

### Precise misuse examples

1. Serializing two contract objects to a numeric hash each, passing `[hash_v1, hash_v2]` as
   `sequence`, and interpreting a CUSUM spike as "the contract drifted unexpectedly" — a 2-
   element sequence is below the 3-element minimum and conveys no directional trend signal.

2. Mapping contract fields to confidence scores across retry iterations and running
   `detect_drift` on the resulting vector, then treating CUSUM drift as a proxy for
   "justification absent" — the tool has no mechanism to check whether a change was
   justified; it only measures numeric magnitude change.

---

Source of truth for Phalanx requirements:
`/Users/adilevinshtein/Documents/dev/Project-Phalanx/docs/CT_MCP_REQUIREMENTS.md`
