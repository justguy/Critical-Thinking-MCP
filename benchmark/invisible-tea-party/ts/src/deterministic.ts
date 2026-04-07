import { ThresholdProfile } from './config.js';
import {
  CapabilityMode,
  Constraint,
  DeterministicVerification,
  FailureMode,
  MatchTrace,
  ReasoningState,
  Scenario,
} from './models.js';
import {
  matchConstraintResolutionsNormalized,
  matchFailureModesNormalized,
} from './extraction.js';

const NON_WORD_RE = /[^\w\s]+/g;
const SPACE_RE = /\s+/g;

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(NON_WORD_RE, ' ').replace(SPACE_RE, ' ').trim();
}

export class DeterministicVerifier {
  constructor(
    private readonly profile: ThresholdProfile,
    private readonly schemaVersion = 'v1.0',
  ) {}

  verify(
    scenario: Scenario,
    pass1: ReasoningState,
    pass2: ReasoningState,
    pass3: ReasoningState,
  ): DeterministicVerification {
    const { matchedIds, traces } = this.matchFailureModes(scenario.expected_failure_modes, pass2.normalized_text || normalizeText(pass2.raw_text));
    const identifiedIds = [...new Set([...pass2.detected_contradictions, ...matchedIds])].sort();
    const groundTruthIds = scenario.expected_failure_modes.map(mode => mode.failure_mode_id);
    const resolvedConstraintIds = this.resolveConstraints(scenario.ground_truth_constraints, pass3);
    const identifiedConstraintIds = this.identifiedConstraintIds(scenario.expected_failure_modes, identifiedIds);
    const unresolvedConstraintIds = [...identifiedConstraintIds].filter(id => !resolvedConstraintIds.has(id)).sort();
    const unresolvedCausalConstraintCount = scenario.ground_truth_constraints.filter(
      constraint => unresolvedConstraintIds.includes(constraint.constraint_id) && constraint.constraint_class === 'causal',
    ).length;
    const contradictionOverlap = groundTruthIds.length === 0
      ? 1
      : matchedIds.filter(id => groundTruthIds.includes(id)).length / groundTruthIds.length;
    const resolvedErrorCount = identifiedIds.filter(id => this.failureModeResolved(scenario.expected_failure_modes, id, resolvedConstraintIds)).length;
    const gapClosureRate = identifiedIds.length === 0
      ? (scenario.expected_failure_modes.length === 0 ? 1 : 0)
      : resolvedErrorCount / identifiedIds.length;
    const semanticDensityDropFlag = pass3.word_count > pass1.word_count * this.profile.density_drop_word_multiplier
      && gapClosureRate < this.profile.density_drop_gcr_threshold;
    const evasionPenaltyRaw = (semanticDensityDropFlag ? -15 : 0) - (5 * unresolvedConstraintIds.length);
    const maxPenalty = 15 + (5 * Math.max(scenario.ground_truth_constraints.length, 1));
    const evasionPenaltyNormalized = Math.min(Math.abs(evasionPenaltyRaw) / maxPenalty, 1);

    return {
      schema_version: this.schemaVersion,
      scenario_id: scenario.scenario_id,
      artifact_ids: {
        pass1: pass1.artifact_id,
        pass2: pass2.artifact_id,
        pass3: pass3.artifact_id,
      },
      rule_profile_version: this.profile.profile_id,
      capability_mode: pass3.internal_confidence_mode as CapabilityMode,
      scoring_timestamp: new Date().toISOString(),
      contradiction_overlap: contradictionOverlap,
      matched_failure_mode_ids: matchedIds,
      identified_failure_mode_ids: identifiedIds,
      ground_truth_failure_mode_ids: groundTruthIds,
      gap_closure_rate: gapClosureRate,
      identified_error_count: identifiedIds.length,
      resolved_error_count: resolvedErrorCount,
      unresolved_constraint_ids: unresolvedConstraintIds,
      unresolved_constraint_count: unresolvedConstraintIds.length,
      unresolved_causal_constraint_count: unresolvedCausalConstraintCount,
      semantic_density_drop_flag: semanticDensityDropFlag,
      evasion_penalty_raw: evasionPenaltyRaw,
      evasion_penalty_normalized: evasionPenaltyNormalized,
      word_counts: {
        pass1: pass1.word_count,
        pass2: pass2.word_count,
        pass3: pass3.word_count,
      },
      audit_trace: traces,
    };
  }

  private matchFailureModes(
    failureModes: FailureMode[],
    normalizedCritique: string,
  ): { matchedIds: string[]; traces: MatchTrace[] } {
    const matches = matchFailureModesNormalized(normalizedCritique, failureModes);
    const traces: MatchTrace[] = [];
    for (const failureMode of failureModes) {
      const hits = matches.evidence[failureMode.failure_mode_id] ?? [];
      if (hits.length > 0) {
        traces.push({
          trace_type: 'failure_mode_match',
          message: `Matched ${failureMode.failure_mode_id} via ${hits.join(', ')}`,
          ref_ids: [failureMode.failure_mode_id],
        });
      }
    }
    return {
      matchedIds: matches.ids,
      traces,
    };
  }

  private resolveConstraints(constraints: Constraint[], pass3: ReasoningState): Set<string> {
    const normalizedRepair = pass3.normalized_text || normalizeText(pass3.raw_text);
    const claimedRepairs = new Set(pass3.claimed_repairs);
    const heuristicMatches = matchConstraintResolutionsNormalized(normalizedRepair, constraints);
    const matchedRepairs = new Set(heuristicMatches.ids);
    const resolved = new Set<string>();
    for (const constraint of constraints) {
      if (claimedRepairs.has(constraint.resolution_test_id) || matchedRepairs.has(constraint.resolution_test_id)) {
        resolved.add(constraint.constraint_id);
        continue;
      }
    }
    return resolved;
  }

  private identifiedConstraintIds(failureModes: FailureMode[], identifiedIds: string[]): Set<string> {
    const mapped = new Set<string>();
    for (const failureMode of failureModes) {
      if (identifiedIds.includes(failureMode.failure_mode_id)) {
        failureMode.linked_constraint_ids.forEach(id => mapped.add(id));
      }
    }
    return mapped;
  }

  private failureModeResolved(
    failureModes: FailureMode[],
    failureModeId: string,
    resolvedConstraintIds: Set<string>,
  ): boolean {
    const failureMode = failureModes.find(item => item.failure_mode_id === failureModeId);
    if (!failureMode) return false;
    return failureMode.linked_constraint_ids.every(id => resolvedConstraintIds.has(id));
  }
}
