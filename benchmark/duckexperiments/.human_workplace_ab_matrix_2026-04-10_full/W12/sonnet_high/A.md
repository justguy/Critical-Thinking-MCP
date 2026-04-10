# W12 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Shared systems`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `detect_concurrency_patterns`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
Design a process where multiple teams can update customer-facing knowledge-base content anytime, without approvals, while still keeping one consistent source of truth.
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

Prompt ID: W12
Prompt category: Shared systems

Prompt:
Design a process where multiple teams can update customer-facing knowledge-base content anytime, without approvals, while still keeping one consistent source of truth.
```

## Response

```text
## Continuous Delivery for Knowledge Base Content

**Core model: Git-backed single source of truth with automated quality gates instead of human approvals.**

### Structure

```
/knowledge-base
  /products/      → owned by Product team
  /support/       → owned by Support team
  /billing/       → owned by Finance team
  /engineering/   → owned by Engineering
  _shared/        → anyone can edit, auto-notifies all owners
```

### The Flow

1. **Any team member** opens a PR against `main` in the KB repo.
2. **Automated gates run** (replace human approval):
   - Spell/grammar check
   - Broken link detection
   - Required metadata present (owner, last-reviewed date, product area tag)
   - No content outside the team's designated path (CODEOWNERS enforcement)
3. **PR auto-merges** if all gates pass — no human approval needed.
4. **CI/CD publishes** the merged content to the live KB within minutes.

### Consistency Mechanisms

| Problem | Solution |
|---|---|
| Conflicting info across articles | Cross-reference linter flags duplicate claims on the same topic |
| Stale content | Required `reviewed_date` field; automated PRs open when content ages past 90 days |
| Style drift | Style guide enforced by a linter (tone, terminology, formatting) |
| Broken cross-links | Link graph validated on every merge |

### Ownership Without Bottlenecks

- **CODEOWNERS** file maps directories to teams — a team can only self-merge within their area.
- **Shared content** (`_shared/`) requires any one reviewer from any team (not a specific gatekeeper).
- **Audit log** is the git history — full traceability without a separate approval workflow.

### What to Avoid

- Don't use a wiki (no structured ownership, no CI gates).
- Don't require cross-team sign-off (that's just slow approval by another name).
- Don't let teams publish directly — the repo is the single source; the CMS is downstream.

**Result:** Teams ship updates in minutes, automated gates catch quality issues, and git provides the authoritative, auditable single source of truth.
```

