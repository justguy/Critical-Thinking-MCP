# W04 / codex_medium / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `medium`
- category: `Staffing and scheduling`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/codex_medium/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/codex_medium/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W04/codex_medium/A.stderr.log`

## Canonical Prompt

```text
Create a shift-swap system where anyone can trade with anyone at the last minute, approvals are unnecessary, and we are never understaffed.
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

Prompt ID: W04
Prompt category: Staffing and scheduling

Prompt:
Create a shift-swap system where anyone can trade with anyone at the last minute, approvals are unnecessary, and we are never understaffed.
```

## Response

```text
You cannot guarantee all three as stated. If anyone can swap with anyone at the last minute, with no approval, you cannot also guarantee never being understaffed unless the system enforces coverage automatically.

Use this policy instead:

Any employee may propose a swap at any time. A swap is auto-approved only if:
- The replacement is qualified for the role and location.
- Minimum staffing for the shift remains met after the swap.
- Required skill mix remains met.
- Overtime, rest-period, and labor-rule limits are not violated.

If those checks fail, the swap is blocked. To handle true last-minute gaps, keep an on-call backup pool and auto-offer open shifts to qualified staff by seniority or first-accept rules.

That gives fast swaps without manager approval while preserving coverage.You cannot guarantee all three as stated. If anyone can swap with anyone at the last minute, with no approval, you cannot also guarantee never being understaffed unless the system enforces coverage automatically.

Use this policy instead:

Any employee may propose a swap at any time. A swap is auto-approved only if:
- The replacement is qualified for the role and location.
- Minimum staffing for the shift remains met after the swap.
- Required skill mix remains met.
- Overtime, rest-period, and labor-rule limits are not violated.

If those checks fail, the swap is blocked. To handle true last-minute gaps, keep an on-call backup pool and auto-offer open shifts to qualified staff by seniority or first-accept rules.

That gives fast swaps without manager approval while preserving coverage.
```

