import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');
const ARBITER_PAYLOAD_SCHEMA_PATH = resolve(
  ROOT,
  'benchmark/invisible-tea-party/schemas/arbiter_payload.schema.json',
);

function compileValidator(schemaPath) {
  const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

function formatAjvErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'Unknown schema validation error.';
  }
  return errors
    .map(error => {
      const location = error.instancePath || '/';
      return `${location} ${error.message ?? 'is invalid'}`;
    })
    .join('; ');
}

const validateArbiterPayload = compileValidator(ARBITER_PAYLOAD_SCHEMA_PATH);

export async function evaluateStructuredWithRetries({
  invoke,
  request,
  maxRetries = 3,
}) {
  const errors = [];
  let lastPayload = null;
  let validationError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    const payload = await invoke({
      ...request,
      attempt,
      validation_error: validationError,
    });
    lastPayload = payload;
    const valid = validateArbiterPayload(payload);
    if (valid) {
      return {
        pass_status: 'AVAILABLE',
        payload,
        errors,
      };
    }
    validationError = formatAjvErrors(validateArbiterPayload.errors);
    errors.push(validationError);
  }

  return {
    pass_status: 'UNAVAILABLE',
    errors,
    last_payload: lastPayload,
  };
}

export function createStructuredLocalEvaluator({
  invoke,
  arbiter_provider,
  arbiter_model_id,
  maxRetries = 3,
}) {
  return {
    async evaluate_pass_4b(request) {
      return evaluateStructuredWithRetries({
        invoke,
        request,
        maxRetries,
      });
    },
    async metadata() {
      return {
        arbiter_provider,
        arbiter_model_id,
      };
    },
  };
}
