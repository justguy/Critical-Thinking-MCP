# Value Pilot — Results (real tagent, real branch MCP gate)

**Setup:** 6 toy tasks, two tagent runs (Claude **sonnet** and **haiku**), gate = the actual branch server
(`npm run build` immediately before `node dist/server.js`) / host layer, objective proxy grading
(`grader.mjs`), metrics pre-registered for Run 1 in `PILOT_DESIGN.md`. **Two 6-task runs → directional,
not definitive.**

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

## Run 1 (sonnet) verdict: marginal-to-negative on THIS pilot — for diagnosable reasons

1. **Grounding has real, defensible value** (F1). A strong model still asserted an unsupported claim;
   the gate forced it out. This is the tool's core thesis working. *Caveat:* the catch was partly
   lucky — F1's first attempt grounded "resets every minute" to the verbatim-but-irrelevant span
   "per minute"; it was blocked only by a `claim_kind=numeric` technicality, not by semantic detection.
   **Verbatim-but-irrelevant-span is an open gaming surface.**
2. **Numeric tracing had poor cost/benefit here.** Zero real numeric errors to catch (ceiling effect —
   sonnet got every number right, including the −20% and weighted-average traps), yet it false-blocked
   3 correct answers because its op model can't express %-change or multi-step derivations. The fix
   (flatten intermediates into `inputs`) resolved that historical block but narrowed checked numeric
   coverage; newer gate hardening blocks unanchored flattened inputs and requires `arithmetic_checks`.
3. **Ceiling effect dominates.** Guardrail value scales with baseline error rate; against sonnet on these
   tasks the numeric headroom was ~0.

## Why this isn't the whole story (honest)
The earlier hand-built probe (`requests.jsonl`) showed the same gate **does** block genuine fabrication
(a quoted_span absent from source) and genuine arithmetic errors (120+30 claimed as 200). Those are real
catches. They just didn't occur here because the tagent didn't make those errors. **Expect positive value
against a weaker/error-prone tagent** — which is the obvious next experiment.

## Caveats
Two non-deterministic 6-task runs on the same toy task set; tasks + objective checks authored by the
evaluator (Run 1 pre-registered, with a deliberate null-probe N4 and clean controls). F1's defect used a
proxy regex, and the grader is substring/proxy-based rather than a structured truth oracle.

## Actionable implications
1. **Grounding is the value driver — invest there**, and close the verbatim-but-irrelevant-span gap
   (a span must plausibly *contain the claim's predicate*, not just any token).
2. **Number-tracing needs multi-step derivations** (let a conclusion_number reference prior derived
   values, not only raw `inputs`) or it will keep false-blocking correct percentage/multi-step math.
3. **Re-run against Haiku + fabrication-prone tasks** to measure value where the baseline actually errs.
4. **Fix the profile-downgrade misfire on dates** (F2).

---

## Run 2 (haiku) — testing the pre-registered "weaker baseline → value" hypothesis

Same 6 tasks, tagent = **haiku**, enforced arm gated **end-to-end through the shipped host layer**
(`enforceDeliverable`, `host_batch.mjs`). This tested the Run-1 prediction that value appears against a
weaker/error-prone tagent.

**Baseline (haiku, ungated): 6/6 correct, 0 defects.** Haiku solved every task — including the −20%,
weighted-average, and savings traps — and was *more* careful than sonnet on F1: it answered "the source
does not specify how often the limit resets" (declined to fabricate) where sonnet asserted "resets every
minute." (A grader proxy-regex false-fired on that correct decline; fixed to exclude negated statements —
honest baseline is 0 defects.)

**Enforced (haiku, real host gate):**
| Task | Host decision | Note |
|---|---|---|
| N1 | **REJECT** (gate_block) | false-block: correct 25/20, %-change untraceable in op vocab |
| N2 | RELEASE | correct (haiku pre-flattened 360/240 into inputs on its own) |
| N3 | RELEASE | correct |
| N4 | **REJECT** (gate_block) | false-block: correct 42, mis-traced 420 |
| F1 | RELEASE | correct, no ungrounded claim (haiku declined) |
| F2 | RELEASE | correct |

**Net: 0 real defects to catch, 2 false-blocks of correct work.** The host gate itself behaved perfectly
(correct RELEASE/REJECT, correct hash handling) — there was simply nothing to catch.

## Combined verdict (two runs): **no deliverable-level value on this task set — and the ceiling is TASK difficulty, not model strength**

The Run-1 hypothesis was **not supported**: a weaker tagent did not err more here. Both sonnet and haiku
solve these toy tasks, so the gate has no real errors to catch and only imposes false-block cost on
correct numeric answers (the op model can't express %-change/multi-step without flattening). The
host-enforcement layer is **necessary and works**, but it cannot create value where the deliverables have
no catchable defects.

**This is a null result, reported as such — not fished further.** Trying more model/task combinations
until value appears would be exactly the "show me what you want to see" failure mode to avoid.

### What the gate's value actually rests on (proven elsewhere, not fished)
The hand-built adversarial probe (`requests.jsonl`) — run through the real server — **does** block a
fabricated quote (`quoted_span` absent from source) and a wrong sum (120+30 claimed as 200), and releases
clean inputs. So the **mechanism demonstrably catches real fabrication/arithmetic errors when they occur.**
The pilot's lesson is that **value is conditional on operating where those errors actually occur** — long-
context synthesis, multi-source RAG, high-volume/agentic pipelines, adversarial inputs — none of which a
6-task toy set reproduces.

### The honest next experiment (not run here)
A real error-density benchmark: a representative task distribution where capable models measurably fail
(long-context grounding, multi-step financial math, retrieval with distractor sources), host-enforced via
`ct-enforce`, scored on defects-prevented vs false-blocks. That — not another toy A/B — is what would
move the verdict.
