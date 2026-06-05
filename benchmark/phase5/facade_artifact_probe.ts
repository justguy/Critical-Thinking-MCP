/**
 * Validation probe: does giving a model the CORRECTED (gate-compatible)
 * review_before_final artifact_template let it produce a parseable, RELEASE-able
 * grounded deliverable in ONE shot? Targets the RAG scenarios that were
 * `unparseable` in the Phase-5 realism arm. No multi-turn spine.
 *
 * Run: node --import tsx benchmark/phase5/facade_artifact_probe.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PHASE5_SCENARIOS } from './scenarios.js';
import { handleReviewBeforeFinal } from '../../src/tools/review_before_final.js';
import { enforceDeliverable } from '../../src/host/enforcement_host.js';
import { runModel } from '../model_adapter.js';

const RAG_IDS = ['rag_refund_window', 'rag_sla_uptime', 'rag_pricing_grounded'];
const template = (handleReviewBeforeFinal({ task_type: 'research', original_request: 'x', draft_answer: 'y', mode: 'artifact' }) as any).artifact_template;

const reports: any[] = [];
for (const id of RAG_IDS) {
  const s: any = PHASE5_SCENARIOS.find(x => x.id === id);
  if (!s) continue;
  // The host gives the agent the source doc; reuse the scenario's host-supplied source.
  const src = (s.satisfying.sources ?? [])[0] ?? { id: 'doc', text: s.host_contract.original_request_text, origin: 'host_supplied' };
  const prompt = [
    `Answer the customer's question using ONLY the source document, then emit a deliverable as a single JSON object.`,
    `QUESTION: ${s.host_contract.original_request_text}`,
    `SOURCE DOCUMENT (id="${src.id}"): ${src.text}`,
    `Fill EXACTLY this JSON template. quoted_span MUST be a verbatim substring of the source text; source_id must equal "${src.id}".`,
    JSON.stringify(template, null, 2),
    `Output ONLY the filled JSON object. Start with { and end with }. No prose, no code fence.`,
  ].join('\n\n');

  process.stderr.write(`[probe] ${id}...\n`);
  const out = runModel(prompt, 'haiku');
  let parsed: any = null;
  let parseErr = '';
  try {
    const m = out.text.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : null;
  } catch (e) { parseErr = (e as Error).message; }

  let decision = 'NOT_GATED';
  let reason = '';
  if (parsed) {
    try {
      const d: any = enforceDeliverable(s.host_contract, parsed, {});
      decision = d.decision ?? d.finalize_verdict ?? 'UNKNOWN';
      reason = d.reason ?? '';
    } catch (e) { decision = 'GATE_THREW'; reason = (e as Error).message.slice(0, 120); }
  }
  reports.push({
    id, parseable: !!parsed, parse_error: parseErr || undefined,
    decision, reason,
    released: decision === 'RELEASE',
    model_error: out.error, model_error_detail: out.error_detail,
    raw_tail: out.text.slice(-180),
  });
  process.stderr.write(`[probe] ${id}: parseable=${!!parsed} decision=${decision}\n`);
}

const summary = {
  question: 'With the corrected gate-compatible facade research template, can the model produce a parseable + RELEASE-able grounded deliverable single-shot?',
  parseable: reports.filter(r => r.parseable).length + '/' + reports.length,
  released: reports.filter(r => r.released).length + '/' + reports.length,
  reports,
};
writeFileSync(fileURLToPath(new URL('./facade_artifact_probe.json', import.meta.url)), JSON.stringify(summary, null, 2));
process.stdout.write('\n' + JSON.stringify(summary, null, 2) + '\n');
