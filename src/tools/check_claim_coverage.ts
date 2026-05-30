/**
 * check_claim_coverage — the coverage counterpart to grounding-quality.
 *
 * ADVISORY / never blocks on its own. It reports:
 *   - declared_claim_coverage: of the declared claims, how many have a grounding pass
 *     (the caller supplies grounding_results; this is self-reported, hence advisory).
 *   - auto_detected_unaccounted_claims: claim-like spans in answer_text that map to NO
 *     declared claim — WARNING only, with aggressive stop-listing to avoid lint fatigue.
 *
 * The UNFORGEABLE coverage gate (every contract claim must actually ground) lives in
 * finalize_deliverable, which RE-RUNS grounding. Regex-extracted claims never drive a
 * BLOCK. No LLM calls.
 */

import type { EnforcementContext, ContractClaim } from '../enforcement/types.js';
import { normalizeWhitespace } from '../enforcement/utils.js';

export interface UnaccountedClaim {
  span: string;
  reason: string;
  severity: 'warning';
}

export interface ClaimCoverageOutput {
  status: 'PASS';
  declared_claim_coverage: number | null;
  auto_detected_unaccounted_claims: UnaccountedClaim[];
  coverage_honest_limit: string;
  context_used: boolean;
  enforcement?: { blocking_issues: never[]; warnings: string[]; corrective_prompt: string };
}

interface GroundingResult {
  claim_id: string;
  grounded: boolean;
}

function validateInput(input: unknown): {
  claims: ContractClaim[];
  grounding_results: GroundingResult[];
  answer_text: string;
} {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "claims" (array of {id, text}), optional "grounding_results" ' +
        '(array of {claim_id, grounded}), and "answer_text" (string).',
    );
  }
  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.claims)) {
    throw new Error('Missing "claims" array (each {id, text}).');
  }
  if (typeof obj.answer_text !== 'string' || obj.answer_text.length < 1) {
    throw new Error('Missing "answer_text" (non-empty string).');
  }
  const grounding = Array.isArray(obj.grounding_results)
    ? (obj.grounding_results as GroundingResult[])
    : [];

  return {
    claims: obj.claims as ContractClaim[],
    grounding_results: grounding,
    answer_text: obj.answer_text,
  };
}

// Numbers that are almost never factual claims — skip them to avoid lint fatigue.
const STOPLISTED_NUMBER = /\b(?:step|section|sec|figure|fig|q|v|version|chapter|ch|page|p|no|note|item|part)\.?\s*\d/i;
const ORDINAL = /\b\d+(?:st|nd|rd|th)\b/i;

/** Conservative claim-like span extraction: real numbers + years + multi-word proper nouns. */
function extractClaimLikeSpans(text: string): { span: string; reason: string }[] {
  const spans: { span: string; reason: string }[] = [];

  // Numbers with units / percentages / currency — the high-signal subset.
  const numberish = text.match(/(?:\$\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?%|\b\d[\d,]*(?:\.\d+)?\b)/g) ?? [];
  for (const m of numberish) {
    const idx = text.indexOf(m);
    const window = text.slice(Math.max(0, idx - 12), idx + m.length);
    if (STOPLISTED_NUMBER.test(window) || ORDINAL.test(m)) continue;
    spans.push({ span: m.trim(), reason: 'number_or_percentage' });
  }

  // Multi-word proper nouns (a weak entity signal).
  const propers = text.match(/\b(?:[A-Z][a-z]+)(?:\s+[A-Z][a-z]+){1,2}\b/g) ?? [];
  for (const m of propers) {
    spans.push({ span: m, reason: 'named_entity' });
  }

  // Dedupe by span text.
  const seen = new Set<string>();
  return spans.filter(s => {
    const key = s.span.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function handleCheckClaimCoverage(input: unknown): ClaimCoverageOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { claims, grounding_results, answer_text } = validateInput(input);

  // declared coverage from supplied (self-reported) grounding results.
  let declaredCoverage: number | null = null;
  if (claims.length > 0) {
    const groundedIds = new Set(
      grounding_results.filter(g => g.grounded).map(g => g.claim_id),
    );
    const covered = claims.filter(c => groundedIds.has(c.id)).length;
    declaredCoverage = Math.round((covered / claims.length) * 1000) / 1000;
  }

  // auto-detected unaccounted claims (WARNING only).
  const declaredText = normalizeWhitespace(claims.map(c => c.text).join(' ')).toLowerCase();
  const unaccounted: UnaccountedClaim[] = [];
  for (const cand of extractClaimLikeSpans(answer_text)) {
    if (!declaredText.includes(cand.span.toLowerCase())) {
      unaccounted.push({ span: cand.span, reason: cand.reason, severity: 'warning' });
    }
  }

  const warnings: string[] = [];
  if (declaredCoverage !== null && declaredCoverage < 1) {
    warnings.push(
      `Declared-claim coverage is ${declaredCoverage} (self-reported). ` +
        'finalize_deliverable will re-verify by re-running grounding.',
    );
  }
  if (unaccounted.length > 0) {
    warnings.push(
      `${unaccounted.length} claim-like span(s) in the answer map to no declared claim: ` +
        unaccounted.slice(0, 5).map(u => `"${u.span}"`).join(', ') +
        (unaccounted.length > 5 ? ' …' : '') + '.',
    );
  }

  const output: ClaimCoverageOutput = {
    status: 'PASS',
    declared_claim_coverage: declaredCoverage,
    auto_detected_unaccounted_claims: unaccounted,
    coverage_honest_limit:
      'Declared claims only. Proves declared claims were grounded (if grounding_results are trustworthy); ' +
      'does NOT prove the claim list is complete. The agent authors the claim list.',
    context_used: !!context,
  };

  if (warnings.length > 0) {
    output.enforcement = { blocking_issues: [], warnings, corrective_prompt: '' };
  }

  return output;
}
