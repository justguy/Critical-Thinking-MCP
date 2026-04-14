import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface FailureGalleryScenario {
  scenario_id: string;
  family: string | null;
  difficulty_tier: number | null;
  authored_prompt: string | null;
  expected_failure_modes: string[];
  ground_truth_constraints: string[];
  source_bundle_dir: string;
  scores: {
    core_final_score: number | null;
    arbiter_pass_status: string | null;
    leaderboard_status: string | null;
    contradiction_overlap: number | null;
    gap_closure_rate: number | null;
    evasion_penalty_normalized: number | null;
    semantic_density_drop_flag: boolean | null;
    caps_applied: string[];
  };
  pass_gist: {
    pass1: string | null;
    pass2: string | null;
    pass3: string | null;
  };
  responses: {
    pass1: string;
    pass2: string;
    pass3: string;
  };
  verification: {
    deterministic: {
      unresolved_constraint_ids?: string[];
      unresolved_constraint_count?: number;
      unresolved_causal_constraint_count?: number;
    };
    arbiter: {
      justification?: string;
    };
  };
}

export interface FailureGalleryBundle {
  schema_version: string;
  benchmark_id: string;
  generated_at: string;
  run_label: string;
  scenarios: FailureGalleryScenario[];
}

export interface FailureGalleryOptions {
  title?: string;
  maxCards?: number;
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pct(value: number | null | undefined): string {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : 'N/A';
}

function fmt(value: number | null | undefined, digits = 3): string {
  return typeof value === 'number' ? value.toFixed(digits) : 'N/A';
}

function preview(text: string | null | undefined, max = 260): string {
  const clean = (text ?? '').trim();
  if (!clean) return 'N/A';
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function chip(label: string, tone: 'bad' | 'warn' | 'neutral' | 'good'): string {
  return `<span class="chip chip-${tone}">${esc(label)}</span>`;
}

export function loadFailureGalleryBundle(resultsDir: string): FailureGalleryBundle {
  const bundlePath = resolve(resultsDir, 'aggregated_scenario_runs.json');
  return JSON.parse(readFileSync(bundlePath, 'utf-8')) as FailureGalleryBundle;
}

function galleryCards(scenarios: FailureGalleryScenario[]): string {
  return scenarios.map((scenario, index) => {
    const score = scenario.scores.core_final_score ?? 0;
    const caps = scenario.scores.caps_applied.length > 0
      ? scenario.scores.caps_applied.map(cap => `<li>${esc(cap)}</li>`).join('')
      : '<li>None</li>';
    const unresolved = scenario.verification.deterministic.unresolved_constraint_ids ?? [];
    const unresolvedItems = unresolved.length > 0
      ? unresolved.map(item => `<li>${esc(item)}</li>`).join('')
      : '<li>None</li>';
    const expectedModes = scenario.expected_failure_modes.length > 0
      ? scenario.expected_failure_modes.map(item => `<li>${esc(item)}</li>`).join('')
      : '<li>None listed</li>';
    const arbiterTone = scenario.scores.arbiter_pass_status === 'AVAILABLE' ? 'good' : 'warn';
    const officialTone = scenario.scores.leaderboard_status === 'official_certified_arbiter' ? 'good' : 'neutral';
    const densityTone = scenario.scores.semantic_density_drop_flag ? 'warn' : 'good';
    const scorePct = Math.max(0, Math.min(score * 100, 100));

    return `
      <article class="card">
        <div class="card-top">
          <div>
            <div class="eyebrow">Case ${index + 1}</div>
            <h2>${esc(scenario.scenario_id)}</h2>
            <div class="meta">${esc(scenario.family ?? 'unknown')} · Tier ${scenario.difficulty_tier ?? 'N/A'}</div>
          </div>
          <div class="score-block">
            <div class="score-label">Core Score</div>
            <div class="score-value">${pct(score)}</div>
            <div class="score-bar"><span style="width:${scorePct.toFixed(1)}%"></span></div>
          </div>
        </div>

        <div class="chip-row">
          ${chip(scenario.scores.arbiter_pass_status ?? 'N/A', arbiterTone)}
          ${chip(scenario.scores.leaderboard_status ?? 'N/A', officialTone)}
          ${chip(
            scenario.scores.semantic_density_drop_flag ? 'Density Drop' : 'Density Stable',
            densityTone,
          )}
        </div>

        <p class="prompt">${esc(preview(scenario.authored_prompt, 420))}</p>

        <div class="grid">
          <section>
            <h3>Why It Matters</h3>
            <ul>
              ${expectedModes}
            </ul>
          </section>
          <section>
            <h3>Penalty Signals</h3>
            <ul>
              <li>Overlap: ${fmt(scenario.scores.contradiction_overlap)}</li>
              <li>Gap closure: ${fmt(scenario.scores.gap_closure_rate)}</li>
              <li>Evasion penalty: ${fmt(scenario.scores.evasion_penalty_normalized)}</li>
              <li>Unresolved count: ${scenario.verification.deterministic.unresolved_constraint_count ?? 'N/A'}</li>
            </ul>
          </section>
        </div>

        <div class="grid">
          <section>
            <h3>Pass Gist</h3>
            <ul>
              <li>Pass 1: ${esc(preview(scenario.pass_gist.pass1, 180))}</li>
              <li>Pass 2: ${esc(preview(scenario.pass_gist.pass2, 180))}</li>
              <li>Pass 3: ${esc(preview(scenario.pass_gist.pass3, 180))}</li>
            </ul>
          </section>
          <section>
            <h3>Caps Applied</h3>
            <ul>${caps}</ul>
          </section>
        </div>

        <div class="grid">
          <section>
            <h3>Unresolved Constraints</h3>
            <ul>${unresolvedItems}</ul>
          </section>
          <section>
            <h3>Arbiter Note</h3>
            <p class="justification">${esc(preview(scenario.verification.arbiter.justification, 260))}</p>
          </section>
        </div>

        <div class="footer-row">
          <span>${esc(scenario.source_bundle_dir)}</span>
        </div>
      </article>
    `;
  }).join('\n');
}

export function renderFailureGalleryHtml(
  bundle: FailureGalleryBundle,
  options: FailureGalleryOptions = {},
): string {
  const title = options.title ?? 'Invisible Tea Party — Failure Gallery';
  const maxCards = options.maxCards ?? 12;
  const scenarios = [...bundle.scenarios]
    .sort((a, b) => (a.scores.core_final_score ?? 1) - (b.scores.core_final_score ?? 1))
    .slice(0, maxCards);

  const meanScore = scenarios.length > 0
    ? scenarios.reduce((sum, item) => sum + (item.scores.core_final_score ?? 0), 0) / scenarios.length
    : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root {
  --bg: #f6f1e7;
  --paper: #fffaf0;
  --ink: #221b14;
  --muted: #6c5f52;
  --border: #d7c6b2;
  --accent: #8c3b1f;
  --accent-soft: #e6b07b;
  --ok: #2c7a4b;
  --warn: #a26012;
  --bad: #9b2c2c;
  --neutral: #6b7280;
  --shadow: rgba(52, 33, 18, 0.12);
  --font: Georgia, 'Iowan Old Style', 'Palatino Linotype', serif;
  --ui: 'Avenir Next', 'Segoe UI', sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background:
    radial-gradient(circle at top left, rgba(230,176,123,0.28), transparent 28%),
    linear-gradient(180deg, #f4ede0 0%, #f7f3eb 45%, #efe7da 100%);
  color: var(--ink);
  font-family: var(--font);
  line-height: 1.55;
}
.shell {
  max-width: 1180px;
  margin: 0 auto;
  padding: 32px 20px 64px;
}
.hero {
  background: linear-gradient(135deg, rgba(140,59,31,0.95), rgba(110,47,26,0.86));
  color: #fff8f1;
  border-radius: 22px;
  padding: 28px;
  box-shadow: 0 20px 50px var(--shadow);
  margin-bottom: 22px;
}
.hero h1 {
  margin: 0 0 8px;
  font-size: clamp(2rem, 3.8vw, 3.6rem);
  line-height: 1.02;
}
.hero p {
  margin: 0;
  max-width: 760px;
  font-size: 1.02rem;
  color: rgba(255,248,241,0.88);
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}
.stat {
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 10px 25px rgba(52, 33, 18, 0.06);
}
.stat-label {
  font-family: var(--ui);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: var(--muted);
}
.stat-value {
  font-family: var(--ui);
  font-size: 1.9rem;
  font-weight: 700;
  margin-top: 6px;
}
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 18px;
}
.card {
  background: rgba(255,250,240,0.96);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 18px;
  box-shadow: 0 16px 40px rgba(52, 33, 18, 0.08);
}
.card-top {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}
.eyebrow {
  font-family: var(--ui);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: var(--accent);
  margin-bottom: 4px;
}
.card h2 {
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.1;
}
.meta {
  margin-top: 6px;
  color: var(--muted);
  font-family: var(--ui);
  font-size: 0.9rem;
}
.score-block {
  min-width: 110px;
  text-align: right;
  font-family: var(--ui);
}
.score-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.68rem;
  color: var(--muted);
}
.score-value {
  font-size: 1.8rem;
  font-weight: 700;
}
.score-bar {
  margin-top: 8px;
  height: 8px;
  background: #eadbca;
  border-radius: 999px;
  overflow: hidden;
}
.score-bar span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent-soft), var(--accent));
}
.chip-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.chip {
  border-radius: 999px;
  padding: 4px 10px;
  font-family: var(--ui);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.chip-bad { background: rgba(155,44,44,0.12); color: var(--bad); }
.chip-warn { background: rgba(162,96,18,0.14); color: var(--warn); }
.chip-good { background: rgba(44,122,75,0.12); color: var(--ok); }
.chip-neutral { background: rgba(107,114,128,0.12); color: var(--neutral); }
.prompt {
  margin: 0 0 16px;
  color: var(--ink);
  font-size: 0.99rem;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.grid h3 {
  margin: 0 0 8px;
  font-family: var(--ui);
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.grid ul {
  margin: 0;
  padding-left: 18px;
}
.grid li,
.justification {
  font-size: 0.92rem;
}
.footer-row {
  font-family: var(--ui);
  font-size: 0.8rem;
  color: var(--muted);
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
@media (max-width: 780px) {
  .summary,
  .grid {
    grid-template-columns: 1fr;
  }
  .card-top {
    flex-direction: column;
  }
  .score-block {
    text-align: left;
  }
}
</style>
</head>
<body>
  <main class="shell">
    <section class="hero">
      <h1>${esc(title)}</h1>
      <p>The lowest-scoring Tea Party cases, rendered as a shareable failure gallery from merged benchmark artifacts. Generated ${esc(bundle.generated_at)} from ${esc(bundle.run_label)}.</p>
    </section>

    <section class="summary">
      <div class="stat">
        <div class="stat-label">Cases Shown</div>
        <div class="stat-value">${scenarios.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Mean Score</div>
        <div class="stat-value">${pct(meanScore)}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Worst Case</div>
        <div class="stat-value">${scenarios[0] ? esc(scenarios[0].scenario_id) : 'N/A'}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Benchmark</div>
        <div class="stat-value">${esc(bundle.benchmark_id)}</div>
      </div>
    </section>

    <section class="gallery">
      ${galleryCards(scenarios)}
    </section>
  </main>
</body>
</html>`;
}
