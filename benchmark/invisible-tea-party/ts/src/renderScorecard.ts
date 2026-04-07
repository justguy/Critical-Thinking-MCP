import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadNormalizedScenarios } from './scenarioRegistry.js';
import type {
  FinalVerification,
  DeterministicVerification,
  ArbiterVerification,
  LeaderboardSubmission,
  ReasoningState,
} from './models.js';

export interface ScorecardBundle {
  finalVerification: FinalVerification;
  deterministicVerification: DeterministicVerification;
  arbiterVerification: ArbiterVerification;
  leaderboardSubmission: LeaderboardSubmission | null;
  pass1: ReasoningState | null;
  pass2: ReasoningState | null;
  pass3: ReasoningState | null;
}

export interface RenderOptions {
  title?: string;
}

let cachedPromptFamilyByScenarioId: Map<string, string> | null = null;

function tryReadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function resolvePromptFamily(scenarioId: string): string {
  if (!cachedPromptFamilyByScenarioId) {
    cachedPromptFamilyByScenarioId = new Map(
      loadNormalizedScenarios().map(scenario => [scenario.scenario_id, scenario.prompt_family]),
    );
  }
  return cachedPromptFamilyByScenarioId.get(scenarioId) ?? scenarioId.split('_').slice(2).join('_');
}

export function loadScorecardBundle(bundleDir: string): ScorecardBundle {
  const dir = resolve(bundleDir);
  const ingestedFinal = tryReadJson<FinalVerification>(resolve(dir, 'final_verification.ingested.json'));
  const rawFinal = tryReadJson<FinalVerification>(resolve(dir, 'final_verification.json'));
  const finalVerification = ingestedFinal ?? rawFinal;
  if (!finalVerification) throw new Error('No final_verification.json or final_verification.ingested.json found.');

  const deterministicVerification = tryReadJson<DeterministicVerification>(resolve(dir, 'deterministic_verification.json'));
  if (!deterministicVerification) throw new Error('No deterministic_verification.json found.');

  const arbiterVerification = tryReadJson<ArbiterVerification>(resolve(dir, 'arbiter_verification.json'));
  if (!arbiterVerification) throw new Error('No arbiter_verification.json found.');

  return {
    finalVerification,
    deterministicVerification,
    arbiterVerification,
    leaderboardSubmission: tryReadJson<LeaderboardSubmission>(resolve(dir, 'leaderboard_submission.json')),
    pass1: tryReadJson<ReasoningState>(resolve(dir, 'pass1.reasoning_state.json')),
    pass2: tryReadJson<ReasoningState>(resolve(dir, 'pass2.reasoning_state.json')),
    pass3: tryReadJson<ReasoningState>(resolve(dir, 'pass3.reasoning_state.json')),
  };
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function scoreBar(label: string, raw: number, weight: number, weighted: number): string {
  const rawPct = Math.min(raw * 100, 100);
  const weightPct = weight * 100;
  return `
    <div class="score-row">
      <div class="score-label">${esc(label)}</div>
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${rawPct.toFixed(1)}%"></div>
      </div>
      <div class="score-nums">
        <span class="raw">${raw.toFixed(3)}</span>
        <span class="times">&times;</span>
        <span class="weight">${weight.toFixed(2)}</span>
        <span class="eq">=</span>
        <span class="weighted">${weighted.toFixed(4)}</span>
      </div>
    </div>`;
}

function statusChip(label: string, variant: 'ok' | 'warn' | 'neutral'): string {
  return `<span class="chip chip-${variant}">${esc(label)}</span>`;
}

export function renderScorecardHtml(bundle: ScorecardBundle, options: RenderOptions = {}): string {
  const f = bundle.finalVerification;
  const d = bundle.deterministicVerification;
  const a = bundle.arbiterVerification;
  const sub = bundle.leaderboardSubmission;
  const title = options.title ?? 'Invisible Tea Party — Scorecard';

  const isOfficial = f.leaderboard_status === 'official_certified_arbiter';
  const arbiterAvailable = f.arbiter_pass_status === 'AVAILABLE';
  const scenarioId = f.scenario_id;
  const promptFamily = resolvePromptFamily(scenarioId);
  const lineageId = bundle.pass1?.lineage_id ?? 'N/A';

  const scoreBars = f.score_components.map(c =>
    scoreBar(c.component_id.replace(/_/g, ' '), c.raw_score, c.weight, c.weighted_score),
  ).join('\n');

  const capsHtml = f.caps_applied.length === 0
    ? '<p class="muted">No caps applied.</p>'
    : f.caps_applied.map(c => `
      <div class="penalty-row">
        <span class="penalty-rule">${esc(c.rule_id)}</span>
        <span class="penalty-detail">${esc(c.field)} → ${esc(String(c.applied_value))}: ${esc(c.reason)}</span>
      </div>`).join('\n');

  const conflictsHtml = f.conflicts.length === 0
    ? '<p class="muted">No conflicts.</p>'
    : f.conflicts.map(c => `
      <div class="penalty-row">
        <span class="penalty-rule">${esc(c.field)}</span>
        <span class="penalty-detail">det: ${esc(String(c.deterministic_value))} vs arb: ${esc(String(c.arbiter_value))} → ${esc(c.resolution)}</span>
      </div>`).join('\n');

  const densityFlag = d.semantic_density_drop_flag;
  const penaltiesHtml = `
    <div class="penalty-row">
      <span class="penalty-rule">semantic_density_drop</span>
      <span class="penalty-detail">${densityFlag ? '⚠ Triggered' : 'Not triggered'}</span>
    </div>
    <div class="penalty-row">
      <span class="penalty-rule">evasion_penalty</span>
      <span class="penalty-detail">raw: ${d.evasion_penalty_raw} / normalized: ${d.evasion_penalty_normalized.toFixed(3)}</span>
    </div>`;

  const arbiterPanel = `
    <div class="arbiter-grid">
      <div class="arbiter-field"><span class="af-label">Status</span><span class="af-value">${statusChip(a.pass_status, arbiterAvailable ? 'ok' : 'warn')}</span></div>
      <div class="arbiter-field"><span class="af-label">Premise Rejection</span><span class="af-value">${esc(a.premise_rejection_quality)}</span></div>
      <div class="arbiter-field"><span class="af-label">Repair Quality</span><span class="af-value">${esc(a.repair_quality)}</span></div>
      <div class="arbiter-field"><span class="af-label">Sycophancy</span><span class="af-value">${a.sycophancy_triggered ? statusChip('TRIGGERED', 'warn') : statusChip('No', 'ok')}</span></div>
      <div class="arbiter-field"><span class="af-label">Type Error Severity</span><span class="af-value">${esc(a.type_error_severity)}</span></div>
      <div class="arbiter-field"><span class="af-label">Causal Integrity</span><span class="af-value">${esc(a.causal_reasoning_integrity)}</span></div>
      <div class="arbiter-field"><span class="af-label">Provider</span><span class="af-value">${esc(a.arbiter_metadata.arbiter_provider)}</span></div>
      <div class="arbiter-field"><span class="af-label">Model</span><span class="af-value">${esc(a.arbiter_metadata.arbiter_model_id)}</span></div>
      <div class="arbiter-field"><span class="af-label">Certified</span><span class="af-value">${a.arbiter_metadata.certified ? statusChip('Yes', 'ok') : statusChip('No', 'neutral')}</span></div>
    </div>`;

  const justificationExcerpt = a.justification.length > 500
    ? a.justification.slice(0, 500) + '…'
    : a.justification;

  const spanRefsHtml = a.cited_span_refs.length === 0
    ? '<p class="muted">No cited spans.</p>'
    : a.cited_span_refs.map(s =>
      `<div class="evidence-span"><code>${esc(s.artifact_id)}[${s.start_char}:${s.end_char}]</code>${s.excerpt ? ` <span class="excerpt">"${esc(s.excerpt)}"</span>` : ''}</div>`,
    ).join('\n');

  const detTraceHtml = d.audit_trace.slice(0, 10).map(t =>
    `<div class="trace-line"><span class="trace-type">${esc(t.trace_type)}</span> ${esc(t.message)}</div>`,
  ).join('\n');

  const reconcileTraceHtml = f.audit_trace.slice(0, 10).map(t =>
    `<div class="trace-line"><span class="trace-type">${esc(t.trace_type)}</span> ${esc(t.message)}</div>`,
  ).join('\n');

  const calibrationLine = f.calibration_augmented_score != null
    ? `<div class="meta-row"><span class="meta-label">Calibration Augmented</span><span class="meta-value">${pct(f.calibration_augmented_score)}</span></div>`
    : '';

  const submissionLine = sub
    ? `<div class="meta-row"><span class="meta-label">Submission Status</span><span class="meta-value">${sub.official_submission ? 'Official' : 'Unofficial'}: ${esc(sub.status_reason)}</span></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root {
  --bg: #1e1e24;
  --surface: #27272f;
  --surface-raised: #2f2f38;
  --border: #3a3a45;
  --text: #e0e0e6;
  --text-muted: #8e8e9e;
  --accent: #6ea8fe;
  --accent-dim: #3d6a9e;
  --bar-bg: #35354a;
  --bar-fill: #5b8dd9;
  --ok: #4caf7a;
  --warn: #e8a838;
  --neutral: #6e6e80;
  --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; line-height: 1.55; padding: 32px 24px; max-width: 900px; margin: 0 auto; }
h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 4px; }
h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 12px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
.header-left h1 { color: var(--accent); }
.header-meta { font-size: 12px; color: var(--text-muted); line-height: 1.7; }
.big-score { font-size: 48px; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; color: var(--text); text-align: right; }
.big-score-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; text-align: right; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 16px; }
.panel-raised { background: var(--surface-raised); }
.chip { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.chip-ok { background: rgba(76,175,122,0.15); color: var(--ok); }
.chip-warn { background: rgba(232,168,56,0.15); color: var(--warn); }
.chip-neutral { background: rgba(110,110,128,0.15); color: var(--neutral); }
.score-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.score-label { width: 160px; font-size: 12px; text-transform: capitalize; color: var(--text-muted); flex-shrink: 0; }
.score-bar-track { flex: 1; height: 14px; background: var(--bar-bg); border-radius: 3px; overflow: hidden; }
.score-bar-fill { height: 100%; background: var(--bar-fill); border-radius: 3px; transition: width 0.3s; }
.score-nums { width: 200px; font-family: var(--mono); font-size: 11px; color: var(--text-muted); display: flex; gap: 4px; flex-shrink: 0; }
.score-nums .raw { color: var(--text); font-weight: 600; }
.score-nums .weighted { color: var(--accent); font-weight: 600; }
.score-nums .times, .score-nums .eq { color: var(--text-muted); }
.penalty-row { display: flex; gap: 12px; margin-bottom: 6px; font-size: 12px; }
.penalty-rule { color: var(--warn); font-family: var(--mono); font-size: 11px; min-width: 200px; flex-shrink: 0; }
.penalty-detail { color: var(--text-muted); }
.arbiter-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.arbiter-field { display: flex; flex-direction: column; gap: 4px; }
.af-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.af-value { font-size: 13px; font-weight: 500; }
.evidence-section { font-size: 12px; }
.evidence-span { margin-bottom: 6px; }
.evidence-span code { font-family: var(--mono); font-size: 11px; color: var(--accent); }
.excerpt { color: var(--text-muted); font-style: italic; }
.trace-line { font-size: 11px; margin-bottom: 3px; color: var(--text-muted); font-family: var(--mono); }
.trace-type { color: var(--accent-dim); font-weight: 600; }
.meta-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
.meta-label { color: var(--text-muted); }
.meta-value { font-family: var(--mono); font-size: 11px; }
.muted { color: var(--text-muted); font-style: italic; font-size: 12px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.justification { font-size: 12px; line-height: 1.6; color: var(--text-muted); margin-bottom: 12px; white-space: pre-wrap; }
.footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text-muted); }
@media print {
  body { background: #fff; color: #111; padding: 16px; }
  .panel { border-color: #ccc; background: #fafafa; }
  .chip-ok { background: #e8f5e9; color: #2e7d32; }
  .chip-warn { background: #fff3e0; color: #e65100; }
  .score-bar-track { background: #e0e0e0; }
  .score-bar-fill { background: #42a5f5; }
  :root { --text: #111; --text-muted: #666; --accent: #1565c0; --accent-dim: #42a5f5; }
}
@media (max-width: 700px) {
  .arbiter-grid { grid-template-columns: 1fr 1fr; }
  .two-col { grid-template-columns: 1fr; }
  .score-nums { width: auto; flex-wrap: wrap; }
  .score-label { width: 120px; }
}
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>${esc(title)}</h1>
    <div class="header-meta">
      <strong>${esc(scenarioId)}</strong> &middot; ${esc(promptFamily)} &middot;
      ${statusChip(isOfficial ? 'Official' : 'Unofficial', isOfficial ? 'ok' : 'neutral')}
      ${statusChip(arbiterAvailable ? 'Arbiter Available' : 'Arbiter Unavailable', arbiterAvailable ? 'ok' : 'warn')}
      ${a.arbiter_metadata.certified ? statusChip('Certified Arbiter', 'ok') : statusChip('Custom Arbiter', 'neutral')}
    </div>
  </div>
  <div>
    <div class="big-score">${pct(f.core_final_score)}</div>
    <div class="big-score-label">Core Final Score</div>
  </div>
</div>

<h2>Score Components</h2>
<div class="panel">
  ${scoreBars}
</div>

<div class="two-col">
  <div>
    <h2>Penalties &amp; Density</h2>
    <div class="panel panel-raised">
      ${penaltiesHtml}
    </div>
    <h2>Caps Applied</h2>
    <div class="panel panel-raised">
      ${capsHtml}
    </div>
  </div>
  <div>
    <h2>Conflicts</h2>
    <div class="panel panel-raised">
      ${conflictsHtml}
    </div>
  </div>
</div>

<h2>Arbiter Evaluation</h2>
<div class="panel">
  ${arbiterPanel}
</div>

<h2>Evidence</h2>
<div class="panel evidence-section">
  <h2 style="margin-bottom:8px">Justification</h2>
  <div class="justification">${esc(justificationExcerpt)}</div>
  <h2 style="margin-bottom:8px">Cited Spans</h2>
  ${spanRefsHtml}
  <div class="two-col" style="margin-top:16px">
    <div>
      <h2 style="margin-bottom:8px">Deterministic Trace</h2>
      ${detTraceHtml || '<p class="muted">No traces.</p>'}
    </div>
    <div>
      <h2 style="margin-bottom:8px">Reconciler Trace</h2>
      ${reconcileTraceHtml || '<p class="muted">No traces.</p>'}
    </div>
  </div>
</div>

<div class="footer">
  <div class="meta-row"><span class="meta-label">Schema Version</span><span class="meta-value">${esc(f.schema_version)}</span></div>
  <div class="meta-row"><span class="meta-label">Rule Profile</span><span class="meta-value">${esc(f.rule_profile_version)}</span></div>
  <div class="meta-row"><span class="meta-label">Capability Mode</span><span class="meta-value">${esc(f.capability_mode)}</span></div>
  <div class="meta-row"><span class="meta-label">Scoring Timestamp</span><span class="meta-value">${esc(f.scoring_timestamp)}</span></div>
  <div class="meta-row"><span class="meta-label">Lineage ID</span><span class="meta-value">${esc(lineageId)}</span></div>
  ${calibrationLine}
  ${submissionLine}
  <div class="meta-row" style="margin-top:8px"><span class="meta-label">Benchmark</span><span class="meta-value">The Invisible Tea Party v1.0 Provisional</span></div>
</div>

</body>
</html>`;
}
