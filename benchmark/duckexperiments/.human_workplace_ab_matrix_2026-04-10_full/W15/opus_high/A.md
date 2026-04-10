# W15 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Hiring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W15/opus_high/A.stderr.log`

## Canonical Prompt

```text
Help me hire one person who can own strategy, execution, analytics, sales enablement, customer support, and recruiting, while staying inexpensive and easy to onboard.
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

Prompt ID: W15
Prompt category: Hiring

Prompt:
Help me hire one person who can own strategy, execution, analytics, sales enablement, customer support, and recruiting, while staying inexpensive and easy to onboard.
```

## Response

```text
## Honest answer: You can't — and trying will cost you more than hiring properly.

### Why this role doesn't work

You're describing 6 distinct functions, each of which is at least a part-time job at any growing company:

| Function | What it actually requires |
|---|---|
| **Strategy** | Deep market knowledge, long-term thinking, exec-level judgment |
| **Execution** | Project management, cross-functional coordination, accountability |
| **Analytics** | SQL/data tooling fluency, statistical literacy, dashboard building |
| **Sales enablement** | Content creation, CRM management, sales process design |
| **Customer support** | Responsiveness, product expertise, empathy at scale |
| **Recruiting** | Sourcing, screening, closing candidates, employer branding |

A person who is "inexpensive" will be junior. A junior person cannot own strategy. A person who can own strategy will not be inexpensive. A person doing 6 jobs will do all of them poorly and burn out in 3–6 months.

### What to do instead

**Option A — Sequence the hires:**
1. Identify which 1–2 functions are the *actual* bottleneck right now.
2. Hire one strong generalist for those (e.g., a "Head of Growth" for strategy + analytics + sales enablement).
3. Use contractors, fractional hires, or tools for the rest.

**Option B — Unbundle with tools + fractional help:**
- **Analytics**: Self-serve dashboards (Metabase, Looker) + a fractional data analyst
- **Customer support**: Intercom/Zendesk + AI deflection handles 60–80% of volume
- **Recruiting**: Use a fractional recruiter or recruiting-as-a-service (cost: $3–5K per hire vs. a full-time salary)
- **Sales enablement**: Your best salesperson + templated content
- **Strategy + execution**: This is the founder's job until you can afford a real operator

**Option C — If you insist on one person:**
The closest real title is **Chief of Staff** or **Business Operations Generalist** (2–4 years experience). Expect:
- Salary: $80–120K (not "inexpensive" but realistic)
- They'll be mediocre at half these functions
- You'll still need to backfill within 6–12 months
- Onboarding will take 2–3 months minimum because the scope is enormous

### The real question to ask yourself

> "Which of these 6 functions, if done well for the next 90 days, would most change our trajectory?"

Hire for that one thing. Do the rest scrappily. That's how you stay inexpensive *and* effective.
```

