import { createHash, createHmac } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  OfficialRunAttestation,
  RunManifest,
  RunManifestEntry,
} from './models.js';
import {
  assertValid,
  validateFinalVerification,
  validateOfficialRunAttestation,
  validateReasoningState,
  validateRunManifest,
} from './schemaValidation.js';

export const RUNTIME_BUNDLE_FILES = [
  'pass1.reasoning_state.json',
  'pass2.reasoning_state.json',
  'pass3.reasoning_state.json',
  'deterministic_verification.json',
  'arbiter_verification.json',
  'final_verification.json',
] as const;

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalize(item)).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`);
  return `{${entries.join(',')}}`;
}

function signBundleHash(secret: string, bundleHash: string, attestorId: string): string {
  return createHmac('sha256', secret)
    .update(`${bundleHash}:${attestorId}`, 'utf-8')
    .digest('hex');
}

export function computeFileSha256(path: string): string {
  return sha256(readFileSync(path, 'utf-8'));
}

export function computeBundleHash(manifest: Omit<RunManifest, 'bundle_hash'>): string {
  return sha256(canonicalize(manifest));
}

export function createRunManifest(bundleDir: string): RunManifest {
  const finalVerificationPath = resolve(bundleDir, 'final_verification.json');
  const pass1ReasoningStatePath = resolve(bundleDir, 'pass1.reasoning_state.json');
  const finalVerification = assertValid(
    'final_verification',
    validateFinalVerification(JSON.parse(readFileSync(finalVerificationPath, 'utf-8'))),
  );
  const pass1ReasoningState = assertValid(
    'pass1.reasoning_state',
    validateReasoningState(JSON.parse(readFileSync(pass1ReasoningStatePath, 'utf-8'))),
  );

  const artifactFiles: RunManifestEntry[] = RUNTIME_BUNDLE_FILES.map(filename => ({
    artifact_name: filename.replace('.json', '').replace(/\./g, '_'),
    filename,
    sha256: computeFileSha256(resolve(bundleDir, filename)),
  }));

  const manifestWithoutHash: Omit<RunManifest, 'bundle_hash'> = {
    schema_version: 'v1.0',
    benchmark_id: 'invisible-tea-party',
    scenario_id: finalVerification.scenario_id,
    lineage_id: pass1ReasoningState.lineage_id,
    rule_profile_version: finalVerification.rule_profile_version,
    created_at: new Date().toISOString(),
    arbiter_provider: finalVerification.arbiter_metadata.arbiter_provider,
    arbiter_model_id: finalVerification.arbiter_metadata.arbiter_model_id,
    capability_mode: finalVerification.capability_mode,
    core_final_score: finalVerification.core_final_score,
    artifact_files: artifactFiles,
  };

  return {
    ...manifestWithoutHash,
    bundle_hash: computeBundleHash(manifestWithoutHash),
  };
}

export function writeRunManifest(bundleDir: string): RunManifest {
  const manifest = createRunManifest(bundleDir);
  writeFileSync(resolve(bundleDir, 'run_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  return manifest;
}

export function createOfficialRunAttestation(
  manifest: RunManifest,
  secret: string,
  attestorId: string,
): OfficialRunAttestation {
  const attestation: OfficialRunAttestation = {
    schema_version: 'v1.0',
    benchmark_id: 'invisible-tea-party',
    attestation_version: 'v1',
    attestor_id: attestorId,
    attestation_timestamp: new Date().toISOString(),
    scenario_id: manifest.scenario_id,
    lineage_id: manifest.lineage_id,
    arbiter_provider: manifest.arbiter_provider,
    arbiter_model_id: manifest.arbiter_model_id,
    bundle_hash: manifest.bundle_hash,
    signature_algorithm: 'hmac-sha256',
    signature: signBundleHash(secret, manifest.bundle_hash, attestorId),
  };
  return assertValid('official_run_attestation', validateOfficialRunAttestation(attestation));
}

export function writeOfficialRunAttestation(
  bundleDir: string,
  secret: string,
  attestorId: string,
): OfficialRunAttestation {
  const manifest = assertValid(
    'run_manifest',
    validateRunManifest(JSON.parse(readFileSync(resolve(bundleDir, 'run_manifest.json'), 'utf-8'))),
  );
  const attestation = createOfficialRunAttestation(manifest, secret, attestorId);
  writeFileSync(resolve(bundleDir, 'official_run_attestation.json'), `${JSON.stringify(attestation, null, 2)}\n`, 'utf-8');
  return attestation;
}

export function verifyOfficialRunAttestation(
  manifest: RunManifest,
  attestation: OfficialRunAttestation,
  secret: string,
): { valid: boolean; reason: string } {
  if (attestation.bundle_hash !== manifest.bundle_hash) {
    return { valid: false, reason: 'Attestation bundle_hash does not match manifest.' };
  }
  if (attestation.scenario_id !== manifest.scenario_id) {
    return { valid: false, reason: 'Attestation scenario_id does not match manifest.' };
  }
  if (attestation.arbiter_provider !== manifest.arbiter_provider || attestation.arbiter_model_id !== manifest.arbiter_model_id) {
    return { valid: false, reason: 'Attestation arbiter metadata does not match manifest.' };
  }
  const expected = signBundleHash(secret, manifest.bundle_hash, attestation.attestor_id);
  if (expected !== attestation.signature) {
    return { valid: false, reason: 'Attestation signature verification failed.' };
  }
  return { valid: true, reason: 'Valid official attestation.' };
}

export function verifyManifestAgainstBundle(bundleDir: string, manifest: RunManifest): { valid: boolean; reason: string } {
  if (manifest.artifact_files.length !== RUNTIME_BUNDLE_FILES.length) {
    return { valid: false, reason: 'Manifest artifact_files count does not match required bundle files.' };
  }
  const expectedNames = new Set(RUNTIME_BUNDLE_FILES);
  for (const entry of manifest.artifact_files) {
    if (!expectedNames.has(entry.filename as typeof RUNTIME_BUNDLE_FILES[number])) {
      return { valid: false, reason: `Unexpected artifact in manifest: ${entry.filename}` };
    }
    const actualHash = computeFileSha256(resolve(bundleDir, entry.filename));
    if (actualHash !== entry.sha256) {
      return { valid: false, reason: `Artifact hash mismatch for ${entry.filename}` };
    }
  }

  const manifestWithoutHash: Omit<RunManifest, 'bundle_hash'> = {
    schema_version: manifest.schema_version,
    benchmark_id: manifest.benchmark_id,
    scenario_id: manifest.scenario_id,
    lineage_id: manifest.lineage_id,
    rule_profile_version: manifest.rule_profile_version,
    created_at: manifest.created_at,
    arbiter_provider: manifest.arbiter_provider,
    arbiter_model_id: manifest.arbiter_model_id,
    capability_mode: manifest.capability_mode,
    core_final_score: manifest.core_final_score,
    artifact_files: manifest.artifact_files,
  };
  const computedBundleHash = computeBundleHash(manifestWithoutHash);
  if (computedBundleHash !== manifest.bundle_hash) {
    return { valid: false, reason: 'Manifest bundle_hash does not match bundle contents.' };
  }

  return { valid: true, reason: 'Manifest matches bundle contents.' };
}
