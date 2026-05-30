// Reads the branch MCP server's raw JSON-RPC responses from stdin and prints
// what each finalize_deliverable call actually returned. No grading, no mocks —
// just the server's own structuredContent.
import { readFileSync } from 'node:fs';

const LABELS = {
  3: 'CLEAN grounded factual',
  4: 'FABRICATED quote (claim not in source)',
  5: 'MISSING inputs (cited/high, no sources/claims)',
  6: 'GROUNDED-BUT-FALSE ("Earth is flat", verbatim in source)',
  7: 'WRONG number (120+30 claimed as 200)',
  8: 'CORRECT number (120+30 = 150)',
};

const lines = readFileSync(0, 'utf8').split('\n').filter(Boolean);
for (const line of lines) {
  let m;
  try { m = JSON.parse(line); } catch { continue; }
  if (m.id === 2 && m.result?.tools) {
    console.log(`tools/list -> ${m.result.tools.length} public tools: ${m.result.tools.map(t => t.name).join(', ')}\n`);
    continue;
  }
  if (m.id >= 3 && m.id <= 8 && m.result) {
    const sc = m.result.structuredContent ?? {};
    const blocked = sc.status === 'ENFORCEMENT_FAIL';
    const verdict = blocked ? 'BLOCK' : (sc.finalize_verdict ?? sc.status);
    const full = blocked ? sc.partial : sc;
    const mechs = blocked ? (sc.blocking_issues ?? []).map(b => `${b.mechanism}: ${b.description}`) : [];
    const warns = full?.enforcement?.warnings ?? [];
    console.log(`[id ${m.id}] ${LABELS[m.id]}`);
    console.log(`   verdict: ${verdict}   isError: ${m.result.isError ?? false}`);
    if (full?.re_executed) console.log(`   re_executed: [${full.re_executed.join(', ')}]`);
    for (const x of mechs) console.log(`   BLOCK -> ${x}`);
    for (const w of warns) console.log(`   warn  -> ${w}`);
    console.log('');
  }
}
