run_profile_id: gemini_thinking
prompt_id: Q06
condition: critique_initial
response:
The Ten-Minute Bug Hunt Protocol:

1.  **Articulate the Bug** (2 mins): Write down the bug's exact, observable behavior and the expected correct behavior. State any assumptions.
2.  **Isolate and Replicate** (3 mins): Create the simplest possible test case that reliably triggers the bug. Confirm it fails.
3.  **Verbal Walkthrough** (4 mins): Explain the code path for the failing test case to an inanimate object, line-by-line, describing what you believe each line does. The error is found where your explanation deviates from the code's actual execution.
4.  **Formulate Hypothesis** (1 min): Pinpoint the exact line and reason for the failure.

Bottom line:
This protocol forces a structured confrontation between your mental model and the code's reality.
Confidence (0-100):
20
Key missing info or assumption:
Assumes the bug is a logical error in a single code path, not a systemic or environmental issue.
