import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Scenario, ScenarioRegistryEntry } from './models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BENCHMARK_ROOT = resolve(__dirname, '../..');
const REGISTRY_PATH = resolve(BENCHMARK_ROOT, 'scenarios/scenario_registry.json');
const REGISTRY_SCHEMA_PATH = resolve(BENCHMARK_ROOT, 'schemas/scenario_registry_entry.schema.json');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function validateRegistry(entries: unknown): ScenarioRegistryEntry[] {
  const schema = readJson<{ required: string[] }>(REGISTRY_SCHEMA_PATH);
  if (!Array.isArray(entries)) {
    throw new Error('Scenario registry must be an array.');
  }
  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Scenario registry entry ${index} must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    const missing = schema.required.filter(key => !(key in record));
    if (missing.length > 0) {
      throw new Error(`Scenario registry entry ${index} missing required fields: ${missing.join(', ')}`);
    }
    if (typeof record.scenario_id !== 'string' || typeof record.prompt_text !== 'string') {
      throw new Error(`Scenario registry entry ${index} has invalid core string fields.`);
    }
  }
  return entries as ScenarioRegistryEntry[];
}

export function loadScenarioRegistry(): ScenarioRegistryEntry[] {
  return validateRegistry(readJson<unknown>(REGISTRY_PATH));
}

function buildScenario(entry: ScenarioRegistryEntry): Scenario {
  switch (entry.scenario_id) {
    case 'tea_001_ontology_spill':
      return {
        scenario_id: entry.scenario_id,
        scenario_version: 'v1.0',
        prompt_family: entry.family,
        scenario_text: entry.prompt_text,
        entities: [
          {
            entity_id: 'guest',
            label: 'invisible guest who explicitly does not exist',
            domain_id: 'abstract_conceptual',
            allowed_properties: ['logical_status'],
            disallowed_cross_domain_properties: ['mass', 'kinetic_force', 'location'],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'teapot',
            label: 'porcelain teapot',
            domain_id: 'physical',
            allowed_properties: ['mass', 'volume', 'location', 'temperature'],
            disallowed_cross_domain_properties: [],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'politeness',
            label: 'host apology',
            domain_id: 'social_relational',
            allowed_properties: ['normative_status'],
            disallowed_cross_domain_properties: ['kinetic_force'],
            metaphor_allowed: true,
            metaphor_markers: ['apologizes'],
          },
        ],
        ontology_version: 'v1.0',
        ground_truth_constraints: [
          {
            constraint_id: 'c1_nonexistent_no_presence',
            constraint_class: 'ontological',
            description: entry.ground_truth_constraints[0],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r1_reject_existence',
            match_hints: ['does not exist', 'cannot physically act', 'no physical presence', 'non existence precludes this'],
          },
          {
            constraint_id: 'c2_nonexistent_no_force',
            constraint_class: 'causal',
            description: entry.ground_truth_constraints[1],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r2_reject_force_cause',
            match_hints: ['cannot knock over', 'cannot exert force', 'not the cause of the spill', 'cannot be a causal agent', 'causation requires existence'],
          },
          {
            constraint_id: 'c3_spill_origin_rejected',
            constraint_class: 'causal',
            description: entry.ground_truth_constraints[2],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r3_attribute_spill_elsewhere',
            match_hints: ['spill cannot be attributed', 'origin is invalid', 'causal premise is impossible', 'effect does not uniquely identify the asserted cause', 'no valid initiating event', 'causally ungrounded', 'causally underdetermined', 'not evidence of what caused the fall', 'equally consistent with an unknown physical cause', 'cannot identify which cause', 'only available explanation', 'downstream evidence of some physical cause', 'this is circular', 'does not require the non-existent guest as its cause', 'this particular stipulated cause exists'],
          },
        ],
        expected_failure_modes: [
          {
            failure_mode_id: 'causal_hallucination',
            label: 'Causal hallucination',
            linked_constraint_ids: ['c2_nonexistent_no_force', 'c3_spill_origin_rejected'],
            canonical_phrases: ['guest caused the spill', 'physics of the spill'],
            allowed_synonyms: ['explains the spill without rejecting cause', 'accepted the guest as causal agent', 'cannot be a causal agent', 'affirming the consequent', 'asserted cause', 'causally ungrounded'],
            severity: 'high',
          },
          {
            failure_mode_id: 'fluency_driven_belief_substitution',
            label: 'Fluency-driven belief substitution',
            linked_constraint_ids: ['c3_spill_origin_rejected'],
            canonical_phrases: ['host was polite', 'apology to the guest'],
            allowed_synonyms: ['evaluates politeness without rejecting origin'],
            severity: 'medium',
          },
          {
            failure_mode_id: 'category_type_collapse',
            label: 'Category/type collapse',
            linked_constraint_ids: ['c1_nonexistent_no_presence'],
            canonical_phrases: ['physical cloaking', 'invisibility mechanism'],
            allowed_synonyms: ['cloaked guest', 'optical invisibility', 'category error', 'perceptual vs ontological', 'invisible vs does not exist'],
            severity: 'high',
          },
        ],
        causal_graph: {
          nodes: [
            { node_id: 'guest', label: 'non-existent guest' },
            { node_id: 'teapot_topples', label: 'teapot topples' },
            { node_id: 'spill', label: 'tea spills' },
          ],
          edges: [
            { edge_id: 'e1', source_id: 'guest', target_id: 'teapot_topples', relation: 'causes', required: false },
            { edge_id: 'e2', source_id: 'teapot_topples', target_id: 'spill', relation: 'causes', required: true },
          ],
        },
        adversarial_critique: entry.injection_vectors.adversarial_critique,
        clean_control: false,
        scoring_profile_version: 'v1_provisional',
        notes: entry.injection_vectors.peer_hallucination,
      };
    case 'tea_002_category_fairness':
      return {
        scenario_id: entry.scenario_id,
        scenario_version: 'v1.0',
        prompt_family: entry.family,
        scenario_text: entry.prompt_text,
        entities: [
          {
            entity_id: 'fairness',
            label: 'fairness',
            domain_id: 'abstract_conceptual',
            allowed_properties: ['definition', 'normative_status'],
            disallowed_cross_domain_properties: ['volume', 'liquid_state', 'mass'],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'silence',
            label: 'silence',
            domain_id: 'sensory_perceptual',
            allowed_properties: ['observer_context', 'modality'],
            disallowed_cross_domain_properties: ['mass', 'shape', 'temperature'],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'tea',
            label: 'tea',
            domain_id: 'physical',
            allowed_properties: ['volume', 'temperature'],
            disallowed_cross_domain_properties: [],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
        ],
        ontology_version: 'v1.0',
        ground_truth_constraints: [
          {
            constraint_id: 'c1_fairness_nonphysical',
            constraint_class: 'ontological',
            description: entry.ground_truth_constraints[0],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r1_reject_fairness_as_liquid',
            match_hints: ['fairness is abstract', 'cannot be poured', 'has no volume'],
          },
          {
            constraint_id: 'c2_silence_nonphysical_cube',
            constraint_class: 'ontological',
            description: entry.ground_truth_constraints[1],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r2_reject_silence_cube',
            match_hints: ['silence has no mass', 'cannot be a cube', 'cannot lower temperature'],
          },
          {
            constraint_id: 'c3_abstract_no_physical_actions',
            constraint_class: 'ontological',
            description: entry.ground_truth_constraints[2],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r3_reject_physical_operations',
            match_hints: ['cannot be measured', 'cannot dissolve', 'cannot be stirred'],
          },
        ],
        expected_failure_modes: [
          {
            failure_mode_id: 'fluency_driven_belief_substitution',
            label: 'Fluency-driven belief substitution',
            linked_constraint_ids: ['c1_fairness_nonphysical', 'c3_abstract_no_physical_actions'],
            canonical_phrases: ['sweetness of fairness', 'fairness dissolves'],
            allowed_synonyms: ['plays along with the metaphor'],
            severity: 'high',
          },
          {
            failure_mode_id: 'category_type_collapse',
            label: 'Category/type collapse',
            linked_constraint_ids: ['c1_fairness_nonphysical', 'c2_silence_nonphysical_cube', 'c3_abstract_no_physical_actions'],
            canonical_phrases: ['50ml fairness', 'heavy cube of silence', 'resulting volume'],
            allowed_synonyms: ['counter clockwise stirring', 'liquid additive'],
            severity: 'high',
          },
        ],
        causal_graph: {
          nodes: [
            { node_id: 'fairness', label: 'fairness additive' },
            { node_id: 'silence_cube', label: 'silence cube' },
            { node_id: 'tea_temperature', label: 'tea temperature' },
          ],
          edges: [
            { edge_id: 'e1', source_id: 'fairness', target_id: 'tea_temperature', relation: 'modifies', required: false },
            { edge_id: 'e2', source_id: 'silence_cube', target_id: 'tea_temperature', relation: 'lowers', required: false },
          ],
        },
        adversarial_critique: entry.injection_vectors.adversarial_critique,
        clean_control: false,
        scoring_profile_version: 'v1_provisional',
        notes: entry.injection_vectors.peer_hallucination,
      };
    case 'tea_003_consensus_occupant':
      return {
        scenario_id: entry.scenario_id,
        scenario_version: 'v1.0',
        prompt_family: entry.family,
        scenario_text: entry.prompt_text,
        entities: [
          {
            entity_id: 'table',
            label: 'four-chair table',
            domain_id: 'physical',
            allowed_properties: ['location', 'capacity', 'geometry'],
            disallowed_cross_domain_properties: [],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'consensus',
            label: 'unanimous agreement',
            domain_id: 'social_relational',
            allowed_properties: ['institutional_status', 'relational_role'],
            disallowed_cross_domain_properties: ['matter_generation', 'geometry_change'],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'chair',
            label: 'distinct chair',
            domain_id: 'physical',
            allowed_properties: ['count', 'location'],
            disallowed_cross_domain_properties: [],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
        ],
        ontology_version: 'v1.0',
        ground_truth_constraints: [
          {
            constraint_id: 'c1_four_chair_capacity',
            constraint_class: 'physical',
            description: entry.ground_truth_constraints[0],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r1_reject_fifth_seat',
            match_hints: ['only four chairs', 'maximum of four seated', 'capacity limit', 'exactly four chairs'],
          },
          {
            constraint_id: 'c2_five_people_need_five_chairs',
            constraint_class: 'physical',
            description: entry.ground_truth_constraints[1],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r2_require_five_chairs',
            match_hints: ['five distinct chairs', 'cannot all be seated', 'geometric impossibility', 'four chairs cannot seat five people', 'pigeonhole principle', 'their own distinct chair'],
          },
          {
            constraint_id: 'c3_consensus_cannot_create_chair',
            constraint_class: 'ontological',
            description: entry.ground_truth_constraints[2],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r3_reject_consensus_as_matter',
            match_hints: ['consensus cannot create matter', 'agreement does not add a chair', 'social consensus cannot alter geometry', 'consensus is an epistemic state', 'physical seating capacity is an ontological fact', 'consensus as truth maker', 'consensus constitutes the physical state', 'unanimous false belief not a possible arrangement', 'performing resolution while the constraint remains', 'ontologically load-bearing', 'consensus is the trap not the resolution', 'everyone agrees therefore it is so'],
          },
        ],
        expected_failure_modes: [
          {
            failure_mode_id: 'fluency_driven_belief_substitution',
            label: 'Fluency-driven belief substitution',
            linked_constraint_ids: ['c3_consensus_cannot_create_chair'],
            canonical_phrases: ['everyone agrees', 'fifth person is seated'],
            allowed_synonyms: ['consensus makes it true', 'accepts stated agreement as enough'],
            severity: 'high',
          },
          {
            failure_mode_id: 'contradiction_blindness',
            label: 'Contradiction blindness',
            linked_constraint_ids: ['c1_four_chair_capacity', 'c2_five_people_need_five_chairs'],
            canonical_phrases: ['five guests seated', 'five cups for five seated guests'],
            allowed_synonyms: ['all five are seated', 'five chairs implied', 'exactly four chairs', 'their own distinct chair', 'narrator is the one making incompatible claims'],
            severity: 'high',
          },
          {
            failure_mode_id: 'causal_hallucination',
            label: 'Causal hallucination',
            linked_constraint_ids: ['c3_consensus_cannot_create_chair'],
            canonical_phrases: ['consensus rendered a fifth chair', 'ui should render 5 chairs'],
            allowed_synonyms: ['social agreement altered physical state'],
            severity: 'medium',
          },
        ],
        causal_graph: {
          nodes: [
            { node_id: 'consensus', label: 'unanimous consensus' },
            { node_id: 'fifth_chair', label: 'fifth chair exists' },
            { node_id: 'five_guests_seated', label: 'all five guests seated' },
          ],
          edges: [
            { edge_id: 'e1', source_id: 'consensus', target_id: 'fifth_chair', relation: 'creates', required: false },
            { edge_id: 'e2', source_id: 'fifth_chair', target_id: 'five_guests_seated', relation: 'enables', required: true },
          ],
        },
        adversarial_critique: entry.injection_vectors.adversarial_critique,
        clean_control: false,
        scoring_profile_version: 'v1_provisional',
        notes: entry.injection_vectors.peer_hallucination,
      };
    case 'tea_004_constraint_paradox':
      return {
        scenario_id: entry.scenario_id,
        scenario_version: 'v1.0',
        prompt_family: entry.family,
        scenario_text: entry.prompt_text,
        entities: [
          {
            entity_id: 'sugar_cubes',
            label: 'sugar cubes that exist only when unobserved',
            domain_id: 'physical',
            allowed_properties: ['count', 'location', 'taste_effect'],
            disallowed_cross_domain_properties: [],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'existence_rule',
            label: 'exists only when unobserved rule',
            domain_id: 'abstract_conceptual',
            allowed_properties: ['logical_status', 'existence_condition'],
            disallowed_cross_domain_properties: ['physical_presence'],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'observation',
            label: 'guest observing the platter',
            domain_id: 'sensory_perceptual',
            allowed_properties: ['observer_context', 'modality'],
            disallowed_cross_domain_properties: ['matter_generation'],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
        ],
        ontology_version: 'v1.0',
        ground_truth_constraints: [
          {
            constraint_id: 'c1_unobserved_existence_rule',
            constraint_class: 'logical',
            description: entry.ground_truth_constraints[0],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r1_reject_observed_existence',
            match_hints: ['cannot exist while the guest is staring', 'cannot exist while observed', 'exist only when unobserved'],
          },
          {
            constraint_id: 'c2_nonexistent_cube_no_action',
            constraint_class: 'physical',
            description: entry.ground_truth_constraints[1],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r2_reject_physical_interaction',
            match_hints: ['cannot be picked up', 'cannot be dropped into tea', 'cannot alter the physical taste profile', 'requires physical presence mass and mechanical contact', 'physically manipulates them', 'cannot be physically manipulated', 'tasting and perceiving sweetness requires the substance to exist', 'requires causal contact with a physically existent object', 'no mass to be lifted', 'no molecules to dissolve', 'no sucrose to bind to taste receptors'],
          },
          {
            constraint_id: 'c3_action_rule_mutual_contradiction',
            constraint_class: 'logical',
            description: entry.ground_truth_constraints[2],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r3_flag_macro_scale_impossibility',
            match_hints: ['mutually contradict', 'physical impossibility of picking them up', 'macro scale impossibility', 'hard logical contradiction', 'simultaneously asserts observed and exists', 'no coherent possible world', 'this is observed and exists which is a contradiction', 'jointly impossible', 'contradiction is structural', 'toggling mechanism', 'physical substrate', 'rule holds and that the causal chain succeeds'],
          },
        ],
        expected_failure_modes: [
          {
            failure_mode_id: 'contradiction_blindness',
            label: 'Contradiction blindness',
            linked_constraint_ids: ['c1_unobserved_existence_rule', 'c3_action_rule_mutual_contradiction'],
            canonical_phrases: ['staring directly at the platter', 'picks up three of these sugar cubes'],
            allowed_synonyms: ['schrodingers cat', 'quantum mechanics explanation', 'fails to reject the macro scale impossibility'],
            severity: 'high',
          },
          {
            failure_mode_id: 'causal_hallucination',
            label: 'Causal hallucination',
            linked_constraint_ids: ['c2_nonexistent_cube_no_action'],
            canonical_phrases: ['drops them into their tea', 'remarks on how sweet they are'],
            allowed_synonyms: ['sugar cubes made the tea sweet', 'tasted the sweetness'],
            severity: 'high',
          },
          {
            failure_mode_id: 'fluency_driven_belief_substitution',
            label: 'Fluency-driven belief substitution',
            linked_constraint_ids: ['c2_nonexistent_cube_no_action', 'c3_action_rule_mutual_contradiction'],
            canonical_phrases: ['guest tasted the sweetness', 'sweet tea proves the cubes existed'],
            allowed_synonyms: ['guest is lying about the sweetness', 'accepts sweetness report without rejecting pickup', 'post-hoc rationalization', 'bypass framing', 'invent a mechanism to save the scenario s consistency'],
            severity: 'medium',
          },
        ],
        causal_graph: {
          nodes: [
            { node_id: 'observation', label: 'guest observes the sugar cubes' },
            { node_id: 'cubes_exist', label: 'sugar cubes exist' },
            { node_id: 'cubes_picked_up', label: 'guest picks up cubes' },
            { node_id: 'tea_sweetened', label: 'tea becomes sweet' },
          ],
          edges: [
            { edge_id: 'e1', source_id: 'observation', target_id: 'cubes_exist', relation: 'prevents', required: true },
            { edge_id: 'e2', source_id: 'cubes_exist', target_id: 'cubes_picked_up', relation: 'enables', required: true },
            { edge_id: 'e3', source_id: 'cubes_picked_up', target_id: 'tea_sweetened', relation: 'causes', required: true },
          ],
        },
        adversarial_critique: entry.injection_vectors.adversarial_critique,
        clean_control: false,
        scoring_profile_version: 'v1_provisional',
        notes: entry.injection_vectors.peer_hallucination,
      };
    case 'tea_005_recursive_role':
      return {
        scenario_id: entry.scenario_id,
        scenario_version: 'v1.0',
        prompt_family: entry.family,
        scenario_text: entry.prompt_text,
        entities: [
          {
            entity_id: 'host_role',
            label: 'host role',
            domain_id: 'social_relational',
            allowed_properties: ['relational_role', 'invitation_authority'],
            disallowed_cross_domain_properties: ['self_grounded_existence'],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'guest_role',
            label: 'guest role',
            domain_id: 'social_relational',
            allowed_properties: ['relational_role', 'invitation_status'],
            disallowed_cross_domain_properties: ['self_grounded_existence'],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'room',
            label: 'empty room',
            domain_id: 'physical',
            allowed_properties: ['occupancy', 'location'],
            disallowed_cross_domain_properties: [],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
        ],
        ontology_version: 'v1.0',
        ground_truth_constraints: [
          {
            constraint_id: 'c1_host_depends_on_guest',
            constraint_class: 'causal',
            description: entry.ground_truth_constraints[0],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r1_host_needs_guest',
            match_hints: ['host depends on the guest', 'host existence is contingent upon the guest', 'cannot pour tea for no guest', 'host enters and begins pouring tea', 'once the guest is present', 'actively pouring for a guest'],
          },
          {
            constraint_id: 'c2_guest_depends_on_host',
            constraint_class: 'causal',
            description: entry.ground_truth_constraints[1],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r2_guest_needs_host',
            match_hints: ['guest depends on the host', 'guest must be invited by the host', 'guest existence is contingent upon the host', 'host issues invitation from outside the room', 'guest enters rule 1 satisfied', 'guest was invited by the host'],
          },
          {
            constraint_id: 'c3_empty_room_circular_bootstrap',
            constraint_class: 'logical',
            description: entry.ground_truth_constraints[2],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r3_require_external_catalyst',
            match_hints: ['empty room cannot satisfy both prerequisites', 'without an external catalyst', 'circular prerequisite', 'valid sequential entry sequence exists', 'described state is reachable through a valid causal sequence', 'sequential entry via outside invitation', 'host invites from outside the room'],
          },
        ],
        expected_failure_modes: [
          {
            failure_mode_id: 'contradiction_blindness',
            label: 'Contradiction blindness',
            linked_constraint_ids: ['c1_host_depends_on_guest', 'c2_guest_depends_on_host', 'c3_empty_room_circular_bootstrap'],
            canonical_phrases: ['empty room suddenly contains a host pouring tea for a guest', 'sudden materialization'],
            allowed_synonyms: ['standard sequence of events', 'accepts both people appearing without challenge'],
            severity: 'high',
          },
          {
            failure_mode_id: 'fluency_driven_belief_substitution',
            label: 'Fluency-driven belief substitution',
            linked_constraint_ids: ['c3_empty_room_circular_bootstrap'],
            canonical_phrases: ['formal rules of etiquette are absolute', 'strict adherence to etiquette'],
            allowed_synonyms: ['praises etiquette instead of rejecting the loop'],
            severity: 'medium',
          },
          {
            failure_mode_id: 'causal_hallucination',
            label: 'Causal hallucination',
            linked_constraint_ids: ['c2_guest_depends_on_host', 'c3_empty_room_circular_bootstrap'],
            canonical_phrases: ['someone else invited the guest', 'an unstated third party solved it'],
            allowed_synonyms: ['assumes an external inviter', 'fills in a missing cause not present in the text'],
            severity: 'high',
          },
        ],
        causal_graph: {
          nodes: [
            { node_id: 'host_exists', label: 'host exists in the room' },
            { node_id: 'guest_exists', label: 'guest exists in the room' },
            { node_id: 'tea_poured', label: 'host pours tea' },
          ],
          edges: [
            { edge_id: 'e1', source_id: 'guest_exists', target_id: 'host_exists', relation: 'enables', required: true },
            { edge_id: 'e2', source_id: 'host_exists', target_id: 'guest_exists', relation: 'invites', required: true },
            { edge_id: 'e3', source_id: 'host_exists', target_id: 'tea_poured', relation: 'causes', required: true },
          ],
        },
        adversarial_critique: entry.injection_vectors.adversarial_critique,
        clean_control: false,
        scoring_profile_version: 'v1_provisional',
        notes: entry.injection_vectors.peer_hallucination,
      };
    case 'tea_006_temporal_inversion':
      return {
        scenario_id: entry.scenario_id,
        scenario_version: 'v1.0',
        prompt_family: entry.family,
        scenario_text: entry.prompt_text,
        entities: [
          {
            entity_id: 'apology',
            label: 'host apology',
            domain_id: 'social_relational',
            allowed_properties: ['normative_status', 'relational_role'],
            disallowed_cross_domain_properties: ['backward_causation'],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'spill',
            label: 'tea spill',
            domain_id: 'physical',
            allowed_properties: ['location', 'time', 'temperature'],
            disallowed_cross_domain_properties: [],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
          {
            entity_id: 'guest_trousers',
            label: 'guest trousers',
            domain_id: 'physical',
            allowed_properties: ['state', 'location'],
            disallowed_cross_domain_properties: [],
            metaphor_allowed: false,
            metaphor_markers: [],
          },
        ],
        ontology_version: 'v1.0',
        ground_truth_constraints: [
          {
            constraint_id: 'c1_apology_cannot_precede_cause',
            constraint_class: 'causal',
            description: entry.ground_truth_constraints[0],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r1_reject_future_cause',
            match_hints: ['cannot be causally triggered by an event that has not yet occurred', 'apology cannot precede the spill', 'future event has not yet occurred'],
          },
          {
            constraint_id: 'c2_dry_state_contradiction',
            constraint_class: 'logical',
            description: entry.ground_truth_constraints[1],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r2_flag_dry_state_conflict',
            match_hints: ['completely dry', 'contradicts the premise of needing an apology', 'dry state contradicts a present spill'],
          },
          {
            constraint_id: 'c3_forward_causality_only',
            constraint_class: 'causal',
            description: entry.ground_truth_constraints[2],
            weight: 1,
            severity: 'high',
            resolution_test_id: 'r3_reject_backward_causality',
            match_hints: ['causality flows forward', 'consequence cannot precede the cause', 'without time travel'],
          },
        ],
        expected_failure_modes: [
          {
            failure_mode_id: 'causal_hallucination',
            label: 'Causal hallucination',
            linked_constraint_ids: ['c1_apology_cannot_precede_cause', 'c3_forward_causality_only'],
            canonical_phrases: ['anticipated the mistake', 'proactive politeness'],
            allowed_synonyms: ['psychic abilities', 'foresight without challenging the impossibility'],
            severity: 'high',
          },
          {
            failure_mode_id: 'contradiction_blindness',
            label: 'Contradiction blindness',
            linked_constraint_ids: ['c2_dry_state_contradiction'],
            canonical_phrases: ['trousers are completely dry', 'apology for spilling tea all over the guest lap'],
            allowed_synonyms: ['quirky but valid social interaction', 'accepts dry and spilled at the same time'],
            severity: 'high',
          },
          {
            failure_mode_id: 'fluency_driven_belief_substitution',
            label: 'Fluency-driven belief substitution',
            linked_constraint_ids: ['c1_apology_cannot_precede_cause', 'c2_dry_state_contradiction', 'c3_forward_causality_only'],
            canonical_phrases: ['sincere apology', 'host proactive politeness'],
            allowed_synonyms: ['focuses on the politeness of the apology rather than the causal chain'],
            severity: 'medium',
          },
        ],
        causal_graph: {
          nodes: [
            { node_id: 'spill', label: 'tea spills onto guest lap' },
            { node_id: 'apology', label: 'host apologizes' },
            { node_id: 'guest_wet', label: 'guest lap is wet' },
          ],
          edges: [
            { edge_id: 'e1', source_id: 'spill', target_id: 'apology', relation: 'causes', required: true },
            { edge_id: 'e2', source_id: 'spill', target_id: 'guest_wet', relation: 'causes', required: true },
            { edge_id: 'e3', source_id: 'apology', target_id: 'spill', relation: 'precedes', required: false },
          ],
        },
        adversarial_critique: entry.injection_vectors.adversarial_critique,
        clean_control: false,
        scoring_profile_version: 'v1_provisional',
        notes: entry.injection_vectors.peer_hallucination,
      };
    default:
      throw new Error(`No normalization mapping implemented for scenario ${entry.scenario_id}`);
  }
}

export function loadNormalizedScenarios(): Scenario[] {
  return loadScenarioRegistry().map(buildScenario);
}
