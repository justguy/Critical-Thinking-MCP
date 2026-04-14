# Invisible Tea Party — Calibration Report

Generated: 2026-04-07T16:33:25.419Z

## Summary

| Metric | Value |
|--------|-------|
| Total runs | 30 |
| Successful | 24 |
| Failed | 6 |
| Overall min | 0.3450 |
| Overall max | 0.9779 |
| Overall mean | 0.6437 |
| Overall median | 0.6227 |
| Overall stddev | 0.1640 |

## Per-Profile Scores

| Profile | Runs | Completion | Min | Max | Mean | Median | StdDev | Arbiter Unavail | Evasion Penalty |
|---------|------|------------|-----|-----|------|--------|--------|-----------------|-----------------|
| gemini_3_1_preview_api | 0/6 | 0% | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0 (0%) | 0 (0%) |
| claude_opus_4_6_research_cli | 6/6 | 100% | 0.4261 | 0.8735 | 0.6261 | 0.5923 | 0.1647 | 0 (0%) | 4 (67%) |
| claude_live_research_cli | 6/6 | 100% | 0.4221 | 0.8747 | 0.7326 | 0.7883 | 0.1484 | 0 (0%) | 1 (17%) |
| claude_haiku_research_cli | 6/6 | 100% | 0.3450 | 0.6262 | 0.5260 | 0.5505 | 0.0987 | 1 (17%) | 6 (100%) |
| openai_cli_research_high_cli | 6/6 | 100% | 0.4944 | 0.9779 | 0.6900 | 0.6455 | 0.1565 | 0 (0%) | 4 (67%) |

## Per-Family Scores

| Family | Scenarios | Mean Score | Spread |
|--------|-----------|------------|--------|
| ontology | 4 | 0.6659 | 0.2407 |
| category_error | 4 | 0.7754 | 0.5129 |
| social_consensus | 4 | 0.7489 | 0.1652 |
| constraint_paradox | 4 | 0.6625 | 0.3914 |
| recursive_role | 4 | 0.4219 | 0.1494 |
| temporal_inversion | 4 | 0.5874 | 0.1851 |

## Per-Tier Scores

| Tier | Scenarios | Mean Score |
|------|-----------|------------|
| 2 | 8 | 0.6267 |
| 3 | 8 | 0.5987 |
| 4 | 8 | 0.7057 |

## Cap Frequencies

| Rule | Count | Rate |
|------|-------|------|
| repair_quality_cap_low_gcr | 14 | 58.3% |
| premise_rejection_cap_low_overlap | 9 | 37.5% |
| causal_integrity_requires_resolved_causal_constraints | 6 | 25.0% |

## Error Breakdown

| Category | Count |
|----------|-------|
| executor_failure | 6 |

## Outliers (> 2 StdDev)

| Profile | Scenario | Score | Deviation | Direction |
|---------|----------|-------|-----------|-----------|
| openai_cli_research_high_cli | tea_002_category_fairness | 0.9779 | 2.04σ | above |

