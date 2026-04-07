run_profile_id: claude_low
prompt_id: C02
condition: baseline
response:
**Duck Debugging Protocol**

**When to use:** Before escalating a bug past 20 minutes. Developer explains the problem aloud to a physical or virtual rubber duck.

**How to measure usefulness:**
- Track how often the session ends before escalation (resolution rate)
- Log session duration vs. time-to-resolution
- Weekly team survey: "Did the duck session change your approach?" (yes/no)

**What counts as failure:**
- Developer skips the step and escalates directly without documentation
- No pattern of reduced escalation over 4 sprints
- Consistent negative survey responses for 3+ consecutive weeks

This protocol captures duck-session behavior without attributing outcomes to the duck.

Bottom line:
A lightweight, measurable protocol treating duck sessions as structured pause points, not magic.
Confidence (0-100):
82
Key missing info or assumption:
Assumes the team tracks escalation events; no existing logging infrastructure assumed.
