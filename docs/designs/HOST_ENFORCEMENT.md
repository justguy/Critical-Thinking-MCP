# Host Enforcement — making the gate mandatory (deterministic, no agent)

ct-mcp tools are **model-controlled**: the protocol can't force an agent to call them, and a pure
function can't verify who authored its inputs or read a clock. So the design splits responsibility — the
MCP makes "done" *checkable*; a **host** makes it *mandatory*. This is that host, shipped as a reference:
`src/host/enforcement_host.ts` + the `ct-enforce` CLI. It is **strictly deterministic — no LLM, no agent,
no network, no clock**. The agent stays outside; the host decides release.

## The four host obligations (from `factual-qa-slice.md`) and how this discharges them

| Obligation | Discharged by |
|---|---|
| 1. Host authors the contract (not the agent) | `enforceDeliverable` always sets `contract_authority='host'`, `profile_source='host_supplied'` → `contract_strength: host_anchored`. |
| 2. Host supplies `eval_time` with `authority:'host'` | `opts.eval_time` is passed straight through to `finalize` (only host authority lets `check_freshness` block). |
| 3. Host verifies `answer_text_hash` | After PASS, the host recomputes `sha256(normalize(surfaced_answer))` and **REJECTs on mismatch** (anti-swap). |
| 4. Host gates release on PASS | Release happens **only** when `finalize_verdict==='PASS'` *and* the hash matches. |

## Enforcement order (short-circuits)
1. Build the host-authored contract.
2. Call `finalize_deliverable` (re-runs the contract's required unforgeable checks inline).
3. `finalize_verdict !== 'PASS'` → **REJECT `gate_block`** (hands back `corrective_prompt`).
4. `sha256(normalize(surfaced_answer)) !== answer_text_hash` → **REJECT `hash_mismatch`**.
5. Otherwise → **RELEASE**.

## API
```ts
import { enforceDeliverable } from 'ct-mcp/dist/host/enforcement_host.js';
const decision = enforceDeliverable(spec, artifacts, { eval_time, surfaced_answer });
// decision.decision: 'RELEASE' | 'REJECT'; .reason; .corrective_prompt; .answer_text_hash; ...
```
- `spec` (host-authored): `contract_id, original_request_text, task_type, evidence_level, risk_level`,
  plus optional `claims, must_include, must_not_include, required_fields, acceptance_criteria, freshness`.
- `artifacts` (agent-produced, host only verifies): `answer_text` + any of
  `sources, claims, inputs, conclusion_numbers, constraints, structured_answer, case_partition`.
- `opts.finalize`: inject an MCP-over-stdio client to enforce against a **live server**; the default
  calls the same deterministic handler the server runs (functionally identical, simpler to test).

## CLI (`ct-enforce`) — a release gate for a pipeline / CI
```bash
node dist/host/cli.js deliverable.json    # or:  ct-enforce < deliverable.json
```
Input: `{ "spec": {...}, "artifacts": {...}, "eval_time"?: {...}, "surfaced_answer"?: "..." }`.
Prints the `ReleaseDecision`; **exits 0 on RELEASE, 1 on REJECT, 2 on bad input** — so it drops straight
into a shell/CI gate.

## Honest limits (unchanged by adding a host)
- **It does not author the contract or the artifacts for you.** The host must supply the contract; the
  agent must supply the artifacts. PASS is only as strong as the declared contract (under-declare → PASS
  asserts less). This is the documented anti-omission ceiling.
- **PASS ≠ true.** It proves the declared machine-checkable obligations were discharged on the exact text
  surfaced — not that the answer is correct. Grounding proves containment, not truth.
- **Determinism preserved.** No clock, no network, no model call anywhere in the host path.
