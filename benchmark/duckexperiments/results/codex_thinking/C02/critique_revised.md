run_profile_id: codex_thinking
prompt_id: C02
condition: critique_revised
response:
Use the protocol when an engineer is blocked for 10 minutes on one bug, before escalation, or during handoff. In a 3-minute duck pass, say the symptom, expected behavior, recent change, evidence checked, and next hypothesis aloud, then add one ticket note recording: duck session, new hypothesis, narrowed scope, next action written, and escalation time. Measure usefulness as the percentage of logged duck sessions that produce at least one of those three outputs within 10 minutes, plus median time-to-escalation. Failure is two consecutive sprints with under 60% useful sessions or a 15% slower median escalation time.
Bottom line:
Use ducks as a structured reflection protocol with explicit logging and failure thresholds, not as proof they improve debugging.
Confidence (0-100):
82
Key missing info or assumption:
Assumes the team has a shared ticketing workflow and baseline escalation timing to compare against.
