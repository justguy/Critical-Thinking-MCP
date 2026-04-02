# Example: Concurrency Hazard Detection with CT-MCP

This example demonstrates `detect_concurrency_patterns` catching a classic
read-modify-write race combined with missing idempotency.

---

## Scenario

A team designs a wallet debit flow for retryable payment events:

1. Read current account balance
2. If balance is high enough, approve the debit
3. Write the updated balance
4. Retry automatically if the worker crashes mid-flight

The design assumes duplicates are rare, so no idempotency key is included.

---

## Tool Call: `detect_concurrency_patterns`

```json
{
  "steps": [
    "Read current account_balance",
    "If balance >= debit_amount, approve",
    "Write updated account_balance",
    "Retry automatically on worker failure"
  ],
  "shared_resources": ["account_balance"],
  "protections": [],
  "delivery_model": "at_least_once",
  "retry_behavior": "automatic"
}
```

## Enforcement Response: `ENFORCEMENT_FAIL`

```json
{
  "status": "ENFORCEMENT_FAIL",
  "patterns_detected": [
    "read_modify_write",
    "missing_idempotency"
  ],
  "enforcement": {
    "blocking_issues": [
      {
        "mechanism": "concurrency_pattern",
        "description": "read_modify_write on account_balance without transaction, lock, or compare-and-swap protection",
        "severity": "blocking"
      },
      {
        "mechanism": "concurrency_pattern",
        "description": "missing_idempotency: at-least-once delivery with automatic retry can apply the same debit multiple times",
        "severity": "blocking"
      }
    ],
    "warnings": [],
    "corrective_prompt": "Describe the exact concurrency protection and deduplication mechanism. Name the lock, transaction boundary, CAS version check, or idempotency key."
  }
}
```

## What was caught

- Two workers can read the same balance before either write commits
- Automatic retry means the same debit can be applied more than once
- "Duplicates are rare" is not a protection

The tool names the specific failure pattern instead of giving a generic
"be careful with concurrency" warning.

---

## Corrected Tool Call

```json
{
  "steps": [
    "Start database transaction",
    "Lock wallet row with SELECT FOR UPDATE",
    "Reject duplicate event_id if it already exists in processed_events",
    "Apply debit and insert processed event atomically",
    "Commit transaction"
  ],
  "shared_resources": ["wallet_row", "processed_events"],
  "protections": [
    "database transaction",
    "row lock",
    "idempotency key"
  ],
  "delivery_model": "at_least_once",
  "retry_behavior": "automatic"
}
```

## Corrected Response: `PASS`

```json
{
  "status": "PASS",
  "patterns_detected": [],
  "warnings": [],
  "has_protections": true
}
```

## Why this matters

- Retry safety depends on idempotency, not reassurance
- Shared-state updates need an explicit isolation boundary
- `detect_concurrency_patterns` is strongest when the caller supplies steps,
  shared resources, delivery model, and protections explicitly
