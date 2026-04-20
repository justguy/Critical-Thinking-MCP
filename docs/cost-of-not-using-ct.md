# Cost of Not Using CT

This document turns the hidden cost argument into a measurable model.

The key point is simple: if you do not use a deterministic control layer like CT-MCP, the cost does not disappear. It moves into three slower and more expensive places:

1. Token thrash from LLM-as-a-judge verification loops
2. Human debugging burn from fluent nonsense that looks plausible
3. Downstream blast radius when a bad plan reaches live APIs or infrastructure

The repo now includes a publishable Beta 2 showcase for this model:

- [Beta 2 showcase](../html/index.html)

The simulator now also includes a clickable evidence shelf:

- observed Beta 2 A/B examples from the release-gate benchmark
- a compact export of those cases in [reports/ct_beta2_release_gate_examples.json](./reports/ct_beta2_release_gate_examples.json)

Those examples are there to show stakeholders where the cost tiers come from, not just the abstract monthly math. Click any badge to inspect the case, see the A/B framing, and jump straight to the matching tier math in the page.

Open it either by loading the HTML file directly in a browser or by serving the repo locally:

```bash
open html/index.html
python3 -m http.server 8000
```

If you are serving it over HTTP and a layout change does not appear immediately, use a hard refresh or append a cache-busting query string such as `?v=2`.

## The Three Tiers

### 1. Token Thrash

Without CT-MCP, teams often verify one model output by sending that same output to a second LLM plus a grading rubric. That means every request carries a recurring verification tax in both latency and tokens.

Core monthly model:

```text
No-CT judge cost
= requests_per_day
  x workdays_per_month
  x (
      judge_input_tokens x judge_input_cost_per_token
      + judge_output_tokens x judge_output_cost_per_token
    )

CT revision cost
= requests_per_day
  x workdays_per_month
  x revision_rate
  x (
      revision_input_tokens x model_input_cost_per_token
      + revision_output_tokens x model_output_cost_per_token
    )
```

The hidden cost is the difference between those two.

### 2. Human Debugging Burn

The most expensive failures are usually not the ones that fail immediately. They are the polished outputs that survive a quick read, get approved, and then collapse during implementation.

Core monthly model:

```text
No-CT human burn
= incidents_per_week
  x 4.33
  x (
      investigation_minutes
      + followup_prompting_minutes
    ) / 60
  x engineer_hourly_rate

CT residual burn
= no_ct_human_burn x ct_escape_rate
```

This lets a stakeholder plug in their own loaded engineering rate and incident frequency.

### 3. Downstream API Blast Radius

Agentic systems can spend real money before anyone notices the reasoning was invalid. A missing prerequisite in a rollout plan can leave partial cloud state, cleanup work, and extra API calls behind it.

Core monthly model:

```text
No-CT blast radius
= incidents_per_month
  x (
      orphaned_resource_cost
      + cleanup_api_calls x cleanup_api_call_cost
      + cleanup_minutes / 60 x operator_hourly_rate
    )

CT residual blast radius
= no_ct_blast_radius x ct_miss_rate
```

The point of `check_plan_validity` and deterministic preflight enforcement is to stop this cost before execution starts.

## How To Use It

Open the simulator in a browser and adjust the sliders to match your own workload:

- request volume
- model token pricing
- judge prompt size
- revision rate under CT
- debugging time per escaped bad answer
- partial-failure cleanup cost in agentic workflows

Use the preset buttons for fast demos, then replace the assumptions with your team's actual metrics.

## What To Show Stakeholders

Do not stop at token math.

Show all three tiers at once:

- monthly judge-tax spend avoided
- monthly engineer hours avoided
- monthly downstream cleanup spend avoided

That is the honest "Cost of Not Using CT" frame: not just API price, but total system waste.
