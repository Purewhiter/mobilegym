#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

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

function resolveAppPath(appArg, appsRoot) {
  const directPath = path.resolve(appArg);
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  const joined = path.resolve(appsRoot, appArg);
  if (fs.existsSync(joined)) {
    return joined;
  }
  throw new Error(`Could not find app directory for "${appArg}". Tried:\n - ${directPath}\n - ${joined}`);
}

function loadNavigationDeclaration(filePath) {
  const source = fs.readFileSync(filePath, 'utf-8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
    reportDiagnostics: true,
  });

  if (transpiled.diagnostics?.length) {
    const message = ts.formatDiagnosticsWithColorAndContext(transpiled.diagnostics, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: fileName => fileName,
      getNewLine: () => '\n',
    });
    throw new Error(`Failed to transpile ${filePath}:\n${message}`);
  }

  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    require: createRequire(pathToFileURL(filePath)),
    __dirname: path.dirname(filePath),
    __filename: filePath,
    console,
    process,
  };

  vm.runInNewContext(transpiled.outputText, context, { filename: filePath });

  if (!context.module.exports?.NAVIGATION_DECLARATION) {
    throw new Error(`NAVIGATION_DECLARATION not found in ${filePath}`);
  }

  return context.module.exports.NAVIGATION_DECLARATION;
}

function loadDataConfig(filePath, exportName) {
  // data/*.ts frequently imports other local .ts modules (e.g., ./videoData).
  // Node's native require does not load .ts, so we need a ts-aware loader for data-mode.
  // This loader:
  // - Supports relative imports of .ts/.tsx by transpiling on the fly
  // - Supports json assets via native require
  // - Stubs out non-js assets (png/jpg/css/...) to keep config evaluation deterministic
  const tsModuleCache = new Map(); // absPath -> module.exports
  const importMetaShim = {
    env: process.env,
    hot: undefined,
    glob: () => {
      throw new Error('import.meta.glob is not supported when loading data-mode config in Node.');
    },
  };

  const transpileTs = (absPath) => {
    const source = fs.readFileSync(absPath, 'utf-8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2020,
      },
      fileName: absPath,
      reportDiagnostics: true,
    });
    if (transpiled.diagnostics?.length) {
      const message = ts.formatDiagnosticsWithColorAndContext(transpiled.diagnostics, {
        getCurrentDirectory: () => process.cwd(),
        getCanonicalFileName: fileName => fileName,
        getNewLine: () => '\n',
      });
      throw new Error(`Failed to transpile ${absPath}:\n${message}`);
    }
    // TS keeps `import.meta` intact even when transpiling to CommonJS.
    // Replace it only inside this Node-side loader so Vite/browser runtime is unaffected.
    return transpiled.outputText.replace(/\bimport\.meta\b/g, '__IMPORT_META__');
  };

  const makeTsAwareRequire = (parentFilePath) => {
    const nativeRequire = createRequire(pathToFileURL(parentFilePath));
    const parentDir = path.dirname(parentFilePath);

    const resolveRelative = (req) => {
      const base = path.resolve(parentDir, req);
      const candidates = [];
      // If explicit extension
      if (path.extname(base)) {
        candidates.push(base);
      } else {
        candidates.push(`${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.json`);
        candidates.push(path.join(base, 'index.ts'), path.join(base, 'index.tsx'), path.join(base, 'index.js'));
      }
      for (const c of candidates) {
        if (fs.existsSync(c)) return c;
      }
      return null;
    };

    /** @type {(req:string)=>any} */
    const reqFn = (req) => {
      // Stub common non-js assets used by apps (images/styles) to avoid runtime loader errors.
      if (/\.(png|jpg|jpeg|gif|webp|svg|css)$/.test(req)) {
        return req;
      }

      // Relative/local imports: handle TS/TSX via transpile+vm
      if (req.startsWith('.') || req.startsWith('/')) {
        const resolved = resolveRelative(req);
        if (!resolved) {
          // Let native require throw a useful error with its resolver.
          return nativeRequire(req);
        }
        const ext = path.extname(resolved).toLowerCase();
        if (ext === '.ts' || ext === '.tsx') {
          if (tsModuleCache.has(resolved)) return tsModuleCache.get(resolved);

          const module = { exports: {} };
          // Pre-populate cache to break cycles.
          tsModuleCache.set(resolved, module.exports);
          const context = {
            module,
            exports: module.exports,
            require: makeTsAwareRequire(resolved),
            __dirname: path.dirname(resolved),
            __filename: resolved,
            __IMPORT_META__: importMetaShim,
            console,
            process,
          };
          const js = transpileTs(resolved);
          vm.runInNewContext(js, context, { filename: resolved });
          // Ensure cache points at final exports object (module.exports may be reassigned).
          tsModuleCache.set(resolved, context.module.exports);
          return context.module.exports;
        }
        // .js/.json etc: use native require on the resolved absolute path
        return nativeRequire(resolved);
      }

      // Bare specifiers: delegate to node resolver (node_modules / builtin)
      return nativeRequire(req);
    };

    return reqFn;
  };

  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    require: makeTsAwareRequire(filePath),
    __dirname: path.dirname(filePath),
    __filename: filePath,
    __IMPORT_META__: importMetaShim,
    console,
    process,
  };

  const js = transpileTs(filePath);
  vm.runInNewContext(js, context, { filename: filePath });

  // Auto-detect export if not specified
  if (exportName) {
    if (!context.module.exports[exportName]) {
      throw new Error(`Export "${exportName}" not found in ${filePath}`);
    }
    return context.module.exports[exportName];
  }

  // Try to find *_CONFIG export
  const exports = context.module.exports;
  const configKey = Object.keys(exports).find(key => key.endsWith('_CONFIG'));
  if (configKey) {
    return exports[configKey];
  }

  throw new Error(`No *_CONFIG export found in ${filePath}. Use --data-export to specify.`);
}

// ============================================================================
// REF PATH RESOLVER
// ============================================================================

/**
 * Parse ref string into tokens
 * e.g., 'users[id={userId}].recentBooks' → ['users', '[id={userId}]', 'recentBooks']
 */
function parseRefTokens(ref) {
  const tokens = [];
  let current = '';
  let inBracket = false;

  for (const char of ref) {
    if (char === '[') {
      if (current) {
        tokens.push(current);
        current = '';
      }
      inBracket = true;
      current = '[';
    } else if (char === ']') {
      current += ']';
      tokens.push(current);
      current = '';
      inBracket = false;
    } else if (char === '.' && !inBracket) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse static value string to appropriate type
 */
function parseStaticValue(valueStr) {
  if (valueStr === 'true') return true;
  if (valueStr === 'false') return false;
  if (/^\d+$/.test(valueStr)) return Number(valueStr);
  return valueStr;
}

/**
 * Resolve parameterized ref and get data
 * 
 * @param {string} ref - Data reference path with optional [field={param}] or [field=value] syntax
 * @param {Object} boundParams - Bound parameters from source node
 * @param {Object} data - Root config data object
 * @returns {any} Resolved data or null
 */
function resolveRefData(ref, boundParams, data) {
  const tokens = parseRefTokens(ref);
  let current = data;

  for (const token of tokens) {
    if (current === undefined || current === null) {
      return null;
    }

    // Pattern 1: Parameterized array lookup [field={paramName}] → single element
    const paramLookupMatch = token.match(/^\[(\w+)=\{(\w+)\}\]$/);
    if (paramLookupMatch) {
      const [, field, paramName] = paramLookupMatch;
      const paramValue = boundParams?.[paramName];

      if (paramValue === undefined) return null;
      if (!Array.isArray(current)) return null;

      current = current.find(item => String(item[field]) === String(paramValue));
      continue;
    }

    // Pattern 2: Static filter [field=value] or [field!=value] → array subset
    const staticFilterMatch = token.match(/^\[(\w+)(=|!=)(\w+)\]$/);
    if (staticFilterMatch) {
      const [, field, op, valueStr] = staticFilterMatch;
      if (!Array.isArray(current)) return null;

      const value = parseStaticValue(valueStr);

      current = current.filter(item =>
        op === '=' ? item[field] === value : item[field] !== value
      );
      continue;
    }

    // Pattern 3: Object index {paramName}
    const objectIndexMatch = token.match(/^\{(\w+)\}$/);
    if (objectIndexMatch) {
      const paramName = objectIndexMatch[1];
      const paramValue = boundParams?.[paramName];

      if (paramValue === undefined) return null;
      current = current[paramValue];
      continue;
    }

    // Pattern 4: Simple field access
    current = current[token];
  }

  return current;
}

/**
 * Check if ref contains parameter references that need bound params
 */
function refNeedsParams(ref) {
  return /\{(\w+)\}/.test(ref);
}

/**
 * Apply filterFn to data array
 * 
 * @param {Array} items - Array of items to filter
 * @param {string} filterFnStr - Filter function as string, e.g., "(item, data) => ..."
 * @param {Object} data - Root config data object
 * @returns {Array} Filtered items
 */
function applyFilterFn(items, filterFnStr, data) {
  if (!filterFnStr || !Array.isArray(items)) {
    return items;
  }

  try {
    // Create filter function from string
    // filterFnStr should be like "(item, data) => expression"
    const filterFn = new Function('item', 'data', `return (${filterFnStr})(item, data)`);
    return items.filter(item => {
      try {
        return filterFn(item, data);
      } catch (e) {
        console.warn(`[DataExpand] filterFn error for item:`, e.message);
        return true; // Keep item on error (conservative)
      }
    });
  } catch (e) {
    console.warn(`[DataExpand] Invalid filterFn "${filterFnStr}":`, e.message);
    return items;
  }
}

// ============================================================================
// CONDITION EVALUATION (v0.5)
// ============================================================================

function evaluateCondition(condition, context) {
  const boundParams = context?.boundParams ?? {};
  const data = context?.data;

  if (!condition || !data) {
    return { satisfied: true, evaluable: false, reason: 'missing condition or data' };
  }

  // Composite ops (v0.8)
  if (condition.op === 'always') {
    return { satisfied: true, evaluable: true };
  }

  if (condition.op === 'and') {
    if (!Array.isArray(condition.items) || condition.items.length === 0) {
      return { satisfied: true, evaluable: false, reason: 'and.items missing/empty' };
    }
    let hasUnevaluable = false;
    for (const item of condition.items) {
      const r = evaluateCondition(item, { boundParams, data });
      if (r.evaluable && !r.satisfied) return { satisfied: false, evaluable: true };
      if (!r.evaluable) hasUnevaluable = true;
    }
    if (hasUnevaluable) return { satisfied: true, evaluable: false, reason: 'and has unevaluable items' };
    return { satisfied: true, evaluable: true };
  }

  if (condition.op === 'or') {
    if (!Array.isArray(condition.items) || condition.items.length === 0) {
      return { satisfied: true, evaluable: false, reason: 'or.items missing/empty' };
    }
    let hasUnevaluable = false;
    let anyEvaluable = false;
    for (const item of condition.items) {
      const r = evaluateCondition(item, { boundParams, data });
      if (r.evaluable) anyEvaluable = true;
      if (r.evaluable && r.satisfied) return { satisfied: true, evaluable: true };
      if (!r.evaluable) hasUnevaluable = true;
    }
    if (anyEvaluable && !hasUnevaluable) {
      // all evaluable and none satisfied
      return { satisfied: false, evaluable: true };
    }
    return { satisfied: true, evaluable: false, reason: 'or has unevaluable items' };
  }

  if (condition.op === 'not') {
    if (!condition.item) {
      return { satisfied: true, evaluable: false, reason: 'not.item missing' };
    }
    const r = evaluateCondition(condition.item, { boundParams, data });
    if (!r.evaluable) return { satisfied: true, evaluable: false, reason: 'not has unevaluable item' };
    return { satisfied: !r.satisfied, evaluable: true };
  }

  // Existing ops (v0.5)
  if (condition.op === 'notEmpty') {
    let items = resolveRefData(condition.ref, boundParams, data);
    if (!Array.isArray(items)) {
      return { satisfied: false, evaluable: true, reason: 'ref is not array' };
    }
    if (condition.filterFn) {
      items = applyFilterFn(items, condition.filterFn, data);
    }
    return { satisfied: items.length > 0, evaluable: true };
  }

  if (condition.op === 'memberOf') {
    if (!condition.param) {
      return { satisfied: false, evaluable: false, reason: 'missing param' };
    }
    const paramValue = boundParams[condition.param];
    if (paramValue === undefined) {
      return { satisfied: false, evaluable: false, reason: `param ${condition.param} not bound` };
    }

    let collection = resolveRefData(condition.ref, boundParams, data);
    if (!Array.isArray(collection)) {
      return { satisfied: false, evaluable: false, reason: 'ref is not array' };
    }
    if (condition.filterFn) {
      collection = applyFilterFn(collection, condition.filterFn, data);
    }

    const field = condition.field ?? '$value';

    const inSet = collection.some(item =>
      field === '$value' ? String(item) === String(paramValue) : String(item?.[field]) === String(paramValue),
    );
    return { satisfied: inSet, evaluable: true };
  }

  if (condition.op === 'eq') {
    if (!('equals' in condition)) {
      return { satisfied: false, evaluable: false, reason: 'missing equals' };
    }
    const value = resolveRefData(condition.ref, boundParams, data);
    if (value === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    return { satisfied: value === condition.equals, evaluable: true };
  }

  // TencentMeeting legacy ops support (compat)
  if (condition.op === 'equals') {
    if (!('value' in condition)) {
      return { satisfied: false, evaluable: false, reason: 'missing value' };
    }
    const value = resolveRefData(condition.ref, boundParams, data);
    if (value === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    return { satisfied: value === condition.value, evaluable: true };
  }

  if (condition.op === 'notEquals') {
    if (!('value' in condition)) {
      return { satisfied: false, evaluable: false, reason: 'missing value' };
    }
    const value = resolveRefData(condition.ref, boundParams, data);
    if (value === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    return { satisfied: value !== condition.value, evaluable: true };
  }

  if (condition.op === 'empty') {
    const value = resolveRefData(condition.ref, boundParams, data);
    if (!Array.isArray(value)) {
      return { satisfied: false, evaluable: true, reason: 'ref is not array' };
    }
    return { satisfied: value.length === 0, evaluable: true };
  }

  // Param vs data ref comparison (v0.8)
  if (condition.op === 'paramEq' || condition.op === 'paramNeq') {
    if (!condition.param) {
      return { satisfied: false, evaluable: false, reason: 'missing param' };
    }
    const paramValue = boundParams[condition.param];
    if (paramValue === undefined) {
      return { satisfied: false, evaluable: false, reason: `param ${condition.param} not bound` };
    }

    const refValue = resolveRefData(condition.ref, boundParams, data);
    if (refValue === undefined) {
      return { satisfied: false, evaluable: false, reason: 'ref not found' };
    }
    if (refValue !== null && typeof refValue === 'object') {
      return { satisfied: true, evaluable: false, reason: 'ref is not primitive' };
    }

    const eq = String(paramValue) === String(refValue);
    return { satisfied: condition.op === 'paramEq' ? eq : !eq, evaluable: true };
  }

  return { satisfied: true, evaluable: false, reason: `unknown op: ${condition.op}` };
}

function pruneGraphByConditions(graph, data) {
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

// ============================================================================
// REACHABILITY PRUNING (data mode)
// ============================================================================

/**
 * Prune nodes/edges that are not reachable from entryPoint nodes.
 *
 * Why: In data mode we expand concrete nodes via dataSource / param inheritance,
 * then prune edges by conditions. This can leave "islands" of concrete nodes
 * (e.g. expanded first, then incoming edges removed by condition) that are
 * not reachable from any entry point. Those islands are confusing in UI graphs.
 */
function pruneGraphByReachability(graph) {
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

// ============================================================================
// DATA-DRIVEN GRAPH EXPANSION
// ============================================================================

/**
 * Match from constraint against source node
 */
function matchFromConstraint(fromConstraint, sourceRoutePath, sourceSearch) {
  if (fromConstraint === '*') return true;

  if (typeof fromConstraint === 'string') {
    return fromConstraint === sourceRoutePath;
  }

  if (typeof fromConstraint === 'object' && fromConstraint.path) {
    if (fromConstraint.path !== sourceRoutePath) return false;

    const constraintSearch = fromConstraint.search ?? {};
    for (const [key, value] of Object.entries(constraintSearch)) {
      if (value === '*') {
        // Wildcard matches any value, but key must exist
        if (!(key in sourceSearch)) return false;
      } else if (value === null) {
        // null means key must NOT exist
        if (key in sourceSearch) return false;
      } else {
        // Exact match
        if (sourceSearch[key] !== value) return false;
      }
    }
    return true;
  }

  return false;
}

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
 * Check if a path contains parameters (e.g., /book/:bookId)
 */
function pathHasParams(path) {
  return /:(\w+)/.test(path);
}

/**
 * Extract param names from path
 */
function extractPathParams(path) {
  const matches = path.matchAll(/:(\w+)/g);
  return Array.from(matches).map(m => m[1]);
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

/**
 * Build concrete node ID by replacing :params with values
 */
function buildConcreteNodeId(schemaId, boundParams, routeParams) {
  let result = schemaId;

  for (const [param, value] of Object.entries(boundParams)) {
    result = result.replace(`:${param}`, value);
  }

  return result;
}

function normalizeFrom(from) {
  if (Array.isArray(from)) {
    return from;
  }
  return [from];
}

function fromToString(from) {
  if (from === '*') return '*';
  if (typeof from === 'string') return from;
  let constraint = from.path;
  if (from.search && Object.keys(from.search).length > 0) {
    const parts = Object.entries(from.search)
      .map(([key, value]) => {
        if (value === '*') return `${key}=*`;
        if (value === null) return `!${key}`;
        return `${key}=${value}`;
      })
      .join('&');
    constraint += `?${parts}`;
  }
  return constraint;
}

function normalizeEntryPointDeclaration(entryPoint) {
  // No legacy compatibility: must be explicit enum string.
  if (typeof entryPoint !== 'string') {
    throw new Error(
      `[NavDeclAnalyzer] Invalid route.entryPoint: expected 'none'|'home'|'deepLink'|'both', got ${String(entryPoint)}`,
    );
  }

  switch (entryPoint) {
    case 'home':
      return { kind: 'home', home: true, deepLink: false };
    case 'deepLink':
      return { kind: 'deepLink', home: false, deepLink: true };
    case 'both':
      return { kind: 'both', home: true, deepLink: true };
    case 'none':
    default:
      return { kind: 'none', home: false, deepLink: false };
  }
}

function buildGraph(declaration) {
  const routeIndex = new Map();
  const stateIndex = new Map(); // path -> Map(searchKey -> nodeId)
  const nodes = [];

  for (const route of declaration.routes) {
    routeIndex.set(route.path, route);
    const entry = normalizeEntryPointDeclaration(route.entryPoint);
    const uiStates =
      route.uiStates && route.uiStates.length > 0
        ? route.uiStates
        : [{ id: 'base', search: {}, description: route.description ?? '' }];

    // Home entry semantics:
    // - Only routes marked as "home" (or "both") contribute a start node.
    // - Default home entry uiState is uiStates[0] (per request).
    let defaultHomeEntryNodeId = null;
    if (entry.home) {
      const candidate = uiStates[0];
      const normalizedSearch = normalizeSearch(candidate?.search ?? {});
      defaultHomeEntryNodeId = buildNodeId(route.path, normalizedSearch, route.queryParams ?? {});
    }

    for (const state of uiStates) {
      const normalizedSearch = normalizeSearch(state.search ?? {});
      const nodeId = buildNodeId(route.path, normalizedSearch, route.queryParams ?? {});
      const searchKey = serializeSearch(normalizedSearch);

      if (!stateIndex.has(route.path)) {
        stateIndex.set(route.path, new Map());
      }
      stateIndex.get(route.path).set(searchKey, nodeId);

      nodes.push({
        id: nodeId,
        routePath: route.path,
        uiStateId: state.id ?? 'base',
        component: route.component,
        // Node-level entryPoint means: this node is the HOME start node.
        entryPoint: Boolean(entry.home) && nodeId === defaultHomeEntryNodeId,
        // Route-level entry semantics for viewer/debugging.
        entry,
        params: route.params ?? {},
        scrollContainers: route.scrollContainers ?? [],
        description: state.description ?? route.description ?? '',
        search: normalizedSearch,
        queryParams: route.queryParams ?? {},
        // v1.0: node-level actions (declaration only; execution is out of scope)
        actions: state.actions ?? [],
        // v0.5: node-level existence condition
        stateCondition: state.stateCondition ?? undefined,
      });
    }
  }

  const edges = [];

  for (const transition of declaration.transitions) {
    const fromItems = normalizeFrom(transition.from);

    if (transition.cases && transition.cases.length > 0) {
      // Expand from constraints with wildcards (same as non-cases path),
      // so { path:'/', search:{ tab:'*' } } becomes concrete "/?tab=recommend" etc,
      // instead of producing a virtual "/?tab=*" node.
      const expandedFromItems = [];
      for (const from of fromItems) {
        const expanded = expandFromConstraint(from, stateIndex, routeIndex);
        expandedFromItems.push(...expanded);
      }

      for (const from of expandedFromItems) {
        const sourceId = resolveSourceNodeId(from, stateIndex, routeIndex);

        for (const caseItem of transition.cases) {
          const effectiveTo = caseItem.to;
          const effectiveSearch = caseItem.search ?? transition.search ?? {};
          const effectiveSearchParams = caseItem.searchParams ?? transition.searchParams ?? {};

          const searchState = normalizeSearch(effectiveSearch);
          const targetRoute = effectiveTo ? routeIndex.get(effectiveTo) : null;
          const routeQueryParams = new Set(Object.keys(targetRoute?.queryParams ?? {}));
          // Only treat searchParams keys as "dynamic discrete" when they are NOT already fixed
          // by static search in this branch. Otherwise we may over-expand to states that override
          // the fixed value (and even create duplicated (source,target,id) edges across cases).
          const discreteSearchParamKeys = Object.keys(effectiveSearchParams ?? {}).filter(k => {
            if (routeQueryParams.has(k)) return false;
            const fixed = (effectiveSearch ?? {})[k];
            return fixed === undefined || fixed === null;
          });
          const hasSearchParams = effectiveTo && discreteSearchParamKeys.length > 0;

          // Expand target based on searchParams (same logic as non-cases path)
          let targetStates = [];
          if (effectiveTo && hasSearchParams) {
            if (targetRoute && targetRoute.uiStates) {
              const staticKeys = Object.keys(effectiveSearch).filter(k => effectiveSearch[k] !== null);
              const expectedKeys = new Set([...staticKeys, ...discreteSearchParamKeys]);
              targetStates = targetRoute.uiStates.filter(state => {
                const stateSearch = state.search ?? {};
                const stateDiscreteKeys = new Set(
                  Object.keys(stateSearch).filter(k => !routeQueryParams.has(k)),
                );
                if (expectedKeys.size !== stateDiscreteKeys.size) return false;
                for (const key of expectedKeys) {
                  if (!stateDiscreteKeys.has(key)) return false;
                }
                return true;
              });
            }
          }

          if (targetStates.length > 0) {
            for (const targetState of targetStates) {
              const targetSearch = normalizeSearch({ ...searchState, ...targetState.search });
              const targetNodeId = resolveTargetNodeId(effectiveTo, targetSearch, stateIndex, routeIndex);
              const type = determineEdgeType(sourceId, targetNodeId);

              // Self-loops: only keep when it's a "new entity" navigation:
              // - mode=push (new history entry)
              // - target pathname has path params (e.g. /video/:bvid)
              if (sourceId === targetNodeId) {
                const mode = transition.mode ?? 'push';
                const targetHasPathParams = /:\w+/.test(effectiveTo);
                const hasSemanticChange = Object.keys(effectiveSearchParams ?? {}).length > 0 || Object.keys(effectiveSearch ?? {}).length > 0;
                if (!(mode === 'push' && targetHasPathParams) && !hasSemanticChange) {
                  continue;
                }
              }

              const baseLabel = transition.label ?? '';
              const stateDesc = targetState.description || '';
              const expandedLabel = stateDesc ? `${baseLabel} → ${stateDesc}` : baseLabel;

              edges.push({
                source: sourceId,
                sourceNodeId: isNodeId(sourceId) ? sourceId : undefined,
                target: targetNodeId,
                targetNodeId,
                id: transition.id,
                label: expandedLabel,
                type,
                mode: transition.mode ?? 'push',
                search: targetState.search ?? {},
                searchParams: {},
                params: transition.params ?? {},
                availability: caseItem.availability ?? transition.availability ?? undefined,
                availabilityNote: caseItem.availabilityNote ?? transition.availabilityNote ?? undefined,
                when: caseItem.when ?? null,
                preserveParams: transition.preserveParams ?? [],
                fromConstraint: typeof from === 'object' ? from : undefined,
                uiCondition: transition.ui?.condition ?? undefined,
                uiMeta: transition.ui
                  ? {
                      placement: transition.ui.placement,
                      icon: transition.ui.icon,
                      gesture: transition.ui.gesture,
                    }
                  : undefined,
              });
            }
          } else {
            const sourceNodeObj = nodes.find(n => n.id === sourceId);
            const preserved = applyPreserveParamsToSearch(searchState, transition.preserveParams ?? [], sourceNodeObj?.search ?? {});
            const targetNodeId = resolveTargetNodeId(effectiveTo, normalizeSearch(preserved), stateIndex, routeIndex);
            const type = determineEdgeType(sourceId, targetNodeId);

            // Self-loops: only keep when it's a "new entity" navigation:
            // - mode=push (new history entry)
            // - target pathname has path params (e.g. /video/:bvid)
            if (sourceId === targetNodeId) {
              const mode = transition.mode ?? 'push';
              const targetHasPathParams = /:\w+/.test(effectiveTo);
              const hasSemanticChange = Object.keys(effectiveSearchParams ?? {}).length > 0 || Object.keys(effectiveSearch ?? {}).length > 0;
              if (!(mode === 'push' && targetHasPathParams) && !hasSemanticChange) {
                continue;
              }
            }

            edges.push({
              source: sourceId,
              sourceNodeId: isNodeId(sourceId) ? sourceId : undefined,
              target: targetNodeId,
              targetNodeId,
              id: transition.id,
              label: transition.label ?? '',
              type,
              mode: transition.mode ?? 'push',
              search: effectiveSearch,
              searchParams: effectiveSearchParams,
              params: transition.params ?? {},
              availability: caseItem.availability ?? transition.availability ?? undefined,
              availabilityNote: caseItem.availabilityNote ?? transition.availabilityNote ?? undefined,
              when: caseItem.when ?? null,
              preserveParams: transition.preserveParams ?? [],
              fromConstraint: typeof from === 'object' ? from : undefined,
              uiCondition: transition.ui?.condition ?? undefined,
              uiMeta: transition.ui
                ? {
                    placement: transition.ui.placement,
                    icon: transition.ui.icon,
                    gesture: transition.ui.gesture,
                  }
                : undefined,
            });
          }
        }
      }
      continue;
    }

    const searchState = normalizeSearch(transition.search ?? {});
    const target = transition.to;
    const searchParams = transition.searchParams ?? {};
    const targetRouteForParams = target ? routeIndex.get(target) : null;
    const routeQueryParamsForParams = new Set(Object.keys(targetRouteForParams?.queryParams ?? {}));
    const discreteSearchParamKeys = Object.keys(searchParams).filter(k => {
      if (routeQueryParamsForParams.has(k)) return false;
      const fixed = (transition.search ?? {})[k];
      return fixed === undefined || fixed === null;
    });
    const hasSearchParams = target && discreteSearchParamKeys.length > 0;

    // Expand from constraints with wildcards
    const expandedFromItems = [];
    for (const from of fromItems) {
      const expanded = expandFromConstraint(from, stateIndex, routeIndex);
      expandedFromItems.push(...expanded);
    }

    // Expand target based on searchParams for all transitions
    // searchParams means runtime-determined target, expand to show all possibilities
    // 
    // Key insight: We should match uiStates whose discrete param structure matches
    // the expected structure: (search keys where value != null) + (searchParams keys)
    let targetStates = [];
    if (target && hasSearchParams) {
      const targetRoute = targetRouteForParams;
      if (targetRoute && targetRoute.uiStates) {
        // Build expected discrete param structure:
        // 1. Keys from transition.search where value !== null (null means "delete")
        // 2. Keys from searchParams that are NOT queryParams (discrete dynamic)
        const transitionSearch = transition.search ?? {};
        const staticKeys = Object.keys(transitionSearch).filter(k => transitionSearch[k] !== null);
        const expectedKeys = new Set([...staticKeys, ...discreteSearchParamKeys]);
        
        // Also respect queryParams - they are dynamic and shouldn't affect discrete matching
        const routeQueryParams = new Set(Object.keys(targetRoute.queryParams ?? {}));
        
        targetStates = targetRoute.uiStates.filter(state => {
          const stateSearch = state.search ?? {};
          // Get discrete keys (exclude queryParams which are dynamic)
          const stateDiscreteKeys = new Set(
            Object.keys(stateSearch).filter(k => !routeQueryParams.has(k))
          );
          
          // Check if discrete param structure matches exactly
          if (expectedKeys.size !== stateDiscreteKeys.size) return false;
          for (const key of expectedKeys) {
            if (!stateDiscreteKeys.has(key)) return false;
          }
          return true;
        });
      }
    }

    for (const from of expandedFromItems) {
      const sourceId = resolveSourceNodeId(from, stateIndex, routeIndex);
      const sourceNodeObj = nodes.find(n => n.id === sourceId);
      const sourceSearchForPreserve = sourceNodeObj?.search ?? (typeof from === 'object' ? normalizeSearch(from.search ?? {}) : {});
      const effectiveSearchState = normalizeSearch(
        applyPreserveParamsToSearch(searchState, transition.preserveParams ?? [], sourceSearchForPreserve),
      );
      
      if (targetStates.length > 0) {
        // Expand to multiple edges for each target state
        for (const targetState of targetStates) {
          const targetSearch = normalizeSearch({ ...effectiveSearchState, ...targetState.search });
          const targetNodeId = resolveTargetNodeId(target, targetSearch, stateIndex, routeIndex);
          const type = determineEdgeType(sourceId, targetNodeId);
          
          // Self-loops (source node === target node):
          //
          // A route-state edge should represent a meaningful change in the discrete URL state.
          // However, schema graphs use pathname templates (e.g. /video/:bvid), so a "new entity"
          // navigation like /video/BV1 -> /video/BV2 becomes a self-loop in schema mode.
          //
          // Rule:
          // - If the discrete search state does NOT change (noop), drop the edge.
          // - EXCEPT: keep when mode=push AND target pathname has path params (treat as "new entity").
          if (sourceId === targetNodeId) {
            const mode = transition.mode ?? 'push';
            const targetHasPathParams = /:\w+/.test(target);

            const sourceSearch = normalizeSearch(sourceNodeObj?.search ?? {});
            const isNoopSearch =
              serializeSearch(sourceSearch) === serializeSearch(normalizeSearch(targetSearch));

            if (isNoopSearch && !(mode === 'push' && targetHasPathParams)) {
              continue;
            }
          }
          
          // Build label with target state description
          const baseLabel = transition.label ?? '';
          const stateDesc = targetState.description || '';
          const expandedLabel = stateDesc 
            ? `${baseLabel} → ${stateDesc}`
            : baseLabel;
          
          edges.push({
            source: sourceId,
            sourceNodeId: isNodeId(sourceId) ? sourceId : undefined,
            target: targetNodeId,
            targetNodeId,
            id: transition.id,
            label: expandedLabel,
            type,
            mode: transition.mode ?? 'push',
            search: targetState.search ?? {},
            searchParams: {},
            params: transition.params ?? {},
            availability: transition.availability ?? undefined,
            availabilityNote: transition.availabilityNote ?? undefined,
            preserveParams: transition.preserveParams ?? [],
            fromConstraint: typeof from === 'object' ? from : undefined,
            expandedFrom: 'searchParams',
            uiCondition: transition.ui?.condition ?? undefined,
            uiMeta: transition.ui
              ? {
                  placement: transition.ui.placement,
                  icon: transition.ui.icon,
                  gesture: transition.ui.gesture,
                }
              : undefined,
          });
        }
      } else {
        const targetNodeId = target
          ? resolveTargetNodeId(target, effectiveSearchState, stateIndex, routeIndex)
          : undefined;
        const type = determineEdgeType(sourceId, targetNodeId || sourceId);
        
        // Self-loops (source node === target node):
        //
        // Same semantics as the branch above (targetStates expansion):
        // - Drop noop self-loops (sourceId === targetNodeId).
        // - EXCEPT: keep when mode=push AND target pathname has path params (treat as "new entity").
        if (sourceId === targetNodeId) {
          const mode = transition.mode ?? 'push';
          const targetHasPathParams = /:\w+/.test(target);
          if (!(mode === 'push' && targetHasPathParams)) {
            continue;
          }
        }
        
        edges.push({
          source: sourceId,
          sourceNodeId: isNodeId(sourceId) ? sourceId : undefined,
          target: targetNodeId || sourceId,
          targetNodeId,
          id: transition.id,
          label: transition.label ?? '',
          type,
          mode: transition.mode ?? 'push',
          search: transition.search ?? {},
          searchParams: transition.searchParams ?? {},
          params: transition.params ?? {},
          availability: transition.availability ?? undefined,
          availabilityNote: transition.availabilityNote ?? undefined,
          preserveParams: transition.preserveParams ?? [],
          fromConstraint: typeof from === 'object' ? from : undefined,
          uiCondition: transition.ui?.condition ?? undefined,
          uiMeta: transition.ui
            ? {
                placement: transition.ui.placement,
                icon: transition.ui.icon,
                gesture: transition.ui.gesture,
              }
            : undefined,
        });
      }
    }
  }

  // Warn on duplicate edges (same source + target + transitionId).
  // In a correct declaration+analyzer, these should not exist; duplicates inflate edgeCount
  // and can indicate overlapping from-constraints or buggy wildcard/searchParams expansion.
  const tripletCounts = new Map();
  for (const e of edges) {
    const k = `${e.source}→${e.target}#${e.id}`;
    tripletCounts.set(k, (tripletCounts.get(k) ?? 0) + 1);
  }
  const dupTriplets = [...tripletCounts.entries()]
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1]);
  if (dupTriplets.length > 0) {
    const maxMult = dupTriplets[0][1];
    console.warn(
      `[NavDeclAnalyzer] WARN: duplicate edges detected ` +
        `(${dupTriplets.length} duplicate triplets, max multiplicity ${maxMult}). ` +
        `Showing up to 20:`,
    );
    for (const [k, c] of dupTriplets.slice(0, 20)) {
      const [srcTo, id] = k.split('#');
      console.warn(`  ${c}x ${id} ${srcTo}`);
    }
    if (dupTriplets.length > 20) {
      console.warn(`  ... (${dupTriplets.length - 20} more)`);
    }
  }

  // De-duplicate *identical* edges.
  // Why: overlapping from-constraints / wildcard expansion can cause the exact same
  // (source,target,id,metadata...) edge to be emitted multiple times, which inflates
  // edgeCount without adding semantic reachability.
  const seen = new Set();
  const dedupedEdges = [];
  for (const e of edges) {
    const key = [
      e.source,
      e.target,
      e.id,
      e.mode ?? '',
      e.label ?? '',
      JSON.stringify(e.when ?? null),
      JSON.stringify(e.fromConstraint ?? null),
      JSON.stringify(e.search ?? null),
      JSON.stringify(e.searchParams ?? null),
      JSON.stringify(e.params ?? null),
      JSON.stringify(e.preserveParams ?? null),
      JSON.stringify(e.uiCondition ?? null),
      JSON.stringify(e.uiMeta ?? null),
      JSON.stringify(e.availability ?? null),
      JSON.stringify(e.availabilityNote ?? null),
      JSON.stringify(e.expandedFrom ?? null),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedEdges.push(e);
  }

  return { nodes, edges: dedupedEdges };
}

function normalizeSearch(search) {
  const normalized = {};
  for (const [key, value] of Object.entries(search)) {
    if (value === null || value === undefined) continue;
    normalized[key] = value;
  }
  return normalized;
}

function serializeSearch(search) {
  const entries = Object.entries(search).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([key, value]) => `${key}=${value}`).join('&');
}

function buildNodeId(path, search, queryParams) {
  const parts = [];
  for (const [key, value] of Object.entries(search)) {
    parts.push(`${key}=${value}`);
  }
  // Dynamic query params (queryParams) are represented as placeholders in nodeId for readability,
  // e.g. `/search?q=:q`. They are NOT discrete uiStates, and should not be expanded/enumerated.
  // Keep ordering stable for deterministic outputs.
  for (const key of Object.keys(queryParams ?? {}).sort()) {
    parts.push(`${key}=:${key}`);
  }
  if (parts.length === 0) {
    return path;
  }
  return `${path}?${parts.join('&')}`;
}

function resolveTargetNodeId(path, search, stateIndex, routeIndex) {
  const searchKey = serializeSearch(search);
  const pathStates = stateIndex.get(path);
  if (pathStates && pathStates.has(searchKey)) {
    return pathStates.get(searchKey);
  }

  const route = routeIndex.get(path);
  if (!route) {
    return `${path}#missing-route`;
  }
  return buildNodeId(path, search, route.queryParams ?? {});
}

function resolveSourceNodeId(from, stateIndex, routeIndex) {
  if (from === '*') return '*';
  if (typeof from === 'string') {
    return resolveTargetNodeId(from, {}, stateIndex, routeIndex);
  }
  if (Array.isArray(from)) {
    return fromToString(from);
  }

  if (from.search) {
    const hasWildcard = Object.values(from.search).some(value => value === '*');
    if (hasWildcard) {
      return fromToString(from);
    }
  }

  const normalizedSearch = normalizeSearch(from.search ?? {});
  return resolveTargetNodeId(from.path, normalizedSearch, stateIndex, routeIndex);
}

function isNodeId(value) {
  return typeof value === 'string' && value.startsWith('/');
}

function expandFromConstraint(from, stateIndex, routeIndex) {
  // Simple string path - no expansion needed
  if (typeof from === 'string') {
    return [from];
  }

  // Check if search contains wildcards
  const search = from.search ?? {};
  const hasWildcard = Object.values(search).some(value => value === '*');
  
  if (!hasWildcard) {
    return [from];
  }

  // Expand wildcards based on route's uiStates
  const route = routeIndex.get(from.path);
  if (!route || !route.uiStates) {
    return [from]; // Can't expand, keep original
  }

  const wildcardKeys = Object.entries(search)
    .filter(([_, value]) => value === '*')
    .map(([key]) => key);

  const matchingStates = route.uiStates.filter(state => {
    const stateSearch = normalizeSearch(state.search ?? {});
    // Must satisfy full constraint semantics:
    // - wildcard keys must exist
    // - null means key must NOT exist
    // - exact values must match
    return (
      wildcardKeys.every(key => key in stateSearch) &&
      matchFromConstraint(from, from.path, stateSearch)
    );
  });

  if (matchingStates.length === 0) {
    return [from]; // No matching states, keep original
  }

  return matchingStates.map(state => ({
    path: from.path,
    // Build an expanded constraint that points to a concrete uiState search.
    // Important: do NOT let uiState search overwrite constraint semantics like { modal: null }.
    search: (() => {
      const stateSearch = { ...(state.search ?? {}) };
      for (const [key, value] of Object.entries(search)) {
        if (value === null) {
          delete stateSearch[key];
        } else if (value !== '*') {
          stateSearch[key] = value;
        }
      }
      return stateSearch;
    })(),
  }));
}

function buildSimplifiedGraph(graph) {
  // Build simplified nodes (one per route path)
  const routeNodes = new Map();
  for (const node of graph.nodes) {
    if (!routeNodes.has(node.routePath)) {
      routeNodes.set(node.routePath, {
        id: node.routePath,
        routePath: node.routePath,
        component: node.component,
        entryPoint: Boolean(node.entryPoint),
        entry: node.entry ?? undefined,
        description: node.description,
        stateCount: 0,
        states: [],
        // actions aggregated across uiStates
        actionCount: 0,
        actionIds: [],
        actions: [],
      });
    }
    const routeNode = routeNodes.get(node.routePath);
    if (node.entryPoint) routeNode.entryPoint = true;
    if (!routeNode.entry && node.entry) routeNode.entry = node.entry;
    routeNode.stateCount++;
    routeNode.states.push(node.id);

    // Aggregate actions for simplified view
    const actions = Array.isArray(node.actions) ? node.actions : [];
    if (actions.length > 0) {
      const seen = routeNode.__actionIdSet ?? (routeNode.__actionIdSet = new Set());
      for (const a of actions) {
        const id = a?.id;
        if (!id || typeof id !== 'string') continue;
        if (seen.has(id)) continue;
        seen.add(id);
        routeNode.actionIds.push(id);
        routeNode.actions.push(a);
      }
      routeNode.actionCount = routeNode.actionIds.length;
    }
  }

  // Build simplified edges (deduplicated by source route -> target route)
  const edgeMap = new Map();
  for (const edge of graph.edges) {
    const sourceRoute = extractRoutePath(edge.source);
    const targetRoute = extractRoutePath(edge.target);
    
    // Skip internal edges (same route)
    if (sourceRoute === targetRoute) continue;
    
    const edgeKey = `${sourceRoute}|${targetRoute}`;
    if (!edgeMap.has(edgeKey)) {
      edgeMap.set(edgeKey, {
        source: sourceRoute,
        target: targetRoute,
        transitions: [],
        type: 'navigation',
      });
    }
    const simplifiedEdge = edgeMap.get(edgeKey);
    if (!simplifiedEdge.transitions.includes(edge.id)) {
      simplifiedEdge.transitions.push(edge.id);
    }
  }

  // Add label to each edge (join transitions)
  for (const edge of edgeMap.values()) {
    edge.label = edge.transitions.join(', ');
    edge.id = edge.transitions[0] || 'edge';
  }

  return {
    nodes: Array.from(routeNodes.values()).map(n => {
      // remove internal helper
      if (n.__actionIdSet) delete n.__actionIdSet;
      return n;
    }),
    edges: Array.from(edgeMap.values()),
  };
}

function extractRoutePath(nodeId) {
  if (!nodeId || typeof nodeId !== 'string') return nodeId;
  const questionIndex = nodeId.indexOf('?');
  return questionIndex >= 0 ? nodeId.substring(0, questionIndex) : nodeId;
}

/**
 * Determine edge type by comparing source/target pathname.
 *
 * - navigation: pathname changes
 * - state: same pathname, only query changes
 *
 * @param {string} source - nodeId or route path
 * @param {string | undefined} target - nodeId or route path
 * @returns {'navigation' | 'state'}
 */
function determineEdgeType(source, target) {
  if (!target) return 'state';
  return extractRoutePath(source) === extractRoutePath(target) ? 'state' : 'navigation';
}

function applyPreserveParamsToSearch(baseSearch, preserveParams, sourceNodeSearch) {
  if (!preserveParams || preserveParams.length === 0) return baseSearch;
  const out = { ...(baseSearch ?? {}) };
  for (const k of preserveParams) {
    const v = sourceNodeSearch?.[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const appPath = resolveAppPath(args.app, args.appsRoot);
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
