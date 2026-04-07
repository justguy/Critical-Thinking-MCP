import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  FinalVerification,
  LeaderboardSubmission,
  OfficialRunAttestation,
} from './models.js';
import { loadCertifiedArbiters } from './config.js';
import {
  verifyManifestAgainstBundle,
  verifyOfficialRunAttestation,
} from './attestation.js';
import {
  assertValid,
  validateFinalVerification,
  validateLeaderboardSubmission,
  validateOfficialRunAttestation,
  validateRunManifest,
} from './schemaValidation.js';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--') && i + 1 < argv.length) {
      args[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function deriveOfficialFinalVerification(
  finalVerification: FinalVerification,
  official: boolean,
): FinalVerification {
  return {
    ...finalVerification,
    arbiter_metadata: {
      ...finalVerification.arbiter_metadata,
      official_run_attested: official,
      official_score_eligible: official,
    },
    leaderboard_status: official ? 'official_certified_arbiter' : 'unofficial_custom_arbiter',
  };
}

function isCertifiedArbiter(finalVerification: FinalVerification): boolean {
  return loadCertifiedArbiters().some(arbiter =>
    arbiter.certification_status === 'ACTIVE'
    && arbiter.provider === finalVerification.arbiter_metadata.arbiter_provider
    && arbiter.model_id === finalVerification.arbiter_metadata.arbiter_model_id,
  );
}

export function ingestBundle(
  bundleDir: string,
  secret: string | null,
): LeaderboardSubmission {
  const resolvedBundleDir = resolve(bundleDir);
  const manifest = assertValid(
    'run_manifest',
    validateRunManifest(JSON.parse(readFileSync(resolve(resolvedBundleDir, 'run_manifest.json'), 'utf-8'))),
  );
  const finalVerification = assertValid(
    'final_verification',
    validateFinalVerification(JSON.parse(readFileSync(resolve(resolvedBundleDir, 'final_verification.json'), 'utf-8'))),
  );

  const manifestCheck = verifyManifestAgainstBundle(resolvedBundleDir, manifest);
  let official = false;
  let reason = manifestCheck.reason;
  let attestation: OfficialRunAttestation | null = null;

  if (manifestCheck.valid) {
    const attestationPath = resolve(resolvedBundleDir, 'official_run_attestation.json');
    if (existsSync(attestationPath)) {
      attestation = assertValid(
        'official_run_attestation',
        validateOfficialRunAttestation(JSON.parse(readFileSync(attestationPath, 'utf-8'))),
      );
      if (!secret) {
        reason = 'Attestation file present but ingest secret is missing.';
      } else {
        const verdict = verifyOfficialRunAttestation(manifest, attestation, secret);
        if (!verdict.valid) {
          reason = verdict.reason;
        } else if (!isCertifiedArbiter(finalVerification)) {
          reason = 'Arbiter is not on the certified arbiter list.';
        } else if (finalVerification.arbiter_pass_status !== 'AVAILABLE') {
          reason = 'Arbiter pass status is not AVAILABLE.';
        } else {
          official = true;
          reason = 'Certified arbiter and valid official attestation verified at ingest.';
        }
      }
    } else {
      reason = 'No official attestation file found. Submission remains unofficial.';
    }
  }

  const derivedFinalVerification = deriveOfficialFinalVerification(finalVerification, official);
  const submission: LeaderboardSubmission = {
    schema_version: 'v1.0',
    benchmark_id: 'invisible-tea-party',
    submission_timestamp: new Date().toISOString(),
    official_submission: official,
    status_reason: reason,
    run_manifest: manifest,
    official_run_attestation: attestation,
    final_verification: derivedFinalVerification,
  };

  const validatedSubmission = assertValid(
    'leaderboard_submission',
    validateLeaderboardSubmission(submission),
  );

  return validatedSubmission;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const bundleDir = args['bundle-dir'];
  const secretEnv = args['secret-env'] ?? 'TEA_PARTY_OFFICIAL_ATTESTATION_SECRET';

  if (!bundleDir) {
    throw new Error('Usage: --bundle-dir <dir> [--secret-env ENV_NAME]');
  }

  const secret = process.env[secretEnv] ?? null;
  const validatedSubmission = ingestBundle(bundleDir, secret);
  const resolvedBundleDir = resolve(bundleDir);
  writeFileSync(resolve(resolvedBundleDir, 'leaderboard_submission.json'), `${JSON.stringify(validatedSubmission, null, 2)}\n`, 'utf-8');
  writeFileSync(
    resolve(resolvedBundleDir, 'final_verification.ingested.json'),
    `${JSON.stringify(validatedSubmission.final_verification, null, 2)}\n`,
    'utf-8',
  );
  console.log(JSON.stringify({
    official_submission: validatedSubmission.official_submission,
    status_reason: validatedSubmission.status_reason,
  }, null, 2));
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];
  return entrypoint != null && import.meta.url === pathToFileURL(resolve(entrypoint)).href;
}

if (isDirectExecution()) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
