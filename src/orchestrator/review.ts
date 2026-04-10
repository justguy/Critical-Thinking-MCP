/**
 * Route execution + contract → tool input mapping.
 *
 * The mapper is intentionally a thin pass-through. It does not invent
 * fields. It does not coerce strings into graph nodes. If the contract is
 * missing a required field, schema validation will have already returned
 * ENFORCEMENT_FAIL before this code runs — the deterministic tool MUST
 * NOT execute on a malformed contract.
 */

import { EnforcementEngine } from '../enforcement/index.js';
import { handleValidateConfidence } from '../tools/validate_confidence.js';
import { handleValidateReasoningChain } from '../tools/validate_reasoning_chain.js';
import { handleCheckPlanValidity } from '../tools/check_plan_validity.js';
import { handleDetectConcurrencyPatterns } from '../tools/detect_concurrency_patterns.js';
import { handleScoreResponseQuality } from '../tools/score_response_quality.js';

import { TOOL_TO_CONTRACT } from './contracts.js';
import { makeSchemaFailure, validateContract } from './schemaValidation.js';
import type {
  ConfidenceContract,
  ConcurrencyContract,
  OrchestratorToolName,
  PlanContract,
  QualityContract,
  ReasoningChainContract,
  ReviewContext,
  RouteOrFailure,
  RouteResult,
} from './types.js';

interface ToolEnvelope {
  status?: unknown;
  enforcement?: RouteResult['enforcement'];
}

function extractStatus(result: ToolEnvelope): 'PASS' | 'ENFORCEMENT_FAIL' {
  return result.status === 'ENFORCEMENT_FAIL' ? 'ENFORCEMENT_FAIL' : 'PASS';
}

function callDeterministicTool(
  tool: OrchestratorToolName,
  contract: unknown,
  reviewContext: ReviewContext,
): RouteResult {
  const engine = new EnforcementEngine();
  const enforcementContext = {
    iteration_number: reviewContext.iteration_number,
  };

  let raw: unknown;
  try {
    switch (tool) {
      case 'validate_confidence': {
        const c = contract as ConfidenceContract;
        raw = handleValidateConfidence(
          {
            assumptions: c.assumptions,
            response_text: c.response_text,
            context: enforcementContext,
          },
          engine,
        );
        break;
      }

      case 'validate_reasoning_chain': {
        const c = contract as ReasoningChainContract;
        raw = handleValidateReasoningChain(
          {
            nodes: c.nodes,
            edges: c.edges,
            context: enforcementContext,
          },
          engine,
        );
        break;
      }

      case 'check_plan_validity': {
        const c = contract as PlanContract;
        raw = handleCheckPlanValidity(
          {
            steps: c.steps,
            context: enforcementContext,
          },
          engine,
        );
        break;
      }

      case 'detect_concurrency_patterns': {
        const c = contract as ConcurrencyContract;
        raw = handleDetectConcurrencyPatterns(
          {
            steps: c.steps,
            shared_resources: c.shared_resources,
            protections: c.protections,
            delivery_model: c.delivery_model,
            retry_behavior: c.retry_behavior,
            capacity_model: c.capacity_model,
            resource_allocation: c.resource_allocation,
            context: enforcementContext,
          },
          engine,
        );
        break;
      }

      case 'score_response_quality': {
        const c = contract as QualityContract;
        raw = handleScoreResponseQuality(
          {
            response_text: c.response_text,
            claims: c.claims,
            evidence: c.evidence,
            context: enforcementContext,
          },
          engine,
        );
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      tool,
      contract_type: TOOL_TO_CONTRACT[tool],
      status: 'ENFORCEMENT_FAIL',
      result: null,
      enforcement: {
        blocking_issues: [
          {
            mechanism: 'tool_execution_error',
            description: `Deterministic tool ${tool} threw: ${message}`,
            severity: 'blocking',
          },
        ],
        warnings: [],
        corrective_prompt: `Tool ${tool} could not execute: ${message}`,
      },
    };
  }

  const envelope = (raw ?? {}) as ToolEnvelope;
  return {
    tool,
    contract_type: TOOL_TO_CONTRACT[tool],
    status: extractStatus(envelope),
    result: raw,
    enforcement: envelope.enforcement,
  };
}

/**
 * Validate the contract for a route, then either return a SchemaFailure
 * (no tool call) or execute the deterministic tool.
 */
export function executeRoute(
  tool: OrchestratorToolName,
  contractData: unknown,
  reviewContext: ReviewContext,
): RouteOrFailure {
  const contractType = TOOL_TO_CONTRACT[tool];

  // Schema validation runs first. A schema failure halts the route.
  const validation = validateContract(contractType, contractData);
  if (!validation.valid) {
    return makeSchemaFailure(tool, contractType, validation.errors);
  }

  return callDeterministicTool(tool, contractData, reviewContext);
}
