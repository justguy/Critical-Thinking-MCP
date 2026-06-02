/**
 * drift_detector — FINAL-ANSWER ↔ ARTIFACT drift (§3.2, §5, §7), the highest-value gate.
 *
 * The renderer (answer_renderer.ts) projects the bound artifact ledger into answer
 * text and exposes, per material field, a RenderedFieldBinding {rendered_value,
 * source_artifact, trust_tier}. It deliberately did NOT compare. This module
 * implements the comparison: a rendered field DRIFTS when the value the model
 * surfaced disagrees with the source artifact it claims to project. Drift BLOCKS
 * with FINAL_ANSWER_ARTIFACT_DRIFT (§7).
 *
 * No-Semantic-Miracle test (§2) — this gate answers all five:
 *   1. Defect class: the rendered answer contradicts its own checked artifact
 *      (derivation says 14250, answer says 14520; span says "annually", answer
 *      says "monthly"; recommendation != the artifact's winning option).
 *   2. Objective predicate: numeric-token equality / closed-vocabulary value
 *      contradiction / option-id set membership — all decidable substring/number
 *      comparisons, no entailment.
 *   3. False block on a correct answer: avoided by only firing when BOTH sides
 *      carry a comparable signal AND they contradict on a CLOSED vocabulary
 *      (mutually-exclusive value sets) — paraphrase/re-wording never trips it.
 *   4. Could a prompted checklist do this? No — it requires the structured binding
 *      back to the artifact the value claims to project from.
 *   5. Does the answer bind to the artifact? Yes — that binding IS the input.
 *
 * HARD CONSTRAINT (§4): a WEAK-grounded / judgment / interpretation field is NEVER
 * compared here — interpretation legitimately restates a source in different terms.
 * Drift only blocks fields that assert they project a value verbatim.
 *
 * Pure. Deterministic. No LLM, no state.
 */

import type { Artifact, ArtifactBundle, BlockingIssue } from './types.js';
import type { RenderedFieldBinding } from './answer_renderer.js';
import { extractNumericTokens, normalizeWhitespace } from './utils.js';

/**
 * Closed, mutually-exclusive value vocabularies. Drift only fires when the rendered
 * value and the source artifact each name a DIFFERENT value from the SAME class —
 * a falsifiable contradiction, not a paraphrase. Mirrors the (private) predicate /
 * temporal-unit classes check_quote_grounding uses for span grounding, restricted to
 * the contradiction direction (no entailment claims).
 */
interface ValueClass {
  label: string;
  values: { value: string; phrases: string[] }[];
}

const CADENCE_CLASS: ValueClass = {
  label: 'cadence',
  values: [
    { value: 'second', phrases: ['second', 'seconds', 'per second'] },
    { value: 'minute', phrases: ['minute', 'minutes', 'per minute'] },
    { value: 'hour', phrases: ['hour', 'hours', 'hourly', 'per hour'] },
    { value: 'day', phrases: ['day', 'days', 'daily', 'per day'] },
    { value: 'week', phrases: ['week', 'weeks', 'weekly', 'per week'] },
    { value: 'month', phrases: ['month', 'months', 'monthly', 'per month'] },
    { value: 'quarter', phrases: ['quarter', 'quarters', 'quarterly', 'per quarter'] },
    { value: 'year', phrases: ['year', 'years', 'yearly', 'annual', 'annually', 'per year', 'per annum'] },
  ],
};

const DRIFT_VALUE_CLASSES: readonly ValueClass[] = [
  CADENCE_CLASS,
  {
    label: 'direction',
    values: [
      { value: 'increase', phrases: ['increase', 'increased', 'higher', 'rose', 'up', 'growth', 'gain'] },
      { value: 'decrease', phrases: ['decrease', 'decreased', 'lower', 'fell', 'down', 'decline', 'reduction'] },
    ],
  },
  {
    label: 'polarity',
    values: [
      { value: 'supported', phrases: ['supported', 'available', 'enabled'] },
      { value: 'unsupported', phrases: ['unsupported', 'not supported', 'unavailable', 'not available', 'disabled', 'deprecated', 'removed'] },
    ],
  },
];

/** ISO-ish currency symbols / codes that, when present on both sides, must agree. */
const CURRENCY_TOKENS: readonly { value: string; phrases: string[] }[] = [
  { value: 'USD', phrases: ['$', 'usd', 'dollar', 'dollars'] },
  { value: 'EUR', phrases: ['€', 'eur', 'euro', 'euros'] },
  { value: 'GBP', phrases: ['£', 'gbp', 'pound', 'pounds', 'sterling'] },
  { value: 'JPY', phrases: ['¥', 'jpy', 'yen'] },
];

function phraseRegex(phrase: string): RegExp {
  // Symbol phrases ($, €) have no word boundary; word phrases get \b … \b.
  if (/^[^a-z0-9]+$/i.test(phrase)) {
    return new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  const body = phrase
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join(String.raw`[\s-]+`);
  return new RegExp(String.raw`\b${body}\b`, 'i');
}

function valuesPresent(text: string, klass: readonly { value: string; phrases: string[] }[]): Set<string> {
  const present = new Set<string>();
  for (const entry of klass) {
    if (entry.phrases.some(p => phraseRegex(p).test(text))) present.add(entry.value);
  }
  return present;
}

function disjoint(a: Set<string>, b: Set<string>): boolean {
  for (const v of a) if (b.has(v)) return false;
  return true;
}

function describe(values: Set<string>): string {
  return [...values].sort().join(', ');
}

/** The text the artifact projects — its rendered text / quoted span / option name. */
function artifactText(artifact: Artifact): string {
  return artifact.quoted_span ?? artifact.text ?? '';
}

/**
 * Numeric drift: every number the rendered value asserts must appear in the source
 * artifact's text. Fires only when the rendered value carries ≥1 number AND the
 * artifact carries ≥1 number — so a paraphrase that drops the figure does not
 * trip it (that is a coverage concern, not drift). 14520 vs derivation 14250 → drift.
 */
function numericDriftReason(rendered: string, artifact: string): string | null {
  const renderedNums = extractNumericTokens(rendered);
  const artifactNums = new Set(extractNumericTokens(artifact));
  if (renderedNums.length === 0 || artifactNums.size === 0) return null;
  const mismatched = renderedNums.filter(n => !artifactNums.has(n));
  if (mismatched.length === 0) return null;
  return `rendered number(s) [${mismatched.join(', ')}] do not appear in the source artifact (artifact has [${[...artifactNums].join(', ')}])`;
}

/**
 * Closed-vocabulary drift: the rendered value and the artifact each name a value
 * from the SAME class, and the sets are disjoint (e.g. "monthly" vs "annually").
 * Disjoint-only ⇒ a correct answer that merely adds detail ("renews annually, ~12mo")
 * still shares a value and never blocks.
 */
function vocabularyDriftReason(rendered: string, artifact: string): string | null {
  for (const klass of DRIFT_VALUE_CLASSES) {
    const r = valuesPresent(rendered, klass.values);
    const a = valuesPresent(artifact, klass.values);
    if (r.size > 0 && a.size > 0 && disjoint(r, a)) {
      return `${klass.label} drift: rendered "${describe(r)}" but source artifact says "${describe(a)}"`;
    }
  }
  return null;
}

/** Currency drift: both sides name a currency and they disagree. */
function currencyDriftReason(rendered: string, artifact: string): string | null {
  const r = valuesPresent(rendered, CURRENCY_TOKENS);
  const a = valuesPresent(artifact, CURRENCY_TOKENS);
  if (r.size > 0 && a.size > 0 && disjoint(r, a)) {
    return `currency drift: rendered "${describe(r)}" but source artifact uses "${describe(a)}"`;
  }
  return null;
}

/**
 * Recommendation / option drift: a recommendation artifact declares the option(s) it
 * rests on via `option_refs` (the evaluated/winning options). The rendered answer
 * drifts when it surfaces an option ID that is NOT among those evaluated refs — the
 * "recommended option != the artifact's winning option" defect the spec names.
 *
 * This is a CLOSED comparison over declared option IDs (set membership), never a
 * judgment of which option SHOULD win — so it is safe even on a weak-grounded
 * recommendation. An explicit "[override]" marker opts out (§4: the model may deviate
 * when it says so). A prose recommendation that names no option ID is not asserting a
 * choice and never trips this.
 */
function optionDriftReason(rendered: string, artifact: Artifact): string | null {
  const refs = artifact.option_refs ?? [];
  if (refs.length === 0) return null;
  const nRendered = normalizeWhitespace(rendered);
  // The recommendation is faithful if it surfaces at least one of the evaluated
  // option ids it rests on. If it names NONE of them, it projects an option the
  // artifact never evaluated — option drift. (An explicit "[override]" marker in the
  // rendered text opts out: the model is allowed to deviate when it says so, §4.)
  if (/\[override\]/i.test(nRendered)) return null;
  const namesAnEvaluatedOption = refs.some(ref =>
    new RegExp(String.raw`\b${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\b`, 'i').test(nRendered),
  );
  // Only fire when the rendered value LOOKS like it is naming an option id (mentions
  // some "opt-"/"option" token) but not one of the evaluated ones — otherwise a prose
  // recommendation ("Renegotiate now.") is not asserting an id and must not block.
  const looksLikeOptionId = /\b(?:opt[-_]?\w+|option[-_ ]?\w+)\b/i.test(nRendered);
  if (looksLikeOptionId && !namesAnEvaluatedOption) {
    return `option drift: rendered recommendation names an option not among the evaluated options [${refs.join(', ')}]`;
  }
  return null;
}

export interface DriftResult {
  /** True when no rendered field drifts from its source artifact. */
  no_drift: boolean;
  blocking_issues: BlockingIssue[];
  /** Per-field audit: which fields were compared and the drift reason if any. */
  evaluated: Array<{ field: string; compared: boolean; drift_reason: string | null }>;
}

/**
 * Compare every rendered field against its bound source artifact and BLOCK on drift.
 *
 * Fields NEVER drift-blocked at all:
 *   - judgments / interpretation (is_judgment) — non-artifact-backed prose (§5).
 *   - fields with no resolved source_artifact (a binding-integrity error caught
 *     upstream by validateArtifactBundle).
 *
 * Two comparison axes, with DIFFERENT weak-grounding treatment:
 *   - VALUE drift (numeric / cadence / direction / polarity / currency): a value the
 *     rendered field asserts verbatim contradicts the artifact. Exempted for WEAK-
 *     grounded CLAIM artifacts (§4) — a paraphrase/interpretation may legitimately
 *     restate a source in different terms, so we do not compare its surface values.
 *   - OPTION drift (recommendation names an option not among the artifact's evaluated
 *     option_refs): pure id SET MEMBERSHIP, not entailment — so it is checkable even
 *     for a weak-grounded recommendation, which is exactly the "recommended option !=
 *     winning option" defect the spec names. An explicit [override] marker opts out.
 */
export function detectFinalAnswerDrift(renderedFields: RenderedFieldBinding[]): DriftResult {
  const blocking_issues: BlockingIssue[] = [];
  const evaluated: DriftResult['evaluated'] = [];

  for (const field of renderedFields) {
    // §5: judgments (and unresolved bindings) are never drift-compared.
    if (field.is_judgment || !field.source_artifact) {
      evaluated.push({ field: field.field, compared: false, drift_reason: null });
      continue;
    }

    const artifact = field.source_artifact;
    const rendered = field.rendered_value;
    const aText = artifactText(artifact);

    // §4: a WEAK-grounded claim's surface VALUES are not compared (interpretation),
    // but its OPTION-ref membership still is (structural, not semantic).
    const isWeakClaim = artifact.kind === 'claim' && artifact.grounding_level === 'weak';

    const valueReason = isWeakClaim
      ? null
      : numericDriftReason(rendered, aText) ??
        vocabularyDriftReason(rendered, aText) ??
        currencyDriftReason(rendered, aText);
    const reason = valueReason ?? optionDriftReason(rendered, artifact);

    // A weak claim with no option_refs is genuinely not compared (pure interpretation).
    const compared = !isWeakClaim || (artifact.option_refs?.length ?? 0) > 0;
    evaluated.push({ field: field.field, compared, drift_reason: reason });

    if (reason) {
      blocking_issues.push({
        mechanism: 'final_answer_artifact_drift',
        description:
          `Rendered field "${field.field}" disagrees with its bound source artifact ` +
          `"${artifact.id}": ${reason}. The final answer must be a faithful projection of the ` +
          `checked artifact (§5) — re-render the field from the artifact or fix the artifact.`,
        severity: 'blocking',
      });
    }
  }

  return { no_drift: blocking_issues.length === 0, blocking_issues, evaluated };
}

// ─── §9 requirement coverage ───────────────────────────────────────────────────
//
// Per the §9 matrix, requirement coverage is REQUIRED for Math / RAG / Decision /
// Diagnosis (and all writing modes): every contract requirement must be discharged
// by ≥1 final-answer binding. The discharge link is the same host-controlled one
// host_grade_trust uses — a binding whose `field` equals a requirement id projects
// the artifact answering that requirement.
//
// No-Semantic-Miracle test: defect = a declared requirement the answer never
// addresses; predicate = set membership (requirement id ∈ rendered binding fields);
// false-block = none, because the host/contract names the requirement ids; the
// answer binds to artifacts by those same ids. MISSING_REQUIREMENT (§7).

export interface RequirementCoverageResult {
  /** True when every requirement is discharged by ≥1 final-answer binding. */
  all_requirements_covered: boolean;
  blocking_issues: BlockingIssue[];
  evaluated: Array<{ requirement_id: string; covered: boolean }>;
}

export function checkRequirementCoverage(bundle: ArtifactBundle): RequirementCoverageResult {
  const boundFields = new Set(bundle.final_answer_bindings.map(b => b.field));
  const blocking_issues: BlockingIssue[] = [];
  const evaluated: RequirementCoverageResult['evaluated'] = [];

  for (const req of bundle.requirements) {
    const covered = boundFields.has(req.id);
    evaluated.push({ requirement_id: req.id, covered });
    if (!covered) {
      blocking_issues.push({
        mechanism: 'requirement_coverage',
        description:
          `Requirement "${req.id}" (${req.text}) is not discharged by any final-answer binding; ` +
          `every declared requirement must be projected by ≥1 bound field (§9).`,
        severity: 'blocking',
      });
    }
  }

  return {
    all_requirements_covered: blocking_issues.length === 0,
    blocking_issues,
    evaluated,
  };
}
