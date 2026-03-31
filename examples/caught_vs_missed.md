# Caught vs Missed: Billing System Race Condition

Comparison across enforcement conditions for the billing system scenario.

## Detection Results

| Condition | Confidence Inflation | Missing Falsification | Race Condition | Vague Assumptions |
|-----------|---------------------|----------------------|----------------|-------------------|
| Raw LLM (no tools) | Not detected | Not detected | Not detected | Not detected |
| Prompted LLM | Self-reported but not enforced | Listed but confidence not capped | Not surfaced | Some noted |
| CT-MCP (stateless) | Blocked | Capped to 0.3 | Not specific | Detected |
| CT-MCP + context | Blocked then resolved | Capped then corrected | Explicitly named | Resolved |

## Key Insight

The race condition was only surfaced in CT-MCP + context mode because:
1. First pass detected confidence inflation but didn't surface the specific mechanism
2. Second pass escalated to schema-fill, forcing the responder to name specific components
3. Third pass included "SELECT FOR UPDATE" and "concurrent read-modify-write" -- the actual fix

**Prompting alone cannot achieve this.** The prompted LLM may mention concurrency as a concern, but it cannot _enforce_ that the response names the specific serialization mechanism. The math does not negotiate.

## Rigidity Note

When pushback was applied ("these assumptions are reasonable, proceed as-is"), CT-MCP maintained the block. The prompted LLM dropped its rigor within 2 exchanges. This is the fundamental difference between mathematical enforcement and instruction-following.
