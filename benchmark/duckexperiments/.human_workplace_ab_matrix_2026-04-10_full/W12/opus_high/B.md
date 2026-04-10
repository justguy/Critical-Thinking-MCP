# W12 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Shared systems`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `detect_concurrency_patterns`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/opus_high/B.stderr.log`

## Canonical Prompt

```text
Design a process where multiple teams can update customer-facing knowledge-base content anytime, without approvals, while still keeping one consistent source of truth.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: detect_concurrency_patterns.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W12
Prompt category: Shared systems

Prompt:
Design a process where multiple teams can update customer-facing knowledge-base content anytime, without approvals, while still keeping one consistent source of truth.
```

## Response

```text
## Process: Approval-Free, Multi-Team Knowledge Base with a Single Source of Truth

### Foundation

Use a **Git-backed repository** (Markdown or structured files) as the canonical source. Every article, FAQ, and guide lives in version-controlled files. Git *is* the source of truth — not the published site, not a CMS database.

### How teams contribute (no approvals required)

1. **Branch-per-change.** Any team member creates a short-lived branch, edits content directly, and opens a pull request.
2. **Automated CI gates replace human approvals.** On every PR, CI automatically:
   - Lints prose (spelling, grammar, tone via a shared style guide)
   - Validates internal links and media references
   - Checks for duplicate article slugs or conflicting metadata
   - Runs schema validation on structured frontmatter
3. **Auto-merge on green CI.** If all checks pass, the PR merges to `main` without any human sign-off.

### Keeping one consistent source of truth

| Concern | Mechanism |
|---|---|
| **Ownership visibility** | A `CODEOWNERS`-style manifest notifies the owning team when their section is edited — but never blocks the merge. |
| **Merge conflicts** | Git's merge-conflict detection + mandatory rebase-before-merge prevents silent overwrites when two teams edit the same article. |
| **Idempotent publishing** | The CD pipeline deploys using a **content-hash key** so duplicate or retried triggers don't produce inconsistent state. Only a new hash triggers a real deploy. |
| **Instant rollback** | Every change is revertible via `git revert` → auto-publish. A one-click rollback runbook makes recovery trivial. |
| **Drift detection** | A scheduled reconciliation job compares the repo state against the live site and alerts if they diverge. |

### Handling concurrent edits to the same article

When two teams edit the same file simultaneously:
- Git merge-conflict detection surfaces the collision at PR time.
- The second team rebases, resolves the conflict in their branch, and CI re-runs.
- No work is lost; no silent overwrite occurs.

### Why this works without approvals

- **Speed:** Teams ship content updates in minutes, not days.
- **Safety:** Automated linting + link checking catches the errors that approvals were meant to catch.
- **Consistency:** One repo, one branch (`main`), one publish pipeline — no CMS sync issues or copy-paste drift.
- **Accountability:** Git blame and PR history provide a full audit trail per line.
```

