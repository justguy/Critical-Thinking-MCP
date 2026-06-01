# AGENTS.md

## TPF Token Proxy Filter

TPF reduces token consumption by filtering noisy command output. It wraps commands transparently; arguments are passed through exactly. Output is trimmed by recipes to remove noise while keeping what matters.

### How to prefix commands

Prefix all shell commands with `TPF_LLM_TOOL=codex tpf`:

- `TPF_LLM_TOOL=codex tpf git status`
- `TPF_LLM_TOOL=codex tpf npm test`
- `TPF_LLM_TOOL=codex tpf rg "pattern" src/`

Arguments are passed directly to the command. Write the command exactly as it would be written without `tpf`, then add the prefix.

### Commands to never prefix

Do not prefix:

`cd`, `echo`, `cat`, `head`, `tail`, `mkdir`, `rm`, `mv`, `cp`, `chmod`, `pwd`, `export`, `source`, `set`, `unset`, `alias`, `read`, `printf`, `test`, `true`, `false`, `which`, `touch`.

### Piped commands

For piped commands, set `TPF_PIPE` with the pipe part. The first command keeps exact argv.

- `TPF_PIPE='head -20' TPF_LLM_TOOL=codex tpf git log --oneline`
- `TPF_PIPE='grep FAILED' TPF_LLM_TOOL=codex tpf npm test`

### Chained commands

Prefix each command separately. Skip ignored commands.

- `cd /tmp && TPF_LLM_TOOL=codex tpf git status`
- `TPF_LLM_TOOL=codex tpf npm run build && TPF_LLM_TOOL=codex tpf npm test`

### What not to wrap

Do not prefix commands that use redirections (`>`, `<`), logical OR (`||`), background execution (`&`), or subshells (`$()`, backticks). Use `TPF_LLM_TOOL=codex tpf exec 'command here'` only when full unfiltered shell behavior is required.

## StackOS and Subagents

When the user asks to use StackOS to drive a run, treat the StackOS workflow as the durable execution contract, not just background context.

Required behavior:

- Start or resolve the StackOS workspace first and use the workspace-bound `project_id`.
- Prefer a workflow-backed run plan for engineering delivery. If the UI approval path is unavailable or display-only, record that blocker in tracker state and use the StackOS tracker as the active execution source of truth.
- Keep the canonical workflow tracker task and tickets current. Do not split execution truth across an ad hoc manual task and the generated workflow task.
- Use the workflow's required and recommended roles to decide which specialist subagents should participate.

Subagent guidance:

- If the user explicitly asks for StackOS agents, subagents, delegated work, or a StackOS workflow with named roles, spawn relevant subagents when tooling is available.
- Map StackOS SDLC roles to subagent work:
  - `requirements-flow-definer`: requirements, acceptance criteria, non-goals, evidence expectations.
  - `codebase-explorer`: read-only impact mapping across runtime, tests, docs, and contracts.
  - `planning`: tracker slicing, dependency graph, definitions of done.
  - `architecture`: ownership boundaries, contract design, migration/compatibility risks.
  - `test-designer`: proof surfaces, benchmark design, verification commands.
  - `delivery`: scoped implementation with disjoint file ownership.
  - `delivery-reviewer`: findings-first review of behavior, tests, docs, evidence, and release risk.
  - `release-ops`: closeout, release claims, limitations, and post-release checks.
- Spawn read-only explorer/test-designer subagents in parallel for independent investigation.
- Spawn worker subagents only for bounded implementation slices with disjoint write scopes.
- Tell subagents the repo may be dirty and they must not revert unrelated user or agent changes.
- Integrate subagent outputs into durable artifacts and StackOS tracker evidence, then close the subagents when done.

For CT-MCP value-discovery work, use specialist subagents at minimum for:

- Codebase impact mapping of `src/mcp`, `src/tools`, `src/host`, and proof tests.
- Benchmark/test-design mapping of `benchmark/`, `benchmark/value_pilot/`, `benchmark/proof/`, `benchmark/scoring/`, and `tests/proof/`.

Subagent handoffs must include:

- Scope covered and files read or changed.
- Concrete findings with file references when applicable.
- Tests or commands run, plus any commands not run.
- Remaining risks, blockers, and recommended next step.

The main Codex thread remains responsible for tracker truth, final decisions, integration patches, verification, and user-facing status.

Choose subagent reasoning level deliberately:

- High reasoning: architecture, cross-module data flow, MCP protocol contracts, host enforcement, release gates, numeric proof design, benchmark validity, and adversarial review.
- Medium reasoning: scoped implementation, targeted test repair, benchmark fixture updates, docs/report updates, and tracker maintenance.
- Low reasoning: mechanical search, file inventory, formatting checks, copy edits, and narrow documentation alignment.

## Scoped Instructions

Read nested `AGENTS.md` files before editing within a subtree. The nearest scoped file applies first, then parent scopes, then this root file.

Treat `AGENTS.md` files as operational guidance and maintenance artifacts. If code, tests, or schemas disagree with guidance, trust the implementation while investigating, then update the relevant guidance in the same change when the rule has become stale.

Scoped files should stay short and actionable:

- Source-of-truth files for that subtree.
- Non-negotiable ownership, contract, or verification rules.
- Adjacent scopes that need impact review.
- Subtree-specific test commands or artifact locations.

## Worktree and Change Scope

Assume the worktree may already contain user or prior-agent changes. Inspect status before broad edits, do not revert unrelated changes, and do not use broad staging such as `git add .` when unrelated changes exist.

Keep changes surgical:

- Touch only files needed for the request.
- Match existing style and ownership boundaries.
- Do not refactor adjacent code unless it is required for the change.
- Remove only unused code introduced by the current change.
- Mention unrelated dead code or debt in notes instead of editing it opportunistically.

## Operator-Controlled Services

Treat running local services as operator-owned. Read-only diagnostics such as process listings, port checks, health endpoints, and log tails are allowed. Do not kill, restart, relaunch, or mutate a running service unless the user explicitly approves that action or the current task has a clearly recorded lifecycle approval.

Before requesting approval for a service lifecycle change, state the service or PID, reason, expected impact, and command class. If a run is stuck, report the failed health check and proposed action before recovery.

## Evidence and Artifacts

Do not claim a build, test, benchmark, proof, or product-value result unless it actually ran in this session or is cited as prior evidence with date and source.

For CT-MCP value-discovery work:

- Keep durable findings in artifacts such as `VALUE_GAP_REPORT.md`, `VALUE_BACKLOG.jsonl`, `benchmark/tasks/*.jsonl`, `benchmark/defects/*.jsonl`, and `benchmark/results/*.jsonl`.
- Distinguish deterministic proof from product-value proof.
- Record blockers and partial proof honestly instead of turning them into success claims.
- Do not leave important failure classifications, value scores, or benchmark outcomes only in chat.

Generated logs, ad hoc screenshots, temporary benchmark output, and exploratory scratch should stay in ignored temp owners unless the report or test suite deliberately references them.

## Verification Discipline

Use the narrowest useful verification first, then expand when shared behavior, public contracts, host enforcement, or benchmark claims change.

Common commands:

- Build: `TPF_LLM_TOOL=codex tpf npm run build`
- Tests: `TPF_LLM_TOOL=codex tpf npm test`
- Focused Vitest: `TPF_LLM_TOOL=codex tpf npm test -- <path>`
- Benchmark runner: `TPF_LLM_TOOL=codex tpf npm run benchmark`

For docs, JSONL, and benchmark-data-only changes, validate structure with the smallest relevant parser, schema check, test, or focused command available. If verification cannot run, report the exact blocker and the risk left behind.

## Review Standard

For reviews or non-trivial sign-off, use an adversarial production-review stance. Passing tests are evidence, not a verdict.

Lead with confirmed findings ordered by severity and grounded in file or artifact references. Bucket material concerns as one of: confirmed finding, false positive, product decision needed, or residual risk / missing test only.

Before sign-off on changes that affect CT-MCP behavior or claims, check:

- User-visible workflow and release-gate impact.
- Data/artifact flow from declared contract through validation and final answer binding.
- False-block and false-pass risk.
- Benchmark validity, including clean controls and adversarial cases.
- Whether external claims are supported by actual proof.
