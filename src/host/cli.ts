#!/usr/bin/env node
/**
 * ct-enforce — run a candidate deliverable through the host gate.
 *
 *   node dist/host/cli.js deliverable.json     # or: ... < deliverable.json
 *
 * Input JSON: { "spec": ContractSpec, "artifacts": DeliverableArtifacts,
 *               "eval_time"?: {...}, "surfaced_answer"?: "..." }
 * Prints the ReleaseDecision and exits 0 on RELEASE, 1 on REJECT — so it gates a
 * pipeline directly. Deterministic; no LLM, no network.
 */
import { readFileSync } from 'node:fs';
import { enforceDeliverable } from './enforcement_host.js';

function main(): void {
  const arg = process.argv[2];
  const raw = arg && arg !== '-' ? readFileSync(arg, 'utf8') : readFileSync(0, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`ct-enforce: input is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error('ct-enforce: input must be { "spec": ..., "artifacts": ... }');
    process.exit(2);
  }
  const { spec, artifacts, eval_time, surfaced_answer } = parsed as Record<string, any>;
  if (!spec || typeof spec !== 'object' || !artifacts || typeof artifacts !== 'object') {
    console.error('ct-enforce: input must be { "spec": ..., "artifacts": ... }');
    process.exit(2);
  }
  let decision;
  try {
    decision = enforceDeliverable(spec, artifacts, { eval_time, surfaced_answer });
  } catch (e) {
    console.error(`ct-enforce: invalid deliverable: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  console.log(JSON.stringify(decision, null, 2));
  process.exit(decision.decision === 'RELEASE' ? 0 : 1);
}

main();
