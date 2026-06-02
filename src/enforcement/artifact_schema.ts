/**
 * Phase 1b — thin artifact / provenance / grounding schema (validators + guards).
 *
 * Implements the minimum proof-carrying artifact model from
 * docs/designs/DETERMINISTIC_VALUE_PLAN.md §1b, with provenance tiers (§3) and the
 * strong/weak grounding split (§4). Just enough structure to AUTHOR Phase-2
 * mutations and run final-answer drift checks.
 *
 * THIN: validators + type-guards ONLY. Nothing here blocks; it does not wire into
 * finalize_deliverable and does not touch the MCP tool surface. The full
 * host-contract / plan-token spine is deferred to Phase 3.
 *
 * Deterministic. Stateless. No LLM calls. Mirrors the throw-on-invalid validator
 * style of numeric_analysis.ts (the validate-prefixed fns return the typed object;
 * the lighter is-prefixed guards return booleans for tests and Phase-2 fixtures).
 */

import type {
  Artifact,
  ArtifactBundle,
  ArtifactProvenance,
  ArtifactTrustTier,
  ContractRequirement,
  FinalAnswerBinding,
  GroundingLevel,
} from './types.js';

// ─── Enumerations (single source of truth for the validators + tests) ──────────

/** The EXACTLY five provenance tiers (§3), ordered tier-1 … tier-5. */
export const ARTIFACT_PROVENANCE_TIERS: readonly ArtifactProvenance[] = [
  'host_authored',
  'host_extracted',
  'model_declared_assumption',
  'model_generated_reasoning',
  'model_generated_recommendation',
];

const PROVENANCE_SET: ReadonlySet<ArtifactProvenance> = new Set(ARTIFACT_PROVENANCE_TIERS);

const ARTIFACT_KINDS: ReadonlySet<Artifact['kind']> = new Set([
  'claim',
  'derivation',
  'assumption',
  'option',
  'source_span',
]);

const GROUNDING_LEVELS: ReadonlySet<GroundingLevel> = new Set(['strong', 'weak']);

const BINDING_KINDS: ReadonlySet<FinalAnswerBinding['binding_kind']> = new Set([
  'claim',
  'derivation',
  'assumption',
  'option',
  'judgment',
]);

// ─── Trust-tier helpers (§3) ───────────────────────────────────────────────────

/** Map a provenance value to its numeric trust tier (1 = highest). */
export function trustTier(provenance: ArtifactProvenance): ArtifactTrustTier {
  return (ARTIFACT_PROVENANCE_TIERS.indexOf(provenance) + 1) as ArtifactTrustTier;
}

/**
 * Tier-1/2 = proof-grade (host_authored / host_extracted), per §3.
 *
 * NOTE (Phase 3, NOT enforced here): a deterministic PASS may rest ONLY on
 * proof-grade artifacts carrying 'strong' grounding (see `isPassEligibleClaim`).
 * This is documented and exposed as a pure predicate so Phase-2 mutations and the
 * Phase-3 gate can build on it — but no caller in Phase 1b blocks on it.
 */
export function isProofGrade(provenance: ArtifactProvenance): boolean {
  return provenance === 'host_authored' || provenance === 'host_extracted';
}

/**
 * Would this claim artifact be eligible to carry a deterministic PASS under the
 * §3 rule (tier-1/2 + strong grounding)? Advisory predicate only — Phase 1b never
 * enforces it; Phase 3 will.
 */
export function isPassEligibleClaim(artifact: Artifact): boolean {
  return (
    artifact.kind === 'claim' &&
    isProofGrade(artifact.provenance) &&
    artifact.grounding_level === 'strong'
  );
}

// ─── Type guards (lightweight; used by tests and Phase-2 fixture authoring) ─────

export function isArtifactProvenance(value: unknown): value is ArtifactProvenance {
  return typeof value === 'string' && PROVENANCE_SET.has(value as ArtifactProvenance);
}

export function isGroundingLevel(value: unknown): value is GroundingLevel {
  return typeof value === 'string' && GROUNDING_LEVELS.has(value as GroundingLevel);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringIdArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);
}

/** Structural guard — true when `value` is a well-formed Artifact. Does not throw. */
export function isArtifact(value: unknown): value is Artifact {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (!isArtifactProvenance(value.provenance)) return false;
  if (typeof value.kind !== 'string' || !ARTIFACT_KINDS.has(value.kind as Artifact['kind'])) return false;
  // Claims MUST carry a grounding_level (§4); other kinds MUST NOT.
  if (value.kind === 'claim') {
    if (!isGroundingLevel(value.grounding_level)) return false;
  } else if (value.grounding_level !== undefined) {
    return false;
  }
  if (value.text !== undefined && typeof value.text !== 'string') return false;
  if (value.source_span_id !== undefined && typeof value.source_span_id !== 'string') return false;
  if (value.quoted_span !== undefined && typeof value.quoted_span !== 'string') return false;
  if (value.option_refs !== undefined && !isStringIdArray(value.option_refs)) return false;
  return true;
}

// ─── Validators (throw on invalid, return the typed object) ─────────────────────

function validateRequirement(raw: unknown, index: number): ContractRequirement {
  if (!isObject(raw)) {
    throw new Error(`artifact_bundle.requirements[${index}] must be an object.`);
  }
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    throw new Error(`artifact_bundle.requirements[${index}].id must be a non-empty string.`);
  }
  if (typeof raw.text !== 'string' || raw.text.length === 0) {
    throw new Error(`artifact_bundle.requirements[${index}].text must be a non-empty string.`);
  }
  return { id: raw.id, text: raw.text };
}

function validateArtifact(raw: unknown, index: number): Artifact {
  if (!isObject(raw)) {
    throw new Error(`artifact_bundle.artifacts[${index}] must be an object.`);
  }
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    throw new Error(`artifact_bundle.artifacts[${index}].id must be a non-empty string.`);
  }
  if (!isArtifactProvenance(raw.provenance)) {
    throw new Error(
      `artifact_bundle.artifacts[${index}].provenance must be one of: ${ARTIFACT_PROVENANCE_TIERS.join(', ')}.`,
    );
  }
  if (typeof raw.kind !== 'string' || !ARTIFACT_KINDS.has(raw.kind as Artifact['kind'])) {
    throw new Error(
      `artifact_bundle.artifacts[${index}].kind must be one of: ${[...ARTIFACT_KINDS].join(', ')}.`,
    );
  }
  const kind = raw.kind as Artifact['kind'];
  // §4: claims carry grounding_level; other kinds must not declare one.
  if (kind === 'claim') {
    if (!isGroundingLevel(raw.grounding_level)) {
      throw new Error(
        `artifact_bundle.artifacts[${index}] is a claim and must carry grounding_level 'strong' or 'weak'.`,
      );
    }
  } else if (raw.grounding_level !== undefined) {
    throw new Error(
      `artifact_bundle.artifacts[${index}] of kind '${kind}' must not carry grounding_level (claims only).`,
    );
  }
  if (raw.text !== undefined && typeof raw.text !== 'string') {
    throw new Error(`artifact_bundle.artifacts[${index}].text must be a string when supplied.`);
  }
  if (raw.source_span_id !== undefined && typeof raw.source_span_id !== 'string') {
    throw new Error(`artifact_bundle.artifacts[${index}].source_span_id must be a string when supplied.`);
  }
  if (raw.quoted_span !== undefined && typeof raw.quoted_span !== 'string') {
    throw new Error(`artifact_bundle.artifacts[${index}].quoted_span must be a string when supplied.`);
  }
  if (raw.option_refs !== undefined && !isStringIdArray(raw.option_refs)) {
    throw new Error(`artifact_bundle.artifacts[${index}].option_refs must be an array of option ids.`);
  }

  return {
    id: raw.id,
    provenance: raw.provenance,
    kind,
    grounding_level: raw.grounding_level as GroundingLevel | undefined,
    text: raw.text as string | undefined,
    source_span_id: raw.source_span_id as string | undefined,
    quoted_span: raw.quoted_span as string | undefined,
    option_refs: raw.option_refs as string[] | undefined,
  };
}

function validateBinding(raw: unknown, index: number): FinalAnswerBinding {
  if (!isObject(raw)) {
    throw new Error(`artifact_bundle.final_answer_bindings[${index}] must be an object.`);
  }
  if (typeof raw.field !== 'string' || raw.field.length === 0) {
    throw new Error(`artifact_bundle.final_answer_bindings[${index}].field must be a non-empty string.`);
  }
  if (
    typeof raw.binding_kind !== 'string' ||
    !BINDING_KINDS.has(raw.binding_kind as FinalAnswerBinding['binding_kind'])
  ) {
    throw new Error(
      `artifact_bundle.final_answer_bindings[${index}].binding_kind must be one of: ${[...BINDING_KINDS].join(', ')}.`,
    );
  }
  const bindingKind = raw.binding_kind as FinalAnswerBinding['binding_kind'];
  // §2 law 1: every material field binds to an artifact OR is an explicit judgment.
  if (bindingKind === 'judgment') {
    if (raw.artifact_id !== undefined && typeof raw.artifact_id !== 'string') {
      throw new Error(
        `artifact_bundle.final_answer_bindings[${index}].artifact_id must be a string when supplied.`,
      );
    }
  } else if (typeof raw.artifact_id !== 'string' || raw.artifact_id.length === 0) {
    throw new Error(
      `artifact_bundle.final_answer_bindings[${index}] of kind '${bindingKind}' must reference a non-empty artifact_id.`,
    );
  }
  if (raw.rendered_value !== undefined && typeof raw.rendered_value !== 'string') {
    throw new Error(
      `artifact_bundle.final_answer_bindings[${index}].rendered_value must be a string when supplied.`,
    );
  }
  return {
    field: raw.field,
    binding_kind: bindingKind,
    artifact_id: raw.artifact_id as string | undefined,
    rendered_value: raw.rendered_value as string | undefined,
  };
}

/**
 * Validate a thin ArtifactBundle: the §1b chain
 * task_contract → requirement_ids → artifact_ids → final_answer_bindings.
 *
 * Checks structure + referential integrity (no dangling artifact_id, no duplicate
 * ids, kind/grounding rules). Throws on the first violation. Does NOT enforce any
 * trust/grounding policy — that is advisory in Phase 1b and gated in Phase 3.
 */
export function validateArtifactBundle(input: unknown): ArtifactBundle {
  if (!isObject(input)) {
    throw new Error('artifact_bundle must be an object.');
  }
  if (typeof input.contract_id !== 'string' || input.contract_id.length === 0) {
    throw new Error('artifact_bundle.contract_id must be a non-empty string.');
  }
  if (!Array.isArray(input.requirements) || input.requirements.length === 0) {
    throw new Error('artifact_bundle.requirements must be a non-empty array.');
  }
  if (!Array.isArray(input.artifacts) || input.artifacts.length === 0) {
    throw new Error('artifact_bundle.artifacts must be a non-empty array.');
  }
  if (!Array.isArray(input.final_answer_bindings)) {
    throw new Error('artifact_bundle.final_answer_bindings must be an array.');
  }

  const requirements = input.requirements.map(validateRequirement);
  const requirementIds = new Set<string>();
  for (const req of requirements) {
    if (requirementIds.has(req.id)) {
      throw new Error(`artifact_bundle.requirements contains duplicate id "${req.id}".`);
    }
    requirementIds.add(req.id);
  }

  const artifacts = input.artifacts.map(validateArtifact);
  const artifactIds = new Set<string>();
  for (const artifact of artifacts) {
    if (artifactIds.has(artifact.id)) {
      throw new Error(`artifact_bundle.artifacts contains duplicate id "${artifact.id}".`);
    }
    artifactIds.add(artifact.id);
  }

  // Referential integrity: cited source spans, option refs, and bindings must resolve.
  for (const artifact of artifacts) {
    if (artifact.source_span_id !== undefined && !artifactIds.has(artifact.source_span_id)) {
      throw new Error(
        `artifact "${artifact.id}" cites unknown source_span_id "${artifact.source_span_id}".`,
      );
    }
    for (const ref of artifact.option_refs ?? []) {
      if (!artifactIds.has(ref)) {
        throw new Error(`artifact "${artifact.id}" references unknown option id "${ref}".`);
      }
    }
  }

  const bindings = input.final_answer_bindings.map(validateBinding);
  for (const [i, binding] of bindings.entries()) {
    if (binding.artifact_id !== undefined && !artifactIds.has(binding.artifact_id)) {
      throw new Error(
        `artifact_bundle.final_answer_bindings[${i}] references unknown artifact_id "${binding.artifact_id}".`,
      );
    }
  }

  return { contract_id: input.contract_id, requirements, artifacts, final_answer_bindings: bindings };
}

/** Non-throwing structural guard for an ArtifactBundle (delegates to validate). */
export function isArtifactBundle(value: unknown): value is ArtifactBundle {
  try {
    validateArtifactBundle(value);
    return true;
  } catch {
    return false;
  }
}
