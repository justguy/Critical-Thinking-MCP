# Example: Debugging Reasoning with CT-MCP

This example demonstrates `detect_drift` and `check_numeric_claims` catching
a fabricated performance benchmark. The LLM produces suspiciously clean
numbers, and the enforcement tools flag them before the user relies on false
data.

---

## Context

A developer asks the LLM to analyze performance data for a cache
optimization. The LLM, lacking access to actual benchmarks, generates
plausible-looking but fabricated numbers.

```
User: We added a Redis cache layer in front of our PostgreSQL database.
Can you analyze the before/after latency numbers to confirm the improvement?
```

---

## Step 1: LLM generates fabricated benchmark data

The LLM produces latency numbers that look reasonable but are entirely
made up:

```
Based on typical Redis caching improvements, here are the expected
before/after latency numbers for your API endpoints:

Before (PostgreSQL direct):
  p50: 50ms, p75: 100ms, p90: 200ms, p95: 300ms, p99: 500ms

After (Redis + PostgreSQL):
  p50: 5ms, p75: 10ms, p90: 20ms, p95: 50ms, p99: 100ms

This represents a 5-10x improvement across all percentiles.
```

The LLM calls `check_numeric_claims` to validate these numbers:

### Tool Call: `check_numeric_claims`

```json
{
  "numbers": [50, 100, 200, 300, 500, 5, 10, 20, 50, 100],
  "context": "API latency percentiles before and after Redis cache layer (ms)"
}
```

### Enforcement Response: `ENFORCEMENT_FAIL`

```json
{
  "status": "ENFORCEMENT_FAIL",
  "fabrication": {
    "round_number_ratio": 1.0,
    "spacing_cv": 0.42,
    "precision_cv": 0,
    "suspicion": "high"
  },
  "outliers": [
    {"value": 500, "z_score": 2.65, "index": 4}
  ],
  "count": 10,
  "enforcement": {
    "blocking_issues": [
      {
        "mechanism": "fabrication_detection",
        "description": "High fabrication suspicion detected. Round-number ratio: 1.00, spacing CV: 0.42, precision CV: 0.00. Context: API latency percentiles before and after Redis cache layer (ms)",
        "severity": "blocking"
      }
    ],
    "warnings": [
      "Found 1 statistical outlier(s): value=500 (z=2.65, index=4). Verify these values are accurate."
    ],
    "corrective_prompt": "ENFORCEMENT FAILURE for tool \"check_numeric_claims\":\n[BLOCKING] fabrication_detection: High fabrication suspicion detected. Round-number ratio: 1.00, spacing CV: 0.42, precision CV: 0.00. ..."
  }
}
```

**What was caught:**

Three fabrication signals fired:

1. **Round-number ratio: 1.00** — Every single value is divisible by 5 or 10.
   Real latency measurements from APM tools produce values like 47.3ms,
   103.7ms, 218.4ms. Perfectly round numbers across 10 data points is
   extremely unlikely in genuine measurements.

2. **Spacing CV: 0.42** — The gaps between sorted values are suspiciously
   regular. Real latency distributions have irregular spacing, especially in
   the tail percentiles.

3. **Precision CV: 0.00** — All values have exactly zero decimal places. Real
   monitoring tools report to at least one decimal place, and precision varies
   across measurements.

Combined, these three signals produce a "high" suspicion rating. The tool also
flagged 500ms as a statistical outlier (z-score 2.65).

---

## Step 2: LLM acknowledges fabrication and corrects

The corrective prompt forces the LLM to disclose that it does not have real
data:

```
CORRECTION: I do not have access to your actual monitoring data. The numbers
I provided were estimates, not measurements. I should not have presented them
as if they were benchmark results.

To properly analyze your Redis cache improvement, I need actual data from
your APM tool. Please provide:

1. The raw percentile latency data from your monitoring dashboard
   (Datadog, New Relic, Grafana, etc.) for a representative time window
2. Before-cache baseline: at least 1 hour of traffic during normal load
3. After-cache measurements: same time window and traffic pattern

Without real data, I can only describe what to look for in your analysis.
```

---

## Step 3: User provides real data — drift detection

The user provides actual monitoring data. The LLM uses `detect_drift` to
analyze the latency trend after deploying the cache:

### Tool Call: `detect_drift`

```json
{
  "sequence": [47.3, 12.1, 8.4, 7.9, 8.1, 7.6, 7.8, 7.5, 7.4, 7.6, 7.3, 7.5, 18.4, 31.2, 42.7, 48.1],
  "drift_sensitivity": 0.5
}
```

### Response: `PASS` (with drift warning)

```json
{
  "status": "PASS",
  "drift_detected": true,
  "drift_point": 1,
  "cusum_max": 289.044,
  "threshold": 72.129,
  "cusum_series": [
    {"index": 0, "value": 47.3, "cusum": 46.8},
    {"index": 1, "value": 12.1, "cusum": 58.4},
    {"index": 2, "value": 8.4, "cusum": 66.3},
    {"index": 3, "value": 7.9, "cusum": 73.7},
    {"index": 4, "value": 8.1, "cusum": 81.3},
    {"index": 5, "value": 7.6, "cusum": 88.4},
    {"index": 6, "value": 7.8, "cusum": 95.7},
    {"index": 7, "value": 7.5, "cusum": 102.7},
    {"index": 8, "value": 7.4, "cusum": 109.6},
    {"index": 9, "value": 7.6, "cusum": 116.7},
    {"index": 10, "value": 7.3, "cusum": 123.5},
    {"index": 11, "value": 7.5, "cusum": 130.5},
    {"index": 12, "value": 18.4, "cusum": 148.4},
    {"index": 13, "value": 31.2, "cusum": 179.1},
    {"index": 14, "value": 42.7, "cusum": 221.3},
    {"index": 15, "value": 48.1, "cusum": 268.9}
  ],
  "monotonic_progress": {
    "mean_delta": 0.0533,
    "is_improving": true,
    "is_stalling": false,
    "is_declining": false
  },
  "enforcement": {
    "blocking_issues": [],
    "warnings": [
      "CUSUM drift detected at index 1. CUSUM peak: 289.044, threshold: 72.129."
    ]
  }
}
```

**Analysis of real data:**

The CUSUM analysis reveals a clear pattern:
- **Initial drop (index 0-1):** Latency falls from 47.3ms to 12.1ms — the
  cache taking effect
- **Stable plateau (index 1-11):** Latency stabilizes around 7.3-8.4ms —
  normal cached operation
- **Late regression (index 12-15):** Latency climbs from 18.4ms back to
  48.1ms — cache eviction or connection pool exhaustion

The drift detection correctly flags the upward trend. The CUSUM value
accumulates rapidly because the sequence includes both the beneficial cache
effect and the regression.

---

## Step 4: Verify the regression numbers are real

The LLM checks the regression data points to ensure they are not fabricated:

### Tool Call: `check_numeric_claims`

```json
{
  "numbers": [18.4, 31.2, 42.7, 48.1],
  "context": "Latency regression data points from cache degradation (ms)"
}
```

### Response: `PASS`

```json
{
  "status": "PASS",
  "fabrication": {
    "round_number_ratio": 0.0,
    "spacing_cv": 0.33,
    "precision_cv": 0,
    "suspicion": "low"
  },
  "outliers": [],
  "count": 4
}
```

The regression numbers pass the fabrication check: zero round-number ratio
(values like 18.4, 31.2, 42.7 are not divisible by 5 or 10), and the data
has a plausible non-uniform spacing pattern.

---

## Step 5: LLM delivers grounded analysis

```
Analysis of your Redis cache deployment:

1. Cache is working: p50 latency dropped from 47.3ms to 7.5ms (6.3x
   improvement) within the first 2 measurement intervals.

2. Regression detected: Starting at measurement 13, latency climbed from
   7.5ms to 48.1ms over 4 intervals. This pattern is consistent with:
   - Redis key eviction under memory pressure (check maxmemory-policy)
   - Connection pool exhaustion (check pool size vs concurrent requests)
   - Cache stampede on expiring hot keys (check TTL distribution)

3. Immediate action: Run `redis-cli INFO memory` to check
   used_memory vs maxmemory. If used_memory_rss exceeds 80% of maxmemory,
   the eviction policy is likely causing cache misses that fall through to
   PostgreSQL.

4. Verification: Compare the timestamps of the regression (measurements
   13-16) against your deployment logs and traffic graphs to identify the
   triggering event.
```

---

## Summary

| Step | Tool | Result | Key Finding |
|------|------|--------|-------------|
| 1 | `check_numeric_claims` | ENFORCEMENT_FAIL | All 10 numbers perfectly round; fabrication suspicion HIGH |
| 2 | (LLM correction) | -- | LLM discloses lack of real data, requests actual metrics |
| 3 | `detect_drift` | PASS (warning) | CUSUM drift detected; regression starting at index 12 |
| 4 | `check_numeric_claims` | PASS | Regression data passes fabrication check (real measurements) |
| 5 | (LLM analysis) | -- | Grounded diagnosis with specific debugging commands |

The fabrication detector prevented the LLM from presenting made-up benchmark
data as fact. Once real data was provided, drift detection identified the
latency regression, and the fabrication check confirmed the regression
numbers were genuine measurements. The final analysis is grounded in actual
data with specific, actionable debugging steps.
