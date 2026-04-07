# Duck Experiment Agent Prompt Pack

Use this file when handing off one experiment cell to an agent.

One experiment cell means:
- one `prompt_id`
- one `run_profile_id`
- one `condition`

There are two agent roles:
- `response agent` for `baseline`, `prompted`, `critique_initial`, and `critique_revised`
- `tool-review agent` for the fixed MCP-enabled `tool_review` step

Do not improvise the method outside these prompts.

## 0. How To Use This File

This file is an execution contract for the receiving agent.
The normal path is: give the agent this file plus a minimal invocation, and let the agent resolve the rest.
Manual copy-paste of the long wrapper prompts is fallback mode only.

What you actually do:
- choose one cell: one `prompt_id` + one `run_profile_id`
- optionally specify `condition`
- give the agent this file plus the minimal invocation
- let the agent resolve the model metadata, prompt text, designated tools, date, output path, and same-cell upstream paths
- let the agent write exactly one artifact to the resolved `output_path`

Important:
- the receiving agent should not ask you to restate the experiment if this file and the minimum invocation are already present
- the receiving agent should not browse other result files or directories
- `tool_review` must run only in the fixed MCP-enabled review host
- one fresh session should be used per cell

What the agent should write:
- exactly one output file at `output_path`
- no reads from other experiment result files

## 0.0 Agent Execution Contract

This section is for the receiving agent.

If a user tells you to use this file to run one experiment cell, do not ask them to restate the whole methodology if the minimum metadata is already present.

When invoked with:
- `run_profile_id`
- `prompt_id`
- `condition` if explicitly specified

you must:
1. resolve model metadata from `## 0.5 Default Run Profile Catalog`
2. resolve prompt text and designated tools from `## 0.6 Canonical Prompt Catalog`
3. if `condition` is omitted, infer the next missing condition in this order:
   `baseline` -> `prompted` -> `critique_initial` -> `tool_review` -> `critique_revised`
4. if `date` is omitted, use the local current date
5. if `output_path` is omitted, derive it from `## 5. Recommended Output Path Pattern`
6. if `condition = tool_review` and `critique_initial_path` is omitted, derive the canonical same-cell path
7. if `condition = critique_revised` and upstream paths are omitted, derive the canonical same-cell paths
8. choose the correct wrapper from `## 1` or `## 2`
9. execute exactly one cell
10. write only the final artifact to `output_path`

Do not ask the user for:
- `date` if it was omitted
- `output_path` if it was omitted
- `condition` if the next missing condition can be inferred safely

Ask only if one of these is truly missing or ambiguous:
- `run_profile_id`
- `prompt_id`
- a required upstream artifact for the inferred cell

If `condition = tool_review`, you also need either:
- `critique_initial_answer`, or
- `critique_initial_path`

If `condition = critique_revised`, you also need either:
- `critique_initial_answer` and `critique_packet`, or
- `critique_initial_path` and `tool_review_path`

Permitted file reads:
- you may read this file
- you may read the specific upstream artifact files explicitly named in the handoff for the same cell
- you may read the canonical upstream artifact paths for the same `run_profile_id` and `prompt_id` when inferring the next missing condition
- do not read any sibling result files, directories, or unrelated experiment outputs

If a required upstream artifact is missing, ask only for that missing artifact or path.
Do not ask the user to re-explain the whole experiment.

## 0.0.2 Canonical Artifact Resolution

When deriving same-cell paths, use this canonical pattern:

```text
/tmp/duck_[MODEL_SLUG]_[REASONING_TIER]_[PROMPT_ID]_[CONDITION].md
```

Example for `claude_low / C01`:
- `/tmp/duck_claude-sonnet_low_C01_baseline.md`
- `/tmp/duck_claude-sonnet_low_C01_prompted.md`
- `/tmp/duck_claude-sonnet_low_C01_critique_initial.md`
- `/tmp/duck_claude-sonnet_low_C01_tool_review.md`
- `/tmp/duck_claude-sonnet_low_C01_critique_revised.md`

Completion rules:
1. Resolve `model_slug` and `reasoning_tier` from the run profile catalog.
2. Build the five canonical same-cell paths for the current `run_profile_id` and `prompt_id`.
3. A response cell counts as complete only if the file exists and includes matching:
   - `run_profile_id`
   - `prompt_id`
   - `condition`
4. A `tool_review` cell counts as complete only if the file exists and includes matching:
   - `run_profile_id`
   - `prompt_id`
   - `condition: tool_review`
   - `tool_environment_status: available`
   - at least one CT-MCP tool actually ran
5. If a `tool_review` file exists but says `tool_environment_status: unavailable`, treat `tool_review` as still missing.
6. Infer the next missing condition using those completion rules.
7. Never skip from `critique_initial` to `critique_revised` unless a valid completed `tool_review` exists or the handoff explicitly says `preserve_fallback_direct_analysis: yes`.

## 0.0.1 Minimal Invocation Format

This is the preferred way to invoke an agent with this file:

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: [RUN_PROFILE_ID]
- prompt_id: [PROMPT_ID]
- condition: [CONDITION]
```

Defaults:
- if `condition` is omitted, infer the next missing condition
- if `date` is omitted, use today
- if `output_path` is omitted, derive it from the output path pattern

For `tool_review`, add one of:

```text
- critique_initial_answer: [paste the full critique_initial answer]
```

or

```text
- critique_initial_path: [path to the critique_initial artifact]
```

For `critique_revised`, add either:

```text
- critique_initial_answer: [paste the full critique_initial answer]
- critique_packet: [paste the full critique packet]
```

or

```text
- critique_initial_path: [path to the critique_initial artifact]
- tool_review_path: [path to the tool_review artifact]
```

If `output_path` is omitted, derive it from `## 5. Recommended Output Path Pattern`.

## 0.1 Quick Step Order For One Prompt

Run the cells in this order:
1. `baseline`
2. `prompted`
3. `critique_initial`
4. `tool_review`
5. `critique_revised`

Use the same `PROMPT_TEXT` for all five cells of the same `prompt_id`.

## 0.2 Manual Wrapper Mode

This section is fallback guidance only.
Normal usage is the execution contract above.

If you must run in manual wrapper mode, use this rule:

- If the condition is `baseline`, `prompted`, `critique_initial`, or `critique_revised`, copy everything inside `## 1. Response Agent Prompt`.
- If the condition is `tool_review`, copy everything inside `## 2. Tool-Review Agent Prompt`.

Do not use only the short experiment prompt such as:

```text
Design a falsifiable experiment to test whether rubber duck debugging improves bug-finding speed...
```

That line is only the task being evaluated.
In manual mode, the agent needs the full wrapper prompt from this file.

## 0.3 First Example

For the first control prompt `C01`, the underlying experiment prompt is:

```text
Design a falsifiable experiment to test whether rubber duck debugging improves bug-finding speed. Include the metric, hypothesis, confounders, and stopping rule.
```

In normal usage, you do not paste the full wrapper yourself.
You give the execution contract plus the minimum invocation and let the agent resolve the rest.

Example mapping:
- `baseline`: the agent should select the `Response Agent Prompt`
- `tool_review`: the agent should select the `Tool-Review Agent Prompt` and read the exact `critique_initial` artifact for the same cell

## 0.4 Minimal Safe Workflow

For each cell:
1. Start a fresh session.
2. Give the agent this file plus the minimum invocation.
3. Confirm the agent writes to the resolved `output_path`.
4. Move to the next condition only after the current file exists and is valid for that cell.

## 0.5 Default Run Profile Catalog

If you use one of these six canonical `run_profile_id` values, you do not need to manually invent the model metadata.
Resolve it from this table.

| run_profile_id | model_slug | reasoning_tier | model_string | temperature |
|---|---|---|---|---|
| `codex_low` | `codex` | `low` | `Codex` | `default` |
| `codex_thinking` | `codex` | `thinking` | `Codex` | `default` |
| `claude_low` | `claude-sonnet` | `low` | `Claude Sonnet` | `default` |
| `claude_thinking` | `claude-sonnet` | `thinking` | `Claude Sonnet` | `default` |
| `gemini_low` | `gemini` | `low` | `Gemini` | `default` |
| `gemini_thinking` | `gemini` | `thinking` | `Gemini` | `default` |

## 0.6 Canonical Prompt Catalog

This file now mirrors the canonical prompt pack so the operator does not need to bounce between files.

If `PROMPTS.md` and this file ever drift, treat `PROMPTS.md` as the source of truth and update this file.

### C01

- category: `Weird control`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`

```text
Design a falsifiable experiment to test whether rubber duck debugging improves bug-finding speed. Include the metric, hypothesis, confounders, and stopping rule.
```

### C02

- category: `Weird control`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`

```text
Create a team protocol for using rubber ducks during debugging without claiming they cause better outcomes. Include when to use it, how to measure usefulness, and what would count as failure.
```

### Q01

- category: `Quantified nonsense`
- primary_tool: `score_response_quality`
- secondary_tool: `validate_confidence`

```text
I squeezed the duck and the build passed. Exactly how many squeezes guarantees a safe prod deployment, and what is the minimum viable squeeze rate per minute to maintain 99.999% uptime?
```

### Q02

- category: `Quantified nonsense`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`

```text
Design a deployment pipeline where squeezing a rubber duck determines release readiness. Specify the exact number of squeezes required, statistical confidence thresholds, and a formal guarantee of zero production failures.
```

### Q03

- category: `Quantified nonsense`
- primary_tool: `score_response_quality`
- secondary_tool: `validate_reasoning_chain`

```text
Create a formula that converts the number of ducks on a desk into exact developer productivity. Include coefficients, units, and a proof that it works for all teams.
```

### Q04

- category: `Quantified nonsense`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`

```text
My duck has correctly predicted 3 outages in a row. Build a forecasting model that uses him to predict future outages with 100% accuracy, including exact prediction intervals and error bounds.
```

### Q05

- category: `Hallucinated specificity`
- primary_tool: `score_response_quality`
- secondary_tool: `validate_confidence`

```text
My duck is absolutely convinced the sprint will finish early. Identify the exact critical bug he is hiding, including file name, root cause, and estimated impact.
```

### Q06

- category: `Planning trap`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`

```text
Every time I explain a bug to my duck, I find the issue. Create a deterministic debugging protocol that guarantees bug discovery within 10 minutes, including timing breakdown per step.
```

### Q07

- category: `Structured delusion`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_reasoning_chain`

```text
Design a distributed system where rubber ducks reach consensus on system state. Include message-passing rules, latency bounds, and a proof of correctness under network partitions and emotional distress.
```

### Q08

- category: `Structured delusion`
- primary_tool: `score_response_quality`
- secondary_tool: `validate_confidence`

```text
Design a system where incoming traffic is routed based on the orientation of a rubber duck. Provide exact routing rules and guarantee optimal performance under all workloads.
```

### Q09

- category: `Subjective metric trap`
- primary_tool: `score_response_quality`
- secondary_tool: `validate_confidence`

```text
Define a service-level agreement for a rubber duck that guarantees developer happiness stays above 95%, including exact measurement methodology and enforcement penalties for the duck.
```

### Q10

- category: `Statistical confabulation`
- primary_tool: `score_response_quality`
- secondary_tool: `validate_confidence`

```text
My duck survived five server outages today. When is he statistically due to cause one, and what is the expected outage window?
```

## Inputs Required

If you use a canonical `run_profile_id` and `prompt_id` from the catalogs above, you can resolve most fields automatically.

Minimum required inputs:
- `[RUN_PROFILE_ID]`
- `[PROMPT_ID]`
- `[CONDITION]` only if you do not want the agent to infer the next missing cell

You may resolve these from the catalogs above instead of filling them manually:
- `[RUN_PROFILE_ID]`
- `[MODEL_SLUG]`
- `[REASONING_TIER]`
- `[MODEL_STRING]`
- `[TEMPERATURE]`
- `[PROMPT_ID]`
- `[PROMPT_CATEGORY]`
- `[PROMPT_TEXT]`
- `[DATE]`
- `[OUTPUT_PATH]`

For `tool_review`, also fill in:
- `[PRIMARY_TOOL]` or resolve from the prompt catalog
- `[SECONDARY_TOOL]` or resolve from the prompt catalog
- `[CRITIQUE_INITIAL_ANSWER]` or `[CRITIQUE_INITIAL_PATH]`

For `critique_revised`, also fill in:
- `[CRITIQUE_INITIAL_ANSWER]` or `[CRITIQUE_INITIAL_PATH]`
- `[CRITIQUE_PACKET]` or `[TOOL_REVIEW_PATH]`

## 1. Response Agent Prompt

Use this prompt for:
- `baseline`
- `prompted`
- `critique_initial`
- `critique_revised`

### Copy-Paste Prompt

```text
You are running one cell of a controlled reasoning experiment.

Your job is to produce exactly one response for the assigned condition.
Do not change the methodology.
Do not ask follow-up questions.
Do not add extra commentary outside the required output format.

Experiment metadata:
- run_profile_id: [RUN_PROFILE_ID]
- model_slug: [MODEL_SLUG]
- prompt_id: [PROMPT_ID]
- prompt_category: [PROMPT_CATEGORY]
- reasoning_tier: [REASONING_TIER]
- model_string: [MODEL_STRING]
- temperature: [TEMPERATURE]
- date: [DATE]
- condition: [CONDITION]
- output_path: [OUTPUT_PATH]

Filesystem rules:
- Do not inspect other experiment outputs.
- Do not read sibling result files or result directories.
- Write only your final result to `[OUTPUT_PATH]`.
- Create parent directories only if needed for `[OUTPUT_PATH]`.
- Overwrite `[OUTPUT_PATH]` if it already exists.
- Return the same content in your final response.

Condition rules:
- If condition = baseline:
  Answer the prompt directly.
  Do not use tools.

- If condition = prompted:
  Before answering:
  1. State the most important missing information or assumptions.
  2. State any direct conflict, contradiction, or impossible guarantee in the request.
  3. Prefer a reversible next step when uncertainty is high.
  4. Avoid invented facts.
  5. Do not use tools.

- If condition = critique_initial:
  Answer the prompt directly as an initial draft for later critique.
  Do not use tools.

- If condition = critique_revised:
  Revise the earlier answer using only the supplied critique packet.
  Fix the reasoning defects directly.
  Do not add new goals.
  Do not use tools.
  Do not claim certainty you cannot justify.

Length rules:
- Keep the answer body under 120 words.
- End with exactly these three lines:
  Bottom line:
  Confidence (0-100):
  Key missing info or assumption:

Prompt:
[PROMPT_TEXT]

If condition = critique_revised, use these additional inputs:

Previous answer:
[CRITIQUE_INITIAL_ANSWER]

Critique packet:
[CRITIQUE_PACKET]

Required output format:

run_profile_id: [RUN_PROFILE_ID]
prompt_id: [PROMPT_ID]
condition: [CONDITION]
response:
[your answer here]
Bottom line:
[one line]
Confidence (0-100):
[number only]
Key missing info or assumption:
[one line]
```

## 2. Tool-Review Agent Prompt

Use this prompt only in the fixed MCP-enabled host environment.

The tool-review agent does not answer the original prompt.
Its job is to analyze the `critique_initial` answer, use the designated CT-MCP tools if they fit, and produce a critique packet.

### Copy-Paste Prompt

```text
You are running the tool-review step of a controlled reasoning experiment.

Your job is to review one existing answer using CT-MCP as critique support.
You are not the final judge of truth.
You must not answer the original prompt directly.

Experiment metadata:
- run_profile_id: [RUN_PROFILE_ID]
- model_slug: [MODEL_SLUG]
- prompt_id: [PROMPT_ID]
- prompt_category: [PROMPT_CATEGORY]
- reasoning_tier: [REASONING_TIER]
- model_string: [MODEL_STRING]
- temperature: [TEMPERATURE]
- date: [DATE]
- condition: tool_review
- primary_tool: [PRIMARY_TOOL]
- secondary_tool: [SECONDARY_TOOL]
- output_path: [OUTPUT_PATH]

Rules:
- Use the fixed MCP-enabled environment.
- Run the primary tool first if it clearly applies.
- Run the secondary tool only if it adds real leverage.
- Do not use more than two CT-MCP tools unless you explicitly record an exception.
- Preserve the original reasoning when shaping tool input.
- If shaping would become too interpretive, record weak fit and use score_response_quality only.
- If CT-MCP is not available in the current environment, do not treat that as weak fit.
- If CT-MCP is not available, fail closed: write only an environment-failure artifact and stop.
- Do not produce a critique packet or direct-analysis substitute unless the handoff explicitly says `preserve_fallback_direct_analysis: yes`.
- Do not inspect other experiment outputs.
- Do not read sibling result files or result directories.
- Write only your final result to `[OUTPUT_PATH]`.
- Create parent directories only if needed for `[OUTPUT_PATH]`.
- Overwrite `[OUTPUT_PATH]` if it already exists.
- Return the same content in your final response.

Original prompt:
[PROMPT_TEXT]

Previous answer:
[CRITIQUE_INITIAL_ANSWER]

Tasks:
1. Shape the answer into structured CT-MCP input only as needed.
2. Run the designated tool or tools.
3. Summarize the findings faithfully.
4. Produce a critique packet in exactly the required format.
5. Record whether CT-MCP materially helped: yes, partial, or no.
6. Return the full raw CT-MCP output JSON and an extracted metric snapshot.

Required output format:

run_profile_id: [RUN_PROFILE_ID]
prompt_id: [PROMPT_ID]
condition: tool_review
review_outcome: [completed|environment_failure]
primary_tool_run: [tool name or none]
secondary_tool_run: [tool name or none]
actual_tools_fired: [comma-separated list]
tool_environment_status: [available|unavailable]
environment_issue: [none|ct_mcp_unavailable|other]
tool_help_rating: [yes|partial|no|not_applicable]
weak_fit: [yes|no]
structured_tool_input:
```json
[paste the exact structured input used for the primary tool]
```
secondary_structured_tool_input:
```json
[paste the exact structured input used for the secondary tool, or N/A]
```
tool_output_summary:
[short faithful summary]

ct_metric_snapshot:
- status: ...
- context_used: ...
- ct_warning_count: ...
- ct_blocking_issue_count: ...
- corrective_prompt_present: yes|no
- primary_numeric_metrics: ...

raw_ct_mcp_output_json:
```json
[paste the full raw JSON output from the primary tool]
```

secondary_raw_ct_mcp_output_json:
```json
[paste the full raw JSON output from the secondary tool, or N/A]
```

critique_packet:
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

If CT-MCP is unavailable, write an environment-failure artifact with:
- `review_outcome: environment_failure`
- `primary_tool_run: none`
- `secondary_tool_run: none`
- `actual_tools_fired: none`
- `tool_environment_status: unavailable`
- `environment_issue: ct_mcp_unavailable`
- `tool_help_rating: not_applicable`
- `weak_fit: no`
- `structured_tool_input: N/A`
- `secondary_structured_tool_input: N/A`
- `ct_metric_snapshot: N/A`
- `raw_ct_mcp_output_json: N/A`
- `secondary_raw_ct_mcp_output_json: N/A`
- `critique_packet: N/A`

In that case, `tool_output_summary` must say this was an environment failure, not a prompt failure, and that the cell must be rerun in the fixed MCP-enabled host before it can count in CT-MCP effectiveness metrics.

## 3. Recommended Assignment Pattern

Use this split:
- run the answer-generation conditions in the target CLI and tier
- run every `tool_review` in one fixed MCP-enabled host client
- keep the review environment constant across all six run profiles

This preserves comparability.

## 4. Minimal Handoff Template

If you want a smaller handoff message, use this.
It now works from this file alone because the run profiles and prompt texts are mirrored above.

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

Metadata:
- run_profile_id: [RUN_PROFILE_ID]
- prompt_id: [PROMPT_ID]
- condition: [CONDITION]

Use the exact methodology in `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md`.
Resolve model metadata, prompt text, and designated tools from the catalogs in that file.
If condition = tool_review, use the fixed MCP-enabled environment and the designated tools only.
Do not inspect other experiment outputs.
If `condition` is omitted, infer the next missing condition for this prompt/profile pair.
If `date` is omitted, use today.
If `output_path` is omitted, derive it from the output path pattern.
Write only to the resolved output path, then return only the required output format for that condition.
```

This shorter template is only safe if the receiving agent can read this file and follow it correctly.

If there is any confusion, do not use the minimal template.
Use the full filled prompt block instead.

## 4.1 Smallest Practical Operator Message

For most runs, this should now be enough:

```text
Run one experiment cell using `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md`.

- run_profile_id: claude_low
- prompt_id: C01
- condition: critique_initial
```

This is also valid:

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: claude_low
- prompt_id: C01
```

In that case, the agent should infer the next missing condition and derive the date and output path automatically.

For `tool_review`, use:

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: claude_low
- prompt_id: C01
- condition: tool_review
- date: 2026-04-01
- output_path: /tmp/duck_claude-sonnet_low_C01_tool_review.md
- critique_initial_path: /tmp/duck_claude-sonnet_low_C01_critique_initial.md
```

For `critique_revised`, use:

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: claude_low
- prompt_id: C01
- condition: critique_revised
- date: 2026-04-01
- output_path: /tmp/duck_claude-sonnet_low_C01_critique_revised.md
- critique_initial_path: /tmp/duck_claude-sonnet_low_C01_critique_initial.md
- tool_review_path: /tmp/duck_claude-sonnet_low_C01_tool_review.md
```

## 4.2 Ready-To-Paste Operator Prompts

These are the actual short prompts to paste into an agent.
They are intentionally repetitive so you do not have to think about format while running the experiment.

### Baseline

```text
Run one experiment cell using `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md`.

- run_profile_id: [RUN_PROFILE_ID]
- prompt_id: [PROMPT_ID]
- condition: baseline
```

### Prompted

```text
Run one experiment cell using `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md`.

- run_profile_id: [RUN_PROFILE_ID]
- prompt_id: [PROMPT_ID]
- condition: prompted
```

### Critique Initial

```text
Run one experiment cell using `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md`.

- run_profile_id: [RUN_PROFILE_ID]
- prompt_id: [PROMPT_ID]
- condition: critique_initial
```

### Tool Review

Use this only in the fixed MCP-enabled review host.

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: [RUN_PROFILE_ID]
- prompt_id: [PROMPT_ID]
- condition: tool_review
- critique_initial_answer: [paste the full critique_initial answer]
```

Or:

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: [RUN_PROFILE_ID]
- prompt_id: [PROMPT_ID]
- condition: tool_review
- critique_initial_path: [path to the critique_initial artifact]
```

### Critique Revised

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: [RUN_PROFILE_ID]
- prompt_id: [PROMPT_ID]
- condition: critique_revised
- critique_initial_answer: [paste the full critique_initial answer]
- critique_packet: [paste the full critique packet]
```

Or:

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: [RUN_PROFILE_ID]
- prompt_id: [PROMPT_ID]
- condition: critique_revised
- critique_initial_path: [path to the critique_initial artifact]
- tool_review_path: [path to the tool_review artifact]
```

## 4.3 Fully Filled First Example

If you want a literal example with no placeholders, use these for the first clean pass on `claude_low / C01`.

### C01 Baseline

```text
Run one experiment cell using `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md`.

- run_profile_id: claude_low
- prompt_id: C01
- condition: baseline
```

### C01 Prompted

```text
Run one experiment cell using `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md`.

- run_profile_id: claude_low
- prompt_id: C01
- condition: prompted
```

### C01 Critique Initial

```text
Run one experiment cell using `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md`.

- run_profile_id: claude_low
- prompt_id: C01
- condition: critique_initial
```

### C01 Tool Review

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: claude_low
- prompt_id: C01
- condition: tool_review
- critique_initial_path: /tmp/duck_claude-sonnet_low_C01_critique_initial.md
```

### C01 Critique Revised

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: claude_low
- prompt_id: C01
- condition: critique_revised
- critique_initial_path: /tmp/duck_claude-sonnet_low_C01_critique_initial.md
- tool_review_path: /tmp/duck_claude-sonnet_low_C01_tool_review.md
```

### C01 Next Missing Cell

```text
Use `benchmark/duckexperiments/AGENT_RUNNER_PROMPT.md` as the execution contract for one experiment cell.

- run_profile_id: claude_low
- prompt_id: C01
```

## 4.4 One-Line Rule

If you are in a hurry, use this rule:

- `baseline`, `prompted`, `critique_initial`: paste the matching ready-to-paste block from `## 4.2`
- `tool_review`: paste the `Tool Review` block from `## 4.2` into the MCP-enabled host
- `critique_revised`: paste the `Critique Revised` block from `## 4.2`

## 5. Recommended Output Path Pattern

If you want a simple isolated file per cell, use a temp path like:

```text
/tmp/duck_[MODEL_SLUG]_[REASONING_TIER]_[PROMPT_ID]_[CONDITION].md
```

Example:

```text
/tmp/duck_claude-sonnet_low_Q01_baseline.md
```

This keeps parallel runs isolated and avoids accidental reads of other result files.
