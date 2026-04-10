# W12 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Shared systems`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `detect_concurrency_patterns`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W12/opus_high/A.stderr.log`

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
## Consistent Knowledge Base with Decentralized Authorship

### Core Model: Git-Style Trunk-Based Publishing

Every team writes directly to a single canonical repository (the source of truth). No approval gates — but automated guardrails prevent inconsistency.

### Structure

```
knowledge-base/
  ├── products/           ← Product team owns
  ├── billing/            ← Finance/Ops team owns
  ├── integrations/       ← Engineering team owns
  ├── troubleshooting/    ← Support team owns
  └── _shared/            ← Cross-cutting definitions (glossary, brand terms)
```

**Ownership by directory, not by workflow.** Each team owns their section and can publish at will.

### Guardrails (Automated, Not Human)

| Layer | What it does |
|---|---|
| **Schema validation** | Every article must include: title, last-updated, owner-team, category. CI rejects malformed entries. |
| **Link checker** | Automated scan catches broken cross-references before publish. |
| **Terminology linter** | Flags deviations from `_shared/glossary.yml` (e.g., "workspace" vs. "project" vs. "account"). Teams fix or update the glossary. |
| **Duplicate detector** | Fuzzy-matches new articles against existing ones; warns if >70% overlap with another article. |
| **Diff notification** | When team A's change touches a term or concept referenced by team B's articles, team B gets notified (not blocked). |

### Consistency Without Approval

1. **Glossary as contract.** `_shared/glossary.yml` defines canonical terms. Any team can propose a glossary change; it merges after a 24-hour comment window (not a blocking approval — silence = consent).

2. **Publish-then-review.** Content goes live immediately. A weekly automated report flags articles that are stale (>90 days unchanged), orphaned (no inbound links), or contradictory (conflicting answers to the same question detected via embeddings).

3. **Single rendering pipeline.** All content feeds through one build system that produces the customer-facing site. No team maintains a separate publishing path.

### Conflict Resolution

- **Same file, same time:** Last-write-wins with full version history. The overwritten author gets notified and can merge their changes back.
- **Contradictory content across files:** The terminology linter and duplicate detector surface these. The team that owns the topic area resolves it; if ownership is ambiguous, a rotating "KB steward" (not an approver — a tiebreaker) decides within 48 hours.

### Why This Works

- **No bottleneck:** Zero humans in the publish path. Teams ship content as fast as they ship code.
- **One source of truth:** Single repo, single build, single glossary. There is no "other version."
- **Consistency via automation:** Linters and scanners enforce what style guides can't — continuously, not at review time.
```

