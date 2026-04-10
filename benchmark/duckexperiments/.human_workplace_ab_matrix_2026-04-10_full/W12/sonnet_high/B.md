# W12 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Shared systems`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `detect_concurrency_patterns`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/sonnet_high/B.stderr.log`

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
## Approval-free multi-team knowledge base with a single source of truth

**Core model: Git-as-source-of-truth + automated gates**

### Structure

| Layer | Decision |
|---|---|
| Source of truth | Single Git repo; all content lives here |
| Ownership | Each team owns a namespace (`/support/`, `/eng/`, `/billing/`, etc.) |
| Cross-team edits | Allowed — no approval gate, but a 24h async comment window in the PR description |
| Publishing | CD pipeline: merge to `main` → auto-publish |

---

### The flow

1. **Branch** — team creates a short-lived branch from `main`
2. **Edit** — makes changes in their namespace (or elsewhere)
3. **PR** — opens PR; CI runs automatically:
   - Structure validation (required frontmatter, headings, etc.)
   - Broken link check
   - Style/tone linter
   - Spell check
4. **Merge** — CI green = merge allowed, no human reviewer required
   - Git handles concurrent edits naturally; conflict forces explicit resolution before CI can pass
5. **Publish** — CD pipeline deploys the updated site within minutes

---

### Concurrency safety

The concurrency analysis found **zero hazards** with this setup. Key protections:
- **Namespace isolation** prevents most conflicts by design
- **Git merge conflict detection** forces explicit resolution when two teams touch the same file — neither silently overwrites the other
- **CI re-runs after rebase** — a branch that passed CI on stale `main` must pass again on the current `main` before merge

---

### Consistency guarantees

- **Attribution**: every change is tied to a commit, author, and timestamp — full audit log
- **Rollback**: `git revert` restores any article to any prior state in under a minute
- **No drift**: the site can only contain content that passed CI and merged to `main` — no parallel "live edit" paths

---

### Failure modes to guard against

| Risk | Mitigation |
|---|---|
| Team edits another team's content inappropriately | CODEOWNERS file sends a Slack notification (not a block) to the owning team |
| CI rules are too strict and bottleneck publishing | CI rules are owned in the repo; any team can open a PR to relax them |
| Stale branches diverge badly | Enforce max branch age (e.g., 3 days) via CI check |

---

**The single source of truth is `main`. Nothing publishes that didn't pass CI and merge there. No approvals needed — the automated gates are the guardrail.**
```

