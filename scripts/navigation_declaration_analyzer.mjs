#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  loadNavigationDeclaration,
  loadDataConfig,
  resolveAppDir,
} from './lib/declaration_loader.mjs';
import { NAV_GRAPH_SCHEMA_VERSION } from './lib/nav_graph_schema.mjs';
import { resolveRefData, refNeedsParams, applyFilterFn } from './lib/nav_ref_resolver.mjs';
import { evaluateCondition } from './lib/nav_condition_eval.mjs';
import {
  matchFromConstraint,
  pathHasParams,
  extractPathParams,
  buildConcreteNodeId,
  normalizeFrom,
  normalizeEntryPointDeclaration,
  normalizeSearch,
  serializeSearch,
  buildNodeId,
  resolveTargetNodeId,
  resolveSourceNodeId,
  isNodeId,
  expandFromConstraint,
  extractRoutePath,
  determineEdgeType,
  applyPreserveParamsToSearch,
} from './lib/nav_graph_core.mjs';
import { pruneGraphByConditions, pruneGraphByReachability } from './lib/nav_graph_prune.mjs';
import { buildGraph, buildSimplifiedGraph } from './lib/nav_schema_graph.mjs';

function usage() {
  console.log(`Usage: node scripts/navigation_declaration_analyzer.mjs <AppName|AppPath> [options]

Options:
  --apps-root <dir>   Root directory for apps (default: apps)
  --output, -o <file> Output file path
  --format, -f <fmt>  Output format: json|pretty (default: pretty)
  --data <file>       Data config file for expanding dataSource (recommended: data/index.ts)
  --data-export <name> Export name in data file (default: auto-detect *_CONFIG)
  --data-limit <n>    Data mode: max items per dataSource.ref expansion (default: 10). Use 0 to disable.
  --prune-unreachable  Data mode: prune unreachable islands (default: false)
  --emit-action-tasks  Also generate public/*_action_tasks*.json next to the graph output (requires --output/-o)
  --action-tasks-out <file> Override action tasks output path (default: inferred from graph output name)

Examples:
  # Schema mode (no data expansion)
  node scripts/navigation_declaration_analyzer.mjs TencentMeeting

  # Data mode (with dataSource expansion)
  node scripts/navigation_declaration_analyzer.mjs WechatReading --data data/index.ts -o public/wechatreading_data_graph.json
`);
}

function parseArgs(argv) {
  const args = [...argv];
  if (args.length === 0) {
    usage();
    process.exit(1);
  }

  const app = args.shift();
  const options = {
    app,
    appsRoot: 'apps',
    output: undefined,
    format: 'pretty',
    dataFile: undefined,
    dataExport: undefined,
    dataLimit: 10,
    pruneUnreachable: false,
    emitActionTasks: false,
    actionTasksOut: undefined,
  };

  while (args.length > 0) {
    const flag = args.shift();
    switch (flag) {
      case '--apps-root':
        options.appsRoot = args.shift() ?? options.appsRoot;
        break;
      case '--output':
      case '-o':
        options.output = args.shift();
        break;
      case '--format':
      case '-f':
        options.format = args.shift() ?? 'json';
        break;
      case '--data':
        options.dataFile = args.shift();
        break;
      case '--data-export':
        options.dataExport = args.shift();
        break;
      case '--data-limit': {
        const raw = args.shift();
        const n = Number(raw);
        if (!Number.isFinite(n) || Number.isNaN(n) || n < 0) {
          console.warn(`Invalid --data-limit value: ${raw}. Must be a non-negative number.`);
          process.exit(2);
        }
        options.dataLimit = n;
        break;
      }
      case '--prune-unreachable':
        options.pruneUnreachable = true;
        break;
      case '--emit-action-tasks':
        options.emitActionTasks = true;
        break;
      case '--action-tasks-out':
        options.actionTasksOut = args.shift();
        break;
      default:
        console.warn(`Unknown option: ${flag}`);
        usage();
        process.exit(1);
    }
  }

  return options;
}

function guessActionTasksOutPath(graphOutPath) {
  if (typeof graphOutPath !== 'string') return null;
  if (graphOutPath.endsWith('_nav_graph.json')) {
    return graphOutPath.replace('_nav_graph.json', '_action_tasks.json');
  }
  if (graphOutPath.endsWith('_data_graph.json')) {
    return graphOutPath.replace('_data_graph.json', '_action_tasks_data.json');
  }
  if (graphOutPath.endsWith('.json')) {
    return graphOutPath.replace(/\.json$/, '_action_tasks.json');
  }
  return `${graphOutPath}_action_tasks.json`;
}

// App directory resolution and declaration/data-config loading live in
// scripts/lib/declaration_loader.mjs (shared with the consistency checker so the
// two tools can never disagree on what a declaration contains).

// Ref path DSL lives in scripts/lib/nav_ref_resolver.mjs; condition evaluation
// (12-op tri-state DSL) lives in scripts/lib/nav_condition_eval.mjs; condition/
// reachability pruning lives in scripts/lib/nav_graph_prune.mjs.

// ============================================================================
// DATA-DRIVEN GRAPH EXPANSION
// ============================================================================

/**
 * Find matching dataSource for a source node
 */
function findMatchingDataSource(dataSources, sourceRoutePath, sourceSearch) {
  if (!dataSources) return null;

  const sources = Array.isArray(dataSources) ? dataSources : [dataSources];

  // Find first matching source (priority by specificity)
  for (const ds of sources) {
    const fromConstraint = ds.from ?? '*';
    if (matchFromConstraint(fromConstraint, sourceRoutePath, sourceSearch)) {
      return ds;
    }
  }

  return null;
}

/**
 * Expand edges using dataSource - Complete rewrite
 * 
 * Strategy:
 * 1. For edges with dataSource: expand target params from data
 * 2. For edges where target inherits source params: expand source first, then propagate
 * 3. Keep schema edges that don't need expansion
 */
function expandEdgesWithData(schemaEdges, nodes, data, routeIndex, declaration, dataLimit = 10) {
  const expandedEdges = [];
  const expandedNodes = new Map(); // nodeId -> node

  // Add all schema nodes first (but mark parameterized ones)
  for (const node of nodes) {
    expandedNodes.set(node.id, node);
  }

  const edgeKeySet = new Set();
  const pushEdgeOnce = (edge) => {
    const key = `${edge.id}@@${edge.source}@@${edge.target}`;
    if (edgeKeySet.has(key)) return;
    edgeKeySet.add(key);
    expandedEdges.push(edge);
  };

  // Build a map of transition ID to full transition definition
  const transitionMap = new Map();
  for (const t of declaration.transitions) {
    transitionMap.set(t.id, t);
  }

  const searchKeyOf = (searchObj) => serializeSearch(normalizeSearch(searchObj ?? {}));

  function shouldKeepEdgeByUiCondition(condition, sourceNode, binding) {
    if (!condition || !data) return { keep: true, evaluable: false };

    // Prefer explicit binding values (edge-level), fallback to source node boundParams.
    const boundParams = {};
    if (binding) {
      for (const [k, v] of Object.entries(binding)) {
        boundParams[k] = String(v?.value);
      }
    }
    if (sourceNode?.boundParams) {
      for (const [k, v] of Object.entries(sourceNode.boundParams)) {
        if (boundParams[k] === undefined) boundParams[k] = String(v);
      }
    }

    const { satisfied, evaluable } = evaluateCondition(condition, { boundParams, data });
    if (evaluable && !satisfied) return { keep: false, evaluable: true };
    return { keep: true, evaluable };
  }

  function addConcreteTargetNode(targetId, targetSchemaId, boundParams, expandedFrom) {
    if (expandedNodes.has(targetId)) return;
    // Prefer the exact schema node (uiState) when possible; fall back to routePath match.
    const targetRoutePath = extractRoutePath(targetSchemaId);
    const targetSchemaNode =
      nodes.find(n => n.id === targetSchemaId) ??
      nodes.find(n => n.routePath === targetRoutePath);
    if (!targetSchemaNode) return;
    expandedNodes.set(targetId, {
      ...targetSchemaNode,
      id: targetId,
      boundParams: { ...boundParams },
      expandedFrom,
    });
  }

  function addDataSourceEdges(edge, sourceNode, sourceRoutePath, targetRoutePath, ds, sourceBindingHint) {
    let refData = resolveRefData(ds.ref, sourceBindingHint ?? {}, data);

    if (!refData || (Array.isArray(refData) && refData.length === 0)) {
      return false;
    }

    if (ds.filterFn && Array.isArray(refData)) {
      refData = applyFilterFn(refData, ds.filterFn, data);
      if (refData.length === 0) {
        return false;
      }
    }

    const paramMapping = ds.paramMapping ?? {};
    const usesKeyExpansion = Object.values(paramMapping).some(v => v === '$key');

    const itemsRaw = (() => {
      if (Array.isArray(refData)) return refData;
      // If refData is an object and the mapping asks for '$key', expand object entries deterministically.
      if (usesKeyExpansion && refData && typeof refData === 'object') {
        return Object.keys(refData)
          .sort()
          .map(k => ({ $key: k, $value: refData[k] }));
      }
      return [refData];
    })();
    const items =
      typeof dataLimit === 'number' && dataLimit > 0 ? itemsRaw.slice(0, dataLimit) : itemsRaw;
    let addedAny = false;

    for (const item of items) {
      const targetBoundParams = {};
      for (const [targetParam, sourceField] of Object.entries(paramMapping)) {
        if (sourceField === '$value') {
          // Special-case: object-key expansion creates { $key, $value } items.
          targetBoundParams[targetParam] = String(item && typeof item === 'object' && '$value' in item ? item.$value : item);
        } else if (sourceField === '$key') {
          targetBoundParams[targetParam] = String(item && typeof item === 'object' && '$key' in item ? item.$key : '');
        } else if (item && item[sourceField] !== undefined) {
          targetBoundParams[targetParam] = String(item[sourceField]);
        }
      }

      // Build concrete target from to-path params
      const concreteTarget = buildConcreteNodeId(edge.target, targetBoundParams, {});

      // Build binding: include inherited params from sourceBindingHint (if any),
      // and dataSource params for the target.
      const binding = {
        ...(sourceBindingHint
          ? Object.fromEntries(
              Object.entries(sourceBindingHint).map(([k, v]) => [k, { source: 'inherited', value: String(v) }]),
            )
          : {}),
        ...Object.fromEntries(
          Object.entries(targetBoundParams).map(([k, v]) => [k, { source: 'dataSource', value: v }]),
        ),
      };

      const uiCond = edge.uiCondition;
      const { keep } = shouldKeepEdgeByUiCondition(uiCond, sourceNode, binding);
      if (!keep) {
        continue;
      }

      pushEdgeOnce({
        ...edge,
        source: sourceNode.id,
        sourceNodeId: sourceNode.id,
        target: concreteTarget,
        targetNodeId: concreteTarget,
        binding,
        expandedFrom: 'dataSource',
        dataSourceRef: ds.ref,
      });

      addConcreteTargetNode(concreteTarget, edge.target, targetBoundParams, 'dataSource');
      addedAny = true;
    }

    return addedAny;
  }

  // Two-pass strategy:
  // - Pass 0: expand static dataSource refs (no {param}) + inherited edges
  // - Pass 1: expand parameterized dataSource refs using concrete source nodes' boundParams
  for (let pass = 0; pass < 2; pass++) {
    for (const edge of schemaEdges) {
      const transition = transitionMap.get(edge.id);
      const sourceNode = nodes.find(n => n.id === edge.source);

      if (!sourceNode) {
        if (pass === 0) pushEdgeOnce(edge);
        continue;
      }

      const sourceRoutePath = sourceNode.routePath;
      const targetRoutePath = extractRoutePath(edge.target);
      const sourceHasParams = pathHasParams(sourceRoutePath);
      const targetHasParams = pathHasParams(targetRoutePath);

      // Case 1: No params in source or target - keep as is (only once)
      if (!sourceHasParams && !targetHasParams) {
        if (pass === 0) pushEdgeOnce(edge);
        continue;
      }

      // Case 2: Target has params, need dataSource to expand
      if (targetHasParams && transition?.dataSource) {
        const ds = findMatchingDataSource(
          transition.dataSource,
          sourceRoutePath,
          sourceNode.search ?? {},
        );

        if (ds) {
          const needsParams = refNeedsParams(ds.ref);

          // Pass 0: static refs only
          if (pass === 0 && !needsParams) {
            // Special-case: allow source also to be concrete if it shares params with target mapping
            // (existing behavior preserved)
            let refData = resolveRefData(ds.ref, {}, data);
            if (!refData || (Array.isArray(refData) && refData.length === 0)) {
              continue;
            }
            if (ds.filterFn && Array.isArray(refData)) {
              refData = applyFilterFn(refData, ds.filterFn, data);
              if (refData.length === 0) continue;
            }

            const paramMapping = ds.paramMapping ?? {};
            const usesKeyExpansion = Object.values(paramMapping).some(v => v === '$key');

            const itemsRaw = (() => {
              if (Array.isArray(refData)) return refData;
              if (usesKeyExpansion && refData && typeof refData === 'object') {
                return Object.keys(refData)
                  .sort()
                  .map(k => ({ $key: k, $value: refData[k] }));
              }
              return [refData];
            })();
            const items =
              typeof dataLimit === 'number' && dataLimit > 0
                ? itemsRaw.slice(0, dataLimit)
                : itemsRaw;

            for (const item of items) {
              const boundParams = {};
              for (const [targetParam, sourceField] of Object.entries(paramMapping)) {
                if (sourceField === '$value') {
                  boundParams[targetParam] = String(item && typeof item === 'object' && '$value' in item ? item.$value : item);
                } else if (sourceField === '$key') {
                  boundParams[targetParam] = String(item && typeof item === 'object' && '$key' in item ? item.$key : '');
                } else if (item[sourceField] !== undefined) {
                  boundParams[targetParam] = String(item[sourceField]);
                }
              }

              const concreteTarget = buildConcreteNodeId(edge.target, boundParams, {});

              let concreteSourceId = edge.source;
              if (sourceHasParams) {
                const sourceParams = extractPathParams(sourceRoutePath);
                const canExpandSource = sourceParams.every(p => boundParams[p] !== undefined);
                if (canExpandSource) {
                  concreteSourceId = buildConcreteNodeId(edge.source, boundParams, {});
                  if (!expandedNodes.has(concreteSourceId)) {
                    expandedNodes.set(concreteSourceId, {
                      ...sourceNode,
                      id: concreteSourceId,
                      boundParams: { ...boundParams },
                      expandedFrom: 'dataSource',
                    });
                  }
                }
              }

              const binding = Object.fromEntries(
                Object.entries(boundParams).map(([k, v]) => [k, { source: 'dataSource', value: v }]),
              );

              const uiCond = edge.uiCondition;
              const sourceForCond = expandedNodes.get(concreteSourceId) ?? sourceNode;
              const { keep } = shouldKeepEdgeByUiCondition(uiCond, sourceForCond, binding);
              if (!keep) {
                continue;
              }

              pushEdgeOnce({
                ...edge,
                source: concreteSourceId,
                sourceNodeId: concreteSourceId,
                target: concreteTarget,
                targetNodeId: concreteTarget,
                binding,
                expandedFrom: 'dataSource',
                dataSourceRef: ds.ref,
              });

              addConcreteTargetNode(concreteTarget, edge.target, boundParams, 'dataSource');
            }
            continue;
          }

          // Pass 1: parameterized refs (use concrete sources' boundParams)
          if (pass === 1 && needsParams) {
            const wantedSearchKey = searchKeyOf(sourceNode.search);
            const concreteSources = Array.from(expandedNodes.values()).filter(n =>
              n.routePath === sourceRoutePath &&
              n.boundParams &&
              searchKeyOf(n.search) === wantedSearchKey,
            );

            if (concreteSources.length === 0) {
              continue;
            }

            let expandedAny = false;
            for (const concreteSource of concreteSources) {
              const ok = addDataSourceEdges(
                edge,
                concreteSource,
                sourceRoutePath,
                targetRoutePath,
                ds,
                concreteSource.boundParams,
              );
              if (ok) expandedAny = true;
            }

            if (expandedAny) {
              continue;
            }
          }
        }
      }

      // Case 3: Source has params that target inherits (e.g., /book/:bookId -> /read/:bookId)
      if (sourceHasParams && targetHasParams) {
        const sourceParams = extractPathParams(sourceRoutePath);
        const targetParams = extractPathParams(targetRoutePath);
        const allInherited = targetParams.every(p => sourceParams.includes(p));

        if (allInherited) {
          const wantedSearchKey = searchKeyOf(sourceNode.search);
          const concreteSourceNodes = Array.from(expandedNodes.values()).filter(n =>
            n.routePath === sourceRoutePath && n.boundParams && searchKeyOf(n.search) === wantedSearchKey,
          );

          if (concreteSourceNodes.length > 0) {
            for (const concreteSource of concreteSourceNodes) {
              const boundParams = concreteSource.boundParams;
              const concreteTarget = buildConcreteNodeId(edge.target, boundParams, {});

              const binding = Object.fromEntries(
                Object.entries(boundParams).map(([k, v]) => [k, { source: 'inherited', value: v }]),
              );

              const uiCond = edge.uiCondition;
              const { keep } = shouldKeepEdgeByUiCondition(uiCond, concreteSource, binding);
              if (!keep) {
                continue;
              }

              pushEdgeOnce({
                ...edge,
                source: concreteSource.id,
                sourceNodeId: concreteSource.id,
                target: concreteTarget,
                targetNodeId: concreteTarget,
                binding,
                expandedFrom: 'inherited',
              });

              addConcreteTargetNode(concreteTarget, edge.target, boundParams, 'inherited');
            }
            continue;
          }
        }
      }

      // Case 3b: Source has params, target has NO params.
      // Expand edge to each concrete source node (so we don't keep a dangling "/:id" schema source).
      if (sourceHasParams && !targetHasParams) {
        const wantedSearchKey = searchKeyOf(sourceNode.search);
        const concreteSourceNodes = Array.from(expandedNodes.values()).filter(n =>
          n.routePath === sourceRoutePath && n.boundParams && searchKeyOf(n.search) === wantedSearchKey,
        );

        if (concreteSourceNodes.length > 0) {
          for (const concreteSource of concreteSourceNodes) {
            const boundParams = concreteSource.boundParams ?? {};
            const binding = Object.fromEntries(
              Object.entries(boundParams).map(([k, v]) => [k, { source: 'inherited', value: String(v) }]),
            );

            const uiCond = edge.uiCondition;
            const { keep } = shouldKeepEdgeByUiCondition(uiCond, concreteSource, binding);
            if (!keep) continue;

            pushEdgeOnce({
              ...edge,
              source: concreteSource.id,
              sourceNodeId: concreteSource.id,
              binding,
              expandedFrom: 'inherited',
            });
          }
          continue;
        }
      }

      // Case 4: Cannot expand
      if (pass === 0) {
        // Data mode: if an edge involves parameterized source/target but cannot be expanded to
        // concrete nodes, skip it (to avoid dangling "/:id" schema islands in data graphs).
        continue;
      }
    }
  }

  // Remove orphan schema nodes (parameterized nodes without concrete instances)
  const referencedNodeIds = new Set();
  for (const edge of expandedEdges) {
    referencedNodeIds.add(edge.source);
    referencedNodeIds.add(edge.target);
  }

  // Keep nodes that are: entry points, referenced by edges, or non-parameterized
  const finalNodes = Array.from(expandedNodes.values()).filter(node => {
    if (node.entryPoint) return true;
    if (referencedNodeIds.has(node.id)) return true;
    if (!pathHasParams(node.routePath)) return true;
    return false;
  });

  return {
    nodes: finalNodes,
    edges: expandedEdges,
  };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const appPath = resolveAppDir(args.app, { roots: [args.appsRoot, 'system'] });
    const navFile = path.join(appPath, 'navigation.declaration.ts');

    if (!fs.existsSync(navFile)) {
      throw new Error(`navigation.declaration.ts not found under ${appPath}`);
    }

    const declaration = loadNavigationDeclaration(navFile);
    
    // Build route index for data expansion
    const routeIndex = new Map();
    for (const route of declaration.routes) {
      routeIndex.set(route.path, route);
    }

    // Build schema graph first
    let graph = buildGraph(declaration);
    // Schema mode: warn about unreachable nodes/edges AND invalid edges (do not prune/output everything)
    if (!args.dataFile) {
      const reachableGraph = pruneGraphByReachability(graph);
      const reachableNodeIdSet = new Set(reachableGraph.nodes.map(n => n.id));
      const unreachableNodeIds = graph.nodes
        .filter(n => !reachableNodeIdSet.has(n.id))
        .map(n => n.id)
        .sort();
      // classify edges that would be dropped by reachability pruning
      const allNodeIds = new Set(graph.nodes.map(n => n.id));
      const droppedEdges = [];
      for (const e of graph.edges) {
        if (!reachableNodeIdSet.has(e.target)) {
          droppedEdges.push({
            reason: allNodeIds.has(e.target) ? 'target_unreachable' : 'target_missing',
            id: e.id,
            source: e.source,
            target: e.target,
          });
          continue;
        }
        if (e.source === '*') continue;
        if (!allNodeIds.has(e.source)) {
          droppedEdges.push({ reason: 'source_missing', id: e.id, source: e.source, target: e.target });
          continue;
        }
        if (!reachableNodeIdSet.has(e.source)) {
          droppedEdges.push({ reason: 'source_unreachable', id: e.id, source: e.source, target: e.target });
          continue;
        }
      }
      const unreachableEdgeCount = droppedEdges.length;
      if (unreachableNodeIds.length > 0 || unreachableEdgeCount > 0) {
        const examples = unreachableNodeIds.slice(0, 10);
        const edgeExamples = droppedEdges.slice(0, 10).map(e => `${e.reason}:${e.id}(${e.source}→${e.target})`);
        console.warn(
          `[NavDeclAnalyzer] WARN(schema): unreachable subgraph detected ` +
            `(unreachable ${unreachableNodeIds.length} nodes, ${unreachableEdgeCount} edges).` +
            (examples.length ? ` Nodes: ${examples.join(', ')}` : '') +
            (edgeExamples.length ? ` Edges: ${edgeExamples.join(', ')}` : ''),
        );
      }
    }
    
    // Data mode: expand with dataSource
    let dataConfig = null;
    let reachability = null;
    if (args.dataFile) {
      const dataFilePath = path.isAbsolute(args.dataFile)
        ? args.dataFile
        : path.join(appPath, args.dataFile);

      if (!fs.existsSync(dataFilePath)) {
        throw new Error(`Data file not found: ${dataFilePath}`);
      }

      console.log(`[NavDeclAnalyzer] Loading data from ${dataFilePath}`);
      dataConfig = loadDataConfig(dataFilePath, args.dataExport);

      // Attach dataSource info to edges before expansion
      for (const edge of graph.edges) {
        const transition = declaration.transitions.find(t => t.id === edge.id);
        if (transition?.dataSource) {
          edge.dataSource = transition.dataSource;
        }
      }

      // Expand with data
      const expanded = expandEdgesWithData(
        graph.edges,
        graph.nodes,
        dataConfig,
        routeIndex,
        declaration,
        args.dataLimit,
      );
      graph = pruneGraphByConditions(
        { nodes: expanded.nodes, edges: expanded.edges },
        dataConfig,
      );

      const conditionedGraph = graph;
      const conditionedCounts = { nodes: conditionedGraph.nodes.length, edges: conditionedGraph.edges.length };

      const reachableGraph = pruneGraphByReachability(conditionedGraph);
      const reachableNodeIdSet = new Set(reachableGraph.nodes.map(n => n.id));
      const unreachableNodeIds = conditionedGraph.nodes
        .filter(n => !reachableNodeIdSet.has(n.id))
        .map(n => n.id)
        .sort();
      const unreachableEdgeCount = conditionedGraph.edges.length - reachableGraph.edges.length;

      reachability = {
        entryNodes: conditionedGraph.nodes.filter(n => n.entryPoint).map(n => n.id),
        reachableNodeCount: reachableGraph.nodes.length,
        reachableEdgeCount: reachableGraph.edges.length,
        unreachableNodeCount: unreachableNodeIds.length,
        unreachableEdgeCount,
        unreachableNodeIds,
      };

      if (reachability.unreachableNodeCount > 0 || reachability.unreachableEdgeCount > 0) {
        const examples = unreachableNodeIds.slice(0, 10);
        console.warn(
          `[NavDeclAnalyzer] WARN: unreachable subgraph detected ` +
            `(unreachable ${reachability.unreachableNodeCount} nodes, ${reachability.unreachableEdgeCount} edges).` +
            (examples.length ? ` Examples: ${examples.join(', ')}` : ''),
        );
      }

      if (args.pruneUnreachable) {
        graph = reachableGraph;
        console.log(
          `[NavDeclAnalyzer] Expanded to ${graph.nodes.length} nodes, ${graph.edges.length} edges ` +
            `(conditioned ${conditionedCounts.nodes} nodes, ${conditionedCounts.edges} edges; pruned unreachable)`,
        );
      } else {
        graph = conditionedGraph;
        console.log(
          `[NavDeclAnalyzer] Expanded to ${graph.nodes.length} nodes, ${graph.edges.length} edges ` +
            `(reachable ${reachability.reachableNodeCount} nodes, ${reachability.reachableEdgeCount} edges)`,
        );
      }
    }

    const output = {
      schemaVersion: NAV_GRAPH_SCHEMA_VERSION,
      app: declaration.app,
      appDir: path.relative(process.cwd(), appPath),
      mode: args.dataFile ? 'data' : 'schema',
      dataFile: args.dataFile ?? null,
      reachability,
      routeCount: graph.nodes.length,
      transitionCount: declaration.transitions.length,
      nodes: graph.nodes,
      edges: graph.edges,
    };

    const serialized =
      args.format === 'pretty'
        ? JSON.stringify(output, null, 2)
        : JSON.stringify(output);

    if (args.output) {
      const resolvedOutput = path.resolve(args.output);
      fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
      fs.writeFileSync(resolvedOutput, serialized, 'utf-8');
      console.log(`[NavDeclAnalyzer] Wrote ${resolvedOutput}`);
      
      // Only write simplified graph for schema mode (not data mode)
      if (!args.dataFile) {
        const simplifiedGraph = buildSimplifiedGraph(graph);
        const simplifiedOutput = {
          schemaVersion: NAV_GRAPH_SCHEMA_VERSION,
          variant: 'simplified',
          app: declaration.app,
          appDir: path.relative(process.cwd(), appPath),
          mode: 'schema',
          routeCount: simplifiedGraph.nodes.length,
          edgeCount: simplifiedGraph.edges.length,
          nodes: simplifiedGraph.nodes,
          edges: simplifiedGraph.edges,
        };
        const simplifiedPath = resolvedOutput.replace('.json', '_simplified.json');
        const simplifiedSerialized = args.format === 'pretty'
          ? JSON.stringify(simplifiedOutput, null, 2)
          : JSON.stringify(simplifiedOutput);
        fs.writeFileSync(simplifiedPath, simplifiedSerialized, 'utf-8');
        console.log(`[NavDeclAnalyzer] Wrote ${simplifiedPath}`);
      }

      // Optional: generate action tasks from the graph output
      if (args.emitActionTasks) {
        const tasksOut = args.actionTasksOut
          ? path.resolve(args.actionTasksOut)
          : path.resolve(guessActionTasksOutPath(resolvedOutput));
        const scriptPath = path.resolve('scripts', 'generate_action_tasks_from_nav_graph.mjs');
        console.log(`[NavDeclAnalyzer] Generating action tasks -> ${tasksOut}`);
        const proc = spawnSync(
          process.execPath,
          [scriptPath, '--graph', resolvedOutput, '--out', tasksOut],
          { stdio: 'inherit' },
        );
        if (proc.status !== 0) {
          throw new Error(`Action tasks generation failed (exit=${proc.status}).`);
        }
      }
    } else {
      if (args.emitActionTasks) {
        throw new Error(`--emit-action-tasks requires --output/-o so the graph can be written to a file.`);
      }
      console.log(serialized);
    }
  } catch (error) {
    console.error(`[NavDeclAnalyzer] ${error.message}`);
    process.exit(1);
  }
}

main();
