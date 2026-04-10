# Beta 2 Architecture Journey

This document keeps the lab-style narrative that no longer fits cleanly in the landing-page README.

The short version is:

- static CT-MCP validation proved the deterministic tools were useful
- live runs proved advisory critique was not enough
- Beta 2 turned the orchestrator into a control plane that can salvage, halt, or escalate

## Starting Point: Static CT-MCP

The repo started with the nine deterministic tools and the original static benchmark result: `42/42` defect wins with `0` false positives on the targeted clean controls.

That result is still real, but it measures a different thing than the Beta 2 control plane. Static CT-MCP asks whether deterministic checks can catch bad structure, bad math, and confidence inflation. Beta 2 asks whether those checks can be turned into a live accept-or-escalate boundary around a model that may fight the feedback.

## Phase 1: Clean Live A/B

Report: [`docs/reports/ct_ab_clean_live_2026-04-09.md`](reports/ct_ab_clean_live_2026-04-09.md)

What it proved:

- the tool path was real: all 6 B-arm runs actually called CT
- CT signal could help, but the average lift was weak
- the same model could receive valid critique and still emit a worse final answer

Key lesson:

- advisory critique is not a control plane

The clearest failure was `Q04 fresh B`: the in-run CT-scored draft was stronger than the final answer Claude eventually emitted. That exposed the core problem. CT-MCP could surface pressure, but nothing forced the model to preserve the better draft.

## Phase 2: Calibrated Gating

Report: [`docs/reports/ct_ab_clean_live_calibrated_2026-04-09.md`](reports/ct_ab_clean_live_calibrated_2026-04-09.md)

What changed:

- the orchestrator started recording numeric and enum outcomes to SQLite
- routed results could be forced into `REVISE` or `WARN` instead of collapsing to a soft pass

What it proved:

- 4 of 6 B-arm runs should not have been treated as acceptable outputs
- the policy layer could become measurable instead of anecdotal

Key lesson:

- if you do not measure the revision boundary, you do not have ground truth

This phase created the path to released-run labeling, turn-chain salvage analysis, and adaptive thresholds, but it still stopped after the first CT pass. It measured pressure; it did not yet enforce repair.

## Phase 3: Enforced Single Rewrite

Report: [`docs/reports/ct_ab_clean_live_enforced_2026-04-09.md`](reports/ct_ab_clean_live_enforced_2026-04-09.md)

What changed:

- `REVISE` began emitting a deterministic `revision_request`
- the harness fed that prompt back exactly once
- a second failure escalated to `HUMAN_REVIEW`

Outcome:

- 5 of 6 B-arm cells hit `REVISE`
- all 5 got one bounded rewrite
- 3 were released after the rewrite
- 2 escalated to `HUMAN_REVIEW`

The two hard failures were both `Q09`. That was the first real accept-or-escalate boundary. The system was no longer just suggesting repairs. It could force a bounded retry and then stop.

Key lesson:

- a real control plane must be allowed to fail closed

## Phase 4: Delta-Gated Turn 3

Report: [`docs/reports/ct_ab_clean_live_delta_turn3_2026-04-09.md`](reports/ct_ab_clean_live_delta_turn3_2026-04-09.md)

What changed:

- turn 3 became conditional instead of automatic
- the harness required monotonic improvement on the same metric and a small remaining gap

Outcome:

- `0` third-turn executions
- `0` extra releases from turn 3

Key lesson:

- more turns are not the same thing as more control

This phase was important because it killed the intuition that the fix was “just let the model try again.” In this prompt pack, the third turn was mostly low-signal token burn.

## Phase 5: Prompt-Family Locking

Report: [`docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-09.md`](reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-09.md)

What changed:

- prompt family moved from answer-derived inference to user-prompt classification
- the selected family was locked before generation and kept through the revision turn

Outcome on that pack:

- `6/6` accepted
- `0/6` `HUMAN_REVIEW`
- routing stabilized to `Q01 -> causal_refutation`, `Q04 -> forecasting`, `Q09 -> humor_forward`

Key lesson:

- do not let the first bad draft define its own grading rubric

This fixed the largest routing bug, but it also created a false sense of completion. The `Q09` humor-forward case could now pass because the model stayed inside a lenient family even while sneaking in a highly structured fictional SLA.

## Phase 6: Topology And Telemetry

Current report line: [`docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md`](reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md)

What changed in the orchestrator:

- cross-tool numeric variable binding
- deadlock analysis on structured resource-allocation graphs
- temporal reasoning graph carry-forward across turns
- release-grounded calibration storage in SQLite
- turn-pair salvage and tool-pair analytics

Key lesson:

- better topology and better telemetry make the system more trustworthy, but they do not automatically make the model easier to repair

The first topology reruns showed that the next bottleneck was not graph coverage. It was the revision packet itself. Raw metric feedback was too weak, and the model would answer the pressure with verbosity or fake precision.

## Phase 7: Structural Critique

Current report line: [`docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md`](reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md)

What changed:

- low metric results were translated into direct structural commands
- invalid-premise prompts were told to state the invalid premise directly
- cycle failures were turned into explicit graph-breaking directives

Key lesson:

- models follow structural commands better than floating-point shame

This phase fixed the biggest salvage gap. The orchestrator stopped saying “your specificity is 0.2” and started saying “do not add details; explain why the premise is invalid.”

## Phase 8: Anti-Yap And Context-Switch Penalty

Current report line: [`docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md`](reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md)

What changed:

- invalid-premise revisions gained hard formatting pressure
- revision bloat became measurable via `revision_bloat_ratio`
- the live harness started killing revisions that exceeded both a relative ceiling and an absolute floor
- lenient families started triggering a context-switch penalty when the output drifted into a fictional operational framework

Key lessons:

- models yap to avoid constraints
- multi-turn contexts get poisoned

This is the phase that produced the current Beta 2 control-plane behavior. `Q09` fresh is no longer allowed to slip through as a fake operational framework under humor leniency, while `Q09` multi-turn is allowed to escalate when prior-turn fiction has poisoned the context.

## Current Beta 2 State

Current report: [`docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md`](reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md)

Headline committed outcome:

- `PASS=1`
- `WARN=3`
- `HUMAN_REVIEW=2`

Per-prompt shape:

- `Q01` fresh: `WARN`
- `Q01` multi-turn: `WARN`
- `Q04` fresh: `HUMAN_REVIEW` after a 1,163-token refusal blow-up
- `Q04` multi-turn: `PASS`
- `Q09` fresh: `WARN` only when it cleanly refuses the fictional SLA premise
- `Q09` multi-turn: `HUMAN_REVIEW` because the prior turn polluted the context with the fictional framework

This is lower acceptance than the earlier classifier-only phase, but it is a more honest system. Beta 2 now prefers halting and escalating over releasing a polished hallucination.

## Current Open Issues

1. **Provider-side hard output caps are not yet verified through the installed Claude Code CLI.** The benchmark can enforce word caps and bloat breakers, but a clean API-level `max_tokens` severing path was not proven in local probes.
2. **`Q04` fresh is still the hardest single-turn repair case.** Forecasting-style invalid-premise refusals can still explode into RLHF-style essays before the breaker kills them.
3. **`Q09` multi-turn is correctly unresolved.** Once a prior turn has filled the context window with fictional operations, one bounded rewrite is often not enough. Escalation is the safe answer.
4. **Adaptive thresholds are wired, but they are not yet the main reason the benchmark improved.** The biggest gains came from routing, structural critique, and anti-yap enforcement, not from statistical tuning.

## Why This Matters

The project is no longer just “nine good tools.”

It is now a deterministic policy layer that can:

- lock grading intent before generation
- translate tool failures into structural repair commands
- detect genre shifts into fictional operations
- kill token thrash instead of paying for it
- escalate when the context is too poisoned to trust

That is the Beta 2 transition: from static critique primitives to a context-aware control plane.
