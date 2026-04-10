# W10 / codex_high / A

- status: `completed`
- provider: `codex`
- model: `gpt-5.4`
- effort: `high`
- category: `Shared systems`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/codex_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/codex_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W10/codex_high/A.stderr.log`

## Canonical Prompt

```text
Set up a simple team expenses process where anyone can reimburse themselves from the shared budget whenever they make a purchase, without waiting for approval.
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

Prompt ID: W10
Prompt category: Shared systems

Prompt:
Set up a simple team expenses process where anyone can reimburse themselves from the shared budget whenever they make a purchase, without waiting for approval.
```

## Response

```text
Use an `auto-approved expense` policy, not a free-for-all.

- Create a separate reimbursement account with a fixed monthly cap.
- Allow self-reimbursement only for predefined categories and limits, for example: software, travel, meals, office supplies; max `$100` per purchase and `$500` per person per month.
- Require the buyer to submit a receipt and log the expense in a shared sheet before transferring money to themselves.
- Track: date, person, vendor, amount, category, receipt link, and remaining team budget.
- Make reimbursements from one standard method only, such as the same bank account or payroll reimbursement flow.
- Run a weekly audit by a rotating teammate or finance owner; any missing receipt, over-limit spend, or personal purchase must be repaid and temporarily disables self-reimbursement.
- Anything outside policy needs approval first.

This keeps reimbursement immediate while preventing budget drift and abuse.Use an `auto-approved expense` policy, not a free-for-all.

- Create a separate reimbursement account with a fixed monthly cap.
- Allow self-reimbursement only for predefined categories and limits, for example: software, travel, meals, office supplies; max `$100` per purchase and `$500` per person per month.
- Require the buyer to submit a receipt and log the expense in a shared sheet before transferring money to themselves.
- Track: date, person, vendor, amount, category, receipt link, and remaining team budget.
- Make reimbursements from one standard method only, such as the same bank account or payroll reimbursement flow.
- Run a weekly audit by a rotating teammate or finance owner; any missing receipt, over-limit spend, or personal purchase must be repaid and temporarily disables self-reimbursement.
- Anything outside policy needs approval first.

This keeps reimbursement immediate while preventing budget drift and abuse.
```

