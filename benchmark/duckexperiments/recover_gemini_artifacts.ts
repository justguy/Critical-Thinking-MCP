#!/usr/bin/env npx tsx

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type ResponseCondition = 'baseline' | 'prompted' | 'critique_initial' | 'critique_revised';

const RESPONSE_CONDITIONS: ResponseCondition[] = [
  'baseline',
  'prompted',
  'critique_initial',
  'critique_revised',
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../..');
const defaultResultsRoot = resolve(repoRoot, 'benchmark/duckexperiments/results');

function readFlag(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return null;
  return process.argv[idx + 1];
}

function parseListArg(flag: string): string[] | null {
  const value = readFlag(flag);
  if (!value) return null;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseArtifactMeta(content: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const keys = ['run_profile_id', 'prompt_id', 'condition'];

  for (const key of keys) {
    const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    if (match) meta[key] = match[1].trim();
  }

  return meta;
}

function hasPromptEcho(content: string): boolean {
  return (
    content.includes('You are running one cell of a controlled reasoning experiment.') ||
    content.includes('You are running the tool-review step of a controlled reasoning experiment.') ||
    content.includes('Required output format:') ||
    content.includes('[your answer here]') ||
    content.includes('[number only]') ||
    content.includes('[one line]') ||
    content.includes('[tool name or none]')
  );
}

function isValidResponseArtifact(
  content: string,
  runProfileId: string,
  promptId: string,
  condition: ResponseCondition,
): boolean {
  const meta = parseArtifactMeta(content);
  if (meta.run_profile_id !== runProfileId) return false;
  if (meta.prompt_id !== promptId) return false;
  if (meta.condition !== condition) return false;
  if (hasPromptEcho(content)) return false;
  if (!/^response:\s*$/m.test(content)) return false;
  if (!/^Bottom line:/m.test(content)) return false;
  if (!/^Confidence \(0-100\):/m.test(content)) return false;
  if (!/^Key missing info or assumption:/m.test(content)) return false;

  const confidenceMatch = content.match(/Confidence \(0-100\):\s*(?:\n\s*)?(\d{1,3})\b/);
  if (!confidenceMatch) return false;
  const confidence = Number(confidenceMatch[1]);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) return false;

  return true;
}

function normalizeStdoutToResponseArtifact(
  stdout: string,
  runProfileId: string,
  promptId: string,
  condition: ResponseCondition,
): string | null {
  const trimmed = stdout.trim();
  if (!trimmed || hasPromptEcho(trimmed)) return null;

  if (isValidResponseArtifact(trimmed, runProfileId, promptId, condition)) {
    return trimmed.endsWith('\n') ? trimmed : `${trimmed}\n`;
  }

  const bottomIndex = trimmed.indexOf('Bottom line:');
  if (bottomIndex === -1) return null;
  if (!trimmed.includes('Confidence (0-100):')) return null;
  if (!trimmed.includes('Key missing info or assumption:')) return null;

  const body = trimmed.slice(0, bottomIndex).trim();
  const footer = trimmed.slice(bottomIndex).trim();
  if (!body || !footer) return null;

  const candidate = [
    `run_profile_id: ${runProfileId}`,
    `prompt_id: ${promptId}`,
    `condition: ${condition}`,
    'response:',
    body,
    footer,
    '',
  ].join('\n');

  return isValidResponseArtifact(candidate, runProfileId, promptId, condition) ? candidate : null;
}

function selectedGeminiProfiles(resultsRoot: string): string[] {
  const explicit = parseListArg('--profiles');
  if (explicit) return explicit;

  return readdirSync(resultsRoot)
    .filter((entry) => entry.startsWith('gemini_'))
    .filter((entry) => statSync(join(resultsRoot, entry)).isDirectory())
    .sort();
}

function selectedPromptIds(resultsRoot: string, profileId: string): string[] {
  const explicit = parseListArg('--prompts');
  if (explicit) return explicit;

  const profileDir = join(resultsRoot, profileId);
  if (!existsSync(profileDir)) return [];

  return readdirSync(profileDir)
    .filter((entry) => statSync(join(profileDir, entry)).isDirectory())
    .sort();
}

function main(): void {
  const resultsRoot = resolve(repoRoot, readFlag('--results-root') ?? 'benchmark/duckexperiments/results');
  const dryRun = hasFlag('--dry-run');
  const profiles = selectedGeminiProfiles(resultsRoot);

  let repaired = 0;
  let alreadyValid = 0;
  let unrecoverable = 0;
  let missingStdout = 0;

  for (const profileId of profiles) {
    for (const promptId of selectedPromptIds(resultsRoot, profileId)) {
      const cellDir = join(resultsRoot, profileId, promptId);

      for (const condition of RESPONSE_CONDITIONS) {
        const artifactPath = join(cellDir, `${condition}.md`);
        const stdoutPath = join(cellDir, `${condition}.stdout.log`);

        if (!existsSync(stdoutPath)) {
          missingStdout += 1;
          continue;
        }

        if (
          existsSync(artifactPath) &&
          isValidResponseArtifact(readFileSync(artifactPath, 'utf-8'), profileId, promptId, condition)
        ) {
          alreadyValid += 1;
          continue;
        }

        const normalized = normalizeStdoutToResponseArtifact(
          readFileSync(stdoutPath, 'utf-8'),
          profileId,
          promptId,
          condition,
        );

        if (!normalized) {
          unrecoverable += 1;
          console.log(`[unrecoverable] ${profileId} ${promptId} ${condition} from ${stdoutPath}`);
          continue;
        }

        if (dryRun) {
          console.log(`[dry-run] would repair ${profileId} ${promptId} ${condition} -> ${artifactPath}`);
        } else {
          writeFileSync(artifactPath, normalized, 'utf-8');
          console.log(`[repaired] ${profileId} ${promptId} ${condition} -> ${artifactPath}`);
        }
        repaired += 1;
      }
    }
  }

  console.log(
    `Done. ${dryRun ? 'Would repair' : 'Repaired'} ${repaired} artifact(s). ` +
      `Already valid: ${alreadyValid}. Missing stdout: ${missingStdout}. Unrecoverable: ${unrecoverable}.`,
  );
}

main();
