// Reusable MCP prompts — discoverable via prompts/list + retrievable via
// prompts/get. They expose the same reasoning CHECKLISTS the review_before_final
// facade returns, so a client can pull the workflow once instead of re-deriving
// it each turn. HONEST framing: these are SCAFFOLDS — a checklist + critique
// questions to structure self-review. They do NOT force correct reasoning and
// they do NOT block; the unforgeable gating lives in finalize_deliverable.

import type { GetPromptResult } from '@modelcontextprotocol/sdk/types.js';

export type ReviewTaskType =
  | 'plan'
  | 'architecture'
  | 'decision'
  | 'research'
  | 'numeric'
  | 'general';

export interface PromptArgumentDescriptor {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptDescriptor {
  name: string;
  description: string;
  arguments: PromptArgumentDescriptor[];
}

interface PromptDefinition extends PromptDescriptor {
  build(args: Record<string, string>): GetPromptResult;
}

// Shared argument shape: every prompt accepts the draft + the original request
// it is reviewing. Both optional so a client can pull the bare checklist.
const REVIEW_ARGS: PromptArgumentDescriptor[] = [
  {
    name: 'original_request',
    description: 'The original task/question the draft is meant to answer. Optional — supply it so the checklist can be read against the actual ask.',
    required: false,
  },
  {
    name: 'draft_answer',
    description: 'The current draft answer/plan/design to review. Optional — supply it so the critique questions target your real content.',
    required: false,
  },
];

// ─── Reusable checklists + critique questions, keyed by task type ──────────────
// These are the SINGLE SOURCE used by both the prompts and the review_before_final
// facade tool, so the two never drift.

export interface ReviewContent {
  checklist: string[];
  critique_questions: string[];
}

export const REVIEW_CONTENT: Record<ReviewTaskType, ReviewContent> = {
  plan: {
    checklist: [
      'Every step has its prerequisites listed before it (no step depends on something that never appears).',
      'No two steps depend on each other in a cycle.',
      'Each step states how it can fail and what happens on that failure (abort / retry / rollback / compensate).',
      'Every retry or goto loop has an explicit bound (max attempts) so it cannot spin forever.',
      'Steps that share a resource are ordered or guarded, not left to contend implicitly.',
      'The plan reaches the stated goal: the final step actually produces the requested outcome.',
    ],
    critique_questions: [
      'Which step is most likely to fail, and does the plan say what happens when it does?',
      'Is there a prerequisite assumed but never established by an earlier step?',
      'Does any loop or retry lack a termination bound?',
      'If two steps run out of order, does anything break?',
    ],
  },
  architecture: {
    checklist: [
      'The dominant failure modes are named, with how each is detected and recovered.',
      'Behaviour under load/scale is stated (where it degrades first, and at what limit).',
      'Concurrent access to shared state is addressed (check-then-act, read-modify-write, ordering).',
      'Data-loss and durability paths are covered (what is lost on crash, what is recoverable).',
      'External dependencies have a defined behaviour when they are slow or unavailable.',
      'The design solves the actual stated requirement, not an adjacent easier one.',
    ],
    critique_questions: [
      'What happens to in-flight work when a node crashes mid-operation?',
      'Where does this design fall over first as traffic grows 10x?',
      'Can two concurrent requests corrupt shared state, and what prevents it?',
      'Which single dependency, if down, takes the whole system down?',
    ],
  },
  decision: {
    checklist: [
      'The viable options are enumerated explicitly (not just the favoured one).',
      'The status quo / do-nothing option is included as a baseline.',
      'No recommended option is strictly dominated by another on every dimension that matters.',
      'The scoring dimensions (cost, risk, reversibility, time) are stated, not implied.',
      'The condition under which the decision should be reversed is named.',
      'The recommendation follows from the comparison rather than preceding it.',
    ],
    critique_questions: [
      'Is the recommended option actually better than the status quo, or just different?',
      'Is any option dominated — worse on every axis — and therefore safe to drop?',
      'What would have to be true for the opposite choice to win?',
      'What observable signal later would tell you this decision was wrong?',
    ],
  },
  research: {
    checklist: [
      'Every factual claim names the source it rests on.',
      'Each claim is supported by an actual span of that source, not a paraphrase that drifts.',
      'Time-sensitive claims state the date of the source and whether it is still current.',
      'No claim generalises beyond what its source actually says.',
      'Numbers, dates, entities, and status words are carried verbatim from the source, not approximated.',
      'Claims with no supporting source are marked as inference, not stated as fact.',
    ],
    critique_questions: [
      'Which claim has the weakest source backing, and would it survive a verbatim check?',
      'Is any "current" claim resting on a source that may now be stale?',
      'Does any sentence assert more than the cited source supports?',
      'Are any numbers or dates reconstructed from memory rather than quoted?',
    ],
  },
  numeric: {
    checklist: [
      'Every number in the answer is recomputed from its stated inputs, not asserted.',
      'Each derived number traces to specific input values and a named operation (sum / diff / product / ratio / mean / percent_change).',
      'Units and currency are consistent across every figure and the inputs they came from.',
      'Intermediate results are shown, so the final number is checkable, not magical.',
      'Rounding is applied once at the end, not silently compounded mid-calculation.',
      'No figure appears in the answer that was never declared or derived.',
    ],
    critique_questions: [
      'Pick the headline number — can you re-derive it right now from the listed inputs?',
      'Is every unit and currency the same across the inputs and the result?',
      'Is there a number in the prose that is not traced to an input?',
      'Does any percentage or growth figure actually reconcile with its operands?',
    ],
  },
  general: {
    checklist: [
      'The answer addresses the actual request, including every sub-part of it.',
      'Claims that carry weight are grounded in evidence or marked as assumptions.',
      'Any specific number, date, or quantity is checkable against its source.',
      'Stated confidence matches the strength of the underlying support.',
      'Known limitations and failure cases are surfaced, not hidden.',
      'Nothing required by the request is silently dropped.',
    ],
    critique_questions: [
      'Which part of the request is least well covered by this draft?',
      'What is the strongest objection a careful reviewer would raise?',
      'Is any confident statement resting on an unstated assumption?',
      'What would you check first if this had to be correct?',
    ],
  },
};

function renderPromptText(
  taskType: ReviewTaskType,
  heading: string,
  args: Record<string, string>,
): string {
  const { checklist, critique_questions } = REVIEW_CONTENT[taskType];
  const lines: string[] = [];
  lines.push(heading);
  lines.push('');
  lines.push('This is a reusable self-review scaffold — a checklist plus critique questions. It structures your review; it does not guarantee a correct answer.');

  if (args.original_request) {
    lines.push('');
    lines.push('## Original request');
    lines.push(args.original_request);
  }
  if (args.draft_answer) {
    lines.push('');
    lines.push('## Draft to review');
    lines.push(args.draft_answer);
  }

  lines.push('');
  lines.push('## Checklist');
  for (const item of checklist) {
    lines.push(`- [ ] ${item}`);
  }

  lines.push('');
  lines.push('## Critique questions');
  for (const q of critique_questions) {
    lines.push(`- ${q}`);
  }

  lines.push('');
  lines.push('Work through each unchecked item and answer each critique question against the draft before you treat it as final. For machine-checkable claims (numbers, quoted sources, constraints), run finalize_deliverable / ct-enforce on the artifact bundle — this scaffold does not verify them for you.');

  return lines.join('\n');
}

function buildPrompt(
  taskType: ReviewTaskType,
  heading: string,
): (args: Record<string, string>) => GetPromptResult {
  return (args: Record<string, string>): GetPromptResult => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: renderPromptText(taskType, heading, args ?? {}),
        },
      },
    ],
  });
}

export const PROMPTS: PromptDefinition[] = [
  {
    name: 'review_plan',
    description: 'Reusable checklist + critique questions for reviewing a multi-step plan (prerequisites, dependency cycles, failure branches, loop bounds) before you act on it.',
    arguments: REVIEW_ARGS,
    build: buildPrompt('plan', 'Plan review checklist'),
  },
  {
    name: 'stress_architecture',
    description: 'Reusable checklist + critique questions for stress-testing a system design (failure modes, scaling, concurrency, data loss) before you commit to it.',
    arguments: REVIEW_ARGS,
    build: buildPrompt('architecture', 'Architecture stress-test checklist'),
  },
  {
    name: 'review_decision',
    description: 'Reusable checklist + critique questions for reviewing a recommendation (options enumerated, status-quo baseline, dominated-option check, reversal condition) before you commit.',
    arguments: REVIEW_ARGS,
    build: buildPrompt('decision', 'Decision review checklist'),
  },
  {
    name: 'verify_research_answer',
    description: 'Reusable checklist + critique questions for verifying a research answer (claim-to-source grounding, freshness, over-generalization) before you treat it as fact.',
    arguments: REVIEW_ARGS,
    build: buildPrompt('research', 'Research verification checklist'),
  },
  {
    name: 'audit_numeric_analysis',
    description: 'Reusable checklist + critique questions for auditing a numeric analysis (recompute every number, trace each to inputs, unit/currency consistency) before you publish the figures.',
    arguments: REVIEW_ARGS,
    build: buildPrompt('numeric', 'Numeric analysis audit checklist'),
  },
  {
    name: 'review_before_final',
    description: 'General pre-ship self-review scaffold — a checklist + critique questions to run over any draft before you treat it as final.',
    arguments: REVIEW_ARGS,
    build: buildPrompt('general', 'Pre-ship review checklist'),
  },
];

const PROMPT_BY_NAME = new Map(PROMPTS.map(prompt => [prompt.name, prompt]));

export function listPromptDescriptors(): PromptDescriptor[] {
  return PROMPTS.map(({ name, description, arguments: args }) => ({
    name,
    description,
    arguments: args,
  }));
}

export function getPrompt(
  name: string,
  args: Record<string, string> = {},
): GetPromptResult {
  const prompt = PROMPT_BY_NAME.get(name);
  if (!prompt) {
    throw new Error(
      `Unknown prompt: "${name}". Available prompts: ${PROMPTS.map(p => p.name).join(', ')}`,
    );
  }
  return prompt.build(args);
}
