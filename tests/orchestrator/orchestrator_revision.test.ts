import { describe, expect, it } from 'vitest';

import {
  runOrchestrator,
  type OrchestratorEnvelope,
} from '../../src/orchestrator/index.js';

const calibrationRuntime = {
  calibration: {
    model: 'claude-sonnet-4-6',
    prompt_family: 'absurd_sla',
    session_mode: 'single_turn' as const,
  },
};

function failingQualityEnvelope(
  iterationNumber = 1,
): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text:
      'This SLA guarantees a great developer experience and strong accountability.',
    contracts: {
      quality: {
        response_text:
          'This SLA guarantees a great developer experience and strong accountability.',
      },
    },
    mode: 'routed',
    review_context: {
      iteration_number: iterationNumber,
      prior_failures: [],
    },
  };
}

function passingConfidenceEnvelope(): OrchestratorEnvelope {
  return {
    schema_version: 'orchestrator_v0',
    answer_text:
      'I am 50% confident the launch will succeed without incident.',
    contracts: {
      confidence: {
        response_text:
          'I am 50% confident the launch will succeed without incident.',
        assumptions: [
          {
            description: 'Peak traffic stays below 40k requests per second',
            confidence: 0.8,
            falsification_condition:
              'Observed RPS exceeds 40k for more than 10 minutes in staging load test',
          },
        ],
      },
    },
    mode: 'routed',
    review_context: {
      iteration_number: 1,
      prior_failures: [],
    },
  };
}

describe('orchestrator bounded revision request', () => {
  it('emits a deterministic revision request on REVISE', () => {
    const result = runOrchestrator(
      failingQualityEnvelope(),
      calibrationRuntime,
    );
    const prompt = result.revision_request?.prompt ?? '';
    const structuralDirectiveCount = prompt
      .split('\n')
      .filter(line =>
        line.includes(
          '- score_response_quality: CRITIQUE: You are explaining an impossible or unserious premise.',
        ),
      ).length;

    expect(result.policy_decision).toBe('REVISE');
    expect(result.revision_request).toBeDefined();
    expect(result.revision_request?.strategy).toBe('bounded_single_revision');
    expect(result.revision_request?.next_review_context.iteration_number).toBe(2);
    expect(result.revision_request?.max_words).toBe(150);
    expect(result.revision_request?.max_bloat_ratio).toBe(1.2);
    expect(result.revision_request?.prompt).toContain(
      'Make exactly one revision attempt.',
    );
    expect(result.revision_request?.prompt).toContain(
      'Address the CT safer revision target directly.',
    );
    expect(result.revision_request?.prompt).toContain(
      'Structural directives:',
    );
    expect(result.revision_request?.prompt).toContain(
      'CRITIQUE: You are explaining an impossible or unserious premise. Do not add invented details. You MUST explicitly state why the premise is logically invalid and narrow to the remaining supportable claim.',
    );
    expect(result.revision_request?.prompt).toContain(
      'Formatting discipline:',
    );
    expect(result.revision_request?.prompt).toContain(
      'Keep the corrected response under 150 words.',
    );
    expect(result.revision_request?.prompt).toContain(
      'CRITIQUE OVERRIDE: You must output the corrected response in under 150 words. Do NOT apologize. Do NOT explain your reasoning. State the refusal or the corrected logic directly and stop.',
    );
    expect(structuralDirectiveCount).toBe(1);
    expect(result.critique?.formatting_override).toBe(
      'Do not apologize. Do not output conversational filler. Output only the requested JSON structure.',
    );
    expect(result.revision_request?.prompt).toContain(
      'This SLA guarantees a great developer experience and strong accountability.',
    );
    expect(result.revision_request?.prompt).toContain(
      result.critique?.safer_revision_target ?? '',
    );
  });

  it('does not emit a revision request when the answer passes', () => {
    const result = runOrchestrator(passingConfidenceEnvelope());

    expect(['PASS', 'WARN']).toContain(result.policy_decision);
    expect(result.revision_request).toBeUndefined();
  });

  it('does not emit a revision request once the decision is HUMAN_REVIEW', () => {
    const result = runOrchestrator(
      failingQualityEnvelope(2),
      calibrationRuntime,
    );

    expect(result.policy_decision).toBe('HUMAN_REVIEW');
    expect(result.revision_request).toBeUndefined();
  });
});
