/**
 * review_before_final FACADE — deterministic, non-blocking self-review scaffold.
 *
 *  - default mode is 'checklist' (checklist + critique only, no artifact_template)
 *  - checklist + critique_questions are non-empty for EVERY task_type
 *  - 'artifact' mode adds artifact_template
 *  - 'enforce' mode sets enforce_required + corrective_prompt
 *  - enforce_required is true for risk_level 'high' and for numeric/research,
 *    omitted for a low-risk general artifact run
 *  - it NEVER returns a blocking/verdict/decision field (it scaffolds, never gates)
 */

import { describe, it, expect } from 'vitest';

import {
  handleReviewBeforeFinal,
  type ReviewBeforeFinalOutput,
} from '../../src/tools/review_before_final.js';
import { REVIEW_CONTENT, type ReviewTaskType } from '../../src/mcp/prompts.js';

const TASK_TYPES: ReviewTaskType[] = [
  'plan',
  'architecture',
  'decision',
  'research',
  'numeric',
  'general',
];

function run(args: Record<string, unknown>): ReviewBeforeFinalOutput {
  return handleReviewBeforeFinal({
    original_request: 'Original request text.',
    draft_answer: 'Draft answer text.',
    ...args,
  });
}

describe('review_before_final facade', () => {
  it('defaults to checklist mode when mode is omitted (no artifact_template)', () => {
    const out = run({ task_type: 'general' });
    expect(out.status).toBe('PASS');
    expect(out.mode).toBe('checklist');
    expect(out.artifact_template).toBeUndefined();
    expect(out.enforce_required).toBeUndefined();
    expect(out.corrective_prompt).toBeUndefined();
  });

  it('returns non-empty checklist + critique_questions for every task_type', () => {
    for (const task_type of TASK_TYPES) {
      const out = run({ task_type });
      expect(out.checklist.length, `${task_type} checklist`).toBeGreaterThan(0);
      expect(out.critique_questions.length, `${task_type} critique`).toBeGreaterThan(0);
      // Content matches the shared registry the prompts also use (no drift).
      expect(out.checklist).toEqual(REVIEW_CONTENT[task_type].checklist);
      expect(out.critique_questions).toEqual(REVIEW_CONTENT[task_type].critique_questions);
    }
  });

  it("artifact mode adds an artifact_template for every task_type", () => {
    for (const task_type of TASK_TYPES) {
      const out = run({ task_type, mode: 'artifact' });
      expect(out.mode).toBe('artifact');
      expect(out.artifact_template, `${task_type} artifact_template`).toBeTypeOf('object');
      expect(out.artifact_template).not.toBeUndefined();
    }
  });

  it('numeric artifact_template carries the number-tracing skeleton', () => {
    const out = run({ task_type: 'numeric', mode: 'artifact' });
    expect(out.artifact_template).toMatchObject({
      inputs: [],
      numeric_derivation: { nodes: [], final_refs: [] },
      arithmetic_checks: [],
    });
  });

  it('research artifact_template carries the source/claims skeleton', () => {
    const out = run({ task_type: 'research', mode: 'artifact' });
    expect(out.artifact_template?.sources).toEqual([]);
    expect(Array.isArray(out.artifact_template?.claims)).toBe(true);
  });

  it('enforce mode sets enforce_required + corrective_prompt + artifact_template', () => {
    const out = run({ task_type: 'general', mode: 'enforce' });
    expect(out.mode).toBe('enforce');
    expect(out.enforce_required).toBe(true);
    expect(out.corrective_prompt).toBeTruthy();
    expect(out.corrective_prompt).toMatch(/finalize_deliverable|ct-enforce/);
    expect(out.artifact_template).not.toBeUndefined();
  });

  it('enforce_required defaults true for risk_level high (artifact mode)', () => {
    const out = run({ task_type: 'general', mode: 'artifact', risk_level: 'high' });
    expect(out.enforce_required).toBe(true);
    expect(out.corrective_prompt).toBeTruthy();
  });

  it('enforce_required defaults true for machine-checkable numeric/research (artifact mode)', () => {
    for (const task_type of ['numeric', 'research'] as ReviewTaskType[]) {
      const out = run({ task_type, mode: 'artifact', risk_level: 'low' });
      expect(out.enforce_required, `${task_type} enforce_required`).toBe(true);
      expect(out.corrective_prompt).toBeTruthy();
    }
  });

  it('omits enforce_required for a low-risk general artifact run', () => {
    const out = run({ task_type: 'general', mode: 'artifact', risk_level: 'low' });
    expect(out.enforce_required).toBeUndefined();
    expect(out.corrective_prompt).toBeUndefined();
    // Still a scaffold: the template is present, just no enforcement push.
    expect(out.artifact_template).not.toBeUndefined();
  });

  it('omits enforce_required in plain checklist mode even at high risk', () => {
    // checklist mode never surfaces an artifact_template, so there is nothing to enforce.
    const out = run({ task_type: 'numeric', mode: 'checklist', risk_level: 'high' });
    expect(out.artifact_template).toBeUndefined();
    expect(out.enforce_required).toBeUndefined();
  });

  it('NEVER returns a blocking / verdict / decision field in any mode', () => {
    const blockingKeys = [
      'blocking_issues',
      'is_blocked',
      'blocked',
      'verdict',
      'finalize_verdict',
      'decision',
      'recommended',
      'isError',
    ];
    for (const task_type of TASK_TYPES) {
      for (const mode of ['checklist', 'artifact', 'enforce'] as const) {
        const out = run({ task_type, mode, risk_level: 'high' }) as Record<string, unknown>;
        for (const key of blockingKeys) {
          expect(out[key], `${task_type}/${mode} must not expose ${key}`).toBeUndefined();
        }
        // status is always the non-gating PASS sentinel.
        expect(out.status).toBe('PASS');
      }
    }
  });

  it('rejects an invalid task_type / mode / risk_level', () => {
    expect(() => run({ task_type: 'nonsense' })).toThrow(/task_type/);
    expect(() => run({ task_type: 'general', mode: 'nope' })).toThrow(/mode/);
    expect(() => run({ task_type: 'general', risk_level: 'extreme' })).toThrow(/risk_level/);
  });

  it('does not mutate the shared REVIEW_CONTENT registry', () => {
    const before = [...REVIEW_CONTENT.numeric.checklist];
    const out = run({ task_type: 'numeric' });
    out.checklist.push('mutation attempt');
    expect(REVIEW_CONTENT.numeric.checklist).toEqual(before);
  });
});
