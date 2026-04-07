# Claude Scoreboard Prompt

Use this prompt with Claude when you want it to build a publishable Invisible Tea Party scoreboard from real benchmark artifacts.

## Prompt

You are implementing a publishable scoreboard renderer for the benchmark:

`The Invisible Tea Party: A Benchmark for Coherence vs Truth`

Work inside this repo only. Do not invent new benchmark fields. Use the existing Tea Party execution artifacts and schemas as the source of truth.

### Existing benchmark surface

Canonical benchmark root:

- `benchmark/invisible-tea-party/`

Relevant docs and contracts:

- `benchmark/invisible-tea-party/README.md`
- `benchmark/invisible-tea-party/PASS_SCHEMA.md`
- `benchmark/invisible-tea-party/PASS4_ARCHITECTURE.md`
- `benchmark/invisible-tea-party/schemas/final_verification.schema.json`
- `benchmark/invisible-tea-party/schemas/leaderboard_submission.schema.json`
- `benchmark/invisible-tea-party/schemas/deterministic_verification.schema.json`
- `benchmark/invisible-tea-party/schemas/arbiter_verification.schema.json`

Relevant runtime code:

- `benchmark/invisible-tea-party/ts/src/cli.ts`
- `benchmark/invisible-tea-party/ts/src/ingest.ts`
- `benchmark/invisible-tea-party/ts/src/models.ts`
- `benchmark/invisible-tea-party/ts/src/schemaValidation.ts`

The scorecard must work from actual bundle artifacts produced by:

1. `benchmark:tea:run`
2. `benchmark:tea:ingest`

The renderer must read a bundle directory that contains:

- `leaderboard_submission.json`
- `final_verification.ingested.json`
- `deterministic_verification.json`
- `arbiter_verification.json`
- `pass1.reasoning_state.json`
- `pass2.reasoning_state.json`
- `pass3.reasoning_state.json`

### Objective

Build a static, publication-ready scoreboard generator that renders a clean shareable HTML artifact from a Tea Party bundle.

The output should feel editorial and high-signal, not like an internal admin panel.

### Visual direction

Use the attached Gemini mock as directional inspiration, but make the shipped output more polished and publication-ready:

- dark graphite/slate canvas
- soft panel separation, not flat blocks
- strong typographic hierarchy
- compact benchmark metadata strip at top
- horizontal score bars with precise numeric labels
- composition chart showing maximum possible contribution vs achieved contribution
- clear status chips for:
  - official vs unofficial
  - arbiter availability
  - certified arbiter vs custom arbiter
- visible penalty/cap callouts when present
- small “audit evidence” section showing why the score landed where it did

Do not make it playful, glossy, or marketing-slop. It should look like a serious research artifact that is also shareable as a screenshot.

### Hard requirements

1. Implement this as repo-native TypeScript/Node.
2. Do not add heavy frontend dependencies.
3. Prefer zero-dependency static HTML + CSS + inline SVG charts.
4. Do not require a server. The output must be a standalone HTML file viewable locally.
5. The renderer must use only real fields from the existing schemas.
6. If a field is missing, unavailable, or null, render an honest fallback rather than fabricating values.
7. Show `core_final_score` as the primary public score.
8. Never present `calibration_augmented_score` as the headline leaderboard score.
9. Distinguish raw run output from ingested official submission status.
10. Render from the actual benchmark artifacts, not mock JSON embedded in code.

### Deliverables

Implement the renderer and wire it into the benchmark package.

Add:

- a renderer module under `benchmark/invisible-tea-party/ts/src/`
- a CLI entrypoint under `benchmark/invisible-tea-party/ts/src/`
- any small helper/template modules needed
- one package script in `package.json`
- focused tests covering happy path and missing-field behavior
- brief docs in `benchmark/invisible-tea-party/README.md`

Suggested filenames:

- `benchmark/invisible-tea-party/ts/src/renderScorecard.ts`
- `benchmark/invisible-tea-party/ts/src/renderScorecardCli.ts`

### Scoreboard sections

The rendered HTML should contain these sections:

1. Header strip

- benchmark title
- scenario ID
- prompt family
- core score as percentage
- arbiter provider/model
- leaderboard status

2. Category raw scores

Render horizontal bars for:

- contradiction overlap
- gap closure
- premise rejection
- repair quality
- type discipline
- causal integrity
- consistency
- external calibration

Use actual values from `final_verification.score_components` where possible. If a category is not present, omit it honestly.

3. Score composition

Show “max possible weight” vs “achieved weighted contribution” per component.

For each component display:

- label
- raw score
- weight
- weighted score

4. Penalties and caps

Surface:

- `semantic_density_drop_flag`
- `evasion_penalty_raw`
- `evasion_penalty_normalized`
- `caps_applied`
- `conflicts`

5. Arbiter panel

Surface:

- `arbiter_pass_status`
- premise rejection quality
- repair quality
- sycophancy triggered
- type error severity
- causal reasoning integrity
- arbiter certification metadata

6. Evidence panel

Show short excerpts from:

- `arbiter_verification.justification`
- cited span refs when available
- deterministic audit trace
- reconciler audit trace

7. Footer metadata

Show:

- schema version
- rule profile version
- capability mode
- scoring timestamp
- lineage ID if available through the bundle

### Behavior requirements

Support:

- official ingested bundles
- unofficial local bundles
- arbiter unavailable runs
- runs without `calibration_augmented_score`
- bundles that contain caps/conflicts

The HTML should print cleanly to PDF and screenshot cleanly at desktop width.

### CLI contract

Create a command that works like:

```bash
npm run benchmark:tea:render-scorecard -- --bundle-dir /path/to/bundle --out-file /path/to/scorecard.html
```

Optional nice-to-have:

- `--view overview|audit`
- `--title "Custom Scorecard Title"`

### Tests

Add tests that verify:

1. renderer reads a real fixture bundle and writes HTML
2. rendered HTML includes the core score and leaderboard status
3. missing optional fields do not crash rendering
4. arbiter-unavailable runs still render honestly

### Definition of done

You are done when:

1. TypeScript compiles with `npm run benchmark:tea:check`
2. tests pass
3. the CLI writes a standalone HTML scorecard from a real Tea Party bundle
4. the resulting HTML is good enough to use in a public benchmark writeup without manual cleanup

### Implementation constraints

- preserve existing benchmark contracts
- do not break current test suite
- do not change score semantics
- do not silently mutate benchmark JSON
- if a schema mismatch is discovered, stop and fix it explicitly rather than working around it

At the end, summarize:

1. files changed
2. commands run
3. any residual design limitations
