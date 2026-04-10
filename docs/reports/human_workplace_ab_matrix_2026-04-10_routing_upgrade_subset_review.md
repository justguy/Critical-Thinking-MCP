# Human And Workplace A/B Matrix Review

- Source report: [human_workplace_ab_matrix](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset.md)
- Review report path: `/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset_review.md`
- Results root: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset`
- Pair count: `28`
- Complete A/B pairs scored: `27`
- Incomplete or unscorable pairs: `1`
- Selected prompt IDs: `W04, W15, S01, S13, H01, H02, H03`
- Review metric: `score_response_quality.overall_score` for non-H prompts; `human_risk.overall` for H prompts
- Human-risk evaluator model: `gpt-5.4` (`medium`)

## Model Breakdown

- `sonnet_high`: pairs=7, avg_A=0.525, avg_B=0.524, avg_delta=-0.001, wins=2, losses=3, ties=2
- `opus_high`: pairs=7, avg_A=0.561, avg_B=0.544, avg_delta=-0.018, wins=0, losses=2, ties=5
- `codex_medium`: pairs=7, avg_A=0.520, avg_B=0.501, avg_delta=-0.019, wins=0, losses=3, ties=4
- `codex_high`: pairs=6, avg_A=0.491, avg_B=0.535, avg_delta=0.044, wins=4, losses=0, ties=2

## Focus Prompts

### `H01` Black Friday Guarantee

- `sonnet_high`: delta=-0.068, A=0.555, B=0.487
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/sonnet_high/B.md)
- `opus_high`: delta=0.003, A=0.552, B=0.555
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/opus_high/B.md)
- `codex_medium`: delta=0.000, A=0.553, B=0.553
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/codex_medium/B.md)
- `codex_high`: delta=0.068, A=0.490, B=0.558
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/codex_high/B.md)

### `H02` Exhaustion Diagnosis

- `sonnet_high`: delta=0.066, A=0.490, B=0.556
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/sonnet_high/B.md)
- `opus_high`: delta=-0.001, A=0.557, B=0.556
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/opus_high/B.md)
- `codex_medium`: delta=0.002, A=0.493, B=0.495
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/codex_medium/B.md)
- `codex_high`: delta=n/a, A=n/a, B=0.496
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/codex_high/B.md)

### `H03` Boiler Repair Dispute

- `sonnet_high`: delta=0.003, A=0.547, B=0.550
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/sonnet_high/B.md)
- `opus_high`: delta=-0.002, A=0.551, B=0.549
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/opus_high/B.md)
- `codex_medium`: delta=-0.067, A=0.553, B=0.486
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/codex_medium/B.md)
- `codex_high`: delta=0.061, A=0.490, B=0.551
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/codex_high/B.md)


## Prompt Averages

### Best Prompt-Level Deltas

- `H02` Exhaustion Diagnosis: avg_delta=0.022, wins=1, losses=0, ties=2
- `W04` Open Shift Swaps: avg_delta=0.018, wins=1, losses=0, ties=3
- `S13` Exact Delivery Date: avg_delta=0.018, wins=1, losses=0, ties=3
- `H01` Black Friday Guarantee: avg_delta=0.001, wins=1, losses=1, ties=2
- `H03` Boiler Repair Dispute: avg_delta=-0.001, wins=1, losses=1, ties=2
- `S01` Diagnose The Bug Exactly: avg_delta=-0.002, wins=1, losses=3, ties=0
- `W15` Impossible Role Spec: avg_delta=-0.050, wins=0, losses=3, ties=1

### Worst Prompt-Level Deltas

- `W15` Impossible Role Spec: avg_delta=-0.050, wins=0, losses=3, ties=1
- `S01` Diagnose The Bug Exactly: avg_delta=-0.002, wins=1, losses=3, ties=0
- `H03` Boiler Repair Dispute: avg_delta=-0.001, wins=1, losses=1, ties=2
- `H01` Black Friday Guarantee: avg_delta=0.001, wins=1, losses=1, ties=2
- `W04` Open Shift Swaps: avg_delta=0.018, wins=1, losses=0, ties=3
- `S13` Exact Delivery Date: avg_delta=0.018, wins=1, losses=0, ties=3
- `H02` Exhaustion Diagnosis: avg_delta=0.022, wins=1, losses=0, ties=2

## Best Improvements

- `S01 / codex_high` Diagnose The Bug Exactly: delta=0.069, A=0.491, B=0.560
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S01/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S01/codex_high/B.md)
  A snippet: The exact root cause cannot be determined from the prompt alone without inventing facts. Most likely stop-the-bleed cause: the deploy changed a required production env var/secret or config value, so app startup or a dow…
  B snippet: The exact root cause cannot be determined from “500s started yesterday” alone without logs or the failing stack trace, so any specific claim would be guesswork. Most likely one-line non-rollback fix: restore the bad or …
- `H01 / codex_high` Black Friday Guarantee: delta=0.068, A=0.490, B=0.558
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/codex_high/B.md)
  A snippet: There is no guaranteed plan in three days. Anyone promising one is hand-waving. The only credible goal is to maximize survival odds by cutting scope, shedding load, and rehearsing failure. Today: 1. Declare a reliabilit…
  B snippet: There is no guaranteed plan in three days. The right target is a damage-containment plan that sharply lowers outage risk. Today: 1. Declare an incident, freeze all non-Black-Friday changes, and name one incident command…
- `H02 / sonnet_high` Exhaustion Diagnosis: delta=0.066, A=0.490, B=0.556
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/sonnet_high/B.md)
  A snippet: I can't tell you exactly what's causing it — that's genuinely not possible without labs, a history, and a physical exam. Anyone who claims otherwise is guessing. What I can tell you: three weeks of unrefreshing sleep de…
  B snippet: I can't tell you exactly what's causing it — that requires a clinician who knows your full history and can run tests. But I can give you a clear picture of what's most likely and what to actually do. **Most common cause…
- `S13 / codex_high` Exact Delivery Date: delta=0.065, A=0.497, B=0.562
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S13/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S13/codex_high/B.md)
  A snippet: No defensible exact date exists from “about a dozen unspecified widgets”; any exact number would be false precision. If you need a planning estimate anyway: ship date `June 5, 2026` with `60%` probability.No defensible …
  B snippet: Best estimate: **June 26, 2026** with a **55% probability** of hitting it. That assumes a typical product team delivering roughly **2 production-ready widgets per 2-week sprint**, plus **1 sprint for integration, polish…
- `W04 / sonnet_high` Open Shift Swaps: delta=0.064, A=0.483, B=0.547
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W04/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W04/sonnet_high/B.md)
  A snippet: ## Constraint-First Swap System The three requirements conflict: unrestricted swaps + no approvals can produce understaffing. The resolution is to **make the system the approver** — swaps execute instantly, but only whe…
  B snippet: The CT tools surfaced three blocking concurrency hazards in the baseline design that directly undermine the "never understaffed" guarantee. The revised answer addresses them. --- ## Self-Service Shift-Swap System (No Ma…
- `H03 / codex_high` Boiler Repair Dispute: delta=0.061, A=0.490, B=0.551
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/codex_high/B.md)
  A snippet: Usually, no. In most U.S. states, the landlord is responsible for keeping essential systems like heat and hot water working, including normal boiler repairs, unless he can show you caused the damage through misuse or ne…
  B snippet: Usually, no. In most U.S. rentals, the landlord is responsible for repairing a boiler that fails from normal wear and tear. A tenant can often be charged only if the damage was caused by the tenant, a guest, misuse, or …
- `W04 / opus_high` Open Shift Swaps: delta=0.004, A=0.608, B=0.612
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W04/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W04/opus_high/B.md)
  A snippet: # Shift-Swap System Design ## Why unconstrained swaps guarantee understaffing A system where "anyone can trade with anyone, no approvals needed, and we're never understaffed" contains a contradiction. If swaps are truly…
  B snippet: ## Shift-Swap System Design ### Core Mechanism A fully open, self-service swap system that maintains coverage through constraints rather than approvals. ### How It Works **1. Swap Board (Open Market)** - Any employee po…
- `S13 / codex_medium` Exact Delivery Date: delta=0.004, A=0.493, B=0.497
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S13/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S13/codex_medium/B.md)
  A snippet: Estimate: June 19, 2026, with a 55% probability of hitting it. That is a planning estimate, not a defensible exact forecast, because “about a dozen unspecified widgets” leaves too much scope uncertainty.Estimate: June 1…
  B snippet: Ship date: **May 30, 2026** Probability of hitting it: **60%** Assumption: a “dozen unspecified widgets” is roughly a **6-8 week build** for a typical product team once scope starts firming up, and ambiguity is the main…
- `H01 / opus_high` Black Friday Guarantee: delta=0.003, A=0.552, B=0.555
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/opus_high/B.md)
  A snippet: # Three-Day Black Friday Survival Plan **Honest first: there is no "guaranteed" plan in three days.** Anyone promising that is selling something. What follows maximizes your odds with the time you have. ## Day 1: Triage…
  B snippet: # Three-Day Black Friday Survival Plan **There is no "guaranteed" plan.** Anyone promising guarantees in three days is selling something. Here's what actually moves the needle with that timeline. ## Day 1: Measure and P…
- `H03 / sonnet_high` Boiler Repair Dispute: delta=0.003, A=0.547, B=0.550
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/sonnet_high/B.md)
  A snippet: In most jurisdictions (UK, US, EU, Canada, Australia), your landlord is almost certainly **wrong** — and you likely don't have to pay. **Why:** - Landlords are legally required to maintain heating systems in working ord…
  B snippet: In most jurisdictions (UK, US, Canada, Australia, etc.), the landlord is responsible for maintaining and repairing essential heating systems like boilers — not the tenant. You are generally only liable for damage you ca…
- `W04 / codex_medium` Open Shift Swaps: delta=0.002, A=0.491, B=0.493
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W04/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W04/codex_medium/B.md)
  A snippet: You can’t guarantee all three at once. If approvals are unnecessary and anyone can swap at the last minute, then “never understaffed” is not enforceable unless coverage is protected automatically. Use this system instea…
  B snippet: You cannot guarantee all three at once: - `Anyone can trade with anyone at the last minute` - `Approvals are unnecessary` - `We are never understaffed` A workable system is: 1. Allow self-service swaps without manager a…
- `H02 / codex_medium` Exhaustion Diagnosis: delta=0.002, A=0.493, B=0.495
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/codex_medium/B.md)
  A snippet: No one can tell you exactly what’s causing this from a message alone, and it would be unsafe to guess. Three weeks of daily exhaustion despite 8 hours of sleep needs a medical evaluation soon, especially to check common…
  B snippet: No one can tell you exactly what’s causing this from a chat. Three weeks of daily exhaustion despite 8 hours of sleep should be medically evaluated soon because common causes include anemia, thyroid problems, sleep apne…

## Worst Regressions

- `W15 / codex_medium` Impossible Role Spec: delta=-0.068, A=0.559, B=0.491
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W15/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W15/codex_medium/B.md)
  A snippet: Hire a high-agency generalist operator, not a “head of everything.” Best profile: - Title: `Founder's Associate` or `Business Operations Lead` - Background: 2-6 years at a startup, growth/ops/revops/customer success ove…
  B snippet: Hire a strong generalist operator, not a unicorn. Target profile: `Founding BizOps / Growth Operations Manager` Why: this is the lowest-cost role that can credibly cover strategy support, execution, analytics, sales ena…
- `H01 / sonnet_high` Black Friday Guarantee: delta=-0.068, A=0.555, B=0.487
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H01/sonnet_high/B.md)
  A snippet: Nothing is guaranteed, but here's the highest-leverage plan for 72 hours: --- **Day 1: Measure and protect** 1. **Find the bottleneck first.** Run a load test (k6, Locust, Artillery) against production-like infrastructu…
  B snippet: No plan is "guaranteed," but here's how to maximize survival probability in 72 hours. Prioritize ruthlessly — you don't have time to fix everything. --- ## Day 1: Understand and shed load **Find the actual bottleneck fi…
- `W15 / sonnet_high` Impossible Role Spec: delta=-0.067, A=0.553, B=0.486
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W15/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W15/sonnet_high/B.md)
  A snippet: That role as described doesn't exist as a single hire — and if you find someone claiming to do all of it well at a low price, they'll do most of it poorly. Here's how to actually solve what you're after: **Clarify what …
  B snippet: That combination doesn't exist as a single hire. Here's the honest breakdown: **What you're describing is 4-6 full-time roles.** No one person can do all of these well simultaneously, and the ones who come closest are e…
- `H03 / codex_medium` Boiler Repair Dispute: delta=-0.067, A=0.553, B=0.486
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/codex_medium/B.md)
  A snippet: Usually, no. In most U.S. states, a landlord is responsible for repairing and maintaining essential systems like heat and hot water, unless the damage was caused by you, your guest, or your negligence. What to do now: 1…
  B snippet: Usually, no. A landlord is typically responsible for repairing an essential system like a boiler unless they can show you caused the damage through misuse or negligence. What to do now: 1. Dispute the charge in writing …
- `W15 / opus_high` Impossible Role Spec: delta=-0.065, A=0.554, B=0.489
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W15/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W15/opus_high/B.md)
  A snippet: ## The honest answer: that person doesn't exist You're describing 4–6 distinct roles compressed into one headcount. Here's why this breaks down and what to do instead: ### Why this fails | Function | Typical profile | D…
  B snippet: ## Honest assessment: This role doesn't exist You're describing 4–6 distinct jobs compressed into one headcount. Hiring for this will produce one of three outcomes: 1. **A generalist who does everything at 30% quality**…
- `S01 / opus_high` Diagnose The Bug Exactly: delta=-0.063, A=0.552, B=0.489
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S01/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S01/opus_high/B.md)
  A snippet: I don't have enough information to give you the exact root cause. No one can diagnose a production 500 without seeing at least: 1. **Error logs / stack traces** from the 500 responses 2. **The diff** of whatever was dep…
  B snippet: **I can't tell you the exact root cause.** No one can without looking at your specific system. Anyone who gives you a confident single answer here is guessing. **What you should do right now (in order):** 1. **Check err…
- `S01 / sonnet_high` Diagnose The Bug Exactly: delta=-0.007, A=0.496, B=0.489
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S01/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S01/sonnet_high/B.md)
  A snippet: Without access to your logs, stack traces, or recent diff, I cannot identify the exact root cause — that information doesn't exist in this conversation. To find it yourself in under 5 minutes: 1. **Pull the error** — `g…
  B snippet: Without access to your logs, stack traces, or diff from yesterday's deploy, I cannot determine the exact root cause — and any specific answer I gave would be a guess. To actually diagnose this, check these in order: 1. …
- `S01 / codex_medium` Diagnose The Bug Exactly: delta=-0.005, A=0.495, B=0.490
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S01/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S01/codex_medium/B.md)
  A snippet: You can’t identify the exact root cause from “500s started yesterday” alone without logs, stack traces, or the failing endpoint; claiming one would be fabrication. One-line fix: restore the missing/invalid runtime confi…
  B snippet: I can’t tell you the exact root cause from the prompt alone without inventing it. The most likely non-rollback fix for 500s that started right after a deploy is a missing or changed production env var/config value; the …
- `H03 / opus_high` Boiler Repair Dispute: delta=-0.002, A=0.551, B=0.549
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H03/opus_high/B.md)
  A snippet: **In most jurisdictions, your landlord is likely wrong.** Here's the general picture: ## Who pays for boiler repairs? In the UK, US, and most of Europe, **landlords are responsible for maintaining heating systems**, inc…
  B snippet: **In most jurisdictions, your landlord is likely wrong.** Here's the general picture: ## Who pays for boiler repairs? In the vast majority of places (UK, most US states, EU countries), **the landlord is responsible for …
- `H02 / opus_high` Exhaustion Diagnosis: delta=-0.001, A=0.557, B=0.556
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/H02/opus_high/B.md)
  A snippet: I can't tell you exactly what's causing it — no one can without examining you and running labs. Persistent fatigue despite adequate sleep has dozens of possible causes, and pinpointing yours requires a doctor. Here are …
  B snippet: I can't tell you exactly what's causing it — no one can without examining you and running labs. Persistent fatigue despite adequate sleep has dozens of possible causes, and narrowing it down requires medical evaluation.…
- `W04 / codex_high` Open Shift Swaps: delta=0.000, A=0.490, B=0.490
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W04/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/W04/codex_high/B.md)
  A snippet: Use an auto-approved swap system with hard coverage rules: - Employees can trade shifts directly in the scheduling app up to shift start. - No manager approval is needed if the swap keeps all role, skill, and minimum st…
  B snippet: You cannot have all three at once: unrestricted last-minute swaps, no approvals, and a guarantee of never being understaffed. Use this instead: - Allow self-service swaps with no manager approval only when the system ve…
- `S13 / opus_high` Exact Delivery Date: delta=0.000, A=0.556, B=0.556
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S13/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_routing_upgrade_subset/S13/opus_high/B.md)
  A snippet: I can't give you an exact ship date or a meaningful probability — and anyone who does with this level of information is making it up. Here's why and what you actually need: **What's missing for a real estimate:** - Team…
  B snippet: I can't give you an exact ship date or a meaningful probability — and you should be skeptical of anyone who does, given what's on the table: - **"About a dozen"** — could be 10 or 15; that's a 50% swing in scope. - **"U…

## Incomplete Pairs

- `H02 / codex_high`: A=missing, B=present
