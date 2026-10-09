#!/usr/bin/env node
/**
 * Pre-generate static assets-index.json files for WMR bundle directories.
 *
 * Only needed for static-file servers (nginx production path — wired into
 * start_nginx_gateway.sh). vite dev/preview serve the index dynamically via
 * the /cdn middleware and need no generated files. See
 * scripts/lib/theme_asset_index.mjs for background.
 *
 * Usage:
 *   node scripts/gen_theme_asset_index.mjs [--root <path-to-mobilegym-data>] [--check]
 *
 * Idempotent (sorted output). --check exits 1 if any index is missing/stale.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { INDEX_NAME, buildIndexPayload, isBundleDir } from './lib/theme_asset_index.mjs';

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

/** Find every bundle directory (manifest.xml holder) under root. */
function findBundleDirs(root) {
  const found = [];
  const walk = (dir) => {
    if (isBundleDir(dir)) {
      found.push(dir);
      return; // bundles do not nest
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
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
  const payload = buildIndexPayload(dir);
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
  console.log(`[write] ${path.relative(themesRoot, target)}`);
}

console.log(
  `${bundleDirs.length} bundle dir(s): ${written} written, ${unchanged} up-to-date` +
    (args.check ? `, ${stale} stale/missing` : ''),
);
if (args.check && stale > 0) process.exit(1);
