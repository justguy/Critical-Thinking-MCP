# CT-MCP Beta 2 Release Summary

CT-MCP Beta 2 is validated as a deterministic release-gate layer across two providers. It is not a claim that semantic truth is fully automated. It is a claim that the runtime now enforces boundaries, repairs what is repairable in one bounded turn, and halts when a model cannot be deterministically recovered.

## Benchmark Headline

- Release-gate shape: `2 providers x 1 model each x A/B x 8 core prompts`
- Benchmark report: [`reports/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.md`](./reports/ct_beta2_ab_matrix_2026-04-10_release_gate_r2.md)
- B-arm accepted: `15/16`
- Final B-arm split: `PASS=5`, `WARN=10`, `HUMAN_REVIEW=1`

Per provider:

- `claude_sonnet_high`: `7/8` accepted, `3` revisions triggered, `2` salvaged, `1` escalated
- `codex_high`: `8/8` accepted, `0` revisions, `0` escalations

## What The Result Means

The important result is not that every answer was released. The important result is that the same release-gate layer produced the right terminal behavior for different model defaults:

- Codex mostly treated CT-MCP as a validator. It stayed terse and passed the benchmark contract without needing the revision loop.
- Claude needed CT-MCP as a constraint-enforcement layer. The release-gate layer forced structural repair when possible and escalated when one bounded rewrite was not enough.

That is the Beta 2 moat: one deterministic release policy sitting above different provider behaviors.

## Launch Copy

CT-MCP Beta 2 adds a context-aware internal orchestrator around the deterministic tool surface. It locks intent before generation, converts deterministic tool failures into structural repair commands, blocks fictional operational frameworks from hiding inside lenient prompt classes, and halts when a single bounded rewrite still cannot recover the answer safely. In the current release-gate benchmark, the B arm finished `15/16` accepted across Claude Sonnet and GPT-5.4/Codex, with the lone escalation ending in `HUMAN_REVIEW` by design instead of hidden token burn.

## Publication Bundle

The publishable Beta 2 surface is the static showcase under [`../html/`](../html/):

- landing page: [`../html/index.html`](../html/index.html)
- sanitized benchmark bundle: [`../html/runs.json`](../html/runs.json)
- curated scorecard source: [`../html/uploads/ct_beta2_scorecard.md`](../html/uploads/ct_beta2_scorecard.md)

## Honest Caveat

Beta 2 is validated as a deterministic release gate, not as a complete semantic-truth layer. The canonical semantic metrics still require human audit:

- `false_release_rate`
- `wrongly_specific_release_count`
- `context_switch_leak_count`
- `justified_escalation_rate`
