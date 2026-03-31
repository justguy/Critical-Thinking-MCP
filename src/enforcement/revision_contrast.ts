/**
 * Revision contrast checker.
 *
 * Two checks:
 *   A — gap key terms present in revision (tokenized coverage)
 *   B — resolution quality: component + triggering condition + specific behavior
 *
 * Verdict logic:
 *   missing      — gap terms absent
 *   padded       — extra words but gap terms still absent
 *   mentioned_only — terms present but resolution_quality < 0.5
 *   resolved     — terms present AND resolution_quality >= 0.5
 */

import type { RevisionContrastResult } from './types.js';
import { tokenize } from './utils.js';

/** Stopwords to ignore when computing gap-term coverage. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'of', 'in', 'to',
  'for', 'with', 'on', 'at', 'from', 'by', 'about', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'and',
  'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither',
  'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
  'just', 'because', 'it', 'its', 'this', 'that', 'these', 'those',
]);

/** CamelCase or dotted-path component names. */
const COMPONENT_RE =
  /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b|\b\w+\.\w+(?:\.\w+)*\b/;

/** Triggering condition patterns: "when", "if", "during", "after N units", comparators. */
const CONDITION_RE =
  /\b(?:when|if|once|during|after|before|unless|provided|given)\b|[<>≤≥]=?\s*\d/i;

/** Specific behavior patterns: measurable outcomes, error codes, actions. */
const BEHAVIOR_RE =
  /\b(?:returns?|throws?|logs?|crashes?|retries?|falls?\s*back|rejects?|times?\s*out|triggers?|emits?|fails?|blocks?)\b|\b\d+(?:\.\d+)?\s*(?:%|ms|s|MB|GB|KB)\b/i;

/**
 * Compute gap-term coverage ratio.  Returns the fraction of meaningful gap
 * tokens that appear in the revision.
 */
function gapTermCoverage(gapTokens: string[], revisionTokenSet: Set<string>): number {
  const meaningful = gapTokens.filter(t => !STOP_WORDS.has(t) && t.length > 2);
  if (meaningful.length === 0) return 0;
  const found = meaningful.filter(t => revisionTokenSet.has(t));
  return found.length / meaningful.length;
}

/**
 * Compute resolution quality on a 0–1 scale:
 *   0.33 for component, 0.33 for condition, 0.34 for behavior.
 */
function resolutionQuality(revision: string): number {
  let score = 0;
  if (COMPONENT_RE.test(revision)) score += 0.33;
  if (CONDITION_RE.test(revision)) score += 0.33;
  if (BEHAVIOR_RE.test(revision)) score += 0.34;
  return score;
}

/**
 * Check whether a revision meaningfully addresses a stated gap.
 */
export function checkRevision(
  gap: string,
  revision: string,
): RevisionContrastResult {
  const gapTokens = tokenize(gap);
  const revisionTokens = tokenize(revision);
  const revisionTokenSet = new Set(revisionTokens);

  const coverage = gapTermCoverage(gapTokens, revisionTokenSet);
  const gap_terms_present = coverage >= 0.4;

  const quality = resolutionQuality(revision);

  // Verdict logic
  let verdict: RevisionContrastResult['verdict'];
  if (!gap_terms_present) {
    // Check if revision is just longer (padded) or outright missing
    verdict = revisionTokens.length > gapTokens.length * 1.5 ? 'padded' : 'missing';
  } else if (quality >= 0.5) {
    verdict = 'resolved';
  } else {
    verdict = 'mentioned_only';
  }

  return {
    gap_terms_present,
    resolution_quality: quality,
    verdict,
  };
}
