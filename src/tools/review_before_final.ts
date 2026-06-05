/**
 * review_before_final — lightweight self-review FACADE.
 *
 * Phase-4 finding: a cheap checklist scaffold matched/beat the heavy multi-turn
 * artifact gate on repair, with fewer turns. So this tool exposes the useful
 * PROCESS — the curated checklist + critique questions per task type — without
 * forcing the expensive artifact ritual.
 *
 * DETERMINISTIC and NON-BLOCKING: no LLM calls, no analyzer calls, no engine.
 * It NEVER returns a blocking/verdict/decision field — it only scaffolds. The
 * unforgeable gating lives in finalize_deliverable / ct-enforce; at most this
 * tool tells the agent (via enforce_required + corrective_prompt) to go run it.
 */

import { REVIEW_CONTENT, type ReviewTaskType } from '../mcp/prompts.js';

const TASK_TYPES = new Set<ReviewTaskType>([
  'plan',
  'architecture',
  'decision',
  'research',
  'numeric',
  'general',
]);
const MODES = new Set(['checklist', 'artifact', 'enforce']);
const RISK_LEVELS = new Set(['low', 'medium', 'high']);

// task_types whose obligations are machine-checkable (numbers, quoted sources),
// so enforce_required defaults true even in artifact mode.
const MACHINE_CHECKABLE = new Set<ReviewTaskType>(['numeric', 'research']);

export type ReviewMode = 'checklist' | 'artifact' | 'enforce';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ReviewBeforeFinalOutput {
  status: 'PASS';
  task_type: ReviewTaskType;
  mode: ReviewMode;
  checklist: string[];
  critique_questions: string[];
  artifact_template?: Record<string, unknown>;
  enforce_required?: boolean;
  corrective_prompt?: string;
}

// Compact evidence/number/constraint skeletons per task type — the shape the
// agent would fill in to drive finalize_deliverable.
function artifactTemplateFor(taskType: ReviewTaskType): Record<string, unknown> {
  switch (taskType) {
    case 'numeric':
      return {
        inputs: [],
        numeric_derivation: { nodes: [], final_refs: [] },
        arithmetic_checks: [],
      };
    case 'research':
      return {
        sources: [],
        claims: [{ text: '', quoted_span: '', source_id: '' }],
      };
    case 'decision':
      return {
        options: [],
        scoring_dimensions: [],
      };
    case 'plan':
      return {
        steps: [{ id: '', description: '', dependencies: [], on_failure: { action: '' } }],
      };
    case 'architecture':
      return {
        failure_modes: [],
        shared_state: [],
        scaling_limits: [],
      };
    case 'general':
    default:
      return {
        claims: [],
        constraints: [],
      };
  }
}

function correctivePromptFor(taskType: ReviewTaskType): string {
  return [
    `Build the ${taskType} artifact bundle described in artifact_template, then run ct-enforce / finalize_deliverable on it.`,
    'finalize_deliverable re-executes the machine-checkable obligations (grounding, number tracing, arithmetic, constraints) and blocks on any unforgeable violation.',
    'This review tool only scaffolds — it does not verify the artifacts for you.',
  ].join(' ');
}

function validateInput(input: unknown): {
  task_type: ReviewTaskType;
  original_request: string;
  draft_answer: string;
  mode: ReviewMode;
  risk_level?: RiskLevel;
} {
  if (input === null || typeof input !== 'object') {
    throw new Error('Input must be an object with task_type, original_request, and draft_answer.');
  }
  const obj = input as Record<string, unknown>;

  if (typeof obj.task_type !== 'string' || !TASK_TYPES.has(obj.task_type as ReviewTaskType)) {
    throw new Error(
      `Invalid "task_type": "${String(obj.task_type)}". Must be one of: ${[...TASK_TYPES].join(', ')}.`,
    );
  }
  if (typeof obj.original_request !== 'string') {
    throw new Error('"original_request" is required and must be a string.');
  }
  if (typeof obj.draft_answer !== 'string') {
    throw new Error('"draft_answer" is required and must be a string.');
  }

  let mode: ReviewMode = 'checklist';
  if (obj.mode !== undefined) {
    if (typeof obj.mode !== 'string' || !MODES.has(obj.mode)) {
      throw new Error(
        `Invalid "mode": "${String(obj.mode)}". Must be one of: ${[...MODES].join(', ')}.`,
      );
    }
    mode = obj.mode as ReviewMode;
  }

  let risk_level: RiskLevel | undefined;
  if (obj.risk_level !== undefined) {
    if (typeof obj.risk_level !== 'string' || !RISK_LEVELS.has(obj.risk_level)) {
      throw new Error(
        `Invalid "risk_level": "${String(obj.risk_level)}". Must be one of: ${[...RISK_LEVELS].join(', ')}.`,
      );
    }
    risk_level = obj.risk_level as RiskLevel;
  }

  return {
    task_type: obj.task_type as ReviewTaskType,
    original_request: obj.original_request,
    draft_answer: obj.draft_answer,
    mode,
    risk_level,
  };
}

export function handleReviewBeforeFinal(input: unknown): ReviewBeforeFinalOutput {
  const { task_type, mode, risk_level } = validateInput(input);
  const { checklist, critique_questions } = REVIEW_CONTENT[task_type];

  const output: ReviewBeforeFinalOutput = {
    status: 'PASS',
    task_type,
    mode,
    // Return copies so callers can't mutate the shared registry content.
    checklist: [...checklist],
    critique_questions: [...critique_questions],
  };

  // mode 'checklist' (default) = checklist + critique only.
  if (mode === 'checklist') {
    return output;
  }

  // mode 'artifact' and 'enforce' both surface the artifact_template.
  output.artifact_template = artifactTemplateFor(task_type);

  // enforce_required defaults true when mode is 'enforce', risk is high, or the
  // task type is machine-checkable; otherwise it is omitted (falsey).
  const enforceRequired =
    mode === 'enforce' || risk_level === 'high' || MACHINE_CHECKABLE.has(task_type);

  if (enforceRequired) {
    output.enforce_required = true;
    output.corrective_prompt = correctivePromptFor(task_type);
  }

  return output;
}
