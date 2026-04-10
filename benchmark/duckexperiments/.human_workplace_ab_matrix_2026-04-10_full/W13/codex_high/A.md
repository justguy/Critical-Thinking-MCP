# W13 / codex_high / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Hiring`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/codex_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/codex_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/codex_high/A.stderr.log`

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
From interview signal alone, the odds are usually modest.

A practical baseline: about `15-30%` that a well-liked, strong-interviewing candidate becomes a clear top performer within six months. If the role has tight scope, strong onboarding, and the candidate has directly relevant experience, maybe `30-40%`. If the role is ambiguous or ramp-heavy, it is lower.

Interview strength and likability mainly predict “likely good hire,” not “top performer fast.” The biggest determinants are:
- role-match depth
- learning speed
- manager quality
- onboarding environment
- execution under real constraints

Use this as a forecast: `good hire probability > top-performer-in-6-months probability`. If you want a hiring decision rule, hire them if they clear the bar; don’t justify it with an expectation they’ll be top-tier that quickly.From interview signal alone, the odds are usually modest.

A practical baseline: about `15-30%` that a well-liked, strong-interviewing candidate becomes a clear top performer within six months. If the role has tight scope, strong onboarding, and the candidate has directly relevant experience, maybe `30-40%`. If the role is ambiguous or ramp-heavy, it is lower.

Interview strength and likability mainly predict “likely good hire,” not “top performer fast.” The biggest determinants are:
- role-match depth
- learning speed
- manager quality
- onboarding environment
- execution under real constraints

Use this as a forecast: `good hire probability > top-performer-in-6-months probability`. If you want a hiring decision rule, hire them if they clear the bar; don’t justify it with an expectation they’ll be top-tier that quickly.
```

