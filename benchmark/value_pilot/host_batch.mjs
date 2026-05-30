// Runs each {spec, artifacts} through the REAL shipped host layer (enforceDeliverable).
// Usage: node host_batch.mjs <payloads.json>
import { readFileSync } from 'node:fs';
import { enforceDeliverable } from '../../dist/host/enforcement_host.js';

const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
for (const [id, { spec, artifacts }] of Object.entries(data)) {
  const d = enforceDeliverable(spec, artifacts);
  console.log(`[${id}] ${d.decision} (${d.reason})  re_executed:[${d.re_executed.join(', ')}]`);
  for (const b of d.blocking_issues) console.log(`   BLOCK -> ${b.mechanism}: ${b.description}`);
}
