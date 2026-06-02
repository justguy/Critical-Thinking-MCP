/**
 * answer_renderer — the final answer is a RENDERING of the artifact ledger (§5).
 *
 * Design law (§2.1, §5): we do NOT let the model emit free prose and then ask
 * deterministic code to extract "every material claim" — that re-imports the hard
 * NLP problem. Instead the model fills artifacts (claims with provenance +
 * grounding, derivations, options, assumptions) and a renderer PROJECTS them into
 * answer text, with every rendered material field carrying its FinalAnswerBinding
 * (the artifact it came from, or an explicit 'judgment'/'interpretation' type for
 * non-artifact-backed prose).
 *
 * SCOPE FENCE (Phase 3.1): this module RENDERS and exposes the per-field binding
 * record — the structure + wiring point Phase 3.2's drift detector consumes. It
 * does NOT compare a rendered value against its source artifact (that comparison,
 * FINAL_ANSWER_ARTIFACT_DRIFT, is dvp-p3-2). It also does NOT block.
 *
 * Pure. Deterministic. No LLM, no state.
 */

import type { Artifact, ArtifactBundle, BindingKind, FinalAnswerBinding } from './types.js';
import { trustTier } from './artifact_schema.js';
import type { ArtifactTrustTier } from './types.js';

/**
 * One rendered field, projected from a binding. This is the record Phase 3.2 will
 * diff for drift: it carries the rendered_value, the source artifact it claims to
 * project from, and that artifact's trust tier (so the host-grade rule can decide
 * whether this field may carry proof-grade weight).
 */
export interface RenderedFieldBinding {
  field: string;
  binding_kind: BindingKind;
  /** Absent only for binding_kind === 'judgment' (non-artifact-backed prose). */
  artifact_id?: string;
  /** The value as projected into answer_text. Phase 3.2 compares this to the artifact. */
  rendered_value: string;
  /** Resolved source artifact (absent for judgments). Snapshot for the drift comparison. */
  source_artifact?: Artifact;
  /** Trust tier of the source artifact (1 highest .. 5). Absent for judgments. */
  trust_tier?: ArtifactTrustTier;
  /**
   * True when this field is non-artifact-backed prose surfaced as the model's own
   * judgment/interpretation (§5). Such fields are LABELED, never trusted as proof.
   */
  is_judgment: boolean;
}

export interface RenderedAnswer {
  /** The projected answer text — a deterministic rendering of the bound ledger. */
  answer_text: string;
  /** Per-field binding records; the wiring point Phase 3.2 diffs for drift. */
  rendered_fields: RenderedFieldBinding[];
}

/** Human-readable label for the prose line of a judgment/interpretation field. */
const JUDGMENT_LABEL = '[judgment]';

/**
 * Resolve the text a binding projects into the answer. Precedence:
 *   1. an explicit binding.rendered_value (what the model chose to surface), else
 *   2. the source artifact's `text` (so a binding with no rendered_value still
 *      renders faithfully from the ledger).
 * Returns '' when neither is present (a judgment with no value).
 */
function resolveRenderedValue(binding: FinalAnswerBinding, artifact: Artifact | undefined): string {
  if (typeof binding.rendered_value === 'string') return binding.rendered_value;
  if (artifact && typeof artifact.text === 'string') return artifact.text;
  return '';
}

/**
 * Render a bound ArtifactBundle into answer text + per-field binding records.
 *
 * The bundle is assumed already validated (validateArtifactBundle): every non-
 * judgment binding references an existing artifact_id. We re-resolve here and
 * carry the resolved artifact + its trust tier so the host-grade rule (§3) and
 * the Phase-3.2 drift detector operate on structured bindings, not free text.
 */
export function renderAnswer(bundle: ArtifactBundle): RenderedAnswer {
  const byId = new Map<string, Artifact>(bundle.artifacts.map(a => [a.id, a]));
  const renderedFields: RenderedFieldBinding[] = [];
  const lines: string[] = [];

  for (const binding of bundle.final_answer_bindings) {
    const isJudgment = binding.binding_kind === 'judgment';
    const artifact = binding.artifact_id ? byId.get(binding.artifact_id) : undefined;
    const renderedValue = resolveRenderedValue(binding, artifact);

    const record: RenderedFieldBinding = {
      field: binding.field,
      binding_kind: binding.binding_kind,
      artifact_id: binding.artifact_id,
      rendered_value: renderedValue,
      source_artifact: isJudgment ? undefined : artifact,
      trust_tier: isJudgment || !artifact ? undefined : trustTier(artifact.provenance),
      is_judgment: isJudgment,
    };
    renderedFields.push(record);

    // §5: judgments/interpretations are surfaced AS SUCH (labeled), never as proof.
    lines.push(
      isJudgment
        ? `${binding.field}: ${renderedValue} ${JUDGMENT_LABEL}`
        : `${binding.field}: ${renderedValue}`,
    );
  }

  return { answer_text: lines.join('\n'), rendered_fields: renderedFields };
}
