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
  GroundingLevel,
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
const DATE_WORD = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
const NEGATION = String.raw`(?:not|never|no|without|cannot|can't|do\s+not|does\s+not|did\s+not|is\s+not|are\s+not|was\s+not|were\s+not)`;

interface PredicateValue {
  value: string;
  phrases: string[];
}

interface PredicateClass {
  label: string;
  values: PredicateValue[];
}

const PREDICATE_CLASSES: PredicateClass[] = [
  {
    label: 'thread_model',
    values: [
      { value: 'single-threaded', phrases: ['single-threaded', 'single threaded'] },
      { value: 'multi-threaded', phrases: ['multi-threaded', 'multi threaded', 'multithreaded'] },
    ],
  },
  {
    label: 'support_status',
    values: [
      { value: 'supported', phrases: ['supported'] },
      { value: 'unsupported', phrases: ['unsupported', 'not supported'] },
      { value: 'deprecated', phrases: ['deprecated'] },
      { value: 'removed', phrases: ['removed', 'retired'] },
    ],
  },
  {
    label: 'enabled_state',
    values: [
      { value: 'enabled', phrases: ['enabled'] },
      { value: 'disabled', phrases: ['disabled'] },
    ],
  },
  {
    label: 'availability',
    values: [
      { value: 'available', phrases: ['available'] },
      { value: 'unavailable', phrases: ['unavailable', 'not available'] },
    ],
  },
  {
    label: 'result_status',
    values: [
      { value: 'passed', phrases: ['passed', 'passes', 'succeeded', 'success'] },
      { value: 'failed', phrases: ['failed', 'fails', 'failure'] },
    ],
  },
  {
    label: 'direction',
    values: [
      { value: 'increased', phrases: ['increased', 'higher', 'more', 'rose', 'rises'] },
      { value: 'decreased', phrases: ['decreased', 'lower', 'less', 'fell', 'falls'] },
    ],
  },
  {
    label: 'requirement',
    values: [
      { value: 'required', phrases: ['required'] },
      { value: 'optional', phrases: ['optional'] },
    ],
  },
];

const TIME_UNIT_CLASSES: PredicateValue[] = [
  { value: 'second', phrases: ['second', 'seconds', 'sec', 'secs'] },
  { value: 'minute', phrases: ['minute', 'minutes', 'min', 'mins'] },
  { value: 'hour', phrases: ['hour', 'hours', 'hr', 'hrs'] },
  { value: 'day', phrases: ['day', 'days', 'daily'] },
  { value: 'week', phrases: ['week', 'weeks', 'weekly'] },
  { value: 'month', phrases: ['month', 'months', 'monthly'] },
  { value: 'year', phrases: ['year', 'years', 'yearly', 'annual', 'annually'] },
];

const ENTITY_LEADING_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'for',
  'in',
  'it',
  'on',
  'or',
  'source',
  'that',
  'the',
  'these',
  'this',
  'those',
]);
const ENTITY_GENERIC_WORDS = new Set([
  'api',
  'app',
  'client',
  'database',
  'endpoint',
  'feature',
  'flow',
  'job',
  'model',
  'pipeline',
  'plan',
  'platform',
  'process',
  'product',
  'project',
  'release',
  'service',
  'server',
  'system',
  'task',
  'team',
  'tool',
  'version',
]);
const ENTITY_DATE_WORDS = new Set([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]);

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

function hasNumericToken(text: string): boolean {
  return extractNumericTokens(text).length > 0;
}

function hasDateToken(text: string): boolean {
  return yearTokens(text).length > 0 || DATE_WORD.test(text);
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phrasePattern(phrase: string): RegExp {
  const parts = phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(escapeRegex);
  return new RegExp(String.raw`\b${parts.join(String.raw`[\s-]+`)}\b`, 'i');
}

function hasPhrase(text: string, phrase: string): boolean {
  return phrasePattern(phrase).test(text);
}

function valuesPresent(text: string, values: PredicateValue[]): Set<string> {
  const present = new Set<string>();
  for (const value of values) {
    if (value.phrases.some(phrase => hasPhrase(text, phrase))) {
      present.add(value.value);
    }
  }
  return present;
}

function hasOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function describeValues(values: Set<string>): string {
  return [...values].sort().join(', ');
}

function predicateTerms(): string[] {
  const terms = new Set<string>();
  for (const cls of PREDICATE_CLASSES) {
    for (const value of cls.values) {
      for (const phrase of value.phrases) terms.add(phrase);
    }
  }
  return [...terms].sort((a, b) => b.length - a.length);
}

const PREDICATE_TERMS = predicateTerms();

function isNegatedNear(text: string, phrase: string): boolean {
  const parts = phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(escapeRegex);
  if (parts.length === 0) return false;
  const phraseBody = parts.join(String.raw`[\s-]+`);
  const before = new RegExp(String.raw`\b${NEGATION}\b(?:\W+\w+){0,3}\W+${phraseBody}\b`, 'i');
  const after = new RegExp(String.raw`\b${phraseBody}\b(?:\W+\w+){0,3}\W+\b${NEGATION}\b`, 'i');
  return before.test(text) || after.test(text);
}

function contrastFailures(claimText: string, spanText: string): string[] {
  const failures: string[] = [];
  for (const cls of PREDICATE_CLASSES) {
    const claimValues = valuesPresent(claimText, cls.values);
    const spanValues = valuesPresent(spanText, cls.values);
    if (claimValues.size > 0 && spanValues.size > 0 && !hasOverlap(claimValues, spanValues)) {
      failures.push(
        `predicate_mismatch:${cls.label}: claim_text has "${describeValues(claimValues)}" but quoted_span has "${describeValues(spanValues)}"`,
      );
    }
  }
  return failures;
}

function negationFailures(claimText: string, spanText: string): string[] {
  const failures: string[] = [];
  for (const phrase of PREDICATE_TERMS) {
    if (!hasPhrase(claimText, phrase) || !hasPhrase(spanText, phrase)) continue;
    const claimNegated = isNegatedNear(claimText, phrase);
    const spanNegated = isNegatedNear(spanText, phrase);
    if (claimNegated !== spanNegated) {
      failures.push(
        `predicate_negation_mismatch: "${phrase}" is ${claimNegated ? '' : 'not '}negated in claim_text but ${spanNegated ? '' : 'not '}negated in quoted_span`,
      );
    }
  }
  return failures;
}

function temporalUnitFailures(claimText: string, spanText: string): string[] {
  const claimUnits = valuesPresent(claimText, TIME_UNIT_CLASSES);
  const spanUnits = valuesPresent(spanText, TIME_UNIT_CLASSES);
  if (claimUnits.size === 0 || spanUnits.size === 0 || hasOverlap(claimUnits, spanUnits)) {
    return [];
  }
  return [
    `temporal_unit_mismatch: claim_text has "${describeValues(claimUnits)}" but quoted_span has "${describeValues(spanUnits)}"`,
  ];
}

function normalizeEntityPhrase(raw: string): string | null {
  const words = raw
    .split(/\s+/)
    .map(w => w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.]+$/g, ''))
    .filter(Boolean);
  while (words.length > 0 && ENTITY_LEADING_STOPWORDS.has(words[0].toLowerCase())) {
    words.shift();
  }
  if (words.length === 0) return null;
  const lowered = words.map(w => w.toLowerCase());
  if (lowered.every(w => ENTITY_LEADING_STOPWORDS.has(w) || ENTITY_GENERIC_WORDS.has(w) || ENTITY_DATE_WORDS.has(w))) {
    return null;
  }
  if (lowered.length === 1 && lowered[0].length < 3) return null;
  if (lowered.length === 1 && ENTITY_DATE_WORDS.has(lowered[0])) return null;
  return lowered.join(' ');
}

function extractEntityPhrases(text: string): Set<string> {
  const entities = new Set<string>();
  const quoted = /[`"']([^`"']{2,80})[`"']/g;
  let match: RegExpExecArray | null;
  while ((match = quoted.exec(text)) !== null) {
    const phrase = normalizeEntityPhrase(match[1]);
    if (phrase) entities.add(phrase);
  }

  const capitalized = /\b(?:[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)?|[A-Z]{2,})(?:\s+(?:[A-Z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)?|[A-Z]{2,}))*\b/g;
  while ((match = capitalized.exec(text)) !== null) {
    const phrase = normalizeEntityPhrase(match[0]);
    if (phrase) entities.add(phrase);
  }
  return entities;
}

function entityContentTokens(entity: string): Set<string> {
  return new Set(
    entity
      .split(/\s+/)
      .filter(token => !ENTITY_GENERIC_WORDS.has(token) && !ENTITY_LEADING_STOPWORDS.has(token) && !ENTITY_DATE_WORDS.has(token)),
  );
}

function entitiesOverlap(a: string, b: string): boolean {
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const aTokens = entityContentTokens(a);
  const bTokens = entityContentTokens(b);
  for (const token of aTokens) {
    if (bTokens.has(token)) return true;
  }
  return false;
}

function entityFailures(claimText: string, spanText: string): string[] {
  const claimEntities = extractEntityPhrases(claimText);
  const spanEntities = extractEntityPhrases(spanText);
  if (claimEntities.size === 0 || spanEntities.size === 0) return [];

  for (const claimEntity of claimEntities) {
    for (const spanEntity of spanEntities) {
      if (entitiesOverlap(claimEntity, spanEntity)) return [];
    }
  }

  return [
    `entity_mismatch: claim_text entity "${describeValues(claimEntities)}" is not supported by quoted_span entity "${describeValues(spanEntities)}"`,
  ];
}

function predicateGroundingFailures(claimText: string, spanText: string, claimKind: string): string[] {
  if (claimKind === 'causal' || claimKind === 'recommendation') return [];
  return [
    ...entityFailures(claimText, spanText),
    ...contrastFailures(claimText, spanText),
    ...negationFailures(claimText, spanText),
    ...temporalUnitFailures(claimText, spanText),
  ];
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
      const effectiveKinds = new Set([claim.claim_kind]);
      const dateLike = hasDateToken(nClaim);
      if (hasNumericToken(nClaim) && !dateLike) effectiveKinds.add('numeric');
      if (dateLike) effectiveKinds.add('date');

      for (const kind of effectiveKinds) {
        switch (kind) {
          case 'numeric': {
          // Compare the cited supporting_token's number (already verified inside the span)
          // against the claim — NOT every number in the span, which can pick up noise like
          // "p99" and mask a real mismatch.
          const tokenNums = extractNumericTokens(nToken);
          const claimNums = extractNumericTokens(nClaim);
          const spanNums = new Set(extractNumericTokens(nSpan));
          const tokenShared = tokenNums.length > 0 && tokenNums.some(n => claimNums.includes(n));
          const allClaimNumsInSpan = claimNums.length > 0 && claimNums.every(n => spanNums.has(n));
          if (!tokenShared || !allClaimNumsInSpan) {
            failures.push(
              'numeric_mismatch: the supporting_token number and all claim_text numbers must appear in the quoted_span',
            );
          }
          break;
          }
          case 'date': {
          const spanYears = new Set(yearTokens(nSpan));
          const claimYears = yearTokens(nClaim);
          const sharedYear = claimYears.length === 0 || claimYears.some(y => spanYears.has(y));
          const sharedMonth = !DATE_WORD.test(nClaim) || (nSpan.match(DATE_WORD)?.[0]?.toLowerCase() === nClaim.match(DATE_WORD)?.[0]?.toLowerCase());
          if (!sharedYear || !sharedMonth) {
            failures.push('date_mismatch: no shared year between claim_text and quoted_span');
          }
          break;
          }
          case 'entity':
          case 'status': {
          if (!nClaim.toLowerCase().includes(nToken.toLowerCase())) {
            failures.push(
              `${kind}_not_in_claim: supporting_token does not appear in claim_text`,
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

      for (const failure of predicateGroundingFailures(nClaim, nSpan, claim.claim_kind)) {
        failures.push(failure);
      }
    }

    const grounded = failures.length === 0;
    const witness = grounded
      ? sha256Hex(canonicalJson({
          claim_id: claim.claim_id,
          claim_text: nClaim,
          claim_kind: claim.claim_kind,
          source_id: claim.source_id,
          span: nSpan,
        }))
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

// ─── §4 strong-vs-weak source-span grounding gate ──────────────────────────────
//
// The plan (§4) splits grounding into two levels:
//   strong_grounding (exact quote/number/date/entity/extractive fact) → deterministic
//     proof → MAY BLOCK on a span mismatch.
//   weak_grounding (paraphrase/synthesis/interpretation/causal/recommendation) →
//     advisory or labeled → NEVER blocks.
//
// handleCheckQuoteGrounding already decides, per claim, whether the cited span
// verbatim-supports the claim (the `failures`/`grounded` fields) — the unforgeable
// substring/number/date/entity comparison. This gate REUSES that result and decides
// block-vs-advisory purely by the artifact-schema `grounding_level` (§4) the caller
// supplies per claim: a STRONG claim whose span fails to support it BLOCKS; a WEAK
// claim's failures are downgraded to warnings, NEVER blocking.
//
// HARD CONSTRAINT (§4 / task): weak/semantic grounding can only warn/label. This gate
// has no path that emits a blocking issue for a weak claim.

/** A grounding claim annotated with its §4 grounding level (from the artifact schema). */
export interface LeveledGroundingClaim extends GroundingClaim {
  grounding_level: GroundingLevel;
}

export interface StrongGroundingResult {
  /** True when every STRONG-grounded claim is verbatim-supported by its cited span. */
  strong_grounding_satisfied: boolean;
  blocking_issues: BlockingIssue[];
  warnings: string[];
  /** Per-claim audit: its level, whether the span supported it, and whether it blocked. */
  evaluated: Array<{
    claim_id: string;
    grounding_level: GroundingLevel;
    grounded: boolean;
    blocked: boolean;
  }>;
}

/**
 * §4 gate: STRONG grounding BLOCKs on span mismatch; WEAK grounding is advisory.
 *
 * Runs handleCheckQuoteGrounding once, then partitions its per-claim results by the
 * caller-supplied grounding_level. STRONG failures become blocking issues
 * (SOURCE_SPAN_MISMATCH via the `quote_grounding` mechanism); WEAK failures become
 * warnings only — there is structurally no way for this function to block a weak claim.
 */
export function checkStrongGrounding(
  sources: SourceManifestEntry[],
  claims: LeveledGroundingClaim[],
  engine: EnforcementEngine,
): StrongGroundingResult {
  const grounding = handleCheckQuoteGrounding({ sources, claims }, engine);
  const resultById = new Map(grounding.results.map(r => [r.claim_id, r]));

  const blocking_issues: BlockingIssue[] = [];
  const warnings: string[] = [];
  const evaluated: StrongGroundingResult['evaluated'] = [];

  for (const claim of claims) {
    const result = resultById.get(claim.claim_id);
    const grounded = result?.grounded ?? false;
    const failures = result?.failures ?? [];

    if (claim.grounding_level === 'weak') {
      // §4 HARD CONSTRAINT: weak grounding NEVER blocks — failures are advisory only.
      for (const f of failures) {
        warnings.push(`Weak-grounded claim "${claim.claim_id}" (advisory, not blocking): ${f}`);
      }
      evaluated.push({ claim_id: claim.claim_id, grounding_level: 'weak', grounded, blocked: false });
      continue;
    }

    // STRONG grounding: a span that fails to verbatim-support the claim BLOCKS.
    if (!grounded) {
      for (const f of failures) {
        blocking_issues.push({
          mechanism: 'quote_grounding',
          description: `Strong-grounded claim "${claim.claim_id}": ${f}`,
          severity: 'blocking',
        });
      }
    }
    evaluated.push({
      claim_id: claim.claim_id,
      grounding_level: 'strong',
      grounded,
      blocked: !grounded,
    });
  }

  return {
    strong_grounding_satisfied: blocking_issues.length === 0,
    blocking_issues,
    warnings,
    evaluated,
  };
}
