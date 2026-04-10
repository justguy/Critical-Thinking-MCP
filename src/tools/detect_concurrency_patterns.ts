/**
 * detect_concurrency_patterns — Structured concurrency hazard detection.
 *
 * Takes a structured description of steps, shared resources, and
 * protections. Detects known hazard patterns deterministically.
 *
 * Patterns: check-then-act, read-modify-write, missing idempotency,
 * ordering assumption, aggregation race.
 *
 * This is the structured-input companion to the text-based
 * concurrency scanner in score_response_quality.
 *
 * Deterministic. Stateless. No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { BlockingIssue, EnforcementContext } from '../enforcement/types.js';

// ====== Types ======

export interface ConcurrencyInput {
  steps: string[];
  shared_resources?: string[];
  protections?: string[];
  delivery_model?: 'at_least_once' | 'at_most_once' | 'exactly_once';
  retry_behavior?: 'none' | 'automatic' | 'manual';
  capacity_model?: {
    throughput_per_sec?: number;
    mean_latency_sec?: number;
    capacity_slots?: number;
    retry_count?: number;
    timeout_sec?: number;
    sla_sec?: number;
  };
  resource_allocation?: {
    tasks: Array<{
      id: string;
      holds?: string[];
      waits_for?: string[];
    }>;
    resources?: Array<{
      id: string;
      mode?: 'exclusive' | 'shared';
      preemptible?: boolean;
    }>;
  };
}

interface DetectedPattern {
  pattern: string;
  description: string;
  severity: 'critical' | 'warning';
}

export interface ConcurrencyPatternOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  patterns_detected: string[];
  hazard_count: number;
  critical_count: number;
  has_protections: boolean;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

// ====== Validation ======

function validateInput(input: unknown): ConcurrencyInput {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "steps" (string[]). ' +
      'Optional: "shared_resources", "protections", "delivery_model", "retry_behavior", "capacity_model", "resource_allocation".'
    );
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.steps) || obj.steps.length < 2) {
    throw new Error('steps must be an array of at least 2 strings describing the operation sequence.');
  }

  for (let i = 0; i < obj.steps.length; i++) {
    if (typeof obj.steps[i] !== 'string') {
      throw new Error(`steps[${i}] must be a string.`);
    }
  }

  return {
    steps: obj.steps as string[],
    shared_resources: Array.isArray(obj.shared_resources) ? obj.shared_resources as string[] : [],
    protections: Array.isArray(obj.protections) ? obj.protections as string[] : [],
    delivery_model: typeof obj.delivery_model === 'string' ? obj.delivery_model as ConcurrencyInput['delivery_model'] : undefined,
    retry_behavior: typeof obj.retry_behavior === 'string' ? obj.retry_behavior as ConcurrencyInput['retry_behavior'] : undefined,
    capacity_model:
      obj.capacity_model && typeof obj.capacity_model === 'object'
        ? obj.capacity_model as ConcurrencyInput['capacity_model']
        : undefined,
    resource_allocation:
      obj.resource_allocation && typeof obj.resource_allocation === 'object'
        ? obj.resource_allocation as ConcurrencyInput['resource_allocation']
        : undefined,
  };
}

// ====== Detection ======

const READ_WORDS = /\b(?:reads?|gets?|fetch(?:es)?|quer(?:y|ies)|selects?|checks?|loads?|look\s*up|receive[sd]?)\b/i;
const WRITE_WORDS = /\b(?:writes?|updates?|sets?|inserts?|deletes?|modif(?:y|ies)|increments?|decrements?|saves?|stores?|persists?|deducts?|approves?|credits?|debits?|publish(?:es)?|sends?|emits?)\b/i;
const CONDITION_WORDS = /\b(?:if|when|check|verify|ensure|confirm|validate)\b/i;

const PROTECTION_KEYWORDS = [
  'lock', 'mutex', 'transaction', 'atomic', 'compare-and-swap', 'cas',
  'version check', 'optimistic lock', 'pessimistic lock', 'serializable',
  'select for update', 'idempotency', 'idempotent', 'dedupe', 'deduplication',
  'exactly-once', 'sequence number', 'ordered queue', 'fifo',
];

function hasProtection(protections: string[]): boolean {
  if (protections.length === 0) return false;
  const joined = protections.join(' ').toLowerCase();
  return PROTECTION_KEYWORDS.some(kw => joined.includes(kw));
}

function detectPatterns(input: ConcurrencyInput): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];
  const allSteps = input.steps.join(' ');
  const hasSharedResource = (input.shared_resources?.length ?? 0) > 0;
  const protected_ = hasProtection(input.protections ?? []);

  // Check-then-act: read + condition + write on shared resource, no protection
  const hasRead = input.steps.some(s => READ_WORDS.test(s));
  const hasCondition = input.steps.some(s => CONDITION_WORDS.test(s));
  const hasWrite = input.steps.some(s => WRITE_WORDS.test(s));

  if (hasRead && hasCondition && hasWrite && hasSharedResource && !protected_) {
    patterns.push({
      pattern: 'check_then_act',
      description: `Shared resource "${input.shared_resources![0]}" is read, condition checked, then written without protection`,
      severity: 'critical',
    });
  }

  // Read-modify-write: read + write on shared resource, no condition needed
  if (hasRead && hasWrite && hasSharedResource && !protected_ && !hasCondition) {
    patterns.push({
      pattern: 'read_modify_write',
      description: `Shared resource "${input.shared_resources![0]}" undergoes read-modify-write without lock or version check`,
      severity: 'critical',
    });
  }

  // Missing idempotency: retry or at-least-once without idempotency protection
  const hasRetry = input.retry_behavior === 'automatic' || /\bretry\b/i.test(allSteps);
  const atLeastOnce = input.delivery_model === 'at_least_once';
  const hasIdempotency = (input.protections ?? []).some(p =>
    /idempoten|dedupe|exactly.once|compare.and.swap|cas\b|version.check/i.test(p));

  if ((hasRetry || atLeastOnce) && hasWrite && !hasIdempotency) {
    patterns.push({
      pattern: 'missing_idempotency',
      description: 'Retried or at-least-once operation with side effects but no idempotency key or deduplication',
      severity: 'critical',
    });
  }

  // Lost update: multiple actors read then write same resource without coordination
  const multipleActors = input.steps.filter(s => READ_WORDS.test(s)).length >= 2
    || /\b(?:worker|thread|process|goroutine|coroutine|instance|replica)\b/i.test(allSteps);
  if (multipleActors && hasRead && hasWrite && hasSharedResource && !protected_) {
    // Don't duplicate if check_then_act already fired
    if (!patterns.some(p => p.pattern === 'check_then_act' || p.pattern === 'read_modify_write')) {
      patterns.push({
        pattern: 'lost_update',
        description: `Multiple actors read and write "${input.shared_resources![0]}" without coordination — last write wins, earlier updates lost`,
        severity: 'critical',
      });
    }
  }

  // Replay / redelivery: at-least-once delivery with side effects, even without explicit retry
  if (atLeastOnce && hasWrite && !hasIdempotency && !patterns.some(p => p.pattern === 'missing_idempotency')) {
    patterns.push({
      pattern: 'missing_idempotency',
      description: 'At-least-once delivery with write side effects but no idempotency key or deduplication',
      severity: 'critical',
    });
  }

  // Dual write: writes to 2+ different shared resources without transactional boundary
  const multipleResources = (input.shared_resources?.length ?? 0) >= 2;
  const writeSteps = input.steps.filter(s => WRITE_WORDS.test(s));
  const hasOutbox = (input.protections ?? []).some(p =>
    /\b(?:outbox|inbox|transactional.?outbox|saga|two.?phase|2pc)\b/i.test(p));
  if (multipleResources && writeSteps.length >= 2 && !protected_ && !hasOutbox) {
    patterns.push({
      pattern: 'dual_write',
      description: `Writes to ${input.shared_resources!.length} resources (${input.shared_resources!.join(', ')}) without transactional boundary or outbox pattern`,
      severity: 'critical',
    });
  }

  // Ordering assumption: sequential processing claimed without ordering guarantee
  const orderingClaim = /\b(?:in order|sequential|ordered|one at a time)\b/i.test(allSteps);
  const hasOrderingProtection = (input.protections ?? []).some(p =>
    /\b(?:fifo|ordered|sequence|partition|serial)\b/i.test(p));

  if (orderingClaim && !hasOrderingProtection) {
    patterns.push({
      pattern: 'ordering_assumption',
      description: 'Sequential processing assumed but no explicit ordering guarantee (FIFO queue, sequence numbers, etc.)',
      severity: 'warning',
    });
  }

  return patterns;
}

function hasTaskCycle(adjacency: Map<string, Set<string>>): boolean {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (taskId: string): boolean => {
    if (visiting.has(taskId)) return true;
    if (visited.has(taskId)) return false;

    visiting.add(taskId);
    for (const next of adjacency.get(taskId) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return false;
  };

  for (const taskId of adjacency.keys()) {
    if (visit(taskId)) return true;
  }
  return false;
}

function detectDeadlockPattern(input: ConcurrencyInput): DetectedPattern[] {
  const allocation = input.resource_allocation;
  if (!allocation || allocation.tasks.length < 2) {
    return [];
  }

  const resourceMode = new Map<string, 'exclusive' | 'shared'>();
  const resourcePreemptible = new Map<string, boolean>();

  for (const resource of allocation.resources ?? []) {
    resourceMode.set(resource.id, resource.mode ?? 'exclusive');
    resourcePreemptible.set(resource.id, resource.preemptible ?? false);
  }

  const holders = new Map<string, string[]>();
  for (const task of allocation.tasks) {
    for (const resourceId of task.holds ?? []) {
      const current = holders.get(resourceId) ?? [];
      current.push(task.id);
      holders.set(resourceId, current);
      if (!resourceMode.has(resourceId)) resourceMode.set(resourceId, 'exclusive');
      if (!resourcePreemptible.has(resourceId)) resourcePreemptible.set(resourceId, false);
    }
  }

  const holdAndWait = allocation.tasks.some(
    task => (task.holds?.length ?? 0) > 0 && (task.waits_for?.length ?? 0) > 0,
  );
  if (!holdAndWait) {
    return [];
  }

  const exclusiveResources = [...holders.keys()].filter(
    resourceId => resourceMode.get(resourceId) !== 'shared',
  );
  if (exclusiveResources.length === 0) {
    return [];
  }

  const noPreemption = allocation.tasks.some(task =>
    (task.waits_for ?? []).some(resourceId => resourcePreemptible.get(resourceId) !== true),
  );
  if (!noPreemption) {
    return [];
  }

  const adjacency = new Map<string, Set<string>>();
  for (const task of allocation.tasks) {
    adjacency.set(task.id, new Set<string>());
  }

  for (const task of allocation.tasks) {
    for (const resourceId of task.waits_for ?? []) {
      if (resourceMode.get(resourceId) === 'shared') continue;
      for (const holderId of holders.get(resourceId) ?? []) {
        if (holderId === task.id) continue;
        adjacency.get(task.id)?.add(holderId);
      }
    }
  }

  if (!hasTaskCycle(adjacency)) {
    return [];
  }

  return [
    {
      pattern: 'deadlock_risk',
      description:
        'Resource allocation graph satisfies the Coffman deadlock conditions: mutual exclusion, hold-and-wait, no preemption, and circular wait.',
      severity: 'critical',
    },
  ];
}

// ====== Handler ======

export function handleDetectConcurrencyPatterns(
  input: unknown,
  engine: EnforcementEngine,
): ConcurrencyPatternOutput {
  const enforcementContext = (input as Record<string, unknown>)?.context as EnforcementContext | undefined;
  const parsed = validateInput(input);
  const detected = detectPatterns(parsed);
  detected.push(...detectDeadlockPattern(parsed));

  const criticalCount = detected.filter(d => d.severity === 'critical').length;
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  for (const d of detected) {
    if (d.severity === 'critical') {
      blockingIssues.push({
        mechanism: 'concurrency_pattern',
        description: `${d.pattern}: ${d.description}`,
        severity: 'blocking',
      });
    } else {
      warnings.push(`${d.pattern}: ${d.description}`);
    }
  }

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'detect_concurrency_patterns', undefined, enforcementContext)
    : '';

  return {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    patterns_detected: detected.map(d => d.pattern),
    hazard_count: detected.length,
    critical_count: criticalCount,
    has_protections: hasProtection(parsed.protections ?? []),
    context_used: !!enforcementContext,
    ...(hasFail || warnings.length > 0 ? {
      enforcement: {
        blocking_issues: blockingIssues,
        warnings,
        corrective_prompt: correctivePrompt,
      },
    } : {}),
  };
}
