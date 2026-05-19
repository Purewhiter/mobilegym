#!/usr/bin/env node
/**
 * lint_store_getters.mjs
 *
 * Detects query-like getter functions defined in Zustand store actions.
 * These have stable references — subscribing via useStore(s => s.isLiked)
 * will NOT trigger re-renders when the underlying data changes.
 *
 * Two-pass analysis:
 *   Pass 1 — Store definitions: finds query-like methods in *Actions interfaces
 *   Pass 2 — Consumer subscriptions: finds useXxxStore(s => s.<getter>) in .tsx files
 *
 * See docs/platform/state-model.md "Store actions: no query-style getters"
 *
 * Usage:
 *   node scripts/lint_store_getters.mjs              # scan all apps
 *   node scripts/lint_store_getters.mjs Spotify X    # scan specific apps
 *   node scripts/lint_store_getters.mjs --json       # JSON output
 */
import fs from 'fs';
import path from 'path';

const WORKSPACE = process.cwd();
const APPS_DIR = path.join(WORKSPACE, 'apps');

export const QUERY_PREFIXES = ['is', 'get', 'check', 'has'];
export const SAFE_NAMES = new Set([
  'isPlaying', 'isLoggedIn', 'isLoading', 'isEditing', 'isRecording',
  'isExpanded', 'isVisible', 'isMuted', 'isPaused', 'isOpen',
]);

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const appFilters = args.filter(a => !a.startsWith('--'));

// ── Pass 1: Scan store definitions ──────────────────────────────────

export function findActionsInterfaces(source, filePath) {
  const issues = [];
  const queryMethods = new Set();

  // [^{]* allows extends / implements clauses between name and opening brace
  const interfaceRe = /interface\s+(\w*Actions\w*)\b[^{]*\{/g;
  let match;
  while ((match = interfaceRe.exec(source)) !== null) {
    const ifaceName = match[1];
    const startIdx = match.index + match[0].length;

    let depth = 1;
    let i = startIdx;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    const body = source.slice(startIdx, i - 1);

    // [\s\S]*? handles multi-line parameter lists (non-greedy stops at first `)`).
    // Optional <...> before ( handles generic methods like getX: <T>(k: string) => T
    const methodRe = /^\s+(\w+)\s*:\s*(?:<[^>]*>\s*)?\(([\s\S]*?)\)\s*=>\s*(\S+)/gm;
    let mMatch;
    while ((mMatch = methodRe.exec(body)) !== null) {
      const name = mMatch[1];
      const returnType = mMatch[3].replace(/[;,]$/, '');

      if (returnType === 'void') continue;
      if (SAFE_NAMES.has(name)) continue;

      const isQuery = QUERY_PREFIXES.some(prefix => {
        if (!name.startsWith(prefix)) return false;
        const charAfter = name[prefix.length];
        return charAfter && charAfter === charAfter.toUpperCase();
      });

      if (isQuery) {
        const lineNum = source.slice(0, startIdx + mMatch.index).split('\n').length;
        issues.push({
          file: filePath,
          line: lineNum,
          method: name,
          iface: ifaceName,
          returnType,
          message: `Query getter "${name}" in ${ifaceName} — should be a memoSelector or derived in component (§5.3)`,
        });
        queryMethods.add(name);
      }
    }
  }

  return { issues, queryMethods };
}

// ── Pass 2: Scan consumer subscriptions ─────────────────────────────

export function findGetterSubscriptions(source, filePath, knownGetters) {
  const issues = [];
  if (knownGetters.size === 0) return issues;

  const getterPattern = [...knownGetters].map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  // Accept any single identifier as the arrow param (not just s/state/st)
  const re = new RegExp(
    `(use\\w+Store)\\(\\s*(\\w+)\\s*=>\\s*\\2\\.(${getterPattern})\\s*\\)`,
    'g',
  );

  let match;
  while ((match = re.exec(source)) !== null) {
    const lineNum = source.slice(0, match.index).split('\n').length;
    issues.push({
      file: filePath,
      line: lineNum,
      store: match[1],
      method: match[3],
      message: `Subscribing to getter "${match[3]}" via ${match[1]} — will NOT trigger re-renders (§5.3)`,
    });
  }

  return issues;
}

// ── Main ────────────────────────────────────────────────────────────

function run() {
  const appDirs = fs.readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .filter(d => appFilters.length === 0 || appFilters.includes(d.name))
    .map(d => d.name);

  const allStoreIssues = [];
  const allConsumerIssues = [];
  const appGetters = new Map(); // app -> Set<string>

  // Pass 1
  for (const app of appDirs) {
    const stateFile = path.join(APPS_DIR, app, 'state.ts');
    if (!fs.existsSync(stateFile)) continue;

    const source = fs.readFileSync(stateFile, 'utf-8');
    const { issues, queryMethods } = findActionsInterfaces(source, path.relative(WORKSPACE, stateFile));
    allStoreIssues.push(...issues);
    if (queryMethods.size > 0) {
      appGetters.set(app, queryMethods);
    }
  }

  // Pass 2: scan each app's consumers using ONLY that app's getters (no cross-app pollution)
  for (const app of appDirs) {
    const getters = appGetters.get(app);
    if (!getters || getters.size === 0) continue;

    const appDir = path.join(APPS_DIR, app);
    const tsxFiles = collectFiles(appDir, /\.tsx$/);
    for (const f of tsxFiles) {
      const source = fs.readFileSync(f, 'utf-8');
      const issues = findGetterSubscriptions(source, path.relative(WORKSPACE, f), getters);
      allConsumerIssues.push(...issues);
    }
  }

  // Output
  const totalIssues = allStoreIssues.length + allConsumerIssues.length;

  if (jsonMode) {
    console.log(JSON.stringify({ storeDefinitions: allStoreIssues, consumerSubscriptions: allConsumerIssues }, null, 2));
    process.exit(totalIssues > 0 ? 1 : 0);
  }

  if (totalIssues === 0) {
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

  console.log(`Found ${totalIssues} issue(s). See docs/platform/state-model.md "Store actions: no query-style getters"`);
  process.exit(1);
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
