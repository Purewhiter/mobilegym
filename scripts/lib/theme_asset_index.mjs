/**
 * Shared logic for WMR bundle asset indexes (assets-index.json).
 *
 * Real-device MAML widgets ship as zip packages whose central directory *is*
 * the file inventory — the engine never probes. Our replica flattens those
 * packages into plain HTTP directories, losing the inventory; the asset index
 * restores it. Two providers keep it maintenance-free:
 *   - vite dev/preview: the /cdn middleware answers assets-index.json
 *     requests on the fly by scanning the bundle directory (no files written)
 *   - nginx (production): scripts/gen_theme_asset_index.mjs pre-generates
 *     static files (wired into start_nginx_gateway.sh)
 */
import fs from 'node:fs';
import path from 'node:path';

export const INDEX_NAME = 'assets-index.json';
const IGNORED = new Set([INDEX_NAME, '.DS_Store', 'Thumbs.db']);

/** Recursively list files under dir as sorted posix-style relative paths. */
export function listBundleFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || IGNORED.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listBundleFiles(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

/** Serialized index payload for a bundle directory (stable across runs). */
export function buildIndexPayload(bundleDir) {
  return JSON.stringify({ v: 1, files: listBundleFiles(bundleDir) });
}

/** A directory qualifies as a WMR bundle iff it holds a manifest.xml. */
export function isBundleDir(dir) {
  try {
    return fs.statSync(path.join(dir, 'manifest.xml')).isFile();
  } catch {
    return false;
  }
}
