# W09 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/opus_high/A.stderr.log`

## Canonical Prompt

```text
Help me roll out a new performance-review process across the company quickly, with strong adoption, low manager burden, and no confusion.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Answer the prompt exactly once.
- Do not use CT-MCP tools.
- Do not use any other tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.

Return only the user-facing answer.

Prompt ID: W09
Prompt category: Cross-functional planning

Prompt:
Help me roll out a new performance-review process across the company quickly, with strong adoption, low manager burden, and no confusion.
```

## Response

```text
# Performance-Review Process Rollout Plan

## Phase 1: Design (Week 1–2)

**Keep the process lightweight by default.**
- Use a single, short form (5–7 questions max) covering: results vs. goals, strengths, growth areas, and a forward-looking development action.
- One rating scale only — don't mix numeric scores with letter grades with percentile ranks.
- Decide the cadence: semi-annual is the sweet spot (quarterly burns people out, annual is too infrequent for course-correction).

**Reduce manager burden explicitly:**
- Pre-populate forms with goal data from your OKR/project tool.
- Limit written narrative to 2–3 sentences per section with clear prompts ("What is one thing this person should keep doing?").
- Give managers a calibration rubric with concrete examples for each rating level — this eliminates 80% of "how do I rate this?" questions.

## Phase 2: Align Leadership (Week 2–3)

- Brief executives first. Get them to complete their own reviews early so they can speak from experience.
- Train managers in a single 45-minute session: walk through one example review live, show the tool, answer questions. Record it for async viewers.
- Distribute a one-page FAQ covering: timeline, who reviews whom, what happens with the data, how it connects to compensation (if at all).

## Phase 3: Communicate to All Employees (Week 3)

- Send **one** announcement with: the why (what problem this solves), the what (3-bullet summary of the process), and the when (exact dates).
- Avoid jargon. "You'll answer 5 short questions about your work this half" beats "We're implementing a continuous feedback framework."
- Create a 2-minute Loom/video walkthrough of the tool — people watch, they don't read docs.

## Phase 4: Execute the First Cycle (Week 4–6)

| Milestone | Owner | Deadline |
|---|---|---|
| Self-reviews open | HR/People Ops | Day 1 |
| Self-reviews due | All employees | Day 7 |
| Manager reviews due | Managers | Day 14 |
| Calibration sessions | Leadership + HR | Day 17–19 |
| Review conversations | Managers + reports | Day 21–28 |

**Adoption tactics:**
- Daily completion dashboards visible to department heads — social accountability works.
- Slack/email nudges at 50% and 80% completion, not before (too early = noise).
- Give managers a 3-sentence script for the conversation opener to reduce anxiety on both sides.

## Phase 5: Close the Loop (Week 7)

- Run a 3-question pulse survey: Was this useful? Was it clear? What would you change?
- Share aggregated themes transparently ("You said X, we're changing Y").
- Document what worked and what to adjust before the next cycle.

## Common Pitfalls to Avoid

- **Don't launch mid-quarter or near a major deadline.** People will skip it or resent it.
- **Don't add peer reviews in v1.** Start simple, layer in complexity once the core habit is established.
- **Don't make the form longer "just in case."** Every extra field drops completion rates ~10%.
- **Don't separate the process from existing 1:1s.** The review conversation should replace a regular 1:1, not add a meeting.
- **Don't gate compensation decisions on a brand-new process.** Run the first cycle as "practice" to build trust and work out kinks.

The single biggest driver of adoption: **managers who visibly take it seriously.** If they treat it as a checkbox, everyone else will too. Invest your energy in manager enablement above all else.
```

