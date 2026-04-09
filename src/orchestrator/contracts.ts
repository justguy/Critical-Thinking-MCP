/**
 * Strict JSON Schema definitions for orchestrator contracts.
 *
 * Every route family has a strict object schema. additionalProperties is
 * disabled at every level so that drift in caller payloads becomes a
 * schema-validation failure rather than a silent route execution.
 *
 * The orchestrator uses these schemas to fail before any deterministic
 * tool call. There is no prose-rescue parser anywhere in this module.
 */

import type { ContractKey, ContractType, OrchestratorToolName } from './types.js';

// ─── Tool ↔ contract mapping ───────────────────────────────────────────────

export const TOOL_TO_CONTRACT: Record<OrchestratorToolName, ContractType> = {
  validate_confidence: 'confidence_contract',
  validate_reasoning_chain: 'reasoning_chain_contract',
  check_plan_validity: 'plan_contract',
  detect_concurrency_patterns: 'concurrency_contract',
  score_response_quality: 'quality_contract',
};

export const CONTRACT_TO_TOOL: Record<ContractType, OrchestratorToolName> = {
  confidence_contract: 'validate_confidence',
  reasoning_chain_contract: 'validate_reasoning_chain',
  plan_contract: 'check_plan_validity',
  concurrency_contract: 'detect_concurrency_patterns',
  quality_contract: 'score_response_quality',
};

export const CONTRACT_KEY_TO_TYPE: Record<ContractKey, ContractType> = {
  confidence: 'confidence_contract',
  reasoning_chain: 'reasoning_chain_contract',
  plan: 'plan_contract',
  concurrency: 'concurrency_contract',
  quality: 'quality_contract',
};

export const TOOL_TO_CONTRACT_KEY: Record<OrchestratorToolName, ContractKey> = {
  validate_confidence: 'confidence',
  validate_reasoning_chain: 'reasoning_chain',
  check_plan_validity: 'plan',
  detect_concurrency_patterns: 'concurrency',
  score_response_quality: 'quality',
};

// ─── Envelope schema ──────────────────────────────────────────────────────

export const ENVELOPE_SCHEMA = {
  type: 'object',
  required: ['schema_version', 'answer_text', 'contracts', 'mode', 'review_context'],
  additionalProperties: false,
  properties: {
    schema_version: { type: 'string', const: 'orchestrator_v0' },
    answer_text: { type: 'string', minLength: 1 },
    contracts: {
      type: 'object',
      additionalProperties: false,
      properties: {
        confidence: {},
        reasoning_chain: {},
        plan: {},
        concurrency: {},
        quality: {},
      },
    },
    mode: { type: 'string', enum: ['routed', 'shadow'] },
    review_context: {
      type: 'object',
      required: ['iteration_number', 'prior_failures'],
      additionalProperties: false,
      properties: {
        iteration_number: { type: 'integer', minimum: 1 },
        prior_failures: {
          type: 'array',
          items: {
            type: 'object',
            required: ['tool', 'failure_type', 'blocking_issues'],
            additionalProperties: false,
            properties: {
              tool: { type: 'string' },
              failure_type: { type: 'string' },
              blocking_issues: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const;

// ─── Confidence contract ──────────────────────────────────────────────────

export const CONFIDENCE_CONTRACT_SCHEMA = {
  type: 'object',
  required: ['response_text', 'assumptions'],
  additionalProperties: false,
  properties: {
    response_text: { type: 'string', minLength: 10 },
    assumptions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['description', 'confidence', 'falsification_condition'],
        additionalProperties: false,
        properties: {
          description: { type: 'string', minLength: 1 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          falsification_condition: { type: 'string', minLength: 1 },
        },
      },
    },
  },
} as const;

// ─── Reasoning chain contract ─────────────────────────────────────────────

export const REASONING_CHAIN_CONTRACT_SCHEMA = {
  type: 'object',
  required: ['nodes', 'edges'],
  additionalProperties: false,
  properties: {
    nodes: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        required: ['id', 'label', 'type'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', minLength: 1 },
          label: { type: 'string', minLength: 1 },
          type: {
            type: 'string',
            enum: ['claim', 'evidence', 'conclusion', 'assumption'],
          },
        },
      },
    },
    edges: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['from', 'to', 'relation'],
        additionalProperties: false,
        properties: {
          from: { type: 'string', minLength: 1 },
          to: { type: 'string', minLength: 1 },
          relation: {
            type: 'string',
            enum: ['supports', 'implies', 'contradicts', 'requires'],
          },
        },
      },
    },
  },
} as const;

// ─── Plan contract ────────────────────────────────────────────────────────

export const PLAN_CONTRACT_SCHEMA = {
  type: 'object',
  required: ['steps'],
  additionalProperties: false,
  properties: {
    steps: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        required: ['id', 'description', 'dependencies'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          dependencies: {
            type: 'array',
            items: { type: 'string' },
          },
          resources: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

// ─── Concurrency contract ─────────────────────────────────────────────────

export const CONCURRENCY_CONTRACT_SCHEMA = {
  type: 'object',
  required: ['steps'],
  additionalProperties: false,
  properties: {
    steps: {
      type: 'array',
      minItems: 2,
      items: { type: 'string', minLength: 1 },
    },
    shared_resources: {
      type: 'array',
      items: { type: 'string' },
    },
    protections: {
      type: 'array',
      items: { type: 'string' },
    },
    delivery_model: {
      type: 'string',
      enum: ['at_least_once', 'at_most_once', 'exactly_once'],
    },
    retry_behavior: {
      type: 'string',
      enum: ['none', 'automatic', 'manual'],
    },
  },
} as const;

// ─── Quality contract ─────────────────────────────────────────────────────

export const QUALITY_CONTRACT_SCHEMA = {
  type: 'object',
  required: ['response_text'],
  additionalProperties: false,
  properties: {
    response_text: { type: 'string', minLength: 10 },
    claims: {
      type: 'array',
      items: { type: 'string' },
    },
    evidence: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const;

export const CONTRACT_SCHEMAS: Record<ContractType, object> = {
  confidence_contract: CONFIDENCE_CONTRACT_SCHEMA,
  reasoning_chain_contract: REASONING_CHAIN_CONTRACT_SCHEMA,
  plan_contract: PLAN_CONTRACT_SCHEMA,
  concurrency_contract: CONCURRENCY_CONTRACT_SCHEMA,
  quality_contract: QUALITY_CONTRACT_SCHEMA,
};
