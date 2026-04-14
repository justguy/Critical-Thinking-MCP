import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/* eslint-disable @typescript-eslint/no-explicit-any */
import Ajv2020Import from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';

const Ajv2020 = ((Ajv2020Import as any).default ?? Ajv2020Import) as new (opts: any) => any;
const addFormats = ((addFormatsImport as any).default ?? addFormatsImport) as (ajv: any) => void;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface AjvError {
  instancePath: string;
  message?: string;
}

interface CompiledValidator {
  (data: unknown): boolean;
  errors?: AjvError[] | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCHEMA_DIR = resolve(__dirname, '../../schemas');

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);

const REGISTERED_SCHEMAS = [
  'scenario.schema.json',
  'reasoning_state.schema.json',
  'deterministic_verification.schema.json',
  'arbiter_payload.schema.json',
  'arbiter_verification.schema.json',
  'final_verification.schema.json',
  'run_manifest.schema.json',
  'official_run_attestation.schema.json',
  'leaderboard_submission.schema.json',
];

for (const schemaFile of REGISTERED_SCHEMAS) {
  const schema = JSON.parse(readFileSync(resolve(SCHEMA_DIR, schemaFile), 'utf-8'));
  const schemaId = typeof schema.$id === 'string' ? schema.$id : schemaFile;
  if (!ajv.getSchema(schemaId)) {
    ajv.addSchema(schema, schemaId);
  }
}

function loadAndCompile(schemaFile: string): CompiledValidator {
  const schema = JSON.parse(readFileSync(resolve(SCHEMA_DIR, schemaFile), 'utf-8'));
  const schemaId = typeof schema.$id === 'string' ? schema.$id : schemaFile;
  const validator = ajv.getSchema(schemaId);
  if (!validator) {
    throw new Error(`Validator not registered for schema ${schemaFile} (${schemaId}).`);
  }
  return validator as CompiledValidator;
}

function formatErrors(errors: AjvError[] | null | undefined): string {
  if (!errors || errors.length === 0) return 'Unknown validation error.';
  return errors
    .map((e: AjvError) => `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`)
    .join('; ');
}

function createValidator<T>(schemaFile: string) {
  const validate = loadAndCompile(schemaFile);
  return (data: unknown): { valid: true; data: T } | { valid: false; errors: string } => {
    if (validate(data)) {
      return { valid: true, data: data as T };
    }
    return { valid: false, errors: formatErrors(validate.errors) };
  };
}

import type {
  Scenario,
  ReasoningState,
  DeterministicVerification,
  ArbiterVerification,
  FinalVerification,
  RunManifest,
  OfficialRunAttestation,
  LeaderboardSubmission,
} from './models.js';

export const validateScenario = createValidator<Scenario>('scenario.schema.json');
export const validateReasoningState = createValidator<ReasoningState>('reasoning_state.schema.json');
export const validateDeterministicVerification = createValidator<DeterministicVerification>('deterministic_verification.schema.json');
export const validateArbiterPayload = createValidator<Record<string, unknown>>('arbiter_payload.schema.json');
export const validateArbiterVerification = createValidator<ArbiterVerification>('arbiter_verification.schema.json');
export const validateFinalVerification = createValidator<FinalVerification>('final_verification.schema.json');
export const validateRunManifest = createValidator<RunManifest>('run_manifest.schema.json');
export const validateOfficialRunAttestation = createValidator<OfficialRunAttestation>('official_run_attestation.schema.json');
export const validateLeaderboardSubmission = createValidator<LeaderboardSubmission>('leaderboard_submission.schema.json');

export function assertValid<T>(
  label: string,
  result: { valid: true; data: T } | { valid: false; errors: string },
): T {
  if (!result.valid) {
    throw new Error(`Schema validation failed for ${label}: ${result.errors}`);
  }
  return result.data;
}
