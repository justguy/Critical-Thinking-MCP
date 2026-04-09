/**
 * Orchestrator router.
 *
 * Uses the existing deterministic claim_classifier to suggest tools, then
 * intersects those suggestions with the contracts the caller actually
 * supplied. Standard mode runs only the routed intersection.
 *
 * The router never invents missing structure. If the classifier suggests a
 * tool but the matching contract is absent from the envelope, that tool is
 * dropped from the routed set. The router does not synthesize a contract
 * from the answer text.
 */

import { classifyClaim, type ClaimClassification } from '../enforcement/claim_classifier.js';
import {
  CONTRACT_KEY_TO_TYPE,
  CONTRACT_TO_TOOL,
  TOOL_TO_CONTRACT,
} from './contracts.js';
import type {
  ContractKey,
  ContractType,
  OrchestratorEnvelope,
  OrchestratorToolName,
} from './types.js';

// Subset of classifier suggestions that map to orchestrator-routable tools.
// Tools without an orchestrator contract (check_numeric_claims, etc.) are
// intentionally not routable through this layer in v0.
const CLASSIFIER_TO_ORCHESTRATOR_TOOL: Record<string, OrchestratorToolName | undefined> = {
  validate_confidence: 'validate_confidence',
  validate_reasoning_chain: 'validate_reasoning_chain',
  check_plan_validity: 'check_plan_validity',
  detect_concurrency_patterns: 'detect_concurrency_patterns',
  score_response_quality: 'score_response_quality',
  // The following classifier suggestions are intentionally not orchestrator-routable in v0:
  check_numeric_claims: undefined,
  detect_drift: undefined,
  evaluate_tradeoffs: undefined,
  verify_arithmetic: undefined,
};

export interface RouterResult {
  primary_type: string;
  secondary_type: string | null;
  classifier_confidence: number;
  classifier_suggested_tools: string[];
  orchestrator_eligible_tools: OrchestratorToolName[];
  routed_tools: OrchestratorToolName[];
  artifact_compatible_tools: OrchestratorToolName[];
  present_contracts: ContractType[];
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function routeEnvelope(envelope: OrchestratorEnvelope): RouterResult {
  // 1. Classify the answer using the existing deterministic classifier.
  const classification: ClaimClassification = classifyClaim(envelope.answer_text);

  // 2. Project classifier suggestions onto the orchestrator's routable set.
  const eligible = dedupe(
    classification.suggested_tools
      .map(t => CLASSIFIER_TO_ORCHESTRATOR_TOOL[t])
      .filter((t): t is OrchestratorToolName => t !== undefined),
  );

  // 3. Determine which contracts the caller actually supplied.
  const presentContracts: ContractType[] = [];
  for (const [key, value] of Object.entries(envelope.contracts)) {
    if (value === undefined || value === null) continue;
    const contractType = CONTRACT_KEY_TO_TYPE[key as ContractKey];
    if (contractType) presentContracts.push(contractType);
  }
  const presentSet = new Set(presentContracts);

  // 4. Routed tools = eligible ∩ (tools whose contract is present).
  //    No contract → no route, even if the classifier suggested it.
  const routed = eligible.filter(tool => presentSet.has(TOOL_TO_CONTRACT[tool]));

  // 5. Artifact-compatible tools = every tool whose contract is present,
  //    regardless of classifier suggestion. Shadow mode runs all of these.
  const artifactCompatible = dedupe(
    presentContracts.map(ct => CONTRACT_TO_TOOL[ct]),
  );

  return {
    primary_type: classification.primary_type,
    secondary_type: classification.secondary_type,
    classifier_confidence: classification.confidence,
    classifier_suggested_tools: classification.suggested_tools,
    orchestrator_eligible_tools: eligible,
    routed_tools: routed,
    artifact_compatible_tools: artifactCompatible,
    present_contracts: presentContracts,
  };
}
