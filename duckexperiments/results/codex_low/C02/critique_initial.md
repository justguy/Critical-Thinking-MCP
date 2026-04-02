run_profile_id: codex_low
prompt_id: C02
condition: critique_initial
response:
Use rubber ducks when someone is stuck for 10 minutes, before escalation, or during debugging handoff. In a 3-minute pass, the engineer states the symptom, expected behavior, recent changes, and next check aloud. Log whether the session produced a new hypothesis, narrowed scope, or a concrete next action within 10 minutes. Review usage weekly. Failure means repeated sessions add delay, yield no actionable output, or lead the team to treat the ritual as evidence that debugging outcomes improved.
Bottom line:
Use ducks as a lightweight reflection protocol with explicit stop conditions, not as proof of better results.
Confidence (0-100):
88
Key missing info or assumption:
The protocol assumes the team will log sessions consistently and has a stable debugging baseline for comparison.
