# Invisible Tea Party — Calibration Report

Generated: 2026-04-07T18:45:43.469Z

## Summary

| Metric | Value |
|--------|-------|
| Total runs | 6 |
| Successful | 6 |
| Failed | 0 |
| Overall min | 0.5000 |
| Overall max | 0.8680 |
| Overall mean | 0.6931 |
| Overall median | 0.7430 |
| Overall stddev | 0.1398 |

## Per-Profile Scores

| Profile | Runs | Completion | Min | Max | Mean | Median | StdDev | Arbiter Unavail | Evasion Penalty |
|---------|------|------------|-----|-----|------|--------|--------|-----------------|-----------------|
| gemini_3_1_preview_api | 6/6 | 100% | 0.5000 | 0.8680 | 0.6931 | 0.7430 | 0.1398 | 0 (0%) | 3 (50%) |

## Per-Family Scores

| Family | Scenarios | Mean Score | Spread |
|--------|-----------|------------|--------|
| ontology | 1 | 0.7593 | 0.0000 |
| category_error | 1 | 0.8680 | 0.0000 |
| social_consensus | 1 | 0.7267 | 0.0000 |
| constraint_paradox | 1 | 0.5000 | 0.0000 |
| recursive_role | 1 | 0.7947 | 0.0000 |
| temporal_inversion | 1 | 0.5100 | 0.0000 |

## Per-Tier Scores

| Tier | Scenarios | Mean Score |
|------|-----------|------------|
| 2 | 2 | 0.6347 |
| 3 | 2 | 0.8313 |
| 4 | 2 | 0.6133 |

## Cap Frequencies

| Rule | Count | Rate |
|------|-------|------|
| repair_quality_cap_low_gcr | 3 | 50.0% |
| premise_rejection_cap_low_overlap | 1 | 16.7% |
| causal_integrity_requires_resolved_causal_constraints | 1 | 16.7% |

## Outliers

No outliers detected (all scores within 2 standard deviations of the mean).

