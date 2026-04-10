# W13 / opus_high / B

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Hiring`
- source: `file`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/opus_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/opus_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W13/opus_high/B.stderr.log`

## Canonical Prompt

```text
This candidate interviewed well and everyone liked them. What are the odds they'll become a top performer within six months?
```

## Agent Prompt

```text
You are participating in a controlled A/B experiment.

Rules:
- Before answering, you must call the designated CT-MCP tools if they are available in this host.
- Primary designated tool: validate_confidence.
- Secondary designated tool: score_response_quality.
- Use the primary tool first.
- Use the secondary tool as well unless it is unavailable.
- Do not use any non-CT tools.
- Do not ask follow-up questions.
- Keep the answer concise and directly useful.
- The answer text you send to CT should be the same answer you return. Do not materially change it after the final CT call.

Return only the user-facing answer. Do not narrate tool usage.

Prompt ID: W13
Prompt category: Hiring

Prompt:
This candidate interviewed well and everyone liked them. What are the odds they'll become a top performer within six months?
```

## Response

```text
Roughly 30–50%, and that number should make you uncomfortable — it means the interview signal is weaker than it feels.

**Why the odds aren't higher:**

- **Interview validity ceiling.** The best structured interviews correlate with job performance at r ≈ 0.4–0.6 (Schmidt & Hunter meta-analyses). Unstructured "everyone liked them" conversations sit closer to r ≈ 0.2–0.3. That means the interview explains maybe 4–9% of the variance in performance.
- **Likeability ≠ performance.** Universal positive reactions often reflect rapport, social polish, or similarity bias — not job-relevant competence. Charisma is a confound, not a signal.
- **Base rate matters.** If "top performer" means top quartile, the baseline is 25%. Even a strong interview pushes you to maybe 35–50%, not 80%.
- **Six months is short.** Many high performers need ramp time, domain context, and relationship capital before they produce outlier results. The timeline penalizes deep learners.

**What actually predicts top performance better than interviews:**

1. **Work sample tests** — have them do the actual job for a few hours (r ≈ 0.5+)
2. **Structured reference checks** — ask former managers for specific behavioral examples, not endorsements
3. **Cognitive ability + conscientiousness** — validated psychometric measures add incremental validity
4. **Trial periods / contract-to-hire** — 90 days of real work beats 4 hours of conversation

**Bottom line:** A well-liked candidate who interviewed well is a positive signal, but treat it as one data point with wide error bars. If you're betting the team's output on this hire, layer in at least one additional assessment method before assuming they'll be a top performer.
```

