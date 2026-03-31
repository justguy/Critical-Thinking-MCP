/**
 * validate_reasoning_chain — DAG cycle detection + reachability analysis.
 *
 * Uses DFS with white/gray/black coloring for cycle detection.
 * Computes grounding_score: evidence-grounded paths / total conclusion paths.
 * Time complexity: O(V+E).
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import type {
  GraphNode,
  GraphEdge,
  BlockingIssue,
  EnforcementContext,
} from '../enforcement/types.js';

// ====== Output Types ======

interface CycleInfo {
  path: string[];
}

export interface ReasoningChainOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  cycles: CycleInfo[];
  orphaned_conclusions: string[];
  grounding_score: number;
  node_count: number;
  edge_count: number;
  context_used: boolean;
  enforcement?: {
    blocking_issues: BlockingIssue[];
    warnings: string[];
    corrective_prompt: string;
  };
}

// ====== Validation ======

function validateInput(input: unknown): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (input === null || typeof input !== 'object') {
    throw new Error(
      'Input must be an object with "nodes" and "edges" arrays. ' +
      'Each node requires fields: id (string), label (string), type ("claim"|"evidence"|"conclusion"|"assumption"). ' +
      'Each edge requires fields: from (string), to (string), relation ("supports"|"implies"|"contradicts"|"requires").'
    );
  }

  const obj = input as Record<string, unknown>;

  if (!Array.isArray(obj.nodes)) {
    throw new Error(
      'Missing or invalid "nodes" array. Provide an array of nodes, each with fields: id, label, type.'
    );
  }

  if (!Array.isArray(obj.edges)) {
    throw new Error(
      'Missing or invalid "edges" array. Provide an array of edges, each with fields: from, to, relation.'
    );
  }

  const nodes = obj.nodes as unknown[];
  const edges = obj.edges as unknown[];

  if (nodes.length < 2) {
    throw new Error(
      `Need at least 2 nodes, got ${nodes.length}. Each node requires fields: id, label, type.`
    );
  }

  if (edges.length < 1) {
    throw new Error(
      `Need at least 1 edge, got ${edges.length}. Each edge requires fields: from, to, relation.`
    );
  }

  const validNodeTypes = new Set(['claim', 'evidence', 'conclusion', 'assumption']);
  const validRelations = new Set(['supports', 'implies', 'contradicts', 'requires']);

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i] as Record<string, unknown>;
    if (!n || typeof n !== 'object') {
      throw new Error(
        `Node at index ${i} is not an object. Each node requires fields: id (string), label (string), type ("claim"|"evidence"|"conclusion"|"assumption").`
      );
    }
    if (typeof n.id !== 'string' || n.id.length === 0) {
      throw new Error(
        `Node at index ${i} is missing a valid "id" (string). Required fields: id, label, type.`
      );
    }
    if (typeof n.label !== 'string' || n.label.length === 0) {
      throw new Error(
        `Node at index ${i} (id="${n.id}") is missing a valid "label" (string). Required fields: id, label, type.`
      );
    }
    if (typeof n.type !== 'string' || !validNodeTypes.has(n.type)) {
      throw new Error(
        `Node at index ${i} (id="${n.id}") has invalid "type": "${String(n.type)}". Must be one of: claim, evidence, conclusion, assumption.`
      );
    }
  }

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i] as Record<string, unknown>;
    if (!e || typeof e !== 'object') {
      throw new Error(
        `Edge at index ${i} is not an object. Each edge requires fields: from (string), to (string), relation ("supports"|"implies"|"contradicts"|"requires").`
      );
    }
    if (typeof e.from !== 'string' || e.from.length === 0) {
      throw new Error(
        `Edge at index ${i} is missing a valid "from" field (string). Required fields: from, to, relation.`
      );
    }
    if (typeof e.to !== 'string' || e.to.length === 0) {
      throw new Error(
        `Edge at index ${i} is missing a valid "to" field (string). Required fields: from, to, relation.`
      );
    }
    if (typeof e.relation !== 'string' || !validRelations.has(e.relation)) {
      throw new Error(
        `Edge at index ${i} has invalid "relation": "${String(e.relation)}". Must be one of: supports, implies, contradicts, requires.`
      );
    }
  }

  return {
    nodes: nodes as GraphNode[],
    edges: edges as GraphEdge[],
  };
}

// ====== Cycle Detection (DFS with coloring) ======

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

function detectCycles(
  nodeIds: string[],
  adj: Map<string, string[]>,
): CycleInfo[] {
  const color = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const cycles: CycleInfo[] = [];

  for (const id of nodeIds) {
    color.set(id, WHITE);
  }

  function dfs(u: string, path: string[]): void {
    color.set(u, GRAY);
    path.push(u);

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      if (color.get(v) === GRAY) {
        // Back edge found — extract cycle
        const cycleStart = path.indexOf(v);
        if (cycleStart !== -1) {
          cycles.push({ path: path.slice(cycleStart).concat(v) });
        }
      } else if (color.get(v) === WHITE) {
        parent.set(v, u);
        dfs(v, path);
      }
    }

    path.pop();
    color.set(u, BLACK);
  }

  for (const id of nodeIds) {
    if (color.get(id) === WHITE) {
      parent.set(id, null);
      dfs(id, []);
    }
  }

  return cycles;
}

// ====== Grounding Score (path-based) ======

const MAX_PATH_DEPTH = 20;

/**
 * For each conclusion node, enumerate all backward paths (walking edges in
 * reverse from conclusion toward roots). A path is "grounded" if it terminates
 * at an evidence node.
 *
 * grounding_score = total grounded paths across all conclusions / total paths
 *
 * Uses memoized DFS with a depth cap of MAX_PATH_DEPTH to prevent
 * combinatorial explosion on large graphs.
 */
function computeGroundingScore(
  nodes: GraphNode[],
  _adj: Map<string, string[]>,
  reverseAdj: Map<string, string[]>,
): number {
  const conclusions = nodes.filter(n => n.type === 'conclusion');
  const evidenceIds = new Set(nodes.filter(n => n.type === 'evidence').map(n => n.id));

  if (conclusions.length === 0) return 1;

  // Memoized path counts per node: [totalPaths, groundedPaths]
  const memo = new Map<string, [number, number]>();

  /**
   * Count backward paths from `nodeId` toward roots.
   * Returns [totalPaths, groundedPaths].
   * A leaf (no predecessors) is one path; it's grounded if the leaf is an evidence node.
   */
  function countPaths(nodeId: string, depth: number, visiting: Set<string>): [number, number] {
    if (memo.has(nodeId)) return memo.get(nodeId)!;

    // Prevent cycles and depth explosion
    if (depth > MAX_PATH_DEPTH || visiting.has(nodeId)) {
      // Treat as a terminal: 1 path, grounded only if evidence
      const grounded = evidenceIds.has(nodeId) ? 1 : 0;
      return [1, grounded];
    }

    const predecessors = reverseAdj.get(nodeId) || [];

    // If this is a root node (no predecessors), it's a single path
    if (predecessors.length === 0) {
      const result: [number, number] = [1, evidenceIds.has(nodeId) ? 1 : 0];
      memo.set(nodeId, result);
      return result;
    }

    visiting.add(nodeId);
    let total = 0;
    let grounded = 0;

    for (const pred of predecessors) {
      const [pTotal, pGrounded] = countPaths(pred, depth + 1, visiting);
      total += pTotal;
      grounded += pGrounded;
    }

    visiting.delete(nodeId);

    const result: [number, number] = [total, grounded];
    memo.set(nodeId, result);
    return result;
  }

  let totalPaths = 0;
  let groundedPaths = 0;

  for (const conclusion of conclusions) {
    const [cTotal, cGrounded] = countPaths(conclusion.id, 0, new Set());
    totalPaths += cTotal;
    groundedPaths += cGrounded;
  }

  return totalPaths === 0 ? 1 : groundedPaths / totalPaths;
}

// ====== Handler ======

export function handleValidateReasoningChain(
  input: unknown,
  engine: EnforcementEngine,
): ReasoningChainOutput {
  const context = (input as any)?.context as EnforcementContext | undefined;
  const { nodes, edges } = validateInput(input);

  // Fix 6: Detect duplicate node ids
  const nodeIds = nodes.map(n => n.id);
  const seenIds = new Set<string>();
  for (const id of nodeIds) {
    if (seenIds.has(id)) {
      throw new Error(`Duplicate node id '${id}' found`);
    }
    seenIds.add(id);
  }

  // Fix 6: Check that all edge endpoints reference existing node ids
  const nodeSet = new Set(nodeIds);
  for (const edge of edges) {
    if (!nodeSet.has(edge.from)) {
      throw new Error(
        `Edge references unknown node id '${edge.from}'. Available node ids: [${nodeIds.join(', ')}]`,
      );
    }
    if (!nodeSet.has(edge.to)) {
      throw new Error(
        `Edge references unknown node id '${edge.to}'. Available node ids: [${nodeIds.join(', ')}]`,
      );
    }
  }

  // Build adjacency lists
  const adj = new Map<string, string[]>();
  const reverseAdj = new Map<string, string[]>();

  for (const id of nodeIds) {
    adj.set(id, []);
    reverseAdj.set(id, []);
  }

  for (const edge of edges) {
    adj.get(edge.from)!.push(edge.to);
    reverseAdj.get(edge.to)!.push(edge.from);
  }

  // Cycle detection
  const cycles = detectCycles(nodeIds, adj);

  // Orphaned conclusions: conclusion nodes with no incoming edges
  const orphanedConclusions = nodes
    .filter(n => n.type === 'conclusion' && (reverseAdj.get(n.id)?.length ?? 0) === 0)
    .map(n => n.id);

  // Grounding score
  const groundingScore = computeGroundingScore(nodes, adj, reverseAdj);

  // Enforcement: specificity check on node labels
  const blockingIssues: BlockingIssue[] = [];
  const warnings: string[] = [];

  // Consistency check
  const consistencyResult = engine.checkConsistency({
    challenges: nodes.filter(n => n.type === 'claim').map(n => n.label),
    strengths: nodes.filter(n => n.type === 'evidence').map(n => n.label),
  });

  if (!consistencyResult.consistent) {
    for (const v of consistencyResult.violations) {
      if (v.severity === 'blocking') {
        blockingIssues.push({
          mechanism: 'consistency',
          description: v.description,
          severity: 'blocking',
        });
      } else {
        warnings.push(`Consistency: ${v.description}`);
      }
    }
  }

  // Cycles are blocking
  if (cycles.length > 0) {
    blockingIssues.push({
      mechanism: 'cycle_detection',
      description: `Found ${cycles.length} circular reasoning cycle(s): ${cycles.map(c => c.path.join(' -> ')).join('; ')}`,
      severity: 'blocking',
    });
  }

  // Orphaned conclusions are blocking
  if (orphanedConclusions.length > 0) {
    blockingIssues.push({
      mechanism: 'orphan_detection',
      description: `${orphanedConclusions.length} conclusion(s) have no supporting evidence or claims: ${orphanedConclusions.join(', ')}`,
      severity: 'blocking',
    });
  }

  // Low grounding is a warning
  if (groundingScore < 0.5) {
    warnings.push(
      `Low grounding score (${groundingScore.toFixed(2)}). Most conclusions are not traceable to evidence nodes.`
    );
  }

  const hasFail = blockingIssues.length > 0;
  const correctivePrompt = hasFail
    ? engine.buildCorrectivePrompt(blockingIssues, warnings, 'validate_reasoning_chain', undefined, context)
    : '';

  const result: ReasoningChainOutput = {
    status: hasFail ? 'ENFORCEMENT_FAIL' : 'PASS',
    cycles,
    orphaned_conclusions: orphanedConclusions,
    grounding_score: Math.round(groundingScore * 1000) / 1000,
    node_count: nodes.length,
    edge_count: edges.length,
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
