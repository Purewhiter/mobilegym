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
import { pruneGraphByConditions, pruneGraphByReachability } from './lib/nav_graph_prune.mjs';
import { buildGraph, buildSimplifiedGraph } from './lib/nav_schema_graph.mjs';
import { expandEdgesWithData } from './lib/nav_data_expand.mjs';

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

// Graph construction/expansion internals live in scripts/lib/:
//   nav_ref_resolver.mjs   — dataSource ref path DSL (+ filterFn evaluator)
//   nav_condition_eval.mjs — 12-op tri-state condition evaluation
//   nav_graph_core.mjs     — node id / search / from-constraint primitives
//   nav_schema_graph.mjs   — declaration → schema graph (+ simplified view)
//   nav_data_expand.mjs    — data-mode two-pass edge/node expansion
//   nav_graph_prune.mjs    — condition + reachability pruning

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
