# W09 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/sonnet_high/B.stderr.log`

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
**Performance Review Rollout: Fast, High-Adoption, Low-Burden**

**Phase 1 — Design (Weeks 1–2)**
- Lock the process: criteria, rating scale, cadence, and form fields. Get HR, legal, and an exec sponsor aligned before anything is announced.
- Parallelize: start HRIS configuration (forms, deadlines, auto-reminders) at the same time.

**Phase 2 — Pilot (Weeks 3–4)**
- Run a dry cycle with 1–2 representative teams.
- Collect friction points from managers and employees. Fix them before building training.

**Phase 3 — Toolkit + Tooling (Week 5)**
- Build the manager toolkit from pilot learnings: one-page guide, conversation templates, FAQ, and a 5-minute video walkthrough.
- Finalize the HRIS setup with manager dashboards and automated deadline reminders.

**Phase 4 — Communicate + Train (Week 6)**
- Exec-sponsored company-wide announcement: what's changing, why, timeline, where to get help.
- 30-minute manager training (live or recorded). Focus on the toolkit and escalation path — not policy details.

**Phase 5 — Run the Cycle**
- HR monitors completion rates in real time and proactively contacts at-risk teams mid-cycle.
- No surprises: managers see their own completion dashboard.

**Phase 6 — Close + Improve**
- Publish completion stats to leadership.
- Run a short retrospective. Update the process before the next cycle.

**Key principles that drive adoption and reduce burden:**
- Managers get one clear, short toolkit — not a policy doc to interpret.
- Automated reminders do the nagging, not HR.
- Exec visibility on completion creates accountability without HR chasing people.
- The pilot means the first real cycle is already de-risked.
- The retrospective turns it into a system that improves, not a one-time initiative.
```

