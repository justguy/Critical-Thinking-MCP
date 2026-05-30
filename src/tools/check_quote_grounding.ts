/**
 * check_quote_grounding — verbatim source-span grounding.
 *
 * For every factual claim the agent must copy the EXACT source span it relied on
 * and name a supporting token inside that span. Grounding is decided by substring
 * containment against the SUPPLIED corpus — the strongest unforgeable signal
 * available to a keyless, stateless server.
 *
 * BLOCK (unforgeable, within-request):
 *   - quoted_span not a verbatim (whitespace-normalized) substring of its source
 *   - supporting_token not inside the quoted_span
 *   - claim_kind numeric/date/entity/status: the key token not present in claim_text
 * WARNING:
 *   - claim_kind comparison: comparator token missing from claim_text or span
 *   - source authority_tier/origin metadata (surfaced, never gates)
 * Binding token (NOT a block): source_manifest_hash, per-claim claim_witness.
 *
 * Honest limit: the agent supplies the sources, so this enforces INTERNAL grounding
 * (you copied real text from your own corpus and pointed at the right token), not
 * external truth. No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type {
  BlockingIssue,
  EnforcementContext,
  GroundingClaim,
  SourceManifestEntry,
} from '../enforcement/types.js';
import {
  canonicalJson,
  extractNumericTokens,
  normalizeWhitespace,
  sha256Hex,
} from '../enforcement/utils.js';

const VALID_KINDS = new Set([
  'numeric',
  'date',
  'entity',
  'status',
  'comparison',
  'causal',
  'recommendation',
]);

const COMPARATOR = /(?:[<>]=?|=|\b(?:more|less|greater|fewer|higher|lower|faster|slower)\b)/i;

export interface QuoteGroundingClaimResult {
  claim_id: string;
  grounded: boolean;
  support_strength: 'strong' | 'weak';
  claim_witness: string | null;
  failures: string[];
}

export interface QuoteGroundingOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  grounded_ratio: number;
  source_manifest_hash: string;
  results: QuoteGroundingClaimResult[];
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

function validateInput(input: unknown): {
  sources: SourceManifestEntry[];
  claims: GroundingClaim[];
} {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "sources" (array of {id, text}) and "claims" ' +
        '(array of {claim_id, claim_text, source_id, quoted_span, supporting_token, claim_kind}).',
    );
  }
  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.sources) || obj.sources.length < 1) {
    throw new Error('Missing or empty "sources" array. Provide at least 1 source {id, text}.');
  }
  if (!Array.isArray(obj.claims) || obj.claims.length < 1) {
    throw new Error('Missing or empty "claims" array. Provide at least 1 grounding claim.');
  }

  for (let i = 0; i < obj.sources.length; i++) {
    const s = obj.sources[i] as Record<string, unknown>;
    if (!s || typeof s.id !== 'string' || s.id.length === 0) {
      throw new Error(`Source at index ${i} is missing a valid "id" (string).`);
    }
    if (typeof s.text !== 'string' || s.text.length === 0) {
      throw new Error(`Source "${String(s.id)}" is missing a valid "text" (string).`);
    }
  }

  for (let i = 0; i < obj.claims.length; i++) {
    const c = obj.claims[i] as Record<string, unknown>;
    if (!c || typeof c !== 'object') {
      throw new Error(`Claim at index ${i} is not an object.`);
    }
    for (const field of ['claim_id', 'claim_text', 'source_id', 'quoted_span', 'supporting_token']) {
      if (typeof c[field] !== 'string' || (c[field] as string).length === 0) {
        throw new Error(`Claim at index ${i} is missing a valid "${field}" (string).`);
      }
    }
    if (typeof c.claim_kind !== 'string' || !VALID_KINDS.has(c.claim_kind)) {
      throw new Error(
        `Claim at index ${i} has invalid "claim_kind": "${String(c.claim_kind)}". ` +
          'Must be one of: numeric, date, entity, status, comparison, causal, recommendation.',
      );
    }
  }

  return {
    sources: obj.sources as SourceManifestEntry[],
    claims: obj.claims as GroundingClaim[],
  };
}

/** sha256 over canonical [[id, sha256(normalize(text))], ...] sorted by id. */
export function computeManifestHash(sources: SourceManifestEntry[]): string {
  const entries = sources
    .map(s => [s.id, sha256Hex(normalizeWhitespace(s.text))] as [string, string])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return sha256Hex(canonicalJson(entries));
}

function yearTokens(text: string): string[] {
  return text.match(/\b(?:19|20)\d{2}\b/g) ?? [];
}

export function handleCheckQuoteGrounding(
  input: unknown,
  engine: EnforcementEngine,
): QuoteGroundingOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { sources, claims } = validateInput(input);

  const sourceById = new Map(sources.map(s => [s.id, s]));
  const sourceManifestHash = computeManifestHash(sources);

  const results: QuoteGroundingClaimResult[] = [];
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  for (const claim of claims) {
    const failures: string[] = [];
    const source = sourceById.get(claim.source_id);

    const nSpan = normalizeWhitespace(claim.quoted_span);
    const nToken = normalizeWhitespace(claim.supporting_token);
    const nClaim = normalizeWhitespace(claim.claim_text);

    // (1) source must exist
    if (!source) {
      failures.push(`unknown_source: no source with id "${claim.source_id}"`);
    } else {
      // (2) span must be a verbatim substring of the source
      const nSource = normalizeWhitespace(source.text);
      if (!nSource.includes(nSpan)) {
        failures.push('span_found_failure: quoted_span is not a verbatim substring of its source');
      }
      // (3) supporting_token must be inside the span
      if (!nSpan.includes(nToken)) {
        failures.push('token_in_span_failure: supporting_token is not inside quoted_span');
      }
    }

    // (4) claim_kind support rules — only evaluated if the structural checks held
    let supportStrength: 'strong' | 'weak' = 'strong';
    if (failures.length === 0) {
      switch (claim.claim_kind) {
        case 'numeric': {
          // Compare the cited supporting_token's number (already verified inside the span)
          // against the claim — NOT every number in the span, which can pick up noise like
          // "p99" and mask a real mismatch.
          const tokenNums = extractNumericTokens(nToken);
          const claimNums = new Set(extractNumericTokens(nClaim));
          const shared = tokenNums.length > 0 && tokenNums.some(n => claimNums.has(n));
          if (!shared) {
            failures.push(
              'numeric_mismatch: the supporting_token number does not appear in claim_text',
            );
          }
          break;
        }
        case 'date': {
          const spanYears = new Set(yearTokens(nSpan));
          const claimYears = yearTokens(nClaim);
          const shared = claimYears.some(y => spanYears.has(y));
          if (!shared) {
            failures.push('date_mismatch: no shared year between claim_text and quoted_span');
          }
          break;
        }
        case 'entity':
        case 'status': {
          if (!nClaim.toLowerCase().includes(nToken.toLowerCase())) {
            failures.push(
              `${claim.claim_kind}_not_in_claim: supporting_token does not appear in claim_text`,
            );
          }
          break;
        }
        case 'comparison': {
          if (!(COMPARATOR.test(nClaim) && COMPARATOR.test(nSpan))) {
            warnings.push(
              `Claim "${claim.claim_id}" (comparison): comparator token missing from claim_text or span.`,
            );
          }
          break;
        }
        case 'causal':
        case 'recommendation': {
          // Containment can only establish source proximity for these — never block.
          supportStrength = 'weak';
          break;
        }
      }
    }

    const grounded = failures.length === 0;
    const witness = grounded
      ? sha256Hex(canonicalJson({ claim_id: claim.claim_id, source_id: claim.source_id, span: nSpan }))
      : null;

    results.push({
      claim_id: claim.claim_id,
      grounded,
      support_strength: supportStrength,
      claim_witness: witness,
      failures,
    });

    for (const f of failures) {
      blockingIssues.push({
        mechanism: 'quote_grounding',
        description: `Claim "${claim.claim_id}": ${f}`,
        severity: 'blocking',
      });
    }
  }

  const groundedCount = results.filter(r => r.grounded).length;
  const groundedRatio = results.length === 0 ? 1 : groundedCount / results.length;

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'check_quote_grounding', undefined, context)
    : '';

  const output: QuoteGroundingOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    grounded_ratio: Math.round(groundedRatio * 1000) / 1000,
    source_manifest_hash: sourceManifestHash,
    results,
    context_used: !!context,
  };

  if (hasFail || warnings.length > 0) {
    output.enforcement = {
      blocking_issues: blockingIssues,
      warnings,
      corrective_prompt: correctivePrompt,
    };
  }

  return output;
}
