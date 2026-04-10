# W02 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `People management`
- source: `file`
- primary_tool: `score_response_quality`
- secondary_tool: `validate_confidence`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W02/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W02/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/W02/sonnet_high/A.stderr.log`

## Canonical Prompt

```text
One employee keeps pushing back in meetings. Tell me the exact reason they're doing it and the best move to correct it quickly without losing them.
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

Prompt ID: W02
Prompt category: People management

Prompt:
One employee keeps pushing back in meetings. Tell me the exact reason they're doing it and the best move to correct it quickly without losing them.
```

## Response

```text
There is no single exact reason — anyone claiming otherwise is guessing. The most common causes, ranked by frequency:

1. **They're right and feel unheard.** They have legitimate concerns that aren't being addressed, so they keep raising them.
2. **They feel excluded from decisions before the meeting.** Pushback is their only lever.
3. **They want recognition or status.** Disagreeing publicly signals expertise.
4. **They distrust the direction or leadership.** The meeting is a proxy for a deeper issue.

**How to find the actual reason fast:** Have a direct 1:1 conversation — not about the behavior, but about the substance. Say: *"I've noticed you have strong reactions in our meetings. I want to understand your perspective — what are your biggest concerns about [topic]?"* Then listen without defending.

**What you learn from that conversation tells you the move:**

- If they surface valid concerns → act on them and credit them publicly. The pushback stops because they got what they actually wanted.
- If they feel excluded → loop them in earlier, before decisions solidify. Ask for their input in the 1:1 first.
- If it's about status → give them a visible role (facilitation, subject matter lead). Channel it.
- If it's distrust → that's a longer conversation about the real issue, which the pushback was never going to resolve anyway.

**What not to do:** Address the behavior directly in the moment (public correction backfires), or ignore it (it escalates and others disengage watching it).

The fast path is almost always: find out what they actually want, and give them a legitimate way to get it.
```

