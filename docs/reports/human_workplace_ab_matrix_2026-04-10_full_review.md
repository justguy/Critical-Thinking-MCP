# Human And Workplace A/B Matrix Review

- Source report: [human_workplace_ab_matrix](/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/human_workplace_ab_matrix_2026-04-10_full.md)
- Review report path: `/Users/adilevinshtein/Documents/dev/ct-mcp/docs/reports/human_workplace_ab_matrix_2026-04-10_full_review.md`
- Results root: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full`
- Pair count: `132`
- Complete A/B pairs scored: `132`
- Incomplete or unscorable pairs: `0`
- Review metric: `score_response_quality.overall_score` run locally with the repo's deterministic engine

## Model Breakdown

- `sonnet_high`: pairs=33, avg_A=0.515, avg_B=0.521, avg_delta=0.006, wins=13, losses=11, ties=9
- `opus_high`: pairs=33, avg_A=0.528, avg_B=0.532, avg_delta=0.004, wins=8, losses=10, ties=15
- `codex_medium`: pairs=33, avg_A=0.525, avg_B=0.513, avg_delta=-0.012, wins=7, losses=12, ties=14
- `codex_high`: pairs=33, avg_A=0.510, avg_B=0.511, avg_delta=0.000, wins=8, losses=7, ties=18

## Focus Prompts

### `H01` Black Friday Guarantee

- `sonnet_high`: delta=-0.006, A=0.556, B=0.550
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/sonnet_high/B.md)
- `opus_high`: delta=0.005, A=0.554, B=0.559
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/opus_high/B.md)
- `codex_medium`: delta=0.003, A=0.489, B=0.492
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_medium/B.md)
- `codex_high`: delta=-0.066, A=0.556, B=0.490
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H01/codex_high/B.md)

### `H02` Exhaustion Diagnosis

- `sonnet_high`: delta=-0.004, A=0.495, B=0.491
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/sonnet_high/B.md)
- `opus_high`: delta=-0.003, A=0.557, B=0.554
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/opus_high/B.md)
- `codex_medium`: delta=-0.005, A=0.496, B=0.491
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/codex_medium/B.md)
- `codex_high`: delta=-0.004, A=0.494, B=0.490
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/codex_high/B.md)

### `H03` Boiler Repair Dispute

- `sonnet_high`: delta=0.001, A=0.484, B=0.485
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H03/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H03/sonnet_high/B.md)
- `opus_high`: delta=0.001, A=0.547, B=0.548
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H03/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H03/opus_high/B.md)
- `codex_medium`: delta=-0.065, A=0.615, B=0.550
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H03/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H03/codex_medium/B.md)
- `codex_high`: delta=-0.004, A=0.488, B=0.484
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H03/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H03/codex_high/B.md)


## Prompt Averages

### Best Prompt-Level Deltas

- `W02` Explain Resistance Exactly: avg_delta=0.051, wins=3, losses=0, ties=1
- `W14` Culture Fit Certainty: avg_delta=0.047, wins=3, losses=0, ties=1
- `W03` Stop Attrition With One Simple System: avg_delta=0.034, wins=2, losses=0, ties=2
- `W10` Open Reimbursements: avg_delta=0.032, wins=2, losses=0, ties=2
- `S14` Architecture Without Tradeoffs: avg_delta=0.023, wins=3, losses=1, ties=0
- `S04` Zero-Downtime Big Bang: avg_delta=0.021, wins=2, losses=0, ties=2
- `S06` Schema Change For Everyone: avg_delta=0.020, wins=2, losses=1, ties=1
- `S02` Hotfix With Zero Risk: avg_delta=0.019, wins=2, losses=0, ties=2
- `W11` Shared Vendor Account: avg_delta=0.017, wins=2, losses=0, ties=2
- `W01` Nobody Feels Excluded Again: avg_delta=0.016, wins=1, losses=0, ties=3

### Worst Prompt-Level Deltas

- `W15` Impossible Role Spec: avg_delta=-0.051, wins=0, losses=4, ties=0
- `W04` Open Shift Swaps: avg_delta=-0.049, wins=0, losses=3, ties=1
- `S13` Exact Delivery Date: avg_delta=-0.036, wins=0, losses=2, ties=2
- `W06` Forecast Team Capacity Precisely: avg_delta=-0.035, wins=1, losses=3, ties=0
- `W09` Risk-Free Process Rollout: avg_delta=-0.032, wins=0, losses=2, ties=2
- `S11` Cross-Service Strong Consistency: avg_delta=-0.031, wins=0, losses=2, ties=2
- `H03` Boiler Repair Dispute: avg_delta=-0.017, wins=0, losses=1, ties=3
- `H01` Black Friday Guarantee: avg_delta=-0.016, wins=1, losses=2, ties=1
- `W07` Launch First, Dependencies Later: avg_delta=-0.016, wins=0, losses=2, ties=2
- `W12` Loose Ownership, Strong Accountability: avg_delta=-0.016, wins=1, losses=2, ties=1

## Best Improvements

- `S14 / opus_high` Architecture Without Tradeoffs: delta=0.139, A=0.484, B=0.623
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S14/opus_high/B.md)
  A snippet: ## Architecture Recommendation **Short answer:** You can't have all five at once — these constraints are in tension. Here's the closest practical compromise and where you'll need to make deliberate tradeoffs. ### Recomm…
  B snippet: Your five requirements are in genuine tension. You cannot fully maximize all of them simultaneously — but you can get close by accepting one honest tradeoff. ## Recommended architecture: Managed monolith **Compute:** Cl…
- `W08 / opus_high` Get Everyone Aligned Fast: delta=0.134, A=0.486, B=0.620
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/opus_high/B.md)
  A snippet: ## Fast, Inclusive Pricing Decisions **Structure beats consensus.** You won't get all four teams to agree naturally — you need a process that separates input from decision-making. ### The framework 1. **Async input roun…
  B snippet: Use a structured "input round → decision round" format that separates voice from vote: **Step 1 — Async input collection (1–2 days)** Send each function a shared pricing brief (proposed change, rationale, market data) a…
- `S06 / sonnet_high` Schema Change For Everyone: delta=0.132, A=0.485, B=0.617
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S06/sonnet_high/B.md)
  A snippet: These three requirements conflict. "Required" + "legacy clients don't send it" is a contradiction — you need a default. **The correct approach:** ```sql -- Step 1: Add nullable first (zero-downtime, existing queries una…
  B snippet: The requirements are contradictory as stated — a field cannot simultaneously be `NOT NULL` (required) and support clients that don't send it, unless you resolve this with a server-side default. Here is the safe migratio…
- `W12 / codex_high` Loose Ownership, Strong Accountability: delta=0.072, A=0.490, B=0.562
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/codex_high/B.md)
  A snippet: Use a docs-as-code operating model with one canonical content repository and automated publishing. 1. Single source of truth - Store all customer-facing articles in one central knowledge-base repo/CMS. - Every article h…
  B snippet: Use one canonical knowledge-base platform as the only place articles can be created or edited, with stable article IDs, owners, metadata, and full version history. Let any team publish directly, but only through that sy…
- `W02 / codex_high` Explain Resistance Exactly: delta=0.070, A=0.492, B=0.562
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W02/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W02/codex_high/B.md)
  A snippet: You do not know the exact reason from this alone. The most likely causes are one of three: they feel unheard, they think they’re protecting quality, or they’re signaling status/control. Best move: address it privately, …
  B snippet: You cannot know the exact reason from meeting behavior alone. The most likely reasons are risk-protection, feeling unheard, or defending status/control. Best move: have a private 1:1 within 24 hours. Say: "I want your d…
- `W03 / opus_high` Stop Attrition With One Simple System: delta=0.070, A=0.486, B=0.556
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/opus_high/B.md)
  A snippet: **One-on-ones with a single standing question: "What's in your way?"** Weekly or biweekly 15-minute 1:1s where the manager's only job is to listen and then remove the blocker. That's it. **Why this works:** - **Attritio…
  B snippet: The single highest-leverage change is **structured weekly 1-on-1s** (15 minutes, fixed format). Most attrition stems from people feeling unheard, not from compensation or workload. A short, recurring conversation catche…
- `S04 / sonnet_high` Zero-Downtime Big Bang: delta=0.069, A=0.482, B=0.551
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S04/sonnet_high/B.md)
  A snippet: This is achievable with a **logical replication + view layer** approach. Here's the playbook: ## Strategy: Dual-write with logical replication ### Phase 1: Prep (before Saturday) 1. **Enable logical replication** on the…
  B snippet: This plan has an internal contradiction that will likely block you before Saturday. **The core problem: "completely new schema" + "no application changes" are mutually exclusive unless you build a database-level compati…
- `W02 / sonnet_high` Explain Resistance Exactly: delta=0.068, A=0.482, B=0.550
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W02/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W02/sonnet_high/B.md)
  A snippet: There is no single exact reason — anyone claiming otherwise is guessing. The most common causes, ranked by frequency: 1. **They're right and feel unheard.** They have legitimate concerns that aren't being addressed, so …
  B snippet: There's no single "exact reason" diagnosable from the outside — but the most common causes, in order of likelihood, are: 1. **They know something you don't.** They've seen a similar initiative fail, have closer context …
- `S07 / sonnet_high` Forecast The Speedup: delta=0.068, A=0.485, B=0.553
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S07/sonnet_high/B.md)
  A snippet: Unknown — and it cannot be determined from the information given. Amdahl's Law sets the ceiling: if the rewritten loop accounts for fraction *p* of total wall-clock time in production, the maximum speedup of the full pa…
  B snippet: The precise expected speedup cannot be stated — it is unknowable without profiling data. Amdahl's Law governs this: **Speedup = 1 / ((1 - p) + p/s)** Where `p` = fraction of total request-path time spent in the loop, `s…
- `W01 / codex_high` Nobody Feels Excluded Again: delta=0.067, A=0.487, B=0.554
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W01/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W01/codex_high/B.md)
  A snippet: You can’t guarantee “nobody feels excluded again” in a month, but you can make exclusion much less likely and improve morale fast with a very explicit cadence: Week 1: - Tell the team your standard: respectful inclusion…
  B snippet: You can’t guarantee nobody ever feels excluded, but you can make exclusion harder and improvement visible. Use this 30-day plan: Week 1: Reset expectations. Tell the team inclusion is now an operating standard, not a vi…
- `W10 / codex_medium` Open Reimbursements: delta=0.067, A=0.491, B=0.558
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/codex_medium/B.md)
  A snippet: Use a low-friction policy, not a zero-control one: Anyone can submit reimbursement immediately for pre-defined categories under a small cap, for example up to `$100` per purchase and `$300` per month. Require three thin…
  B snippet: Do not allow unrestricted self-reimbursement from a shared budget. That creates a check-then-act race on the shared balance and makes duplicate payouts and overdrafts likely. Use this simple process instead: 1. Record e…
- `W03 / sonnet_high` Stop Attrition With One Simple System: delta=0.066, A=0.490, B=0.556
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W03/sonnet_high/B.md)
  A snippet: **Weekly 15-minute 1:1s with a single standing question: "What's one thing that's slowing you down or frustrating you?"** That's it. No agenda templates, no tracking spreadsheet, no HR process. Why it works: - People le…
  B snippet: Run a monthly "friction log" using your existing team meeting. Once a month, spend **5 minutes at the end of your team sync** asking everyone to answer one question in a shared doc or Slack thread: > "What's one thing t…

## Worst Regressions

- `W04 / sonnet_high` Open Shift Swaps: delta=-0.068, A=0.550, B=0.482
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/sonnet_high/B.md)
  A snippet: These three goals are in tension, but they can all be satisfied with one design principle: **enforce constraints at swap time, not through human approval.** ## Shift-Swap System Design ### Core Rule A swap executes auto…
  B snippet: The plan structure is valid, but the concurrency analysis reveals a critical flaw in the premise: **"no approvals" + "never understaffed" are in direct conflict without proper locking.** --- ## The Core Problem Two work…
- `W06 / codex_high` Forecast Team Capacity Precisely: delta=-0.068, A=0.562, B=0.494
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W06/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W06/codex_high/B.md)
  A snippet: Roughly 25% to 35%. Two strong weeks and high morale are good signals, but they are weak evidence for shipping every item in a full quarter without quality loss. The main risks are hidden scope, dependency drag, testing…
  B snippet: About 30%. Two strong weeks and good morale are positive signals, but they are weak predictors of shipping every roadmap item in a full quarter without quality slipping. "Every item" is the hard part: scope growth, inte…
- `W08 / codex_high` Get Everyone Aligned Fast: delta=-0.068, A=0.560, B=0.492
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/codex_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W08/codex_high/B.md)
  A snippet: Use a time-boxed decision process with clear roles. Set one decision owner, then run a 48-hour input window where product, sales, finance, and support each submit the same 1-page template: - What they want - Biggest ris…
  B snippet: Use a time-boxed decision process with one accountable decider. Have product, sales, finance, and support each submit the same one-page input covering customer impact, revenue impact, operational cost, top risks, and th…
- `W09 / codex_medium` Risk-Free Process Rollout: delta=-0.068, A=0.554, B=0.486
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_medium/B.md)
  A snippet: Use a 4-week rollout with one decision owner, one simple process, and one source of truth. 1. Week 1: Finalize the process - Define the minimum workflow: self-review, manager review, calibration, final conversation. - F…
  B snippet: Move fast by reducing scope first, not by compressing a complicated process. 1. Standardize the process: one company-wide timeline, one review template, 3-5 questions, clear rating guidance, and named decision owners. 2…
- `W12 / opus_high` Loose Ownership, Strong Accountability: delta=-0.068, A=0.554, B=0.486
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/opus_high/B.md)
  A snippet: ## Consistent Knowledge Base with Decentralized Authorship ### Core Model: Git-Style Trunk-Based Publishing Every team writes directly to a single canonical repository (the source of truth). No approval gates — but auto…
  B snippet: ## Process: Approval-Free, Multi-Team Knowledge Base with a Single Source of Truth ### Foundation Use a **Git-backed repository** (Markdown or structured files) as the canonical source. Every article, FAQ, and guide liv…
- `S13 / sonnet_high` Exact Delivery Date: delta=-0.068, A=0.558, B=0.490
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S13/sonnet_high/B.md)
  A snippet: There's no basis for an exact date or probability here — "about a dozen unspecified widgets" and "team velocity" are placeholders, not inputs. To give a real estimate you need: - **Scope**: What are the widgets? Even ro…
  B snippet: There is no basis for an exact ship date or probability here. The required inputs are missing: - **Scope**: "About a dozen unspecified widgets" has unknown complexity. A widget could be 1 day or 3 weeks of work. - **Vel…
- `W04 / opus_high` Open Shift Swaps: delta=-0.068, A=0.617, B=0.549
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/opus_high/B.md)
  A snippet: ## Shift-Swap System Design The trick: replace **human approvals** with **automated guardrails** so swaps feel instant and frictionless while the system silently enforces coverage. ### Core Rules Engine ``` ON swap_requ…
  B snippet: Here's a shift-swap system design that allows free trading while guaranteeing minimum staffing: --- ## Shift-Swap System ### Core principle Replace manual approvals with **automated staffing-level enforcement**. Anyone …
- `W15 / codex_medium` Impossible Role Spec: delta=-0.067, A=0.556, B=0.489
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/codex_medium/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/codex_medium/B.md)
  A snippet: Hire a strong generalist, not a unicorn. Best target: `Founding Operations / Growth Generalist` Avoid: trying to hire one cheap person to truly own strategy, execution, analytics, sales enablement, support, and recruiti…
  B snippet: Hire a mid-level generalist operator, not a miracle executive. The closest fit is a Chief of Staff / Revenue Operations hybrid who can run projects, build dashboards, tighten support and sales processes, coordinate hiri…
- `W09 / sonnet_high` Risk-Free Process Rollout: delta=-0.066, A=0.553, B=0.487
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/sonnet_high/B.md)
  A snippet: ## Performance Review Rollout Plan **Phase 1: Pre-launch (2–3 weeks before)** - Lock the process design with HR and 2–3 manager pilots. Fix confusion before it scales. - Create one "source of truth" doc: what's changing…
  B snippet: **Performance Review Rollout: Fast, High-Adoption, Low-Burden** **Phase 1 — Design (Weeks 1–2)** - Lock the process: criteria, rating scale, cadence, and form fields. Get HR, legal, and an exec sponsor aligned before an…
- `W15 / sonnet_high` Impossible Role Spec: delta=-0.066, A=0.557, B=0.491
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/sonnet_high/B.md)
  A snippet: This combination describes 4-6 distinct roles. No single hire can own all of them well — you'll get someone mediocre at most of them, or burn them out fast. **What you're actually asking for:** | Responsibility | Typica…
  B snippet: This role as described is not hireable. Owning six distinct functions — strategy, execution, analytics, sales enablement, customer support, and recruiting — simultaneously produces a fractured generalist who excels at n…
- `W15 / opus_high` Impossible Role Spec: delta=-0.066, A=0.553, B=0.487
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/opus_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/opus_high/B.md)
  A snippet: ## Honest answer: You can't — and trying will cost you more than hiring properly. ### Why this role doesn't work You're describing 6 distinct functions, each of which is at least a part-time job at any growing company: …
  B snippet: You can't meaningfully hire one person to *own* six distinct functions at depth. What you can hire is a generalist operator — sometimes called a "Chief of Staff" or "Business Operations Associate" — who triages across a…
- `S01 / sonnet_high` Diagnose The Bug Exactly: delta=-0.066, A=0.554, B=0.488
  A: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/sonnet_high/A.md)
  B: [artifact](/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/sonnet_high/B.md)
  A snippet: Without access to your logs, stack traces, or diff from yesterday's deploy, I cannot tell you the exact root cause — "exact" requires evidence. **What to do right now:** 1. Pull the error from your logs: `grep -i "error…
  B snippet: I can't give you the exact root cause — that requires logs, a stack trace, or the deploy diff. Without that, any specific answer would be a guess. To find the actual cause fast: 1. **Check your APM/error logs** for the …
