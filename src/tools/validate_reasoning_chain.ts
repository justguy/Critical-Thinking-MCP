/**
 * validate_reasoning_chain — DAG cycle detection + reachability analysis.
 *
 * Uses DFS with white/gray/black coloring for cycle detection.
 * Computes grounding_score: evidence-grounded paths / total conclusion paths.
 * Time complexity: O(V+E).
 * No LLM calls.
 */

import type { EnforcementEngine } from '../enforcement/index.js';
import { tokenize } from '../enforcement/index.js';
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

/**
 * Phase 3.3 (Cat-2) reasoning advisories. ADVISORY until Phase 4 proves them — they
 * populate `warnings`, never `blocking_issues`, and never flip `status`. Both are OPT-IN
 * and profile-scoped by the caller declaring the relevant input field:
 *   - competing_hypothesis runs only when `require_competing_hypothesis: true`
 *     (diagnosis/causal/investigation profiles per §9).
 *   - reversal_condition runs only when a `decision` block with rejected finalists is
 *     supplied (decision/diagnosis profiles per §9).
 * Each advisory is present in the output only when it was evaluated.
 */
interface ReasoningAdvisories {
  competing_hypothesis?: {
    triggered: boolean;
    has_contradicts_edge: boolean;
    conclusion_count: number;
    detail: string;
  };
  reversal_condition?: {
    triggered: boolean;
    rejected_option_ids: string[];
    missing_reversal_for: string[];
    detail: string;
  };
}

export interface ReasoningChainOutput {
  status: 'PASS' | 'ENFORCEMENT_FAIL';
  cycles: CycleInfo[];
  orphaned_conclusions: string[];
  grounding_score: number;
  node_count: number;
  edge_count: number;
  context_used: boolean;
  /** Phase 3.3 advisory signals; only the evaluated checks appear. Never blocks. */
  reasoning_advisories?: ReasoningAdvisories;
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

// ====== #11 Premise-usage reconciliation ======

/**
 * Reverse-reachable premises (evidence|assumption) of a conclusion via reverseAdj BFS.
 */
function reverseReachablePremises(
  conclusionId: string,
  reverseAdj: Map<string, string[]>,
  nodeTypeById: Map<string, string>,
): Set<string> {
  const R = new Set<string>();
  const visited = new Set<string>([conclusionId]);
  const queue = [...(reverseAdj.get(conclusionId) ?? [])];
  while (queue.length > 0) {
    const v = queue.shift()!;
    if (visited.has(v)) continue;
    visited.add(v);
    const t = nodeTypeById.get(v);
    if (t === 'evidence' || t === 'assumption') R.add(v);
    for (const p of reverseAdj.get(v) ?? []) if (!visited.has(p)) queue.push(p);
  }
  return R;
}

// ====== #10 Redundant evidence (vertex-disjoint max-flow / Menger) ======

const SUPPORT_RELATIONS = new Set(['supports', 'implies', 'requires']);

/**
 * Count vertex-disjoint evidence→conclusion paths via max-flow with node splitting
 * (each node v → v|in→v|out cap 1, except the conclusion sink which is uncapped).
 * Returns the count and the evidence nodes that originated the disjoint paths.
 */
function maxFlowDisjointPaths(
  conclusionId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  evidenceIds: string[],
): { count: number; witnessEvidence: string[] } {
  const cap = new Map<string, Map<string, number>>();
  const addEdge = (u: string, v: string, c: number) => {
    if (!cap.has(u)) cap.set(u, new Map());
    if (!cap.has(v)) cap.set(v, new Map());
    cap.get(u)!.set(v, (cap.get(u)!.get(v) ?? 0) + c);
    if (!cap.get(v)!.has(u)) cap.get(v)!.set(u, 0); // reverse residual
  };

  for (const n of nodes) {
    addEdge(`${n.id}|in`, `${n.id}|out`, n.id === conclusionId ? Infinity : 1);
  }
  for (const e of edges) {
    if (SUPPORT_RELATIONS.has(e.relation)) addEdge(`${e.from}|out`, `${e.to}|in`, 1);
  }
  // Only ROOT evidence (no incoming support/implies/requires edge) is an independent
  // source. Evidence derived from other evidence is not a second independent root, so
  // it must NOT get its own source edge (else one root cause counts as two paths).
  const hasSupportInto = new Set<string>();
  for (const e of edges) if (SUPPORT_RELATIONS.has(e.relation)) hasSupportInto.add(e.to);
  const rootEvidence = evidenceIds.filter(id => !hasSupportInto.has(id));

  for (const eid of rootEvidence) addEdge('S', `${eid}|in`, 1);
  addEdge(`${conclusionId}|out`, 'T', Infinity);

  let flow = 0;
  // Edmonds-Karp; each augmenting path has a unit bottleneck (source edges cap 1),
  // so this terminates in ≤ |evidence| iterations.
  for (;;) {
    const parent = new Map<string, string>();
    parent.set('S', 'S');
    const queue = ['S'];
    while (queue.length > 0) {
      const u = queue.shift()!;
      for (const [v, c] of cap.get(u) ?? []) {
        if (c > 0 && !parent.has(v)) {
          parent.set(v, u);
          queue.push(v);
        }
      }
    }
    if (!parent.has('T')) break;

    let bottleneck = Infinity;
    for (let v = 'T'; v !== 'S'; v = parent.get(v)!) {
      bottleneck = Math.min(bottleneck, cap.get(parent.get(v)!)!.get(v)!);
    }
    for (let v = 'T'; v !== 'S'; v = parent.get(v)!) {
      const u = parent.get(v)!;
      cap.get(u)!.set(v, cap.get(u)!.get(v)! - bottleneck);
      cap.get(v)!.set(u, (cap.get(v)!.get(u) ?? 0) + bottleneck);
    }
    flow += bottleneck;
  }

  const witnessEvidence: string[] = [];
  for (const eid of rootEvidence) {
    if ((cap.get('S')?.get(`${eid}|in`) ?? 0) === 0) witnessEvidence.push(eid);
  }
  return { count: flow, witnessEvidence };
}

/**
 * Two evidence labels are independent unless they are lexical near-duplicates. Uses
 * unigram token-set Jaccard (not bigram) so word reordering can't fake independence,
 * and falls back to exact-string distinctness for single-word labels (whose bigram
 * sets are empty — where bigram Jaccard wrongly returns 1.0).
 */
function lexicallyDistinct(a: string, b: string): boolean {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) {
    return a.trim().toLowerCase() !== b.trim().toLowerCase();
  }
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  const sim = union === 0 ? 1 : inter / union;
  return sim < 0.8;
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

  // ── #11 Premise-usage reconciliation (opt-in via declared_support) ─────────
  const nodeTypeById = new Map(nodes.map(n => [n.id, n.type]));
  const nodeLabelById = new Map(nodes.map(n => [n.id, n.label]));
  const evidenceIds = nodes.filter(n => n.type === 'evidence').map(n => n.id);

  const declaredSupport = (input as any)?.declared_support;
  if (Array.isArray(declaredSupport)) {
    // Premise reachability must follow SUPPORT relations only — a `contradicts` edge is
    // not a premise the conclusion rests on (matching #10's SUPPORT_RELATIONS).
    const supportReverseAdj = new Map<string, string[]>();
    for (const id of nodeIds) supportReverseAdj.set(id, []);
    for (const edge of edges) {
      if (SUPPORT_RELATIONS.has(edge.relation)) supportReverseAdj.get(edge.to)!.push(edge.from);
    }

    for (const entry of declaredSupport) {
      const cid = entry?.conclusion_id;
      const premiseIds: string[] = Array.isArray(entry?.premise_ids)
        ? [...new Set(entry.premise_ids as string[])]
        : [];
      if (typeof cid !== 'string' || !nodeSet.has(cid)) continue;

      const R = reverseReachablePremises(cid, supportReverseAdj, nodeTypeById);
      const declaredSet = new Set(premiseIds);

      // phantom: declared premise not reachable via support edges
      for (const pid of premiseIds) {
        if (!R.has(pid)) {
          const reason = nodeSet.has(pid)
            ? 'is not reachable from the conclusion via support edges (phantom dependency)'
            : 'is not a node in the graph (unknown id)';
          blockingIssues.push({
            mechanism: 'premise_usage',
            description: `Declared premise '${pid}' for conclusion '${cid}' ${reason}.`,
            severity: 'blocking',
          });
        }
      }

      // undeclared DIRECT support predecessor (evidence|assumption) → blocking; transitive → warning
      const directPrem = [
        ...new Set(
          (supportReverseAdj.get(cid) ?? []).filter(p => {
            const t = nodeTypeById.get(p);
            return t === 'evidence' || t === 'assumption';
          }),
        ),
      ];
      const directSet = new Set(directPrem);
      for (const p of directPrem) {
        if (!declaredSet.has(p)) {
          blockingIssues.push({
            mechanism: 'premise_usage',
            description: `Conclusion '${cid}' directly depends on premise '${p}' but it was not declared.`,
            severity: 'blocking',
          });
        }
      }
      for (const p of R) {
        if (!declaredSet.has(p) && !directSet.has(p)) {
          warnings.push(`Conclusion '${cid}' transitively rests on undeclared premise '${p}'.`);
        }
      }
    }
  }

  // ── #10 Redundant evidence (opt-in via require_redundancy_for) ─────────────
  const requireRedundancy = (input as any)?.require_redundancy_for;
  if (Array.isArray(requireRedundancy)) {
    for (const cid of requireRedundancy) {
      if (typeof cid !== 'string' || nodeTypeById.get(cid) !== 'conclusion') continue;
      const { count, witnessEvidence } = maxFlowDisjointPaths(cid, nodes, edges, evidenceIds);
      if (count < 2) {
        blockingIssues.push({
          mechanism: 'redundant_evidence',
          description: `Conclusion '${cid}' has only ${count} vertex-disjoint evidence path(s); ≥2 independent paths required.`,
          severity: 'blocking',
        });
        continue;
      }
      // independence: at least two witness evidence must be lexically distinct
      let independent = false;
      for (let i = 0; i < witnessEvidence.length && !independent; i++) {
        for (let j = i + 1; j < witnessEvidence.length && !independent; j++) {
          if (lexicallyDistinct(nodeLabelById.get(witnessEvidence[i]) ?? '', nodeLabelById.get(witnessEvidence[j]) ?? '')) {
            independent = true;
          }
        }
      }
      if (!independent) {
        blockingIssues.push({
          mechanism: 'redundant_evidence',
          description: `Conclusion '${cid}' has ${count} paths but their evidence are near-duplicates (not independent support).`,
          severity: 'blocking',
        });
      }
    }
  }

  // ── Phase 3.3 reasoning advisories (Cat-2, ADVISORY — warnings only, never block) ──
  const reasoningAdvisories: ReasoningAdvisories = {};

  // (a) require_competing_hypothesis — OPT-IN, diagnosis/causal/investigation profiles only.
  // A one-sided chain is one whose conclusions rest on no `contradicts` edge AND offers no
  // alternative conclusion (a single conclusion node). Deterministic structural predicate.
  if ((input as any)?.require_competing_hypothesis === true) {
    const hasContradicts = edges.some(e => e.relation === 'contradicts');
    const conclusionCount = nodes.filter(n => n.type === 'conclusion').length;
    const oneSided = !hasContradicts && conclusionCount < 2;
    reasoningAdvisories.competing_hypothesis = {
      triggered: oneSided,
      has_contradicts_edge: hasContradicts,
      conclusion_count: conclusionCount,
      detail: oneSided
        ? 'One-sided chain: no contradicts edge and fewer than two conclusions (no alternative considered).'
        : hasContradicts
          ? 'Chain contains at least one contradicts edge (a competing consideration is modeled).'
          : 'Chain offers at least two conclusions (alternatives are modeled).',
    };
    if (oneSided) {
      warnings.push(
        'ADVISORY (competing-hypothesis): this diagnosis/causal chain is one-sided — it has no ' +
        "`contradicts` edge and only one conclusion. A sound diagnosis should model at least one " +
        'competing hypothesis (an alternative conclusion or a contradicting consideration).'
      );
    }
  }

  // (b) Rejected-option reversal condition — OPT-IN, decision/diagnosis profiles only.
  // STRUCTURAL predicate (NOT a similarity/steelman score): the caller declares a `decision`
  // with rejected finalists and a list of reversal conditions. For each rejected finalist we
  // count how many declared reversal conditions name it with non-empty condition text. The
  // predicate flags any rejected finalist with ZERO such conditions. No text comparison, no
  // scoring — pure presence-counting over declared structure.
  const decision = (input as any)?.decision;
  if (decision && typeof decision === 'object') {
    const rejectedRaw = Array.isArray(decision.rejected_option_ids) ? decision.rejected_option_ids : [];
    const rejectedIds = [...new Set(rejectedRaw.filter((x: unknown): x is string => typeof x === 'string'))] as string[];

    if (rejectedIds.length > 0) {
      const reversalEntries: unknown[] = Array.isArray((input as any)?.reversal_conditions)
        ? (input as any).reversal_conditions
        : [];
      // Set of rejected option ids that have >=1 reversal condition with non-empty text.
      const covered = new Set<string>();
      for (const entry of reversalEntries) {
        const e = entry as Record<string, unknown>;
        const oid = e?.rejected_option_id;
        const cond = e?.condition_text;
        if (typeof oid === 'string' && typeof cond === 'string' && cond.trim().length > 0) {
          covered.add(oid);
        }
      }
      const missing = rejectedIds.filter(id => !covered.has(id));
      reasoningAdvisories.reversal_condition = {
        triggered: missing.length > 0,
        rejected_option_ids: rejectedIds,
        missing_reversal_for: missing,
        detail: missing.length === 0
          ? 'Every rejected finalist has at least one declared reversal condition.'
          : `${missing.length} rejected finalist(s) have no declared reversal condition: ${missing.join(', ')}.`,
      };
      if (missing.length > 0) {
        warnings.push(
          `ADVISORY (rejected-option reversal condition): ${missing.length} rejected finalist(s) ` +
          `[${missing.join(', ')}] have no stated condition under which they would become preferred. ` +
          'For decision robustness, state >=1 condition that would flip each rejected finalist to the chosen option.'
        );
      }
    }
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

  if (reasoningAdvisories.competing_hypothesis || reasoningAdvisories.reversal_condition) {
    result.reasoning_advisories = reasoningAdvisories;
  }

  if (hasFail || warnings.length > 0) {
    result.enforcement = {
      blocking_issues: blockingIssues,
      warnings,
      corrective_prompt: correctivePrompt,
    };
  }

  return result;
}
