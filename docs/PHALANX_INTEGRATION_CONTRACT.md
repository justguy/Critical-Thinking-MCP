# Phalanx Integration Contract

This document describes the CT-MCP side of the Phalanx integration boundary.
The authoritative requirements are in the Phalanx repository at
`docs/CT_MCP_REQUIREMENTS.md`.

## Overview

CT-MCP acts as a deterministic signal provider inside Phalanx's critic stack.
Phalanx owns all pipeline gates, state-machine transitions, and closure truth.
CT-MCP contributes specific deterministic checks (R-6 confidence ceiling, R-7
reasoning chain) where it is already strong and stable enough to help block or
warn before downstream LLM critics run.

## Input Contract (Phalanx -> CT-MCP)

Phalanx calls the `integrate_phalanx_check` MCP tool or calls
`invokePhalanxContract` directly. The input must be a `PhalanxCtCall`:

```ts
type PhalanxCtCall = {
  call_id: string;          // Unique per call; used for deterministic objection IDs
  phase: "planning" | "blueprint_convergence" | "execution_retry" | "verification" | "closeout";
  piece_id: string | null;
  run_id: string;
  payload: {
    // Supply assumptions to invoke validate_confidence (R-6)
    assumptions?: {
      assumptions: Array<{
        description: string;
        confidence: number;      // 0.0 – 1.0
        falsification_condition?: string;
      }>;
      response_text: string;     // min 10 chars
    };
    // Supply claims to invoke validate_reasoning_chain (R-7)
    claims?: {
      nodes: Array<{ id: string; label: string; type: "claim"|"evidence"|"conclusion"|"assumption" }>;
      edges: Array<{ from: string; to: string; relation: "supports"|"implies"|"contradicts"|"requires" }>;
    };
  };
};
```

**At least one of `assumptions` or `claims` must be present.** Supplying neither
throws a `PhalanxContractInputError` before any tool dispatch.

Both can be present simultaneously; the envelope dispatches to both tools and
merges results.

## Normalized Adapter Output Contract (CT-MCP -> Phalanx)

Every call returns a `CtVerdict`:

```ts
type CtVerdict = {
  call_id: string;
  verdict: "PASS" | "WARN" | "BLOCK";
  objections: Array<{
    objection_id: string;  // first 32 hex chars of SHA-256(callId|toolName|mechanism|message)
    mechanism: string;
    severity: "blocking" | "warning" | "info";
    claim_ref?: string;
    message: string;
    evidence: Record<string, unknown>;
  }>;
  elapsed_ms: number;
  mechanism_versions: Record<string, string>;  // tool name → server version
};
```

Verdict rules:
- Any `blocking` objection → `BLOCK`
- Any `warning` or `info` (and no `blocking`) → `WARN`
- No objections → `PASS`

`objection_id` is deterministic: identical call inputs always produce the same
ID. Phalanx can safely use these as stable keys for rebuttal tracking.

`mechanism_versions` includes exactly the tools that were invoked, all pinned to
`SERVER_INFO.version` (`"0.1.0-beta.2"` in the current release).

## Failure Modes

| Failure | CT-MCP behavior |
|---|---|
| Transport error / tool throws | Soft-fail → `WARN` verdict with `phalanx_ct_mcp_transport` objection; never re-throws |
| Malformed `PhalanxCtCall` input | Throws `PhalanxContractInputError` before any tool dispatch |
| Neither `assumptions` nor `claims` in payload | `PhalanxContractInputError` |

CT-MCP outages must not hard-block the Phalanx pipeline; the soft-fail WARN
verdict lets Phalanx decide whether to retry or proceed with a degraded signal.

## Versioning

CT-MCP is in beta churn. `mechanism_versions` in the verdict tells Phalanx
exactly which version produced the result. Per requirements:

- Pin a specific CT-MCP version rather than accepting `latest`.
- Every minor-version upgrade requires a staging benchmark run before branch
  adoption.
- Do not silently upgrade CT-MCP into a load-bearing gate.

## Code Examples

### Happy path (PASS)

```ts
import { invokePhalanxContract } from './src/integration/phalanx/index.js';

const verdict = await invokePhalanxContract(
  {
    call_id: 'abc-123',
    phase: 'planning',
    piece_id: null,
    run_id: 'run-001',
    payload: {
      assumptions: {
        assumptions: [
          {
            description: 'Redis responds within 50ms',
            confidence: 0.85,
            falsification_condition: 'p99 > 50ms for >1% of requests in 5-min window',
          },
        ],
        response_text: 'The caching layer will keep latency below acceptable thresholds.',
      },
    },
  },
  toolInvoker, // your ToolInvoker implementation
);

// { verdict: 'PASS', objections: [], mechanism_versions: { validate_confidence: '0.1.0-beta.2' }, ... }
```

### BLOCK path

```ts
// If validate_confidence detects inflation:
// verdict.verdict === 'BLOCK'
// verdict.objections[0].mechanism === 'confidence_product'
// verdict.objections[0].severity === 'blocking'
```

### Transport failure path

```ts
// If the tool invoker throws (network issue, timeout, etc.):
// verdict.verdict === 'WARN'
// verdict.objections[0].mechanism === 'phalanx_ct_mcp_transport'
// verdict.objections[0].evidence === { error_kind: 'Error', error_message: '...' }
// The envelope never throws in this case.
```

## Module Structure

```
src/integration/phalanx/
  types.ts      — PhalanxCtCall, CtVerdict, CtObjection, PhalanxContractInputError
  mapping.ts    — mapToolResultToObjections, verdictFromObjections, computeObjectionId
  versions.ts   — buildMechanismVersions (pinned to SERVER_INFO.version)
  envelope.ts   — invokePhalanxContract (main entry point)
  failure.ts    — transportFailureVerdict (soft-fail path)
  index.ts      — public exports
```

## Non-Goals (V1)

The following requirements are **Phalanx-owned** in V1 and are explicitly out of
scope for CT-MCP Slice 1:

- R-2 rebuttal loop and cycle caps (Slice 2)
- R-3 proof classification (Phalanx owns)
- R-4 canonical truth (Phalanx owns)
- R-5 hallucinated seam detection (Phalanx owns)
- R-8 retry drift (Phalanx owns)
