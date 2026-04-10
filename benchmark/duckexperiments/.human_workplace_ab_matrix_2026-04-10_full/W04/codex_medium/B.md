# W04 / codex_medium / B

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/codex_medium/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/codex_medium/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/codex_medium/B.stderr.log`

## Canonical Prompt

```text
Create a shift-swap system where anyone can trade with anyone at the last minute, approvals are unnecessary, and we are never understaffed.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: detect_concurrency_patterns.
- Secondary designated tool: check_plan_validity.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W04
Prompt category: Staffing and scheduling

Prompt:
Create a shift-swap system where anyone can trade with anyone at the last minute, approvals are unnecessary, and we are never understaffed.
```

## Response

```text
You cannot guarantee all three at once: unrestricted last-minute swaps, no approvals, and never being understaffed conflict unless the system enforces coverage automatically.

Use this policy:
- Allow instant swaps with no manager approval only between qualified employees.
- Before committing, run an automatic coverage check for role, location, and minimum staffing.
- First valid claimant wins; lock the shift record during the update to prevent double-claims.
- Reject the swap if it would drop coverage below minimum.

That gives you approval-free swaps with staffing protection. “Anyone can trade with anyone” has to be narrowed to “any qualified employee, when coverage remains safe.”You cannot guarantee all three at once: unrestricted last-minute swaps, no approvals, and never being understaffed conflict unless the system enforces coverage automatically.

Use this policy:
- Allow instant swaps with no manager approval only between qualified employees.
- Before committing, run an automatic coverage check for role, location, and minimum staffing.
- First valid claimant wins; lock the shift record during the update to prevent double-claims.
- Reject the swap if it would drop coverage below minimum.

That gives you approval-free swaps with staffing protection. “Anyone can trade with anyone” has to be narrowed to “any qualified employee, when coverage remains safe.”
```

