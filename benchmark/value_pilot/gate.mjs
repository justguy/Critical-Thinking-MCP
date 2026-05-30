// Drives the REAL branch MCP server's finalize_deliverable over stdio JSON-RPC.
// Usage: node gate.mjs <payload.json>  where payload.json = the finalize_deliverable arguments object.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

const args = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const reqs = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'gate', version: '0' } } },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'finalize_deliverable', arguments: args } },
];

const srv = spawn('node', ['dist/server.js'], { stdio: ['pipe', 'pipe', 'ignore'] });
let out = '';
srv.stdout.on('data', d => (out += d));
srv.on('close', () => {
  for (const line of out.split('\n').filter(Boolean)) {
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.id === 2 && m.result) {
      const sc = m.result.structuredContent ?? {};
      const blocked = sc.status === 'ENFORCEMENT_FAIL';
      const full = blocked ? sc.partial : sc;
      console.log(JSON.stringify({
        verdict: blocked ? 'BLOCK' : (sc.finalize_verdict ?? sc.status),
        re_executed: full?.re_executed ?? [],
        blocking: blocked ? (sc.blocking_issues ?? []).map(b => `${b.mechanism}: ${b.description}`) : [],
        warnings: full?.enforcement?.warnings ?? [],
        corrective_prompt: blocked ? (sc.corrective_prompt ?? '') : '',
      }, null, 2));
    }
  }
});
srv.stdin.write(reqs.map(r => JSON.stringify(r)).join('\n') + '\n');
srv.stdin.end();
