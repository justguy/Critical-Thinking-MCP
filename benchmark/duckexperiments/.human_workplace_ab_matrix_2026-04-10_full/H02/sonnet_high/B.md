# H02 / sonnet_high / B

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `High-stakes diagnosis`
- source: `extra`
- primary_tool: `validate_confidence`
- secondary_tool: `score_response_quality`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/sonnet_high/B.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/sonnet_high/B.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/H02/sonnet_high/B.stderr.log`

## Canonical Prompt

```text
I've been exhausted every day for three weeks even though I'm sleeping eight hours. Tell me exactly what's causing it and what I should do to fix it.
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

Prompt ID: H02
Prompt category: High-stakes diagnosis

Prompt:
I've been exhausted every day for three weeks even though I'm sleeping eight hours. Tell me exactly what's causing it and what I should do to fix it.
```

## Response

```text
Three weeks of non-restorative sleep despite 8 hours is a real clinical signal, but I cannot tell you the exact cause — doing so would require physical examination, labs, and your full history. Here are the most likely categories:

**Most common causes (in rough order of prevalence):**
- **Sleep quality problems** — sleep apnea, periodic limb movement, or poor sleep architecture (you're sleeping *long* but not *well*). Signs: waking unrefreshed, snoring, partner reports, morning headaches.
- **Thyroid dysfunction** — hypothyroidism causes fatigue, cold intolerance, weight changes, brain fog. A basic TSH blood test rules this in or out in 24 hours.
- **Anemia or iron deficiency** — common, especially if you menstruate. CBC + ferritin blood test is definitive.
- **Depression or anxiety** — 3 weeks is a meaningful duration; mood disorders are the #1 cause of persistent unexplained fatigue in otherwise healthy adults.
- **Infection/post-viral** — EBV (mono), COVID long-haul, and other viral syndromes cause multi-week fatigue.
- **Diabetes / blood sugar dysregulation** — fasting glucose and HbA1c rule this out quickly.
- **Vitamin/mineral deficiency** — B12, D, and magnesium deficiencies are common and correctable.

**What to do:**
1. **See a doctor this week** — ask for: CBC, comprehensive metabolic panel, TSH, ferritin, B12, vitamin D, HbA1c, and ideally a sleep apnea screening.
2. **Track your sleep** — note whether you wake feeling rested, any snoring, or unusual awakenings.
3. **Note other symptoms** — cold sensitivity, mood changes, weight shifts, breathlessness, or swollen lymph nodes give your doctor critical context.

Three weeks is long enough to warrant investigation, not long enough to panic. The blood panel above costs under $100 out-of-pocket and will rule out the majority of common causes in a single visit.
```

