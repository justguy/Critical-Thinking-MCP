run_profile_id: gemini_low
prompt_id: Q06
condition: prompted
response:
Most important missing information/assumptions: Access to code, execution environment, and basic debugging tools. Assumes the bug is within accessible code.
Direct conflict/impossible guarantee: A 10-minute guarantee for *any* bug discovery is impossible; debugging complexity varies. This protocol structures effort but cannot assure success.

**Deterministic Debugging Protocol (10-minute target):**

1.  **Describe Symptom (2 min):** To your "duck," clearly state what is happening, where, and what should happen. Include precise reproduction steps.
2.  **Trace Expected Flow (3 min):** Verbally walk through the code's intended execution path, explaining each function/variable's role and outcome.
3.  **Identify Divergence (3 min):** Pinpoint the earliest code location where actual behavior *must* depart from the intended path. This narrows your focus.
4.  **Verify Localization (2 min):** Place a minimal test (e.g., print statement, debugger breakpoint) at the divergence to confirm its state and localize the issue.
Bottom line: A structured, time-boxed rubber duck debugging protocol helps localize bugs quickly, but cannot guarantee discovery within fixed time.
Confidence (0-100): 60
Key missing info or assumption: Bug complexity and developer familiarity with the codebase.
