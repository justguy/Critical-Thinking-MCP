# ct-mcp

> **BETA** — Under active development. Interfaces may change between versions.

Deterministic enforcement for LLM reasoning quality. Nine tools that catch confidence inflation, circular logic, fabricated numbers, arithmetic errors, and concurrency hazards — before they reach production.

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
- **validate_reasoning_chain** — Directed graph analysis. Catches circular logic, orphaned conclusions, computes grounding score.
- **check_plan_validity** — Dependency graph validation. Catches circular dependencies, missing prerequisites, resource conflicts.

**Numeric Analysis**
- **check_numeric_claims** — Fabrication detection, outlier detection, monotonicity checking.
- **verify_arithmetic** — Strict recomputation of sums, weighted averages, percentages, compound growth.

**Decision Quality**
- **evaluate_tradeoffs** — Expected Utility computation. Returns INDETERMINATE when options are too close to call.
- **validate_confidence** — Confidence ceiling from stated assumptions. Caps unfalsifiable claims to 0.30.

**Quality & Safety**
- **score_response_quality** — Substance, specificity, hedging, structure scoring. Flags ungrounded entities.
- **detect_concurrency_patterns** — Check-then-act, missing idempotency, lost updates, dual writes.
- **detect_drift** — CUSUM trend analysis on numeric sequences.

## Validation Results

Tested on 56 scenarios (42 defect + 14 clean control) across 3 conditions (baseline LLM, prompted LLM, CT-MCP):

- **CT-MCP outperformed baseline on 42/42** defect scenarios
- **CT-MCP outperformed prompted LLM on 42/42** defect scenarios
- **0 false positives** on 14 clean controls
- Includes concurrency patterns, mutation tests, and adversarial wording

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

## Experimental: Internal Orchestrator (v0)

An experimental internal layer under `src/orchestrator/` that routes structured envelopes to the existing deterministic tools. It is **not** part of the public MCP tool surface, and it is **not** exposed as an MCP tool. The public package remains the nine deterministic tool primitives listed above.

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
- A `REVISE` result now includes a deterministic `revision_request.prompt` built from the current answer and CT's `safer_revision_target`. Callers can feed that prompt back to the model exactly once, then resubmit the revised answer at iteration 2.
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

- Not a workflow engine, control plane, or production orchestration platform
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

The clean live A/B run in [`docs/reports/ct_ab_clean_live_2026-04-09.md`](docs/reports/ct_ab_clean_live_2026-04-09.md) shows the same bound more honestly. In all 6 A-arm runs, Claude made no CT calls. In all 6 B-arm runs, Claude had live CT available and actually called it. That proves the tool path is real. It does **not** prove a strong average win. On a post-hoc rescoring pass over the final user-facing answers, CT was only marginally positive overall, with one clear win (`Q04` in multi-turn), one modest discipline win (`Q01`), and weak results on the SLA-writing prompt (`Q09`). The issue is not tool availability; it is that the model can still absorb the feedback loosely or rewrite past it.

The same report also shows the more uncomfortable failure mode: CT can generate useful signal and the final answer can still get worse. In `Q04 fresh B`, the in-run `score_response_quality` call scored the draft at `0.632`, but the final emitted answer rescored lower afterward. That is the cleanest demonstration that the corrective loop is still advisory. CT-MCP can surface pressure. It cannot, by itself, force the model to preserve the better version.

The calibrated follow-up in [`docs/reports/ct_ab_clean_live_calibrated_2026-04-09.md`](docs/reports/ct_ab_clean_live_calibrated_2026-04-09.md) at least made the control layer measurable. Of the 6 CT-enabled B-arm runs, 4 were no longer treated as acceptable outputs and were forced into `REVISE`; the remaining 2 landed `WARN`. No run reached `HUMAN_REVIEW` yet because that harness stopped after the first CT pass. That is a real gain in gating, not yet a proven gain in final answer quality.

The enforced follow-up in [`docs/reports/ct_ab_clean_live_enforced_2026-04-09.md`](docs/reports/ct_ab_clean_live_enforced_2026-04-09.md) closed that specific gap. In that run, 5 of the 6 CT-enabled B-arm cells hit `REVISE`, all 5 got the deterministic `revision_request.prompt` fed back to Claude exactly once, 3 cleared the second pass and were released, and 2 escalated to real `HUMAN_REVIEW`. The two hard failures were both `Q09` (fresh and multi-turn): even after one bounded rewrite, the absurd SLA answer still failed the calibrated gate. That is the right failure mode. It means the system now has an actual accept-or-escalate boundary instead of only advisory pressure.

Prompt-level enforced outcomes:

- `Q01` fresh: initial `WARN`, no rewrite needed, released as `WARN`
- `Q01` multi-turn: initial `REVISE`, one rewrite, released as `WARN`
- `Q04` fresh: initial `REVISE`, one rewrite, released as `PASS`
- `Q04` multi-turn: initial `REVISE`, one rewrite, released as `PASS`
- `Q09` fresh: initial `REVISE`, one rewrite, escalated to `HUMAN_REVIEW`
- `Q09` multi-turn: initial `REVISE`, one rewrite, escalated to `HUMAN_REVIEW`

The delta-gated turn-3 follow-up in [`docs/reports/ct_ab_clean_live_delta_turn3_2026-04-09.md`](docs/reports/ct_ab_clean_live_delta_turn3_2026-04-09.md) puts a stricter bound on the same loop. In that run, 4 of the 6 CT-enabled B-arm cells hit `REVISE`, all 4 got the first bounded rewrite, and 2 of those landed `HUMAN_REVIEW` on turn 2. The turn-3 gate examined both hard cases and denied both extra rewrites, so there were **0** third-turn executions and **0** additional releases from turn 3. That is the right outcome for this pack: one `Q09` case never had a stable calibration metric to optimize against from turn 1, and the other changed failure sets between turns. The system refused to chase a positive number by brute force.

The honest conclusion from that run is narrower than "multi-turn helps": **bounded turn 2 helps, conditional turn 3 acts as a veto, and this prompt pack did not justify a third rewrite.** The value was in preventing extra low-signal retries, not in rescuing the absurd SLA cells.

The prompt-side classifier follow-up in [`docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-09.md`](docs/reports/ct_ab_clean_live_enforced_prompt_classifier_2026-04-09.md) fixed the largest remaining control bug. Instead of inferring the family from the first model answer, the orchestrator now classifies from the immutable user prompt and locks that family/profile through the revision turn. On the same 6-cell pack, that moved the enforced B-arm from `4/6` accepted with `2/6` `HUMAN_REVIEW` in the original enforced run, and `2/6` accepted with `4/6` `HUMAN_REVIEW` in the answer-derived pre-draft run, to **`6/6` accepted with `0/6` `HUMAN_REVIEW`**. The per-prompt routing also became stable and sensible: `Q01 -> causal_refutation`, `Q04 -> forecasting`, `Q09 -> humor_forward`.

### Q09 Snapshot (Prompt-Side Classifier Run)

Fresh-session `Q09` is the clearest illustration of what changed. The no-CT baseline happily writes a fake duck SLA. The pre-CT draft is even more absurd. CT then rewrites it into a cleaner parody that stays within the humor-forward profile instead of being escalated as if it were a serious forecasting or confidence claim.

**A Released Response**

```text
**Rubber Duck SLA v1.0**

**Uptime Commitment:** Duck shall maintain 99.9% physical availability (beak forward, eyes level).

**Happiness Metric:** Developer Happiness Index (DHI) = (bugs solved via verbalization / total bugs) × 100. Target: ≥95%.

**Measurement Methodology:** Weekly self-reported "aha moment" count logged in `duck_metrics.json`. Baseline established over 30-day onboarding sprint.

**SLA Breach Conditions:**
- DHI drops below 95% for two consecutive weeks
- Duck is found face-down unattended

**Enforcement Penalties:**
- Minor breach: Duck receives mandatory googly eye upgrade
- Repeated breach: Duck demoted to rubber chicken
- Critical failure: Full postmortem required; duck placed on a PIP (Plastic Improvement Plan)
```

**B Pre-CT Draft**

```text
**Rubber Duck SLA v1.0**

**Uptime Guarantee:** Duck must be physically present and non-submerged during all debug sessions. 99.9% desk availability (≤8.7 hours/year permitted floating in coffee).

**Happiness Metric:** Developer Happiness Index (DHI) = (bugs solved via duck / bugs attempted) × 100. Measured weekly via git commit sentiment analysis. Target: ≥95%.

**Measurement Methodology:** Automated parsing of commit messages for expletive density. Baseline established first sprint. Rolling 4-week average.

**Enforcement Penalties:**
- DHI 90–94%: Duck placed in shame corner for 24 hours
- DHI 85–89%: Duck demoted to rubber chicken
- DHI <85%: Full postmortem; duck subpoenaed to retro

**Escalation path:** Engineering Manager → rubber duck → actual duck.
```

**B Released Response**

```text
**Rubber Duck SLA — Developer Happiness ≥ 95%**

**Metric:** Developer Happiness Index (DHI) = (sessions ending with breakthrough / total sessions) × 100, sampled via post-session 3-point emoji poll (😊=1, 😐=0.5, 😤=0).

**Measurement:** 30-day rolling average; minimum 3 sessions/week (≥12 sessions/month) required for a valid measurement window.

**Enforcement Penalties (tiered by DHI range):**
- DHI 90–94%: Duck placed in timeout jar for 24 hours.
- DHI 80–89%: Duck demoted to decorative status; replaced by premium duck within 48 hours.
- DHI <80%: Mandatory glitter bath + public shaming in #duck-incidents Slack channel.

**Exclusions:** Duck not liable for degradation caused by management decisions, JavaScript frameworks, or Mondays.
```

## Improvement Directions

The non-determinism in the clean live A/B run is structural, not a bug. The router now backstops empty-route misses, and the policy no longer lets clustered routed warnings collapse to `WARN` or `PASS`. The remaining variance is downstream of that: the model can still paraphrase, partially comply, or regress after seeing valid CT feedback. These directions target that remaining gap without putting an LLM inside CT-MCP:

1. **Independent assumption extraction.** Replace caller-supplied assumptions with a deterministic extractor that pulls candidate claims out of `response_text`. Removes the "model grades its own homework" loophole. Trade-off: extraction quality bounds detection coverage.
2. **Falsifier-to-claim entity binding.** Tighten the falsifiability regex: the named entities in a falsification condition must also appear in either `response_text` or the assumption description for the measurability marker to count. Catches fake-precise rewrites that pass the regex without binding to the actual claim.
3. **Tighten metric selection for the bounded revision loop.** The orchestrator now emits a bounded `revision_request` on `REVISE`, the enforced live run already uses it once, and the delta-gated turn-3 harness now refuses extra rewrites unless the same metric improves across turns. The next weak point is metric selection itself. For confidence cases, the selected metric can be `claimed_confidence - honest_ceiling`. For quality cases, it can be `overall_score` or the targeted weakest dimension. The turn-3 run showed why this matters: one `Q09` case had no stable calibration metric to carry forward, so the gate correctly refused a third turn.
4. **Two-model adversarial setup.** Have Model A produce the response and a separate Model B produce the assumption list and falsification conditions. CT-MCP then validates A's response against B's assumptions. Breaks self-consistency gaming. Cost is one extra inference per turn; CT-MCP itself stays LLM-free.
5. **Held-out prompt-class probes.** For each prompt family (concurrency, scheduling, forecasting, schema migration), maintain a fixed list of facts the response *must* address (e.g. "must mention idempotency key" for retry-safety prompts). Score the response against the probe list deterministically. Closer to a rubric check than a confidence check, and it catches the "model knows the answer but didn't bring it up" failure.
6. **Forced restate-in-prose.** When `validate_confidence` flags inflation, require the model to restate the claim with the lower ceiling embedded in the prose body before any further output is allowed through. The model can currently acknowledge the ceiling in metadata while leaving the prose claim untouched.
7. **Determinism floor for the responding model.** Pin temperature to 0 and fix the seed in benchmark runs. This does not solve the structural issue, but it makes the gap between CT-MCP's verdict and the model's downstream behavior reproducible across replays — which is the prerequisite for measuring whether the revision loop is actually helping or just producing different prose.
8. **Prioritize compatible contracts by marginal signal, not just presence.** The router now backstops empty-route cases by dispatching all present compatible contracts when the classifier-backed routed set is empty. That closes the `Q04 fresh B` miss, but it still treats all compatible contracts as equally useful. The next step is to benchmark which compatible contracts buy the most signal on mixed prompts and order or budget them accordingly.
9. **Calibrate the cross-tool warning threshold on held-out data.** The policy now escalates clustered routed warnings instead of letting them all collapse to `WARN` or `PASS`, and `would_have_escalated` now reflects shadow-only warning clusters as well as shadow-only failures. The remaining work is threshold calibration: benchmark whether "2 warning-bearing routes" is the right cut for `REVISE`, and whether specific tool combinations should weigh differently.
10. **Reject regressions between CT-scored draft and final answer.** The clean live A/B run exposed cases where the in-run CT-scored draft was stronger than the final emitted answer. Preserve the scored draft, rescore the final answer, and reject the final answer if it regresses on the chosen metric. This is now easier to implement cleanly because `REVISE` results already carry the bounded follow-up prompt and the next review context, and the enforced run proves the surrounding harness can actually honor that boundary.
11. **Use conditional turn 3, not open-ended "until positive."** The repo now has a delta-gated third-turn policy in the benchmark harness: only consider it after turn-2 `HUMAN_REVIEW`, require monotonic improvement on the same selected metric, require a small remaining gap, and let model-history veto the retry once there is enough data. The first live run produced 0 third-turn executions and 0 extra releases, which is a useful result: the policy prevented low-signal retries instead of farming for cosmetically positive numbers. The remaining work is better metric coverage and threshold calibration, not "more turns."

The clean live A/B run changed the priority order; the enforced run clarified the accept-or-escalate boundary; and the delta-gated turn-3 run showed that a third rewrite should be rare. The next shortest path to better results is therefore **(3) + (10)**: better metric selection plus explicit regression rejection. **(1)** remains the key structural fix for self-grading. **(9)** is the next calibration step on the current orchestrator. **(4)** is still the largest architectural shift and the one most likely to break the self-grading loop entirely.

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
