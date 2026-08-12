/**
 * Nav graph JSON schema versioning + minimal structural validation.
 *
 * Producer: navigation_declaration_analyzer.mjs stamps `schemaVersion` (and
 * `variant: 'simplified'` on the *_simplified companion output).
 * Consumers: generate_action_tasks_from_nav_graph.mjs validates before use;
 * scripts/nav_path_finder.py mirrors these checks in Python (keep in sync).
 *
 * Compatibility policy:
 * - schemaVersion missing        -> accepted as legacy, with a warning
 * - schemaVersion present, wrong -> hard error
 * - simplified-graph features    -> hard error (task generation / path finding
 *   need the full uiState-level graph, not the route-level simplified view)
 */

export const NAV_GRAPH_SCHEMA_VERSION = 1;

/**
 * Detect the route-level "simplified" companion graph.
 * Newly generated files carry `variant: 'simplified'`; legacy files are detected
 * structurally (top-level edgeCount without transitionCount, nodes[].states
 * aggregation, edges[].transitions merge lists).
 *
 * @param {any} graph
 * @returns {string|null} human-readable reason if simplified, else null
 */
export function detectSimplifiedGraph(graph) {
  if (!graph || typeof graph !== 'object') return null;
  if (graph.variant === 'simplified') {
    return 'top-level variant is "simplified"';
  }
  if (graph.edgeCount !== undefined && graph.transitionCount === undefined) {
    return 'top-level has edgeCount but no transitionCount (simplified output shape)';
  }
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  if (nodes.some(n => n && typeof n === 'object' && Array.isArray(n.states))) {
    return 'nodes[] carry aggregated "states" lists (route-level simplified nodes)';
  }
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  if (edges.some(e => e && typeof e === 'object' && Array.isArray(e.transitions))) {
    return 'edges[] carry merged "transitions" lists (route-level simplified edges)';
  }
  return null;
}

/**
 * Minimal structural validation of a full nav graph.
 *
 * @param {any} graph parsed JSON
 * @returns {{problems: string[], warnings: string[]}}
 */
export function collectNavGraphProblems(graph) {
  const problems = [];
  const warnings = [];

  if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
    problems.push('graph JSON must be an object with nodes[]/edges[]');
    return { problems, warnings };
  }

  const simplifiedReason = detectSimplifiedGraph(graph);
  if (simplifiedReason) {
    problems.push(
      `this looks like a *_simplified nav graph (${simplifiedReason}); ` +
        'feed the full nav graph (e.g. public/<app>_nav_graph.json), not the simplified companion',
    );
    return { problems, warnings };
  }

  if (graph.schemaVersion === undefined) {
    warnings.push(
      `graph has no schemaVersion (legacy output); expected schemaVersion=${NAV_GRAPH_SCHEMA_VERSION}. ` +
        'Regenerate with scripts/navigation_declaration_analyzer.mjs to stamp it.',
    );
  } else if (graph.schemaVersion !== NAV_GRAPH_SCHEMA_VERSION) {
    problems.push(
      `unsupported schemaVersion=${JSON.stringify(graph.schemaVersion)}; this tool supports schemaVersion=${NAV_GRAPH_SCHEMA_VERSION}`,
    );
  }

  if (!Array.isArray(graph.nodes)) {
    problems.push('graph.nodes is missing or not an array');
  } else if (graph.nodes.length === 0) {
    problems.push('graph.nodes is empty — nothing to traverse');
  }
  if (!Array.isArray(graph.edges)) {
    problems.push('graph.edges is missing or not an array');
  }

  if (Array.isArray(graph.nodes)) {
    const badIds = [];
    for (const n of graph.nodes) {
      const id = n && typeof n === 'object' ? n.id : undefined;
      if (typeof id !== 'string' || !id.startsWith('/')) {
        badIds.push(id === undefined ? '<missing id>' : JSON.stringify(id));
        if (badIds.length >= 5) break;
      }
    }
    if (badIds.length > 0) {
      problems.push(`node ids must be strings starting with "/"; offending ids: ${badIds.join(', ')}`);
    }
  }

  return { problems, warnings };
}

/**
 * Validate a nav graph; print problems/warnings with the given log prefix and
 * exit(1) when the graph is unusable.
 *
 * @param {any} graph parsed JSON
 * @param {string} graphPath for log messages
 * @param {{logPrefix?: string}} [options]
 */
export function assertUsableNavGraph(graph, graphPath, options = {}) {
  const prefix = options.logPrefix ?? '[NavGraph]';
  const { problems, warnings } = collectNavGraphProblems(graph);
  for (const w of warnings) {
    console.warn(`${prefix} WARN: ${w} (graph: ${graphPath})`);
  }
  if (problems.length > 0) {
    for (const p of problems) {
      console.error(`${prefix} ERROR: ${p} (graph: ${graphPath})`);
    }
    process.exit(1);
  }
}
