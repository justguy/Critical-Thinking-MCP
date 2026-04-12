# CT-MCP Non-Ownership Boundary: R-3, R-4

CT-MCP is a deterministic signal provider inside Phalanx's critic stack. Two
requirements — R-3 (Deterministic Proof Classification) and R-4 (Canonical
Truth Enforcement) — are explicitly **not** owned by CT-MCP in V1. This page
documents why, with verbatim requirement text, so that the ownership boundary
stays legible to future integrators and is not silently eroded.

Non-negotiable constraint #6 in the Phalanx requirements is "No capability
inflation": Phalanx must not repurpose a nearby CT-MCP tool as if it solved a
different requirement just because the names sound related. Non-negotiable
constraint #2 is "Stateless": each CT-MCP invocation receives full context;
no state accumulates between calls. Both constraints are load-bearing for the
reasoning below.

---

## R-3 — Deterministic Proof Classification

### Verbatim requirement text

> **R-3 — Deterministic Proof Classification**
>
> V1 owner: **Phalanx**
>
> Phalanx MUST own deterministic proof classification for V1.
>
> Why:
>
> - current CT-MCP capability does not honestly ship this as a stable tool
> - proof classification must be deterministic on repo-native test artifacts
>   now, not after CT-MCP's beta-to-v1 transition
>
> Required V1 direction:
>
> - parse the actual test files and receipts
> - classify proof using deterministic multi-signal rules
> - do not infer proof class from generic stdout like `PASS`
>
> Signal examples:
>
> - target shell mounted or only leaf component mounted
> - real path import or direct component import
> - target seam mocked or not
> - real interaction driven or not
> - assembly/integration receipt present or not
>
> Roadmap note:
>
> - post-stabilization, this may migrate to CT-MCP if CT-MCP later ships a
>   stable structured proof-classification tool with human-scored precision

### CT-MCP does NOT own this in V1

Proof classification requires reading and parsing test source files in the
target repository — inspecting import paths, mount depth, mock boundaries, and
interaction receipts. CT-MCP tools operate exclusively on structured payloads
supplied by the caller. They perform no repo I/O, no file-system reads, and no
test-source parsing. A `PASS` status from any CT-MCP tool (e.g.
`validate_reasoning_chain` or `check_plan_validity`) indicates that the
supplied structured payload satisfies the relevant deterministic check; it says
nothing about the proof class of any test in any repository.

Treating a nearby CT-MCP `PASS` as an implicit proof classification would be
the exact capability inflation that constraint #6 prohibits. The nine tools in
the current registry (`validate_reasoning_chain`, `check_numeric_claims`,
`detect_drift`, `evaluate_tradeoffs`, `check_plan_validity`,
`score_response_quality`, `validate_confidence`, `verify_arithmetic`,
`detect_concurrency_patterns`) have no input schema properties for test files,
target shells, seam descriptions, or proof receipts, and they return no
`proof_class` field.

### Phalanx roadmap note

R-3 may migrate to CT-MCP post-stabilization if CT-MCP ships a stable,
structured proof-classification tool with human-scored precision. Until that
tool exists and passes a staging benchmark, R-3 remains Phalanx-owned. Do not
assume migration based on roadmap intent alone.

---

## R-4 — Canonical Truth Enforcement

### Verbatim requirement text

> **R-4 — Canonical Truth Enforcement**
>
> V1 owner: **Phalanx**
>
> Canonical closure truth is not CT-MCP's job.
>
> Phalanx MUST own:
>
> - canonical piece/run closure truth schemas
> - reducer logic
> - serialization invariants
> - renderer restrictions for report / PDF / demo / summary surfaces
>
> CT-MCP must not be described as the owner of `closure_status` serialization
> or verified-state authorization.

### CT-MCP does NOT own this in V1

Canonical closure truth requires a multi-event reducer: state is accumulated
across the full lifecycle of a piece/run, serialization invariants are enforced
at write time, and renderer restrictions control what surfaces may consume the
authoritative truth object. CT-MCP is stateless per call (non-negotiable
constraint #2). Each invocation receives a complete payload and returns a
verdict; nothing persists between calls. There is no mechanism in CT-MCP for
accumulating piece/run events, maintaining a reducer, or enforcing serialization
invariants across calls.

Canonical closure truth is also not a CT-MCP roadmap target. The stateless
architecture is a deliberate design property that makes CT-MCP fast,
deterministic, and free of hidden side effects. Retrofitting a stateful reducer
and serialization layer would contradict that architecture. Phalanx is the
correct owner of R-4 for the foreseeable future.

No CT-MCP tool accepts input properties named `closure_status`,
`verified_state`, `canonical_truth`, `closure_truth`, `verified_sources`, or
`invariant_hash`. No CT-MCP tool returns any field named `closure_status`,
`proof_class`, or `verified_state`. The assertion tests in
`tests/boundary/non_ownership_r3_r4.test.ts` enforce these invariants against
the live TOOLS registry on every CI run.

---

## Reference

Authoritative Phalanx requirements:
`/Users/adilevinshtein/Documents/dev/Project-Phalanx/docs/CT_MCP_REQUIREMENTS.md`

Relevant sections: Non-Negotiable Constraints items 2 and 6; Ownership Split
for V1 table rows R-3 and R-4; R-3 and R-4 subsections.
