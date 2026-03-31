/**
 * check_plan_validity — Plan logical structure validation using DAG analysis.
 *
 * Detects circular dependencies, missing prerequisites, resource conflicts.
 * Computes completeness_score and critical_path (longest path through DAG).
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type { BlockingIssue, EnforcementContext, PlanStep } from '../enforcement/types.js';

// ====== Output Types ======

interface ResourceConflict {
  resource: string;
  steps: string[];
}

export interface PlanValidityOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  is_valid: boolean;
  circular_dependencies: string[][];
  missing_prerequisites: { step_id: string; missing_dep: string }[];
  resource_conflicts: ResourceConflict[];
  completeness_score: number;
  critical_path: string[];
  step_count: number;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

// ====== Validation ======

function validateInput(input: unknown): { steps: PlanStep[] } {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with a "steps" array of at least 2 steps. ' +
      'Each step requires: id (string), description (string), dependencies (string[]).'
    );
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.steps)) {
    throw new Error(
      'Missing or invalid "steps" array. Provide at least 2 steps, each with id, description, dependencies.'
    );
  }

  const steps = obj.steps as unknown[];

  if (steps.length < 2) {
    throw new Error(`Need at least 2 steps, got ${steps.length}.`);
  }

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i] as Record<string, unknown>;
    if (!s || typeof s !== 'object') {
      throw new Error(`Step at index ${i} is not an object.`);
    }
    if (typeof s.id !== 'string' || s.id.length === 0) {
      throw new Error(`Step at index ${i} is missing a valid "id" (string).`);
    }
    if (typeof s.description !== 'string' || s.description.length === 0) {
      throw new Error(
        `Step "${s.id}" is missing a valid "description" (string).`
      );
    }
    if (!Array.isArray(s.dependencies)) {
      throw new Error(
        `Step "${s.id}" is missing "dependencies" (string[]). Use an empty array [] if none.`
      );
    }
    for (const dep of s.dependencies as unknown[]) {
      if (typeof dep !== 'string') {
        throw new Error(
          `Step "${s.id}" has non-string dependency: ${String(dep)}.`
        );
      }
    }
  }

  return { steps: steps as PlanStep[] };
}

// ====== Cycle Detection (DFS coloring) ======

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

function detectCycles(
  stepIds: string[],
  adj: Map<string, string[]>,
): string[][] {
  const color = new Map<string, number>();
  const cycles: string[][] = [];

  for (const id of stepIds) {
    color.set(id, WHITE);
  }

  function dfs(u: string, path: string[]): void {
    color.set(u, GRAY);
    path.push(u);

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      if (color.get(v) === GRAY) {
        const cycleStart = path.indexOf(v);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart).concat(v));
        }
      } else if (color.get(v) === WHITE) {
        dfs(v, path);
      }
    }

    path.pop();
    color.set(u, BLACK);
  }

  for (const id of stepIds) {
    if (color.get(id) === WHITE) {
      dfs(id, []);
    }
  }

  return cycles;
}

// ====== Critical Path (Longest Path in DAG) ======

function findCriticalPath(
  stepIds: string[],
  adj: Map<string, string[]>,
  hasCycles: boolean,
): string[] {
  // Cannot compute longest path if there are cycles
  if (hasCycles) return [];

  const idSet = new Set(stepIds);

  // Topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  for (const id of stepIds) inDegree.set(id, 0);
  for (const id of stepIds) {
    for (const neighbor of adj.get(id) || []) {
      if (idSet.has(neighbor)) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const id of stepIds) {
    if (inDegree.get(id) === 0) queue.push(id);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    topoOrder.push(u);
    for (const v of adj.get(u) || []) {
      if (!idSet.has(v)) continue;
      const deg = (inDegree.get(v) || 0) - 1;
      inDegree.set(v, deg);
      if (deg === 0) queue.push(v);
    }
  }

  // Longest path via dynamic programming
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  for (const id of stepIds) {
    dist.set(id, 0);
    prev.set(id, null);
  }

  for (const u of topoOrder) {
    for (const v of adj.get(u) || []) {
      if (!idSet.has(v)) continue;
      if ((dist.get(u) || 0) + 1 > (dist.get(v) || 0)) {
        dist.set(v, (dist.get(u) || 0) + 1);
        prev.set(v, u);
      }
    }
  }

  // Find endpoint of longest path
  let maxDist = 0;
  let endNode = topoOrder[0];
  for (const id of stepIds) {
    if ((dist.get(id) || 0) > maxDist) {
      maxDist = dist.get(id) || 0;
      endNode = id;
    }
  }

  // Reconstruct path
  const path: string[] = [];
  let current: string | null = endNode;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  return path;
}

// ====== Handler ======

export function handleCheckPlanValidity(
  input: unknown,
  engine: EnforcementEngine,
): PlanValidityOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { steps } = validateInput(input);

  const stepIds = steps.map(s => s.id);
  const stepIdSet = new Set(stepIds);
  const stepMap = new Map(steps.map(s => [s.id, s]));

  // Build adjacency list: dependency -> dependent (dep must come before step)
  const adj = new Map<string, string[]>();
  for (const id of stepIds) adj.set(id, []);

  for (const step of steps) {
    for (const dep of step.dependencies) {
      if (stepIdSet.has(dep)) {
        adj.get(dep)!.push(step.id);
      }
    }
  }

  // Circular dependency detection
  const circularDeps = detectCycles(stepIds, adj);

  // Missing prerequisites
  const missingPrereqs: { step_id: string; missing_dep: string }[] = [];
  for (const step of steps) {
    for (const dep of step.dependencies) {
      if (!stepIdSet.has(dep)) {
        missingPrereqs.push({ step_id: step.id, missing_dep: dep });
      }
    }
  }

  // Resource conflicts: multiple steps using same resource with no ordering
  const resourceConflicts: ResourceConflict[] = [];
  const resourceUsers = new Map<string, string[]>();

  for (const step of steps) {
    if (step.resources) {
      for (const res of step.resources) {
        if (!resourceUsers.has(res)) resourceUsers.set(res, []);
        resourceUsers.get(res)!.push(step.id);
      }
    }
  }

  for (const [resource, users] of resourceUsers) {
    if (users.length < 2) continue;

    // Check if all pairs have a dependency ordering
    let hasConflict = false;
    for (let i = 0; i < users.length && !hasConflict; i++) {
      for (let j = i + 1; j < users.length && !hasConflict; j++) {
        const a = users[i];
        const b = users[j];
        // Check if a depends on b or b depends on a (direct or transitive)
        const aStep = stepMap.get(a)!;
        const bStep = stepMap.get(b)!;
        const aDepOnB = hasTransitiveDep(a, b, stepMap, stepIdSet);
        const bDepOnA = hasTransitiveDep(b, a, stepMap, stepIdSet);
        if (!aDepOnB && !bDepOnA) {
          hasConflict = true;
        }
      }
    }

    if (hasConflict) {
      resourceConflicts.push({ resource, steps: users });
    }
  }

  // Completeness score
  const hasCycles = circularDeps.length > 0;
  let validDeps = 0;
  let totalDeps = 0;
  for (const step of steps) {
    for (const dep of step.dependencies) {
      totalDeps++;
      if (stepIdSet.has(dep)) validDeps++;
    }
  }

  const depScore = totalDeps === 0 ? 1 : validDeps / totalDeps;
  const cycleScore = hasCycles ? 0 : 1;
  const conflictScore = resourceConflicts.length === 0 ? 1 : Math.max(0, 1 - resourceConflicts.length * 0.2);
  const completenessScore = Math.round((depScore * 0.4 + cycleScore * 0.4 + conflictScore * 0.2) * 1000) / 1000;

  // Critical path
  const criticalPath = findCriticalPath(stepIds, adj, hasCycles);

  // Enforcement
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  if (hasCycles) {
    blockingIssues.push({
      mechanism: 'cycle_detection',
      description:
        `Found ${circularDeps.length} circular dependency cycle(s): ` +
        circularDeps.map(c => c.join(' -> ')).join('; '),
      severity: 'blocking',
    });
  }

  if (missingPrereqs.length > 0) {
    blockingIssues.push({
      mechanism: 'missing_prerequisite',
      description:
        `${missingPrereqs.length} missing prerequisite(s): ` +
        missingPrereqs.map(m => `step "${m.step_id}" depends on non-existent "${m.missing_dep}"`).join('; '),
      severity: 'blocking',
    });
  }

  if (resourceConflicts.length > 0) {
    for (const conflict of resourceConflicts) {
      warnings.push(
        `Resource "${conflict.resource}" is used by unordered steps: ${conflict.steps.join(', ')}. ` +
        `Add dependency ordering or separate the resource.`
      );
    }
  }

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'check_plan_validity', undefined, context)
    : '';

  const result: PlanValidityOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    is_valid: !hasFail && resourceConflicts.length === 0,
    circular_dependencies: circularDeps,
    missing_prerequisites: missingPrereqs,
    resource_conflicts: resourceConflicts,
    completeness_score: completenessScore,
    critical_path: criticalPath,
    step_count: steps.length,
    context_used: !!context,
  };

  if (hasFail || warnings.length > 0) {
    result.enforcement = {
      blocking_issues: blockingIssues,
      warnings,
      corrective_prompt: correctivePrompt,
    };
  }

  return result;
}

// ====== Helpers ======

function hasTransitiveDep(
  from: string,
  to: string,
  stepMap: Map<string, PlanStep>,
  idSet: Set<string>,
): boolean {
  const visited = new Set<string>();
  const queue = [from];
  visited.add(from);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const step = stepMap.get(current);
    if (!step) continue;

    for (const dep of step.dependencies) {
      if (dep === to) return true;
      if (idSet.has(dep) && !visited.has(dep)) {
        visited.add(dep);
        queue.push(dep);
      }
    }
  }

  return false;
}
