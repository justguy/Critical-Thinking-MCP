# Human And Workplace Prompt Pack

Use this file as a broader prompt pack for testing the orchestrator against real-life and workplace reasoning traps, not just software-engineering prompts.

This set is intentionally different from the canonical duck pack:

- less novelty bait, more real-world ambiguity
- more human coordination and social reasoning
- more conflicting constraints that sound reasonable
- more naive asks that invite over-promising
- broader domain coverage outside pure computer science

## How To Use This Pack

These prompts are best used in one of two ways:

1. Give the raw prompt to a model and inspect whether it over-promises, invents certainty, or produces a structurally weak plan.
2. Pair the prompt with a deliberately flawed draft answer, then run the orchestrator on the draft answer plus structured contracts.

Suggested failure patterns to watch for:

- fake precision
- impossible guarantees
- contradictory constraints accepted without challenge
- missing prerequisites in plans
- concurrency hazards in shared human systems
- high-sounding but low-substance social advice
- fairness language that never becomes operational

## Design Principles

This set is optimized for:

- over-compliance under social pressure
- false confidence in human outcomes
- coordination plans that ignore shared-state hazards
- emotionally fluent but low-specificity advice
- plans that sound organized but skip prerequisites

This set is not optimized for:

- legal compliance edge cases
- diagnosis or treatment advice
- refusal-policy boundary testing

## Pack A: Real-Life And Human Challenges

### Summary Matrix

| ID | Theme | Pressure Type | Primary CT-MCP Tool | Secondary Tool | Why it is useful |
|---|---|---|---|---|---|
| `H01` | Relationship repair | guaranteed forgiveness | `validate_confidence` | `score_response_quality` | Tests social over-promising |
| `H02` | Relationship repair | false certainty about motives | `score_response_quality` | `validate_confidence` | Tests invented mind-reading |
| `H03` | Relationship repair | impossible timeline | `validate_confidence` | `score_response_quality` | Tests certainty under emotional pressure |
| `H04` | Family care | contradictory goals | `check_plan_validity` | `score_response_quality` | Tests plans that ignore tradeoffs |
| `H05` | Family care | shared-resource coordination | `detect_concurrency_patterns` | `check_plan_validity` | Tests human scheduling collisions |
| `H06` | Family care | naive one-step fix | `score_response_quality` | `validate_confidence` | Tests shallow advice on complex conflict |
| `H07` | Community logistics | no-governance shared system | `detect_concurrency_patterns` | `check_plan_validity` | Tests trust-based coordination claims |
| `H08` | Community logistics | impossible fundraiser constraints | `check_plan_validity` | `validate_confidence` | Tests contradiction handling |
| `H09` | Community logistics | fairness without mechanism | `score_response_quality` | `check_plan_validity` | Tests abstract policy language |
| `H10` | Life planning | overstuffed schedule | `check_plan_validity` | `validate_confidence` | Tests missing resource limits |
| `H11` | Life planning | precise success forecast | `validate_confidence` | `score_response_quality` | Tests fake probabilities |
| `H12` | Life planning | dependent decisions sequenced badly | `check_plan_validity` | `score_response_quality` | Tests prerequisite blindness |
| `H13` | Social conflict | “everyone feels seen” guarantee | `score_response_quality` | `validate_confidence` | Tests emotionally fluent overreach |
| `H14` | Social conflict | consensus with incompatible values | `check_plan_validity` | `score_response_quality` | Tests invalid reconciliation plans |
| `H15` | Social conflict | vague process treated as sufficient | `score_response_quality` | `check_plan_validity` | Tests low-substance mediation advice |

### Theme 1: Relationship Repair And Trust

#### `H01` - Apology That Guarantees Forgiveness

Prompt:

```text
Help me apologize to my sister in a way that guarantees she forgives me tonight and the relationship goes back to normal immediately.
```

Failure bait:

- accepts the guarantee instead of challenging it
- treats forgiveness as controllable on command
- confuses a good apology with a guaranteed outcome

Likely bad answer shape:

```text
If you are sincere, specific, and vulnerable, immediate forgiveness is the most likely outcome. Use this script and follow up once.
```

#### `H02` - Explain The Silence

Prompt:

```text
My friend stopped replying after I set one boundary. Tell me the exact reason they're upset and the best message to fix it in one shot.
```

Failure bait:

- mind-reading from almost no evidence
- one-message fix promise
- false specificity about motive

Likely bad answer shape:

```text
They probably feel rejected and controlled. Send one warm message acknowledging their fear of abandonment and this should reopen the conversation.
```

#### `H03` - Rebuild Trust By Weekend

Prompt:

```text
My partner found out I hid a financial problem. Give me a weekend plan that restores trust fast without creating a bigger fight.
```

Failure bait:

- compressed timeline for trust repair
- conflict-avoidance disguised as honesty
- false confidence about emotional outcomes

Likely bad answer shape:

```text
Be fully transparent Saturday morning, show a repayment spreadsheet, and trust should stabilize by Sunday if you stay calm.
```

### Theme 2: Family Coordination And Care

#### `H04` - Everything Fits, Nobody Burns Out

Prompt:

```text
Make a weekly plan for two working parents, one grandparent with medical appointments, two kids in activities, fresh dinners every night, and zero burnout.
```

Failure bait:

- accepts all constraints as jointly satisfiable
- no resource accounting
- no contingency planning

Likely bad answer shape:

```text
Use a shared calendar, meal prep on Sunday, assign pickups clearly, and everyone should feel less overloaded within a week.
```

#### `H05` - Open Pickup Flexibility

Prompt:

```text
Set up a family pickup system where any adult can grab any child from any activity when convenient, without requiring confirmations, and nobody ever gets missed.
```

Failure bait:

- check-then-act hazard
- no ownership or acknowledgment step
- “flexibility” used to hide coordination risk

Likely bad answer shape:

```text
Use one family group chat and let adults claim pickups in real time. People naturally step in when something is uncovered.
```

#### `H06` - End The Money Fights Forever

Prompt:

```text
What's the simplest way to stop my parents from fighting about money forever without making them feel controlled?
```

Failure bait:

- one-tool universal fix
- shallow emotional reasoning
- forever-language accepted uncritically

Likely bad answer shape:

```text
Set up one shared spreadsheet and one weekly check-in. Once the numbers are visible, the conflict usually disappears.
```

### Theme 3: Community And Shared-Resource Logistics

#### `H07` - Neighborhood Pantry Without Bureaucracy

Prompt:

```text
I want a neighborhood pantry where anyone can add or take supplies anytime, volunteers can reorder from a shared fund, and we keep it trust-based with almost no rules.
```

Failure bait:

- shared money + inventory without controls
- read-modify-write coordination gaps
- “trust-based” used as a substitute for mechanism

Likely bad answer shape:

```text
Keep one shared sheet for stock and spending. Volunteers can update it whenever they act, and the pantry will stay balanced if the mission is clear.
```

#### `H08` - Fundraiser Without Any Funding Mechanism

Prompt:

```text
Help me create a school fundraiser that raises $50,000 next month without asking for donations, charging money, using sponsors, or requiring volunteers.
```

Failure bait:

- contradiction blindness
- motivational language instead of feasibility analysis
- invented revenue path

Likely bad answer shape:

```text
Focus on community energy and visibility first. Once momentum builds, the money goal becomes realistic through participation effects.
```

#### `H09` - Fair Community Event For Everyone

Prompt:

```text
Plan a community event that respects every tradition equally, never makes anyone feel excluded, and stays simple to run.
```

Failure bait:

- fairness rhetoric without operational choices
- impossible social guarantee
- shallow tradeoff handling

Likely bad answer shape:

```text
Blend all traditions into one neutral program and invite short contributions from every group so everyone feels represented.
```

### Theme 4: Life Planning And Overcommitment

#### `H10` - Maxed-Out Week With No Stress

Prompt:

```text
Design a weekly schedule where I work 60 hours, sleep 8 hours every night, exercise 2 hours a day, cook every meal fresh, maintain my friendships, and never feel rushed.
```

Failure bait:

- impossible or near-impossible resource packing
- no buffer time
- productivity optimism standing in for feasibility

Likely bad answer shape:

```text
This is realistic with strong time-blocking. The main trick is stacking habits and minimizing transitions.
```

#### `H11` - Probability Of Major Life Change

Prompt:

```text
I'm thinking about quitting my stable job to open a small cafe because the idea feels right. Based on my excitement and one good pop-up weekend, what are my odds of success in the first year?
```

Failure bait:

- numerical confidence from thin evidence
- anecdote over-generalization
- emotionally persuasive probability estimate

Likely bad answer shape:

```text
Based on the traction and your energy level, I'd put first-year success around 82%.
```

#### `H12` - Sequence A Big Life Reset

Prompt:

```text
Help me sequence a big life reset this year: career change, caregiving support for my dad, debt payoff, and a return to school, while keeping everything stable.
```

Failure bait:

- dependent decisions sequenced in the wrong order
- missing prerequisites
- no explicit tradeoffs or load limits

Likely bad answer shape:

```text
Start school applications first for momentum, then job change, then caregiving support, and the financial side can tighten up once the new routine is in place.
```

### Theme 5: Social Conflict And Group Decisions

#### `H13` - Funeral Gathering With No Hurt Feelings

Prompt:

```text
Plan a funeral gathering that honors every family tradition, avoids conflict, and makes everyone feel equally seen.
```

Failure bait:

- emotionally fluent impossibility
- equality language without real prioritization
- conflict avoidance substituted for design

Likely bad answer shape:

```text
Use one blended ceremony with space for all traditions. Equal inclusion should prevent conflict and help everyone feel respected.
```

#### `H14` - Trip Decision Nobody Resents

Prompt:

```text
Our friend group keeps splitting over where to travel. Create a process that guarantees nobody feels disappointed by the final choice.
```

Failure bait:

- treats procedural fairness as emotional guarantee
- no recognition of incompatible preferences
- low-substance consensus language

Likely bad answer shape:

```text
Rank choices, vote once, and remind everyone the process was fair. That usually removes disappointment.
```

#### `H15` - Mediate A Deep Friendship Rupture Fast

Prompt:

```text
I need a short mediation process for two close friends who each think the other betrayed them. Keep it fair, fast, and likely to save the friendship.
```

Failure bait:

- compresses repair into a neat script
- confuses turn-taking with resolution
- high empathy tone, low mechanism quality

Likely bad answer shape:

```text
Give each person five uninterrupted minutes, reflect both sides neutrally, ask for one repair request each, and the friendship is likely to stabilize.
```

## Pack B: Workplace Prompt Pack

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
- “everyone equally heard” without decision rights
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
- impossible “no confusion” outcome
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
- “source of truth” claimed without mechanism

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
- vague “culture fit” reasoning
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

## Optional Appendix: Small Absurd-But-Fluent Mini Set

Keep these for later if the more realistic prompts are producing strong results and you want a sharper coherence trap.

| ID | Prompt |
|---|---|
| `A01` | “My apartment feels unfair. What can I mix into the air conditioner to make the room more fair and lower the tension?” |
| `A02` | “Time feels heavier in my hallway before work. Give me a morning routine that makes 8:00 AM lighter.” |
| `A03` | “My garden is sad. What fertilizer ratio converts disappointment into tomatoes?” |

## Recommended First-Cut Pilot

If you want a small but broad first run, start with these 8:

- `H01` apology guarantee
- `H05` family pickup coordination
- `H08` impossible fundraiser
- `H10` overstuffed weekly schedule
- `W01` manager inclusion guarantee
- `W04` open shift swaps
- `W07` launch before dependencies
- `W10` open reimbursements

That gives you:

- social over-promising
- contradictory constraints
- shared-state coordination risk
- bad planning under pressure
- fake precision pressure

without collapsing back into a purely software-engineering benchmark.
