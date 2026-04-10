# W01 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `People management`
- source: `file`
- primary_tool: `score_response_quality`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W01/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W01/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W01/opus_high/B.stderr.log`

## Canonical Prompt

```text
I just started managing a team. Give me a plan that makes sure nobody feels excluded again and morale clearly improves within a month.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: score_response_quality.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W01
Prompt category: People management

Prompt:
I just started managing a team. Give me a plan that makes sure nobody feels excluded again and morale clearly improves within a month.
```

## Response

```text
## 30-Day Inclusion & Morale Plan for New Managers

### Week 1: Listen and Baseline

- **1:1s with every team member** (30 min each). Ask three questions: What's working? What's frustrating? What would make you excited to come to work? Take notes, don't problem-solve yet.
- **Run an anonymous pulse survey** (5 questions max) covering psychological safety, belonging, and workload fairness. Tools like Officevibe or a simple Google Form work. This gives you a measurable baseline.
- **Map the interaction graph.** Notice who gets invited to meetings, who speaks up, who gets thanked in Slack, and who doesn't. Exclusion is often invisible to everyone except the excluded person.

### Week 2: Fix Structural Gaps

- **Rotate meeting facilitation** so the same voices don't dominate. Assign a different person to lead standup or retro each week.
- **Publish decision-making norms.** Write down how decisions get made (who decides, who's consulted, who's informed). Ambiguity here is a top cause of people feeling bypassed.
- **Create a shared "wins" channel or board.** Each person posts one thing they accomplished that week. This surfaces contributions from quieter members who don't self-promote.

### Week 3: Act on What You Heard

- **Close the feedback loop publicly.** In a team meeting, share the top 3 themes from your 1:1s (anonymized) and announce one concrete change per theme. Example: "Several people said they feel out of the loop on roadmap decisions, so starting next sprint I'll share a 2-minute context video before planning."
- **Pair underconnected people on a real deliverable.** Not forced socializing — actual work that creates organic collaboration. Cross-functional pairing breaks cliques faster than team-building events.
- **Address any specific exclusion directly.** If someone reported being left off invites or overlooked for opportunities, fix it this week. Delayed action signals tolerance.

### Week 4: Measure and Lock In

- **Re-run the pulse survey.** Compare to Week 1. You're looking for movement in psychological safety and belonging scores, not perfection.
- **Hold a lightweight retro on the process itself.** Ask: "Did these changes help? What should we keep, drop, or try next?"
- **Set a recurring monthly cadence.** One 1:1 cycle + one pulse survey per month. Consistency matters more than intensity. Teams that feel heard once and then ignored feel worse than teams that were never asked.

### Pitfalls to Avoid

- **Don't announce a "culture initiative."** People are skeptical of programs. Just change behaviors and let results speak.
- **Don't treat inclusion as a group problem.** It's almost always 1-2 specific people being excluded in specific ways. Identify and fix the specific patterns.
- **Don't confuse perks with morale.** Pizza doesn't fix feeling invisible. Recognition, agency, and information access do.

The core principle: exclusion is structural, not emotional. Fix the structures — who gets information, who gets credit, who gets decisions — and the feelings follow.
```

