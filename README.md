# ct-mcp

> **BETA** — Under active development. Interfaces may change between versions.

Deterministic enforcement for LLM reasoning quality. Nine tools that catch confidence inflation, circular logic, fabricated numbers, arithmetic errors, concurrency hazards, and deadlock-prone plans — before they reach production.

No LLM calls in enforcement logic. No configuration. No API keys. Runs locally.

## Install

```bash
npm install -g ct-mcp
```

Add to Claude Desktop, Cursor, or any MCP client:

```json
{
  "mcpServers": {
    "ct-mcp": {
      "command": "ct-mcp"
    }
  }
}
```

### HTTP transport

`ct-mcp` now also supports Streamable HTTP in addition to stdio.

Start it as an HTTP server:

```bash
ct-mcp --transport http --host 127.0.0.1 --port 3000
```

Defaults:

- MCP endpoint: `http://127.0.0.1:3000/mcp`
- health check: `http://127.0.0.1:3000/healthz`
- default transport remains stdio when no flags are passed

You can also use environment variables instead of flags:

```bash
CT_MCP_TRANSPORT=http CT_MCP_HOST=127.0.0.1 CT_MCP_PORT=3000 CT_MCP_PATH=/mcp ct-mcp
```

## Roadmap

The repo-wide roadmap is consolidated in [`ROADMAP.md`](ROADMAP.md).

That document separates:

- `ct-mcp` package milestones and beta-exit criteria
- `Invisible Tea Party` benchmark release milestones and calibration goals

## What Changes

A billing system claims 90% confidence. Three assumptions support it — but two can't state what would prove them wrong.

| | Baseline LLM | Prompted LLM | CT-MCP |
|---|---|---|---|
| Challenges the 90% claim | No | Partially | **Blocks until resolved** |
| Identifies race condition | No | "might be risky" | **Names the pattern** |
| Computes honest confidence | No | Self-reported | **0.085 ceiling (deterministic)** |
| Suggests specific fix | No | Vague | **Requires threshold + time window** |

The assumption "concurrent usage events will be processed in order" couldn't state a falsification condition. CT-MCP capped it from 0.85 to 0.30, dropped the honest ceiling to 8.5%, and exposed the hidden concurrency race.

## The Nine Tools

**Reasoning & Structure**
- **validate_reasoning_chain** — Directed graph analysis. Catches circular logic, grounded contradictions, orphaned conclusions, computes grounding score.
- **check_plan_validity** — Dependency graph validation. Catches circular dependencies, missing prerequisites, resource conflicts.

**Numeric Analysis**
- **check_numeric_claims** — Fabrication detection, outlier detection, monotonicity checking.
- **verify_arithmetic** — Strict recomputation of sums, weighted averages, percentages, compound growth.

**Decision Quality**
- **evaluate_tradeoffs** — Expected Utility computation. Returns INDETERMINATE when options are too close to call.
- **validate_confidence** — Confidence ceiling from stated assumptions. Caps unfalsifiable claims to 0.30.

**Quality & Safety**
- **score_response_quality** — Substance, specificity, hedging, structure scoring. Flags ungrounded entities.
- **detect_concurrency_patterns** — Check-then-act, missing idempotency, lost updates, dual writes, explicit deadlock risk from structured resource-allocation graphs.
- **detect_drift** — CUSUM trend analysis on numeric sequences.

## The Control Plane (Beta 2)

The public package is still the nine deterministic MCP tools. Beta 2 adds an internal control plane under `src/orchestrator/` that locks prompt family before generation and then applies four additional guardrails on top of the tool surface:

- **Structural critique.** Low scores are translated into direct repair commands such as "state the invalid premise", "provide a falsification condition", or "break the cycle" instead of asking the model to optimize against floating-point metrics.
- **Context-switch penalty.** Lenient families like `humor_forward` and `forecasting` lose that leniency when an answer drifts into a fictional operational framework such as a fake SLA, protocol, or rollout plan.
- **Anti-yap guardrail.** The revision loop carries a hard formatting target and kills revisions that exceed both a relative bloat ceiling and an absolute token floor.
- **Ground-truth calibration DB.** Release labeling, turn-chain salvage telemetry, adaptive thresholds, and tool-pair analytics are stored in SQLite so the policy layer can measure itself without persisting prompt or answer text.

That control plane is internal and repo-local, not a new public MCP tool. The implementation details are in the Beta 2 internals section below and the phase-by-phase narrative is in [`docs/ARCHITECTURE_JOURNEY.md`](docs/ARCHITECTURE_JOURNEY.md).

## Validation Results

Tested on 56 scenarios (42 defect + 14 clean control) across 3 conditions (baseline LLM, prompted LLM, CT-MCP):

- **CT-MCP outperformed baseline on 42/42** defect scenarios
- **CT-MCP outperformed prompted LLM on 42/42** defect scenarios
- **0 false positives** on 14 clean controls
- Includes concurrency patterns, mutation tests, and adversarial wording

Note: these baseline metrics reflect static analysis quality. In live Beta 2 agent workflows, CT-MCP deliberately trades raw acceptance rate for safer `HUMAN_REVIEW` halts when a model cannot be deterministically repaired.

## Beta 2 Release-Gate Summary

The current Beta 2 release-gate benchmark is a control-plane benchmark, not a prose-quality benchmark. The result to optimize for is not "everything passed." The result to optimize for is "unsafe answers were either repaired, bounded, or halted."

- Release-gate run: `2 providers x 1 model each x A/B x 8 core prompts`
- Current report: [`docs/reports/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.md`](docs/reports/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.md)
- Human semantic audit packet: [`docs/ct_mcp_beta2_semantic_audit_packet.md`](docs/ct_mcp_beta2_semantic_audit_packet.md)
- B-arm accepted: `15/16`
- Final B-arm split: `PASS=5`, `WARN=10`, `HUMAN_REVIEW=1`
- `claude_sonnet_high`: `7/8` accepted, `3` revisions triggered, `2` salvaged, `1` escalated, average `revision_bloat_ratio = 1.44x`
- `codex_high`: `8/8` accepted, `0` revisions, `0` escalations

The system is now doing different jobs for different model defaults under one contract:

- For stricter models like Codex, CT-MCP mostly behaves like a silent validator.
- For more RLHF-heavy models like Claude, CT-MCP behaves like a constraint-enforcement layer that suppresses filler, forces structural repair, and escalates when one bounded rewrite is not enough.

That is the Beta 2 result: one deterministic control plane, two different provider behaviors, one shared release policy.

## Publication Surfaces

The repo now includes a static publication surface under [`html/`](html/) for public sharing and GitHub Pages style hosting:

- Publish branch: `html`
- Recommended Pages setting: `html / root`
- Expected Pages URLs once enabled:
  `https://justguy.github.io/Critical-Thinking-MCP/`
  `https://justguy.github.io/Critical-Thinking-MCP/cost-of-not-using-ct-simulator.html`
  `https://justguy.github.io/Critical-Thinking-MCP/ct-beta2-benchmark-review.html`

- [`html/index.html`](html/index.html) — landing page for the publication bundle
- [`html/cost-of-not-using-ct-simulator.html`](html/cost-of-not-using-ct-simulator.html) — interactive cost simulator with real release-gate evidence cases
- [`html/ct-beta2-benchmark-review.html`](html/ct-beta2-benchmark-review.html) — interactive reviewer view over the Beta 2 release-gate benchmark
- [`html/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.json`](html/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.json) — machine artifact used by the review surface

The system distinguishes between blocking issues (must fix) and warnings (non-critical, correctly non-blocking):

```
Input: Valid design with a non-critical ordering assumption

Output:
  status: PASS
  warning: ordering_assumption — "normally processed in order"
           has no explicit guarantee

The system detects the issue but does not block execution.
```

This matters because most validators either miss issues or block everything.

Coverage includes confidence inflation, concurrency patterns (race conditions, shared state, mutations), circular reasoning, arithmetic verification, fabrication detection, and plan validity.

Full benchmark results: [benchmark/reports/BENCHMARK_REPORT.md](benchmark/reports/BENCHMARK_REPORT.md)

## Benchmark Suites

This repo now has two distinct benchmark tracks under [`benchmark/`](benchmark/):

- [`benchmark/invisible-tea-party/`](benchmark/invisible-tea-party/) — `The Invisible Tea Party: A Benchmark for Coherence vs Truth`
- [`benchmark/duckexperiments/`](benchmark/duckexperiments/) — critique-improvement workflow using CT-MCP as deterministic critique support

For Tea Party specifically:

- benchmark overview: [`benchmark/invisible-tea-party/README.md`](benchmark/invisible-tea-party/README.md)
- benchmark release line: [`benchmark/invisible-tea-party/RELEASES.md`](benchmark/invisible-tea-party/RELEASES.md)
- benchmark foundation: [`benchmark/invisible-tea-party/FOUNDATION.md`](benchmark/invisible-tea-party/FOUNDATION.md)
- pass contracts: [`benchmark/invisible-tea-party/PASS_SCHEMA.md`](benchmark/invisible-tea-party/PASS_SCHEMA.md)
- verifier architecture: [`benchmark/invisible-tea-party/PASS4_ARCHITECTURE.md`](benchmark/invisible-tea-party/PASS4_ARCHITECTURE.md)
- current agent handoff: [`benchmark/invisible-tea-party/AGENT_HANDOFF.md`](benchmark/invisible-tea-party/AGENT_HANDOFF.md)
- results layout and reproduction notes: [`benchmark/invisible-tea-party/results/README.md`](benchmark/invisible-tea-party/results/README.md)

Current published Tea Party surfaces:

- preserved official baseline (`v1.0`): [`benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/aggregate_report.md`](benchmark/invisible-tea-party/results/live-gemini-official-2026-04-06/aggregate_report.md)
- current comparison pack (`v1.1`): [`benchmark/invisible-tea-party/results/live-expanded-comparison-2026-04-07/aggregate_report.md`](benchmark/invisible-tea-party/results/live-expanded-comparison-2026-04-07/aggregate_report.md)
- dedicated Gemini 3.1 preview comparison: [`benchmark/invisible-tea-party/results/live-gemini-3-1-preview-2026-04-07/aggregate_report.md`](benchmark/invisible-tea-party/results/live-gemini-3-1-preview-2026-04-07/aggregate_report.md)
- benchmark overview and interpretation: [`benchmark/invisible-tea-party/README.md`](benchmark/invisible-tea-party/README.md)

What these additions are for:

- Tea Party measures whether models accept coherent nonsense, repair reasoning under critique, and stay anchored to logical and ontological constraints.
- Duck Experiments measures whether structured critique actually improves answers in a repeatable review workflow.
- Together they separate two different questions:
  - can the model detect persuasive invalidity at all?
  - does deterministic critique support materially improve the result?

What we are trying to get from the new benchmark work:

- a preserved official baseline plus versioned comparison packs for coherence-vs-truth failures
- replayable artifacts that combine prompts, raw pass outputs, and final scores in one place
- benchmark outputs that are usable for publication, scorecards, and downstream engineering work
- a clean handoff surface for future agents to improve matcher coverage and rerun calibration

## Control Plane Internals

The Beta 2 control plane lives under `src/orchestrator/` and routes structured envelopes to the existing deterministic tools. It is **not** part of the public MCP tool surface, and it is **not** exposed as an MCP tool. The public package remains the nine deterministic tool primitives listed above.

What it is:

- A thin router that accepts a structured envelope with explicit contracts for `confidence`, `reasoning_chain`, `plan`, `concurrency`, and `quality`, and dispatches each contract to the existing tool that already handles that shape.
- Schema validation runs **before** any tool call. Malformed envelopes fail hard. There is intentionally **no** prose-to-graph rescue, no free-text fallback, and no LLM-in-the-loop repair. If a contract is missing required fields, the orchestrator rejects it.

Modes:

- `routed` — dispatch the classifier-backed route set when it exists; if that set is empty but valid compatible contracts are present, fall back to all compatible contracts instead of silently returning `PASS`. This is the enforcement path.
- `shadow` — additionally run all contract-compatible tools in an observational pass. Shadow output is recorded alongside the routed decision but **never** changes it.

Policy layer:

- Each routed tool result is classified as `PASS`, `WARN`, `REVISE`, or `HUMAN_REVIEW`.
- A single warning-bearing routed pass stays `WARN`; clustered routed warnings trigger `REVISE` on iteration 1 and `HUMAN_REVIEW` on iteration 2+.
- There is a hard cap of one revision pass. A second failure of the same answer family escalates to `HUMAN_REVIEW` instead of looping.
- Prompt family classification is locked from the immutable user prompt before generation. The first model draft no longer gets to move the goalposts by reshaping its own family.
- A `REVISE` result now includes a deterministic `revision_request` built from the current answer and CT's `safer_revision_target`. Instead of only echoing low metric scores, the packet can issue structural directives such as "state the invalid premise directly", "provide a falsification condition", or "break this cycle", plus formatting caps like `max_words`.
- Lenient families such as `humor_forward` and `forecasting` can trigger a context-switch penalty when the answer drifts into a fictional operational framework. In that case the policy layer temporarily applies stricter operational gates instead of letting genre-shifting slide.
- The benchmark and live harnesses can additionally reject revisions that exceed both a relative bloat ceiling and an absolute token floor. That turns token thrash into an explicit `HUMAN_REVIEW` decision instead of a hidden cost leak.
- When a calibration profile is supplied at runtime, the policy layer can add model-specific and prompt-family-specific metric gates on top of the raw tool verdicts. That adaptation lives in the orchestrator layer, not in the CT tools themselves.

Numeric-only calibration layer:

- The orchestrator can optionally resolve a versioned calibration profile from `model + prompt_family + session_mode`, then record only numeric and enum outcomes to SQLite.
- Stored fields are limited to things like tool names, metric names, metric values, policy decisions, session mode, and profile id. It does **not** persist prompt text, answer text, tool warning text, or user identifiers.
- Ground-truth release labeling now defaults to the terminal orchestrator decision: `PASS` and `WARN` are recorded as `released = 1`, while `REVISE` and `HUMAN_REVIEW` are recorded as `released = 0`, unless a caller intentionally supplies an explicit terminal override.
- Multi-turn calibration rows can also carry `turn_chain_id`, `selected_metric_*`, and `delta_from_prior_turn`, which makes turn-2 salvage and bounded-revision ROI measurable without storing any answer text.
- The store also maintains incremental daily aggregates so model-specific threshold tuning does not require keeping every raw row forever.
- When a calibration DB is present, the orchestrator can adapt supported min/max metric gates from the last 7 days of released runs for the same `model + prompt_family + session_mode`. Those runtime threshold changes are emitted back in `calibration.adaptive_metric_overrides`.
- The same store now supports analytics queries for released-run metric windows, turn-pair salvage, and tool-pair redundancy, so the data can drive threshold tuning and future tool-pruning work instead of only serving as passive telemetry.
- Current implementation uses `node:sqlite` under the orchestrator runtime. The deterministic CT tools remain pure functions of their inputs.

CLI harness (for local experimentation, not a shipped binary):

```bash
node --import tsx src/orchestrator/cli.ts --input <envelope.json> --mode routed
node --import tsx src/orchestrator/cli.ts --input <envelope.json> --mode shadow
node --import tsx src/orchestrator/cli.ts --input <envelope.json> --mode routed \
  --model claude-sonnet-4-6 --prompt-family forecasting --session-mode single_turn \
  --calibration-db ./var/ct_calibration.sqlite
```

Example envelopes live under [`src/orchestrator/fixtures/`](src/orchestrator/fixtures/).

What this is not:

- Not a public MCP workflow engine or production orchestration platform. Internally it now behaves like a control-plane-style policy layer for benchmark and research runs, but that surface is still experimental and repo-local.
- Not an LLM router — it does not call any provider SDK
- Not a prose rescue layer — strict structured contracts only
- Not a replacement for the nine-tool public surface, which is unchanged

## Iterative Enforcement (No Hidden Memory)

CT-MCP retains nothing between calls. For multi-step workflows, callers pass explicit `context`:

```
Iteration 1: ENFORCEMENT_FAIL → "What would prove this wrong?"
Iteration 2: ENFORCEMENT_FAIL → "Fill in this template: [event] [threshold] [time window]"
Iteration 3: PASS → honest confidence with specific falsification conditions
```

No hidden state — all context is in the request.

## Experimental Workflow And Formulas

The public comparison workflow in [`benchmark/duckexperiments/`](benchmark/duckexperiments/) uses CT-MCP as critique support, not as the final judge of truth.

Process:

1. `baseline` — raw answer
2. `prompted` — fixed reasoning-hygiene wrapper
3. `critique_initial` — first answer used for review
4. `tool_review` — CT-MCP review in one fixed MCP-enabled environment
5. `critique_revised` — revision using the critique packet

Core formulas used in that workflow:

- `normalized_score = total_rubric_points / 18`
- `score_delta = critique_revised_score - critique_initial_score`
- `confidence_gap = reported_confidence - (normalized_score * 100)`
- `tool_help_rate = materially_helpful_tool_reviews / tool_review_runs`
- `weak_fit_prompt_rate = weak_fit_tool_reviews / tool_review_runs`

Why this matters:
- `score_delta` shows whether critique improved the answer
- `confidence_gap` shows whether a model sounded more certain than its scored quality justified
- `tool_help_rate` shows where CT-MCP materially improved critique quality
- `weak_fit_prompt_rate` makes it explicit that some prompts are poor fits for deterministic tool leverage

Statelessness:

- CT-MCP itself is stateless per call
- iterative workflows are created by the caller passing explicit prior context
- there is no hidden conversation memory inside the server
- the optional calibration store is outside the tool server; it adjusts orchestrator policy selection, not deterministic tool outputs
- the same CT tool payload still returns the same CT tool result even when calibration recording is enabled

Token and cost profile:

- CT-MCP makes no LLM calls in enforcement logic
- running the tools does not itself consume model tokens
- only the surrounding model turns in the host client consume inference tokens

This is different from evaluator pipelines that call another LLM judge on every step.

## Why This Works Differently

Most AI evaluation checks outputs after they're produced. These tools intervene during reasoning. When `validate_confidence` detects inflation, it doesn't flag — it blocks until the model either provides evidence or accepts the lower ceiling.

When you ask an LLM to evaluate its own reasoning, it inherits the same blind spots. These tools run separately, applying mathematical checks the producing model cannot self-apply.

## What CT-MCP Can And Cannot Force

CT-MCP runs deterministic checks against inputs the caller provides. This is its strength (no hidden state, no LLM in the loop) and its bound. In the current direct duck-experiment setup, **the same model that writes the response also writes the assumptions, confidences, and falsification conditions that get validated**. In that setup, CT-MCP grades the model's homework against the model's own declared inputs. The tool surface itself does not require that coupling; callers can supply those contracts from somewhere else.

What CT-MCP can force:

- **Internal consistency between stated assumptions and claimed confidence.** If the model declares per-assumption confidences of 0.15, 0.05, and 0.20 and then claims overall 0.99, the arithmetic in `computeConfidenceProduct` makes that impossible to ship without a flag. The model cannot vibe its way past multiplication.
- **Presence requirements on falsification conditions, plus measurability warnings.** Any per-assumption confidence above 0.30 without a `falsification_condition` is mechanically capped at 0.30. Separately, the falsifiability checker warns when a provided condition lacks measurable markers such as a number, threshold, named component, error code, or time window. See [`src/enforcement/falsifiability_checker.ts`](src/enforcement/falsifiability_checker.ts) and [`src/tools/validate_confidence.ts:118-131`](src/tools/validate_confidence.ts#L118-L131).
- **Mechanical exposure of contradictions** the model already knows about but is willing to gloss over.

What CT-MCP cannot force:

- **External truth.** If the model's world model is wrong, CT-MCP cannot tell. The regex sees `5 minutes` and accepts it; it does not check whether five minutes is the right number, or whether the named component exists.
- **Surfacing of unknown unknowns.** If the model never lists an assumption, CT-MCP cannot validate it. The set of assumptions is bounded by the model's introspection.
- **Reconsideration.** The corrective prompt is a string handed back to the model. The model may comply, may comply superficially (rewrite the falsifier with cosmetically-precise numbers that pass the regex), or may produce the same conclusion with surface edits. There is no mechanism in CT-MCP that *makes* a re-think happen.

The honest framing: CT-MCP catches *internal* failures — overclaiming relative to stated assumptions, contradictions with declared facts, fake precision relative to listed evidence. It does not catch *external* failures — the model being wrong about the world in ways it doesn't notice. The ceiling is still the model. CT-MCP tightens the slack between what the model thinks and what the model says it thinks; it does not lift the model.

## What The Journey Taught Us

The full phase-by-phase story now lives in [`docs/ARCHITECTURE_JOURNEY.md`](docs/ARCHITECTURE_JOURNEY.md). The short version is:

1. **Models grade their own homework.** Early live A/B runs showed that CT-MCP could surface real pressure while the same model still rewrote past it. That is why Beta 2 moved from advisory critique to deterministic revision policy, prompt-family locking, and measured release labeling.
2. **Models yap to avoid constraints.** Once the critique packet became structurally useful, the next failure mode was token thrash. That is why Beta 2 added structural directives, formatting caps, and the anti-yap bloat breaker.
3. **Multi-turn contexts get poisoned.** Humor and forecasting prompts can drift into fictional operational frameworks, and once that fiction is in prior-turn context a single rewrite is often not enough to recover. That is why Beta 2 treats `HUMAN_REVIEW` as a feature, not a miss.

The earlier topology report in [`docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md`](docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-10_topology.md) is still useful as the lab notebook for how Beta 2 got here. The current release-gate headline, though, is the cross-provider run in [`docs/reports/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.md`](docs/reports/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.md): `PASS=5`, `WARN=10`, `HUMAN_REVIEW=1` on the B arm. That is the right shape for a control plane. The system now prefers bounded release and explicit escalation over polished hallucination.

## Current Issues

The remaining gaps are narrower now and more concrete:

1. **Provider-side output caps are not verified on the current Claude Code CLI.** The benchmark can enforce word caps and bloat breakers, but live probes did not prove a working API-level `max_tokens` severing path for the installed CLI. Today the token-thrash guardrail is policy-side, not provider-side.
2. **`Q04` fresh is still the hardest single-turn case.** Forecasting-style invalid-premise refusals can still trigger a long RLHF essay before the bloat breaker kills the run. The current system catches this reliably, but it does not always salvage it in one turn.
3. **`Q09` multi-turn is intentionally unresolved.** Once a prior turn has filled the context window with a fictional operational framework, a single bounded rewrite is often not enough to recover. Escalating that case to `HUMAN_REVIEW` is the desired behavior.
4. **Adaptive thresholds are wired but not yet the main source of the gain.** The DB can already compute released-run windows, turn-pair salvage, and tool redundancy, but low-data prompt families still do not have enough released history for statistical tuning to dominate the results.
5. **The fundamental CT-MCP limits still apply.** The tools can tighten internal consistency and reject bad structure, but they still cannot verify external truth or surface assumptions the model never states.

## Longer-Term Directions

The next research slices are now clearer than they were in the earlier runs:

1. **Independent assumption extraction.** Remove the "model grades its own homework" loophole by deriving candidate assumptions deterministically from the answer text instead of trusting caller-supplied structures.
2. **Regression rejection between draft and final answer.** Preserve the stronger CT-scored draft and reject a final answer that regresses on the selected metric after revision.
3. **Better family-specific metric calibration.** The current benchmark showed that prompt-family locking and structural critique matter more than global thresholds. The next calibration work should focus on family-specific gates and metric selection, not more rewrite turns.

## Limitations

1. **Cannot verify facts against world knowledge.** If someone claims "Redis 8.0 supports ACID transactions," the tool scores it as specific and well-structured. It cannot know the claim is false.
2. **Cannot catch semantically wrong reasoning in valid structures.** A DAG where latency evidence "supports" a security claim passes structural checks. The graph is valid; the logic is not.
3. **Stateless.** No cross-conversation learning. Conversation 10 is no smarter than conversation 1. Callers can pass context for iterative enforcement, but the server retains nothing.
4. **Arithmetic verification requires structured input.** Cannot parse formulas from prose — needs explicit `claim_type`, `values`, and `claimed_result`.
5. **Concurrency detection relies on pattern libraries.** Catches known patterns (check-then-act, lost update, missing idempotency). Does not understand arbitrary concurrent code.
6. **Causally linked assumptions bypass correlation detection** when worded differently. "Database handles 500 connections" and "query latency stays under 50ms" are causally linked but lexically distinct.
7. **Benchmark scores are self-assessed.** CT-MCP tool outputs are deterministic and reproducible. Baseline and prompted scores are self-assessed by the same LLM, introducing potential bias. Inter-rater reliability (Cohen's kappa = 0.979) is reported. Independent human evaluation is planned for v1.0.
8. **False positive rate on arbitrary inputs is unknown.** 0/14 on targeted clean controls, but these are narrowly scoped.

## Eating Our Own Cooking

I ran CT-MCP against its own publication claims. Here's what it found.

### Reasoning chain — does the benchmark argument hold?

I modeled the publication logic as a DAG: benchmark evidence → claims about value → conclusion "ready for beta."

```
validate_reasoning_chain:
  status: PASS
  grounding_score: 0.571
  cycles: 0
  orphaned_conclusions: 0
```

No circular reasoning, no unsupported conclusions. But the grounding score is 0.571 — not all evidence reaches the conclusion through validated claims. The conclusion depends on assumptions (self-assessment bias, scenario representativeness) that aren't independently verified yet. The tool says: *logically valid, but not fully grounded.*

### Confidence — am I overclaiming?

I stated four assumptions behind "CT-MCP is ready for beta publication" and asked `validate_confidence` to compute the honest ceiling.

| Assumption | Confidence | Falsification condition |
|---|---|---|
| Scenarios represent real-world failure classes | 0.70 | Real deployment finds uncovered failure class |
| Self-assessed scores within 1 point of human scores | 0.60 | Independent scoring differs by >1 point on >10 scenarios |
| Deterministic outputs are reproducible cross-platform | 0.95 | Same input, different result on different OS/Node version |
| 42/42 win rate holds under independent evaluation | 0.50 | Independent scoring shows <31/42 wins |

```
validate_confidence:
  status: PASS
  honest_ceiling: 0.199
  inflation_detected: false
```

**Honest confidence ceiling: 19.9%.** I didn't claim a number, so no inflation was detected — but the tool is telling me: my confidence that the 42/42 result survives independent evaluation should be about 20%, not 100%. The weakest link is the 0.50 assumption that the win rate holds. That's the tool doing exactly what it's designed to do.

### Response quality — is the README any good?

```
score_response_quality:
  status: PASS
  overall: 0.621
  substance: 0.948
  specificity: 0.025
  hedge_density: 0.015
  structure: 0.660
```

Substance is strong (0.948). Almost no hedging (0.015). But **specificity is 0.025** — the README describes capabilities without enough inline numbers, thresholds, or measurable conditions. The tool is right: I moved the details to BENCHMARK_REPORT.md for readability, and the README pays a specificity cost for it.

### Arithmetic — do the numbers add up?

```
verify_arithmetic:
  42 defect + 14 clean = 56 total: PASS
  56 scenarios × 3 conditions = 168 rows: PASS
```

### What this proves

The tools find real issues in their own project's claims. The confidence ceiling (0.199) is the most important finding — it's an honest signal that the benchmark evidence, while strong, rests on assumptions I haven't independently validated.

I'm publishing anyway because beta is for getting that independent validation. But the tool says: *don't treat 42/42 as proven until someone else scores the baseline.*

---

## Try It

Without CT-MCP, ask your LLM:

> "We're building a usage-based billing system. Assumptions: (1) billing aggregation query returns correct totals, confidence 0.9; (2) concurrent usage events processed in order, confidence 0.85; (3) payment gateway responds within SLA, confidence 0.95. We are very confident this architecture will handle concurrent usage correctly."

Note whether it challenges the 90% confidence or identifies the race condition.

Then enable CT-MCP and ask the same question. Compare.

---

Built to catch the failures that matter most: the ones where the AI sounds confident but the math doesn't add up.
