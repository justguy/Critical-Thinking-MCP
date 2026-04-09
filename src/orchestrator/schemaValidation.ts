/**
 * Ajv-backed contract validators for the orchestrator.
 *
 * - Compile validators once.
 * - Return precise Ajv error paths and messages.
 * - When validation fails, build a structured `SchemaFailure` whose
 *   `failure_type` is `schema_validation_failure`. Callers must treat
 *   that as a route halt — the deterministic tool MUST NOT be invoked.
 */

import AjvImport, { type ErrorObject, type ValidateFunction } from 'ajv';
import addFormatsImport from 'ajv-formats';

import type {
  ContractType,
  OrchestratorToolName,
  SchemaFailure,
  ValidationError,
} from './types.js';
import {
  ENVELOPE_SCHEMA,
  CONFIDENCE_CONTRACT_SCHEMA,
  REASONING_CHAIN_CONTRACT_SCHEMA,
  PLAN_CONTRACT_SCHEMA,
  CONCURRENCY_CONTRACT_SCHEMA,
  QUALITY_CONTRACT_SCHEMA,
} from './contracts.js';

// Ajv 8 + ajv-formats export interop with ESM Node16.
// The published d.ts shapes resolve to the namespace, not the constructor,
// so we unwrap `default` defensively at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AjvCtor = (((AjvImport as any).default) ?? AjvImport) as new (opts: Record<string, unknown>) => {
  compile: (schema: unknown) => ValidateFunction;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addFormatsFn = (((addFormatsImport as any).default) ?? addFormatsImport) as (
  ajv: unknown,
) => void;

const ajv = new AjvCtor({ allErrors: true, strict: false });
addFormatsFn(ajv);

// Compile every validator exactly once.
const validateEnvelopeFn: ValidateFunction = ajv.compile(ENVELOPE_SCHEMA);
const validateConfidenceFn: ValidateFunction = ajv.compile(CONFIDENCE_CONTRACT_SCHEMA);
const validateReasoningChainFn: ValidateFunction = ajv.compile(REASONING_CHAIN_CONTRACT_SCHEMA);
const validatePlanFn: ValidateFunction = ajv.compile(PLAN_CONTRACT_SCHEMA);
const validateConcurrencyFn: ValidateFunction = ajv.compile(CONCURRENCY_CONTRACT_SCHEMA);
const validateQualityFn: ValidateFunction = ajv.compile(QUALITY_CONTRACT_SCHEMA);

const CONTRACT_VALIDATORS: Record<ContractType, ValidateFunction> = {
  confidence_contract: validateConfidenceFn,
  reasoning_chain_contract: validateReasoningChainFn,
  plan_contract: validatePlanFn,
  concurrency_contract: validateConcurrencyFn,
  quality_contract: validateQualityFn,
};

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function formatErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors || errors.length === 0) return [];
  return errors.map(e => ({
    path: e.instancePath && e.instancePath.length > 0 ? e.instancePath : '/',
    message: e.message ?? 'unknown validation error',
  }));
}

export function validateOrchestratorEnvelope(data: unknown): ValidationResult {
  const valid = validateEnvelopeFn(data) as boolean;
  return { valid, errors: valid ? [] : formatErrors(validateEnvelopeFn.errors) };
}

export function validateContract(
  contractType: ContractType,
  data: unknown,
): ValidationResult {
  const validator = CONTRACT_VALIDATORS[contractType];
  if (!validator) {
    return {
      valid: false,
      errors: [{ path: '/', message: `Unknown contract type: ${contractType}` }],
    };
  }
  if (data === undefined || data === null) {
    return {
      valid: false,
      errors: [{ path: '/', message: `Missing contract payload for ${contractType}` }],
    };
  }
  const valid = validator(data) as boolean;
  return { valid, errors: valid ? [] : formatErrors(validator.errors) };
}

// Convenience wrappers (named in the implementation prompt).
export const validateConfidenceContract = (data: unknown): ValidationResult =>
  validateContract('confidence_contract', data);

export const validateReasoningChainContract = (data: unknown): ValidationResult =>
  validateContract('reasoning_chain_contract', data);

export const validatePlanContract = (data: unknown): ValidationResult =>
  validateContract('plan_contract', data);

export const validateConcurrencyContract = (data: unknown): ValidationResult =>
  validateContract('concurrency_contract', data);

export const validateQualityContract = (data: unknown): ValidationResult =>
  validateContract('quality_contract', data);

export function makeSchemaFailure(
  tool: OrchestratorToolName,
  contractType: ContractType,
  errors: ValidationError[],
): SchemaFailure {
  return {
    tool,
    contract_type: contractType,
    status: 'ENFORCEMENT_FAIL',
    failure_type: 'schema_validation_failure',
    validation_errors: errors,
  };
}

export function isSchemaFailure(value: unknown): value is SchemaFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    'failure_type' in value &&
    (value as { failure_type?: unknown }).failure_type === 'schema_validation_failure'
  );
}
