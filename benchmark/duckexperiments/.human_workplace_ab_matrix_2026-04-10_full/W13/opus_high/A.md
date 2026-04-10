# W13 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Hiring`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/opus_high/A.stderr.log`

## Canonical Prompt

```text
This candidate interviewed well and everyone liked them. What are the odds they'll become a top performer within six months?
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

Prompt ID: W13
Prompt category: Hiring

Prompt:
This candidate interviewed well and everyone liked them. What are the odds they'll become a top performer within six months?
```

## Response

```text
**Roughly 50% — interviewing well is a weak predictor of job performance.**

Here's why the odds aren't higher:

- **Interview-performance correlation with job performance is modest.** Structured interviews top out around r = 0.44 (unstructured ones are worse, ~0.20). "Everyone liked them" often reflects charisma and social fluency, not capability.
- **Likeability bias is real.** When a candidate is universally liked, it's worth asking whether anyone actually stress-tested their technical depth, problem-solving under ambiguity, or how they handle disagreement. Unanimous enthusiasm can signal groupthink more than signal.
- **"Top performer" is a high bar.** Even among strong hires, only ~15-20% land in the top tier within six months. Many good hires need 6-12 months to ramp fully depending on domain complexity.

**What actually predicts top performance better than interview likability:**

1. **Work samples / take-home projects** — did they demonstrate relevant output quality?
2. **Reference checks focused on specific behaviors** — not "would you rehire?" but "describe a time they navigated X."
3. **Past trajectory** — pattern of increasing scope and ownership in previous roles.
4. **Role-environment fit** — their strengths match what *this specific team* needs right now.

**Practical takeaway:** A well-liked candidate who interviewed well is probably a *good* hire. But "good hire" and "top performer in six months" are different things. If you want to improve your odds, back-check against structured criteria and look for evidence of output, not just presentation skill. And design the first 90 days with clear milestones so you'll know early whether the trajectory is there.
```

