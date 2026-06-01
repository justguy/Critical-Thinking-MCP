#!/usr/bin/env node
/**
 * ct-enforce — run a candidate deliverable through the host gate.
 *
 *   node dist/host/cli.js deliverable.json     # or: ... < deliverable.json
 *
 * Input JSON: { "spec": ContractSpec, "artifacts": DeliverableArtifacts,
 *               "eval_time"?: {...}, "surfaced_answer"?: "...", "strict_release"?: boolean }
 * Prints stable JSON and exits 0 on RELEASE, 1 on gate/strict REJECT, 2 on input
 * errors, 3 on anti-swap hash mismatch. Deterministic; no LLM, no network.
 */
import { readFileSync } from 'node:fs';
import { enforceDeliverable, type ReleaseDecision } from './enforcement_host.js';

interface CliError {
  decision: 'ERROR';
  reason: 'input_error';
  error: {
    code: 'invalid_json' | 'invalid_input';
    message: string;
  };
}

function printJson(value: ReleaseDecision | CliError): void {
  console.log(JSON.stringify(value, null, 2));
}

function failInput(code: CliError['error']['code'], message: string): never {
  printJson({
    decision: 'ERROR',
    reason: 'input_error',
    error: { code, message },
  });
  process.exit(2);
}

function exitCode(decision: ReleaseDecision): number {
  if (decision.decision === 'RELEASE') return 0;
  return decision.reason === 'hash_mismatch' ? 3 : 1;
}

function main(): void {
  const args = process.argv.slice(2);
  const strictFlag = args.includes('--strict');
  const noStrictFlag = args.includes('--no-strict');
  const pathArg = args.find(arg => arg !== '--strict' && arg !== '--no-strict');
  if (strictFlag && noStrictFlag) {
    failInput('invalid_input', 'Use either --strict or --no-strict, not both.');
  }
  const raw = pathArg && pathArg !== '-' ? readFileSync(pathArg, 'utf8') : readFileSync(0, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    failInput('invalid_json', `Input is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    failInput('invalid_input', 'Input must be { "spec": ..., "artifacts": ... }.');
  }
  const { spec, artifacts, eval_time, surfaced_answer, strict_release } = parsed as Record<string, any>;
  if (!spec || typeof spec !== 'object' || !artifacts || typeof artifacts !== 'object') {
    failInput('invalid_input', 'Input must be { "spec": ..., "artifacts": ... }.');
  }
  let decision;
  try {
    decision = enforceDeliverable(spec, artifacts, {
      eval_time,
      surfaced_answer,
      strict_release: strictFlag ? true : noStrictFlag ? false : strict_release !== false,
    });
  } catch (e) {
    failInput('invalid_input', `Invalid deliverable: ${e instanceof Error ? e.message : String(e)}`);
  }
  printJson(decision);
  process.exit(exitCode(decision));
}

main();
