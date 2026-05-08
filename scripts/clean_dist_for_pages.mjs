#!/usr/bin/env node
/**
 * Strip dev-only artifacts from `dist/` before publishing to GitHub Pages.
 *
 * What gets removed:
 *   - *_nav_graph.json / *_nav_graph_simplified.json
 *   - *_data_graph.json
 *   - *_action_tasks.json / *_action_tasks_data.json
 *   - *_dynamic_graph.json / wechat_graph.json
 *   - dev viewer HTMLs: nav_graph_viewer.html, ui_graph_viewer.html,
 *                       run_explorer.html, map-demo.html
 *
 * These files live in `public/` because the dev workflow's HTML viewers fetch them.
 * They are not referenced by simulator runtime, so they're safe to omit from
 * the public deployment.
 *
 * Usage:
 *   node scripts/clean_dist_for_pages.mjs           # cleans ./dist
 *   node scripts/clean_dist_for_pages.mjs <dir>     # cleans <dir>
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const targetDir = path.resolve(repoRoot, process.argv[2] ?? 'dist');

if (!fs.existsSync(targetDir)) {
  console.error(`✘ Target directory not found: ${targetDir}`);
  process.exit(1);
}

const PATTERNS = [
  /_nav_graph(_simplified)?\.json$/,
  /_data_graph\.json$/,
  /_action_tasks(_data)?\.json$/,
  /_dynamic_graph\.json$/,
  /^wechat_graph\.json$/,
];

const NAMED_FILES = new Set([
  'nav_graph_viewer.html',
  'ui_graph_viewer.html',
  'run_explorer.html',
  'map-demo.html',
]);

const deleted = [];
let bytesFreed = 0;

for (const entry of fs.readdirSync(targetDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const matchesPattern = PATTERNS.some((p) => p.test(entry.name));
  const matchesNamed = NAMED_FILES.has(entry.name);
  if (!matchesPattern && !matchesNamed) continue;

  const filePath = path.join(targetDir, entry.name);
  const size = fs.statSync(filePath).size;
  fs.unlinkSync(filePath);
  deleted.push({ name: entry.name, size });
  bytesFreed += size;
}

deleted.sort((a, b) => b.size - a.size);

const fmt = (n) => {
  if (n > 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n > 1e3) return `${(n / 1e3).toFixed(1)} KB`;
  return `${n} B`;
};

console.log(`Cleaning: ${path.relative(repoRoot, targetDir)}`);
console.log(`Removed ${deleted.length} files, freed ${fmt(bytesFreed)}\n`);
for (const { name, size } of deleted.slice(0, 15)) {
  console.log(`  ${fmt(size).padStart(8)}  ${name}`);
}
if (deleted.length > 15) {
  console.log(`  ... and ${deleted.length - 15} more`);
}
