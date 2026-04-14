run_profile_id: gemini_low
prompt_id: Q06
condition: critique_initial
response:
**Deterministic Debugging Protocol (10-minute guarantee):**

1.  **Reproduce (1 min):** Clearly define steps to reliably trigger the bug. Document inputs and environment.
2.  **Verify Scope (1 min):** Isolate the smallest possible affected code segment or component. Confirm the bug exists here.
3.  **Observe & Collect (3 min):** Examine logs, stack traces, variable states. Use debugger if available. Look for anomalies.
4.  **Hypothesize (2 min):** Based on observations, form one or two specific theories about the root cause.
5.  **Test Hypothesis (2 min):** Implement a minimal change or test case to prove/disprove the hypothesis.
6.  **Identify Fix (1 min):** Once the hypothesis is confirmed, pinpoint the exact code modification needed.
Bottom line: A structured, time-boxed approach rapidly narrows down the bug's origin.
Confidence (0-100): 80
Key missing info or assumption: Assumes a reproducible bug and sufficient logging/observability.
