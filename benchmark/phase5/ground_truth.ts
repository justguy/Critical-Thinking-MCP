/**
 * Phase 5 — the GATE-INDEPENDENT ground-truth predicate.
 *
 * This is the linchpin of the experiment's non-circularity (PHASE5_PREREGISTRATION
 * §1, §5): it decides whether a deliverable meets a host contract's OBJECTIVE
 * requirement by reading the contract + artifacts DIRECTLY — it NEVER calls
 * ct-enforce / enforceDeliverable / finalize_deliverable. The run_gate / run_realism
 * arms then check whether the REAL gate AGREES with this independent judgement.
 *
 * It re-implements the objective host checks in plain, auditable code:
 *   - must_include present / must_not_include absent (exact substring),
 *   - required_fields present in the structured answer,
 *   - constraint predicates hold on the structured answer,
 *   - the controlling total reconciles (the `==` constraint, or — for the numeric
 *     DAG form — the declared final equals the summed inputs),
 *   - each contract claim is grounded by a VERBATIM span in a non-agent source,
 *   - dated sources are within the freshness window vs the host eval_time.
 *
 * Deliberately SIMPLE and independent: a constraint operator subset, substring
 * containment, and interval arithmetic — nothing imported from the enforcement
 * engine. PURE, no I/O, no model calls.
 */

import type { ContractSpec, DeliverableArtifacts } from '../../src/host/enforcement_host.js';

export interface GroundTruthVerdict {
  /** True iff the deliverable meets EVERY objective requirement in the contract. */
  satisfies: boolean;
  /** The requirement classes this deliverable breaks (empty when satisfies=true). */
  failures: string[];
}

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return null;
}

function scalarEq(a: unknown, b: unknown): boolean {
  const na = toNum(a);
  const nb = toNum(b);
  if (na !== null && nb !== null) return na === nb;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function parseInstant(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^-?\d+$/.test(t)) return Number(t);
    if (!t.includes('T') || !/(?:Z|[+-]\d{2}:?\d{2})$/.test(t)) return null;
    const ms = Date.parse(t);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** Evaluate one host constraint predicate against the structured answer. */
function constraintHolds(
  op: string,
  actual: unknown,
  expected: unknown,
): boolean {
  switch (op) {
    case '==':
      return scalarEq(actual, expected);
    case '!=':
      return !scalarEq(actual, expected);
    case '<':
    case '<=':
    case '>':
    case '>=': {
      const a = toNum(actual);
      const b = toNum(expected);
      if (a === null || b === null) return false;
      if (op === '<') return a < b;
      if (op === '<=') return a <= b;
      if (op === '>') return a > b;
      return a >= b;
    }
    case 'in':
      return Array.isArray(expected) && expected.some(e => scalarEq(actual, e));
    case 'not_in':
      return Array.isArray(expected) && !expected.some(e => scalarEq(actual, e));
    case 'subset_of':
      return (
        Array.isArray(expected) &&
        Array.isArray(actual) &&
        actual.every(x => expected.some(e => scalarEq(x, e)))
      );
    default:
      return false;
  }
}

/**
 * Grade a deliverable against a host contract by READING THE CONTRACT + ARTIFACTS
 * DIRECTLY — independent of ct-enforce. Returns whether it satisfies every objective
 * requirement and, if not, which classes it breaks.
 */
export function gradeAgainstContract(
  contract: ContractSpec,
  artifacts: DeliverableArtifacts,
  eval_time?: { value: string; authority: 'host' | 'agent' },
): GroundTruthVerdict {
  const failures: string[] = [];
  const answer = norm(artifacts.answer_text ?? '');
  const structured = (artifacts.structured_answer ?? {}) as Record<string, unknown>;

  // must_include / must_not_include (exact substring on answer_text).
  for (const inc of contract.must_include ?? []) {
    if (!answer.includes(norm(inc))) failures.push(`missing_must_include:${inc}`);
  }
  for (const exc of contract.must_not_include ?? []) {
    if (answer.includes(norm(exc))) failures.push(`asserted_excluded_fact:${exc}`);
  }

  // required_fields present in the structured answer.
  for (const f of contract.required_fields ?? []) {
    if (!Object.prototype.hasOwnProperty.call(structured, f)) {
      failures.push(`missing_required_field:${f}`);
    }
  }

  // constraint predicates hold on the structured answer (a missing field also fails).
  for (const c of contract.constraints ?? []) {
    if (!Object.prototype.hasOwnProperty.call(structured, c.field)) {
      failures.push(`broken_constraint:${c.field}:field_absent`);
      continue;
    }
    if (!constraintHolds(c.op, structured[c.field], (c as { value: unknown }).value)) {
      failures.push(`broken_constraint:${c.field}`);
    }
  }

  // Numeric-DAG reconciliation (the heavy financial form): the declared final must
  // equal the op over its input nodes. We re-derive sum here ONLY (the corpus uses
  // sum); a non-reconciling final is a genuine unreconciled total.
  const dag = artifacts.numeric_derivation as
    | { nodes?: Array<Record<string, unknown>> }
    | undefined;
  if (dag && Array.isArray(dag.nodes)) {
    const byId = new Map<string, Record<string, unknown>>();
    for (const n of dag.nodes) if (typeof n.id === 'string') byId.set(n.id, n);
    for (const n of dag.nodes) {
      if (n.role === 'final' && n.op === 'sum' && Array.isArray(n.input_refs)) {
        let sum = 0;
        let ok = true;
        for (const ref of n.input_refs as unknown[]) {
          const node = typeof ref === 'string' ? byId.get(ref) : undefined;
          const val = node ? toNum(node.value) : null;
          if (val === null) {
            ok = false;
            break;
          }
          sum += val;
        }
        const declared = toNum(n.value);
        if (ok && declared !== null && Math.abs(sum - declared) > 0.005) {
          failures.push(`unreconciled_total:${String(n.id)}`);
        }
      }
    }
  }

  // Claim grounding: every contract claim must be backed by a VERBATIM span in a
  // non-agent source the deliverable supplied. (Independent re-implementation of the
  // substring-containment grounding signal.)
  const sources = artifacts.sources ?? [];
  const claimRecords = (artifacts.claims ?? []) as Array<{
    claim_id?: string;
    quoted_span?: string;
    source_id?: string;
  }>;
  for (const cc of contract.claims ?? []) {
    const records = claimRecords.filter(r => r.claim_id === cc.id);
    const grounded = records.some(r => {
      const span = norm(r.quoted_span ?? '');
      if (span.length === 0) return false;
      const src = sources.find(s => s.id === r.source_id);
      if (!src || src.origin === 'agent_supplied' || typeof src.text !== 'string') return false;
      return norm(src.text).includes(span);
    });
    if (!grounded) failures.push(`ungrounded_claim:${cc.id}`);
  }

  // Freshness: dated sources within the host window vs the host eval_time.
  if (contract.freshness && eval_time?.authority === 'host') {
    const evalMs = parseInstant(eval_time.value);
    if (evalMs !== null) {
      for (const s of sources) {
        if (s.published_at === undefined) {
          if (contract.freshness.requires_dated_sources) failures.push(`stale_source:${s.id}:undated`);
          continue;
        }
        const pub = parseInstant(s.published_at);
        if (pub === null) continue;
        const ageSec = (evalMs - pub) / 1000;
        if (ageSec > contract.freshness.max_age_seconds) failures.push(`stale_source:${s.id}`);
      }
    }
  }

  return { satisfies: failures.length === 0, failures };
}
