/**
 * envelope.ts — Phalanx integration envelope.
 *
 * Accepts a PhalanxCtCall, validates it, dispatches to the appropriate
 * ct-mcp tools, maps raw results to CtObjection records, and returns a
 * CtVerdict. Transport errors produce a soft-fail WARN verdict.
 */

import { transportFailureVerdict } from './failure.js';
import { mapToolResultToObjections, verdictFromObjections } from './mapping.js';
import type {
  ClaimEdgeRelation,
  ClaimNodeType,
  ConfidenceAssumptions,
  ClaimGraph,
  PlanSteps,
  ConcurrencyDescription,
  CtObjection,
  CtVerdict,
  PhalanxCtCall,
} from './types.js';
import { PhalanxContractInputError } from './types.js';
import { buildMechanismVersions } from './versions.js';

// ====== Tool invoker type ======

/**
 * Abstraction over the actual tool dispatch. In production this calls the
 * real tool handler; in tests it is replaced with a mock.
 */
export type ToolInvoker = (toolName: string, args: unknown) => Promise<unknown>;

// ====== Input validation helpers ======

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isNumberInRange(v: unknown, min: number, max: number): v is number {
  return typeof v === 'number' && v >= min && v <= max;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}

const VALID_PHASES = new Set([
  'planning',
  'blueprint_convergence',
  'execution_retry',
  'verification',
  'closeout',
]);

const VALID_CLAIM_NODE_TYPES = new Set<ClaimNodeType>([
  'claim',
  'evidence',
  'conclusion',
  'assumption',
]);

const VALID_CLAIM_EDGE_RELATIONS = new Set<ClaimEdgeRelation>([
  'supports',
  'implies',
  'contradicts',
  'requires',
]);

const VALID_DELIVERY_MODELS = new Set(['at_least_once', 'at_most_once', 'exactly_once']);
const VALID_RETRY_BEHAVIORS = new Set(['none', 'automatic', 'manual']);

// ====== Sub-payload validators ======

/**
 * Validate payload.assumptions — throws PhalanxContractInputError on violation.
 * Returns a typed ConfidenceAssumptions on success.
 */
function validateAssumptions(raw: unknown, path: string): ConfidenceAssumptions {
  if (raw === null || typeof raw !== 'object') {
    throw new PhalanxContractInputError(`${path} must be a non-null object`);
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.assumptions)) {
    throw new PhalanxContractInputError(`${path}.assumptions must be an array`);
  }

  for (let i = 0; i < (obj.assumptions as unknown[]).length; i++) {
    const item = (obj.assumptions as unknown[])[i];
    if (item === null || typeof item !== 'object') {
      throw new PhalanxContractInputError(`${path}.assumptions[${i}] must be a non-null object`);
    }

    const a = item as Record<string, unknown>;

    if (!isNonEmptyString(a.description)) {
      throw new PhalanxContractInputError(
        `${path}.assumptions[${i}].description must be a non-empty string`,
      );
    }

    if (!isNumberInRange(a.confidence, 0, 1)) {
      throw new PhalanxContractInputError(
        `${path}.assumptions[${i}].confidence must be a number in [0, 1]`,
      );
    }

    if (a.falsification_condition !== undefined && !isString(a.falsification_condition)) {
      throw new PhalanxContractInputError(
        `${path}.assumptions[${i}].falsification_condition must be a string if present`,
      );
    }
  }

  if (!isString(obj.response_text) || obj.response_text.length < 10) {
    throw new PhalanxContractInputError(
      `${path}.response_text must be a string of at least 10 characters (matches validate_confidence minimum)`,
    );
  }

  return raw as ConfidenceAssumptions;
}

/**
 * Validate payload.claims — throws PhalanxContractInputError on violation.
 * Returns a typed ClaimGraph on success.
 */
function validateClaims(raw: unknown, path: string): ClaimGraph {
  if (raw === null || typeof raw !== 'object') {
    throw new PhalanxContractInputError(`${path} must be a non-null object`);
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.nodes) || (obj.nodes as unknown[]).length < 2) {
    throw new PhalanxContractInputError(
      `${path}.nodes must be an array of at least 2 nodes (matches validate_reasoning_chain minimum)`,
    );
  }

  const nodeIds = new Set<string>();

  for (let i = 0; i < (obj.nodes as unknown[]).length; i++) {
    const item = (obj.nodes as unknown[])[i];
    if (item === null || typeof item !== 'object') {
      throw new PhalanxContractInputError(`${path}.nodes[${i}] must be a non-null object`);
    }

    const n = item as Record<string, unknown>;

    if (!isNonEmptyString(n.id)) {
      throw new PhalanxContractInputError(`${path}.nodes[${i}].id must be a non-empty string`);
    }

    if (!isString(n.label)) {
      throw new PhalanxContractInputError(`${path}.nodes[${i}].label must be a string`);
    }

    if (!isNonEmptyString(n.type) || !VALID_CLAIM_NODE_TYPES.has(n.type as ClaimNodeType)) {
      throw new PhalanxContractInputError(
        `${path}.nodes[${i}].type must be one of: ${[...VALID_CLAIM_NODE_TYPES].join(', ')}`,
      );
    }

    nodeIds.add(n.id);
  }

  if (!Array.isArray(obj.edges) || (obj.edges as unknown[]).length < 1) {
    throw new PhalanxContractInputError(
      `${path}.edges must be an array of at least 1 edge (matches validate_reasoning_chain minimum)`,
    );
  }

  for (let i = 0; i < (obj.edges as unknown[]).length; i++) {
    const item = (obj.edges as unknown[])[i];
    if (item === null || typeof item !== 'object') {
      throw new PhalanxContractInputError(`${path}.edges[${i}] must be a non-null object`);
    }

    const e = item as Record<string, unknown>;

    if (!isString(e.from)) {
      throw new PhalanxContractInputError(`${path}.edges[${i}].from must be a string`);
    }

    if (!isString(e.to)) {
      throw new PhalanxContractInputError(`${path}.edges[${i}].to must be a string`);
    }

    if (
      !isNonEmptyString(e.relation) ||
      !VALID_CLAIM_EDGE_RELATIONS.has(e.relation as ClaimEdgeRelation)
    ) {
      throw new PhalanxContractInputError(
        `${path}.edges[${i}].relation must be one of: ${[...VALID_CLAIM_EDGE_RELATIONS].join(', ')}`,
      );
    }

    if (!nodeIds.has(e.from as string)) {
      throw new PhalanxContractInputError(
        `${path}.edges[${i}].from "${e.from}" does not refer to a known node id`,
      );
    }

    if (!nodeIds.has(e.to as string)) {
      throw new PhalanxContractInputError(
        `${path}.edges[${i}].to "${e.to}" does not refer to a known node id`,
      );
    }
  }

  return raw as ClaimGraph;
}

/**
 * Validate payload.steps — throws PhalanxContractInputError on violation.
 * Returns a typed PlanSteps on success.
 */
function validateSteps(raw: unknown, path: string): PlanSteps {
  if (raw === null || typeof raw !== 'object') {
    throw new PhalanxContractInputError(`${path} must be a non-null object`);
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.steps) || (obj.steps as unknown[]).length < 2) {
    throw new PhalanxContractInputError(
      `${path}.steps must be an array of at least 2 steps (matches check_plan_validity minimum)`,
    );
  }

  for (let i = 0; i < (obj.steps as unknown[]).length; i++) {
    const item = (obj.steps as unknown[])[i];
    if (item === null || typeof item !== 'object') {
      throw new PhalanxContractInputError(`${path}.steps[${i}] must be a non-null object`);
    }

    const s = item as Record<string, unknown>;

    if (!isString(s.id)) {
      throw new PhalanxContractInputError(`${path}.steps[${i}].id must be a string`);
    }

    if (!isString(s.description)) {
      throw new PhalanxContractInputError(`${path}.steps[${i}].description must be a string`);
    }

    if (!isStringArray(s.dependencies)) {
      throw new PhalanxContractInputError(
        `${path}.steps[${i}].dependencies must be an array of strings`,
      );
    }

    if (s.resources !== undefined && !isStringArray(s.resources)) {
      throw new PhalanxContractInputError(
        `${path}.steps[${i}].resources must be an array of strings if present`,
      );
    }
  }

  return raw as PlanSteps;
}

/**
 * Validate payload.operations — throws PhalanxContractInputError on violation.
 * Returns a typed ConcurrencyDescription on success.
 */
function validateOperations(raw: unknown, path: string): ConcurrencyDescription {
  if (raw === null || typeof raw !== 'object') {
    throw new PhalanxContractInputError(`${path} must be a non-null object`);
  }

  const obj = raw as Record<string, unknown>;

  if (!isStringArray(obj.steps) || (obj.steps as string[]).length === 0) {
    throw new PhalanxContractInputError(`${path}.steps must be a non-empty array of strings`);
  }

  if (obj.shared_resources !== undefined && !isStringArray(obj.shared_resources)) {
    throw new PhalanxContractInputError(
      `${path}.shared_resources must be an array of strings if present`,
    );
  }

  if (obj.protections !== undefined && !isStringArray(obj.protections)) {
    throw new PhalanxContractInputError(
      `${path}.protections must be an array of strings if present`,
    );
  }

  if (
    obj.delivery_model !== undefined &&
    (!isString(obj.delivery_model) || !VALID_DELIVERY_MODELS.has(obj.delivery_model))
  ) {
    throw new PhalanxContractInputError(
      `${path}.delivery_model must be one of: ${[...VALID_DELIVERY_MODELS].join(', ')} if present`,
    );
  }

  if (
    obj.retry_behavior !== undefined &&
    (!isString(obj.retry_behavior) || !VALID_RETRY_BEHAVIORS.has(obj.retry_behavior))
  ) {
    throw new PhalanxContractInputError(
      `${path}.retry_behavior must be one of: ${[...VALID_RETRY_BEHAVIORS].join(', ')} if present`,
    );
  }

  return raw as ConcurrencyDescription;
}

// ====== Top-level call validator ======

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

  // At least one of the four sub-payloads must be present
  const hasAssumptions = payload.assumptions !== undefined;
  const hasClaims = payload.claims !== undefined;
  const hasSteps = payload.steps !== undefined;
  const hasOperations = payload.operations !== undefined;

  if (!hasAssumptions && !hasClaims && !hasSteps && !hasOperations) {
    throw new PhalanxContractInputError(
      'PhalanxCtCall.payload must contain at least one of: assumptions, claims, steps, or operations',
    );
  }

  // Validate each sub-payload that is present
  if (hasAssumptions) {
    validateAssumptions(payload.assumptions, 'PhalanxCtCall.payload.assumptions');
  }

  if (hasClaims) {
    validateClaims(payload.claims, 'PhalanxCtCall.payload.claims');
  }

  if (hasSteps) {
    validateSteps(payload.steps, 'PhalanxCtCall.payload.steps');
  }

  if (hasOperations) {
    validateOperations(payload.operations, 'PhalanxCtCall.payload.operations');
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

    // Dispatch: check_plan_validity when steps present
    if (payload.steps !== undefined) {
      const toolName = 'check_plan_validity';
      const args: Record<string, unknown> = {
        steps: payload.steps.steps,
      };

      const result = await toolInvoker(toolName, args);
      invokedTools.push(toolName);
      const objections = mapToolResultToObjections(toolName, result, call.call_id);
      allObjections.push(...objections);
    }

    // Dispatch: detect_concurrency_patterns when operations present
    if (payload.operations !== undefined) {
      const toolName = 'detect_concurrency_patterns';
      // Forward the full ConcurrencyDescription object
      const args: Record<string, unknown> = {
        steps: payload.operations.steps,
      };
      if (payload.operations.shared_resources !== undefined) {
        args.shared_resources = payload.operations.shared_resources;
      }
      if (payload.operations.protections !== undefined) {
        args.protections = payload.operations.protections;
      }
      if (payload.operations.delivery_model !== undefined) {
        args.delivery_model = payload.operations.delivery_model;
      }
      if (payload.operations.retry_behavior !== undefined) {
        args.retry_behavior = payload.operations.retry_behavior;
      }

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
