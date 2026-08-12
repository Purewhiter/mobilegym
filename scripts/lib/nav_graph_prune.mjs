/**
 * Graph pruning for the navigation toolchain (data mode).
 *
 * - pruneGraphByConditions: three-layer condition pruning — node
 *   stateCondition, edge uiCondition, and node-level action.condition.
 *   Undecidable conditions keep the element and stamp a `conditionStatus`
 *   marker instead of pruning.
 * - pruneGraphByReachability: BFS from entryPoint nodes; shared by schema
 *   mode (warn only) and data mode (optional --prune-unreachable).
 *
 * Extracted from navigation_declaration_analyzer.mjs (pure move, no behavior
 * change). Consumer: the analyzer CLI.
 */
import { evaluateCondition } from './nav_condition_eval.mjs';

export function pruneGraphByConditions(graph, data) {
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]));

  const pruneActionsByCondition = (node) => {
    if (!Array.isArray(node?.actions) || node.actions.length === 0) return;
    const boundParams = node.boundParams ?? {};
    const keptActions = [];
    for (const a of node.actions) {
      const ac = a?.condition;
      if (!ac) {
        keptActions.push(a);
        continue;
      }
      const { satisfied, evaluable, reason } = evaluateCondition(ac, { boundParams, data });
      if (evaluable && !satisfied) continue; // prune
      if (!evaluable) {
        a.conditionStatus = { status: 'unevaluable', reason };
      }
      keptActions.push(a);
    }
    node.actions = keptActions;
  };

  // 1) Node pruning by stateCondition
  const keptNodes = [];
  for (const node of graph.nodes) {
    const condition = node.stateCondition;
    if (!condition) {
      pruneActionsByCondition(node);
      keptNodes.push(node);
      continue;
    }
    const { satisfied, evaluable, reason } = evaluateCondition(condition, {
      boundParams: node.boundParams ?? {},
      data,
    });
    if (evaluable && !satisfied) {
      continue; // prune
    }
    if (!evaluable) {
      node.conditionStatus = { status: 'unevaluable', reason };
    }
    pruneActionsByCondition(node);
    keptNodes.push(node);
  }

  const keptNodeIds = new Set(keptNodes.map(n => n.id));

  // 2) Edge pruning by uiCondition
  const keptEdges = [];
  for (const edge of graph.edges) {
    // Drop edges referencing pruned nodes (except wildcard sources)
    if (edge.source !== '*' && !keptNodeIds.has(edge.source)) continue;
    if (!keptNodeIds.has(edge.target)) continue;

    const condition = edge.uiCondition;
    if (!condition) {
      keptEdges.push(edge);
      continue;
    }

    // Build evaluation context: prefer explicit binding values, fallback to source node boundParams.
    const boundParams = {};
    if (edge.binding) {
      for (const [k, v] of Object.entries(edge.binding)) {
        boundParams[k] = String(v?.value);
      }
    }
    const sourceNode = nodeById.get(edge.source);
    if (sourceNode?.boundParams) {
      for (const [k, v] of Object.entries(sourceNode.boundParams)) {
        if (boundParams[k] === undefined) boundParams[k] = String(v);
      }
    }

    const { satisfied, evaluable, reason } = evaluateCondition(condition, { boundParams, data });
    if (evaluable && !satisfied) {
      continue; // prune
    }
    if (!evaluable) {
      edge.conditionStatus = { status: 'unevaluable', reason };
    }
    keptEdges.push(edge);
  }

  return { nodes: keptNodes, edges: keptEdges };
}

/**
 * Prune nodes/edges that are not reachable from entryPoint nodes.
 *
 * Why: In data mode we expand concrete nodes via dataSource / param inheritance,
 * then prune edges by conditions. This can leave "islands" of concrete nodes
 * (e.g. expanded first, then incoming edges removed by condition) that are
 * not reachable from any entry point. Those islands are confusing in UI graphs.
 */
export function pruneGraphByReachability(graph) {
  const allNodeIds = new Set(graph.nodes.map(n => n.id));
  const entryNodes = graph.nodes.filter(n => n.entryPoint).map(n => n.id);

  // If declaration didn't mark any entry point, keep everything (schema-like behavior).
  if (entryNodes.length === 0) {
    return graph;
  }

  const adjacency = new Map();
  const addAdj = (source, target) => {
    if (!adjacency.has(source)) adjacency.set(source, new Set());
    adjacency.get(source).add(target);
  };

  for (const edge of graph.edges) {
    // Only traverse edges to existing nodes
    if (!allNodeIds.has(edge.target)) continue;

    // Global edge: treat as reachable from entry points
    if (edge.source === '*') {
      for (const s of entryNodes) addAdj(s, edge.target);
      continue;
    }

    // Only use concrete sources (virtual sources like "/path?tab=*" are ignored here)
    if (!allNodeIds.has(edge.source)) continue;

    addAdj(edge.source, edge.target);
  }

  const reachable = new Set(entryNodes);
  const queue = [...entryNodes];
  while (queue.length > 0) {
    const current = queue.shift();
    const nextSet = adjacency.get(current);
    if (!nextSet) continue;
    for (const next of nextSet) {
      if (reachable.has(next)) continue;
      reachable.add(next);
      queue.push(next);
    }
  }

  const keptNodes = graph.nodes.filter(n => reachable.has(n.id));
  const keptNodeIds = new Set(keptNodes.map(n => n.id));

  const keptEdges = graph.edges.filter(edge => {
    if (!keptNodeIds.has(edge.target)) return false;
    if (edge.source === '*') return true;
    if (!allNodeIds.has(edge.source)) return false;
    return keptNodeIds.has(edge.source);
  });

  return { nodes: keptNodes, edges: keptEdges };
}
