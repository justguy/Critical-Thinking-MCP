# Invisible Tea Party — Threshold Review

Generated: 2026-04-07T06:37:12.566Z

## 1. Are scores degenerate or useful?

**Scores show useful variation.** Standard deviation is 0.1339 with mean 0.6203 and median 0.6483. The score range [0.4300 – 0.7593] suggests the benchmark is discriminating.

## 2. Which scenarios separate models best?

All families show zero spread — only one profile tested per family, or all profiles score identically.
Hardest family: **temporal_inversion** (mean: 0.4300).
Easiest family: **recursive_role** (mean: 0.7593).

## 3. Which caps fire most often?

- **repair_quality_cap_low_gcr**: 4 times (66.7% of successful runs)
- **causal_integrity_requires_resolved_causal_constraints**: 2 times (33.3% of successful runs)
- **premise_rejection_cap_low_overlap**: 2 times (33.3% of successful runs)

## 4. Is any threshold obviously too strict or too lenient?

No obviously broken thresholds detected from this data.
**Evasion penalty fires frequently** for: gemini_official_api (67%). The density drop threshold may need review.

