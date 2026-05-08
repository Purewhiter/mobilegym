#!/usr/bin/env node
/**
 * Build navigation artifacts for an app:
 * - Consistency check (transitions + actions)
 * - Schema nav graph (+ simplified graph)
 * - Optional: data graph
 * - Action tasks for schema/data graphs
 *
 * Why this exists:
 * - Keep navigation_declaration_analyzer.mjs focused on graph generation.
 * - Keep generate_action_tasks_from_nav_graph.mjs focused on tasks generation.
 * - Provide a single entrypoint command to keep artifacts in sync.
 */
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

function usage() {
  console.log(`
Usage:
  node scripts/build_nav_artifacts.mjs <AppName> [options]

Options:
  --data <file>         Data config file for data-mode graph expansion.
                        Supports absolute paths, or paths relative to apps/<AppName> (recommended: data/index.ts).
  --data-export <name>  Export name in data file (default: auto-detect *_CONFIG)
  --data-limit <n>      Data mode: max items per dataSource.ref expansion (default: 10). Use 0 to disable.
  --skip-check          Skip consistency check
  --skip-tasks          Skip action task generation
  --tasks-all-paths     Generate tasks with multiple trajectories per action (default: shortest path only)
  --tasks-max-depth <n> Max depth for tasks path search (default: generator default)
  --tasks-max-paths <n> Max number of (shortest) paths per action node (default: generator default)
  --format <fmt>        Graph output format: json|pretty (default: pretty)

Examples:
  node scripts/build_nav_artifacts.mjs Wechat
  node scripts/build_nav_artifacts.mjs Wechat --data data/index.ts
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const appName = args.find(a => !a.startsWith('--')) ?? null;
  const get = (name) => {
    const idx = args.indexOf(name);
    if (idx === -1) return null;
    return args[idx + 1] ?? null;
  };
  const has = (name) => args.includes(name);

  return {
    appName,
    dataFile: get('--data'),
    dataExport: get('--data-export'),
    dataLimit: get('--data-limit'),
    skipCheck: has('--skip-check'),
    skipTasks: has('--skip-tasks'),
    tasksAllPaths: has('--tasks-all-paths'),
    tasksMaxDepth: get('--tasks-max-depth'),
    tasksMaxPaths: get('--tasks-max-paths'),
    format: get('--format') ?? 'pretty',
  };
}

function runNode(scriptRelPath, scriptArgs) {
  const res = spawnSync(process.execPath, [scriptRelPath, ...scriptArgs], {
    stdio: 'inherit',
  });
  if (res.error) throw res.error;
  if (typeof res.status === 'number' && res.status !== 0) {
    process.exit(res.status);
  }
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.appName) {
    usage();
    process.exit(2);
  }

  const appLower = String(args.appName).toLowerCase();
  const schemaGraph = path.join('public', `${appLower}_nav_graph.json`);
  const dataGraph = path.join('public', `${appLower}_data_graph.json`);
  const schemaTasks = path.join('public', `${appLower}_action_tasks.json`);
  const dataTasks = path.join('public', `${appLower}_action_tasks_data.json`);

  if (!args.skipCheck) {
    runNode(path.join('scripts', 'check_navigation_declaration_consistency.mjs'), [args.appName, '--actions']);
  }

  runNode(path.join('scripts', 'navigation_declaration_analyzer.mjs'), [
    args.appName,
    '-o',
    schemaGraph,
    '--format',
    args.format,
  ]);

  if (args.dataFile) {
    const dataArgs = [
      args.appName,
      '--data',
      args.dataFile,
      '-o',
      dataGraph,
      '--format',
      args.format,
    ];
    if (args.dataExport) {
      dataArgs.push('--data-export', args.dataExport);
    }
    if (args.dataLimit) {
      dataArgs.push('--data-limit', args.dataLimit);
    }
    runNode(path.join('scripts', 'navigation_declaration_analyzer.mjs'), dataArgs);
  }

  if (!args.skipTasks) {
    const tasksArgsCommon = [
      '--app',
      args.appName,
      ...(args.tasksAllPaths ? ['--all-paths'] : []),
      ...(args.tasksMaxDepth ? ['--max-depth', args.tasksMaxDepth] : []),
      ...(args.tasksMaxPaths ? ['--max-paths', args.tasksMaxPaths] : []),
    ];

    runNode(path.join('scripts', 'generate_action_tasks_from_nav_graph.mjs'), [
      '--graph',
      schemaGraph,
      '--out',
      schemaTasks,
      ...tasksArgsCommon,
    ]);

    if (args.dataFile) {
      runNode(path.join('scripts', 'generate_action_tasks_from_nav_graph.mjs'), [
        '--graph',
        dataGraph,
        '--out',
        dataTasks,
        ...tasksArgsCommon,
      ]);
    }
  }
}

main();
