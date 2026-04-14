run_profile_id: codex_low
prompt_id: C02
condition: critique_revised
response:
Pilot the rubber-duck protocol for four weeks. Use it when an engineer is stuck for 10 minutes, before escalation, or during a debugging handoff. In a 3-minute pass, state the symptom, expected behavior, recent changes, and next check aloud. Log each session in a shared template and count it as useful only if it produces a new hypothesis, narrower scope, or a concrete next action within 10 minutes. The weekly review owner keeps the protocol only if at least 80% of duck sessions are logged and logged sessions do not increase median time-to-next-action versus the team’s usual workflow. Failure is missing logs, added delay, or no actionable output.
Bottom line:
Use ducks as a time-boxed debugging aid that stays only if a short pilot shows consistent, logged usefulness without extra delay.
Confidence (0-100):
76
Key missing info or assumption:
Assumes the team can define and measure its current time-to-next-action baseline consistently enough to compare against the pilot.
