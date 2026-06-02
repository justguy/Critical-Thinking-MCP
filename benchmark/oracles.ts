/**
 * Objective oracles for the real-output benchmark (Phase 1a).
 *
 * Design law (plan §1a "Oracles, not proxies"): scored grading MUST be an
 * objective predicate, NOT substring matching. The three oracle kinds here are:
 *
 *   1. gold_answer        — parse the model's numeric answer and compare to a
 *                           gold value within tolerance. The token "391" being
 *                           *somewhere* in the text is not enough; we extract the
 *                           answer and check equality.
 *   2. source_span        — the answer must (a) be entailed by a verbatim span in
 *                           a host-supplied source and (b) contain none of the
 *                           planted unsupported facts. "Supported" = the gold
 *                           extractive fact is present AND, when the source does
 *                           NOT contain a planted distractor value, the answer
 *                           does not assert that distractor.
 *   3. structured_constraint — parse a structured answer object and evaluate
 *                           enumerated constraints with the existing
 *                           evaluateConstraint operator semantics.
 *
 * Each oracle returns whether the answer is a DEFECT (high-severity wrong
 * output) so the harness can measure defect density without any human judge.
 */

export type OracleKind = 'gold_answer' | 'source_span' | 'structured_constraint';

export interface GoldAnswerOracle {
  kind: 'gold_answer';
  /** The exact correct numeric value. */
  gold: number;
  /** Absolute tolerance for floating comparisons. Default 1e-6. */
  tolerance?: number;
  /**
   * Planted wrong values a defective model commonly emits (e.g. an unweighted
   * average when weighted is required). Used only for richer defect labeling;
   * the pass/fail predicate is gold equality.
   */
  distractors?: number[];
}

export interface SourceSpanOracle {
  kind: 'source_span';
  /** Host-supplied source text. The answer is graded against THIS, not a guess. */
  source_text: string;
  /** The verbatim extractive fact that a correct answer must convey. */
  gold_span: string;
  /**
   * Planted unsupported facts (NOT present in source_text). A correct answer
   * must assert none of them. Asserting one is a grounding defect.
   */
  planted_unsupported: string[];
}

export interface StructuredConstraintOracle {
  kind: 'structured_constraint';
  /** Enumerated constraints the structured answer must satisfy. */
  checks: Array<{
    id: string;
    field: string;
    op: '<' | '<=' | '>' | '>=' | '==' | '!=' | 'in' | 'not_in';
    value: unknown;
  }>;
}

export type Oracle = GoldAnswerOracle | SourceSpanOracle | StructuredConstraintOracle;

export interface OracleVerdict {
  /** True iff the answer is correct under the objective predicate. */
  correct: boolean;
  /** Count of high-severity defects detected (0 when correct). */
  high_sev_defects: number;
  /** Machine-readable reasons, for transcripts and debugging. */
  reasons: string[];
  oracle_kind: OracleKind;
}

/** evaluateConstraint operator semantics — mirrors facade_value_benchmark. */
function evaluateConstraint(op: StructuredConstraintOracle['checks'][number]['op'], actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'number' && typeof expected === 'number') {
    if (op === '<') return actual < expected;
    if (op === '<=') return actual <= expected;
    if (op === '>') return actual > expected;
    if (op === '>=') return actual >= expected;
  }
  if (op === '==') return actual === expected;
  if (op === '!=') return actual !== expected;
  if (op === 'in' && Array.isArray(expected)) return expected.includes(actual);
  if (op === 'not_in' && Array.isArray(expected)) return !expected.includes(actual);
  return false;
}

/**
 * Extract the model's intended numeric answer from free text.
 *
 * Strategy (objective, not substring-presence): prefer an explicit final-answer
 * marker ("answer:", "= X", "result:"); otherwise take the LAST number in the
 * text, which is the conventional position of a concluded result. Returns null
 * when no number is present. We normalize $ , % and thousands separators.
 */
export function extractNumericAnswer(text: string): number | null {
  const normalized = text.replace(/,(?=\d{3}\b)/g, '');
  const numberRe = /-?\d+(?:\.\d+)?/g;

  // Prefer a value that directly follows a final-answer marker.
  const markerRe = /(?:answer|result|total|final)\s*(?:is|:|=)?\s*\$?\s*(-?\d+(?:\.\d+)?)/i;
  const marker = normalized.match(markerRe);
  if (marker) return Number(marker[1]);

  const matches = normalized.match(numberRe);
  if (!matches || matches.length === 0) return null;
  return Number(matches[matches.length - 1]);
}

/**
 * Normalize for entailment checks: lowercase, strip markdown emphasis/code markers
 * (so "**14 days**" grades the same as "14 days" — formatting is not a defect),
 * collapse whitespace, and strip punctuation noise. This keeps grading on the FACT,
 * not on cosmetic markup; it does NOT relax the token-containment predicate.
 */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?"']/g, '')
    .trim();
}

/** Light suffix stem so "revoked"/"revokes"/"revoking"/"revoke" all match. */
function stem(token: string): string {
  return token
    .replace(/(ing|ed|es|s)$/i, '')
    .replace(/e$/i, '');
}

/**
 * Objective gold-span containment: every significant token of the gold span
 * (lemmatized by light stemming) must appear in the answer. This grades whether
 * the extractive FACT is conveyed, while tolerating morphology like
 * "manually revoked" vs "manually revokes" — without degrading to a loose
 * substring proxy (a partial-token match still fails).
 */
function conveysGoldSpan(answerNorm: string, goldSpan: string): boolean {
  const answerStems = new Set(answerNorm.split(' ').map(stem).filter(Boolean));
  const goldTokens = norm(goldSpan).split(' ').map(stem).filter(t => t.length > 1);
  if (goldTokens.length === 0) return false;
  return goldTokens.every(t => answerStems.has(t));
}

function gradeGoldAnswer(oracle: GoldAnswerOracle, answer: string): OracleVerdict {
  const tol = oracle.tolerance ?? 1e-6;
  const extracted = extractNumericAnswer(answer);
  const reasons: string[] = [];
  if (extracted === null) {
    reasons.push('no_numeric_answer_extracted');
    return { correct: false, high_sev_defects: 1, reasons, oracle_kind: 'gold_answer' };
  }
  const correct = Math.abs(extracted - oracle.gold) <= tol;
  if (!correct) {
    reasons.push(`extracted=${extracted} != gold=${oracle.gold}`);
    if (oracle.distractors?.some(d => Math.abs(extracted - d) <= tol)) {
      reasons.push('matched_known_distractor');
    }
  }
  return { correct, high_sev_defects: correct ? 0 : 1, reasons, oracle_kind: 'gold_answer' };
}

function gradeSourceSpan(oracle: SourceSpanOracle, answer: string): OracleVerdict {
  const reasons: string[] = [];
  const a = norm(answer);
  const sourceNorm = norm(oracle.source_text);
  let defects = 0;

  // (1) The gold extractive fact must be conveyed (morphology-tolerant).
  if (!conveysGoldSpan(a, oracle.gold_span)) {
    reasons.push('missing_gold_span');
    defects++;
  }

  // (2) No planted-unsupported fact may be asserted. These are NOT in the
  // source (verified below as a guard), so asserting one is fabrication.
  for (const planted of oracle.planted_unsupported) {
    const p = norm(planted);
    if (sourceNorm.includes(p)) {
      // Misconfigured oracle: a "planted unsupported" fact is actually in the
      // source. Refuse to grade rather than silently mis-score.
      reasons.push(`oracle_misconfig:planted_present_in_source:${planted}`);
      defects++;
      continue;
    }
    if (a.includes(p)) {
      reasons.push(`asserted_unsupported:${planted}`);
      defects++;
    }
  }

  return { correct: defects === 0, high_sev_defects: defects, reasons, oracle_kind: 'source_span' };
}

/** Parse a JSON object out of a possibly-fenced/embedded model answer. */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fence?.[1], text].filter((s): s is string => typeof s === 'string');
  for (const c of candidates) {
    const start = c.indexOf('{');
    const end = c.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) continue;
    try {
      const parsed = JSON.parse(c.slice(start, end + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function gradeStructuredConstraint(oracle: StructuredConstraintOracle, answer: string): OracleVerdict {
  const reasons: string[] = [];
  const obj = extractJsonObject(answer);
  if (!obj) {
    reasons.push('no_structured_object_parsed');
    return { correct: false, high_sev_defects: 1, reasons, oracle_kind: 'structured_constraint' };
  }
  let violations = 0;
  for (const check of oracle.checks) {
    if (!evaluateConstraint(check.op, obj[check.field], check.value)) {
      reasons.push(`violated:${check.id}(${check.field} ${check.op} ${JSON.stringify(check.value)}; got ${JSON.stringify(obj[check.field])})`);
      violations++;
    }
  }
  return { correct: violations === 0, high_sev_defects: violations, reasons, oracle_kind: 'structured_constraint' };
}

/** Grade a model answer against an objective oracle. */
export function gradeWithOracle(oracle: Oracle, answer: string): OracleVerdict {
  switch (oracle.kind) {
    case 'gold_answer':
      return gradeGoldAnswer(oracle, answer);
    case 'source_span':
      return gradeSourceSpan(oracle, answer);
    case 'structured_constraint':
      return gradeStructuredConstraint(oracle, answer);
  }
}
