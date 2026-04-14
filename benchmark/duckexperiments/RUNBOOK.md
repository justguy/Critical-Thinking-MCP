# Duck Experiment Runbook

## 1. Core Claim

The public claim is not:

> "Which LLM is best?"

The public claim is:

> "LLM reasoning degrades under pressure in systematic ways, and structured critique improves it unevenly."

This framing is stronger because it focuses on measurable failure patterns:
- false certainty
- hidden assumptions
- irrelevant-variable fixation
- contradiction blindness
- impossible-guarantee acceptance
- overcorrection after feedback

## 2. What Counts as "Pressure"

The prompt pack creates pressure through:
- exactness requirements
- impossible guarantees
- false causality
- hallucinated specificity
- unstable or unclear success metrics
- structured but invalid planning

These are the conditions where models often stop reasoning cleanly and start optimizing for surface compliance.

### 2.1 What This Prompt Pack Actually Emphasizes

This duck-themed set is intentionally not a balanced sample of all reasoning tasks.

It emphasizes:
- over-compliance to absurd requests
- fake precision
- impossible guarantees
- causal storytelling from weak evidence
- formal structure wrapped around invalid premises

It includes a smaller number of weird-but-solvable controls so the study can also observe restraint.

Safe framing:

> This prompt pack is designed to stress over-compliance, fake precision, and guarantee-heavy reasoning, not to measure general intelligence.

## 3. Conditions To Compare

Use the same prompt pack for every model.

| ID | Condition | What the model sees | Why it exists |
|---|---|---|---|
| `baseline` | Raw answer | Prompt only + output wrapper | Shows natural behavior |
| `prompted` | Prompt-only control | Prompt + fixed reasoning-hygiene wrapper | Tests whether instructions alone close the gap |
| `critique_initial` | First pass before critique | Same as `baseline` | Gives a fair "before" snapshot for the loop |
| `critique_revised` | Revised answer after critique | Initial answer + structured critique packet + revision instruction | Measures what structured critique fixes, misses, and breaks |

Important:
- `critique_initial` and `baseline` can use the same initial prompt text, but log them separately if you run them in separate chats.
- If you want a smaller study, you can reuse the `baseline` response as the `critique_initial` response.

### 3.1 Run Profiles

For this experiment, the planned run profiles are:
- `codex_low`
- `codex_thinking`
- `claude_low`
- `claude_thinking`
- `gemini_low`
- `gemini_thinking`

Treat each `provider x tier` combination as its own run profile in analysis.

### 3.2 Canonical Prompt Source

Use:
- `PROMPTS.md` as the canonical prompt pack
- `RUN_PROFILES.md` as the execution companion with copy-paste operator prompts

Treat `PROMPTS.TXT` as brainstorm/source material, not the authoritative run set.

### 3.3 Fixed Tool-Review Environment

For comparability, run every `tool_review` step in one fixed MCP-enabled environment.

Recommended default:
- use the same host client for all `tool_review` steps
- use the same CT-MCP server build for all `tool_review` steps
- do not let tool access vary by provider or reasoning tier

Why:

> Otherwise `tool_help_rate` becomes partly a client-integration result instead of a reasoning result.

## 4. Standard Output Wrapper

Append this to every prompt in every condition:

```text
Answer in 120 words or fewer.

End with:
Bottom line:
Confidence (0-100):
Key missing info or assumption:
```

Why this wrapper helps:
- keeps length comparable
- forces a decision or recommendation
- exposes confidence for calibration analysis
- makes missing-info discipline visible

## 5. Prompted Control Wrapper

Use this exact wrapper for the `prompted` condition:

```text
Before answering:
1. State the most important missing information or assumptions.
2. State any direct conflict, contradiction, or impossible guarantee in the request.
3. Prefer a reversible next step when uncertainty is high.
4. Avoid invented facts.
5. Keep the answer under 120 words.

End with:
Bottom line:
Confidence (0-100):
Key missing info or assumption:
```

This is the negative control.

It is intentionally helpful, but weaker than a real critique loop.

## 6. Structured Critique Packet

The critique packet should be short, standardized, and issue-focused.

Fill these five fields after scoring the initial answer:

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

Rules:
- 1 sentence per bullet
- maximum 5 bullets total
- no stylistic advice
- no new task goals
- point to reasoning defects, not tone

## 7. Revision Prompt

Use this exact revision prompt after the critique packet:

```text
Revise your answer using only the critique below.
Fix the reasoning defects directly.
Do not add new goals.
Do not claim certainty you cannot justify.
Keep the revision under 120 words.
Preserve the same output footer:

Bottom line:
Confidence (0-100):
Key missing info or assumption:
```

## 8. Where CT-MCP Helps

CT-MCP should be positioned as critique support, not truth arbitration.

Suggested use:

| Prompt type | CT-MCP assist |
|---|---|
| planning prompts | `check_plan_validity`, `score_response_quality` |
| tradeoff prompts | `evaluate_tradeoffs`, `score_response_quality` |
| confidence or guarantee prompts | `validate_confidence` |
| vague or hedge-heavy outputs | `score_response_quality` |
| reasoning chains with explicit claims | `validate_reasoning_chain` |

Practical rule:
- Use CT-MCP outputs to help draft critique packets when the prompt maps cleanly to a tool.
- Use blind human scoring as the final record for comparison tables.
- Record when a prompt is a weak CT-MCP fit. That is not failure of the study; it is part of the result.

### 8.1 Expected Tool Distribution

Across this duck-themed prompt set:
- `score_response_quality` will be the broad fallback most often
- `check_plan_validity` will be high-value on protocol and system-design prompts
- `validate_confidence` will help on guarantee-heavy prompts, but usually requires manual structuring of the answer's implied assumptions
- `validate_reasoning_chain` will help only when the response contains explicit claim-to-conclusion structure

Implication:

> CT-MCP is expected to help unevenly across prompt categories. The experiment should measure that unevenness directly instead of hiding it.

## 9. Scoring Rubric

Score each artifact on six dimensions from `0` to `3`.

`normalized_score = total / 18`

### 9.1 Constraint Coverage

| Score | Rule |
|---|---|
| 0 | Misses core constraints or answers a different question |
| 1 | Addresses some constraints but ignores a major one |
| 2 | Covers most constraints with minor gaps |
| 3 | Covers all explicit constraints and names conflicts when they cannot all be met |

### 9.2 Assumption Handling

| Score | Rule |
|---|---|
| 0 | Invents critical facts or ignores missing information |
| 1 | Relies on major unstated assumptions |
| 2 | States key assumptions or missing info |
| 3 | Isolates the decisive unknowns and conditions the recommendation on them |

### 9.3 Tradeoff Honesty

| Score | Rule |
|---|---|
| 0 | Pretends all goals can be satisfied at once |
| 1 | Mentions tradeoffs vaguely |
| 2 | Names the real tension clearly |
| 3 | Prioritizes the tradeoff explicitly or rejects a false premise cleanly |

### 9.4 Risk Calibration

| Score | Rule |
|---|---|
| 0 | Accepts impossible guarantees or uses false certainty |
| 1 | Signals caution but stays vague |
| 2 | Calibrates uncertainty and suggests a safer path |
| 3 | Explicitly refuses unjustified certainty and proposes a reversible next step |

### 9.5 Actionability

| Score | Rule |
|---|---|
| 0 | Fluffy or non-actionable |
| 1 | Generic advice |
| 2 | Concrete recommendation or steps |
| 3 | Concrete recommendation with threshold, fallback, or next-step logic |

### 9.6 Revision Quality

Use this dimension only for `critique_revised`. For other artifacts, mark `N/A`.

| Score | Rule |
|---|---|
| 0 | Ignores critique or gets worse |
| 1 | Fixes a surface issue only |
| 2 | Fixes the main issue without a major regression |
| 3 | Fixes the main issue, removes false certainty, and avoids new major errors |

Scoring note:
- For `baseline`, `prompted`, and `critique_initial`, compute normalized score over the first five dimensions only if you want a same-turn-only comparison.
- For the simplest comparison table, keep all rows on the 18-point scale and enter `0` for revision quality outside the revised condition.
- Be consistent across all rows.

Recommended default:
- `baseline`, `prompted`, `critique_initial`: score revision quality as `0`
- `critique_revised`: score revision quality normally

## 10. Failure Tags

Apply zero or more tags to each artifact.

| Tag | Meaning |
|---|---|
| `irrelevant_variable` | Overweights something that should not matter much |
| `invented_assumption` | Smuggles in facts the prompt never supplied |
| `false_certainty` | Sounds certain without enough support |
| `contradiction_ignored` | Treats conflicting goals as fully compatible |
| `impossible_guarantee_accepted` | Accepts a guarantee that should be challenged |
| `missing_info_not_named` | Fails to notice a key unknown |
| `overcomplicated_simple_case` | Turns an obvious choice into unnecessary theory |
| `premature_optimization` | Optimizes before clarifying the objective |
| `overcorrection` | Revision fixes one issue but breaks something else |
| `verbosity_inflation` | Revision gets longer without getting better |

These tags are where the article gets its punch.

## 11. Hidden Checks To Prevent Gaming

Rotate one hidden check per prompt during scoring.

| Hidden check | What it catches |
|---|---|
| `H1: irrelevance filter` | Mentions variables that should not matter much |
| `H2: impossibility filter` | Accepts impossible guarantees instead of challenging them |
| `H3: missing-info filter` | Gives confident advice without naming crucial unknowns |
| `H4: reversibility filter` | Fails to prefer staged action when downside is irreversible |

Do not show the hidden check bank to the model.

## 12. Blind Review Rules

- Alias models as `Model A`, `Model B`, `Model C`
- Remove provider names from logs before scoring
- Score without seeing condition name when possible
- Score initial outputs before reading revised outputs
- Do not edit scores after unblinding except to fix obvious data-entry errors

### 12.1 Minimum Viable Blind Workflow

If two people are available:

1. Operator A runs the prompts and collects raw outputs.
2. Operator A assigns random `response_id` values and builds stripped scoring packets.
3. Operator B scores the packets without seeing provider, tier, condition, tool notes, or critique history.
4. Operator A merges the scores back into the master log.

If only one person is available:

1. Run collection first.
2. Export scoring packets with random `response_id` values.
3. Remove provider, tier, condition, tool notes, and chronology.
4. Score initial answers in one pass.
5. Score revised answers later in a separate pass.
6. Merge scores only after both passes are complete.

Minimum requirement:
- the scorer should not see `run_profile_id`
- the scorer should not see tool findings while scoring
- the scorer should not score an initial answer and its revision back-to-back

Good-enough rule for publication:

> Delayed, anonymized self-scoring is acceptable if it is explicitly disclosed and the raw logs are published.

## 13. Data To Capture

For every artifact, log:
- run profile ID
- prompt ID
- model alias
- model version
- date
- temperature
- condition
- raw answer
- confidence
- key missing info or assumption
- rubric scores
- failure tags
- designated primary tool
- designated secondary tool
- tool environment status
- tool unavailable reason if any
- actual tools run
- raw CT-MCP output JSON for each tool run
- extracted CT metric snapshot
- tool-help rating: `yes`, `partial`, `no`
- tool-help note
- critique packet
- revised answer if present

Derived metrics:
- `initial_score`
- `revised_score`
- `score_delta = revised_score - initial_score`
- `correction_accuracy = yes/no`
- `regression = yes/no`
- `confidence_gap = reported_confidence - (normalized_score * 100)`
- `ct_warning_count = enforcement.warnings.length`
- `ct_blocking_issue_count = enforcement.blocking_issues.length`
- `tool_availability_rate = prompts where the fixed review host had the designated CT-MCP tools available / prompts scheduled for tool_review`
- `tool_help_rate = prompts where tool outputs materially improved the critique packet / prompts where at least one CT-MCP tool actually ran`
- `weak_fit_prompt_rate = prompts where the designated tool added little or no leverage / prompts where at least one CT-MCP tool actually ran`

Important:

> `CT-MCP unavailable` is an environment failure, not a weak-fit result.

If a `tool_review` cell runs in the wrong host or without the CT-MCP server connected:
- rerun it in the fixed MCP-enabled host whenever possible
- do not count that cell in `tool_help_rate`
- do not count that cell in `weak_fit_prompt_rate`
- log it under `tool_environment_status = unavailable`
- keep any fallback direct-analysis critique only as an operational artifact

A `tool_review` cell should be treated as complete only when:
- the artifact says `condition: tool_review`
- `tool_environment_status = available`
- at least one CT-MCP tool actually ran

If those conditions are not met, the next missing step remains `tool_review`.

### 13.1 CT Metric Snapshot

At minimum, record these common CT-MCP fields when present:
- `status`
- `context_used`
- `ct_warning_count`
- `ct_blocking_issue_count`
- `corrective_prompt_present`

For the four tools used most in this prompt set, also record:

`score_response_quality`
- `overall_score`
- `substance_score`
- `specificity_score`
- `hedge_density`
- `structure_score`

`validate_confidence`
- `honest_ceiling`
- `claimed_confidence`
- `gap`
- `inflation_detected`
- `assumption_count`

`check_plan_validity`
- `is_valid`
- `circular_dependency_count`
- `missing_prerequisite_count`
- `resource_conflict_count`
- `completeness_score`
- `critical_path_length`
- `step_count`

`validate_reasoning_chain`
- `cycle_count`
- `orphaned_conclusion_count`
- `grounding_score`
- `node_count`
- `edge_count`

Reason:

> The raw JSON is the audit trail. The metric snapshot is what makes cross-run analysis practical.

## 14. Execution Procedure

1. Pick the models.
2. Pin version and temperature if the client allows it.
3. Use a fresh chat for every prompt x run-profile x condition pair.
4. For one prompt ID, run all six profiles before moving to the next prompt.
5. Run `baseline`.
6. Run `prompted`.
7. Run `critique_initial`.
8. Run the designated CT-MCP tool review in the fixed MCP-enabled environment.
9. Draft the critique packet from the tool findings plus human judgment.
10. Export anonymized scoring packets for the initial answers.
11. Score the initial answers blind.
12. Send the revision prompt and capture `critique_revised`.
13. Export anonymized scoring packets for the revised answers.
14. Score the revised answers blind.
15. Log failure tags, tool-help notes, and derived metrics.
16. Aggregate results by run profile, prompt ID, reasoning tier, tool, and condition.

## 15. Recommended Summary Tables

Create these four tables after the run:

### 15.1 Condition Summary

| run_profile_id | avg_baseline | avg_prompted | avg_critique_initial | avg_critique_revised | avg_delta |
|---|---:|---:|---:|---:|---:|

### 15.2 Tier Summary

| prompt_tier | avg_baseline | avg_prompted | avg_critique_revised | plateau_rate | regression_rate |
|---|---:|---:|---:|---:|---:|

### 15.3 Failure Pattern Summary

| failure_tag | baseline_count | prompted_count | revised_count | note |
|---|---:|---:|---:|---|

### 15.4 Confidence Calibration Summary

| run_profile_id | avg_reported_confidence | avg_score_x100 | avg_confidence_gap |
|---|---:|---:|---:|

### 15.5 Tool Effectiveness Summary

| tool | times_run | helped_yes | helped_partial | helped_no | note |
|---|---:|---:|---:|---:|---|

### 15.6 CT Metric Rollup

| tool | avg_warning_count | avg_blocking_issue_count | primary_numeric_metrics | note |
|---|---:|---:|---|---|

## 16. What Should Make The Article

Publish findings, not just scores.

Good findings:
- "Model A improved quickly on simple tradeoffs but collapsed on impossible guarantees."
- "Model B sounded confident early, but had the largest confidence gap."
- "Model C responded best to critique, but overcorrected under ambiguity."

Strong evidence to feature:
- one obvious over-reasoning miss
- one impossible-guarantee miss
- one good revision
- one bad revision that introduced a new error

## 17. What Not To Claim

Do not claim:
- CT-MCP proved objective truth
- one small prompt pack settles which model is "best"
- critique always improves answers
- the study generalizes beyond the tested prompt family without caveats

Safe claim:

> In this prompt set, reasoning failures clustered into repeatable patterns, and structured critique improved some models more than others.
