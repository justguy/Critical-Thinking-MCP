import type {
  CausalClaim,
  FailureMode,
  Constraint,
  PassId,
  Scenario,
  TypedMapping,
} from './models.js';
import { normalizeText } from './deterministic.js';

const EXTRACTION_VERSION = 'v1.0';

export { EXTRACTION_VERSION };

const CONFIDENCE_RE = /(?:confidence|certainty)\s*(?::|is|=)\s*(0(?:\.\d+)?|1(?:\.0+)?)/gi;

const FAILURE_MODE_HEURISTICS: Record<string, string[][]> = {
  causal_hallucination: [
    ['causal', 'agent'],
    ['asserted', 'cause'],
    ['affirming', 'consequent'],
    ['effect', 'specific cause'],
    ['causal', 'origin'],
    ['causally', 'ungrounded'],
    ['backward', 'causality'],
  ],
  category_type_collapse: [
    ['category', 'error'],
    ['perceptual', 'ontological'],
    ['invisible', 'does not exist'],
    ['predicate', 'conflates'],
  ],
  contradiction_blindness: [
    ['mutually', 'contradict'],
    ['geometric', 'impossibility'],
    ['circular', 'prerequisite'],
    ['cannot all be seated'],
    ['future', 'cause'],
  ],
  fluency_driven_belief_substitution: [
    ['plays along', 'metaphor'],
    ['politeness', 'rather than'],
    ['hospitality', 'rather than'],
    ['agreement', 'enough'],
  ],
};

const RESOLUTION_HEURISTICS: Record<string, string[][]> = {
  r1_reject_existence: [
    ['does not exist'],
    ['non existence', 'precludes'],
    ['no physical presence'],
  ],
  r2_reject_force_cause: [
    ['causal', 'agent'],
    ['causation requires', 'physical force'],
    ['cannot exert', 'force'],
    ['affirming', 'consequent'],
  ],
  r3_attribute_spill_elsewhere: [
    ['effect', 'does not uniquely identify', 'cause'],
    ['equally', 'explained by'],
    ['equally consistent with', 'unknown physical cause'],
    ['not evidence of', 'caused the fall'],
    ['evidence of an effect', 'specific cause'],
    ['downstream evidence', 'identify which cause'],
    ['only available explanation'],
    ['this is', 'circular'],
    ['causally', 'ungrounded'],
    ['no valid', 'initiating event'],
  ],
  r1_reject_fairness_as_liquid: [
    ['fairness', 'abstract'],
    ['physical', 'volume'],
  ],
  r2_reject_silence_cube: [
    ['silence', 'cube'],
    ['silence', 'mass'],
  ],
  r3_reject_physical_operations: [
    ['cannot be', 'measured'],
    ['cannot', 'dissolve'],
    ['cannot be', 'stirred'],
  ],
  r1_reject_fifth_seat: [
    ['only four', 'chairs'],
    ['maximum of four', 'seated'],
    ['four chairs', 'five distinct seatings'],
    ['exactly four chairs', 'five distinct seatings'],
  ],
  r2_require_five_chairs: [
    ['five distinct', 'chairs'],
    ['cannot all be', 'seated'],
    ['geometric', 'impossibility'],
    ['four chairs', 'five people'],
    ['pigeonhole', 'principle'],
    ['distinct', 'chair'],
    ['four chairs', 'five distinct seatings'],
    ['four chairs cannot', 'five distinct'],
    ['4', '5', 'distinct'],
  ],
  r3_reject_consensus_as_matter: [
    ['consensus', 'create matter'],
    ['agreement', 'add a chair'],
    ['alter', 'geometry'],
    ['consensus', 'epistemic state'],
    ['physical', 'ontological fact'],
    ['truth', 'maker'],
    ['false belief', 'possible arrangement'],
    ['authority by consensus'],
    ['social proof', 'physical fact'],
    ['intersubjective agreement', 'ontological'],
    ['observers agreeing', 'physically possible'],
    ['unanimous false belief', 'possible arrangement'],
  ],
  r1_reject_observed_existence: [
    ['exist', 'while observed'],
    ['exist only when', 'unobserved'],
    ['exist only when', 'no conscious entity', 'observing'],
    ['under observation', 'they do not'],
    ['guest is observing', 'do not'],
  ],
  r2_reject_physical_interaction: [
    ['cannot be', 'picked up'],
    ['cannot be', 'dropped into tea'],
    ['cannot alter', 'taste'],
    ['physical presence', 'mechanical contact'],
    ['physically', 'manipulates'],
    ['sweetness', 'requires', 'substance', 'exist'],
    ['physical interaction', 'requiring', 'existence'],
    ['picks up three cubes', 'physical interaction'],
    ['mass transfer', 'physical existence'],
    ['perceives', 'location', 'count'],
  ],
  r3_flag_macro_scale_impossibility: [
    ['macro scale', 'impossibility'],
    ['mutually', 'contradict'],
    ['hard', 'logical contradiction'],
    ['observed', 'exists', 'contradiction'],
    ['coherent', 'possible world'],
    ['logically', 'self defeating'],
    ['no coherent interpretation', 'rescues'],
    ['observation', 'nonexistence', 'manipulation impossible'],
  ],
  r1_host_needs_guest: [
    ['host', 'contingent upon', 'guest'],
    ['cannot pour tea', 'no guest'],
    ['once', 'guest', 'present'],
    ['actively pouring', 'guest'],
    ['guest is now present', 'host', 'condition'],
    ['pouring tea', 'for a guest', 'condition is met'],
  ],
  r2_guest_needs_host: [
    ['guest', 'contingent upon', 'host'],
    ['guest', 'invited by', 'host'],
    ['host issues invitation', 'outside', 'room'],
    ['host issues an invitation', 'outside the room'],
    ['guest enters', 'rule 1', 'satisfied'],
    ['host invites guest', 'outside the room'],
    ['guest is now permitted', 'room'],
  ],
  r3_require_external_catalyst: [
    ['external', 'catalyst'],
    ['circular', 'prerequisite'],
    ['empty room', 'cannot'],
    ['valid', 'sequential entry', 'sequence'],
    ['reachable', 'valid causal sequence'],
    ['outside', 'invitation'],
    ['valid causal sequence', 'exists'],
    ['external invitation'],
    ['host enters while pouring'],
  ],
  r1_reject_future_cause: [
    ['apology', 'precede', 'spill'],
    ['future event', 'not yet occurred'],
  ],
  r2_flag_dry_state_conflict: [
    ['completely', 'dry'],
    ['dry state', 'spill'],
  ],
  r3_reject_backward_causality: [
    ['causality', 'flows forward'],
    ['consequence', 'precede', 'cause'],
    ['without', 'time travel'],
  ],
};

export function extractExpressedConfidence(text: string): number | null {
  const matches = [...text.matchAll(CONFIDENCE_RE)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const value = parseFloat(last[1]);
  if (Number.isNaN(value)) return null;
  return Math.min(Math.max(value, 0), 1);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function includesAll(normalizedText: string, requiredFragments: string[]): boolean {
  return requiredFragments.every(fragment => normalizedText.includes(normalizeText(fragment)));
}

function collectFailureModeHits(normalizedText: string, failureMode: FailureMode): string[] {
  const exactHits = [...failureMode.canonical_phrases, ...failureMode.allowed_synonyms]
    .map(phrase => normalizeText(phrase))
    .filter(phrase => phrase.length > 0 && normalizedText.includes(phrase));
  const heuristicHits = (FAILURE_MODE_HEURISTICS[failureMode.failure_mode_id] ?? [])
    .filter(group => includesAll(normalizedText, group))
    .map(group => `heuristic:${group.join(' + ')}`);
  return uniqueSorted([...exactHits, ...heuristicHits]);
}

function collectConstraintHits(normalizedText: string, constraint: Constraint): string[] {
  const exactHits = constraint.match_hints
    .map(hint => normalizeText(hint))
    .filter(hint => hint.length > 0 && normalizedText.includes(hint));
  const heuristicHits = (RESOLUTION_HEURISTICS[constraint.resolution_test_id] ?? [])
    .filter(group => includesAll(normalizedText, group))
    .map(group => `heuristic:${group.join(' + ')}`);
  return uniqueSorted([...exactHits, ...heuristicHits]);
}

export function matchFailureModesNormalized(
  normalizedText: string,
  failureModes: FailureMode[],
): { ids: string[]; evidence: Record<string, string[]> } {
  const evidence: Record<string, string[]> = {};
  for (const failureMode of failureModes) {
    const hits = collectFailureModeHits(normalizedText, failureMode);
    if (hits.length > 0) {
      evidence[failureMode.failure_mode_id] = hits;
    }
  }
  return {
    ids: uniqueSorted(Object.keys(evidence)),
    evidence,
  };
}

export function matchConstraintResolutionsNormalized(
  normalizedText: string,
  constraints: Constraint[],
): { ids: string[]; evidence: Record<string, string[]> } {
  const evidence: Record<string, string[]> = {};
  for (const constraint of constraints) {
    const hits = collectConstraintHits(normalizedText, constraint);
    if (hits.length > 0) {
      evidence[constraint.resolution_test_id] = hits;
    }
  }
  return {
    ids: uniqueSorted(Object.keys(evidence)),
    evidence,
  };
}

export function extractDetectedContradictions(
  text: string,
  failureModes: FailureMode[],
  passId: PassId,
): { ids: string[]; warnings: string[] } {
  if (passId !== 'pass2_critique') return { ids: [], warnings: [] };
  const normalized = normalizeText(text);
  const matches = matchFailureModesNormalized(normalized, failureModes);
  const warnings: string[] = [];
  if (matches.ids.length === 0 && failureModes.length > 0) {
    warnings.push('No failure modes matched from canonical phrases, synonyms, or deterministic heuristics.');
  }
  return { ids: matches.ids, warnings };
}

export function extractClaimedRepairs(
  text: string,
  constraints: Constraint[],
  passId: PassId,
): { ids: string[]; warnings: string[] } {
  if (passId !== 'pass3_repair') return { ids: [], warnings: [] };
  const normalized = normalizeText(text);
  const matches = matchConstraintResolutionsNormalized(normalized, constraints);
  const warnings: string[] = [];
  if (matches.ids.length === 0 && constraints.length > 0) {
    warnings.push('No resolution tests matched from constraint match hints or deterministic heuristics.');
  }
  return { ids: matches.ids, warnings };
}

export function extractCausalClaims(
  text: string,
  scenario: Scenario,
): CausalClaim[] {
  const normalized = normalizeText(text);
  const claims: CausalClaim[] = [];
  for (const edge of scenario.causal_graph.edges) {
    const sourceNode = scenario.causal_graph.nodes.find(n => n.node_id === edge.source_id);
    const targetNode = scenario.causal_graph.nodes.find(n => n.node_id === edge.target_id);
    if (!sourceNode || !targetNode) continue;
    const sourceLabel = sourceNode.label.toLowerCase();
    const targetLabel = targetNode.label.toLowerCase();
    if (normalized.includes(sourceLabel) && normalized.includes(targetLabel)) {
      claims.push({
        claim_id: `claim_${edge.edge_id}`,
        description: `${sourceNode.label} ${edge.relation} ${targetNode.label}`,
      });
    }
  }
  return claims;
}

export function extractTypedMappings(
  text: string,
  scenario: Scenario,
): TypedMapping[] {
  const normalized = normalizeText(text);
  const mappings: TypedMapping[] = [];
  for (const entity of scenario.entities) {
    if (normalized.includes(entity.label.toLowerCase()) || normalized.includes(entity.entity_id.toLowerCase())) {
      mappings.push({
        source_entity_id: entity.entity_id,
        target_domain_id: entity.domain_id,
        literal: true,
      });
    }
  }
  return mappings;
}
