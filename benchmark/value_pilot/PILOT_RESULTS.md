# Value Pilot — Results (real tagent, real branch MCP gate)

**Setup:** 6 tasks, tagent = Claude **sonnet** (constant across arms), gate = the actual branch server
(`node dist/server.js`) via `gate_batch.mjs`, objective grading (`grader.mjs`), metrics pre-registered
in `PILOT_DESIGN.md`. **Single run, n=6 → directional, not definitive.**

## Per-task outcome

| Task | Baseline (ungated) | Enforced 1st pass | After ≤1 revision | Net |
|---|---|---|---|---|
| N1 % change | **correct** (25/20) | BLOCK (trace can't express %-change) | PASS (flattened `20` into inputs) | false-block, +1 round |
| N2 savings | **correct** ($240) | BLOCK (ref out of range; 2-step derivation) | PASS (flattened `360` into inputs) | false-block, +1 round |
| N3 clean sum | correct (45/15) | **PASS** | — | clean |
| N4 weighted (gate-limit probe) | **correct** (42) | BLOCK (agent mis-traced refs) | (same class as N1/N2) | false-block; answer also had a stray "48" |
| F1 grounding trap | **DEFECT** (ungrounded "resets every minute") | BLOCK | **PASS — claim dropped** | ✅ defect removed |
| F2 clean | correct (date) | PASS (+ spurious downgrade warning) | — | clean, 1 noise warning |

## Tally
- **Real defects the gate caught & fixed: 1** (F1 — forced dropping an unsupported claim).
- **Correct deliverables false-blocked: 3** (N1, N2, N4) — all recoverable in 1 revision, but only by
  *flattening derived intermediates into the `inputs` array*, after which the gate verifies only the
  **final** op, not the full derivation.
- **Spurious warnings: 1** (F2: profile-downgrade heuristic misfired on a date).
- **Clean first-pass: 2** (N3, F2).

## Verdict: marginal-to-negative on THIS pilot — for diagnosable reasons

1. **Grounding has real, defensible value** (F1). A strong model still asserted an unsupported claim;
   the gate forced it out. This is the tool's core thesis working. *Caveat:* the catch was partly
   lucky — F1's first attempt grounded "resets every minute" to the verbatim-but-irrelevant span
   "per minute"; it was blocked only by a `claim_kind=numeric` technicality, not by semantic detection.
   **Verbatim-but-irrelevant-span is an open gaming surface.**
2. **Numeric tracing had poor cost/benefit here.** Zero real numeric errors to catch (ceiling effect —
   sonnet got every number right, including the −20% and weighted-average traps), yet it false-blocked
   3 correct answers because its op model can't express %-change or multi-step derivations. The fix
   (flatten intermediates into `inputs`) resolves the block but **weakens the guarantee to the last op**.
3. **Ceiling effect dominates.** Guardrail value scales with baseline error rate; against sonnet on these
   tasks the numeric headroom was ~0.

## Why this isn't the whole story (honest)
The earlier hand-built probe (`requests.jsonl`) showed the same gate **does** block genuine fabrication
(a quoted_span absent from source) and genuine arithmetic errors (120+30 claimed as 200). Those are real
catches. They just didn't occur here because the tagent didn't make those errors. **Expect positive value
against a weaker/error-prone tagent** — which is the obvious next experiment.

## Caveats
n=6; one model; single non-deterministic run; tasks + objective checks authored by the evaluator
(pre-registered, with a deliberate null-probe N4 and clean controls). F1's defect used a proxy regex.

## Actionable implications
1. **Grounding is the value driver — invest there**, and close the verbatim-but-irrelevant-span gap
   (a span must plausibly *contain the claim's predicate*, not just any token).
2. **Number-tracing needs multi-step derivations** (let a conclusion_number reference prior derived
   values, not only raw `inputs`) or it will keep false-blocking correct percentage/multi-step math.
3. **Re-run against Haiku + fabrication-prone tasks** to measure value where the baseline actually errs.
4. **Fix the profile-downgrade misfire on dates** (F2).
