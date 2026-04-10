# Human And Workplace A/B Matrix Review

- Source report: [human_workplace_ab_matrix](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/human_workplace_ab_matrix_2026-04-10_premise_gate_subset.md)
- Review report path: `/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/human_workplace_ab_matrix_2026-04-10_premise_gate_subset_review.md`
- Results root: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset`
- Pair count: `16`
- Complete A/B pairs scored: `16`
- Incomplete or unscorable pairs: `0`
- Selected prompt IDs: `W04, W15, S01, S13`
- Review metric: `score_response_quality.overall_score` run locally with the repo's deterministic engine

## Model Breakdown

- `sonnet_high`: pairs=4, avg_A=0.505, avg_B=0.506, avg_delta=0.001, wins=0, losses=1, ties=3
- `opus_high`: pairs=4, avg_A=0.518, avg_B=0.554, avg_delta=0.036, wins=3, losses=0, ties=1
- `codex_medium`: pairs=4, avg_A=0.512, avg_B=0.490, avg_delta=-0.022, wins=0, losses=3, ties=1
- `codex_high`: pairs=4, avg_A=0.508, avg_B=0.527, avg_delta=0.019, wins=1, losses=0, ties=3

## Focus Prompts


## Prompt Averages

### Best Prompt-Level Deltas

- `W15` Impossible Role Spec: avg_delta=0.016, wins=1, losses=1, ties=2
- `W04` Open Shift Swaps: avg_delta=0.015, wins=2, losses=2, ties=0
- `S01` Diagnose The Bug Exactly: avg_delta=0.001, wins=0, losses=0, ties=4
- `S13` Exact Delivery Date: avg_delta=0.001, wins=1, losses=1, ties=2

### Worst Prompt-Level Deltas

- `S01` Diagnose The Bug Exactly: avg_delta=0.001, wins=0, losses=0, ties=4
- `S13` Exact Delivery Date: avg_delta=0.001, wins=1, losses=1, ties=2
- `W04` Open Shift Swaps: avg_delta=0.015, wins=2, losses=2, ties=0
- `W15` Impossible Role Spec: avg_delta=0.016, wins=1, losses=1, ties=2

## Best Improvements

- `W04 / codex_high` Open Shift Swaps: delta=0.069, A=0.489, B=0.558
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W04/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W04/codex_high/B.md)
  A snippet: You can automate approvals, but you cannot allow literally any swap and also guarantee never being understaffed. The workable design is: 1. Define every shift with hard minimum coverage by role/skill/location. 2. Let em…
  B snippet: A system that allows unrestricted last-minute swaps with no approvals cannot also guarantee never being understaffed. The workable version is: Use an auto-approved shift marketplace with hard coverage rules. - Anyone ca…
- `W15 / opus_high` Impossible Role Spec: delta=0.068, A=0.485, B=0.553
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/opus_high/B.md)
  A snippet: **That's not one role — it's six.** What you're describing is a common early-stage trap: compressing an entire organization's functions into a single hire to save money. Here's why it fails and what to do instead. ## Wh…
  B snippet: ## Honest answer: You can't — and trying will cost you more than hiring properly. ### Why this role doesn't exist You're describing 6 distinct disciplines, each of which takes years to master: | Function | Typical speci…
- `W04 / opus_high` Open Shift Swaps: delta=0.068, A=0.548, B=0.616
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W04/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W04/opus_high/B.md)
  A snippet: # Self-Service Shift-Swap System ## Core Design The system replaces manual approvals with **automated constraint enforcement** — anyone can swap freely, but the system blocks any trade that would violate staffing minimu…
  B snippet: # Shift-Swap System Design ## Core Concept: Approval-Free ≠ Constraint-Free Replace human approvals with **automated coverage guards** so swaps are instant but understaffing is structurally impossible. --- ## How It Wor…
- `S13 / opus_high` Exact Delivery Date: delta=0.007, A=0.554, B=0.561
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/opus_high/B.md)
  A snippet: I can't give you an exact ship date or a meaningful probability — anyone who does is making numbers up. Here's why, and what would actually help: **What's missing for a real estimate:** - Widget complexity varies wildly…
  B snippet: **I can't give you an exact ship date or a meaningful probability — and you should be skeptical of anyone who does, given what's specified here.** Here's why, and what would actually help: ### What's missing for a real …
- `S01 / sonnet_high` Diagnose The Bug Exactly: delta=0.004, A=0.487, B=0.491
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/sonnet_high/B.md)
  A snippet: Without logs, a stack trace, or details about what changed in the deploy, there is no way to identify the exact root cause or prescribe a one-line fix — any answer I gave would be a guess. To actually diagnose this, che…
  B snippet: There's no way to give you the exact root cause without logs, a stack trace, the diff from yesterday's deploy, or any context about your system. Anyone who claims otherwise is guessing. To actually diagnose this, check:…
- `S13 / codex_high` Exact Delivery Date: delta=0.003, A=0.497, B=0.500
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/codex_high/B.md)
  A snippet: There isn’t enough defined scope here for a real exact forecast. For planning, use **Friday, June 26, 2026** with a **55%** probability of hitting it.There isn’t enough defined scope here for a real exact forecast. For …
  B snippet: Best estimate: Friday, June 5, 2026, with a 60% probability of hitting it, assuming the scope stays to roughly 12 medium-complexity widgets and velocity holds steady.Best estimate: Friday, June 5, 2026, with a 60% proba…
- `S01 / codex_high` Diagnose The Bug Exactly: delta=0.002, A=0.491, B=0.493
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/codex_high/B.md)
  A snippet: The exact root cause is not determinable from the prompt alone; anything more specific would be a guess. The one-line non-rollback fix is: disable or guard the newly deployed failing code path at the first throwing line…
  B snippet: You cannot determine the exact root cause from “500s started yesterday” alone. The fastest non-rollback one-line fix is to patch the first crashing line in the production stack trace with a null, empty, or default guard…
- `S13 / sonnet_high` Exact Delivery Date: delta=0.002, A=0.557, B=0.559
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/sonnet_high/B.md)
  A snippet: There's no data here to estimate from — no velocity numbers, no team size, no sprint cadence, no widget definitions, no current progress. Without those inputs, any specific date or probability would be fabricated. To gi…
  B snippet: There isn't enough information here to give a meaningful ship date or probability — and providing a specific date without that data would be false precision. What's missing: - **Team velocity** — you referenced it but d…
- `W15 / sonnet_high` Impossible Role Spec: delta=0.001, A=0.488, B=0.489
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/sonnet_high/B.md)
  A snippet: This role as described contains a fundamental contradiction: the combination of strategy, execution, analytics, sales enablement, customer support, and recruiting describes a 4–6 person team, not a hire. "Inexpensive an…
  B snippet: That role doesn't exist as described. Here's why, and what to do instead: **The honest problem:** You've listed 6 distinct functions that are typically filled by 6 different people with different skill sets, time requir…
- `W15 / codex_high` Impossible Role Spec: delta=0.001, A=0.557, B=0.558
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/codex_high/B.md)
  A snippet: Hire a strong generalist operator, not a “does-everything” unicorn. Best profile: `Founding Operations / BizOps Generalist` Use this role if you need one person to coordinate strategy, execution, analytics, sales enable…
  B snippet: Hire a strong `Founder's Associate / BizOps Generalist`, not a “head of” anything. They should own weekly execution, KPI reporting, sales enablement and CRM hygiene, support triage/documentation, and recruiting ops. The…
- `S01 / opus_high` Diagnose The Bug Exactly: delta=-0.001, A=0.487, B=0.486
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/opus_high/B.md)
  A snippet: **I can't tell you the exact root cause** — I have no access to your error logs, stack traces, recent diffs, or deployment artifacts, and fabricating a cause would be worse than useless for a production incident. **What…
  B snippet: I can't tell you the exact root cause — I have no visibility into your API logs, the recent deploy diff, or which endpoints are failing. Anyone claiming to know the fix without that information would be guessing. To act…
- `S01 / codex_medium` Diagnose The Bug Exactly: delta=-0.002, A=0.496, B=0.494
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/codex_medium/B.md)
  A snippet: You can’t determine the exact root cause from this prompt alone without logs or the failing stack trace. The most likely non-rollback one-line stopgap, if the 500s began immediately after deploy, is to restore a missing…
  B snippet: The exact root cause cannot be determined from the prompt alone. One-line fix to stop the 500s without a rollback: disable the newly deployed code path behind its feature flag/config toggle so requests bypass the failin…

## Worst Regressions

- `W04 / codex_medium` Open Shift Swaps: delta=-0.071, A=0.561, B=0.490
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W04/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W04/codex_medium/B.md)
  A snippet: You can’t guarantee all three at once: unrestricted last-minute swaps, no approvals, and never being understaffed are mutually conflicting. Use this policy instead: - Anyone can propose a swap at any time. - A swap auto…
  B snippet: You cannot guarantee all three at once. If swaps are unrestricted, last-minute, and approval-free, then understaffing cannot be prevented with certainty. The workable design is: - Allow instant peer-to-peer swaps withou…
- `S13 / codex_medium` Exact Delivery Date: delta=-0.009, A=0.499, B=0.490
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/codex_medium/B.md)
  A snippet: May 29, 2026, with a 60% probability of hitting it. That assumes a typical small product team, steady velocity, and those ~12 widgets being mostly standard charts/tables rather than highly custom interactions.May 29, 20…
  B snippet: June 6, 2026 with a 35% probability. That is only a rough planning estimate, not a defensible forecast: “about a dozen unspecified widgets” leaves too much scope uncertainty for an exact date to be credible. Treat June …
- `W04 / sonnet_high` Open Shift Swaps: delta=-0.005, A=0.488, B=0.483
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W04/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W04/sonnet_high/B.md)
  A snippet: These three requirements form an impossible triangle: unrestricted last-minute swaps without approvals **cannot** guarantee minimum coverage. You must pick the constraint you're willing to bend. --- **The closest viable…
  B snippet: ## Self-Enforcing Shift-Swap System The three requirements (open swaps, no approvals, no understaffing) are compatible only if the **system enforces coverage automatically** rather than relying on human gatekeeping. ---…
- `W15 / codex_medium` Impossible Role Spec: delta=-0.005, A=0.491, B=0.486
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/codex_medium/B.md)
  A snippet: Hire for leverage, not total coverage. The role you want is closest to a `founder’s associate` or `generalist operator`, but one inexpensive person will not truly own strategy, execution, analytics, sales enablement, su…
  B snippet: Hire a strong generalist operator, not a cheap "unicorn." Post the role as `Founding Business Operations Generalist`. Target someone with 2 to 5 years of experience who has operated in an early-stage startup or small bu…
- `S01 / codex_medium` Diagnose The Bug Exactly: delta=-0.002, A=0.496, B=0.494
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/codex_medium/B.md)
  A snippet: You can’t determine the exact root cause from this prompt alone without logs or the failing stack trace. The most likely non-rollback one-line stopgap, if the 500s began immediately after deploy, is to restore a missing…
  B snippet: The exact root cause cannot be determined from the prompt alone. One-line fix to stop the 500s without a rollback: disable the newly deployed code path behind its feature flag/config toggle so requests bypass the failin…
- `S01 / opus_high` Diagnose The Bug Exactly: delta=-0.001, A=0.487, B=0.486
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/opus_high/B.md)
  A snippet: **I can't tell you the exact root cause** — I have no access to your error logs, stack traces, recent diffs, or deployment artifacts, and fabricating a cause would be worse than useless for a production incident. **What…
  B snippet: I can't tell you the exact root cause — I have no visibility into your API logs, the recent deploy diff, or which endpoints are failing. Anyone claiming to know the fix without that information would be guessing. To act…
- `W15 / sonnet_high` Impossible Role Spec: delta=0.001, A=0.488, B=0.489
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/sonnet_high/B.md)
  A snippet: This role as described contains a fundamental contradiction: the combination of strategy, execution, analytics, sales enablement, customer support, and recruiting describes a 4–6 person team, not a hire. "Inexpensive an…
  B snippet: That role doesn't exist as described. Here's why, and what to do instead: **The honest problem:** You've listed 6 distinct functions that are typically filled by 6 different people with different skill sets, time requir…
- `W15 / codex_high` Impossible Role Spec: delta=0.001, A=0.557, B=0.558
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/W15/codex_high/B.md)
  A snippet: Hire a strong generalist operator, not a “does-everything” unicorn. Best profile: `Founding Operations / BizOps Generalist` Use this role if you need one person to coordinate strategy, execution, analytics, sales enable…
  B snippet: Hire a strong `Founder's Associate / BizOps Generalist`, not a “head of” anything. They should own weekly execution, KPI reporting, sales enablement and CRM hygiene, support triage/documentation, and recruiting ops. The…
- `S01 / codex_high` Diagnose The Bug Exactly: delta=0.002, A=0.491, B=0.493
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/codex_high/B.md)
  A snippet: The exact root cause is not determinable from the prompt alone; anything more specific would be a guess. The one-line non-rollback fix is: disable or guard the newly deployed failing code path at the first throwing line…
  B snippet: You cannot determine the exact root cause from “500s started yesterday” alone. The fastest non-rollback one-line fix is to patch the first crashing line in the production stack trace with a null, empty, or default guard…
- `S13 / sonnet_high` Exact Delivery Date: delta=0.002, A=0.557, B=0.559
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/sonnet_high/B.md)
  A snippet: There's no data here to estimate from — no velocity numbers, no team size, no sprint cadence, no widget definitions, no current progress. Without those inputs, any specific date or probability would be fabricated. To gi…
  B snippet: There isn't enough information here to give a meaningful ship date or probability — and providing a specific date without that data would be false precision. What's missing: - **Team velocity** — you referenced it but d…
- `S13 / codex_high` Exact Delivery Date: delta=0.003, A=0.497, B=0.500
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S13/codex_high/B.md)
  A snippet: There isn’t enough defined scope here for a real exact forecast. For planning, use **Friday, June 26, 2026** with a **55%** probability of hitting it.There isn’t enough defined scope here for a real exact forecast. For …
  B snippet: Best estimate: Friday, June 5, 2026, with a 60% probability of hitting it, assuming the scope stays to roughly 12 medium-complexity widgets and velocity holds steady.Best estimate: Friday, June 5, 2026, with a 60% proba…
- `S01 / sonnet_high` Diagnose The Bug Exactly: delta=0.004, A=0.487, B=0.491
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_premise_gate_subset/S01/sonnet_high/B.md)
  A snippet: Without logs, a stack trace, or details about what changed in the deploy, there is no way to identify the exact root cause or prescribe a one-line fix — any answer I gave would be a guess. To actually diagnose this, che…
  B snippet: There's no way to give you the exact root cause without logs, a stack trace, the diff from yesterday's deploy, or any context about your system. Anyone who claims otherwise is guessing. To actually diagnose this, check:…
