/**
 * host_grade_trust — the §3 rule: a deterministic PASS may rest ONLY on tier-1/2
 * (host_authored / host_extracted) artifacts carrying STRONG grounding.
 *
 * The #1 residual risk (§3, §12) is model-authored theater: the model authors the
 * contract, the artifacts, the claims, AND the answer, producing a perfectly
 * self-consistent FAKE proof. Trust is therefore explicitly UNEQUAL. A tier-3..5
 * (model-authored) artifact may be REQUIRED to exist and be internally consistent,
 * but its presence is never evidence the answer is true — it is surfaced/labeled,
 * not trusted. A PASS that would assert proof must not rest on it.
 *
 * Anti-dodge (§3.1): the model must not be able to self-declare a weaker contract
 * profile to escape this rule. The set of requirements that MUST be backed proof-
 * grade is supplied by the HOST (enforcement_host authors the contract; this fn
 * takes the host's proof_grade_requirements). A model-authored bundle cannot relax
 * that set — the worst it can do is fail to satisfy it, which BLOCKS.
 *
 * SCOPE FENCE (Phase 3.1): this checks the TRUST TIER backing each proof-grade
 * requirement's binding. It does NOT do source-span grounding gates or final-answer
 * drift comparison (Phase 3.2). It returns blocking issues; finalize/host decide.
 *
 * Pure. Deterministic. No LLM, no state.
 */

import type { Artifact, ArtifactBundle, BlockingIssue, FinalAnswerBinding } from './types.js';
import { isProofGrade, trustTier } from './artifact_schema.js';
import { normalizeWhitespace, sha256Hex } from './utils.js';

/**
 * HONEST LIMIT — what is and is NOT authenticated here.
 *
 * `artifact.provenance` is a STRING THE AGENT WROTE. It is a CLAIM, not a fact: a
 * fabricated bundle can self-label `provenance:'host_extracted', grounding_level:
 * 'strong'` and nothing in the bundle binds that label to a real source. Trusting
 * the label alone was the §3/§12 #1 residual risk (model-authored theater) made
 * exploitable — a forged bundle would RELEASE.
 *
 * So proof-grade is decided by HOST-ANCHORED EVIDENCE, supplied by the host (never
 * by the agent's bundle), and the agent's provenance label is VERIFIED against it:
 *   - `host_extracted`: AUTHENTIC only if the artifact's `quoted_span` (or `text`)
 *     is a verbatim (whitespace-normalized) substring of a HOST-SUPPLIED source —
 *     the same containment check check_quote_grounding / finalize_deliverable use.
 *   - `host_authored`: AUTHENTIC only if the artifact is in the host's AUTHORED SET,
 *     matched by id or by content-hash (sha256 of normalized text).
 *   - anything else (any tier-3..5 label, OR a tier-1/2 label with no matching host
 *     evidence) is NOT proof-grade. A self-labeled-but-unanchored artifact BLOCKS.
 *
 * What this does NOT authenticate: it cannot verify the host's evidence is itself
 * true, nor that a host_supplied source was retrieved honestly — it authenticates
 * that a proof-grade label is BACKED by something the HOST (not the model) anchored.
 * Verbatim containment is internal grounding (you copied real host text), not
 * external truth; weak/interpretive grounding stays advisory (§4).
 *
 * Pure. Deterministic. No LLM, no state.
 */

/**
 * A source the HOST anchors as authoritative. The host supplies these (out-of-band
 * from the agent's bundle); a `host_extracted` artifact is proof-grade ONLY if its
 * quoted span matches one of these verbatim.
 */
export interface HostSource {
  id: string;
  text: string;
}

/**
 * An artifact the HOST authored as authoritative. Matched against the bundle by
 * `id` and/or by `content_hash` (sha256 of normalized `text`). Either is enough to
 * authenticate a `host_authored` label.
 */
export interface HostAuthoredArtifact {
  id?: string;
  content_hash?: string;
}

/** The host's authoritative evidence set — the root of trust for proof-grade. */
export interface HostAnchoredEvidence {
  /** Host-supplied sources a host_extracted artifact must quote verbatim. */
  host_sources?: HostSource[];
  /** Host-authored artifacts (by id or content-hash) backing host_authored labels. */
  host_authored_artifacts?: HostAuthoredArtifact[];
}

/** Content-hash an artifact's text the way the host-authored set is keyed. */
function artifactContentHash(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return sha256Hex(normalizeWhitespace(text));
}

/**
 * Verify the artifact's PROVENANCE LABEL against the host's anchored evidence.
 * Returns the proof tier (1 host_authored / 2 host_extracted) ONLY when the label is
 * authenticated; null otherwise. The label is never trusted on its own.
 *
 *   - host_authored: the artifact must be in the host's authored set (id or content-hash).
 *   - host_extracted: the artifact's quoted_span (or text) must verbatim-match a
 *     HOST-SUPPLIED source — the §4 containment check, not reinvented.
 *   - for a claim: grounding_level must additionally be 'strong' (a weak/interpretive
 *     claim is advisory even when host-anchored, §4).
 *
 * NB this is STRICTER than artifact_schema.isPassEligibleClaim (claim-only) AND than
 * the old label-only check: the host-grade rule applies to any artifact a proof-grade
 * requirement binds to, and authentication is by host evidence, not by the agent's label.
 */
export function authenticateHostGrade(
  artifact: Artifact,
  evidence: HostAnchoredEvidence,
): 1 | 2 | null {
  // A weak/interpretive claim is never proof-grade, regardless of label or anchoring (§4).
  if (artifact.kind === 'claim' && artifact.grounding_level !== 'strong') return null;

  if (artifact.provenance === 'host_authored') {
    const authored = evidence.host_authored_artifacts ?? [];
    const hash = artifactContentHash(artifact.text);
    const matched = authored.some(
      a =>
        (a.id !== undefined && a.id === artifact.id) ||
        (a.content_hash !== undefined && hash !== undefined && a.content_hash === hash),
    );
    return matched ? 1 : null;
  }

  if (artifact.provenance === 'host_extracted') {
    const sources = evidence.host_sources ?? [];
    // The verbatim span the artifact asserts it extracted (quoted_span preferred; the
    // extractive text is the fallback for span/derivation artifacts that carry no quote).
    const span = artifact.quoted_span ?? artifact.text;
    if (span === undefined || span.length === 0) return null;
    const nSpan = normalizeWhitespace(span);
    const matched = sources.some(s => normalizeWhitespace(s.text).includes(nSpan));
    return matched ? 2 : null;
  }

  // tier-3..5 labels are never proof-grade.
  return null;
}

/**
 * Legacy LABEL-ONLY predicate (kept for the renderer/tests that ask "could this be
 * proof-grade by label?"). DOES NOT authenticate against host evidence and MUST NOT
 * be used to gate a release — use authenticateHostGrade for that. Retained so callers
 * that only want the §3 label classification (not the trust decision) are unaffected.
 */
export function isHostGradeProof(artifact: Artifact): boolean {
  if (!isProofGrade(artifact.provenance)) return false;
  if (artifact.kind === 'claim') return artifact.grounding_level === 'strong';
  return true;
}

export interface HostGradeOptions {
  /**
   * Requirement ids the HOST declares MUST be backed by proof-grade evidence.
   * Authored host-side so the model can't dodge by self-declaring a weaker profile.
   * If omitted/empty, this is a no-op (advisory-only world): nothing is forced
   * proof-grade, matching the §2 "nothing blocks until proven" stance.
   */
  proof_grade_requirements?: string[];
  /**
   * The HOST's authoritative evidence (host-supplied sources / host-authored set).
   * Proof-grade is decided ONLY against this — the agent's provenance label is a
   * claim verified against it, not a trusted fact. If a requirement is proof-grade
   * but no host evidence anchors any of its bindings, it BLOCKS.
   */
  host_evidence?: HostAnchoredEvidence;
}

export interface HostGradeResult {
  /** True when every proof-grade requirement is backed by ≥1 host-grade binding. */
  proof_grade_satisfied: boolean;
  blocking_issues: BlockingIssue[];
  /** Per-requirement audit: which binding (if any) carried it proof-grade. */
  evaluated: Array<{
    requirement_id: string;
    satisfied: boolean;
    backing_artifact_id?: string;
    backing_trust_tier?: number;
  }>;
}

/**
 * Map each final-answer binding to whichever requirement it discharges. We treat a
 * binding.field equal to a requirement id as the discharge link (the binding
 * projects the artifact that answers that requirement). This keeps the link
 * deterministic and host-controlled — the host names the requirement ids it cares
 * about, and the renderer fields are those same ids.
 */
function bindingsForRequirement(
  bundle: ArtifactBundle,
  requirementId: string,
): FinalAnswerBinding[] {
  return bundle.final_answer_bindings.filter(b => b.field === requirementId);
}

/**
 * Evaluate the §3 host-grade trust rule over a (validated) bundle.
 *
 * For each host-declared proof_grade_requirement, at least one of its final-answer
 * bindings must project a HOST-GRADE artifact (tier-1/2 + strong). A binding that
 * rests only on a tier-3..5 (model-authored) artifact — or a judgment, or a weak
 * tier-1/2 claim — does NOT discharge a proof-grade requirement: it BLOCKS with
 * PROFILE_DOWNGRADE (the model tried to pass proof-grade work on non-proof input).
 */
export function evaluateHostGradeTrust(
  bundle: ArtifactBundle,
  opts: HostGradeOptions = {},
): HostGradeResult {
  const required = opts.proof_grade_requirements ?? [];
  const evidence = opts.host_evidence ?? {};
  const byId = new Map<string, Artifact>(bundle.artifacts.map(a => [a.id, a]));
  const blocking_issues: BlockingIssue[] = [];
  const evaluated: HostGradeResult['evaluated'] = [];

  for (const requirementId of required) {
    const bindings = bindingsForRequirement(bundle, requirementId);

    // A binding is proof-grade ONLY if the host's anchored evidence authenticates
    // its artifact's provenance label. The label alone is never enough.
    let backing: { artifact: Artifact; tier: 1 | 2 } | null = null;
    for (const binding of bindings) {
      if (binding.binding_kind === 'judgment' || !binding.artifact_id) continue;
      const artifact = byId.get(binding.artifact_id);
      if (!artifact) continue;
      const tier = authenticateHostGrade(artifact, evidence);
      if (tier !== null) {
        backing = { artifact, tier };
        break;
      }
    }

    if (backing) {
      evaluated.push({
        requirement_id: requirementId,
        satisfied: true,
        backing_artifact_id: backing.artifact.id,
        backing_trust_tier: backing.tier,
      });
      continue;
    }

    // No HOST-ANCHORED backing. Surface WHY for the corrective prompt: the best the
    // model offered (if anything), its self-declared tier, and that it failed
    // authentication — so a repair has a concrete target.
    const offered = bindings.find(b => b.binding_kind !== 'judgment' && b.artifact_id);
    const offeredArtifact = offered?.artifact_id ? byId.get(offered.artifact_id) : undefined;
    const offeredDetail = offeredArtifact
      ? `best binding rests on artifact "${offeredArtifact.id}" (self-declared tier ${trustTier(offeredArtifact.provenance)}, ${offeredArtifact.kind}${offeredArtifact.kind === 'claim' ? `/${offeredArtifact.grounding_level}` : ''}), which is NOT authenticated by any host-supplied source or host-authored artifact`
      : bindings.length === 0
        ? 'no binding projects this requirement'
        : 'only a judgment/interpretation binding projects this requirement';

    blocking_issues.push({
      mechanism: 'host_grade_proof_required',
      description:
        `Proof-grade requirement "${requirementId}" is not backed by a HOST-ANCHORED tier-1/2 ` +
        `(host_authored/host_extracted) strong-grounded artifact; ${offeredDetail}. A provenance label is a ` +
        `CLAIM verified against host evidence, not a trusted fact: a self-labeled artifact with no matching ` +
        `host source/authored entry is never proof and cannot carry a proof-grade PASS (§3).`,
      severity: 'blocking',
    });
    evaluated.push({
      requirement_id: requirementId,
      satisfied: false,
      backing_artifact_id: offeredArtifact?.id,
      backing_trust_tier: offeredArtifact ? trustTier(offeredArtifact.provenance) : undefined,
    });
  }

  return { proof_grade_satisfied: blocking_issues.length === 0, blocking_issues, evaluated };
}
