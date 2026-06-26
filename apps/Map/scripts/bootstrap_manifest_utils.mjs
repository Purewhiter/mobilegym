import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export const BOOTSTRAP_MANIFEST_FILTER = 'all vector manifest entries except maps.googleapis.com/maps/vt tile payloads';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isVectorTilePayloadUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return (
      url.host === 'maps.googleapis.com'
      && (
        (url.pathname === '/maps/vt' && url.searchParams.has('pb'))
        || url.pathname.startsWith('/maps/vt/pb=')
      )
    );
  } catch {
    return false;
  }
}

export function makeVectorBootstrapEntries(entries) {
  // bootstrap-manifest.json is derived from the full vector manifest. It keeps
  // startup resources such as SDK chunks, fonts, styles, configs, and vt icons,
  // but excludes /maps/vt tile payloads so service worker install never has to
  // parse the full 50k+ entry vector manifest.
  return (entries || [])
    .filter((entry) => entry?.url && entry?.file && !isVectorTilePayloadUrl(entry.url))
    .sort((a, b) => a.url.localeCompare(b.url));
}

export function makeBootstrapCacheName(entries) {
  const seed = entries
    .map((entry) => [
      entry.url,
      entry.file,
      entry.status,
      entry.size,
      entry.bodyHash,
    ].join('\t'))
    .join('\n');
  const hash = createHash('sha1').update(seed).digest('hex').slice(0, 12);
  return `map-bootstrap-cache-${hash}`;
}

export function writeVectorBootstrapManifest({
  entries,
  outputPath,
  source,
  sourceCacheName,
}) {
  const bootstrapEntries = makeVectorBootstrapEntries(entries);
  const cacheName = makeBootstrapCacheName(bootstrapEntries);
  const manifest = {
    version: 1,
    source,
    sourceCacheName,
    cacheName,
    filter: BOOTSTRAP_MANIFEST_FILTER,
    entries: bootstrapEntries,
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
  return { cacheName, entries: bootstrapEntries, manifest };
}

export function updateServiceWorkerCacheName({
  swPath,
  constName,
  cacheName,
  prefix,
  logPrefix,
  preserveExistingSuffix = true,
}) {
  if (!existsSync(swPath)) {
    console.warn(`${logPrefix} 未找到 ${swPath}，无法同步 ${constName}`);
    return false;
  }
  const src = readFileSync(swPath, 'utf-8');
  const pattern = new RegExp(`const ${constName} = '(${escapeRegExp(prefix)}[0-9a-f]{12})([^']*)';`);
  let nextCacheName = cacheName;
  const next = src.replace(pattern, (_match, _oldCacheName, suffix) => {
    // The manifest hash captures data changes; any suffix after the hash is a
    // code-level invalidation marker such as "-swiftshader-v2". Preserve it so
    // data refresh scripts do not accidentally re-enable stale patched caches.
    nextCacheName = preserveExistingSuffix ? `${cacheName}${suffix || ''}` : cacheName;
    return `const ${constName} = '${nextCacheName}';`;
  });
  if (next === src) {
    console.warn(`${logPrefix} 未能在 map-sw.js 中找到 ${constName}，跳过同步`);
    return false;
  }
  writeFileSync(swPath, next);
  console.log(`${logPrefix} map-sw.js ${constName} -> ${nextCacheName}`);
  return true;
}
