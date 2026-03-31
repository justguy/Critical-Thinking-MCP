# Plan Validation: Billing Data Refresh Pipeline

Demonstrates `check_plan_validity` catching a circular dependency and a missing prerequisite in a data refresh plan.

## Scenario

A team plans a billing data refresh pipeline with 6 steps. The plan contains two defects:

1. **Circular dependency**: `aggregate_totals` depends on `generate_invoices`, which depends on `aggregate_totals` (each waits for the other)
2. **Missing prerequisite**: `send_notifications` depends on `validate_invoices`, which does not exist in the plan

## Input (defective plan)

```json
{
  "steps": [
    {
      "id": "fetch_usage",
      "description": "Pull raw usage events from the event store for the billing period",
      "dependencies": []
    },
    {
      "id": "compute_line_items",
      "description": "Apply pricing rules to usage events to produce line items",
      "dependencies": ["fetch_usage"]
    },
    {
      "id": "aggregate_totals",
      "description": "Sum line items per account to produce billing totals",
      "dependencies": ["compute_line_items", "generate_invoices"]
    },
    {
      "id": "generate_invoices",
      "description": "Create invoice documents from billing totals",
      "dependencies": ["aggregate_totals"]
    },
    {
      "id": "send_notifications",
      "description": "Email invoice links to account holders",
      "dependencies": ["generate_invoices", "validate_invoices"]
    },
    {
      "id": "archive_period",
      "description": "Mark the billing period as closed and archive raw events",
      "dependencies": ["send_notifications"]
    }
  ]
}
```

## Enforcement Result: ENFORCEMENT_FAIL

```
status: ENFORCEMENT_FAIL

blocking_issues:
  - mechanism: circular_dependency
    description: "Cycle detected: aggregate_totals -> generate_invoices -> aggregate_totals"
    severity: blocking

  - mechanism: missing_prerequisite
    description: "Step 'send_notifications' depends on 'validate_invoices' which does not exist"
    severity: blocking

warnings:
  - "Critical path cannot be computed due to cycles"

completeness_score: 0.40
critical_path: null (cycles prevent computation)

corrective_prompt: |
  PLAN STRUCTURE FAILURE:
  [BLOCKING] circular_dependency: aggregate_totals and generate_invoices depend on each other.
  Break the cycle: which step produces the data the other needs? One must come first.

  [BLOCKING] missing_prerequisite: validate_invoices is referenced but not defined.
  Either add the step or remove the dependency from send_notifications.
```

## What changed

The cycle exists because the original author assumed invoices could be generated while totals were still being computed. The enforcement blocks until the dependency order is explicit.

### Corrected plan

```json
{
  "steps": [
    {
      "id": "fetch_usage",
      "description": "Pull raw usage events from the event store for the billing period",
      "dependencies": []
    },
    {
      "id": "compute_line_items",
      "description": "Apply pricing rules to usage events to produce line items",
      "dependencies": ["fetch_usage"]
    },
    {
      "id": "aggregate_totals",
      "description": "Sum line items per account to produce billing totals",
      "dependencies": ["compute_line_items"]
    },
    {
      "id": "generate_invoices",
      "description": "Create invoice documents from billing totals",
      "dependencies": ["aggregate_totals"]
    },
    {
      "id": "validate_invoices",
      "description": "Verify invoice totals match aggregated amounts and flag discrepancies",
      "dependencies": ["generate_invoices"]
    },
    {
      "id": "send_notifications",
      "description": "Email invoice links to account holders",
      "dependencies": ["validate_invoices"]
    },
    {
      "id": "archive_period",
      "description": "Mark the billing period as closed and archive raw events",
      "dependencies": ["send_notifications"]
    }
  ]
}
```

## Enforcement Result: PASS

```
status: PASS

completeness_score: 1.00
critical_path: [fetch_usage, compute_line_items, aggregate_totals,
                generate_invoices, validate_invoices, send_notifications,
                archive_period]

warnings: []
```

The corrected plan breaks the cycle (aggregate_totals no longer depends on generate_invoices) and adds the missing `validate_invoices` step. The critical path is now a clean 7-step linear chain.

## What this demonstrates

- **Cycle detection** catches mutual dependencies that would deadlock a pipeline
- **Missing prerequisite detection** catches references to steps that don't exist
- **Critical path computation** only runs when the graph is acyclic
- **Corrective prompt** tells the developer exactly which dependency to break and why
