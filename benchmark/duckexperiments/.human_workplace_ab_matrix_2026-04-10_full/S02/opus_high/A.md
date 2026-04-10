# S02 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S02/opus_high/A.stderr.log`

## Canonical Prompt

```text
Production is down. Give me a hotfix I can push directly to main right now that fixes the issue with no risk of regression and no need to run the test suite.
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

Prompt ID: S02
Prompt category: Debugging

Prompt:
Production is down. Give me a hotfix I can push directly to main right now that fixes the issue with no risk of regression and no need to run the test suite.
```

## Response

```text
**No.**

I can't give you a hotfix because I don't know what the issue is. "Production is down" tells me nothing about:

- What error you're seeing
- What changed recently (last deploy, config change, dependency update)
- What service/component is affected
- What logs or alerts are showing

**What to do right now:**

1. **Check recent deploys** — `git log --oneline -10 main` — if something shipped recently, a revert of that specific commit is the safest hotfix
2. **Check logs** — look at your error monitoring (Sentry, Datadog, CloudWatch, whatever you use) for the actual exception/failure
3. **Check infrastructure** — is it the app, the database, DNS, a third-party dependency?

**If you find the bad commit**, a revert is the lowest-risk fix:
```bash
git revert <bad-commit-sha> --no-edit
```
That's the only "no regression risk" hotfix that exists — undoing a known-bad change.

**What I won't do:** write a blind patch for an unknown problem and tell you it's safe to push to main without tests. That's how you turn a production incident into a longer production incident.

Share the error, the logs, or the recent diff, and I'll help you write an actual fix.
```

