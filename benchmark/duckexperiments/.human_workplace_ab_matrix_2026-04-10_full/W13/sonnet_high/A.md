# W13 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Hiring`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/sonnet_high/A.stderr.log`

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
Liking someone in an interview is a weak signal for top performance. The research is consistent: interview performance (especially unstructured interviews focused on likability) predicts job performance at roughly r=0.2–0.38 correlation, meaning a lot of the variance in outcomes is unexplained.

**Honest answer: you don't have enough information to give meaningful odds.**

What actually predicts top performance within 6 months:

- **Role-specific factors**: Is "top performer" well-defined? Sales has clear metrics; many roles don't.
- **Onboarding quality**: How quickly people ramp matters as much as raw ability.
- **Structural signals you haven't mentioned**: Work samples, structured competency assessments, reference checks on past performance, track record in analogous roles.

**If forced to estimate with only "interviewed well + everyone liked them":**

Base rates for any new hire becoming a top performer (top quintile) within 6 months hover around 15–25% depending on the role and how your company defines it. Positive interview performance and team buy-in might nudge that to 25–35%—but "everyone liked them" can reflect cultural fit bias and halo effects as much as real capability.

The more useful question: what evidence do you have about their *past* performance in comparable roles? That data—not the interview impression—is where the predictive signal lives.
```

