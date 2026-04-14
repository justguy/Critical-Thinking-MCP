# Invisible Tea Party Release Line

This benchmark now has a release line separate from the npm package version for `ct-mcp`.

That split is intentional:

- npm package semver tracks the CT-MCP server and tool surface
- Tea Party release versions track benchmark artifacts, published comparisons, and frozen result bundles

## Published Releases

| Release | Date | Status | What It Freezes | Canonical Artifacts |
|---|---|---|---|---|
| `v1.0` Official Baseline | `2026-04-06` | published | attested official Gemini 2.5 Pro baseline | `results/live-gemini-official-2026-04-06/` |
| `v1.1` Comparison Pack | `2026-04-07` | publication-ready | preserves `v1.0`, adds research comparison bundles, Gemini 3.1 Preview comparison, article pack, prompt pack, and publish snapshot | `results/live-expanded-comparison-2026-04-07/`, `results/live-gemini-3-1-preview-2026-04-07/` |

## Release Policy

When a new Tea Party version ships:

1. Keep prior release bundles immutable.
2. Archive the new bundle under a new `results/live-*` directory.
3. Add a new entry here instead of rewriting the old one.
4. Update `benchmark/invisible-tea-party/README.md` so it points to:
   - the current official baseline
   - the current comparison pack
   - the current reproduction commands
5. Keep raw calibration workdirs separate from the published release surface.

## What Counts As Release Material

Release material should include:

- frozen benchmark result bundles under `results/live-*`
- aggregate reports and threshold review
- prompt and response artifacts needed for inspection
- scorecard and failure-gallery HTML where relevant
- the profile configs used to generate the release
- documentation that explains what shipped, how to rerun it, and what remains future work

## What Stays Raw

Raw and intermediate calibration work belongs under `results/calibration/`.

That directory is useful for:

- one-off reruns
- failed or partial workdirs
- raw matrix execution
- debugging and matcher development

It is not the stable public release surface.

## Recommended Tagging

If you want Git history to mirror the benchmark release line, use lightweight or annotated tags such as:

- `tea-party-v1.0-official-baseline`
- `tea-party-v1.1-comparison-pack`

That keeps the benchmark release cadence explicit without forcing it to match npm package semver.
