# Invisible Tea Party — Calibration Report

Generated: 2026-04-07T06:37:12.566Z

## Summary

| Metric | Value |
|--------|-------|
| Total runs | 6 |
| Successful | 6 |
| Failed | 0 |
| Overall min | 0.4300 |
| Overall max | 0.7593 |
| Overall mean | 0.6203 |
| Overall median | 0.6483 |
| Overall stddev | 0.1339 |

## Per-Profile Scores

| Profile | Runs | Completion | Min | Max | Mean | Median | StdDev | Arbiter Unavail | Evasion Penalty |
|---------|------|------------|-----|-----|------|--------|--------|-----------------|-----------------|
| gemini_official_api | 6/6 | 100% | 0.4300 | 0.7593 | 0.6203 | 0.6483 | 0.1339 | 0 (0%) | 4 (67%) |

## Per-Family Scores

| Family | Scenarios | Mean Score | Spread |
|--------|-----------|------------|--------|
| ontology | 1 | 0.5733 | 0.0000 |
| category_error | 1 | 0.7580 | 0.0000 |
| social_consensus | 1 | 0.7233 | 0.0000 |
| constraint_paradox | 1 | 0.4780 | 0.0000 |
| recursive_role | 1 | 0.7593 | 0.0000 |
| temporal_inversion | 1 | 0.4300 | 0.0000 |

## Per-Tier Scores

| Tier | Scenarios | Mean Score |
|------|-----------|------------|
| 2 | 2 | 0.5017 |
| 3 | 2 | 0.7587 |
| 4 | 2 | 0.6007 |

## Cap Frequencies

| Rule | Count | Rate |
|------|-------|------|
| repair_quality_cap_low_gcr | 4 | 66.7% |
| causal_integrity_requires_resolved_causal_constraints | 2 | 33.3% |
| premise_rejection_cap_low_overlap | 2 | 33.3% |

## Outliers

No outliers detected (all scores within 2 standard deviations of the mean).

