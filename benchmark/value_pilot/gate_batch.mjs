// Runs every enforced payload through the REAL branch MCP server's finalize_deliverable.
// Usage: node gate_batch.mjs enforced_payloads.json
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const payloads = JSON.parse(readFileSync(process.argv[2], 'utf8'));

function runOne(id, args) {
  return new Promise(resolve => {
    const reqs = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'gate', version: '0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'finalize_deliverable', arguments: args } },
    ];
    const srv = spawn('node', ['dist/server.js'], { stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    srv.stdout.on('data', d => (out += d));
    srv.on('close', () => {
      let res = { verdict: 'NO_RESPONSE' };
      for (const line of out.split('\n').filter(Boolean)) {
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.id === 2 && m.result) {
          const sc = m.result.structuredContent ?? {};
          const blocked = sc.status === 'ENFORCEMENT_FAIL';
          const full = blocked ? sc.partial : sc;
          res = {
            verdict: blocked ? 'BLOCK' : (sc.finalize_verdict ?? sc.status),
            re_executed: full?.re_executed ?? [],
            blocking: blocked ? (sc.blocking_issues ?? []).map(b => `${b.mechanism}: ${b.description}`) : [],
            warnings: full?.enforcement?.warnings ?? [],
          };
        }
      }
      resolve({ id, ...res });
    });
    srv.stdin.write(reqs.map(r => JSON.stringify(r)).join('\n') + '\n');
    srv.stdin.end();
  });
}

const results = [];
for (const [id, args] of Object.entries(payloads)) results.push(await runOne(id, args));
for (const r of results) {
  console.log(`\n[${r.id}] verdict: ${r.verdict}   re_executed: [${(r.re_executed || []).join(', ')}]`);
  for (const b of r.blocking || []) console.log(`   BLOCK -> ${b}`);
  for (const w of r.warnings || []) console.log(`   warn  -> ${w}`);
}
