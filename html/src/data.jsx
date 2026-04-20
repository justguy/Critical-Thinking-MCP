/* global React */
const { useState, useEffect } = React;

// ------------------------------------------------------------------
// Data loader + derivations
// ------------------------------------------------------------------

async function loadRuns() {
  try {
    const res = await fetch('./runs.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('status ' + res.status);
    return await res.json();
  } catch (e) {
    console.warn('runs.json fetch failed, using inline fallback', e);
    return window.__FALLBACK_RUNS__ || { runs: [], prompt_ids: [], model_ids: [] };
  }
}

function useRuns(enabled = true) {
  const [state, setState] = useState({ loading: false, data: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    setState((current) => current.data ? current : { loading: true, data: null, error: null });
    let cancelled = false;
    loadRuns()
      .then((data) => !cancelled && setState({ loading: false, data, error: null }))
      .catch((err) => !cancelled && setState({ loading: false, data: null, error: err }));
    return () => { cancelled = true; };
  }, [enabled]);
  return state;
}

// Group runs by (prompt_id, model_id) → { A: run, B: run }
function indexRuns(data) {
  if (!data) return { cases: [], byPrompt: {}, prompts: [], models: [] };
  const map = new Map();
  for (const run of data.runs || []) {
    const key = `${run.prompt_id}::${run.model_id}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        prompt_id: run.prompt_id,
        prompt_title: run.prompt_title,
        model_id: run.model_id,
        provider: run.provider,
        expectation: run.expectation,
        A: null,
        B: null,
      });
    }
    map.get(key)[run.arm] = run;
  }
  const cases = Array.from(map.values());
  const prompts = Array.from(new Set(cases.map((c) => c.prompt_id)));
  const models = Array.from(new Set(cases.map((c) => c.model_id)));
  const byPrompt = {};
  for (const c of cases) {
    (byPrompt[c.prompt_id] ||= []).push(c);
  }
  return { cases, byPrompt, prompts, models };
}

// For a case, derive the rethink summary:
//   pre_draft (B initial draft the model wanted to ship)
//   released_answer (what actually went out after CT critique)
// plus the calibration_result policy decision, tool calls, wrong wins hit status
function deriveRethink(caseRow) {
  const A = caseRow.A;
  const B = caseRow.B;
  const out = {
    A,
    B,
    baselineAnswer: A?.released_answer || A?.last_attempted_answer || '',
    preDraft: B?.pre_draft || null,
    finalAnswer: B?.released_answer || B?.last_attempted_answer || '',
    decision: B?.final_policy_decision || 'not_evaluated',
    preferredTerminal: caseRow.expectation?.preferredTerminal || null,
    acceptableFallback: caseRow.expectation?.acceptableFallback || null,
    expectedShape: caseRow.expectation?.expectedSafeAnswerShape || '',
    wrongWins: caseRow.expectation?.wrongWins || [],
    toolCalls: B?.passes?.initial?.tool_calls || [],
    routeResults: B?.passes?.initial?.calibration_result?.route_results || [],
    revisionDelta: B?.revision_delta || null,
    // The publication bundle intentionally omits per-session runtime and cost telemetry.
    duration: null,
    cost: null,
  };
  // crude "did the critique change something" check
  out.changed = out.preDraft && out.finalAnswer && out.preDraft.trim() !== out.finalAnswer.trim();
  return out;
}

// Count outcomes across all B runs for the hero matrix
function aggregateOutcomes(indexed) {
  const counts = { PASS: 0, WARN: 0, REVIEW: 0, other: 0, total: 0, changed: 0, caught: 0 };
  for (const c of indexed.cases) {
    if (!c.B) continue;
    counts.total += 1;
    const d = c.B.final_policy_decision;
    if (d === 'PASS') counts.PASS += 1;
    else if (d === 'WARN') counts.WARN += 1;
    else if (d === 'REVIEW' || d === 'FAIL') counts.REVIEW += 1;
    else counts.other += 1;
    const r = deriveRethink(c);
    if (r.changed) counts.changed += 1;
    // crude "wrong win caught" = decision is not PASS-green when shape demanded it, or revision happened
    if (r.changed || d === 'WARN' || d === 'REVIEW') counts.caught += 1;
  }
  return counts;
}

// ------------------------------------------------------------------
// Curated navigator tracks
// ------------------------------------------------------------------
// Score a case for each track and return sorted lists so users can
// click “biggest win” etc. to animate through runs.

function scoreCase(c) {
  const r = deriveRethink(c);
  const deltaLen = r.changed ? Math.abs((r.finalAnswer || '').length - (r.preDraft || '').length) : 0;
  const toolsRun = r.toolCalls.length;
  const decision = r.decision;
  return {
    changed: r.changed ? 1 : 0,
    toolsRun,
    deltaLen,
    duration: r.duration || 0,
    decisionScore: decision === 'PASS' ? 3 : decision === 'WARN' ? 2 : (decision === 'REVIEW' || decision === 'FAIL') ? 1 : 0,
    decision,
    wrongWinsCaught: r.changed && r.wrongWins.length ? 1 : 0,
    expectedMiss: r.preferredTerminal && decision !== r.preferredTerminal && decision !== 'not_evaluated' ? 1 : 0,
  };
}

function buildTracks(indexed) {
  const scored = indexed.cases
    .filter((c) => c.B)
    .map((c) => ({ c, s: scoreCase(c) }));

  const byRethink = [...scored].sort((a, b) => (b.s.toolsRun + b.s.deltaLen / 400) - (a.s.toolsRun + a.s.deltaLen / 400));
  const byWin = [...scored].sort((a, b) => (b.s.decisionScore * 10 + b.s.changed) - (a.s.decisionScore * 10 + a.s.changed));
  const byFail = [...scored].sort((a, b) => (a.s.decisionScore || 99) - (b.s.decisionScore || 99) || b.s.expectedMiss - a.s.expectedMiss);
  const byCaught = [...scored].sort((a, b) => (b.s.wrongWinsCaught + b.s.changed) - (a.s.wrongWinsCaught + a.s.changed));
  const byFast = [...scored].sort((a, b) => (a.s.duration || 1e12) - (b.s.duration || 1e12));

  const uniq = (arr) => {
    const seen = new Set();
    const out = [];
    for (const x of arr) {
      if (!seen.has(x.c.key)) { seen.add(x.c.key); out.push(x.c); }
    }
    return out;
  };

  return [
    { id: 'wins',    label: 'Biggest wins',     sub: 'CT‑assisted runs that passed cleanly',   cases: uniq(byWin).filter(Boolean) },
    { id: 'rethinks',label: 'Deepest rethinks', sub: 'where CT forced the most change',         cases: uniq(byRethink).filter((c) => deriveRethink(c).changed) },
    { id: 'caught',  label: 'Wrong wins caught', sub: 'draft would have shipped—CT stopped it', cases: uniq(byCaught).filter((c) => deriveRethink(c).changed) },
    { id: 'fails',   label: 'Deepest failures', sub: 'flagged or mis‑terminated',               cases: uniq(byFail).filter((c) => { const d = c.B?.final_policy_decision; return d === 'REVIEW' || d === 'FAIL' || d === 'WARN'; }) },
    { id: 'fast',    label: 'Fastest critiques', sub: 'CT engaged and returned quickly',        cases: uniq(byFast).filter((c) => deriveRethink(c).toolCalls.length) },
    { id: 'all',     label: 'All runs',         sub: 'every case in order',                      cases: indexed.cases.filter((c) => c.B) },
  ].filter((t) => t.cases.length > 0);
}

function firstWordsDiff(a, b) {
  // super simple word-level diff — ok for preview snippets
  const A = (a || '').split(/(\s+)/);
  const B = (b || '').split(/(\s+)/);
  // LCS
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      if (A[i] === B[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out.push({ type: 'same', t: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', t: A[i] }); i++; }
    else { out.push({ type: 'add', t: B[j] }); j++; }
  }
  while (i < A.length) { out.push({ type: 'del', t: A[i++] }); }
  while (j < B.length) { out.push({ type: 'add', t: B[j++] }); }
  // merge adjacent same/same etc.
  const merged = [];
  for (const seg of out) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) last.t += seg.t;
    else merged.push({ ...seg });
  }
  return merged;
}

function fmtDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtCost(usd) {
  if (usd == null) return '—';
  return `$${usd.toFixed(3)}`;
}

function modelDisplay(id) {
  if (!id) return '';
  return id.replace(/_/g, ' ').replace(/\bhigh\b/i, '· high');
}

Object.assign(window, {
  useRuns, indexRuns, deriveRethink, aggregateOutcomes, buildTracks,
  firstWordsDiff, fmtDuration, fmtCost, modelDisplay,
});
