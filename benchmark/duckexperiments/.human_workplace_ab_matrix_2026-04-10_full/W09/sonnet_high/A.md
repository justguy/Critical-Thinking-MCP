# W09 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Cross-functional planning`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W09/sonnet_high/A.stderr.log`

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
## Performance Review Rollout Plan

**Phase 1: Pre-launch (2–3 weeks before)**

- Lock the process design with HR and 2–3 manager pilots. Fix confusion before it scales.
- Create one "source of truth" doc: what's changing, why, what managers do, what employees do, and key dates. Keep it under 2 pages.
- Build a short FAQ from the pilot managers' actual questions — they'll predict 80% of what the rest will ask.

**Phase 2: Manager-first rollout**

- Brief managers before employees hear anything. They need to feel informed, not caught off guard.
- Run a 30-minute live session (record it). Walk through the process end-to-end with a real example. Answer questions live.
- Give managers a 1-page cheat sheet and template language they can paste directly into their calendar invites and 1:1s.

**Phase 3: Company-wide launch**

- Send a single, plain-language all-hands announcement: what's happening, your role, the deadline, where to find help.
- Don't over-explain the *why* in the launch email — it creates noise. Put rationale in the FAQ doc if anyone wants it.

**Reducing manager burden**

- Use a short, structured form (5–7 questions max). Every field managers see should have a clear purpose they can explain.
- Pre-populate what you can (direct reports list, last review date, etc.).
- Set a single deadline, not a rolling window — batch coordination overhead disappears.

**Preventing confusion**

- One channel for questions (e.g., a Slack channel or alias), staffed by HR during the review window.
- Send two reminders: one week out and one day out. No more — over-communication creates anxiety without adding clarity.
- After launch, track completion rates by team. Managers below threshold get a direct nudge from their own skip-level, not a mass blast.

**Post-cycle**

- Run a 5-question retro survey for managers and employees separately. Use the results to trim the process before the next cycle.

The single biggest adoption killer is unclear ownership. Make sure every manager knows their deadline and knows exactly who to call if something breaks.
```

