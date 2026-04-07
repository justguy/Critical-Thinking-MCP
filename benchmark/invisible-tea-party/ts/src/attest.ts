import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeOfficialRunAttestation } from './attestation.js';

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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const bundleDir = args['bundle-dir'];
  const attestorId = args['attestor-id'];
  const secretEnv = args['secret-env'] ?? 'TEA_PARTY_OFFICIAL_ATTESTATION_SECRET';

  if (!bundleDir || !attestorId) {
    throw new Error('Usage: --bundle-dir <dir> --attestor-id <id> [--secret-env ENV_NAME]');
  }

  const secret = process.env[secretEnv];
  if (!secret) {
    throw new Error(`Missing attestation secret in env var ${secretEnv}.`);
  }

  const attestation = writeOfficialRunAttestation(resolve(bundleDir), secret, attestorId);
  console.log(JSON.stringify(attestation, null, 2));
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
