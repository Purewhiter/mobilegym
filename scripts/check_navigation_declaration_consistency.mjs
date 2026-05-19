#!/usr/bin/env node
/**
 * Static consistency checker between navigation declaration and source code triggers.
 *
 * What it detects (v0.1):
 * 1) Used transitionId in code but missing in navigation.declaration.ts transitions[].
 * 2) Usage occurs inside a page component whose route path is NOT included in transition.from (path match only).
 *
 * Notes:
 * - This is a best-effort static checker. It does not execute code.
 * - For "from" checks, we only validate route path presence (string '/x' or object {path:'/x', ...}).
 *   We do NOT attempt to prove search constraints correctness (e.g. tab='shelf' vs '*').
 */
import fs from 'fs';
import path from 'path';
import process from 'process';
import ts from 'typescript';

const WORKSPACE_ROOT = process.cwd();

function usage() {
  console.log(`
Usage:
  node scripts/check_navigation_declaration_consistency.mjs WechatReading

Options:
  --json   Output JSON only
  --actions  Also validate Actions (data-action) consistency
  --actions-only  Only run Actions checks
  --fail-on-warn  Exit non-zero on warnings too
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const appName = args.find(a => !a.startsWith('--'));
  const jsonOnly = args.includes('--json');
  const failOnWarn = args.includes('--fail-on-warn');
  const actions = args.includes('--actions');
  const actionsOnly = args.includes('--actions-only');
  return { appName, jsonOnly, failOnWarn, actions, actionsOnly };
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

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
  const text = readText(filePath);
  const ext = path.extname(filePath);
  const kind = ext === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind);
}

function isObjectLiteral(node) {
  return node && node.kind === ts.SyntaxKind.ObjectLiteralExpression;
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

function getStringLiteralValue(node) {
  if (!node) return null;
  // Unwrap common TS wrappers like `'x' as TransitionId` or `('x')`
  let cur = node;
  while (cur) {
    if (ts.isAsExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    if (ts.isSatisfiesExpression && ts.isSatisfiesExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    if (ts.isParenthesizedExpression(cur)) {
      cur = cur.expression;
      continue;
    }
    break;
  }
  if (ts.isStringLiteral(cur) || ts.isNoSubstitutionTemplateLiteral(cur)) return cur.text;
  return null;
}

function extractNavDeclaration(navDeclPath) {
  const sf = createSourceFile(navDeclPath);

  /** @type {null | ts.ObjectLiteralExpression} */
  let declObj = null;

  function unwrapExpr(expr) {
    let cur = expr;
    // Unwrap common TS wrappers: `as const`, `satisfies`, parentheses
    // - AsExpression: `{...} as const`
    // - SatisfiesExpression: `({...}) satisfies T`
    // - ParenthesizedExpression: `({...})`
    while (cur) {
      if (ts.isAsExpression(cur)) {
        cur = cur.expression;
        continue;
      }
      if (ts.isSatisfiesExpression && ts.isSatisfiesExpression(cur)) {
        cur = cur.expression;
        continue;
      }
      if (ts.isParenthesizedExpression(cur)) {
        cur = cur.expression;
        continue;
      }
      break;
    }
    return cur;
  }

  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'NAVIGATION_DECLARATION') {
      const init = node.initializer ? unwrapExpr(node.initializer) : null;
      if (init && ts.isObjectLiteralExpression(init)) declObj = init;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  if (!declObj) {
    throw new Error(`Cannot find NAVIGATION_DECLARATION object in ${navDeclPath}`);
  }

  const routesInit = getProp(declObj, 'routes');
  const transitionsInit = getProp(declObj, 'transitions');

  /** @type {Array<{path:string, component:string, queryParamKeys:Set<string>, uiStates:Array<{id:string, discreteKeys:Set<string>}> , uiStateDiscreteKeySets:Set<string>[], hasBaseDiscreteState:boolean}>} */
  const routes = [];
  /** @type {Map<string, {id:string, fromPaths:Set<string>, fromEntries:Array<{path:string, search?:Record<string,string>}>, uiPlacement:null|string, uiGesture:null|string, rawFrom:any}>} */
  const transitions = new Map();

  if (routesInit && ts.isArrayLiteralExpression(routesInit)) {
    for (const el of routesInit.elements) {
      if (!ts.isObjectLiteralExpression(el)) continue;
      const p = getStringLiteralValue(getProp(el, 'path'));
      const c = getStringLiteralValue(getProp(el, 'component'));
      if (!p || !c) continue;

      const queryParamKeys = new Set();
      const queryParamsInit = getProp(el, 'queryParams');
      if (queryParamsInit && ts.isObjectLiteralExpression(queryParamsInit)) {
        for (const prop of queryParamsInit.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const key =
            ts.isIdentifier(prop.name) ? prop.name.text :
            ts.isStringLiteral(prop.name) ? prop.name.text :
            null;
          if (!key) continue;
          queryParamKeys.add(key);
        }
      }

      const uiStateDiscreteKeySets = [];
      const uiStates = [];
      let hasBaseDiscreteState = false;
      const uiStatesInit = getProp(el, 'uiStates');
      if (uiStatesInit && ts.isArrayLiteralExpression(uiStatesInit)) {
        for (const stateEl of uiStatesInit.elements) {
          if (!ts.isObjectLiteralExpression(stateEl)) continue;
          const uiStateId = getStringLiteralValue(getProp(stateEl, 'id')) ?? '<unknown>';
          const searchInit = getProp(stateEl, 'search');
          const searchObj = searchInit && ts.isObjectLiteralExpression(searchInit) ? searchInit : null;
          const discreteKeys = new Set();
          if (searchObj) {
            for (const prop of searchObj.properties) {
              if (!ts.isPropertyAssignment(prop)) continue;
              const key =
                ts.isIdentifier(prop.name) ? prop.name.text :
                ts.isStringLiteral(prop.name) ? prop.name.text :
                null;
              if (!key) continue;
              // queryParams are dynamic; don't count them as discrete keys
              if (queryParamKeys.has(key)) continue;
              discreteKeys.add(key);
            }
          }
          uiStateDiscreteKeySets.push(discreteKeys);
          uiStates.push({ id: uiStateId, discreteKeys });
          if (discreteKeys.size === 0) hasBaseDiscreteState = true;
        }
      }

      routes.push({
        path: p,
        component: c,
        queryParamKeys,
        uiStates,
        uiStateDiscreteKeySets,
        hasBaseDiscreteState,
      });
    }
  }

  if (transitionsInit && ts.isArrayLiteralExpression(transitionsInit)) {
    for (const el of transitionsInit.elements) {
      if (!ts.isObjectLiteralExpression(el)) continue;
      const id = getStringLiteralValue(getProp(el, 'id'));
      if (!id) continue;

      const fromInit = getProp(el, 'from');
      const fromPaths = new Set();
      const fromEntries = [];
      const uiInit = getProp(el, 'ui');
      let uiPlacement = null;
      let uiGesture = null;
      if (uiInit && ts.isObjectLiteralExpression(uiInit)) {
        uiPlacement = getStringLiteralValue(getProp(uiInit, 'placement'));
        uiGesture = getStringLiteralValue(getProp(uiInit, 'gesture'));
      }

      const parseSearchObj = (searchInit) => {
        if (!searchInit || !ts.isObjectLiteralExpression(searchInit)) return undefined;
        const out = {};
        for (const prop of searchInit.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const key =
            ts.isIdentifier(prop.name) ? prop.name.text :
            ts.isStringLiteral(prop.name) ? prop.name.text :
            null;
          if (!key) continue;
          const val = getStringLiteralValue(prop.initializer);
          if (val !== null) out[key] = val;
        }
        return out;
      };

      const addFromNode = node => {
        const str = getStringLiteralValue(node);
        if (str) {
          fromPaths.add(str);
          fromEntries.push({ path: str });
          return;
        }
        if (node && ts.isObjectLiteralExpression(node)) {
          const p = getStringLiteralValue(getProp(node, 'path'));
          if (p) {
            fromPaths.add(p);
            const search = parseSearchObj(getProp(node, 'search'));
            fromEntries.push({ path: p, ...(search ? { search } : {}) });
          }
        }
      };

      if (fromInit) {
        if (ts.isArrayLiteralExpression(fromInit)) {
          for (const item of fromInit.elements) addFromNode(item);
        } else {
          addFromNode(fromInit);
        }
      }

      transitions.set(id, {
        id,
        fromPaths,
        fromEntries,
        uiPlacement,
        uiGesture,
        rawFrom: fromInit ? sf.text.slice(fromInit.pos, fromInit.end) : null,
      });
    }
  }

  const componentToPaths = new Map();
  for (const r of routes) {
    const list = componentToPaths.get(r.component) ?? [];
    list.push(r.path);
    componentToPaths.set(r.component, list);
  }

  return { routes, transitions, componentToPaths };
}

function extractTransitionUsages(appDir, declaredTransitionIdSet) {
  const ignoreDirs = new Set(['node_modules', 'dist', 'build', 'data', 'context']);
  const exts = new Set(['.ts', '.tsx']);
  const files = listFilesRecursive(appDir, { exts, ignoreDirs });

  /** @type {Array<{id:string, kind:string, file:string, line:number, col:number, componentGuess?:string, inferredSearch?:Record<string,string>}>} */
  const usages = [];

  for (const filePath of files) {
    // Never treat the declaration itself as a "usage" source.
    if (filePath.endsWith(`${path.sep}navigation.declaration.ts`)) continue;

    const sf = createSourceFile(filePath);
    const rel = path.relative(WORKSPACE_ROOT, filePath);
    const base = path.basename(filePath).replace(/\.(ts|tsx)$/, '');
    const isPage = rel.includes(`${path.sep}pages${path.sep}`);
    const componentGuess = isPage ? base : undefined;

    // Heuristic: collect transition ids from object literals like:
    // - `{ transition: 'tab.reading' }` (TabBar in WechatReading)
    // - `{ transitionId: 'readingList.open.finished' as TransitionId }` (MyReadingPage)
    // - `{ triggerId: 'tab.home' as TransitionId }` (TabBar in TencentMeeting)
    // This lets us count indirect usage patterns like `bindTap(tab.transition)` in TabBar.
    //
    // Supported property names (common naming patterns for transition IDs):
    const TRANSITION_KEYS = [
      'transition',       // e.g. { transition: 'tab.reading' }
      'transitionId',     // e.g. { transitionId: 'home.open' }
      'triggerId',        // e.g. { triggerId: 'tab.home' } - from useTriggerGestures
      'navId',            // e.g. { navId: 'page.open' }
      'navigationId',     // e.g. { navigationId: 'route.go' }
    ];
    const fileTransitionIdPool = new Set();
    const isLikelyTransitionId = (v) =>
      typeof v === 'string' &&
      v.includes('.') &&
      !/\s/.test(v) &&
      /^[A-Za-z][A-Za-z0-9_.-]*$/.test(v);
    (function collectTransitionPool() {
      function visitPool(node) {
        if (ts.isObjectLiteralExpression(node)) {
          for (const key of TRANSITION_KEYS) {
            const t = getProp(node, key);
            const v = getStringLiteralValue(t);
            if (isLikelyTransitionId(v)) fileTransitionIdPool.add(v);
          }
        }
        ts.forEachChild(node, visitPool);
      }
      visitPool(sf);
    })();

    function record(kind, id, node) {
      const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const inferredSearch = inferSearchFromContext(node, sf);
      usages.push({
        id,
        kind,
        file: rel,
        line: lc.line + 1,
        col: lc.character + 1,
        componentGuess,
        inferredSearch,
      });
    }

    function inferSearchFromContext(node, sourceFile) {
      const out = {};

      const addFromExpr = (expr) => {
        for (const { ident, value } of extractStringEqualityConstraints(expr)) {
          const key = mapIdentToSearchKey(ident);
          if (!key) continue;
          out[key] = value;
        }
      };

      // Walk up a few parents to find if/ternary conditions guarding this usage.
      let cur = node;
      let steps = 0;
      while (cur && cur.parent && steps < 10) {
        const p = cur.parent;
        if (ts.isIfStatement(p)) addFromExpr(p.expression);
        if (ts.isConditionalExpression(p)) addFromExpr(p.condition);
        if (ts.isBinaryExpression(p) || ts.isPrefixUnaryExpression(p) || ts.isParenthesizedExpression(p)) {
          // no-op, covered by extract on higher-level conditions
        }
        cur = p;
        steps++;
        if (ts.isSourceFile(cur)) break;
      }

      return Object.keys(out).length ? out : undefined;
    }

    function mapIdentToSearchKey(ident) {
      const s = String(ident || '').toLowerCase();
      if (s.includes('tab')) return 'tab';
      if (s.includes('sub')) return 'sub';
      if (s.includes('category')) return 'category';
      if (s.includes('modal')) return 'modal';
      if (s.includes('select')) return 'select';
      return null;
    }

    function extractStringEqualityConstraints(expr) {
      /** @type {Array<{ident:string,value:string}>} */
      const res = [];

      const visit = (e) => {
        if (!e) return;
        if (ts.isParenthesizedExpression(e)) return visit(e.expression);
        if (ts.isBinaryExpression(e)) {
          // Handle `a === 'x'` and `'x' === a`
          if (
            e.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
            e.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken
          ) {
            const leftIdent = ts.isIdentifier(e.left) ? e.left.text : null;
            const rightIdent = ts.isIdentifier(e.right) ? e.right.text : null;
            const leftStr = getStringLiteralValue(e.left);
            const rightStr = getStringLiteralValue(e.right);
            if (leftIdent && rightStr) res.push({ ident: leftIdent, value: rightStr });
            if (rightIdent && leftStr) res.push({ ident: rightIdent, value: leftStr });
          }
          // Recurse through && / || trees etc.
          visit(e.left);
          visit(e.right);
          return;
        }
        if (ts.isPrefixUnaryExpression(e)) return visit(e.operand);
      };

      visit(expr);
      return res;
    }

    function visit(node) {
      if (ts.isCallExpression(node)) {
        // go('transition.id', ...)
        if (ts.isIdentifier(node.expression) && node.expression.text === 'go') {
          const first = node.arguments[0];
          const id = getStringLiteralValue(first);
          if (id) record('go', id, first);
        }
        // bindTap('transition.id', ...)
        if (ts.isIdentifier(node.expression) && node.expression.text === 'bindTap') {
          const first = node.arguments[0];
          const id = getStringLiteralValue(first);
          if (id) {
            record('bindTap', id, first);
          } else if (fileTransitionIdPool.size > 0) {
            // Indirect bindTap usage (e.g., bindTap(tab.transition))
            // Record all transition ids seen in the local pool as "used".
            for (const pooled of fileTransitionIdPool) {
              record('bindTap', pooled, node);
            }
          }
        }
        // bindLongPress('transition.id', ...)
        if (ts.isIdentifier(node.expression) && node.expression.text === 'bindLongPress') {
          const first = node.arguments[0];
          const id = getStringLiteralValue(first);
          if (id) record('bindLongPress', id, first);
        }
        // bindDoubleTap('transition.id', ...)
        if (ts.isIdentifier(node.expression) && node.expression.text === 'bindDoubleTap') {
          const first = node.arguments[0];
          const id = getStringLiteralValue(first);
          if (id) record('bindDoubleTap', id, first);
        }
        // Best-effort: indirect bindings via shared components (e.g., header/topbar config APIs).
        // We detect any call that passes an object with `id: '<transitionId>'` and only count it
        // when it matches a declared TransitionId (prevents ActionId strings from being mis-counted).
        const expr = node.expression;
        const calleeName =
          ts.isIdentifier(expr) ? expr.text :
          ts.isPropertyAccessExpression(expr) ? expr.name.text :
          'call';
        for (const arg of node.arguments ?? []) {
          if (!arg || !ts.isObjectLiteralExpression(arg)) continue;
          const idInit = getProp(arg, 'id');
          const id = getStringLiteralValue(idInit);
          if (id && (!declaredTransitionIdSet || declaredTransitionIdSet.has(id))) {
            record(`call:${calleeName}`, id, idInit ?? arg);
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }

  return usages;
}

function buildReport({ nav, usages }) {
  const declaredIds = new Set(nav.transitions.keys());

  // Built-in/system triggers are not part of navigation.declaration.ts transitions[].
  // Example: `system.back` is used by bindBack() across apps.
  const isSystemId = (id) => typeof id === 'string' && id.startsWith('system.');
  const usedIds = new Set(usages.map(u => u.id).filter(id => !isSystemId(id)));

  const missingInDeclaration = [...usedIds].filter(id => !declaredIds.has(id)).sort();
  const unusedInCode = [...declaredIds].filter(id => !usedIds.has(id)).sort();

  /** @type {Record<string, Array<{id:string, kind:string, file:string, line:number, col:number, component?:string}>>} */
  const missingUsageSites = {};
  for (const u of usages) {
    if (isSystemId(u.id)) continue;
    if (declaredIds.has(u.id)) continue;
    const arr = missingUsageSites[u.id] ?? (missingUsageSites[u.id] = []);
    arr.push({
      id: u.id,
      kind: u.kind,
      file: u.file,
      line: u.line,
      col: u.col,
      ...(u.componentGuess ? { component: u.componentGuess } : {}),
    });
  }
  for (const id of Object.keys(missingUsageSites)) {
    const seen = new Set();
    missingUsageSites[id] = missingUsageSites[id]
      .filter(x => {
        const key = `${x.file}:${x.line}:${x.col}:${x.kind}:${x.component ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) =>
        `${a.file}:${a.line}:${a.col}`.localeCompare(`${b.file}:${b.line}:${b.col}`),
      );
  }

  /** @type {Array<{id:string, file:string, line:number, col:number, component?:string, expectedFromPaths:string[], declaredFromPaths:string[]}>} */
  const fromMismatches = [];

  // Build expected from paths per transitionId based on page-local usage sites we can map.
  /** @type {Map<string, Set<string>>} */
  const expectedFromById = new Map();
  for (const u of usages) {
    if (!u.componentGuess) continue;
    const pathsForComponent = nav.componentToPaths.get(u.componentGuess) ?? [];
    if (pathsForComponent.length === 0) continue;
    const set = expectedFromById.get(u.id) ?? new Set();
    for (const p of pathsForComponent) set.add(p);
    expectedFromById.set(u.id, set);
  }

  for (const u of usages) {
    const t = nav.transitions.get(u.id);
    if (!t) continue; // already covered by missingInDeclaration
    if (!u.componentGuess) continue; // we only validate within page components for now
    const pathsForComponent = nav.componentToPaths.get(u.componentGuess) ?? [];
    if (pathsForComponent.length === 0) continue; // unknown mapping
    const ok = pathsForComponent.some(p => t.fromPaths.has(p));
    if (!ok) {
      fromMismatches.push({
        id: u.id,
        file: u.file,
        line: u.line,
        col: u.col,
        component: u.componentGuess,
        expectedFromPaths: pathsForComponent,
        declaredFromPaths: [...t.fromPaths].sort(),
      });
    }
  }

  // Gesture mismatches: compare declared ui.gesture with observed bind* usage.
  /** @type {Array<{id:string, declaredGesture:string|null, observedGestures:string[], examples:Array<{file:string,line:number,col:number,kind:string}>}>} */
  const gestureMismatches = [];
  const observedById = new Map();
  for (const u of usages) {
    if (u.kind === 'bindTap') {
      const entry = observedById.get(u.id) ?? { gestures: new Set(), examples: [] };
      entry.gestures.add('tap');
      entry.examples.push({ file: u.file, line: u.line, col: u.col, kind: u.kind });
      observedById.set(u.id, entry);
    }
    if (u.kind === 'bindLongPress') {
      const entry = observedById.get(u.id) ?? { gestures: new Set(), examples: [] };
      entry.gestures.add('longPress');
      entry.examples.push({ file: u.file, line: u.line, col: u.col, kind: u.kind });
      observedById.set(u.id, entry);
    }
    if (u.kind === 'bindDoubleTap') {
      const entry = observedById.get(u.id) ?? { gestures: new Set(), examples: [] };
      entry.gestures.add('doubleTap');
      entry.examples.push({ file: u.file, line: u.line, col: u.col, kind: u.kind });
      observedById.set(u.id, entry);
    }
  }
  for (const [id, obs] of observedById.entries()) {
    const t = nav.transitions.get(id);
    if (!t) continue;
    const declared = t.uiGesture ?? null;
    const observedGestures = [...obs.gestures].sort();
    if (declared && observedGestures.length === 1 && declared !== observedGestures[0]) {
      gestureMismatches.push({
        id,
        declaredGesture: declared,
        observedGestures,
        examples: obs.examples.slice(0, 3),
      });
    }
  }

  // from.search over-broad heuristics (best-effort):
  // If a usage site is guarded by a specific tab/sub/etc, but the transition.from for that route path
  // is missing search or uses wildcard '*', warn/suggest narrowing.
  /** @type {Array<{id:string, sourcePath:string, key:string, expectedValue:string, declaredValue:string|null, example:{file:string,line:number,col:number}}>} */
  const fromSearchTooBroad = [];
  for (const u of usages) {
    if (!u.componentGuess) continue;
    if (!u.inferredSearch) continue;
    const t = nav.transitions.get(u.id);
    if (!t) continue;
    const pathsForComponent = nav.componentToPaths.get(u.componentGuess) ?? [];
    if (pathsForComponent.length === 0) continue;
    // only handle single-path components to avoid ambiguity
    if (pathsForComponent.length !== 1) continue;
    const sourcePath = pathsForComponent[0];
    // Find from entries in declaration that match this source path
    const relevant = t.fromEntries.filter(e => e.path === sourcePath);
    if (relevant.length === 0) continue;

    for (const [key, expectedValue] of Object.entries(u.inferredSearch)) {
      for (const entry of relevant) {
        const declaredValue = entry.search?.[key] ?? null;
        if (declaredValue === '*') {
          fromSearchTooBroad.push({
            id: u.id,
            sourcePath,
            key,
            expectedValue,
            declaredValue,
            example: { file: u.file, line: u.line, col: u.col },
          });
        }
        if (declaredValue === null && expectedValue) {
          fromSearchTooBroad.push({
            id: u.id,
            sourcePath,
            key,
            expectedValue,
            declaredValue: null,
            example: { file: u.file, line: u.line, col: u.col },
          });
        }
      }
    }
  }

  // Warn about declared "from" paths that are route paths but have no mapped usage site.
  /** @type {Array<{id:string, extraFromPaths:string[], declaredFromPaths:string[], hasAnyUsage:boolean}>} */
  const extraFromWarnings = [];
  const allRoutePaths = new Set(nav.routes.map(r => r.path));
  for (const [id, t] of nav.transitions.entries()) {
    const expected = expectedFromById.get(id) ?? new Set();
    // Only run this heuristic when we have at least one mapped usage site (page -> route).
    // Otherwise (e.g., triggers inside shared components like TabBar), we can't infer expected-from.
    if (expected.size === 0) continue;
    // Tabbar transitions are global entry points; page-local inference will under-estimate.
    if (t.uiPlacement === 'tabbar') continue;
    const extra = [...t.fromPaths].filter(p => allRoutePaths.has(p) && !expected.has(p)).sort();
    // Only warn if we have at least one usage of this id anywhere (otherwise it might be truly unused/placeholder).
    const hasAnyUsage = usedIds.has(id);
    if (hasAnyUsage && extra.length > 0) {
      extraFromWarnings.push({
        id,
        extraFromPaths: extra,
        declaredFromPaths: [...t.fromPaths].sort(),
        hasAnyUsage,
      });
    }
  }

  // Warn about "from" using bare route path when that route has NO base discrete uiState.
  // This commonly creates an extra placeholder node (e.g. "/ranking" or "/profile/following") with indegree=0.
  /** @type {Array<{id:string, fromPath:string, reason:string}>} */
  const fromBarePathWithoutBaseState = [];
  const routeMetaByPath = new Map(nav.routes.map(r => [r.path, r]));
  for (const [id, t] of nav.transitions.entries()) {
    for (const entry of t.fromEntries) {
      const routeMeta = routeMetaByPath.get(entry.path);
      if (!routeMeta) continue;
      // bare path (no search constraint) only
      if (entry.search && Object.keys(entry.search).length > 0) continue;
      if (routeMeta.hasBaseDiscreteState) continue;

      const keySets = routeMeta.uiStateDiscreteKeySets || [];
      const uniqueKeySetStr = Array.from(
        new Set(
          keySets
            .filter(s => s && s.size > 0)
            .map(s => Array.from(s).sort().join(',')),
        ),
      )
        .filter(Boolean)
        .slice(0, 5);

      const hint =
        uniqueKeySetStr.length > 0
          ? `该路由没有离散基础态（uiStates 不包含 search:{}）。可达状态的离散键集合示例：${uniqueKeySetStr
              .map(s => `[${s}]`)
              .join('、')}`
          : '该路由没有离散基础态（uiStates 不包含 search:{}）。';

      fromBarePathWithoutBaseState.push({
        id,
        fromPath: entry.path,
        reason: hint,
      });
    }
  }

  // Base uiState naming: if uiState.search is {} (no discrete keys), id must end with ".base"
  // Ref: docs/platform/declarative-navigation.md ("Routes" / "Actions" sections)
  /** @type {Array<{routePath:string, uiStateId:string, message:string}>} */
  const invalidBaseStateIds = [];
  /** @type {Array<{routePath:string, baseStateIds:string[]}>} */
  const multipleBaseStates = [];

  for (const r of nav.routes) {
    const baseStates = (r.uiStates ?? []).filter(s => (s?.discreteKeys?.size ?? 0) === 0);
    if (baseStates.length > 1) {
      multipleBaseStates.push({
        routePath: r.path,
        baseStateIds: baseStates.map(s => s.id).filter(Boolean),
      });
    }
    for (const s of baseStates) {
      const id = s.id ?? '<unknown>';
      if (!id.endsWith('.base')) {
        invalidBaseStateIds.push({
          routePath: r.path,
          uiStateId: id,
          message: `Invalid base uiState id "${id}" for route "${r.path}". If uiState.search is {}, id must end with ".base".`,
        });
      }
    }
  }

  return {
    summary: {
      routes: nav.routes.length,
      transitionsDeclared: declaredIds.size,
      transitionsUsedInCode: usedIds.size,
      missingInDeclaration: missingInDeclaration.length,
      unusedInCode: unusedInCode.length,
      fromMismatches: fromMismatches.length,
      extraFromWarnings: extraFromWarnings.length,
      gestureMismatches: gestureMismatches.length,
      fromSearchTooBroad: fromSearchTooBroad.length,
      fromBarePathWithoutBaseState: fromBarePathWithoutBaseState.length,
      invalidBaseStateIds: invalidBaseStateIds.length,
      multipleBaseStates: multipleBaseStates.length,
    },
    missingInDeclaration,
    missingUsageSites,
    unusedInCode,
    fromMismatches,
    extraFromWarnings,
    gestureMismatches,
    fromSearchTooBroad,
    fromBarePathWithoutBaseState,
    invalidBaseStateIds,
    multipleBaseStates,
  };
}

function printHuman(report) {
  const s = report.summary;
  console.log('=== Navigation Declaration Consistency Report ===');
  console.log(`routes=${s.routes} transitionsDeclared=${s.transitionsDeclared} transitionsUsedInCode=${s.transitionsUsedInCode}`);
  console.log(`missingInDeclaration=${s.missingInDeclaration} fromMismatches=${s.fromMismatches} unusedInCode=${s.unusedInCode}`);
  console.log('');

  if (report.missingInDeclaration.length) {
    console.log('--- ERROR: Used in code but missing in declaration ---');
    for (const id of report.missingInDeclaration) {
      console.log(`- ${id}`);
      const sites = report.missingUsageSites?.[id] ?? [];
      for (const ex of sites.slice(0, 8)) {
        console.log(`  @ ${ex.file}:${ex.line}:${ex.col} (${ex.kind}${ex.component ? `, component=${ex.component}` : ''})`);
      }
      if (sites.length > 8) console.log(`  ... (${sites.length - 8} more)`);
    }
    console.log('');
  }

  if (report.fromMismatches.length) {
    console.log('--- ERROR: Usage file route not included in transition.from (path-only check) ---');
    for (const m of report.fromMismatches) {
      console.log(`- ${m.id} @ ${m.file}:${m.line}:${m.col} (component=${m.component})`);
      console.log(`  expected from includes one of: ${m.expectedFromPaths.join(', ')}`);
      console.log(`  declared from paths: ${m.declaredFromPaths.join(', ') || '(none parsed)'}`);
    }
    console.log('');
  }

  if (report.unusedInCode.length) {
    console.log('--- WARN: Declared but not found in code (may be OK: implicit/entry/back/placeholder) ---');
    for (const id of report.unusedInCode.slice(0, 50)) console.log(`- ${id}`);
    if (report.unusedInCode.length > 50) console.log(`... (${report.unusedInCode.length - 50} more)`);
    console.log('');
  }

  if (report.extraFromWarnings?.length) {
    console.log('--- WARN: Declared transition.from includes route paths with no mapped trigger site in code ---');
    for (const w of report.extraFromWarnings) {
      console.log(`- ${w.id}: extra from paths = ${w.extraFromPaths.join(', ')}`);
    }
    console.log('');
  }

  if (report.gestureMismatches?.length) {
    console.log('--- WARN: Declared ui.gesture mismatch vs bind* usage ---');
    for (const m of report.gestureMismatches) {
      console.log(`- ${m.id}: declared=${m.declaredGesture} observed=${m.observedGestures.join(', ')}`);
      for (const ex of m.examples) {
        console.log(`  @ ${ex.file}:${ex.line}:${ex.col} (${ex.kind})`);
      }
    }
    console.log('');
  }

  if (report.fromSearchTooBroad?.length) {
    console.log('--- WARN: transition.from.search might be too broad (best-effort inference from guarded usage sites) ---');
    for (const w of report.fromSearchTooBroad.slice(0, 30)) {
      console.log(`- ${w.id} from ${w.sourcePath}: expected ${w.key}=${w.expectedValue}, declared ${w.key}=${w.declaredValue ?? '(missing)'}`);
      console.log(`  @ ${w.example.file}:${w.example.line}:${w.example.col}`);
    }
    if (report.fromSearchTooBroad.length > 30) console.log(`... (${report.fromSearchTooBroad.length - 30} more)`);
    console.log('');
  }

  if (report.fromBarePathWithoutBaseState?.length) {
    console.log('--- WARN: transition.from uses bare route path but route has no base discrete uiState (may create indegree=0 placeholder node) ---');
    for (const w of report.fromBarePathWithoutBaseState.slice(0, 50)) {
      console.log(`- ${w.id}: from "${w.fromPath}" (no search constraint)`);
      console.log(`  ${w.reason}`);
      console.log(`  fix: replace with FromConstraint(s), e.g. { path: "${w.fromPath}", search: { <key>: '*' } } or enumerate concrete uiStates.`);
    }
    if (report.fromBarePathWithoutBaseState.length > 50) {
      console.log(`... (${report.fromBarePathWithoutBaseState.length - 50} more)`);
    }
    console.log('');
  }

  if (report.invalidBaseStateIds?.length) {
    console.log('--- ERROR: invalid base uiState ids (uiState.search is {} but id does not end with .base) ---');
    for (const e of report.invalidBaseStateIds.slice(0, 50)) {
      console.log(`- ${e.message}`);
    }
    if (report.invalidBaseStateIds.length > 50) {
      console.log(`... (${report.invalidBaseStateIds.length - 50} more)`);
    }
    console.log('');
  }

  if (report.multipleBaseStates?.length) {
    console.log('--- WARN: route has multiple base uiStates (search:{}). Consider keeping only one. ---');
    for (const w of report.multipleBaseStates.slice(0, 50)) {
      console.log(`- ${w.routePath}: base uiStates = ${w.baseStateIds.join(', ')}`);
    }
    if (report.multipleBaseStates.length > 50) {
      console.log(`... (${report.multipleBaseStates.length - 50} more)`);
    }
    console.log('');
  }
}

// ============================================================================
// Actions consistency (data-action / bindTap({kind:'action'}))
// ============================================================================

function extractActionsFromNavDeclaration(navDeclPath) {
  const sf = createSourceFile(navDeclPath);

  /** @type {null | ts.ObjectLiteralExpression} */
  let declObj = null;

  function unwrapExpr(expr) {
    let cur = expr;
    while (cur) {
      if (ts.isAsExpression(cur)) {
        cur = cur.expression;
        continue;
      }
      if (ts.isSatisfiesExpression && ts.isSatisfiesExpression(cur)) {
        cur = cur.expression;
        continue;
      }
      if (ts.isParenthesizedExpression(cur)) {
        cur = cur.expression;
        continue;
      }
      break;
    }
    return cur;
  }

  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'NAVIGATION_DECLARATION'
    ) {
      const init = node.initializer ? unwrapExpr(node.initializer) : null;
      if (init && ts.isObjectLiteralExpression(init)) declObj = init;
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  if (!declObj) {
    throw new Error(`Cannot find NAVIGATION_DECLARATION object in ${navDeclPath}`);
  }

  const routesInit = getProp(declObj, 'routes');
  /** @type {Array<{id:string,label?:string,behavior?:string,scope?:string,paramsSchema?:Record<string,string>,routePath:string,uiStateId:string}>} */
  const actions = [];

  if (routesInit && ts.isArrayLiteralExpression(routesInit)) {
    for (const routeEl of routesInit.elements) {
      if (!ts.isObjectLiteralExpression(routeEl)) continue;
      const routePath = getStringLiteralValue(getProp(routeEl, 'path')) ?? '<unknown>';
      const uiStatesInit = getProp(routeEl, 'uiStates');
      if (!uiStatesInit || !ts.isArrayLiteralExpression(uiStatesInit)) continue;

      for (const uiStateEl of uiStatesInit.elements) {
        if (!ts.isObjectLiteralExpression(uiStateEl)) continue;
        const uiStateId = getStringLiteralValue(getProp(uiStateEl, 'id')) ?? '<unknown>';
        const actionsInit = getProp(uiStateEl, 'actions');
        if (!actionsInit || !ts.isArrayLiteralExpression(actionsInit)) continue;

        for (const actEl of actionsInit.elements) {
          if (!ts.isObjectLiteralExpression(actEl)) continue;
          const id = getStringLiteralValue(getProp(actEl, 'id'));
          if (!id) continue;
          const label = getStringLiteralValue(getProp(actEl, 'label')) ?? undefined;
          const behavior = getStringLiteralValue(getProp(actEl, 'behavior')) ?? undefined;
          const scope = getStringLiteralValue(getProp(actEl, 'scope')) ?? undefined;

          const paramsSchemaInit = getProp(actEl, 'paramsSchema');
          let paramsSchema = undefined;
          if (paramsSchemaInit && ts.isObjectLiteralExpression(paramsSchemaInit)) {
            paramsSchema = {};
            for (const prop of paramsSchemaInit.properties) {
              if (!ts.isPropertyAssignment(prop)) continue;
              const key =
                ts.isIdentifier(prop.name) ? prop.name.text :
                ts.isStringLiteral(prop.name) ? prop.name.text :
                null;
              if (!key) continue;
              const val = getStringLiteralValue(prop.initializer);
              if (val) paramsSchema[key] = val;
            }
          }

          actions.push({ id, label, behavior, scope, paramsSchema, routePath, uiStateId });
        }
      }
    }
  }

  return actions;
}

function extractActionUsages(appDir, declaredIdSet) {
  const ignoreDirs = new Set(['node_modules', 'dist', 'build']);
  const exts = new Set(['.ts', '.tsx']);
  const files = listFilesRecursive(appDir, { exts, ignoreDirs });

  /** @type {Array<{id:string, kind:'bindTap'|'bindLongPress'|'bindDoubleTap'|'data-action'|'stringLiteral', file:string, line:number, col:number}>} */
  const usages = [];

  for (const filePath of files) {
    // Never treat the declaration itself as a "usage" source.
    if (filePath.endsWith(`${path.sep}navigation.declaration.ts`)) continue;

    const sf = createSourceFile(filePath);
    const rel = path.relative(WORKSPACE_ROOT, filePath);

    function record(kind, id, node) {
      const lc = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      usages.push({
        id,
        kind,
        file: rel,
        line: lc.line + 1,
        col: lc.character + 1,
      });
    }

    function extractActionSpecId(objLit) {
      if (!isObjectLiteral(objLit)) return null;
      const kindInit = getProp(objLit, 'kind');
      const kindVal = getStringLiteralValue(kindInit);
      if (kindVal !== 'action') return null;
      return getStringLiteralValue(getProp(objLit, 'id'));
    }

    function visit(node) {
      // bindTap({kind:'action',id:'x'})
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const callee = node.expression.text;
        if (callee === 'bindTap' || callee === 'bindLongPress' || callee === 'bindDoubleTap') {
          const first = node.arguments[0];
          if (first && ts.isObjectLiteralExpression(first)) {
            const id = extractActionSpecId(first);
            if (id) record(callee, id, first);
          }
        }
      }

      // JSX: data-action="x"
      if (ts.isJsxAttribute(node)) {
        const name = node.name?.text;
        if (name === 'data-action') {
          const init = node.initializer;
          if (init && ts.isStringLiteral(init)) {
            record('data-action', init.text, init);
          }
          if (init && ts.isJsxExpression(init) && init.expression) {
            const v = getStringLiteralValue(init.expression);
            if (v) record('data-action', v, init.expression);
          }
        }
      }

      // Best-effort: any string literal that exactly matches a declared actionId
      // (covers passing actionId via props / lookup tables).
      if (declaredIdSet && ts.isStringLiteral(node)) {
        if (declaredIdSet.has(node.text)) record('stringLiteral', node.text, node);
      }
      if (declaredIdSet && ts.isNoSubstitutionTemplateLiteral(node)) {
        if (declaredIdSet.has(node.text)) record('stringLiteral', node.text, node);
      }

      ts.forEachChild(node, visit);
    }

    visit(sf);
  }

  return usages;
}

function validateActionDeclarations(actions) {
  /** @type {Array<{level:'error'|'warn', code:string, message:string, actionId?:string, routePath?:string, uiStateId?:string}>} */
  const issues = [];

  const idToDecls = new Map();
  for (const a of actions) {
    const list = idToDecls.get(a.id) ?? [];
    list.push(a);
    idToDecls.set(a.id, list);
  }

  for (const [id, list] of idToDecls.entries()) {
    if (list.length > 1) {
      issues.push({
        level: 'error',
        code: 'duplicate_action_id',
        message: `Duplicate action id "${id}" declared in multiple uiStates (${list.length}).`,
        actionId: id,
      });
    }
  }

  // Allow camelCase / PascalCase segments; still require dot-separated segments.
  const idRe = /^[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)+$/;

  for (const a of actions) {
    const { id, behavior, scope, paramsSchema } = a;
    const segments = id.split('.');

    if (!idRe.test(id) || segments.length < 3) {
      issues.push({
        level: 'error',
        code: 'invalid_action_id',
        message: `Invalid actionId "${id}". Must match ${idRe} and have at least 3 segments.`,
        actionId: id,
        routePath: a.routePath,
        uiStateId: a.uiStateId,
      });
    }

    if (behavior === 'select') {
      if (!/\.select\.[a-zA-Z0-9]+$/.test(id)) {
        issues.push({
          level: 'error',
          code: 'select_id_format',
          message: `behavior='select' actionId must match "<prefix>.select.<option>": "${id}"`,
          actionId: id,
          routePath: a.routePath,
          uiStateId: a.uiStateId,
        });
      }
    }

    if (behavior === 'input') {
      if (!paramsSchema || (paramsSchema.value !== 'string' && paramsSchema.value !== 'number')) {
        issues.push({
          level: 'error',
          code: 'input_requires_value',
          message: `behavior='input' must declare paramsSchema.value as 'string'|'number': "${id}"`,
          actionId: id,
          routePath: a.routePath,
          uiStateId: a.uiStateId,
        });
      }
    }

    if (scope === 'item') {
      if (!paramsSchema || Object.keys(paramsSchema).length === 0) {
        issues.push({
          level: 'error',
          code: 'item_scope_requires_params_schema',
          message: `scope='item' must declare paramsSchema with at least one object identifier field: "${id}"`,
          actionId: id,
          routePath: a.routePath,
          uiStateId: a.uiStateId,
        });
      } else {
        const objectIdKeys = Object.entries(paramsSchema).filter(
          ([k, v]) => (v === 'string' || v === 'number') && k !== 'value' && k !== 'to',
        );
        if (objectIdKeys.length === 0) {
          issues.push({
            level: 'error',
            code: 'item_scope_missing_object_identifier',
            message: `scope='item' paramsSchema must include at least one identifier field (string|number), e.g. bookId/userId: "${id}"`,
            actionId: id,
            routePath: a.routePath,
            uiStateId: a.uiStateId,
          });
        }
      }
    }
  }

  return issues;
}

function buildActionsReport({ declaredActions, usages }) {
  const declaredIds = new Set(declaredActions.map(a => a.id));
  const usedIds = new Set(usages.map(u => u.id));

  const missingInDeclaration = [...usedIds].filter(id => !declaredIds.has(id)).sort();
  const unusedInCode = [...declaredIds].filter(id => !usedIds.has(id)).sort();
  const schemaIssues = validateActionDeclarations(declaredActions);

  /** @type {Record<string, Array<{id:string, kind:string, file:string, line:number, col:number}>>} */
  const missingUsageSites = {};
  for (const u of usages) {
    if (declaredIds.has(u.id)) continue;
    const arr = missingUsageSites[u.id] ?? (missingUsageSites[u.id] = []);
    arr.push({ id: u.id, kind: u.kind, file: u.file, line: u.line, col: u.col });
  }
  for (const id of Object.keys(missingUsageSites)) {
    const seen = new Set();
    missingUsageSites[id] = missingUsageSites[id]
      .filter(x => {
        const key = `${x.file}:${x.line}:${x.col}:${x.kind}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) =>
        `${a.file}:${a.line}:${a.col}`.localeCompare(`${b.file}:${b.line}:${b.col}`),
      );
  }

  return {
    summary: {
      actionsDeclared: declaredIds.size,
      actionsUsedInCode: usedIds.size,
      missingInDeclaration: missingInDeclaration.length,
      unusedInCode: unusedInCode.length,
      schemaErrors: schemaIssues.filter(x => x.level === 'error').length,
      schemaWarnings: schemaIssues.filter(x => x.level === 'warn').length,
    },
    missingInDeclaration,
    missingUsageSites,
    unusedInCode,
    schemaIssues,
  };
}

function printHumanActions(report) {
  const s = report.summary;
  console.log('=== Actions Declaration Consistency Report ===');
  console.log(`actionsDeclared=${s.actionsDeclared} actionsUsedInCode=${s.actionsUsedInCode}`);
  console.log(`missingInDeclaration=${s.missingInDeclaration} unusedInCode=${s.unusedInCode}`);
  console.log(`schemaErrors=${s.schemaErrors} schemaWarnings=${s.schemaWarnings}`);
  console.log('');

  const errors = report.schemaIssues.filter(x => x.level === 'error');
  const warns = report.schemaIssues.filter(x => x.level === 'warn');

  if (errors.length) {
    console.log('--- ERROR: Action declaration schema issues ---');
    for (const e of errors) {
      console.log(`- [${e.code}] ${e.message}`);
    }
    console.log('');
  }

  if (report.missingInDeclaration.length) {
    console.log('--- ERROR: Used in code but missing in declaration ---');
    for (const id of report.missingInDeclaration) {
      console.log(`- ${id}`);
      const sites = report.missingUsageSites?.[id] ?? [];
      for (const ex of sites.slice(0, 8)) {
        console.log(`  @ ${ex.file}:${ex.line}:${ex.col} (${ex.kind})`);
      }
      if (sites.length > 8) console.log(`  ... (${sites.length - 8} more)`);
    }
    console.log('');
  }

  if (warns.length) {
    console.log('--- WARN: Action declaration schema warnings ---');
    for (const w of warns) console.log(`- [${w.code}] ${w.message}`);
    console.log('');
  }

  if (report.unusedInCode.length) {
    console.log('--- WARN: Declared but not found in code ---');
    for (const id of report.unusedInCode.slice(0, 50)) console.log(`- ${id}`);
    if (report.unusedInCode.length > 50) console.log(`... (${report.unusedInCode.length - 50} more)`);
    console.log('');
  }
}

async function main() {
  const { appName, jsonOnly, failOnWarn, actions, actionsOnly } = parseArgs(process.argv);
  if (!appName) {
    usage();
    process.exit(2);
  }

  const appDir = path.join(WORKSPACE_ROOT, 'apps', appName);
  const navDeclPath = path.join(appDir, 'navigation.declaration.ts');
  if (!fs.existsSync(navDeclPath)) {
    throw new Error(`navigation.declaration.ts not found: ${navDeclPath}`);
  }

  const nav = extractNavDeclaration(navDeclPath);
  const navUsages = extractTransitionUsages(appDir, new Set(nav.transitions.keys()));
  const navReport = buildReport({ nav, usages: navUsages });

  let actionsReport = null;
  if (actions || actionsOnly) {
    const declaredActions = extractActionsFromNavDeclaration(navDeclPath);
    const declaredIdSet = new Set(declaredActions.map(a => a.id));
    const actionUsages = extractActionUsages(appDir, declaredIdSet);
    actionsReport = buildActionsReport({ declaredActions, usages: actionUsages });
  }

  if (jsonOnly) {
    if (actions || actionsOnly) {
      console.log(JSON.stringify({ navigation: navReport, actions: actionsReport }, null, 2));
    } else {
      console.log(JSON.stringify(navReport, null, 2));
    }
  } else {
    if (!actionsOnly) {
      printHuman(navReport);
      console.log(`JSON summary: ${JSON.stringify(navReport.summary)}`);
      console.log('');
    }
    if (actions || actionsOnly) {
      printHumanActions(actionsReport);
      console.log(`JSON summary: ${JSON.stringify(actionsReport.summary)}`);
    }
  }

  const hasNavError = navReport.missingInDeclaration.length > 0 || navReport.fromMismatches.length > 0;
  const hasNavWarn = navReport.unusedInCode.length > 0;

  const hasActionsError = actionsReport
    ? actionsReport.missingInDeclaration.length > 0 ||
      actionsReport.schemaIssues.some(x => x.level === 'error')
    : false;
  const hasActionsWarn = actionsReport
    ? actionsReport.unusedInCode.length > 0 ||
      actionsReport.schemaIssues.some(x => x.level === 'warn')
    : false;

  const hasError = (actionsOnly ? hasActionsError : hasNavError || hasActionsError);
  const hasWarn = (actionsOnly ? hasActionsWarn : hasNavWarn || hasActionsWarn);
  if (hasError || (failOnWarn && hasWarn)) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

