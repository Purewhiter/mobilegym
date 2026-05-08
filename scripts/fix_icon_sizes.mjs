#!/usr/bin/env node
/**
 * scripts/fix_icon_sizes.mjs
 *
 * Replaces hardcoded `size={N}` JSX props with `size={dimens.icSizeXxx}` references.
 *
 * Strategy:
 *  1. For each app, read res/dimens.ts → build reverse map: number → constant name
 *  2. Only replace when the mapping is UNAMBIGUOUS (value belongs to exactly one constant)
 *     - Ambiguous cases (e.g. icSizeTab=24 AND icSizeNav=24) are skipped and reported
 *  3. Add `import { dimens }` to files that use it but don't yet import it
 *  4. Sizes not in dimens at all are left untouched and reported
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPS_DIR = resolve(__dirname, '..', 'apps');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAppDirs() {
  return readdirSync(APPS_DIR)
    .map(name => ({ name, path: join(APPS_DIR, name) }))
    .filter(({ path }) => {
      try { return statSync(path).isDirectory(); } catch { return false; }
    });
}

/**
 * Parse res/dimens.ts → Map<number, Set<constantName>>
 * Multiple constants can share the same numeric value.
 */
function getDimensMap(appDir) {
  const dimensPath = join(appDir, 'res', 'dimens.ts');
  if (!existsSync(dimensPath)) return new Map();

  const content = readFileSync(dimensPath, 'utf-8');
  const map = new Map(); // number → Set<string>

  const re = /\b(icSize\w+)\s*:\s*(\d+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const [, name, val] = m;
    const n = parseInt(val, 10);
    if (!map.has(n)) map.set(n, new Set());
    map.get(n).add(name);
  }
  return map;
}

/**
 * Build an unambiguous reverse map (unique value → single name).
 * Returns [reverseMap, ambiguousMap].
 */
function buildReverseMap(dimensMap) {
  const reverseMap = new Map(); // number → constName
  const ambiguous  = new Map(); // number → Set<constName>

  for (const [n, names] of dimensMap) {
    if (names.size === 1) reverseMap.set(n, [...names][0]);
    else                  ambiguous.set(n, names);
  }
  return [reverseMap, ambiguous];
}

/** Walk an app dir, skipping res/ and node_modules/, collecting .tsx/.ts files. */
function getTsxFiles(appDir) {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry !== 'res' && entry !== 'node_modules') walk(full);
      } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
        files.push(full);
      }
    }
  }
  walk(appDir);
  return files;
}

/**
 * Insert a new import line after the last `from '...';` in the file.
 */
function injectImport(content, importLine) {
  // Find the last `from 'xxx';` or `from "xxx";` — marks the end of any import stmt.
  const fromRe = /from\s+['"][^'"]+['"]\s*;/g;
  let last = null, m;
  while ((m = fromRe.exec(content)) !== null) last = m;

  if (last) {
    const insertPos = last.index + last[0].length;
    // Skip past the newline that follows
    const nl = content[insertPos] === '\n' ? 1 : 0;
    return (
      content.slice(0, insertPos + nl) +
      importLine + '\n' +
      content.slice(insertPos + nl)
    );
  }
  // No imports found — prepend
  return importLine + '\n' + content;
}

/** Process a single file. Returns stats. */
function processFile(filePath, reverseMap, appDir) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;
  const used    = new Set();
  const unmapped = new Set();

  // Replace `size={N}` (literal integer only, not already-replaced `size={dimens.xxx}`)
  content = content.replace(/\bsize=\{(\d+)\}/g, (match, numStr) => {
    const n = parseInt(numStr, 10);
    const name = reverseMap.get(n);
    if (name) { used.add(name); return `size={dimens.${name}}`; }
    unmapped.add(n);
    return match;
  });

  if (used.size === 0) return { changed: false, unmapped: [...unmapped] };

  // Add import if dimens is not already imported
  const alreadyImported = content
    .split('\n')
    .some(l => l.trimStart().startsWith('import') && l.includes('dimens'));

  if (!alreadyImported) {
    const rel = relative(dirname(filePath), join(appDir, 'res', 'dimens'))
      .replace(/\\/g, '/');
    const importPath = rel.startsWith('.') ? rel : './' + rel;
    content = injectImport(content, `import { dimens } from '${importPath}';`);
  }

  if (content !== original) writeFileSync(filePath, content, 'utf-8');
  return { changed: content !== original, used: [...used], unmapped: [...unmapped] };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

let totalFiles = 0;
const globalUnmapped  = new Map(); // size  → total count across all apps
const globalAmbiguous = [];        // { app, num, names }

for (const { name: appName, path: appDir } of getAppDirs()) {
  const dimensMap = getDimensMap(appDir);
  if (dimensMap.size === 0) continue; // stub app — skip

  const [reverseMap, ambiguous] = buildReverseMap(dimensMap);

  for (const [num, names] of ambiguous) {
    globalAmbiguous.push({ app: appName, num, names: [...names] });
  }

  const files = getTsxFiles(appDir);
  let appChanged = 0;

  for (const file of files) {
    try {
      const res = processFile(file, reverseMap, appDir);
      if (res.changed) appChanged++;
      for (const n of res.unmapped ?? []) {
        globalUnmapped.set(n, (globalUnmapped.get(n) ?? 0) + 1);
      }
    } catch (err) {
      console.error(`  ERROR: ${file}\n  ${err.message}`);
    }
  }

  if (appChanged > 0) console.log(`✓ ${appName}: ${appChanged} file(s) updated`);
  totalFiles += appChanged;
}

// ─── Report ───────────────────────────────────────────────────────────────────

console.log(`\n━━━ done: ${totalFiles} file(s) changed ━━━`);

if (globalAmbiguous.length > 0) {
  console.log('\n⚠️  Ambiguous (same value → multiple constants, NOT auto-replaced):');
  for (const { app, num, names } of globalAmbiguous) {
    console.log(`   ${app}: size={${num}} → could be ${names.join(' | ')}`);
  }
}

if (globalUnmapped.size > 0) {
  console.log('\n⚠️  Unmapped (no matching dimens constant, left as-is):');
  const sorted = [...globalUnmapped.entries()].sort((a, b) => b[1] - a[1]);
  for (const [size, count] of sorted) {
    console.log(`   size={${size}}: ${count} occurrence(s)`);
  }
}
