/**
 * Mirror Spotify seed-media URLs into the shared CDN data tree.
 *
 * Examples:
 *   node apps/Spotify/scripts/mirror_media_to_cdn.mjs --dry-run
 *   node apps/Spotify/scripts/mirror_media_to_cdn.mjs --download --rewrite
 *
 * Output files:
 *   mobilegym-data/spotify/images/<category>/<sha1>.<ext>
 *   mobilegym-data/spotify/images/manifest.json
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, extname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const DATA_ROOT = resolve(ROOT, 'mobilegym-data/spotify/images');
const MANIFEST_PATH = resolve(DATA_ROOT, 'manifest.json');

const args = new Set(process.argv.slice(2));
const shouldDownload = args.has('--download');
const shouldRewrite = args.has('--rewrite');
const dryRun = args.has('--dry-run') || (!shouldDownload && !shouldRewrite);
const concurrencyArg = process.argv.find(arg => arg.startsWith('--concurrency='));
const concurrency = Math.max(1, Number(concurrencyArg?.split('=')[1] ?? 8) || 8);

const FILES = [
  'apps/Spotify/constants.ts',
  'apps/Spotify/pages/CategoryPage.tsx',
  'apps/Spotify/pages/ShortVideoPage.tsx',
  'apps/Spotify/pages/WhatsNewPage.tsx',
  'apps/Spotify/data/defaults.json',
  'apps/Spotify/data/categories.json',
  'apps/Spotify/data/playlistTracks.json',
  'apps/Spotify/data/artistTracks.json',
  'apps/Spotify/data/searchResults.json',
  'apps/Spotify/data/albumTracks.json',
];

const IMAGE_HOSTS = new Set([
  'is1-ssl.mzstatic.com',
  'images.unsplash.com',
]);

const URL_RE = /https?:\/\/[^\s"'`<>)]*/g;

function categoryForFile(rel) {
  if (rel.endsWith('constants.ts') || rel.endsWith('data/categories.json')) return 'categories';
  if (rel.includes('/pages/ChooseArtistsPage') || rel.includes('/pages/LibraryPage') || rel.includes('/pages/SignupCompletePage')) return 'artists';
  if (rel.includes('/pages/ShortVideoPage') || rel.includes('/pages/CategoryPage')) return 'ui';
  if (rel.includes('/pages/WhatsNewPage')) return 'tracks';
  if (rel.endsWith('data/albumTracks.json')) return 'albums';
  if (rel.endsWith('data/artistTracks.json') || rel.endsWith('data/playlistTracks.json')) return 'tracks';
  if (rel.endsWith('data/searchResults.json')) return 'tracks';
  if (rel.endsWith('data/defaults.json')) return 'tracks';
  return 'misc';
}

function sha(input) {
  return createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function extensionFor(url, contentType = '') {
  const pathExt = extname(new URL(url).pathname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'].includes(pathExt)) return pathExt === '.jpeg' ? '.jpg' : pathExt;
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  if (contentType.includes('gif')) return '.gif';
  if (contentType.includes('avif')) return '.avif';
  return '.jpg';
}

function shouldMirror(raw) {
  try {
    return IMAGE_HOSTS.has(new URL(raw).host);
  } catch {
    return false;
  }
}

const urlCategories = new Map();
for (const rel of FILES) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(URL_RE)) {
    const raw = match[0];
    if (shouldMirror(raw)) urlCategories.set(raw, categoryForFile(rel));
  }
}

function readExistingManifest() {
  if (!existsSync(MANIFEST_PATH)) return { version: 2, assets: {}, sources: {} };
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return { version: 2, assets: {}, sources: {} };
  }
}

function buildSourceMap(rawManifest) {
  const sourceMap = {};
  if (rawManifest?.version === 2) {
    for (const [url, cdn] of Object.entries(rawManifest.sources || {})) {
      const asset = rawManifest.assets?.[cdn];
      if (asset?.file) sourceMap[url] = { file: asset.file, cdn };
    }
    return sourceMap;
  }
  for (const [url, entry] of Object.entries(rawManifest || {})) {
    if (entry?.file && entry?.cdn) sourceMap[url] = entry;
  }
  return sourceMap;
}

function buildManifest(sourceMap, existing) {
  const assets = existing?.version === 2 ? { ...(existing.assets || {}) } : {};
  const sources = existing?.version === 2 ? { ...(existing.sources || {}) } : {};
  for (const [url, entry] of Object.entries(sourceMap)) {
    const category = entry.file.split('/').at(-2) || 'misc';
    sources[url] = entry.cdn;
    const existingAsset = assets[entry.cdn] || {};
    const sourceUrls = new Set([...(existingAsset.sourceUrls || []), url]);
    assets[entry.cdn] = {
      ...existingAsset,
      file: entry.file,
      category,
      sourceUrls: [...sourceUrls].sort(),
    };
  }
  return {
    version: 2,
    layout: 'spotify/images/<category>/<hash>.<ext>',
    categories: ['tracks', 'albums', 'artists', 'playlists', 'categories', 'ui', 'misc', 'unreferenced'],
    assets,
    sources,
  };
}

const existingManifest = readExistingManifest();
const sourceMap = buildSourceMap(existingManifest);
for (const [url, category] of [...urlCategories.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const ext = extensionFor(url);
  const fileName = `${sha(url)}${ext}`;
  sourceMap[url] = {
    file: `spotify/images/${category}/${fileName}`,
    cdn: `/cdn/spotify/images/${category}/${fileName}`,
  };
}

console.log(`Spotify media URLs: ${urlCategories.size}`);
console.log(`Mode: ${dryRun ? 'dry-run' : [shouldDownload && 'download', shouldRewrite && 'rewrite'].filter(Boolean).join(' + ')}`);
if (shouldDownload) console.log(`Concurrency: ${concurrency}`);

if (shouldDownload) {
  mkdirSync(DATA_ROOT, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const entries = Object.entries(sourceMap);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < entries.length) {
      const [url, entry] = entries[nextIndex++];
      const out = resolve(ROOT, 'mobilegym-data', entry.file);
      if (existsSync(out)) {
        skipped += 1;
        continue;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const contentType = res.headers.get('content-type') || '';
      const ext = extensionFor(url, contentType);
      const finalEntry = ext === extname(out) ? entry : {
        file: entry.file.replace(/\.[^.]+$/, ext),
        cdn: entry.cdn.replace(/\.[^.]+$/, ext),
      };
      const finalOut = resolve(ROOT, 'mobilegym-data', finalEntry.file);
      mkdirSync(finalOut.slice(0, finalOut.lastIndexOf('/')), { recursive: true });
      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(finalOut, buffer);
      sourceMap[url] = finalEntry;
      downloaded += 1;
    } catch (error) {
      failed += 1;
      delete sourceMap[url];
      console.warn(`WARN download failed: ${url} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(buildManifest(sourceMap, existingManifest), null, 2)}\n`, 'utf8');
  console.log(`Downloaded ${downloaded}, skipped ${skipped}, failed ${failed}`);
}

if (shouldRewrite) {
  let filesChanged = 0;
  const rewriteEntries = Object.entries(sourceMap).filter(([, entry]) => existsSync(resolve(ROOT, 'mobilegym-data', entry.file)));
  for (const rel of FILES) {
    const file = resolve(ROOT, rel);
    if (!existsSync(file)) continue;
    const before = readFileSync(file, 'utf8');
    let after = before;
    for (const [url, entry] of rewriteEntries) {
      after = after.split(url).join(entry.cdn);
    }
    if (after !== before) {
      writeFileSync(file, after, 'utf8');
      filesChanged += 1;
    }
  }
  console.log(`Rewritten files: ${filesChanged}`);
}

if (dryRun) {
  const preview = Object.entries(sourceMap).slice(0, 10);
  for (const [url, entry] of preview) {
    console.log(`${url} -> ${entry.cdn}`);
  }
}
