#!/usr/bin/env node
/**
 * Generate action tasks from a nav_graph JSON that includes node.actions,
 * and extract ALL reachable trajectories from entry node(s) (home) to each action node.
 *
 * Input:  nav_graph JSON produced by scripts/navigation_declaration_analyzer.mjs
 *         (with actions enabled), e.g.
 *         public/wechatreading_nav_graph_20260112_with_actions.json
 *
 * Output: JSONL file where each line is a task:
 * {
 *   "app": "wechat_reading",
 *   "taskId": "wechat_reading:settings.reader.autoLock.toggle",
 *   "start": { "nodeId": "/" },
 *   "target": { "nodeId": "/settings", "routePath": "/settings", "uiStateId": "settings.base" },
 *   "trajectories": [
 *     { "nodes": [...], "transitions": [...], "length": N },
 *     ...
 *   ],
 *   "trajectoryCount": N,
 *   "shortestLength": N,
 *   "action": { "id": "...", "label": "...", "behavior": "...", "scope": "...", "paramsSchema": {...} }
 * }
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

function usage() {
  console.log(`
Usage:
  node scripts/generate_action_tasks_from_nav_graph.mjs --graph <graph.json> --out <tasks.jsonl>

Options:
  --graph <file>       Nav graph JSON path (must contain nodes[].actions)
  --out <file>         Output JSONL file path
  --limit <n>          Limit number of tasks written (default: no limit)
  --start-node <id>    Override start nodeId (default: entryPoint nodes)
  --app <AppName>      Scan apps/<AppName> to infer action gesture/ui usage (optional)
  --include-unreachable  Also output tasks that are unreachable from start (trajectories=[])
  --max-depth <n>      Max path length to search (default: 20)
  --max-paths <n>      Max number of paths per target node (default: 10)
  --all-paths          Enumerate non-shortest paths too (default: shortest paths only)
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (name) => {
    const idx = args.indexOf(name);
    if (idx === -1) return null;
    return args[idx + 1] ?? null;
  };
  const has = (name) => args.includes(name);
  const graph = get('--graph');
  const out = get('--out');
  const limitRaw = get('--limit');
  const startNode = get('--start-node');
  const app = get('--app');
  const includeUnreachable = has('--include-unreachable');
  const allPaths = has('--all-paths');
  const limit = limitRaw ? Number(limitRaw) : null;
  const maxDepth = get('--max-depth') ? Number(get('--max-depth')) : 20;
  const maxPaths = get('--max-paths') ? Number(get('--max-paths')) : 10;
  return { graph, out, limit, startNode, app, includeUnreachable, allPaths, maxDepth, maxPaths };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isNodeId(id) {
  return typeof id === 'string' && id.startsWith('/');
}

function buildAdjacency(graph) {
  /** @type {Map<string, Array<any>>} */
  const out = new Map();
  const globalEdges = [];

  for (const e of graph.edges ?? []) {
    if (e.source === '*') {
      globalEdges.push(e);
      continue;
    }
    if (!isNodeId(e.source)) continue;
    const list = out.get(e.source) ?? [];
    list.push(e);
    out.set(e.source, list);
  }

  return { out, globalEdges };
}

/**
 * Find ALL paths from start nodes to ALL reachable nodes using BFS.
 * BFS guarantees paths are discovered in order of length (shortest first).
 * Returns a Map<targetNodeId, Array<{nodes, transitions, edges}>>
 */
function findAllPaths(graph, startNodeIds, maxDepth, maxPathsPerTarget, { allPaths = false } = {}) {
  const { out, globalEdges } = buildAdjacency(graph);

  /** @type {Map<string, Array<{nodes: string[], transitions: string[], edges: any[]}>>} */
  const pathsByNode = new Map();

  // For shortest-only mode: track best (shortest) length discovered for each node.
  /** @type {Map<string, number>} */
  const bestLenByNode = new Map();

  // Initialize: start nodes have a trivial path (just themselves)
  for (const s of startNodeIds) {
    if (!isNodeId(s)) continue;
    pathsByNode.set(s, [{ nodes: [s], transitions: [], edges: [] }]);
    bestLenByNode.set(s, 0);
  }

  // BFS queue: each entry is { currentNode, path: {nodes, transitions, edges}, visitedSet }
  const queue = [];

  // Initialize queue with start nodes
  for (const startNode of startNodeIds) {
    if (!isNodeId(startNode)) continue;
    queue.push({
      currentNode: startNode,
      path: { nodes: [startNode], transitions: [], edges: [] },
      visitedSet: new Set([startNode]),
    });
  }

  // BFS to find all paths (shortest paths first due to BFS nature)
  while (queue.length > 0) {
    const { currentNode, path, visitedSet } = queue.shift();

    // Check depth limit
    if (path.nodes.length >= maxDepth) continue;

    const nextEdges = [
      ...(out.get(currentNode) ?? []),
      ...globalEdges,
    ];

    for (const e of nextEdges) {
      const nextNode = e?.target;
      if (!isNodeId(nextNode)) continue;
      // Avoid cycles within this path
      if (visitedSet.has(nextNode)) continue;

      const newPath = {
        nodes: [...path.nodes, nextNode],
        transitions: [...path.transitions, e.id],
        edges: [...path.edges, e],
      };
      const newLen = newPath.transitions.length;

      // Shortest-only mode: keep only shortest paths for each target node (and all ties).
      if (!allPaths) {
        const best = bestLenByNode.get(nextNode);
        if (best === undefined || newLen < best) {
          bestLenByNode.set(nextNode, newLen);
          pathsByNode.set(nextNode, [newPath]);
        } else if (newLen === best) {
          const existing = pathsByNode.get(nextNode) ?? [];
          if (existing.length < maxPathsPerTarget) {
            existing.push(newPath);
            pathsByNode.set(nextNode, existing);
          } else {
            // cap reached for this node
          }
        } else {
          // longer than best, skip
          continue;
        }

        // Continue BFS from this path if within cap (even for equal-best, to discover other shortest routes).
        const existingPaths = pathsByNode.get(nextNode) ?? [];
        if (existingPaths.length <= maxPathsPerTarget) {
          const newVisitedSet = new Set(visitedSet);
          newVisitedSet.add(nextNode);
          queue.push({
            currentNode: nextNode,
            path: newPath,
            visitedSet: newVisitedSet,
          });
        }
        continue;
      }

      // all-paths mode: Store many paths (up to cap), including non-shortest
      const existingPaths = pathsByNode.get(nextNode) ?? [];
      if (existingPaths.length < maxPathsPerTarget) {
        existingPaths.push(newPath);
        pathsByNode.set(nextNode, existingPaths);

        const newVisitedSet = new Set(visitedSet);
        newVisitedSet.add(nextNode);
        queue.push({
          currentNode: nextNode,
          path: newPath,
          visitedSet: newVisitedSet,
        });
      }
    }
  }

  return pathsByNode;
}

/**
 * Get all trajectories for a target node.
 * Returns array of {nodes, transitions, edges, length} sorted by length.
 */
function getAllTrajectories(allPathsMap, targetNodeId) {
  const paths = allPathsMap.get(targetNodeId);
  if (!paths || paths.length === 0) return [];

  return paths
    .map(p => ({
      nodes: p.nodes,
      transitions: p.transitions,
      edges: p.edges,
      length: p.transitions.length,
    }))
    .sort((a, b) => a.length - b.length);
}

// ============================================================================
// Best-effort: infer action gesture usages from app source code
// ============================================================================

function listFilesRecursive(dir, { exts, ignoreDirs }) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      out.push(...listFilesRecursive(full, { exts, ignoreDirs }));
    } else {
      const ext = path.extname(entry.name);
      if (exts.has(ext)) out.push(full);
    }
  }
  return out;
}

function createSourceFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath);
  const kind = ext === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind);
}

function getStringLiteralValue(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return getStringLiteralValue(node.expression);
  if (ts.isAsExpression(node)) return getStringLiteralValue(node.expression);
  return null;
}

function getProp(objLit, name) {
  if (!objLit || !objLit.properties) return null;
  for (const prop of objLit.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = prop.name;
    if (ts.isIdentifier(key) && key.text === name) return prop.initializer;
    if (ts.isStringLiteral(key) && key.text === name) return prop.initializer;
  }
  return null;
}

function inferActionUiUsages(appDir, declaredActionIds) {
  if (!appDir) return new Map();
  const absDir = path.resolve(appDir);
  if (!fs.existsSync(absDir)) return new Map();

  const ignoreDirs = new Set(['node_modules', 'dist', 'build']);
  const exts = new Set(['.ts', '.tsx']);
  const files = listFilesRecursive(absDir, { exts, ignoreDirs });

  /** @type {Map<string, Array<{gestureType:string, kind:string, file:string, line:number, col:number}>>} */
  const out = new Map();

  const record = (actionId, entry) => {
    if (!declaredActionIds.has(actionId)) return;
    const list = out.get(actionId) ?? [];
    list.push(entry);
    out.set(actionId, list);
  };

  for (const filePath of files) {
    // Never treat the declaration itself as a "usage" source.
    if (filePath.endsWith(`${path.sep}navigation.declaration.ts`)) continue;

    const sf = createSourceFile(filePath);
    const rel = path.relative(process.cwd(), filePath);

    const locOf = (node) => {
      const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      return { file: rel, line: lc.line + 1, col: lc.character + 1 };
    };

    const extractActionSpecId = (objLit) => {
      if (!objLit || !ts.isObjectLiteralExpression(objLit)) return null;
      const kindVal = getStringLiteralValue(getProp(objLit, 'kind'));
      if (kindVal !== 'action') return null;
      return getStringLiteralValue(getProp(objLit, 'id'));
    };

    function visit(node) {
      // bindTap/bindLongPress/bindDoubleTap({kind:'action', id:'x'})
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        const callee =
          ts.isIdentifier(expr) ? expr.text :
          ts.isPropertyAccessExpression(expr) ? expr.name.text :
          null;
        if (callee === 'bindTap' || callee === 'bindLongPress' || callee === 'bindDoubleTap') {
          const first = node.arguments[0];
          if (first && ts.isObjectLiteralExpression(first)) {
            const id = extractActionSpecId(first);
            if (id) {
              const gestureType =
                callee === 'bindTap' ? 'tap' :
                callee === 'bindLongPress' ? 'longPress' :
                'doubleTap';
              record(id, { kind: callee, gestureType, ...locOf(first) });
            }
          }
        }
      }

      // Best-effort: indirect bindings via shared components (e.g., TopBar right button)
      // We detect any call that passes an object with `id: '<actionId>'`.
      if (ts.isCallExpression(node)) {
        const expr = node.expression;
        const calleeName =
          ts.isIdentifier(expr) ? expr.text :
          ts.isPropertyAccessExpression(expr) ? expr.name.text :
          'call';

        // Avoid double counting for bind* calls: they are already handled above with accurate gesture type.
        if (calleeName === 'bindTap' || calleeName === 'bindLongPress' || calleeName === 'bindDoubleTap') {
          ts.forEachChild(node, visit);
          return;
        }

        for (const arg of node.arguments ?? []) {
          if (!arg || !ts.isObjectLiteralExpression(arg)) continue;
          const idInit = getProp(arg, 'id');
          const id = getStringLiteralValue(idInit);
          if (id && declaredActionIds.has(id)) {
            // Gesture type is unknown at analysis time; default to tap for task generation.
            record(id, { kind: calleeName, gestureType: 'tap', ...locOf(idInit ?? arg) });
          }
        }
      }

      // JSX: data-action="x", plus data-action-type if present (input)
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const attrs = node.attributes?.properties ?? [];
        let dataAction = null;
        let dataActionType = null;
        for (const a of attrs) {
          if (!ts.isJsxAttribute(a)) continue;
          const name = a.name?.text;
          if (name === 'data-action') {
            const init = a.initializer;
            if (init && ts.isStringLiteral(init)) dataAction = init.text;
          }
          if (name === 'data-action-type') {
            const init = a.initializer;
            if (init && ts.isStringLiteral(init)) dataActionType = init.text;
          }
        }
        if (dataAction && declaredActionIds.has(dataAction)) {
          record(dataAction, { kind: 'data-action', gestureType: dataActionType ?? 'unknown', ...locOf(node) });
        }
      }

      ts.forEachChild(node, visit);
    }
    visit(sf);
  }

  // de-dup per actionId
  for (const [id, list] of out.entries()) {
    const seen = new Set();
    const uniq = [];
    for (const x of list) {
      const k = `${x.kind}:${x.gestureType}:${x.file}:${x.line}:${x.col}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(x);
    }
    out.set(id, uniq);
  }

  return out;
}

function pickNodeDetail(node) {
  if (!node) return null;
  return {
    nodeId: node.id,
    routePath: node.routePath,
    uiStateId: node.uiStateId,
    component: node.component,
    description: node.description,
    entryPoint: Boolean(node.entryPoint),
    search: node.search ?? {},
    queryParams: node.queryParams ?? {},
    params: node.params ?? {},
    scrollContainers: node.scrollContainers ?? [],
    stateCondition: node.stateCondition ?? null,
    actionsCount: Array.isArray(node.actions) ? node.actions.length : 0,
  };
}

function pickEdgeDetail(edge) {
  if (!edge) return null;
  return {
    transitionId: edge.id,
    label: edge.label ?? '',
    type: edge.type ?? null,
    mode: edge.mode ?? null,
    source: edge.source,
    target: edge.target,
    uiMeta: edge.uiMeta ?? null,
    uiCondition: edge.uiCondition ?? null,
    fromConstraint: edge.fromConstraint ?? null,
    search: edge.search ?? {},
    searchParams: edge.searchParams ?? {},
    params: edge.params ?? {},
    preserveParams: edge.preserveParams ?? [],
    binding: edge.binding ?? null,
    expandedFrom: edge.expandedFrom ?? null,
    dataSourceRef: edge.dataSourceRef ?? null,
  };
}

function buildDetailedSteps(traj, nodeMap) {
  const detailedSteps = [];
  for (let i = 0; i < traj.edges.length; i++) {
    const fromId = traj.nodes[i];
    const toId = traj.nodes[i + 1];
    const edge = traj.edges[i];
    detailedSteps.push({
      index: i,
      kind: 'transition',
      from: pickNodeDetail(nodeMap.get(fromId)),
      edge: pickEdgeDetail(edge),
      to: pickNodeDetail(nodeMap.get(toId)),
      ui: {
        trigger: {
          dataTrigger: edge?.id ?? null,
          dataTriggerType: edge?.uiMeta?.gesture ?? null,
          paramsSchema: edge?.params ?? {},
          searchParamsSchema: edge?.searchParams ?? {},
        },
        placement: edge?.uiMeta?.placement ?? null,
        icon: edge?.uiMeta?.icon ?? null,
        gesture: edge?.uiMeta?.gesture ?? null,
      },
    });
  }
  return detailedSteps;
}

function main() {
  const { graph: graphPath, out: outPath, limit, startNode, app, includeUnreachable, allPaths, maxDepth, maxPaths } = parseArgs(process.argv);
  if (!graphPath || !outPath) {
    usage();
    process.exit(2);
  }

  const absGraph = path.resolve(graphPath);
  const absOut = path.resolve(outPath);
  const graph = readJson(absGraph);

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const entryNodes = nodes.filter(n => n?.entryPoint === true).map(n => n.id).filter(isNodeId);
  const startNodeIds = startNode ? [startNode] : entryNodes;

  if (startNodeIds.length === 0) {
    throw new Error(`No start nodes found. Provide --start-node, or ensure nodes[].entryPoint=true exists in graph.`);
  }

  console.log(`[ActionTasks] Finding paths (mode=${allPaths ? 'all' : 'shortest'}, maxDepth=${maxDepth}, maxPaths=${maxPaths})...`);
  const allPathsMap = findAllPaths(graph, startNodeIds, maxDepth, maxPaths, { allPaths });

  // Optional: infer action UI usage from source
  const declaredActionIds = new Set();
  for (const n of nodes) {
    for (const a of (Array.isArray(n?.actions) ? n.actions : [])) {
      if (a?.id && typeof a.id === 'string') declaredActionIds.add(a.id);
    }
  }
  const inferredAppDir = app ? path.join('apps', app) : (graph.appDir ? graph.appDir : null);
  const actionUiUsages = inferActionUiUsages(inferredAppDir, declaredActionIds);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const tasks = [];
  let totalTrajectoriesByTargetNode = 0;
  let uniqueActionNodes = 0;

  for (const n of nodes) {
    const actions = Array.isArray(n?.actions) ? n.actions : [];
    if (actions.length === 0) continue;

    const nodeId = n.id;
    const trajectories = getAllTrajectories(allPathsMap, nodeId);
    if (trajectories.length === 0 && !includeUnreachable) continue;

    uniqueActionNodes += 1;
    totalTrajectoriesByTargetNode += trajectories.length;

    // Build detailed steps for each trajectory
    const trajectoriesDetailed = trajectories.map(traj => {
      const detailedSteps = buildDetailedSteps(traj, nodeMap);
      return {
        nodes: traj.nodes,
        transitions: traj.transitions,
        length: traj.length,
        steps: detailedSteps,
      };
    });

    for (const a of actions) {
      if (!a?.id || typeof a.id !== 'string') continue;
      const actionUsages = actionUiUsages.get(a.id) ?? [];
      const actionGestureTypes = Array.from(new Set(actionUsages.map(x => x.gestureType))).filter(Boolean);
      const preferredActionGestureType = (() => {
        const known = actionGestureTypes.filter(t => t && t !== 'unknown');
        if (known.includes('tap')) return 'tap';
        if (known.includes('longPress')) return 'longPress';
        if (known.includes('doubleTap')) return 'doubleTap';
        if (known.includes('back')) return 'back';
        return 'tap';
      })();

      const actionStep = {
        kind: 'action',
        at: pickNodeDetail(n),
        ui: {
          trigger: {
            dataAction: a.id,
            dataActionType: preferredActionGestureType,
            paramsSchema: a.paramsSchema ?? null,
          },
        },
        action: {
          id: a.id,
          label: a.label ?? null,
          description: a.description ?? null,
          behavior: a.behavior ?? null,
          scope: a.scope ?? null,
          paramsSchema: a.paramsSchema ?? null,
        },
        codeUsages: actionUsages.slice(0, 10),
      };

      // Append action step to each trajectory's steps
      const trajectoriesWithAction = trajectoriesDetailed.map(td => ({
        ...td,
        steps: [
          ...td.steps,
          { ...actionStep, index: td.steps.length },
        ],
      }));

      const shortestLength = trajectories.length > 0 ? trajectories[0].length : null;

      tasks.push({
        app: graph.app ?? null,
        graphFile: path.relative(process.cwd(), absGraph),
        taskId: `${graph.app ?? 'app'}:${a.id}`,
        start: { nodeId: startNodeIds[0] },
        target: { nodeId, routePath: n.routePath, uiStateId: n.uiStateId },
        trajectoryCount: trajectories.length,
        shortestLength,
        trajectories: trajectories.map(t => ({ nodes: t.nodes, transitions: t.transitions, length: t.length })),
        trajectoriesDetailed: trajectoriesWithAction,
        action: {
          id: a.id,
          label: a.label ?? null,
          description: a.description ?? null,
          behavior: a.behavior ?? null,
          scope: a.scope ?? null,
          paramsSchema: a.paramsSchema ?? null,
        },
      });
    }
  }

  // Stable order: reachable first (shorter first), then by taskId.
  tasks.sort((x, y) => {
    const ax = x.shortestLength ?? 1e9;
    const ay = y.shortestLength ?? 1e9;
    if (ax !== ay) return ax - ay;
    return String(x.taskId).localeCompare(String(y.taskId));
  });

  const finalTasks = typeof limit === 'number' && Number.isFinite(limit) ? tasks.slice(0, limit) : tasks;

  fs.mkdirSync(path.dirname(absOut), { recursive: true });
  
  // Use JSON format (pretty) for .json files, JSONL for .jsonl files
  if (absOut.endsWith('.json')) {
    fs.writeFileSync(absOut, JSON.stringify(finalTasks, null, 2), 'utf8');
  } else {
    // JSONL format: one JSON object per line
    const lines = finalTasks.map(t => JSON.stringify(t));
    fs.writeFileSync(absOut, lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
  }

  const reachable = finalTasks.filter(t => t.trajectoryCount > 0).length;
  const unreachable = finalTasks.length - reachable;
  const totalTrajectoriesByTask = finalTasks.reduce((sum, t) => sum + (t.trajectoryCount ?? 0), 0);
  console.log(`[ActionTasks] graph=${path.relative(process.cwd(), absGraph)}`);
  console.log(`[ActionTasks] startNodes=${startNodeIds.join(', ')}`);
  console.log(`[ActionTasks] tasks=${finalTasks.length} reachable=${reachable} unreachable=${unreachable}`);
  console.log(`[ActionTasks] uniqueActionNodes=${uniqueActionNodes}`);
  console.log(`[ActionTasks] totalTrajectoriesByTargetNode=${totalTrajectoriesByTargetNode} (sum of trajectories per target node with actions)`);
  console.log(`[ActionTasks] totalTrajectoriesByTask=${totalTrajectoriesByTask} (sum of trajectoryCount across tasks)`);
  console.log(`[ActionTasks] wrote ${path.relative(process.cwd(), absOut)}`);
}

main();

