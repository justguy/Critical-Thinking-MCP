/**
 * plan_token — the deterministic contract→artifacts→answer chain (§3.1).
 *
 * A `plan_token` is a keyless SHA-256 over the CANONICAL CONTRACT IDENTITY: the
 * exact fields that decide the check profile and the obligations finalize must
 * discharge. `plan_checks` issues it; `finalize_deliverable` RECOMPUTES it from
 * the contract it actually checked and verifies the supplied token matches.
 *
 * Why this holds for a RAW MCP client (no enforcement_host wrapper):
 *   The host layer already closes the "checked one answer, shipped another" gap
 *   with answer_text_hash. But a raw client that talks straight to the MCP server
 *   could plan against a strong contract, then finalize against a quietly WEAKER
 *   one (fewer claims, must_include dropped, evidence_level lowered) to dodge the
 *   profile. The plan_token binds the contract that was PLANNED to the contract
 *   that is FINALIZED: change any obligation-bearing field and the recomputed
 *   token no longer matches the issued one, so finalize BLOCKS. Combined with the
 *   existing answer_text_hash binding, this gives a contract→artifacts→answer
 *   chain that does not depend on a host wrapper to be sound.
 *
 * Honest limit: the token proves contract IDENTITY continuity, not contract
 * authorship — a raw client still authors its own contract (contract_strength
 * stays weak_agent_declared). It removes the silent-downgrade-after-planning
 * dodge; it does not turn an agent-authored contract into a host-authored one.
 *
 * Pure. Deterministic. Keyless. No LLM, no state, no clock.
 */

import type { DeliverableContract } from './types.js';
import { canonicalJson, sha256Hex } from './utils.js';

/** Stable prefix so a plan_token can never collide with a bare answer_text_hash. */
const PLAN_TOKEN_PREFIX = 'ctmcp.plan_token.v1';

/**
 * The obligation-bearing projection of a contract. ONLY fields that change what
 * finalize must enforce go in here, so cosmetic/non-binding fields never perturb
 * the token. Anything that alters the check profile or a gate obligation IS here.
 */
export interface ContractIdentity {
  contract_id: string;
  task_type: string;
  evidence_level: string;
  risk_level: string;
  contract_authority?: string;
  profile_source?: string;
  original_request_text: string;
  claims?: unknown;
  must_include?: unknown;
  must_not_include?: unknown;
  required_fields?: unknown;
  constraints?: unknown;
  acceptance_criteria?: unknown;
  freshness?: unknown;
}

/** Project a contract onto the obligation-bearing identity hashed by the token. */
export function contractIdentity(contract: DeliverableContract): ContractIdentity {
  return {
    contract_id: contract.contract_id,
    task_type: contract.task_type,
    evidence_level: contract.evidence_level,
    risk_level: contract.risk_level,
    contract_authority: contract.contract_authority,
    profile_source: contract.profile_source,
    original_request_text: contract.original_request_text,
    claims: contract.claims,
    must_include: contract.must_include,
    must_not_include: contract.must_not_include,
    required_fields: contract.required_fields,
    constraints: contract.constraints,
    acceptance_criteria: contract.acceptance_criteria,
    freshness: contract.freshness,
  };
}

/**
 * Compute the plan_token for a contract. Order-independent (canonical JSON) and
 * keyless, so plan_checks and finalize_deliverable derive the SAME token from the
 * SAME obligation-bearing fields without sharing state.
 */
export function computePlanToken(contract: DeliverableContract): string {
  const payload = `${PLAN_TOKEN_PREFIX}:${canonicalJson(contractIdentity(contract))}`;
  return `${PLAN_TOKEN_PREFIX}.${sha256Hex(payload)}`;
}

/** True iff `token` is the plan_token for `contract`. Constant-shape comparison. */
export function verifyPlanToken(contract: DeliverableContract, token: string): boolean {
  return typeof token === 'string' && token.length > 0 && token === computePlanToken(contract);
}
