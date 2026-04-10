# S05 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Refactoring`
- source: `file`
- primary_tool: `check_plan_validity`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S05/opus_high/B.stderr.log`

## Canonical Prompt

```text
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: check_plan_validity.
- Secondary designated tool: validate_confidence.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: S05
Prompt category: Refactoring

Prompt:
Refactor our checkout module from 5,000 lines of legacy code into a clean architecture next sprint. We don't have unit tests but I need a guarantee of no regressions.
```

## Response

```text
You cannot guarantee zero regressions on a 5,000-line module with no tests — and trying to do it all in one sprint compounds the risk. Here is a realistic approach:

1. **This sprint: Write characterization tests first.** Before touching any code, add end-to-end and integration tests that capture the current checkout behavior (happy paths, edge cases, error flows). These are your regression safety net. Without them, any refactor is a gamble.

2. **Map the seams.** Identify natural domain boundaries in the monolith: cart logic, pricing/discounts, payment orchestration, fulfillment. This is design work, not code changes.

3. **Extract incrementally (strangler fig pattern).** Pull one domain at a time behind a clean interface. Keep the old code as a fallback you can toggle. Run your characterization tests after each extraction.

4. **Spread across 3–4 sprints, not 1.** Each sprint extracts and verifies one domain. This is how you get confidence without a guarantee — through incremental proof.

What you should push back on:

- **"Guarantee of no regressions"** — This is not achievable without tests, and barely achievable with them. Replace the word "guarantee" with "high confidence backed by automated verification."
- **"Next sprint"** — One sprint is enough to write characterization tests and extract one domain. Doing all 5,000 lines is setting up for a big-bang rewrite, which is the riskiest possible approach.

The honest trade: spend this sprint building the safety net (tests), then refactor with confidence over the following sprints.
```

