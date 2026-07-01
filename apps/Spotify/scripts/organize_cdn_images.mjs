/**
 * Organize Spotify CDN images by usage and rebuild a complete manifest.
 *
 * Output layout:
 *   mobilegym-data/spotify/images/{tracks,albums,artists,playlists,categories,ui,misc,unreferenced}/<hash>.<ext>
 *   mobilegym-data/spotify/images/manifest.json
 */
import { createHash } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, extname, join, relative, resolve } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const APP_ROOT = resolve(ROOT, 'apps/Spotify');
const DATA_ROOT = resolve(ROOT, 'mobilegym-data/spotify/images');
const MANIFEST_PATH = resolve(DATA_ROOT, 'manifest.json');

const CDN_RE = /\/cdn\/spotify\/images\/[A-Za-z0-9_./-]+\.(?:jpe?g|png|webp|gif|avif|svg)/g;
const REMOTE_RE = /https?:\/\/[^\s"'`<>)]*/g;
const IMAGE_HOSTS = new Set(['is1-ssl.mzstatic.com', 'images.unsplash.com']);
const CATEGORY_PRIORITY = ['categories', 'artists', 'tracks', 'albums', 'playlists', 'ui', 'misc'];

function sha(input) {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function extensionFor(url) {
  const pathExt = extname(new URL(url).pathname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(pathExt)) {
    return pathExt === '.jpeg' ? '.jpg' : pathExt;
  }
  return '.jpg';
}

function shouldMirror(raw) {
  try {
    return IMAGE_HOSTS.has(new URL(raw).host);
  } catch {
    return false;
  }
}

function resizeAppleArtworkUrl(raw, size) {
  try {
    const url = new URL(raw);
    if (!url.hostname.includes('mzstatic.com')) return raw;
    url.pathname = url.pathname.replace(/\/\d+x\d+[^/]*\.(jpe?g|png|webp)$/i, `/${size}x${size}bb.$1`);
    return url.toString();
  } catch {
    return raw;
  }
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(ROOT, abs);
    if (rel.includes('/scripts/')) continue;
    if (statSync(abs).isDirectory()) {
      walkFiles(abs, out);
      continue;
    }
    if (/\.(json|ts|tsx)$/.test(name)) out.push(abs);
  }
  return out;
}

function listImageFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) {
      listImageFiles(abs, out);
      continue;
    }
    if (name === 'manifest.json') continue;
    if (/\.(jpe?g|png|webp|gif|avif|svg)$/i.test(name)) out.push(abs);
  }
  return out;
}

function categoryForUsage(rel, path = []) {
  const pathText = path.join('.');
  if (rel.endsWith('constants.ts')) return 'categories';
  if (rel.includes('/pages/ChooseArtistsPage') || rel.includes('/pages/LibraryPage') || rel.includes('/pages/SignupCompletePage')) return 'artists';
  if (rel.includes('/pages/WhatsNewPage')) return 'tracks';
  if (rel.includes('/pages/ShortVideoPage') || rel.includes('/pages/CategoryPage')) return 'ui';
  if (rel.endsWith('data/categories.json')) return 'categories';
  if (rel.endsWith('data/artistTracks.json') || rel.endsWith('data/playlistTracks.json')) return 'tracks';
  if (rel.endsWith('data/albumTracks.json')) return 'albums';
  if (rel.endsWith('data/searchResults.json')) {
    if (pathText.includes('.artists.')) return 'artists';
    if (pathText.includes('.albums.')) return 'albums';
    return 'tracks';
  }
  if (rel.endsWith('data/defaults.json')) {
    if (pathText.includes('libraryArtists') || pathText.includes('avatar')) return 'artists';
    if (pathText.includes('personalizedPlaylists') || pathText.includes('similarArtistSections') || pathText.includes('podcastData') || pathText.includes('wrappedData')) return 'playlists';
    return 'tracks';
  }
  return 'misc';
}

function chooseCategory(usages) {
  const categories = new Set(usages.map(usage => usage.category));
  return CATEGORY_PRIORITY.find(category => categories.has(category)) || 'misc';
}

function readHeadFile(rel) {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function collectSourceUrls(files) {
  const sourceByName = new Map();
  for (const abs of files) {
    const rel = relative(ROOT, abs);
    const text = `${readHeadFile(rel)}\n${readFileSync(abs, 'utf8')}`;
    for (const match of text.matchAll(REMOTE_RE)) {
      const url = match[0];
      if (!shouldMirror(url)) continue;
      const urls = new Set([url]);
      if (url.includes('mzstatic.com')) {
        urls.add(resizeAppleArtworkUrl(url, 100));
        urls.add(resizeAppleArtworkUrl(url, 600));
        urls.add(resizeAppleArtworkUrl(url, 1000));
      }
      for (const candidate of urls) {
        const fileName = `${sha(candidate)}${extensionFor(candidate)}`;
        const list = sourceByName.get(fileName) || [];
        if (!list.includes(candidate)) list.push(candidate);
        sourceByName.set(fileName, list);
      }
    }
  }
  return sourceByName;
}

function addUsage(assetMap, cdn, usage) {
  const fileName = cdn.split('/').pop();
  const entry = assetMap.get(fileName) || { usages: [], refs: new Set() };
  const ref = `${usage.file}:${usage.path || usage.line || ''}`;
  if (!entry.refs.has(ref)) {
    entry.refs.add(ref);
    entry.usages.push(usage);
  }
  assetMap.set(fileName, entry);
}

function walkJson(value, rel, assetMap, path = []) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(CDN_RE)) {
      addUsage(assetMap, match[0], {
        file: rel,
        path: path.join('.'),
        category: categoryForUsage(rel, path),
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, rel, assetMap, [...path, String(index)]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walkJson(child, rel, assetMap, [...path, key]);
    }
  }
}

function collectUsages(files) {
  const assetMap = new Map();
  for (const abs of files) {
    const rel = relative(ROOT, abs);
    const text = readFileSync(abs, 'utf8');
    if (rel.endsWith('.json')) {
      walkJson(JSON.parse(text), rel, assetMap);
      continue;
    }
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(CDN_RE)) {
        addUsage(assetMap, match[0], {
          file: rel,
          line: index + 1,
          category: categoryForUsage(rel),
        });
      }
    });
  }
  return assetMap;
}

function rewriteFiles(files, pathMap) {
  let changed = 0;
  for (const abs of files) {
    const before = readFileSync(abs, 'utf8');
    let after = before;
    for (const [oldCdn, newCdn] of pathMap) {
      after = after.split(oldCdn).join(newCdn);
    }
    if (after !== before) {
      writeFileSync(abs, after, 'utf8');
      changed += 1;
    }
  }
  return changed;
}

function moveImage(abs, category) {
  const fileName = abs.split('/').pop();
  const destDir = resolve(DATA_ROOT, category);
  const dest = resolve(destDir, fileName);
  if (abs === dest) return dest;
  mkdirSync(destDir, { recursive: true });
  if (!existsSync(dest)) renameSync(abs, dest);
  return dest;
}

const files = walkFiles(APP_ROOT);
const assetMap = collectUsages(files);
const sourceByName = collectSourceUrls(files);
const pathMap = new Map();
const assets = {};

for (const [fileName, entry] of [...assetMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const category = chooseCategory(entry.usages);
  const oldCdn = `/cdn/spotify/images/${fileName}`;
  const newCdn = `/cdn/spotify/images/${category}/${fileName}`;
  pathMap.set(oldCdn, newCdn);
  assets[newCdn] = {
    file: `spotify/images/${category}/${fileName}`,
    category,
    sourceUrls: sourceByName.get(fileName) || [],
    usages: entry.usages.map(({ file, line, path, category }) => ({ file, ...(line ? { line } : {}), ...(path ? { path } : {}), category })),
  };
}

const changedFiles = rewriteFiles(files, pathMap);

let moved = 0;
for (const abs of listImageFiles(DATA_ROOT)) {
  const rel = relative(DATA_ROOT, abs);
  if (rel.includes('/')) continue;
  const fileName = rel;
  const entry = assetMap.get(fileName);
  const category = entry ? chooseCategory(entry.usages) : 'unreferenced';
  const dest = moveImage(abs, category);
  if (dest !== abs) moved += 1;
}

const sources = {};
for (const [cdn, entry] of Object.entries(assets)) {
  for (const sourceUrl of entry.sourceUrls) {
    sources[sourceUrl] = cdn;
  }
}

const manifest = {
  version: 2,
  layout: 'spotify/images/<category>/<hash>.<ext>',
  categories: ['tracks', 'albums', 'artists', 'playlists', 'categories', 'ui', 'misc', 'unreferenced'],
  assets,
  sources,
};

writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Referenced assets: ${Object.keys(assets).length}`);
console.log(`Files rewritten: ${changedFiles}`);
console.log(`Images moved: ${moved}`);
console.log(`Manifest assets: ${Object.keys(manifest.assets).length}`);
console.log(`Manifest source URLs: ${Object.keys(manifest.sources).length}`);
