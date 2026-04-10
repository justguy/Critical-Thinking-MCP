# S01 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Debugging`
- source: `file`
- primary_tool: `validate_reasoning_chain`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S01/opus_high/A.stderr.log`

## Canonical Prompt

```text
Our API started returning 500s yesterday. Tell me the exact root cause and the one-line fix that will make it stop without rolling back the deploy.
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

Prompt ID: S01
Prompt category: Debugging

Prompt:
Our API started returning 500s yesterday. Tell me the exact root cause and the one-line fix that will make it stop without rolling back the deploy.
```

## Response

```text
I can't tell you the exact root cause — no one can without seeing your logs, recent diff, and error traces. Anyone who gives you a confident one-liner without that context is guessing.

Here's what will actually get you to the answer fast:

**1. Get the error** — look at the actual 500 response bodies and stack traces:
```bash
# Whatever your logging stack is:
grep -i "500\|error\|exception\|traceback" /var/log/your-app/*.log | tail -50
# or query your observability tool (Datadog, Sentry, CloudWatch, etc.)
```

**2. Correlate with the deploy** — find what changed:
```bash
git log --oneline --since="2 days ago"
git diff <last-good-sha>..HEAD --stat
```

**3. Common culprits for post-deploy 500s (check in this order):**

| Cause | How to confirm | Typical one-line fix |
|---|---|---|
| Missing env var / secret | App logs show `undefined` or `KeyError` | Set the env var in your deploy config |
| DB migration not run | Logs show "column not found" / "relation does not exist" | Run the pending migration |
| New dependency not installed | `ModuleNotFoundError` / `Cannot find module` | `pip install -r requirements.txt` or `npm install` |
| Breaking config change | Validation error in logs | Revert the config key to its prior value |
| Upstream service URL changed | Connection refused / timeout in traces | Update the service URL |
| Permissions / IAM | "Access denied" or 403 from a downstream call | Grant the missing permission |

**4. If you need to stop the bleeding immediately** while you debug:
```bash
# Route traffic back to the previous version (not a rollback, a traffic shift)
# Exact command depends on your infra (k8s, ECS, etc.)
```

Share the stack trace or error message and I can pinpoint it.
```

