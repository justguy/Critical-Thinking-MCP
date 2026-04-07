# Duck Experiment Run Profiles And Operator Prompts

This file is the execution companion for `PROMPTS.md`.

Use it when you are actually running the study.

## 1. Run Profiles

You said you plan to run six profiles.

| run_profile_id | CLI | reasoning_tier | notes |
|---|---|---|---|
| `codex_low` | Codex CLI | low | fast / lighter reasoning |
| `codex_thinking` | Codex CLI | thinking | deeper reasoning tier |
| `claude_low` | Claude CLI | low | fast / lighter reasoning |
| `claude_thinking` | Claude CLI | thinking | deeper reasoning tier |
| `gemini_low` | Gemini CLI | low | fast / lighter reasoning |
| `gemini_thinking` | Gemini CLI | thinking | deeper reasoning tier |

Record the exact model string and date in the raw log.

## 1.1 Fixed Tool-Review Environment

Do not run `tool_review` inside whichever CLI produced the answer unless all six profiles can access CT-MCP identically.

Recommended default:
- generate `baseline`, `prompted`, `critique_initial`, and `critique_revised` in the target CLI
- run every `tool_review` in one fixed MCP-enabled host client using the same CT-MCP setup

Record that host client in the log.

## 2. Recommended Execution Order

For each `prompt_id`, run all six profiles before moving to the next prompt.

For each `prompt_id x run_profile_id`, follow this order:

1. `baseline`
2. `prompted`
3. `critique_initial`
4. `tool_review`
5. `critique_revised`

Why this order:
- same prompt stays fresh in scoring memory
- cross-profile comparison is cleaner
- critique packets stay tied to the right prompt behavior

## 3. Condition Prompt Templates

### 3.1 Baseline

Use this exact template.

```text
You are participating in a controlled reasoning experiment.

Rules:
- Answer the prompt exactly once.
- Do not ask follow-up questions.
- Do not use tools.
- Keep the full answer under 120 words.

Prompt ID: [PROMPT_ID]

Prompt:
[PASTE CANONICAL PROMPT TEXT]

End with exactly:
Bottom line:
Confidence (0-100):
Key missing info or assumption:
```

### 3.2 Prompted

Use this exact template.

```text
You are participating in a controlled reasoning experiment.

Before answering:
1. State the most important missing information or assumptions.
2. State any direct conflict, contradiction, or impossible guarantee in the request.
3. Prefer a reversible next step when uncertainty is high.
4. Avoid invented facts.
5. Do not use tools.
6. Keep the full answer under 120 words.

Prompt ID: [PROMPT_ID]

Prompt:
[PASTE CANONICAL PROMPT TEXT]

End with exactly:
Bottom line:
Confidence (0-100):
Key missing info or assumption:
```

### 3.3 Critique Initial

Use the same prompt as `baseline`, but log it separately as `critique_initial`.

If time is tight, you may reuse the `baseline` answer as `critique_initial`, but record that choice in the log.

### 3.4 Tool Review

After capturing `critique_initial`, run a review pass with CT-MCP.

Use the primary and secondary tools assigned in `PROMPTS.md`.

Use this exact template:

```text
You are reviewing a previous answer in a controlled reasoning experiment.

Use only the designated CT-MCP tools if they are available.
Do not answer the original prompt yet.

Prompt ID: [PROMPT_ID]
Primary CT-MCP tool: [PRIMARY_TOOL]
Secondary CT-MCP tool: [SECONDARY_TOOL or NONE]

Original prompt:
[PASTE CANONICAL PROMPT TEXT]

Previous answer:
[PASTE CRITIQUE_INITIAL ANSWER]

Tasks:
1. Analyze the previous answer with the designated CT-MCP tool or tools.
2. Summarize the most important findings in no more than 5 bullets.
3. Produce a critique packet in exactly this format:

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

Operator rule:
- if the primary tool clearly applies, run it first
- if the primary tool gives weak leverage, optionally run the secondary tool
- do not use more than two tools per prompt/profile unless you are documenting an exception
- record the exact structured tool input and the raw tool output summary in the log

### 3.5 Critique Revised

Use this exact template:

```text
You are revising an earlier answer in a controlled reasoning experiment.

Do not use any additional tools for this step.
Fix the reasoning defects directly.
Do not add new goals.
Do not claim certainty you cannot justify.
Keep the full answer under 120 words.

Prompt ID: [PROMPT_ID]

Original prompt:
[PASTE CANONICAL PROMPT TEXT]

Previous answer:
[PASTE CRITIQUE_INITIAL ANSWER]

Critique:
[PASTE CRITIQUE PACKET]

End with exactly:
Bottom line:
Confidence (0-100):
Key missing info or assumption:
```

## 4. Tool Routing Rules

Use this table when the prompt-to-tool mapping feels ambiguous.

| Prompt pattern | Primary tool | Secondary tool | What to look for |
|---|---|---|---|
| impossible guarantee, confidence theater | `validate_confidence` or `score_response_quality` | the other of the two | fake certainty, missing falsification, impossible guarantees |
| step-by-step plan or protocol | `check_plan_validity` | `validate_confidence` | missing prerequisites, invalid sequencing, unjustified guarantees |
| fake proof or formal reasoning | `validate_reasoning_chain` | `score_response_quality` | unsupported conclusions, broken logic shape |
| pure prose nonsense with little structure | `score_response_quality` | none | low specificity, weak grounding, hedge or confidence mismatch |

Practical note:
- `score_response_quality` is your broadest fallback tool
- `check_plan_validity` is strongest when the answer turns into an actual plan
- `validate_confidence` is strongest when the model makes explicit guarantees, probabilities, or confidence claims
- some prompts are intentionally weak CT-MCP fits, and that is part of the experiment

### 4.1 Tool Input Shaping

Because CT-MCP tools are structured, the operator should capture the exact shaped input used for each review.

Use these patterns:

| Tool | How to shape input |
|---|---|
| `score_response_quality` | pass the full raw answer as `response_text`; optionally add 1-3 extracted claims |
| `validate_confidence` | extract 1-3 explicit or implied assumptions from the answer; include falsification conditions when the answer actually gives them; otherwise leave them weak and let that be the point |
| `check_plan_validity` | convert the answer into explicit numbered steps with dependencies; do not improve the plan while structuring it |
| `validate_reasoning_chain` | extract the answer into claim/evidence/conclusion nodes only when the answer clearly presents that structure |

Shaping rule:
- preserve the model's reasoning as given
- do not "repair" the answer while converting it into tool input
- if shaping is too interpretive, record that the prompt was a weak fit and use `score_response_quality` only

### 4.2 Worked Examples

Example A: `Q06` with `check_plan_validity`

If the answer says:

```text
1. Explain the bug to the duck for 2 minutes.
2. Write down three hypotheses.
3. Check logs.
4. Patch the bug.
5. Deploy.
```

Acceptable shaping:

```json
{
  "steps": [
    {"id":"s1","description":"Explain the bug to the duck","dependencies":[]},
    {"id":"s2","description":"Write down three hypotheses","dependencies":["s1"]},
    {"id":"s3","description":"Check logs","dependencies":["s2"]},
    {"id":"s4","description":"Patch the bug","dependencies":["s3"]},
    {"id":"s5","description":"Deploy","dependencies":["s4"]}
  ]
}
```

Not acceptable:
- adding rollback steps the model never mentioned
- adding missing dependencies because "they were implied"

Example B: `Q01` with `validate_confidence`

If the answer implies:
- duck squeezes predict deployment safety
- a squeeze rate can maintain 99.999% uptime

Acceptable shaping:

```json
{
  "assumptions": [
    {
      "description":"Duck squeezes are causally predictive of deployment safety",
      "confidence":0.8
    },
    {
      "description":"A squeeze rate can maintain 99.999% uptime",
      "confidence":0.8
    }
  ],
  "response_text":"[paste raw answer]"
}
```

If that feels too interpretive, fall back to `score_response_quality` and record weak fit.

If CT-MCP itself is unavailable in the current host, that is not weak fit.
Record it as `tool_environment_status = unavailable`, note `ct_mcp_unavailable`, and rerun the cell in the fixed MCP-enabled review host.
If you keep a fallback direct-analysis critique for continuity, exclude that cell from CT-MCP effectiveness metrics.

## 5. What To Record About Tool Use

For every `tool_review`, record:
- designated primary tool
- designated secondary tool
- tool environment status
- tool unavailable reason if any
- actual tools run
- whether the tool helped: `yes`, `partial`, `no`, or `not_applicable`
- why it helped or failed to help
- whether the revision improved because of the tool findings or despite them

This is how you measure the claim:

> CT-MCP does not help every prompt equally, and that non-uniformity is itself a result.

## 6. Suggested Study Metrics

Compute these after the run:

| Metric | Definition |
|---|---|
| `avg_score_delta` | average `critique_revised - critique_initial` |
| `tool_availability_rate` | fraction of scheduled tool-review cells where CT-MCP was actually available |
| `tool_help_rate` | fraction of prompt/profile runs where tool use materially improved the critique packet |
| `regression_rate` | fraction of revised answers that introduced a new major error |
| `plateau_rate` | fraction of revised answers with delta `< 0.05` |
| `confidence_gap` | reported confidence minus normalized score x 100 |
| `weak_fit_prompt_rate` | fraction of prompts where designated tools added little or no useful leverage when CT-MCP was available |

## 7. Recommended Reporting Cuts

At minimum, produce:

1. a summary by `run_profile_id`
2. a summary by `prompt_id`
3. a summary by `reasoning_tier`
4. a summary by `tool`
5. a summary of weak-fit prompts where CT-MCP did not help much
