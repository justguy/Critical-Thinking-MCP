# Tea Party Results Layout

This directory contains two different kinds of benchmark output.

## 1. Published Release Bundles

Directories named `live-*` are archived release artifacts.

Examples:

- `live-gemini-official-2026-04-06/`
- `live-expanded-comparison-2026-04-07/`
- `live-gemini-3-1-preview-2026-04-07/`

These are the directories public docs should point at.

They should be treated as immutable snapshots once published.

## 2. Raw Calibration Workdirs

`results/calibration/` is the working area for raw runs and intermediate matrices.

Use it for:

- fresh multi-profile calibrations
- partial reruns
- one-off scenario reruns
- debugging transport or matcher issues

Do not treat `results/calibration/` as the stable release surface.

## What A Release Bundle Should Contain

A release-ready bundle should usually include:

- `calibration_manifest.json`
- `aggregate_report.md`
- `aggregate_report.json`
- `threshold_review.md`
- `model_breakdown.json`
- `scenario_breakdown.json`

Depending on the run type, it may also include:

- `inclusive_run_report.md`
- `aggregated_scenario_runs.json`
- `failure_gallery.html`
- `scorecard_*.html`
- attestation and ingest artifacts for official runs

## Reproducing A Release

Basic pattern:

1. Run calibration into `results/calibration/<date-or-name>/`
2. Generate reports with `benchmark:tea:report`
3. If needed, merge split runs with `benchmark:tea:merge-calibration`
4. Render scorecards or failure galleries
5. Copy the final frozen bundle into a new `results/live-*` directory
6. Add the new release to `benchmark/invisible-tea-party/RELEASES.md`

That keeps raw execution history and published release history separate and easier to understand.
