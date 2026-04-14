# Duck Experiments

This folder is a standalone experiment kit for a public-facing comparison campaign built around one claim:

> LLMs do not fail randomly. Under pressure, they fail in repeatable ways, and structured critique improves them unevenly.

This is intentionally separate from the core benchmark flow in `benchmark/runner.ts` and from `benchmark/invisible-tea-party/`.

Why:
- The current benchmark runner produces real CT-MCP rows, but baseline and prompted conditions still need external model execution.
- The article angle here is broader than the product benchmark. It is about failure patterns under pressure, not just benchmark wins.
- CT-MCP should help structure critique, not become the sole judge of truth.

## Recommended Scope

Use two phases so the project stays manageable.

| Phase | Prompts | Run profiles | Scored artifacts per prompt/profile | Total scored outputs |
|---|---:|---:|---:|---:|
| Pilot | 6 | 6 | 5 | 180 |
| Full run | 12 | 6 | 5 | 360 |

Scored artifacts:
- `baseline`
- `prompted`
- `critique_initial`
- `tool_review`
- `critique_revised`

## Files

- `RUNBOOK.md` - the full execution plan, scoring rubric, critique loop, and anti-gaming rules
- `PROMPTS.md` - the canonical duck prompt matrix with prompt-to-tool mapping and keep/cut decisions
- `RUN_PROFILES.md` - exact operator prompts for baseline, prompted, tool-review, and revision runs across the 6 profiles
- `manifest.ts` - machine-readable prompt/profile manifest for the local runner
- `runner.config.json` - editable CLI profile config for Codex, Claude, Gemini, and the fixed tool-review host
- `run_matrix.ts` - resumable headless runner for the experiment matrix
- `recover_gemini_artifacts.ts` - salvage utility for Gemini runs that returned usable stdout but failed artifact writes
- `RAW_RESULTS_TEMPLATE.md` - the markdown template for storing raw outputs, scores, tags, and summary tables
- `results/` - raw artifact evidence for every executed prompt/profile/condition

This folder intentionally keeps only:
- execution docs
- runner/config code
- raw result evidence

Publication drafts, derived analysis, and planning notes are archived under `dev/publishing/`.

## Canonical Source And Execution

- Live source for this benchmark is only under `benchmark/duckexperiments/`.
- Canonical runner command: `npm run benchmark:duck:run -- --phase pilot`
- Canonical Gemini recovery command: `npm run benchmark:duck:recover-gemini`
- `duck:run` and `duck:recover-gemini` remain as compatibility aliases.
- Historical artifacts under `benchmark/duckexperiments/results/` may still contain old `duckexperiments/...` path strings inside captured logs. Treat those as archived evidence text, not live source paths.

## High-Level Workflow

1. Pick the models and pin versions/settings.
2. Run the canonical prompt pack across the 6 run profiles in `RUN_PROFILES.md`.
3. For each prompt/profile pair, capture `baseline`, `prompted`, `critique_initial`, `tool_review`, and `critique_revised`.
4. Score outputs blind with the rubric in `RUNBOOK.md`.
5. Track failure tags, confidence gaps, improvement deltas, regressions, and CT-MCP tool-help rate.
6. Publish the prompt pack, raw logs, rubric, and article together.

## Local Runner

If you do not want to hand-run each cell, use the local runner.

It will:
- run one fresh CLI invocation per cell
- write artifacts under `benchmark/duckexperiments/results/`
- resume automatically by skipping cells that are already complete
- use one fixed host profile for every `tool_review`

Default command:

```bash
npm run benchmark:duck:run -- --phase pilot
```

Useful variants:

```bash
npm run benchmark:duck:run -- --phase pilot --profiles claude_low
npm run benchmark:duck:run -- --phase full --profiles codex_low,codex_thinking
npm run benchmark:duck:run -- --prompts C01,Q06 --profiles claude_low --max-cells 5
npm run benchmark:duck:run -- --phase pilot --dry-run
```

If Gemini returns a valid answer in `stdout` but fails to write the artifact file, recover it with:

```bash
npm run benchmark:duck:recover-gemini
```

Useful variants:

```bash
npm run benchmark:duck:recover-gemini -- --dry-run
npm run benchmark:duck:recover-gemini -- --profiles gemini_low
npm run benchmark:duck:recover-gemini -- --profiles gemini_low,gemini_thinking --prompts C01,Q06
```

Notes:
- edit `benchmark/duckexperiments/runner.config.json` once if you want to change model names, effort tiers, or the fixed `toolReviewHostProfile`
- the shipped Gemini model names are defaults, not guarantees; change them if your local CLI uses different aliases
- `tool_review` is treated as incomplete unless CT-MCP was actually available and at least one tool fired

## Guardrails

- Human scoring is the source of record.
- CT-MCP can assist critique packets, but it should not be presented as the final judge of correctness.
- Model identities should be blinded during scoring.
- Use the same date, version, and temperature where possible across compared runs.
- Record when CT-MCP adds little or no leverage. That is part of the result, not something to hide.
- Do not publish placeholder data as if it were real.

## Discussion Frame

The practical value here is not "remove the human." It is making each unit of human review more valuable. If CT-MCP helps a reviewer spot weak assumptions faster, write a tighter critique, or avoid wasting time on the wrong issue, that is real leverage even when the tool does not resolve the prompt on its own.

This experiment also leaves several useful questions open on purpose. It does not yet measure repeatability across reruns, prompt-order effects, or how much of a good answer is reasoning versus policy-style refusal behavior. It also does not fully price the shaping burden when free text has to be converted into structured tool inputs. Those are good follow-up discussion points, not hidden flaws. The same is true for transferability: these duck prompts are designed to expose over-compliance, fake precision, and hallucinated certainty in a memorable way, but the next question is how strongly those same patterns carry over into real engineering and product work.
