#!/usr/bin/env node
/**
 * lint_store_getters.mjs
 *
 * Detects query-like getter functions defined in Zustand store actions.
 * These have stable references — subscribing via useStore(s => s.isLiked)
 * will NOT trigger re-renders when the underlying data changes.
 *
 * Implementation: TypeScript AST (not regex), so it understands
 *   - `interface FooActions { ... }` (incl. extends clauses)
 *   - `type FooActions = { ... }` / intersections (`Base & { ... }`)
 *   - property signatures  `getX: (id: string) => X`
 *   - method shorthand     `getX(id: string): X`
 *   - generic methods      `getX: <T>(k: string) => T`
 *
 * Three-pass analysis over apps/ + system/:
 *   Pass 1 — Store definitions: query-like methods in *Actions* interfaces/type aliases (ERROR)
 *   Pass 2 — Consumer subscriptions: useXxxStore(s => s.<getter>) (ERROR)
 *   Pass 3 — Whole-store subscriptions: bare useXxxStore() without a selector (WARN, non-blocking)
 *
 * Exit code: 1 when error-level issues exist (pass 1/2); pass-3 warnings never block.
 *
 * See docs/platform/state/model.md "Store actions: no query-style getters"
 *
 * Usage:
 *   node scripts/lint_store_getters.mjs              # scan all apps (apps/ + system/)
 *   node scripts/lint_store_getters.mjs Spotify X    # scan specific apps
 *   node scripts/lint_store_getters.mjs --json       # JSON output
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const WORKSPACE = process.cwd();
const SCAN_ROOTS = ['apps', 'system'];

export const QUERY_PREFIXES = ['is', 'get', 'check', 'has'];
export const SAFE_NAMES = new Set([
  'isPlaying', 'isLoggedIn', 'isLoading', 'isEditing', 'isRecording',
  'isExpanded', 'isVisible', 'isMuted', 'isPaused', 'isOpen',
]);

const STORE_HOOK_RE = /^use[A-Z0-9_]\w*Store$/;

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const appFilters = args.filter(a => !a.startsWith('--'));

function parseSource(source, filePath) {
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, kind);
}

function memberName(member) {
  const name = member.name;
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function isQueryName(name) {
  return QUERY_PREFIXES.some(prefix => {
    if (!name.startsWith(prefix)) return false;
    const charAfter = name[prefix.length];
    return Boolean(charAfter) && charAfter === charAfter.toUpperCase();
  });
}

// ── Pass 1: Scan store definitions ──────────────────────────────────

/**
 * Collect TypeLiteral member lists reachable from a type alias RHS
 * (direct `{...}`, intersections `A & {...}`, parenthesized types).
 */
function collectTypeLiteralMembers(typeNode, out = []) {
  if (!typeNode) return out;
  if (ts.isTypeLiteralNode(typeNode)) {
    out.push(...typeNode.members);
    return out;
  }
  if (ts.isIntersectionTypeNode(typeNode)) {
    for (const t of typeNode.types) collectTypeLiteralMembers(t, out);
    return out;
  }
  if (ts.isParenthesizedTypeNode(typeNode)) {
    return collectTypeLiteralMembers(typeNode.type, out);
  }
  return out;
}

/**
 * Extract function-like members as {name, returnTypeText, node}.
 * Supports `name: (args) => Ret` (incl. generic arrow) and `name(args): Ret`.
 */
function functionLikeMembers(members, sf) {
  const out = [];
  for (const member of members) {
    const name = memberName(member);
    if (!name) continue;

    let returnTypeNode = null;
    if (ts.isPropertySignature(member) && member.type && ts.isFunctionTypeNode(member.type)) {
      returnTypeNode = member.type.type;
    } else if (ts.isMethodSignature(member)) {
      returnTypeNode = member.type ?? null;
      if (!returnTypeNode) continue; // no annotation — cannot prove it's a query getter
    } else {
      continue;
    }

    out.push({
      name,
      returnTypeText: returnTypeNode ? returnTypeNode.getText(sf) : '',
      node: member,
    });
  }
  return out;
}

/**
 * Find query-like getters declared in *Actions* interfaces / type aliases.
 *
 * @param {string} source file contents
 * @param {string} filePath used in issue records
 * @returns {{issues: Array<{file:string,line:number,method:string,iface:string,returnType:string,message:string}>, queryMethods: Set<string>}}
 */
export function findActionsInterfaces(source, filePath) {
  const sf = parseSource(source, filePath);
  const issues = [];
  const queryMethods = new Set();

  const inspect = (ifaceName, members) => {
    for (const { name, returnTypeText, node } of functionLikeMembers(members, sf)) {
      const returnType = returnTypeText.replace(/[;,]$/, '');
      if (returnType === 'void') continue;
      if (SAFE_NAMES.has(name)) continue;
      if (!isQueryName(name)) continue;

      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      issues.push({
        file: filePath,
        line,
        method: name,
        iface: ifaceName,
        returnType,
        message: `Query getter "${name}" in ${ifaceName} — should be a memoSelector or derived in component (§5.3)`,
      });
      queryMethods.add(name);
    }
  };

  const visit = (node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text.includes('Actions')) {
      inspect(node.name.text, node.members);
    }
    if (ts.isTypeAliasDeclaration(node) && node.name.text.includes('Actions')) {
      inspect(node.name.text, collectTypeLiteralMembers(node.type));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return { issues, queryMethods };
}

// ── Pass 2: Scan consumer subscriptions ─────────────────────────────

/**
 * Find `useXxxStore(s => s.<getter>)` subscriptions to known getter functions.
 *
 * @param {string} source file contents
 * @param {string} filePath used in issue records
 * @param {Set<string>} knownGetters getters found in this app's store
 * @returns {Array<{file:string,line:number,store:string,method:string,message:string}>}
 */
export function findGetterSubscriptions(source, filePath, knownGetters) {
  const issues = [];
  if (knownGetters.size === 0) return issues;

  const sf = parseSource(source, filePath);

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      STORE_HOOK_RE.test(node.expression.text) &&
      node.arguments.length >= 1
    ) {
      const selector = node.arguments[0];
      if (
        ts.isArrowFunction(selector) &&
        selector.parameters.length === 1 &&
        ts.isIdentifier(selector.parameters[0].name) &&
        ts.isPropertyAccessExpression(selector.body) &&
        ts.isIdentifier(selector.body.expression) &&
        selector.body.expression.text === selector.parameters[0].name.text &&
        knownGetters.has(selector.body.name.text)
      ) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        issues.push({
          file: filePath,
          line,
          store: node.expression.text,
          method: selector.body.name.text,
          message: `Subscribing to getter "${selector.body.name.text}" via ${node.expression.text} — will NOT trigger re-renders (§5.3)`,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return issues;
}

// ── Pass 3: Whole-store subscriptions (warn-level) ──────────────────

/**
 * Find bare `useXxxStore()` calls (no selector): the component re-renders on
 * EVERY store change. Warn-level — reported, but never blocks the exit code.
 *
 * @param {string} source file contents
 * @param {string} filePath used in issue records
 * @returns {Array<{file:string,line:number,store:string,message:string}>}
 */
export function findWholeStoreSubscriptions(source, filePath) {
  const issues = [];
  const sf = parseSource(source, filePath);

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      STORE_HOOK_RE.test(node.expression.text) &&
      node.arguments.length === 0
    ) {
      const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
      issues.push({
        file: filePath,
        line,
        store: node.expression.text,
        message: `Whole-store subscription ${node.expression.text}() without selector — re-renders on every store change; subscribe to specific fields instead`,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return issues;
}

// ── Main ────────────────────────────────────────────────────────────

function listAppDirs() {
  /** @type {Array<{app:string, dir:string}>} */
  const out = [];
  for (const root of SCAN_ROOTS) {
    const rootDir = path.join(WORKSPACE, root);
    if (!fs.existsSync(rootDir)) continue;
    for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (appFilters.length > 0 && !appFilters.includes(entry.name)) continue;
      out.push({ app: entry.name, dir: path.join(rootDir, entry.name) });
    }
  }
  return out;
}

function run() {
  const appDirs = listAppDirs();

  const allStoreIssues = [];
  const allConsumerIssues = [];
  const allWholeStoreIssues = [];
  const appGetters = new Map(); // app -> Set<string>

  // Pass 1: store definitions (state.ts)
  for (const { app, dir } of appDirs) {
    const stateFile = path.join(dir, 'state.ts');
    if (!fs.existsSync(stateFile)) continue;

    const source = fs.readFileSync(stateFile, 'utf-8');
    const { issues, queryMethods } = findActionsInterfaces(source, path.relative(WORKSPACE, stateFile));
    allStoreIssues.push(...issues);
    if (queryMethods.size > 0) {
      appGetters.set(app, queryMethods);
    }
  }

  // Pass 2 + 3: consumers. Per-app getter sets only (no cross-app pollution).
  for (const { app, dir } of appDirs) {
    const getters = appGetters.get(app);
    const consumerFiles = collectFiles(dir, /\.(ts|tsx)$/).filter(
      f => path.basename(f) !== 'state.ts' && path.basename(f) !== 'navigation.declaration.ts',
    );
    for (const f of consumerFiles) {
      const source = fs.readFileSync(f, 'utf-8');
      const rel = path.relative(WORKSPACE, f);
      if (getters && getters.size > 0) {
        allConsumerIssues.push(...findGetterSubscriptions(source, rel, getters));
      }
      allWholeStoreIssues.push(...findWholeStoreSubscriptions(source, rel));
    }
  }

  // Output
  const errorCount = allStoreIssues.length + allConsumerIssues.length;
  const warnCount = allWholeStoreIssues.length;
  const exitCode = errorCount > 0 ? 1 : 0;

  if (jsonMode) {
    console.log(JSON.stringify({
      storeDefinitions: allStoreIssues,
      consumerSubscriptions: allConsumerIssues,
      wholeStoreSubscriptions: allWholeStoreIssues,
      summary: { errors: errorCount, warnings: warnCount, exitCode },
    }, null, 2));
    process.exit(exitCode);
  }

  if (errorCount === 0 && warnCount === 0) {
    console.log('✅ No store getter anti-patterns found.');
    process.exit(0);
  }

  if (allStoreIssues.length > 0) {
    console.log(`\n⛔ Store definitions — query getters in action interfaces (${allStoreIssues.length}):\n`);
    for (const issue of allStoreIssues) {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.message}\n`);
    }
  }

  if (allConsumerIssues.length > 0) {
    console.log(`⛔ Consumer subscriptions — subscribing to getter functions (${allConsumerIssues.length}):\n`);
    for (const issue of allConsumerIssues) {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.message}\n`);
    }
  }

  if (allWholeStoreIssues.length > 0) {
    console.log(`⚠️  WARN (non-blocking) — whole-store subscriptions without selector (${allWholeStoreIssues.length}):\n`);
    for (const issue of allWholeStoreIssues) {
      console.log(`  ${issue.file}:${issue.line}`);
      console.log(`    ${issue.message}\n`);
    }
  }

  if (errorCount > 0) {
    console.log(`Found ${errorCount} blocking issue(s) (+${warnCount} warning(s)). See docs/platform/state/model.md "Store actions: no query-style getters"`);
  } else {
    console.log(`Found ${warnCount} warning(s), no blocking issues.`);
  }
  process.exit(exitCode);
}

function collectFiles(dir, pattern) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        results.push(...collectFiles(full, pattern));
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(full);
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

// Only run when executed directly (not when imported as a module)
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isDirectRun) run();
