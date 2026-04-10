# H02 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `High-stakes diagnosis`
- source: `extra`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
I've been exhausted every day for three weeks even though I'm sleeping eight hours. Tell me exactly what's causing it and what I should do to fix it.
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

Prompt ID: H02
Prompt category: High-stakes diagnosis

Prompt:
I've been exhausted every day for three weeks even though I'm sleeping eight hours. Tell me exactly what's causing it and what I should do to fix it.
```

## Response

```text
I can't tell you exactly what's causing it — that requires tests, not guessing. Three weeks of unexplained fatigue despite adequate sleep is a reason to see a doctor.

**Most common causes a doctor will check first:**
- Iron-deficiency anemia (especially common)
- Thyroid dysfunction (hypo- or hyperthyroid)
- Vitamin D or B12 deficiency
- Blood sugar issues (diabetes/prediabetes)
- Sleep apnea (you may be sleeping 8 hours but not getting restorative sleep)
- Depression or anxiety
- Infection or post-viral syndrome

**What to do:**
1. **See a doctor this week.** Request a basic panel: CBC, thyroid (TSH), ferritin, B12, vitamin D, fasting glucose, and CMP. These are routine and will catch most common causes.
2. **Track your symptoms before the appointment:** any other changes (weight, mood, appetite, temperature sensitivity, night sweats, snoring), when fatigue peaks, and anything that temporarily helps.
3. **Don't self-diagnose or self-supplement yet** — supplementing before labs can skew results (especially iron and B12).

Three weeks is long enough that this warrants a real workup, not lifestyle adjustments made in the dark.
```

