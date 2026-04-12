/**
 * index.ts — Public API for the Phalanx integration module.
 */

// Core envelope function
export { invokePhalanxContract } from './envelope.js';
export type { ToolInvoker } from './envelope.js';

// Types
export type {
  ClaimEdge,
  ClaimEdgeRelation,
  ClaimGraph,
  ClaimNode,
  ClaimNodeType,
  ConcurrencyDescription,
  ConfidenceAssumption,
  ConfidenceAssumptions,
  CtObjection,
  CtVerdict,
  ObjectionSeverity,
  PhalanxCtCall,
  PhalanxCtCallPayload,
  PhalanxPhase,
  PlanStep,
  PlanSteps,
  Verdict,
} from './types.js';

export { PhalanxContractInputError } from './types.js';

// Utility exports (useful for testing and upstream integration)
export { transportFailureVerdict } from './failure.js';
export { computeObjectionId, mapToolResultToObjections, verdictFromObjections } from './mapping.js';
export { buildMechanismVersions } from './versions.js';
