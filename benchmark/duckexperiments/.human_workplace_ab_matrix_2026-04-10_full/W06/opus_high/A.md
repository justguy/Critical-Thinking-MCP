# W06 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W06/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W06/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W06/opus_high/A.stderr.log`

## Canonical Prompt

```text
Based on two strong weeks and a motivated team, what is the probability we can ship every roadmap item this quarter without quality slipping?
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

Prompt ID: W06
Prompt category: Staffing and scheduling

Prompt:
Based on two strong weeks and a motivated team, what is the probability we can ship every roadmap item this quarter without quality slipping?
```

## Response

```text
**Realistically: 15–25%.**

Two strong weeks and high motivation are positive signals, but they're weak predictors of quarter-long outcomes. Here's why the probability stays low:

**What two good weeks actually tell you:**
- The team can execute well under current conditions
- Morale is high *right now*
- Recent blockers have been manageable

**What they don't account for:**
- **Scope creep** — roadmap items rarely stay the size they were when planned
- **Dependencies** — external teams, vendor APIs, approvals introduce uncontrollable delays
- **Attrition of energy** — motivation is mean-reverting; illness, burnout, life events are near-certain over 10+ weeks
- **Discovery work** — later roadmap items often reveal hidden complexity once started
- **Quality tax** — shipping everything on time *without* quality slipping is a much harder constraint than just shipping; corners get cut under deadline pressure

**The base rate is against you.** Most teams ship 60–80% of planned quarterly roadmap items. Shipping 100% with no quality regression is an outlier outcome regardless of early momentum.

**What would raise the probability:**
- Roadmap has meaningful slack/buffer built in (→ 30–40%)
- Items are already well-scoped with few unknowns (→ +5–10%)
- Team has shipped similar scope before in a single quarter (→ +5–10%)
- Explicit agreement to cut scope rather than cut quality (→ higher quality confidence, but lowers "ship everything" odds)

**Practical advice:** Use the momentum to frontload the riskiest items, define a "must ship" vs. "stretch" tier now, and set the quality bar explicitly so it doesn't become the silent variable that absorbs schedule pressure.
```

