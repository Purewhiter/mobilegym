#!/usr/bin/env node
/**
 * Generate assets-index.json for every WMR bundle directory in the theme data pack.
 *
 * Why: MAML widget bundles have no file index. Without one, the WMR engine has
 * to discover frame counts / locale files by probing (requesting URLs until
 * they 404). With an index, the engine loads exactly the files that exist and
 * theme-related 404s drop to zero (see os/wmr/engine/assetIndex.ts).
 *
 * A "WMR bundle directory" is any directory containing a manifest.xml under
 * <themes-root>/<themeId>/ (e.g. widget_2x2/, clock_2x4/).
 *
 * Usage:
 *   node scripts/gen_theme_asset_index.mjs [--root <path-to-mobilegym-data>] [--check]
 *
 * Defaults to ./mobilegym-data (the symlinked data pack). Idempotent: output
 * is a sorted file list, so re-running produces byte-identical results.
 * --check exits 1 if any index is missing or stale (for CI / preflight).
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const INDEX_NAME = 'assets-index.json';
const IGNORED = new Set([INDEX_NAME, '.DS_Store', 'Thumbs.db']);

function parseArgs(argv) {
  const args = { root: 'mobilegym-data', check: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--root') args.root = argv[++i];
    else if (argv[i] === '--check') args.check = true;
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(2);
    }
  }
  return args;
}

/** Recursively list files under dir as sorted posix-style relative paths. */
function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Find every directory containing a manifest.xml under root (bundle dirs). */
function findBundleDirs(root) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'manifest.xml')) {
      found.push(dir);
      return; // bundles do not nest
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith('.')) walk(path.join(dir, e.name));
    }
  };
  walk(root);
  return found.sort();
}

const args = parseArgs(process.argv);
const themesRoot = path.resolve(args.root, 'themes');
if (!fs.existsSync(themesRoot)) {
  console.error(`themes root not found: ${themesRoot} (pass --root <path-to-mobilegym-data>)`);
  process.exit(1);
}

const bundleDirs = findBundleDirs(themesRoot);
let written = 0;
let unchanged = 0;
let stale = 0;

for (const dir of bundleDirs) {
  const files = listFiles(dir);
  const payload = JSON.stringify({ v: 1, files });
  const target = path.join(dir, INDEX_NAME);
  const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
  if (existing === payload) {
    unchanged++;
    continue;
  }
  if (args.check) {
    stale++;
    console.error(`[stale] ${path.relative(themesRoot, target)}`);
    continue;
  }
  fs.writeFileSync(target, payload);
  written++;
  console.log(`[write] ${path.relative(themesRoot, target)} (${files.length} files)`);
}

console.log(
  `${bundleDirs.length} bundle dir(s): ${written} written, ${unchanged} up-to-date` +
    (args.check ? `, ${stale} stale/missing` : ''),
);
if (args.check && stale > 0) process.exit(1);
