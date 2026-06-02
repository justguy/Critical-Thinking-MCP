#!/usr/bin/env node
// Deterministic claims-ledger CI check (CT-MCP Phase 0, dvp-p0).
//
// This is NOT general NLP claim extraction. It does two deterministic things:
//   (a) Ledger integrity — every entry is well-typed and self-consistent.
//   (b) Tracked-phrases scan — a small literal phrase -> claim_id map; fail if a
//       tracked phrase appears in a tracked doc while its ledger entry status is
//       `contradicted` or `unproven`. This deterministically enforces "docs can't
//       assert a non-proven claim" for the claims we track.
//
// No external dependencies. Exit 0 = pass, exit 1 = fail.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

const VALID_TYPES = new Set(['empirical', 'architecture', 'roadmap', 'scope', 'marketing']);
const VALID_STATUS = new Set(['proven', 'unproven', 'contradicted', 'planned']);
const REQUIRED_FIELDS = [
  'claim_id',
  'claim_text',
  'claim_type',
  'source_file',
  'evidence_fixture',
  'last_verified_commit',
  'status',
];

// ---------------------------------------------------------------------------
// Tracked phrases: literal claim phrase -> claim_id.
// A phrase here is a way to *assert* the mapped claim. If the claim's ledger
// status is `contradicted` or `unproven`, the phrase must not appear in any
// tracked doc. Keep phrases specific enough to avoid tripping on honest
// re-scoping text (which negates / quotes the retired phrasing in context).
// ---------------------------------------------------------------------------
const TRACKED_PHRASES = [
  // The non-reproducible head-to-head "beats baseline N/N" assertions
  // (emp-30-30-vs-baseline is `contradicted` — synthetic baseline rows).
  { phrase: 'outperformed baseline on 42/42', claim_id: 'emp-30-30-vs-baseline' },
  { phrase: 'outperformed prompted LLM on 42/42', claim_id: 'emp-30-30-vs-baseline' },
  { phrase: '42/42 wins vs baseline', claim_id: 'emp-30-30-vs-baseline' },
  { phrase: '42/42 vs baseline, 42/42 vs prompted', claim_id: 'emp-30-30-vs-baseline' },
  { phrase: 'beats baseline 30/30', claim_id: 'emp-30-30-vs-baseline' },
  { phrase: 'wins 30/30', claim_id: 'emp-30-30-vs-baseline' },
  { phrase: 'outperform both baseline and prompted', claim_id: 'emp-30-30-vs-baseline' },
  // The stale "facade public surface" mislabel (arch-11-tool-spine is `proven`
  // and says the surface is a spine, NOT a facade). These phrases re-assert the
  // retired facade framing for the public surface; map them to the contradicted
  // empirical-comparison only if they re-assert a non-proven claim. Here they
  // contradict the proven architecture claim, so we track them against a
  // dedicated contradicted marker via emp-30-30-vs-baseline is wrong; instead
  // gate on the proven architecture claim's negation:
  { phrase: '11-tool facade', claim_id: 'arch-11-tool-spine-negation' },
  { phrase: '11 facade tools', claim_id: 'arch-11-tool-spine-negation' },
];

// Phrases that assert the *negation* of a proven claim must always fail if
// present, regardless of any ledger entry. We model this with synthetic
// negation ids that are never `proven`.
const NEGATION_IDS = new Set(['arch-11-tool-spine-negation']);

// Tracked docs to scan (relative to repo root). Only repo docs, no worktrees.
const TRACKED_DOCS = [
  'README.md',
  'PROOF_REPORT.md',
  'CHANGELOG.md',
  'CAPABILITY_MAP.md',
  'ROADMAP.md',
  'benchmark/BENCHMARK.md',
  'docs/ARCHITECTURE_JOURNEY.md',
  'docs/designs/TESTING_AND_VALUE_STRATEGY.md',
  'docs/designs/PROOF_HANDOFF.md',
  'docs/designs/DETERMINISTIC_VALUE_PLAN.md',
  'DEVELOPMENT.md',
  'benchmark/reports/BENCHMARK_REPORT.md',
  'benchmark/reports/BILLING_REPORT.md',
  'benchmark/reports/COMPARISON_REPORT_TEMPLATE.md',
];

const errors = [];

// ---------------------------------------------------------------------------
// Load + validate the ledger.
// ---------------------------------------------------------------------------
function loadLedger() {
  const raw = readFileSync(join(REPO_ROOT, 'CLAIMS_LEDGER.jsonl'), 'utf8');
  const entries = [];
  const lines = raw.split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('#')) return; // allow comment lines
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      errors.push(`Ledger line ${i + 1}: not valid JSON.`);
      return;
    }
    entries.push({ obj, line: i + 1 });
  });
  return entries;
}

function validateLedger(entries) {
  const byId = new Map();
  for (const { obj, line } of entries) {
    const id = obj.claim_id ?? `<line ${line}>`;
    for (const f of REQUIRED_FIELDS) {
      if (!(f in obj)) errors.push(`Claim ${id} (line ${line}): missing required field "${f}".`);
    }
    if (obj.claim_type !== undefined && !VALID_TYPES.has(obj.claim_type)) {
      errors.push(`Claim ${id}: claim_type "${obj.claim_type}" not in {${[...VALID_TYPES].join(', ')}}.`);
    }
    if (obj.status !== undefined && !VALID_STATUS.has(obj.status)) {
      errors.push(`Claim ${id}: status "${obj.status}" not in {${[...VALID_STATUS].join(', ')}}.`);
    }
    if (obj.claim_id !== undefined) {
      if (byId.has(obj.claim_id)) errors.push(`Duplicate claim_id "${obj.claim_id}".`);
      byId.set(obj.claim_id, obj);
    }
    // empirical + proven => non-null evidence_fixture
    if (obj.claim_type === 'empirical' && obj.status === 'proven') {
      if (obj.evidence_fixture === null || obj.evidence_fixture === undefined || obj.evidence_fixture === '') {
        errors.push(`Claim ${id}: empirical claim marked proven but has no evidence_fixture.`);
      }
    }
    // roadmap => status must be planned
    if (obj.claim_type === 'roadmap' && obj.status !== 'planned') {
      errors.push(`Claim ${id}: roadmap claim must have status "planned" (found "${obj.status}").`);
    }
  }

  // marketing => must carry a "supports" array (structural). A marketing claim
  // may only be marked `proven` if its supports cite >=1 empirical+proven
  // claim_id. An honestly-unproven marketing claim (e.g. the north-star claim we
  // are still trying to prove) is allowed to have empty/non-proven support; the
  // tracked-phrases scan separately prevents it from being asserted as fact in
  // any tracked doc. This mirrors the empirical+proven and roadmap+planned rules:
  // the evidence bar binds at the moment the claim is declared proven.
  for (const { obj, line } of entries) {
    if (obj.claim_type !== 'marketing') continue;
    const id = obj.claim_id ?? `<line ${line}>`;
    if (!Array.isArray(obj.supports)) {
      errors.push(`Claim ${id}: marketing claim must have a "supports" array.`);
      continue;
    }
    if (obj.status === 'proven') {
      const provenEmpirical = obj.supports.filter((sid) => {
        const ref = byId.get(sid);
        return ref && ref.claim_type === 'empirical' && ref.status === 'proven';
      });
      if (provenEmpirical.length < 1) {
        errors.push(
          `Claim ${id}: marketing claim marked proven must cite >=1 proven empirical claim_id in ` +
            `"supports" (found supports=[${obj.supports.join(', ')}], none resolve to an empirical+proven entry).`,
        );
      }
    }
  }

  return byId;
}

// ---------------------------------------------------------------------------
// Tracked-phrases scan.
// ---------------------------------------------------------------------------
function scanPhrases(byId) {
  for (const doc of TRACKED_DOCS) {
    let text;
    try {
      text = readFileSync(join(REPO_ROOT, doc), 'utf8');
    } catch {
      continue; // missing doc is not a phrase failure
    }
    for (const { phrase, claim_id } of TRACKED_PHRASES) {
      if (!text.includes(phrase)) continue;
      // Determine the status that gates this phrase.
      let blocked = false;
      let reason = '';
      if (NEGATION_IDS.has(claim_id)) {
        // Asserts the negation of a proven claim -> always blocked.
        blocked = true;
        reason = `asserts the negation of a proven claim (${claim_id.replace('-negation', '')})`;
      } else {
        const entry = byId.get(claim_id);
        if (!entry) {
          blocked = true;
          reason = `references unknown claim_id "${claim_id}"`;
        } else if (entry.status === 'contradicted' || entry.status === 'unproven') {
          blocked = true;
          reason = `ledger status of "${claim_id}" is "${entry.status}"`;
        }
      }
      if (blocked) {
        errors.push(
          `Doc "${doc}" asserts tracked phrase "${phrase}" but ${reason}. ` +
            `Remove or re-scope the claim, or update the ledger once it is proven.`,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
const entries = loadLedger();
const byId = validateLedger(entries);
scanPhrases(byId);

if (errors.length > 0) {
  console.error('claims-ledger check FAILED:\n');
  for (const e of errors) console.error(`  - ${e}`);
  console.error(`\n${errors.length} problem(s) found.`);
  process.exit(1);
}

console.log(`claims-ledger check PASSED: ${entries.length} ledger entries validated, ` +
  `${TRACKED_PHRASES.length} tracked phrases clean across ${TRACKED_DOCS.length} docs.`);
process.exit(0);
