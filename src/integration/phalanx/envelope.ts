/**
 * envelope.ts — Phalanx integration envelope.
 *
 * Accepts a PhalanxCtCall, validates it, dispatches to the appropriate
 * ct-mcp tools, maps raw results to CtObjection records, and returns a
 * CtVerdict. Transport errors produce a soft-fail WARN verdict.
 */

import { transportFailureVerdict } from './failure.js';
import { mapToolResultToObjections, verdictFromObjections } from './mapping.js';
import type { CtObjection, CtVerdict, PhalanxCtCall } from './types.js';
import { PhalanxContractInputError } from './types.js';
import { buildMechanismVersions } from './versions.js';

// ====== Tool invoker type ======

/**
 * Abstraction over the actual tool dispatch. In production this calls the
 * real tool handler; in tests it is replaced with a mock.
 */
export type ToolInvoker = (toolName: string, args: unknown) => Promise<unknown>;

// ====== Input validation ======

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

const VALID_PHASES = new Set([
  'planning',
  'blueprint_convergence',
  'execution_retry',
  'verification',
  'closeout',
]);

/**
 * Validate a raw unknown value as a PhalanxCtCall.
 * Throws PhalanxContractInputError on any violation.
 */
function validateCall(raw: unknown): PhalanxCtCall {
  if (raw === null || typeof raw !== 'object') {
    throw new PhalanxContractInputError('PhalanxCtCall must be a non-null object');
  }

  const obj = raw as Record<string, unknown>;

  if (!isNonEmptyString(obj.call_id)) {
    throw new PhalanxContractInputError('PhalanxCtCall.call_id must be a non-empty string');
  }

  if (!isNonEmptyString(obj.phase) || !VALID_PHASES.has(obj.phase)) {
    throw new PhalanxContractInputError(
      `PhalanxCtCall.phase must be one of: ${[...VALID_PHASES].join(', ')}`,
    );
  }

  if (obj.piece_id !== null && typeof obj.piece_id !== 'string') {
    throw new PhalanxContractInputError('PhalanxCtCall.piece_id must be a string or null');
  }

  if (!isNonEmptyString(obj.run_id)) {
    throw new PhalanxContractInputError('PhalanxCtCall.run_id must be a non-empty string');
  }

  if (obj.payload === null || typeof obj.payload !== 'object') {
    throw new PhalanxContractInputError('PhalanxCtCall.payload must be a non-null object');
  }

  const payload = obj.payload as Record<string, unknown>;

  // At least one of assumptions or claims must be present
  const hasAssumptions = payload.assumptions !== undefined;
  const hasClaims = payload.claims !== undefined;

  if (!hasAssumptions && !hasClaims) {
    throw new PhalanxContractInputError(
      'PhalanxCtCall.payload must contain at least one of: assumptions (for validate_confidence) or claims (for validate_reasoning_chain)',
    );
  }

  return raw as PhalanxCtCall;
}

// ====== Main envelope function ======

/**
 * Execute the Phalanx integration contract for a single call.
 *
 * - Validates input first; throws PhalanxContractInputError on malformed input.
 * - Dispatches to whichever tool(s) the payload implies.
 * - Catches all transport errors and returns a soft-fail WARN verdict.
 * - Times wall-clock elapsed_ms from first dispatch to return.
 */
export async function invokePhalanxContract(
  raw: unknown,
  toolInvoker: ToolInvoker,
): Promise<CtVerdict> {
  // Schema validation — throws before any dispatch
  const call = validateCall(raw);

  const start = Date.now();

  try {
    const allObjections: CtObjection[] = [];
    const invokedTools: string[] = [];

    const { payload } = call;

    // Dispatch: validate_confidence when assumptions present
    if (payload.assumptions !== undefined) {
      const toolName = 'validate_confidence';
      const args: Record<string, unknown> = {
        assumptions: payload.assumptions.assumptions,
        response_text: payload.assumptions.response_text,
      };

      const result = await toolInvoker(toolName, args);
      invokedTools.push(toolName);
      const objections = mapToolResultToObjections(toolName, result, call.call_id);
      allObjections.push(...objections);
    }

    // Dispatch: validate_reasoning_chain when claims present
    if (payload.claims !== undefined) {
      const toolName = 'validate_reasoning_chain';
      const args: Record<string, unknown> = {
        nodes: payload.claims.nodes,
        edges: payload.claims.edges,
      };

      const result = await toolInvoker(toolName, args);
      invokedTools.push(toolName);
      const objections = mapToolResultToObjections(toolName, result, call.call_id);
      allObjections.push(...objections);
    }

    const elapsed_ms = Date.now() - start;
    const verdict = verdictFromObjections(allObjections);
    const mechanism_versions = buildMechanismVersions(invokedTools);

    return {
      call_id: call.call_id,
      verdict,
      objections: allObjections,
      elapsed_ms,
      mechanism_versions,
    };
  } catch (err) {
    // PhalanxContractInputError is a caller bug — re-throw; don't soft-fail it.
    if (err instanceof PhalanxContractInputError) {
      throw err;
    }

    // All other errors are transport/invocation failures — soft-fail to WARN.
    const elapsed_ms = Date.now() - start;
    return transportFailureVerdict(call, err, elapsed_ms);
  }
}
