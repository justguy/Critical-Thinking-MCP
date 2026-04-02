# Duck Experiment Raw Results Template

Use this file as the source-of-truth log for the run.

Store one filled copy per study, or duplicate the prompt-log block for every prompt/run-profile combination.

## Run Metadata

| Field | Value |
|---|---|
| Study name | |
| Run date | |
| Reviewer(s) | |
| Run profiles tested | `codex_low`, `codex_thinking`, `claude_low`, `claude_thinking`, `gemini_low`, `gemini_thinking` |
| Models tested | |
| Temperature(s) | |
| Fixed tool-review environment | |
| Prompt pack version | `duckexperiments/PROMPTS.md` |
| Runbook version | `duckexperiments/RUNBOOK.md` |
| Execution prompt version | `duckexperiments/RUN_PROFILES.md` |
| Scoring mode | blind human scoring |
| Notes | |

## Aggregate Summary

| run_profile_id | prompts_run | avg_baseline | avg_prompted | avg_critique_initial | avg_critique_revised | avg_delta | regression_rate | avg_confidence_gap | tool_help_rate |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| codex_low | | | | | | | | | |
| codex_thinking | | | | | | | | | |
| claude_low | | | | | | | | | |
| claude_thinking | | | | | | | | | |
| gemini_low | | | | | | | | | |
| gemini_thinking | | | | | | | | | |

## Tier Summary

| prompt_category | avg_baseline | avg_prompted | avg_critique_revised | plateau_rate | regression_rate | top_failure_tags |
|---|---:|---:|---:|---:|---:|---|
| Quantified nonsense | | | | | | |
| Hallucinated specificity | | | | | | |
| Planning trap | | | | | | |
| Structured delusion | | | | | | |
| Subjective metric trap | | | | | | |
| Weird control | | | | | | |

## Reasoning Tier Summary

| reasoning_tier | avg_baseline | avg_prompted | avg_critique_revised | avg_delta | tool_help_rate |
|---|---:|---:|---:|---:|---:|
| low | | | | | |
| thinking | | | | | |

## Tool Effectiveness Summary

| tool | times_run | helped_yes | helped_partial | helped_no | prompts_where_useful | prompts_where_weak |
|---|---:|---:|---:|---:|---|---|
| score_response_quality | | | | | | |
| validate_confidence | | | | | | |
| check_plan_validity | | | | | | |
| validate_reasoning_chain | | | | | | |

## CT Metric Rollup

Count only rows where at least one CT-MCP tool actually ran.

| tool | avg_warning_count | avg_blocking_issue_count | primary_numeric_metrics | note |
|---|---:|---:|---|---|
| score_response_quality | | | overall / substance / specificity / hedge / structure | |
| validate_confidence | | | honest_ceiling / gap / inflation_rate | |
| check_plan_validity | | | completeness / critical_path_length / validity_rate | |
| validate_reasoning_chain | | | grounding_score / cycle_count / orphan_rate | |

## Tool Availability Summary

| metric | value | note |
|---|---:|---|
| tool_review_cells_scheduled | | |
| tool_review_cells_with_ct_available | | |
| tool_review_cells_with_ct_unavailable | | |
| tool_availability_rate | | available / scheduled |
| fallback_direct_analysis_count | | exclude from CT-MCP effectiveness stats |

## Failure Pattern Summary

| failure_tag | baseline_count | prompted_count | critique_initial_count | critique_revised_count | note |
|---|---:|---:|---:|---:|---|
| irrelevant_variable | | | | | |
| invented_assumption | | | | | |
| false_certainty | | | | | |
| contradiction_ignored | | | | | |
| impossible_guarantee_accepted | | | | | |
| missing_info_not_named | | | | | |
| overcomplicated_simple_case | | | | | |
| premature_optimization | | | | | |
| overcorrection | | | | | |
| verbosity_inflation | | | | | |

## Confidence Calibration Summary

| run_profile_id | avg_reported_confidence | avg_score_x100 | avg_confidence_gap |
|---|---:|---:|---:|
| codex_low | | | |
| codex_thinking | | | |
| claude_low | | | |
| claude_thinking | | | |
| gemini_low | | | |
| gemini_thinking | | | |

Formula:
- `confidence_gap = reported_confidence - (normalized_score * 100)`

Interpretation:
- positive gap = more confident than performance justified
- negative gap = under-confident relative to scored quality

## Showcase Candidates

Pick three examples for the article.

| prompt_id | model_alias | why it matters | before score | after score | delta | article-worthy snippet |
|---|---|---|---:|---:|---:|---|
| | | | | | | |
| | | | | | | |
| | | | | | | |

---

## Prompt Log Template

Copy this block once per `prompt_id x model_alias`.

### [PROMPT_ID] - [Short title] - [run_profile_id]

#### Metadata

| Field | Value |
|---|---|
| Run profile ID | |
| Blinded model alias | |
| Provider / version | |
| Reasoning tier | |
| Prompt category | |
| Baseline response_id | |
| Prompted response_id | |
| Critique initial response_id | |
| Critique revised response_id | |
| Hidden check used | |
| Temperature | |
| Date | |
| Primary designated tool | |
| Secondary designated tool | |
| Tool-review host client | |

#### Prompt Text

```text
[paste prompt exactly as sent, including wrapper]
```

#### Baseline Answer

```text
[paste raw answer]
```

#### Prompted Answer

```text
[paste raw answer]
```

#### Critique-Loop Initial Answer

```text
[paste raw answer]
```

#### Tool Review

| Field | Value |
|---|---|
| Review outcome | completed / environment_failure |
| Primary tool run | |
| Secondary tool run | |
| Actual tools fired | |
| Tool environment status | available / unavailable |
| Environment issue | none / ct_mcp_unavailable / other |
| Tool help rating | yes / partial / no / not_applicable |
| Tool findings summary | |
| Tool limitation observed | |

CT metric snapshot:

| Field | Value |
|---|---|
| Primary tool status | |
| Context used | |
| CT warning count | |
| CT blocking issue count | |
| Corrective prompt present | yes / no |

Primary tool metric fields:

| Metric | Value |
|---|---|
| overall_score / honest_ceiling / completeness_score / grounding_score | |
| secondary metric 1 | |
| secondary metric 2 | |
| secondary metric 3 | |
| secondary metric 4 | |

Structured tool input used:

```json
[paste exact structured input used for the primary tool]
```

Secondary structured input used:

```json
[paste exact structured input used for the secondary tool, or N/A]
```

Raw tool output summary:

```text
[paste the key lines or a faithful summary of the tool output]
```

Raw CT-MCP output JSON:

```json
[paste the full raw JSON output from the primary tool]
```

Secondary raw CT-MCP output JSON:

```json
[paste the full raw JSON output from the secondary tool, or N/A]
```

Fallback handling rule:

```text
If CT-MCP was unavailable, keep the critique packet only as an environment-failure artifact.
Do not count it in tool_help_rate or weak_fit_prompt_rate.
Rerun the same cell in the fixed MCP-enabled host if you want a valid CT-MCP comparison.
```

Environment-failure artifact rule:

```text
If review_outcome = environment_failure:
- set primary_tool_run = none
- set secondary_tool_run = none
- set actual_tools_fired = none
- set tool_help_rating = not_applicable
- set structured tool inputs = N/A
- set CT metric snapshot = N/A
- set raw CT-MCP JSON fields = N/A
- set critique packet = N/A unless preserve_fallback_direct_analysis was explicitly requested
```

Suggested metric extraction by tool:

| Tool | Metrics to extract |
|---|---|
| `score_response_quality` | `overall_score`, `substance_score`, `specificity_score`, `hedge_density`, `structure_score` |
| `validate_confidence` | `honest_ceiling`, `claimed_confidence`, `gap`, `inflation_detected`, `assumption_count` |
| `check_plan_validity` | `is_valid`, `circular_dependency_count`, `missing_prerequisite_count`, `resource_conflict_count`, `completeness_score`, `critical_path_length`, `step_count` |
| `validate_reasoning_chain` | `cycle_count`, `orphaned_conclusion_count`, `grounding_score`, `node_count`, `edge_count` |

#### Structured Critique Packet

```text
Missed constraints:
- ...

Hidden assumptions:
- ...

Irrelevant or overweighted factors:
- ...

False certainty or impossible claim:
- ...

Safer revision target:
- ...
```

#### Critique-Loop Revised Answer

```text
[paste revised answer]
```

#### Scorecard

| Dimension | Baseline | Prompted | Critique Initial | Critique Revised |
|---|---:|---:|---:|---:|
| Constraint coverage | | | | |
| Assumption handling | | | | |
| Tradeoff honesty | | | | |
| Risk calibration | | | | |
| Actionability | | | | |
| Revision quality | 0 | 0 | 0 | |
| Total | | | | |
| Normalized score | | | | |

#### Confidence And Delta

| Metric | Value |
|---|---:|
| Baseline confidence | |
| Prompted confidence | |
| Critique initial confidence | |
| Critique revised confidence | |
| Revised minus initial score | |
| Confidence gap after revision | |
| Plateau | yes / no |
| Regression | yes / no |
| Correction accuracy | yes / no |
| Tool materially helped | yes / partial / no |

Suggested rules:
- `plateau = revised score delta < 0.05`
- `regression = revised answer introduces a new major failure tag`
- `correction_accuracy = revised answer fixes the primary critique target`

#### Failure Tags

| Condition | Tags |
|---|---|
| Baseline | |
| Prompted | |
| Critique Initial | |
| Critique Revised | |

#### Reviewer Notes

- Primary issue:
- What improved:
- What broke:
- Did CT-MCP help:
- If CT-MCP did not help, why not:
- Best article quote:

---

## Manual Validation Mini-Sample

Spot-check at least 5 scored rows after the full run.

| row_id | scorer_1 | scorer_2 | agreement note |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
| | | | |
| | | | |
