/**
 * Temporal reasoning registry.
 *
 * The registry lives in orchestrator runtime state, not inside deterministic
 * tools. It carries forward prior structured reasoning assertions so later
 * turns can be validated against the accumulated graph deterministically.
 */

import type {
  ReasoningChainContract,
  TemporalReasoningRegistry,
} from './types.js';

function canonicalKey(node: ReasoningChainContract['nodes'][number]): string {
  return `${node.type}:${node.label.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

function canonicalIdFromKey(key: string): string {
  return key
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export function buildTemporalRegistry(
  contract: ReasoningChainContract,
): TemporalReasoningRegistry {
  const nodeByOriginalId = new Map<string, ReasoningChainContract['nodes'][number]>();
  const nodeByCanonicalId = new Map<string, ReasoningChainContract['nodes'][number]>();

  for (const node of contract.nodes) {
    nodeByOriginalId.set(node.id, node);
    const key = canonicalKey(node);
    const canonicalId = canonicalIdFromKey(key);
    if (!nodeByCanonicalId.has(canonicalId)) {
      nodeByCanonicalId.set(canonicalId, {
        id: canonicalId,
        label: node.label.trim(),
        type: node.type,
      });
    }
  }

  const edgeKeys = new Set<string>();
  const edges: ReasoningChainContract['edges'] = [];

  for (const edge of contract.edges) {
    const fromNode = nodeByOriginalId.get(edge.from);
    const toNode = nodeByOriginalId.get(edge.to);
    if (!fromNode || !toNode) continue;

    const from = canonicalIdFromKey(canonicalKey(fromNode));
    const to = canonicalIdFromKey(canonicalKey(toNode));
    const edgeKey = `${from}|${edge.relation}|${to}`;
    if (edgeKeys.has(edgeKey)) continue;
    edgeKeys.add(edgeKey);
    edges.push({ from, to, relation: edge.relation });
  }

  return {
    nodes: [...nodeByCanonicalId.values()],
    edges,
  };
}

export function mergeTemporalReasoningRegistry(
  prior: TemporalReasoningRegistry | undefined,
  current: ReasoningChainContract,
): {
  mergedContract: ReasoningChainContract;
  registry: TemporalReasoningRegistry;
} {
  const currentRegistry = buildTemporalRegistry(current);
  if (!prior) {
    return {
      mergedContract: currentRegistry,
      registry: currentRegistry,
    };
  }

  const nodes = new Map<string, TemporalReasoningRegistry['nodes'][number]>();
  for (const node of prior.nodes) nodes.set(node.id, node);
  for (const node of currentRegistry.nodes) nodes.set(node.id, node);

  const edges: TemporalReasoningRegistry['edges'] = [];
  const edgeKeys = new Set<string>();
  for (const edge of [...prior.edges, ...currentRegistry.edges]) {
    const edgeKey = `${edge.from}|${edge.relation}|${edge.to}`;
    if (edgeKeys.has(edgeKey)) continue;
    edgeKeys.add(edgeKey);
    edges.push(edge);
  }

  const registry: TemporalReasoningRegistry = {
    nodes: [...nodes.values()],
    edges,
  };

  return {
    mergedContract: registry,
    registry,
  };
}
