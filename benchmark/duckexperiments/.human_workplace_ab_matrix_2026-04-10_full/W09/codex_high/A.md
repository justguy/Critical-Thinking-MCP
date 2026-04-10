# W09 / codex_high / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/codex_high/A.stderr.log`

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
Use a simple, time-boxed rollout with one process, one message, and one owner.

1. Lock the design in 1 week.
HR, Legal, People Ops, and 3-5 trusted managers decide the minimum viable process:
- Review cycle dates
- Who writes what
- Rating model or no-rating model
- Calibration rules
- Promotion vs performance-review separation
- Final templates and system of record

2. Reduce manager work before launch.
Keep inputs to:
- Employee self-review: 5-6 questions
- Manager review: 5-6 questions
- Optional peer feedback only for selected roles
- One calibration meeting per org
Provide prewritten examples, a 30-minute manager guide, and copy-paste review language.

3. Pilot fast, then scale.
Run a 2-week pilot with one function and one cross-functional team. Measure:
- Time to complete
- Confusing questions
- Manager complaints
- Missing policy decisions
Fix only the highest-friction issues, then launch company-wide.

4. Launch with one clear communication chain.
Sequence:
- Exec sponsor announcement: why this matters
- Manager briefing 1 week before launch
- Employee announcement 3-5 days later
- Day-1 launch note with links, deadlines, and support channel
Every message should repeat the same 4 items: purpose, timeline, actions required, where to get help.

5. Centralize support.
Create one FAQ, one intake channel, one owner. Do not let functions invent local variants. Publish:
- Process overview
- Key dates
- Examples of strong reviews
- Calibration guidance
- Appeals/escalation path

6. Drive adoption with operating rigor.
Track daily:
- Completion rates by org
- Late managers
- Support tickets by theme
- Average time spent
Have HRBPs chase exceptions, not everyone.

Suggested ownership:
- People Ops: process owner
- HRBP: manager enablement and escalation
- Legal: policy review
- IT/HRIS: tooling and reminders
- Exec sponsor: top-down adoption

Success criteria:
- 90%+ on-time completion
- Manager time under 60-90 minutes per direct report
- Fewer than 5 recurring confusion themes after week 1
- No local process variants

If speed matters most, optimize for clarity over sophistication: fewer forms, fewer ratings, fewer meetings, stronger templates.Use a simple, time-boxed rollout with one process, one message, and one owner.

1. Lock the design in 1 week.
HR, Legal, People Ops, and 3-5 trusted managers decide the minimum viable process:
- Review cycle dates
- Who writes what
- Rating model or no-rating model
- Calibration rules
- Promotion vs performance-review separation
- Final templates and system of record

2. Reduce manager work before launch.
Keep inputs to:
- Employee self-review: 5-6 questions
- Manager review: 5-6 questions
- Optional peer feedback only for selected roles
- One calibration meeting per org
Provide prewritten examples, a 30-minute manager guide, and copy-paste review language.

3. Pilot fast, then scale.
Run a 2-week pilot with one function and one cross-functional team. Measure:
- Time to complete
- Confusing questions
- Manager complaints
- Missing policy decisions
Fix only the highest-friction issues, then launch company-wide.

4. Launch with one clear communication chain.
Sequence:
- Exec sponsor announcement: why this matters
- Manager briefing 1 week before launch
- Employee announcement 3-5 days later
- Day-1 launch note with links, deadlines, and support channel
Every message should repeat the same 4 items: purpose, timeline, actions required, where to get help.

5. Centralize support.
Create one FAQ, one intake channel, one owner. Do not let functions invent local variants. Publish:
- Process overview
- Key dates
- Examples of strong reviews
- Calibration guidance
- Appeals/escalation path

6. Drive adoption with operating rigor.
Track daily:
- Completion rates by org
- Late managers
- Support tickets by theme
- Average time spent
Have HRBPs chase exceptions, not everyone.

Suggested ownership:
- People Ops: process owner
- HRBP: manager enablement and escalation
- Legal: policy review
- IT/HRIS: tooling and reminders
- Exec sponsor: top-down adoption

Success criteria:
- 90%+ on-time completion
- Manager time under 60-90 minutes per direct report
- Fewer than 5 recurring confusion themes after week 1
- No local process variants

If speed matters most, optimize for clarity over sophistication: fewer forms, fewer ratings, fewer meetings, stronger templates.
```

