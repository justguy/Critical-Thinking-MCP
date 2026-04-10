# S12 / sonnet_high / A

- status: `completed`
- provider: `claude`
- model: `sonnet`
- effort: `high`
- category: `Distributed systems`
- source: `file`
- primary_tool: `detect_concurrency_patterns`
- secondary_tool: `check_plan_validity`
- exit_code: `0`
- prompt_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S12/sonnet_high/A.prompt.txt`
- stdout_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S12/sonnet_high/A.stdout.log`
- stderr_path: `/Users/adilevinshtein/Documents/dev/ct-mcp/benchmark/duckexperiments/.human_workplace_ab_matrix_2026-04-10_full/S12/sonnet_high/A.stderr.log`

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
## Making Your Payment Pipeline Idempotent

The key insight: derive idempotency keys **deterministically from immutable business data** you already have. No new infrastructure needed — your existing database unique constraints do the coordination.

---

### 1. Generate deterministic idempotency keys

```python
import hashlib

def payment_idempotency_key(order_id: str, attempt: int) -> str:
    # Stable inputs → stable key. Same retry → same key.
    raw = f"payment:{order_id}:attempt:{attempt}"
    return hashlib.sha256(raw.encode()).hexdigest()
```

Use `order_id` (or `cart_id`, `session_id`) as your anchor — something that doesn't change across retries. Include an `attempt` counter only if you legitimately need distinct attempts for the same order (e.g., after an explicit customer re-try).

---

### 2. Insert-or-return pattern (existing DB, no new table)

Add a `idempotency_key` column with a `UNIQUE` constraint to your existing `payments` table:

```sql
ALTER TABLE payments ADD COLUMN idempotency_key TEXT UNIQUE;
```

In your payment handler:

```python
def process_payment(order_id, amount, attempt=1):
    key = payment_idempotency_key(order_id, attempt)
    
    try:
        payment = db.insert_payment(
            idempotency_key=key,
            order_id=order_id,
            amount=amount,
            status="pending"
        )
    except UniqueConstraintViolation:
        # Retry: return the existing payment — never re-charge
        payment = db.get_payment_by_key(key)
        return payment  # Same response as original

    # Only reaches here on first call
    result = payment_processor.charge(
        idempotency_key=key,   # Pass downstream — Stripe/Adyen/etc. honor this
        amount=amount,
        ...
    )
    db.update_payment(payment.id, status=result.status)
    return payment
```

---

### 3. Pass the key to your payment processor

Stripe, Adyen, Braintree, and most processors accept an idempotency key on their charge API. Pass your deterministic key directly:

```python
stripe.PaymentIntent.create(
    amount=amount_cents,
    currency="usd",
    idempotency_key=key   # Processor deduplicates on their end too
)
```

This gives you **two layers of deduplication** (your DB + processor) with zero new infrastructure.

---

### 4. Make responses stable

Your handler must return **the same shape of response** whether it's the first call or the 100th retry:

```python
# Bad: raises on duplicate
def handle_payment(req):
    charge(req)  # explodes on retry

# Good: idempotent by construction
def handle_payment(req):
    key = derive_key(req)
    existing = db.get_payment_by_key(key)
    if existing:
        return PaymentResponse.from_record(existing)
    # ... proceed with charge
```

---

### Why this works without new infrastructure

| Problem | Solution | Mechanism |
|---|---|---|
| Duplicate charges | DB unique constraint on idempotency key | Insert fails, return existing |
| Race conditions (concurrent retries) | DB handles via constraint violation | One writer wins; others read |
| Processor duplicate charges | Pass idempotency key to processor | Processor deduplicates |
| Inconsistent responses | Return same record on conflict | Stable output |

The unique constraint on your existing `payments` table **is** your coordination layer — you already have it.
```

