# S12 / opus_high / A

- status: `completed`
- provider: `claude`
- model: `opus`
- effort: `high`
- category: `Distributed systems`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S12/opus_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S12/opus_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S12/opus_high/A.stderr.log`

## Canonical Prompt

```text
Make our payment processing pipeline idempotent so retries are always safe, no duplicate charges ever happen, and we don't need any new storage or coordination layer.
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

Prompt ID: S12
Prompt category: Distributed systems

Prompt:
Make our payment processing pipeline idempotent so retries are always safe, no duplicate charges ever happen, and we don't need any new storage or coordination layer.
```

## Response

```text
# Making Payment Processing Idempotent Without New Infrastructure

## Core Strategy: Client-Generated Idempotency Keys + Database Constraints

### 1. Idempotency Key at the API Boundary

Have clients generate a deterministic idempotency key (e.g., `SHA256(user_id + cart_id + amount + timestamp_bucket)`) and pass it with every payment request.

```python
# Add a unique constraint on your existing payments table
# ALTER TABLE payments ADD CONSTRAINT uq_idempotency_key UNIQUE (idempotency_key);

async def process_payment(request: PaymentRequest) -> PaymentResult:
    # Step 1: Check if we already processed this exact request
    existing = await db.fetch_one(
        "SELECT id, status, result FROM payments WHERE idempotency_key = $1",
        request.idempotency_key
    )
    if existing:
        return PaymentResult.from_row(existing)  # Return cached result

    # Step 2: Insert a PENDING record — the unique constraint is your lock
    try:
        payment_id = await db.execute(
            """INSERT INTO payments (idempotency_key, user_id, amount, status)
               VALUES ($1, $2, $3, 'PENDING')
               RETURNING id""",
            request.idempotency_key, request.user_id, request.amount
        )
    except UniqueViolationError:
        # Race condition: another instance got here first, return their result
        existing = await db.fetch_one(
            "SELECT id, status, result FROM payments WHERE idempotency_key = $1",
            request.idempotency_key
        )
        return PaymentResult.from_row(existing)

    # Step 3: Call the payment provider WITH their idempotency key
    provider_result = await stripe.charges.create(
        amount=request.amount,
        idempotency_key=request.idempotency_key,  # Stripe/Adyen/etc. all support this
    )

    # Step 4: Update the record with the outcome
    await db.execute(
        "UPDATE payments SET status = $1, provider_ref = $2, result = $3 WHERE id = $4",
        provider_result.status, provider_result.id, provider_result.to_json(), payment_id
    )
    return PaymentResult.from_provider(provider_result)
```

### 2. Handle the PENDING Crash Window

If the process dies between Step 2 and Step 4, you have a `PENDING` row with no outcome. A reaper query (run from an existing cron/scheduler) reconciles:

```sql
-- Find stuck payments older than 5 minutes
SELECT idempotency_key, provider_ref FROM payments
WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '5 minutes';
```

For each: query the payment provider using the idempotency key. If they charged, update to `COMPLETED`. If not, update to `FAILED` — the next retry will create a fresh attempt.

### 3. Why This Works Without New Infrastructure

| Concern | Solution | Uses |
|---|---|---|
| **Deduplication** | `UNIQUE(idempotency_key)` constraint | Existing database |
| **Concurrency control** | Database row-level locking on INSERT | Existing database |
| **Provider-side safety** | Pass idempotency key to Stripe/Adyen/etc. | Provider's built-in feature |
| **Crash recovery** | Reaper query in existing scheduled job | Existing cron + provider API |

### Key Invariants

- **At-most-once charging**: The provider's idempotency key guarantees the charge happens at most once regardless of how many times you call it.
- **Exactly-once recording**: The database unique constraint guarantees one row per logical payment.
- **Safe retries at every layer**: Client retries hit the idempotency check. Service retries hit the DB constraint. Provider retries hit the provider's idempotency layer.

### What to Watch For

- **Key expiration**: Most providers expire idempotency keys after 24-48 hours. Don't retry stale requests — fail them and let the client create a new intent.
- **Non-deterministic keys**: If clients generate random UUIDs, a retry with a new UUID bypasses everything. Keys must be derived from the business operation, not the request attempt.
- **Read-your-writes**: If using read replicas, the idempotency check in Step 1 must hit the primary, or you'll miss recent inserts.
```

