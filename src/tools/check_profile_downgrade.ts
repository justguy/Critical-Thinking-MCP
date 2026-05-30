/**
 * check_profile_downgrade — guard the one weak point of plan_checks: the agent chooses
 * task_type. An agent can declare task_type:'freeform' for a numeric/factual/decision/
 * planning task to dodge the stricter profile. This cross-checks the DECLARED type
 * against the shape of the request + answer, conservatively.
 *
 * WARNING-ONLY (status always PASS): the triggers are heuristic regexes, so — like all
 * regex signals in this codebase — they never drive a BLOCK. A host strict mode may
 * choose to block a declared downgrade.
 *
 * No LLM calls.
 */

import type { EnforcementContext, TaskType } from '../enforcement/types.js';
import { classifyClaim } from '../enforcement/index.js';
import { inferTaskType } from '../enforcement/check_planner.js';

const TASK_TYPES = new Set([
  'factual_qa', 'numeric_analysis', 'planning', 'decision',
  'concurrency_design', 'reasoning', 'freeform',
]);

const PERCENT_OR_MULTI = /\b\d+(?:\.\d+)?\s?%|\b\d[\d,]*(?:\.\d+)?\b.*\b\d[\d,]*(?:\.\d+)?\b/; // a % or ≥2 numbers
const RECOMMEND = /\b(?:best|should|shouldn['’]?t|prefer|recommend|choose|opt for|go with|safe to|ready to|the right (?:choice|option))\b/i;
const PLANNING = /\b(?:step\s*\d|deploy|migrat|roll[ -]?out|provision|first\b[^.]*\bthen\b|phase\s*\d)\b/i;
const CITATION = /\b(?:according to|cite|citation|source:|per the docs|\bref\b|reference|\[\d+\])\b/i;

export interface ProfileDowngradeOutput {
  status: 'PASS';
  declared_task_type: string;
  inferred_task_type: TaskType;
  suspected_downgrades: string[];
  context_used: boolean;
  enforcement?: { blocking_issues: never[]; warnings: string[]; corrective_prompt: string };
}

function validateInput(input: unknown): {
  original_request_text: string;
  declared_task_type: string;
  answer_text: string;
} {
  if (input === null || typeof input !== 'object') {
    throw new Error('Input must be an object with "original_request_text", "declared_task_type", "answer_text".');
  }
  const obj = input as Record<string, unknown>;
  if (typeof obj.original_request_text !== 'string' || obj.original_request_text.length === 0) {
    throw new Error('"original_request_text" must be a non-empty string.');
  }
  if (typeof obj.declared_task_type !== 'string' || !TASK_TYPES.has(obj.declared_task_type)) {
    throw new Error(`"declared_task_type" must be one of: ${[...TASK_TYPES].join(', ')}.`);
  }
  if (typeof obj.answer_text !== 'string' || obj.answer_text.length === 0) {
    throw new Error('"answer_text" must be a non-empty string.');
  }
  return {
    original_request_text: obj.original_request_text,
    declared_task_type: obj.declared_task_type,
    answer_text: obj.answer_text,
  };
}

export function handleCheckProfileDowngrade(input: unknown): ProfileDowngradeOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { original_request_text, declared_task_type, answer_text } = validateInput(input);

  const suspected: string[] = [];
  const both = `${original_request_text}\n${answer_text}`;
  const inferred = inferTaskType(classifyClaim(original_request_text).primary_type);

  // Shape-based triggers (conservative): the declared type contradicts the visible shape.
  if (declared_task_type !== 'numeric_analysis' && (PERCENT_OR_MULTI.test(answer_text) || inferred === 'numeric_analysis')) {
    suspected.push('possible_numeric_profile_downgrade');
  }
  if (declared_task_type !== 'decision' && RECOMMEND.test(both)) {
    suspected.push('possible_decision_profile_downgrade');
  }
  if (declared_task_type !== 'planning' && PLANNING.test(both)) {
    suspected.push('possible_planning_profile_downgrade');
  }
  if (declared_task_type === 'freeform' && (CITATION.test(both) || inferred === 'factual_qa')) {
    suspected.push('possible_factual_profile_downgrade');
  }
  // General dodge: a stronger type was inferred from the request but a weaker one declared.
  if (declared_task_type === 'freeform' && inferred !== 'freeform') {
    const tag = `possible_${inferred}_profile_downgrade`;
    if (!suspected.includes(tag)) suspected.push(tag);
  }

  const warnings = suspected.map(
    s => `${s}: declared task_type='${declared_task_type}' but the request/answer looks like a stronger profile — a host strict mode may reject the downgrade.`,
  );

  const output: ProfileDowngradeOutput = {
    status: 'PASS',
    declared_task_type,
    inferred_task_type: inferred,
    suspected_downgrades: [...new Set(suspected)],
    context_used: !!context,
  };
  if (warnings.length > 0) {
    output.enforcement = { blocking_issues: [], warnings, corrective_prompt: '' };
  }
  return output;
}
