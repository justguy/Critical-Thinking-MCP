# Invisible Tea Party — Threshold Review

Generated: 2026-04-07T16:33:25.419Z

## 1. Are scores degenerate or useful?

**Scores show useful variation.** Standard deviation is 0.1640 with mean 0.6437 and median 0.6227. The score range [0.3450 – 0.9779] suggests the benchmark is discriminating.

## 2. Which scenarios separate models best?

Highest discrimination by family: **category_error** (spread: 0.5129).
Hardest family: **recursive_role** (mean: 0.4219).
Easiest family: **category_error** (mean: 0.7754).

## 3. Which caps fire most often?

- **repair_quality_cap_low_gcr**: 14 times (58.3% of successful runs)
- **premise_rejection_cap_low_overlap**: 9 times (37.5% of successful runs)
- **causal_integrity_requires_resolved_causal_constraints**: 6 times (25.0% of successful runs)

## 4. Is any threshold obviously too strict or too lenient?

No obviously broken thresholds detected from this data.
**Evasion penalty fires frequently** for: claude_opus_4_6_research_cli (67%), claude_haiku_research_cli (100%), openai_cli_research_high_cli (67%). The density drop threshold may need review.

