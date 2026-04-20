/* global React */
const { useState, useEffect, useMemo } = React;

function Pill({ tone = 'neutral', children }) {
  return <span className={`pill pill--${tone}`}>{children}</span>;
}
function Mono({ children }) { return <span className="mono">{children}</span>; }

function outcomeTone(outcome) {
  if (outcome === 'PASS') return 'pass';
  if (outcome === 'WARN' || outcome === 'HUMAN_REVIEW') return 'warn';
  if (outcome === 'REVIEW' || outcome === 'FAIL') return 'fail';
  return 'mute';
}

// ==================================================================
// HERO
// ==================================================================
function Hero({ cases, featured, onPickCase }) {
  const wins = cases.filter((c) => c.track === 'win').length;
  const neutrals = cases.filter((c) => c.track === 'neutral').length;

  return (
    <section className="hero">
      <div className="hero-left">
        <h1 className="display">
          The first answer is <em>rarely</em> good enough.
        </h1>
        <p className="lede">
          Critical&nbsp;Thinking&nbsp;MCP intercepts an LLM's first draft, runs it
          through contract checks and tradeoff analysis, then forces the model to
          re&#8209;think before it ships.
        </p>
        <div className="hero-kpis">
          <Kpi big={wins} label="cases where CT caught real failures and forced a better answer" tone="signal" />
          <Kpi big={neutrals} label="cases where CT added little — the model was already correct" tone="mute" />
        </div>
        <p className="hero-note">
          The examples below are curated. The full benchmark (8 prompts × multiple models, routed tool outputs, and release decisions)
          ships in the publication bundle at <Mono>runs.json</Mono>.
        </p>
      </div>
      <div className="hero-right">
        <HeroScorecard cases={cases} featured={featured} onPickCase={onPickCase} />
      </div>
    </section>
  );
}

function Kpi({ big, label, tone }) {
  return (
    <div className={`kpi kpi--${tone}`}>
      <div className="kpi-n">{big}</div>
      <div className="kpi-l">{label}</div>
    </div>
  );
}

function HeroScorecard({ cases, featured, onPickCase }) {
  return (
    <div className="scorecard">
      <div className="scorecard-head">
        <div className="scorecard-title">Selected benchmark cases</div>
        <div className="scorecard-sub">click any to jump to the walkthrough</div>
      </div>
      <div className="scorecard-list">
        {cases.map((c) => {
          const tone = c.track === 'win' ? 'pass' : 'mute';
          const active = featured?.id === c.id;
          return (
            <button
              key={c.id}
              className={`sc-row sc-row--${tone} ${active ? 'is-on' : ''}`}
              onClick={() => onPickCase(c.id)}
            >
              <span className="sc-id"><Mono>{c.id}</Mono></span>
              <span className="sc-title">{c.title}</span>
              <span className={`sc-dot sc-dot--${tone}`} />
            </button>
          );
        })}
      </div>
      <div className="scorecard-legend">
        <span className="legend-item"><span className="sc-dot sc-dot--pass" /> CT caught something</span>
        <span className="legend-item"><span className="sc-dot sc-dot--mute" /> CT didn't help</span>
      </div>
    </div>
  );
}

// ==================================================================
// NAVIGATOR — two tracks: wins vs where CT didn't help
// ==================================================================
function Navigator({ tracks, currentId, onPick }) {
  const [trackId, setTrackId] = useState(tracks[0]?.id);
  const track = tracks.find((t) => t.id === trackId) || tracks[0];
  const cases = track?.cases || [];
  const idx = Math.max(0, cases.findIndex((c) => c.id === currentId));

  useEffect(() => {
    if (!cases.length) return;
    if (!cases.find((c) => c.id === currentId)) {
      onPick(cases[0].id);
    }
  }, [trackId]); // eslint-disable-line

  const go = (delta) => {
    if (!cases.length) return;
    const next = (idx + delta + cases.length) % cases.length;
    onPick(cases[next].id);
  };

  return (
    <section className="nav">
      <div className="nav-tracks">
        {tracks.map((t) => (
          <button
            key={t.id}
            className={`nav-track ${t.id === trackId ? 'is-on' : ''} nav-track--${t.accent}`}
            onClick={() => setTrackId(t.id)}
          >
            <span className="nav-track-l">{t.label}</span>
            <span className="nav-track-n">{t.cases.length}</span>
          </button>
        ))}
      </div>
      <div className="nav-stepper">
        <div className="nav-stepper-l">
          <span className="nav-stepper-sub">{track?.sub}</span>
        </div>
        <div className="nav-stepper-dots">
          {cases.map((c, i) => (
            <button
              key={c.id}
              className={`nav-dot ${i === idx ? 'is-on' : ''} nav-dot--${track.accent}`}
              onClick={() => onPick(c.id)}
              title={`${c.id} · ${c.title}`}
              aria-label={c.title}
            >
              <span className="nav-dot-id">{c.id}</span>
            </button>
          ))}
        </div>
        <div className="nav-stepper-r">
          <span className="nav-stepper-pos">
            <Mono>{String(idx + 1).padStart(2, '0')}</Mono>
            <span className="nav-sep">/</span>
            <Mono>{String(cases.length).padStart(2, '0')}</Mono>
          </span>
          <button className="nav-arrow" onClick={() => go(-1)} aria-label="previous">←</button>
          <button className="nav-arrow" onClick={() => go(+1)} aria-label="next">→</button>
        </div>
      </div>
    </section>
  );
}

// ==================================================================
// CASE VIEW — setup → Arm A → what CT caught → Arm B → why it matters
// ==================================================================
function CaseView({ caseData }) {
  if (!caseData) return null;
  const c = caseData;
  const isWin = c.track === 'win';
  const accent = isWin ? 'win' : 'neutral';

  return (
    <article className={`case case--${accent}`}>
      <header className="case-head">
        <div className="case-head-meta">
          <span className={`case-tag case-tag--${accent}`}>
            {isWin ? 'CT made the answer better' : 'CT added little'}
          </span>
          <span className="case-id"><Mono>{c.id}</Mono></span>
          <span className="case-cat"><Mono>{c.tag.replace(/_/g, ' ')}</Mono></span>
          {c.model && (
            <span className="case-model" title="Model under test">
              <span className="case-model-l">model</span>
              <Mono>{c.model}</Mono>
            </span>
          )}
        </div>
        <h2 className="case-title">{c.title}</h2>
        <p className="case-setup">{c.setup}</p>
      </header>

      <Beat n="01" kicker="Arm A — no CT" tone="neutral">
        <AnswerBlock excerpt={c.armA.excerpt} label="What the model said" variant="draft" />
        <div className="critique">
          <div className="critique-l">What's wrong with it</div>
          <p>{c.armA.critique}</p>
        </div>
      </Beat>

      <Beat n="02" kicker={isWin ? "CT engages" : "CT engages"} tone={isWin ? 'signal' : 'neutral'}>
        <div className="ct-caught">
          <div className="ct-caught-head">
            <span className="ct-caught-tool"><Mono>{c.ctCaught.tool}</Mono></span>
            {isWin ? <Pill tone="fail">BLOCKED</Pill> : <Pill tone="mute">NO-OP</Pill>}
          </div>
          <p className="ct-caught-finding">{c.ctCaught.finding}</p>
        </div>
      </Beat>

      <Beat n="03" kicker={`Arm B — with CT · ${c.armB.outcome}`} tone={isWin ? 'pass' : 'neutral'}>
        <AnswerBlock
          excerpt={c.armB.excerpt}
          label={isWin ? "What the revision said" : "What Arm B said"}
          variant="final"
          outcome={c.armB.outcome}
        />
      </Beat>

      <div className="case-why">
        <div className="case-why-l">Why it matters</div>
        <p className="case-why-t">{c.whyItMatters}</p>
      </div>

      {c.crossModel && (
        <div className="cross-model">
          <div className="cross-model-head">
            <span className="cross-model-l">Cross-model contrast</span>
            <div className="cross-model-vs">
              <span className="cm-chip cm-chip--primary"><Mono>{c.model}</Mono><span className="cm-out">→ {c.armB.outcome}</span></span>
              <span className="cm-vs">vs</span>
              <span className="cm-chip cm-chip--peer"><Mono>{c.crossModel.peer}</Mono><span className="cm-out">→ {c.crossModel.peerOutcome}</span></span>
            </div>
          </div>
          <p className="cross-model-t">{c.crossModel.body}</p>
        </div>
      )}
    </article>
  );
}

function Beat({ n, kicker, tone, children }) {
  return (
    <div className={`beat beat--${tone}`}>
      <div className="beat-gutter">
        <div className="beat-n">{n}</div>
        <div className="beat-k">{kicker}</div>
        <div className="beat-rule" />
      </div>
      <div className="beat-body">{children}</div>
    </div>
  );
}

function AnswerBlock({ excerpt, label, variant, outcome }) {
  const [expanded, setExpanded] = useState(false);
  const long = (excerpt || '').length > 540;
  const shown = expanded || !long ? excerpt : excerpt.slice(0, 540) + '…';
  return (
    <div className={`answer answer--${variant}`}>
      <div className="answer-head">
        <div className="answer-l">{label}</div>
        {outcome && <Pill tone={outcomeTone(outcome)}>{outcome}</Pill>}
      </div>
      <div className="answer-t">{shown}</div>
      {long && (
        <button className="lnk" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Collapse' : 'Read the full excerpt'}
        </button>
      )}
    </div>
  );
}

// ==================================================================
// TWEAKS PANEL
// ==================================================================
function TweaksPanel({ open, settings, onChange, onClose }) {
  if (!open) return null;
  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <div className="tweaks-title">Tweaks</div>
        <button className="lnk" onClick={onClose}>close</button>
      </div>
      <div className="tweaks-group">
        <div className="tweaks-l">Theme</div>
        <div className="tweaks-seg">
          {[['light', 'Light'], ['dark', 'Dark']].map(([v, lbl]) => (
            <button key={v} className={`seg-btn ${settings.theme === v ? 'is-on' : ''}`} onClick={() => onChange({ theme: v })}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className="tweaks-group">
        <div className="tweaks-l">Accent family</div>
        <div className="tweaks-seg">
          {[['cobalt', 'Cobalt'], ['signal', 'Red'], ['emerald', 'Emerald']].map(([v, lbl]) => (
            <button key={v} className={`seg-btn ${settings.accent === v ? 'is-on' : ''}`} onClick={() => onChange({ accent: v })}>{lbl}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================================================================
// SCORECARD — aggregate + per-model matrix
// ==================================================================
function Scorecard({ data, onPickCase }) {
  if (!data) return null;
  const totalPass = data.models.reduce((a, m) => a + m.armB.PASS, 0);
  const totalWarn = data.models.reduce((a, m) => a + m.armB.WARN, 0);
  const totalHR   = data.models.reduce((a, m) => a + m.armB.HUMAN_REVIEW, 0);
  const totalRev  = data.models.reduce((a, m) => a + m.revisions.triggered, 0);

  return (
    <section className="scorecard-section">
      <div className="sec-head">
        <div className="sec-eyebrow"><Mono>aggregate · 8 scenarios × 2 models × 2 arms</Mono></div>
        <h2 className="sec-title">The scorecard</h2>
        <p className="sec-lede">
          Across {data.runs} runs, CT forced {totalRev} revisions — all on one model.
          The other model already hedged enough that CT found nothing to change.
        </p>
      </div>

      <div className="agg-row">
        <AggStat n={totalPass} label="passed the release gate" tone="pass" />
        <AggStat n={totalWarn} label="released with CT warnings" tone="warn" />
        <AggStat n={totalHR} label="escalated to human review" tone="fail" />
        <AggStat n={totalRev} label="forced revisions" tone="signal" />
      </div>

      <div className="model-grid">
        {data.models.map((m) => (
          <ModelCard key={m.id} model={m} onPickCase={onPickCase} />
        ))}
      </div>

      <div className="observations">
        <div className="obs-l">Cross-model observations</div>
        <ul className="obs-list">
          {data.observations.map((o, i) => (
            <li key={i} className="obs-item">
              <span className="obs-k">{o.k}</span>
              <span className="obs-v">{o.v}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AggStat({ n, label, tone }) {
  return (
    <div className={`agg agg--${tone}`}>
      <div className="agg-n">{n}</div>
      <div className="agg-l">{label}</div>
    </div>
  );
}

function ModelCard({ model, onPickCase }) {
  const m = model;
  const total = m.armB.total;
  return (
    <div className="mcard">
      <div className="mcard-head">
        <div className="mcard-name"><Mono>{m.label}</Mono></div>
        <div className="mcard-sub">Arm B (with CT) · {total} runs</div>
      </div>
      <div className="mcard-bar">
        <MBar label="PASS"  n={m.armB.PASS}         total={total} tone="pass" />
        <MBar label="WARN"  n={m.armB.WARN}         total={total} tone="warn" />
        <MBar label="HR"    n={m.armB.HUMAN_REVIEW} total={total} tone="fail" />
      </div>
      <div className="mcard-rev">
        <div className="mcard-rev-n">{m.revisions.triggered}</div>
        <div className="mcard-rev-l">revisions triggered</div>
        {m.revisions.triggered > 0 && (
          <div className="mcard-rev-sub">
            {m.revisions.resolved} resolved · {m.revisions.escalated} escalated
          </div>
        )}
      </div>
      <div className="mcard-cases">
        {m.cases.map((c) => (
          <button
            key={c.id}
            className={`mcase mcase--${outcomeTone(c.decision)} ${c.revised ? 'is-rev' : ''}`}
            onClick={() => onPickCase?.(c.id)}
            title={c.note}
          >
            <span className="mcase-id"><Mono>{c.id}</Mono></span>
            <span className="mcase-d">{c.decision}</span>
            {c.revised && <span className="mcase-rev" title="CT forced a revision">↻</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function MBar({ label, n, total, tone }) {
  const pct = total ? (n / total) * 100 : 0;
  return (
    <div className="mbar">
      <div className="mbar-head">
        <span className="mbar-l">{label}</span>
        <span className="mbar-n">{n}</span>
      </div>
      <div className="mbar-track">
        <div className={`mbar-fill mbar-fill--${tone}`} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

// ==================================================================
// FULL BENCHMARK — lazy-loaded runs.json browser
// ==================================================================
function FullBenchmark() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const runsState = window.useRuns
    ? window.useRuns(open)
    : { loading: false, data: window.__FULL_RUNS__ || { runs: [], prompt_ids: [], model_ids: [] }, error: null };
  const json = runsState.data || { runs: [], prompt_ids: [], model_ids: [] };
  const runs = json.runs || [];
  const meta = {
    prompts: json.prompt_ids || [],
    models:  json.model_ids  || [],
    runs:    runs.length,
  };

  const toggle = () => setOpen((v) => !v);

  return (
    <section className={`fullbench ${open ? 'is-open' : ''}`}>
      <div className="fullbench-head">
        <div>
          <div className="sec-eyebrow"><Mono>{runs.length} runs · {meta.prompts.length || 8} prompts × {meta.models.length} models × 2 arms</Mono></div>
          <h2 className="sec-title">The full benchmark</h2>
          <p className="fullbench-lede">
            Every A/B run in the matrix. Not editorialized — the sanitized publication bundle keeps the routed CT calls and release gates without shipping session metadata.
          </p>
        </div>
        <button className="fullbench-btn" onClick={toggle}>
          {open ? 'Close' : 'Browse all runs →'}
        </button>
      </div>

      {open && (
        <div className="fullbench-body">
          {runsState.loading && <div className="fullbench-status">Loading <Mono>runs.json</Mono>…</div>}
          {!runsState.loading && runsState.error && (
            <div className="fullbench-status fullbench-status--err">
              Could not load <Mono>runs.json</Mono>. The curated walkthrough is still available.
            </div>
          )}
          {!runsState.loading && !runsState.error && (
            <FullBenchmarkBrowser runs={runs} meta={meta} selected={selected} onSelect={setSelected} />
          )}
        </div>
      )}
    </section>
  );
}

function FullBenchmarkBrowser({ runs, meta, selected, onSelect }) {
  const [filterModel, setFilterModel] = useState('all');
  const [filterArm, setFilterArm] = useState('all');

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (filterModel !== 'all' && r.model_id !== filterModel) return false;
      if (filterArm !== 'all' && r.arm !== filterArm) return false;
      return true;
    });
  }, [runs, filterModel, filterArm]);

  return (
    <div className="fb-browser">
      <div className="fb-filters">
        <div className="fb-filter">
          <span className="fb-filter-l">model</span>
          <div className="fb-seg">
            <button className={`fb-seg-b ${filterModel === 'all' ? 'is-on' : ''}`} onClick={() => setFilterModel('all')}>all</button>
            {meta.models.map((m) => (
              <button key={m} className={`fb-seg-b ${filterModel === m ? 'is-on' : ''}`} onClick={() => setFilterModel(m)}>{m}</button>
            ))}
          </div>
        </div>
        <div className="fb-filter">
          <span className="fb-filter-l">arm</span>
          <div className="fb-seg">
            {['all', 'A', 'B'].map((a) => (
              <button key={a} className={`fb-seg-b ${filterArm === a ? 'is-on' : ''}`} onClick={() => setFilterArm(a)}>{a}</button>
            ))}
          </div>
        </div>
        <div className="fb-count">
          <Mono>{filtered.length} / {runs.length}</Mono>
        </div>
      </div>

      <div className="fb-table">
        <div className="fb-th">
          <span>Prompt</span>
          <span>Model</span>
          <span>Arm</span>
          <span>Policy decision</span>
          <span>Outcome</span>
          <span></span>
        </div>
        {filtered.map((r, i) => {
          const id = (r.prompt_id || '') + '::' + (r.model_id || '') + '::' + (r.arm || '');
          const isSel = selected?._id === id;
          return (
            <button
              key={id + i}
              className={`fb-tr fb-tr--${outcomeTone(r.final_policy_decision)} ${isSel ? 'is-sel' : ''}`}
              onClick={() => onSelect(isSel ? null : { ...r, _id: id })}
            >
              <span className="fb-td fb-td-prompt">
                <span className="fb-pid"><Mono>{r.prompt_id}</Mono></span>
                <span className="fb-ptitle">{r.prompt_title}</span>
              </span>
              <span className="fb-td fb-td-model"><Mono>{r.model_id}</Mono></span>
              <span className="fb-td fb-td-arm"><Mono>{r.arm}</Mono></span>
              <span className="fb-td"><Pill tone={outcomeTone(r.final_policy_decision)}>{r.final_policy_decision || '—'}</Pill></span>
              <span className="fb-td fb-td-outcome"><Mono>{r.final_outcome || '—'}</Mono></span>
              <span className="fb-td fb-td-chev">{isSel ? '▾' : '›'}</span>
            </button>
          );
        })}
      </div>

      {selected && <FullBenchmarkDrawer run={selected} onClose={() => onSelect(null)} />}
    </div>
  );
}

function FullBenchmarkDrawer({ run, onClose }) {
  const preDraft  = run.pre_draft || '';
  const released  = run.released_answer || run.last_attempted_answer || '';
  const tools     = run.passes?.initial?.tool_calls || [];
  const calibration = run.passes?.initial?.calibration_result || null;
  const routeResults = calibration?.route_results || [];
  const expectation = run.expectation || null;
  const revDelta  = run.revision_delta;
  const revReq    = run.revision_request;

  return (
    <div className="fb-drawer">
      <div className="fb-drawer-head">
        <div>
          <div className="sec-eyebrow"><Mono>{run.prompt_id} · {run.model_id} · arm {run.arm}</Mono></div>
          <h3 className="fb-drawer-title">{run.prompt_title}</h3>
        </div>
        <button className="lnk" onClick={onClose}>close ✕</button>
      </div>

      {expectation && (
        <div className="fb-block">
          <div className="fb-block-l">Benchmark expectation</div>
          <div className="fb-expect">
            <div className="fb-expect-row"><span className="fb-expect-k">tag</span><Mono>{expectation.benchmarkTag}</Mono></div>
            <div className="fb-expect-row"><span className="fb-expect-k">preferred</span><Pill tone={outcomeTone(expectation.preferredTerminal)}>{expectation.preferredTerminal}</Pill></div>
            {expectation.acceptableFallback && <div className="fb-expect-row"><span className="fb-expect-k">fallback</span><Pill tone={outcomeTone(expectation.acceptableFallback)}>{expectation.acceptableFallback}</Pill></div>}
            <div className="fb-expect-row"><span className="fb-expect-k">safe shape</span><span>{expectation.expectedSafeAnswerShape}</span></div>
            {expectation.wrongWins?.length > 0 && (
              <div className="fb-expect-row"><span className="fb-expect-k">wrong wins</span>
                <ul className="fb-ww">{expectation.wrongWins.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
          </div>
        </div>
      )}

      {preDraft && (
        <div className="fb-block">
          <div className="fb-block-l">Pre-draft <span className="fb-block-sub">(what the model wanted to ship before CT)</span></div>
          <div className="fb-block-t">{preDraft}</div>
        </div>
      )}

      {Array.isArray(tools) && tools.length > 0 && (
        <div className="fb-block">
          <div className="fb-block-l">CT tool calls ({tools.length})</div>
          {tools.map((t, i) => (
            <div key={i} className="fb-tool">
              <div className="fb-tool-name"><Mono>{t.name || 'tool ' + i}</Mono></div>
              {t.input && <details className="fb-tool-input"><summary>input</summary><pre className="fb-tool-out">{JSON.stringify(t.input, null, 2)}</pre></details>}
              {t.output && <pre className="fb-tool-out">{typeof t.output === 'string' ? t.output : JSON.stringify(t.output, null, 2)}</pre>}
            </div>
          ))}
        </div>
      )}

      {routeResults.length > 0 && (
        <div className="fb-block">
          <div className="fb-block-l">Calibration route results</div>
          {routeResults.map((rr, i) => (
            <div key={i} className="fb-tool">
              <div className="fb-tool-name">
                <Mono>{rr.tool}</Mono>
                <Pill tone={outcomeTone(rr.status)}>{rr.status}</Pill>
              </div>
              {rr.enforcement && (rr.enforcement.blocking_issues?.length > 0 || rr.enforcement.warnings?.length > 0) && (
                <div className="fb-enforcement">
                  {rr.enforcement.blocking_issues?.map((b, j) => <div key={j} className="fb-issue fb-issue--block">{b}</div>)}
                  {rr.enforcement.warnings?.map((w, j) => <div key={j} className="fb-issue fb-issue--warn">{w}</div>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {revReq && (
        <div className="fb-block">
          <div className="fb-block-l">Revision request</div>
          <div className="fb-block-t">{revReq.safer_revision_target}</div>
          {revDelta && (
            <div className="fb-rev-delta">
              <span>bloat ratio: <Mono>{revDelta.revisionBloatRatio?.toFixed(2)}</Mono></span>
              <span>char delta: <Mono>{revDelta.finalAnswerCharDelta > 0 ? '+' : ''}{revDelta.finalAnswerCharDelta}</Mono></span>
              <span>cost delta: <Mono>${revDelta.revisionCostDeltaUsd?.toFixed(4)}</Mono></span>
            </div>
          )}
        </div>
      )}

      {released && (
        <div className="fb-block">
          <div className="fb-block-l">{run.released_answer ? 'Released answer' : 'Last attempted answer'}</div>
          <div className="fb-block-t">{released}</div>
        </div>
      )}

      <details className="fb-raw">
        <summary>Raw run JSON</summary>
        <pre className="fb-raw-pre">{JSON.stringify(run, null, 2)}</pre>
      </details>
    </div>
  );
}

Object.assign(window, { Hero, Navigator, CaseView, TweaksPanel, Scorecard, FullBenchmark });
