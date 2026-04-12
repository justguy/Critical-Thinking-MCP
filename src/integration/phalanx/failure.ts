/**
 * failure.ts — Soft-fail transport-error verdict.
 *
 * When a tool invocation throws (network issue, timeout, unexpected exception),
 * the envelope converts it to a WARN verdict rather than propagating the error
 * to the Phalanx caller. This keeps CT-MCP outages from hard-blocking the
 * pipeline per the Failure Modes section of CT_MCP_REQUIREMENTS.md.
 */

import { computeObjectionId } from './mapping.js';
import type { CtObjection, CtVerdict, PhalanxCtCall } from './types.js';

/**
 * Return a WARN CtVerdict for a transport/invocation error.
 * Never throws.
 */
export function transportFailureVerdict(
  call: PhalanxCtCall,
  err: unknown,
  elapsed_ms: number = 0,
): CtVerdict {
  const error_message = err instanceof Error ? err.message : String(err);
  const error_kind = err instanceof Error ? err.name : 'UnknownError';

  const mechanism = 'phalanx_ct_mcp_transport';
  const message = `CT-MCP transport failure: ${error_message}`;

  const objection: CtObjection = {
    objection_id: computeObjectionId(call.call_id, 'envelope', mechanism, message),
    mechanism,
    severity: 'warning',
    message,
    evidence: { error_kind, error_message },
  };

  return {
    call_id: call.call_id,
    verdict: 'WARN',
    objections: [objection],
    elapsed_ms,
    mechanism_versions: {},
  };
}
