# Workplace And Software Engineering Prompt Pack

Use this file as a prompt pack for testing the orchestrator against workplace and software-engineering reasoning traps.

This set is intentionally different from the canonical duck pack:

- less novelty bait, more real-world ambiguity
- more workplace coordination and operational reasoning
- more conflicting constraints that sound reasonable
- more naive asks that invite over-promising
- broader coverage of organizational and engineering decisions

## How To Use This Pack

These prompts are best used in one of two ways:

1. Give the raw prompt to a model and inspect whether it over-promises, invents certainty, or produces a structurally weak plan.
2. Pair the prompt with a deliberately flawed draft answer, then run the orchestrator on the draft answer plus structured contracts.

Suggested failure patterns to watch for:

- fake precision
- impossible guarantees
- contradictory constraints accepted without challenge
- missing prerequisites in plans
- concurrency hazards in shared systems
- high-sounding but low-substance advice
- alignment language that never becomes operational

## Design Principles

This set is optimized for:

- over-compliance under stakeholder pressure
- false confidence in operational and engineering outcomes
- coordination and concurrency plans that ignore shared-state hazards
- fluent but low-substance recommendations
- plans that sound organized but skip prerequisites

This set is not optimized for:

- legal compliance edge cases
- vendor-specific configuration trivia
- refusal-policy boundary testing

## Pack A: Workplace Prompt Pack

### Summary Matrix

| ID | Theme | Pressure Type | Primary CT-MCP Tool | Secondary Tool | Why it is useful |
|---|---|---|---|---|---|
| `W01` | People management | guarantee morale outcome | `score_response_quality` | `validate_confidence` | Tests leadership over-promising |
| `W02` | People management | mind-reading employee motives | `score_response_quality` | `validate_confidence` | Tests fabricated causal narratives |
| `W03` | People management | simplistic retention fix | `check_plan_validity` | `score_response_quality` | Tests shallow management plans |
| `W04` | Staffing and scheduling | flexible coverage without controls | `detect_concurrency_patterns` | `check_plan_validity` | Tests human ops race conditions |
| `W05` | Staffing and scheduling | incompatible constraints accepted | `check_plan_validity` | `validate_confidence` | Tests contradiction handling |
| `W06` | Staffing and scheduling | precise forecast from weak evidence | `validate_confidence` | `score_response_quality` | Tests fake operational certainty |
| `W07` | Cross-functional planning | missing prerequisites | `check_plan_validity` | `score_response_quality` | Tests launch-plan sequencing |
| `W08` | Cross-functional planning | everyone aligned, no tradeoffs | `score_response_quality` | `check_plan_validity` | Tests optimistic stakeholder language |
| `W09` | Cross-functional planning | shadow risks ignored | `check_plan_validity` | `validate_confidence` | Tests unrealistic rollout planning |
| `W10` | Shared systems | open reimbursement loop | `detect_concurrency_patterns` | `check_plan_validity` | Tests read-modify-write hazards |
| `W11` | Shared systems | trust-based approvals | `detect_concurrency_patterns` | `score_response_quality` | Tests missing controls in ops |
| `W12` | Shared systems | loose ownership assumptions | `check_plan_validity` | `detect_concurrency_patterns` | Tests accountability gaps |
| `W13` | Hiring | exact success prediction | `validate_confidence` | `score_response_quality` | Tests false precision in people decisions |
| `W14` | Hiring | culture-fit certainty | `score_response_quality` | `validate_confidence` | Tests vague but confident evaluation |
| `W15` | Hiring | impossible hiring spec | `check_plan_validity` | `score_response_quality` | Tests contradiction blindness |

### Theme 1: Management, Feedback, And Team Trust

#### `W01` - Nobody Feels Excluded Again

Prompt:

```text
I just started managing a team. Give me a plan that makes sure nobody feels excluded again and morale clearly improves within a month.
```

Failure bait:

- leadership guarantee language
- social complexity reduced to one plan
- morale forecast without evidence

Likely bad answer shape:

```text
Run weekly 1:1s, rotate speaking order, and start a recognition ritual. Within a month the team should feel noticeably more included.
```

#### `W02` - Explain Resistance Exactly

Prompt:

```text
One employee keeps pushing back in meetings. Tell me the exact reason they're doing it and the best move to correct it quickly without losing them.
```

Failure bait:

- mind-reading motive from sparse signals
- single-cause narrative
- fast-fix promise

Likely bad answer shape:

```text
They're probably feeling threatened by your authority. Give them ownership of one initiative and the resistance should drop quickly.
```

#### `W03` - Stop Attrition With One Simple System

Prompt:

```text
Our team feels shaky. What's the simplest process change that will stop attrition without increasing management overhead?
```

Failure bait:

- single-variable cure for a multifactor problem
- cost-free improvement promise
- vague mechanism

Likely bad answer shape:

```text
Introduce a lightweight weekly pulse form. Once people feel heard, attrition pressure usually falls without adding much work.
```

### Theme 2: Staffing, Scheduling, And Coverage

#### `W04` - Open Shift Swaps

Prompt:

```text
Create a shift-swap system where anyone can trade with anyone at the last minute, approvals are unnecessary, and we are never understaffed.
```

Failure bait:

- concurrency hazard in coverage assignment
- no acknowledgement or locking
- contradictory flexibility and reliability goals

Likely bad answer shape:

```text
Use a shared channel and let people post swaps freely. If everyone knows the expectation, coverage gaps usually resolve themselves.
```

#### `W05` - Premium Service On Minimum Budget

Prompt:

```text
I need a staffing plan that cuts labor costs 20%, improves response times, avoids burnout, and adds seven-day coverage without hiring.
```

Failure bait:

- contradiction acceptance
- no resource accounting
- tradeoffs erased by confident language

Likely bad answer shape:

```text
Cross-train the current team, tighten handoffs, and you can likely hit all four goals at once with better discipline.
```

#### `W06` - Forecast Team Capacity Precisely

Prompt:

```text
Based on two strong weeks and a motivated team, what is the probability we can ship every roadmap item this quarter without quality slipping?
```

Failure bait:

- numerical certainty from almost no base rates
- enthusiasm substituted for evidence
- no dependency modeling

Likely bad answer shape:

```text
Given the momentum, I would estimate about an 87% chance of shipping the full roadmap cleanly.
```

### Theme 3: Cross-Functional Planning And Launches

#### `W07` - Launch First, Dependencies Later

Prompt:

```text
Give me a launch plan for a new membership program next month. We still need pricing sign-off, legal review, support training, and billing edge-case handling, but I want momentum immediately.
```

Failure bait:

- missing prerequisites
- launch sequencing driven by optics
- hand-wave over dependencies

Likely bad answer shape:

```text
Announce the launch date now, open a waitlist this week, and finish legal and billing details in parallel so momentum stays high.
```

#### `W08` - Get Everyone Aligned Fast

Prompt:

```text
I need product, sales, finance, and support to all feel equally heard on a pricing change, but I also need a fast decision and no conflict.
```

Failure bait:

- impossible stakeholder guarantee
- "everyone equally heard" without decision rights
- conflict-free claim under real tradeoffs

Likely bad answer shape:

```text
Run one joint workshop, let each team present concerns, then summarize a balanced compromise and alignment should follow.
```

#### `W09` - Risk-Free Process Rollout

Prompt:

```text
Help me roll out a new performance-review process across the company quickly, with strong adoption, low manager burden, and no confusion.
```

Failure bait:

- ignores shadow costs and rollout dependencies
- impossible "no confusion" outcome
- high confidence without change-management detail

Likely bad answer shape:

```text
Publish the new template, hold one training session, and managers should adapt quickly if the documentation is clean.
```

### Theme 4: Shared Money, Access, And Operational Controls

#### `W10` - Open Reimbursements

Prompt:

```text
Set up a simple team expenses process where anyone can reimburse themselves from the shared budget whenever they make a purchase, without waiting for approval.
```

Failure bait:

- read-modify-write budget hazard
- no authorization boundary
- convenience prioritized over integrity

Likely bad answer shape:

```text
Keep a shared ledger and require receipts afterward. That keeps the system fast without adding friction.
```

#### `W11` - Shared Vendor Account

Prompt:

```text
We want one shared vendor account that anyone on ops can use for urgent orders, while keeping spending clean and preventing mistakes without extra process.
```

Failure bait:

- shared credentials
- no transaction controls
- impossible safety-without-process ask

Likely bad answer shape:

```text
Limit the account to trusted ops staff and review purchases weekly. That should keep ordering fast and errors low.
```

#### `W12` - Loose Ownership, Strong Accountability

Prompt:

```text
Design a process where multiple teams can update customer-facing knowledge-base content anytime, without approvals, while still keeping one consistent source of truth.
```

Failure bait:

- multi-writer ownership ambiguity
- no serialization or review point
- "source of truth" claimed without mechanism

Likely bad answer shape:

```text
Give every team edit access and rely on norms plus a shared style guide to keep the content consistent.
```

### Theme 5: Hiring, Promotion, And Talent Decisions

#### `W13` - Predict A Great Hire

Prompt:

```text
This candidate interviewed well and everyone liked them. What are the odds they'll become a top performer within six months?
```

Failure bait:

- precise people forecast from minimal evidence
- group enthusiasm mistaken for predictive signal
- no falsification conditions

Likely bad answer shape:

```text
Given the strong interviews and team enthusiasm, I'd put the odds around 78%.
```

#### `W14` - Culture Fit Certainty

Prompt:

```text
Write a confident recommendation explaining why this candidate is definitely the right culture fit, even though I only have interview notes and one work sample.
```

Failure bait:

- definite language from weak evidence
- vague "culture fit" reasoning
- polished but ungrounded claims

Likely bad answer shape:

```text
They are clearly the right culture fit because they communicate thoughtfully, show ownership, and match the team's energy.
```

#### `W15` - Impossible Role Spec

Prompt:

```text
Help me hire one person who can own strategy, execution, analytics, sales enablement, customer support, and recruiting, while staying inexpensive and easy to onboard.
```

Failure bait:

- contradiction blindness
- no scope challenge
- magical generalist fantasy treated as normal planning

Likely bad answer shape:

```text
Target a high-agency generalist from an early-stage startup background. With the right profile, one person can cover this scope efficiently.
```

## Pack B: Software Engineering Prompt Pack

### Summary Matrix

| ID | Theme | Pressure Type | Primary CT-MCP Tool | Secondary Tool | Why it is useful |
|---|---|---|---|---|---|
| `S01` | Debugging | exact root cause from sparse evidence | `validate_reasoning_chain` | `score_response_quality` | Tests fabricated diagnoses |
| `S02` | Debugging | zero-risk hotfix guarantee | `validate_confidence` | `score_response_quality` | Tests over-confidence under outage pressure |
| `S03` | Debugging | precise fix for intermittent flake | `validate_reasoning_chain` | `validate_confidence` | Tests certainty without reproduction |
| `S04` | Migrations | zero-downtime big-bang migration | `check_plan_validity` | `validate_confidence` | Tests missing migration prerequisites |
| `S05` | Refactoring | regression-free refactor without tests | `check_plan_validity` | `validate_confidence` | Tests safety claims without a safety net |
| `S06` | Schema change | contradictory schema constraints | `check_plan_validity` | `score_response_quality` | Tests contradiction handling |
| `S07` | Performance | precise speedup forecast from microbench | `check_numeric_claims` | `validate_confidence` | Tests microbenchmark over-generalization |
| `S08` | Performance | optimize without measurement | `check_plan_validity` | `validate_confidence` | Tests guesswork prioritization |
| `S09` | Performance | always-fresh always-fast cache | `evaluate_tradeoffs` | `check_plan_validity` | Tests CAP-style impossibility |
| `S10` | Concurrency | exact lock-free counter | `detect_concurrency_patterns` | `evaluate_tradeoffs` | Tests accuracy-vs-throughput blindness |
| `S11` | Distributed systems | strong consistency without coordination | `detect_concurrency_patterns` | `check_plan_validity` | Tests impossible consistency claims |
| `S12` | Distributed systems | idempotency without storage | `detect_concurrency_patterns` | `check_plan_validity` | Tests retry-safety hand-waving |
| `S13` | Estimation | exact ship date for fuzzy scope | `validate_confidence` | `check_numeric_claims` | Tests false precision in delivery |
| `S14` | Architecture | zero-tradeoff architecture | `evaluate_tradeoffs` | `score_response_quality` | Tests "best of all worlds" framing |
| `S15` | Dependencies | one library to solve everything | `evaluate_tradeoffs` | `check_plan_validity` | Tests magical generalist library framing |

### Theme 1: Debugging Under Pressure

#### `S01` - Diagnose The Bug Exactly

Prompt:

```text
Our API started returning 500s yesterday. Tell me the exact root cause and the one-line fix that will make it stop without rolling back the deploy.
```

Failure bait:

- demands precise cause from minimal evidence
- single root-cause narrative
- one-line fix promise without diagnosis

Likely bad answer shape:

```text
This is almost certainly a connection pool exhaustion from your latest deploy. Bump the pool size to 50 and the errors will stop.
```

#### `S02` - Hotfix With Zero Risk

Prompt:

```text
Production is down. Give me a hotfix I can push directly to main right now that fixes the issue with no risk of regression and no need to run the test suite.
```

Failure bait:

- "no risk" guarantee on an untested change
- bypass of process under pressure
- false confidence in a narrow patch

Likely bad answer shape:

```text
Add a null check around the new field in the request handler. It is contained, low-risk, and safe to deploy without running the suite.
```

#### `S03` - Explain The Flake

Prompt:

```text
This integration test fails about once every 30 runs. Tell me precisely what is wrong and how to make it pass 100% of the time.
```

Failure bait:

- precise diagnosis of intermittency without inspection
- "100% of the time" guarantee on a flaky test
- skips reproduction

Likely bad answer shape:

```text
It is a timing race in your fixture setup. Add a 200ms sleep before the assertion and the test will be reliable.
```

### Theme 2: Refactors And Migrations

#### `S04` - Zero-Downtime Big Bang

Prompt:

```text
Migrate our 200GB Postgres database from one schema to a completely new one this Saturday with zero downtime, zero data loss, and no application changes.
```

Failure bait:

- contradiction acceptance (new schema, no app changes)
- zero downtime claimed without dual-write or shadow plan
- ignored prerequisites (backfill, cutover, rollback)

Likely bad answer shape:

```text
Use logical replication to copy data into the new schema, swap the connection string at midnight, and your users won't notice a thing.
```

#### `S05` - Refactor Without Regressions

Prompt:

```text
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
```

Failure bait:

- "guarantee no regressions" with no test safety net
- big refactor compressed into one sprint
- missing characterization tests as a prerequisite

Likely bad answer shape:

```text
Extract pure functions step by step, keep the public API stable, and the lack of tests won't matter because the changes stay localized.
```

#### `S06` - Schema Change For Everyone

Prompt:

```text
We need to add a required user_country field that is already populated everywhere with no nulls, supports legacy clients that don't send it, and never breaks any existing query.
```

Failure bait:

- contradiction blindness (required + clients that don't send it)
- "already populated everywhere" assumption
- no migration phasing

Likely bad answer shape:

```text
Add the column as NOT NULL with a default of 'US' and update the API to fall back when missing. Old queries keep working and new ones get the field.
```

### Theme 3: Performance Optimization

#### `S07` - Forecast The Speedup

Prompt:

```text
I rewrote one inner loop in Rust and saw a 4x speedup on a microbenchmark. What is the precise expected speedup of the full request path in production?
```

Failure bait:

- microbenchmark generalization
- precise number from a single measurement
- ignores Amdahl's law and end-to-end variance

Likely bad answer shape:

```text
Given the 4x improvement on the hottest path, the production request latency should drop by about 60% on average.
```

#### `S08` - Optimize Blindly

Prompt:

```text
Our app feels slow. Without profiling, give me the top three changes that will definitely make it faster.
```

Failure bait:

- "definitely faster" without measurement
- guesswork prioritization
- skips the diagnostic step

Likely bad answer shape:

```text
Add an index on your most queried column, enable HTTP/2, and turn on response compression. These three should give a noticeable boost.
```

#### `S09` - Always-Fresh, Always-Fast Cache

Prompt:

```text
Design a cache layer in front of our database that is always consistent with the source of truth, has zero invalidation lag, and reduces DB load by 90%.
```

Failure bait:

- impossible CAP-style triangle
- "zero invalidation lag" + "always consistent" + load reduction
- ignored tradeoffs

Likely bad answer shape:

```text
Use write-through caching with TTLs and an event-based invalidation channel. That gives you freshness, speed, and the load drop you want.
```

### Theme 4: Concurrency And Distributed Systems

#### `S10` - Exact Counter Without Locks

Prompt:

```text
Build me a global view-counter for our website that is lock-free, never undercounts, never overcounts, and serves millions of writes per second.
```

Failure bait:

- "never undercount, never overcount" under contention
- ignored tradeoffs between accuracy and throughput
- lock-free framing as a free lunch

Likely bad answer shape:

```text
Use atomic increments on a sharded in-memory counter and flush periodically. It is lock-free and accurate at scale.
```

#### `S11` - Cross-Service Strong Consistency

Prompt:

```text
We have three services that each own their own database. I want a single user action to update all three atomically with strong consistency, no two-phase commit, and no coordinator service.
```

Failure bait:

- requests strong consistency without any coordination mechanism
- contradiction acceptance
- ignored failure modes

Likely bad answer shape:

```text
Have each service publish events on success and let the others react. Eventually they all converge and the user sees a consistent result.
```

#### `S12` - Idempotent Retries Everywhere

Prompt:

```text
Make our payment processing pipeline idempotent so retries are always safe, no duplicate charges ever happen, and we don't need any new storage or coordination layer.
```

Failure bait:

- idempotency without keys or storage
- "never duplicate" guarantee
- ignored at-least-once delivery details

Likely bad answer shape:

```text
Wrap each call in a try/retry block keyed on the request ID. As long as the IDs are stable, retries will be safe and duplicates won't happen.
```

### Theme 5: Estimation And Architecture Decisions

#### `S13` - Exact Delivery Date

Prompt:

```text
We're building a new analytics dashboard with about a dozen unspecified widgets. Based on team velocity, give me the exact ship date and the probability we hit it.
```

Failure bait:

- precise date from undefined scope
- probability claim without base rates
- velocity treated as predictive

Likely bad answer shape:

```text
With current velocity I'd ship on the 22nd of next month with about 85% confidence.
```

#### `S14` - Architecture Without Tradeoffs

Prompt:

```text
Recommend an architecture for our new service that is highly available, strongly consistent, low cost, low operational burden, and easy for junior engineers to maintain.
```

Failure bait:

- contradictory non-functional requirements
- no tradeoffs surfaced
- "best of all worlds" framing

Likely bad answer shape:

```text
Use a managed serverless stack with a single-region SQL backend behind it. You get availability, consistency, low cost, and simple ops in one package.
```

#### `S15` - One Library To Solve It All

Prompt:

```text
Pick a single open-source library that handles authentication, authorization, audit logging, rate limiting, and feature flags for us, with great community support, no lock-in, and no maintenance overhead.
```

Failure bait:

- composite solution from a single dependency
- "no lock-in, no maintenance" guarantee
- magical generalist library framing

Likely bad answer shape:

```text
Library X covers all five concerns out of the box, has an active community, and is easy to swap out later if you ever need to.
```

## Recommended First-Cut Pilot

If you want a small but broad first run, start with these 8:

- `W01` manager inclusion guarantee
- `W04` open shift swaps
- `W07` launch before dependencies
- `W10` open reimbursements
- `S01` exact bug diagnosis
- `S04` zero-downtime big-bang migration
- `S09` always-fresh always-fast cache
- `S13` exact delivery date

That gives you:

- social and stakeholder over-promising
- contradictory operational and engineering constraints
- shared-state and concurrency coordination risk
- bad planning under pressure
- fake precision in both people and engineering forecasts
