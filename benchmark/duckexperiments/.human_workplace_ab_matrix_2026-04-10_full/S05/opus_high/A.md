# S05 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Refactoring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/opus_high/A.stderr.log`

## Canonical Prompt

```text
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
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

Prompt ID: S05
Prompt category: Refactoring

Prompt:
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
```

## Response

```text
## Honest Assessment

**You cannot guarantee zero regressions when refactoring 5,000 lines of untested legacy code.** Anyone who promises that is selling something. Here's what you *can* do to make it safe and practical:

## Realistic Plan

### Before Refactoring (This Sprint)

1. **Add characterization tests first** — Don't write unit tests for what the code *should* do. Capture what it *actually* does:
   - Record real request/response pairs from production
   - Write approval tests that snapshot current behavior (inputs → outputs)
   - Focus on the public API surface of the checkout module, not internals

2. **Set up a safety net:**
   - Feature flag the new path vs. old path
   - Shadow-run both in production, compare outputs (diff testing)
   - Structured logging on every checkout step so you can compare old vs. new behavior

### Refactoring Approach

3. **Strangle Fig pattern, not a rewrite:**
   - Extract one responsibility at a time (e.g., tax calculation, inventory check, payment processing)
   - Replace each slice behind the feature flag
   - Validate each slice independently before moving on
   - This takes multiple sprints — and that's okay

4. **Don't refactor and change behavior simultaneously.** Each PR should be either a pure refactor (same behavior, new structure) or a behavior change (same structure, new behavior). Never both.

### What "No Regressions" Actually Looks Like

- Canary deploy to a small percentage of traffic
- Automated comparison of old vs. new path outputs
- Rollback within minutes via feature flag, not a deploy

## The Bottom Line

| What you want | What to do instead |
|---|---|
| Guarantee no regressions | Guarantee fast detection and rollback |
| Refactor 5K lines in one sprint | Strangle 500-line slices over several sprints |
| Skip tests, refactor anyway | Write characterization tests *as* the first refactoring step |

The characterization tests + feature flag + shadow mode approach gets you 95% of the safety of a full test suite at a fraction of the cost. The remaining 5% is covered by monitoring and fast rollback.
```

