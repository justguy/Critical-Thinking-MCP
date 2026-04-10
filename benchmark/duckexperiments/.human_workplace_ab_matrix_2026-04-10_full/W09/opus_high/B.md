# W09 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/opus_high/B.stderr.log`

## Canonical Prompt

```text
Help me roll out a new performance-review process across the company quickly, with strong adoption, low manager burden, and no confusion.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W09
Prompt category: Cross-functional planning

Prompt:
Help me roll out a new performance-review process across the company quickly, with strong adoption, low manager burden, and no confusion.
```

## Response

```text
Here is an 8-step rollout plan for a new performance-review process optimized for speed, adoption, low manager burden, and clarity.

**Phase 1 — Design (Week 1)**
1. **Define the process.** Use lightweight quarterly check-ins with 3-5 focused questions (e.g., "What did this person do well?", "What should they focus on next quarter?", "Any concerns?"). Skip complex rating scales — they add friction without proportional value. Keep each review completable in under 15 minutes per direct report.

**Phase 2 — Prepare (Week 2)**
2. **Get executive sponsorship.** Have the CEO or relevant C-suite leader visibly endorse the new process. This is the single biggest driver of adoption — without it, managers treat it as optional HR busywork.
3. **Configure tooling.** Set up the review form in your HRIS (or even a simple Google Form). One link, one place. No ambiguity about where to go.
4. **Create a one-page guide + 2-minute video.** Cover: what changed, why, exactly what managers do, and the deadline. Do not create a 30-slide deck — nobody reads it.

**Phase 3 — Validate (Week 3)**
5. **Pilot with 2-3 friendly managers.** Ask them to complete the process and report: Was anything confusing? How long did it take? Adjust before going wide.

**Phase 4 — Launch (Week 4)**
6. **Single, clear launch communication.** One email from the exec sponsor with: the guide, the video, the tool link, and the deadline. Pin it in Slack/Teams. Do not drip-feed multiple confusing announcements.

**Phase 5 — Drive Completion (Weeks 4-6)**
7. **Track and nudge.** Monitor completion rates via the tool dashboard. Send targeted reminders only to managers who haven't completed — not company-wide blasts that annoy people who already finished. Escalate through leadership if needed.

**Phase 6 — Learn (After Cycle 1)**
8. **Retrospective survey (5 questions).** Ask managers what was unclear, what took too long, and what to change. Iterate for next quarter.

**Key principles:**
- Fewer questions = higher completion. Every question you add costs you adoption.
- One communication, one tool, one deadline. Confusion comes from fragmentation.
- Exec backing is non-negotiable. Without it, expect passive resistance.
- Nudge the stragglers, not the crowd. Broadcast reminders punish the compliant.
- Ship fast, iterate after. A good-enough process launched this month beats a perfect one launched in six months.
```

