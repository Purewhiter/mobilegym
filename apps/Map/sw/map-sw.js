/**
 * Map App Service Worker
 *
 * 拦截 Google Maps 相关域名的请求，命中本地快照则返回，未命中再走网络。
 * 快照内容来自 CDN 数据根：
 *   - vector: <CDN>/map/vector/manifest.json + <CDN>/map/vector/files/*
 *   - raster: <CDN>/map/cache/manifest.json + <CDN>/map/cache/files/*
 * 旧的 /map-vector-cache、/map-cache 仅作为本地开发 fallback。
 *
 * 生命周期:
 *   install  → 预热 manifest 索引，不批量灌 CacheStorage
 *   activate → 立即接管所有客户端
 *   fetch    → INTERCEPT_HOSTS 域名走 CacheStorage / manifest 文件优先；其他域名透传
 */

const VECTOR_CACHE_NAME = 'map-vector-cache-57ee9905a655';
const RASTER_CACHE_NAME = 'map-cache-786a79e6b3e1';
const SW_BASE = new URL('.', self.location.href).href;
const CDN_BASE = resolveCdnBase();
const VECTOR_CACHE_SOURCES = [
  { manifestUrl: CDN_BASE + 'map/vector/manifest.json', filesBase: CDN_BASE + 'map/vector/files/' },
  { manifestUrl: SW_BASE + 'map-vector-cache/manifest.json', filesBase: SW_BASE + 'map-vector-cache/files/' },
];
const RASTER_CACHE_SOURCES = [
  { manifestUrl: CDN_BASE + 'map/cache/manifest.json', filesBase: CDN_BASE + 'map/cache/files/' },
  { manifestUrl: SW_BASE + 'map-cache/manifest.json', filesBase: SW_BASE + 'map-cache/files/' },
];
const OFFLINE_GOOGLE_MAPS_API_KEY = 'AIzaSyOfflineMapCacheOnly00000000000000';
let googleNetworkOfflineOnly = false;
let vectorManifestIndexPromise = null;
let rasterManifestIndexPromise = null;

const INTERCEPT_HOSTS = new Set([
  'maps.googleapis.com',
  'maps.gstatic.com',
  'www.gstatic.com',
  'mts0.googleapis.com',
  'mts1.googleapis.com',
  'khms0.googleapis.com',
  'khms1.googleapis.com',
  'khms2.googleapis.com',
  'khms3.googleapis.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'lh3.googleusercontent.com',
  'streetviewpixels-pa.googleapis.com',
]);

self.addEventListener('install', (event) => {
  // install 必须永远 resolve。这里只预热 manifest 索引，不再一次性 fetch 5 万+
  // vector 文件；真实地图资源在 fetch 阶段按需从 manifest.filesBase 读取并回填
  // CacheStorage。这样无 key 首次启动不会卡在超大批量预缓存上。
  event.waitUntil(
    Promise.all([
      loadVectorManifestIndex(),
      loadRasterManifestIndex(),
    ])
      .catch((err) => {
        console.warn('[map-sw] manifest 索引预热异常，后续请求会重试', err);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // 只清理本 SW 自己管理的旧版本缓存，不要碰别人的 cache。
  // 否则同源里其它 app 或将来 OS 自己注册的 CacheStorage 会被这里 wipe 掉。
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => (
          (k.startsWith('map-cache-') && k !== RASTER_CACHE_NAME)
          || (k.startsWith('map-vector-cache-') && k !== VECTOR_CACHE_NAME)
        ))
        .map((k) => caches.delete(k)),
    )),
    self.clients.claim(),
  ]));
});

self.addEventListener('fetch', (event) => {
  let url;
  try {
    url = new URL(event.request.url);
  } catch {
    return;
  }
  if (!INTERCEPT_HOSTS.has(url.host)) return;
  event.respondWith(handleRequest(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'MAP_GOOGLE_NETWORK_MODE') {
    googleNetworkOfflineOnly = Boolean(event.data.offlineOnly);
  }
});

/**
 * 把 URL 规范化为缓存键：剥掉 volatile 参数，并按字母序排序其它 query。
 * Google Maps loader / tile / static map 的 URL 都把 API key 拼在 query 里，但
 * 同一份缓存内容对任何 key 值都有效（host+path+其它 query 一致即可）。同时排序
 * query 避免 SDK 不同版本生成 URL 时参数顺序不同导致缓存 miss。
 *
 * 矢量瓦片 URL 内的 tile epoch 会变（例如 !2sm!3i123 / !28i456），但同一
 * x/y/z 的离线文件仍应命中，所以这里把 epoch 归一化。
 */
function canonicalUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.delete('key');
    u.searchParams.delete('token');
    if (isGoogleMapsJsonpPath(u.pathname)) {
      u.searchParams.delete('callback');
    }
    if (u.pathname === '/maps/vt' && u.searchParams.has('pb')) {
      u.searchParams.set('pb', normalizeTilePb(u.searchParams.get('pb') || ''));
    } else if (u.pathname.startsWith('/maps/vt/pb=')) {
      u.pathname = normalizeTilePb(u.pathname);
    }
    const sorted = [...u.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    u.search = new URLSearchParams(sorted).toString();
    return u.toString();
  } catch {
    return rawUrl;
  }
}

function normalizeTilePb(value) {
  return value
    .replace(/(!2sm!3i)\d+/g, '$1E')
    .replace(/(!28i)\d+/g, '$1E');
}

function isGoogleMapsJsonpPath(pathname) {
  return pathname.startsWith('/maps/api/js/jsonp/');
}

function resolveCdnBase() {
  try {
    const raw = new URL(self.location.href).searchParams.get('cdnBase') || '/cdn';
    const trimmed = raw.trim().replace(/\/+$/, '') || '/cdn';
    return new URL(`${trimmed}/`, self.location.origin).href;
  } catch {
    return new URL('/cdn/', self.location.origin).href;
  }
}

function loadVectorManifestIndex() {
  if (!vectorManifestIndexPromise) {
    vectorManifestIndexPromise = loadManifestIndex(VECTOR_CACHE_SOURCES)
      .catch((err) => {
        vectorManifestIndexPromise = null;
        throw err;
      });
  }
  return vectorManifestIndexPromise;
}

function loadRasterManifestIndex() {
  if (!rasterManifestIndexPromise) {
    rasterManifestIndexPromise = loadManifestIndex(RASTER_CACHE_SOURCES)
      .catch((err) => {
        rasterManifestIndexPromise = null;
        throw err;
      });
  }
  return rasterManifestIndexPromise;
}

async function loadManifestIndex(sources) {
  for (const source of sources) {
    try {
      const res = await fetch(source.manifestUrl, { cache: 'no-cache' });
      if (!res.ok) continue;
      const manifest = await res.json();
      const entries = manifest && Array.isArray(manifest.entries) ? manifest.entries : [];
      if (entries.length === 0) continue;

      const index = new Map();
      for (const entry of entries) {
        if (!entry || !entry.url || !entry.file) continue;
        index.set(canonicalUrl(entry.url), { ...entry, filesBase: source.filesBase });
      }
      return index;
    } catch {
      // Try the next source.
    }
  }
  throw new Error('No usable map manifest source');
}

async function matchManifestBackedCache(cacheName, loadIndex, cacheKey) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let index;
  try {
    index = await loadIndex();
  } catch {
    return null;
  }
  const entry = index.get(cacheKey);
  if (!entry) return null;

  const response = await responseFromManifestEntry(entry);
  if (!response) return null;
  try {
    await cache.put(cacheKey, response.clone());
  } catch {
    // CacheStorage quota failure should not block serving the resource.
  }
  return response;
}

async function responseFromManifestEntry(entry) {
  if (!entry || !entry.file || !entry.filesBase) return null;
  try {
    const fileRes = await fetch(entry.filesBase + entry.file);
    if (!fileRes.ok) return null;
    // 防御：如果拿回 text/html，说明 dev server SPA fallback 兜底了（文件其实不存在），
    // 不能把 SPA 入口 HTML 当成缓存内容塞进去，否则会替换掉 SDK JS 返回 HTML 导致解析失败。
    const fetchedCT = (fileRes.headers.get('content-type') || '').toLowerCase();
    const expectedCT = (entry.contentType || '').toLowerCase();
    if (fetchedCT.startsWith('text/html') && !expectedCT.startsWith('text/html')) return null;
    const body = await fileRes.arrayBuffer();
    const headers = new Headers();
    if (entry.contentType) headers.set('Content-Type', entry.contentType);
    if (entry.cacheControl) headers.set('Cache-Control', entry.cacheControl);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(body, { status: entry.status || 200, headers });
  } catch {
    return null;
  }
}

async function handleRequest(request) {
  const cacheKey = canonicalUrl(request.url);
  const placeholderKeyRequest = isPlaceholderKeyRequest(request.url);
  if (placeholderKeyRequest) googleNetworkOfflineOnly = true;

  // Vector tile payloads embed an epoch expected by the WebGL renderer. In live
  // key mode, serving an old offline tile for a newer SDK request can crash with
  // EpochMismatch. Keep offline tile replay only for no-key/offline mode.
  if (isVectorTilePayloadRequest(request.url) && !googleNetworkOfflineOnly && !placeholderKeyRequest) {
    try {
      return await fetch(request);
    } catch (err) {
      return new Response(
        `Live vector tile request failed: ${err && err.message ? err.message : 'unknown'}`,
        { status: 504, headers: { 'Content-Type': 'text/plain' } },
      );
    }
  }

  if (isCallbackJsonpRequest(request.url)) {
    const vectorJsonp = await matchManifestBackedJsonp(loadVectorManifestIndex, cacheKey, request.url);
    if (vectorJsonp) return vectorJsonp;

    const rasterJsonp = await matchManifestBackedJsonp(loadRasterManifestIndex, cacheKey, request.url);
    if (rasterJsonp) return rasterJsonp;

    if (
      isOptionalJsonpRequest(request.url)
      && (googleNetworkOfflineOnly || placeholderKeyRequest)
    ) {
      return emptyJsonpResponse(request.url);
    }
  }

  const vectorCached = await matchManifestBackedCache(VECTOR_CACHE_NAME, loadVectorManifestIndex, cacheKey);
  if (vectorCached) return vectorCached;

  const rasterCached = await matchManifestBackedCache(RASTER_CACHE_NAME, loadRasterManifestIndex, cacheKey);
  if (rasterCached) return rasterCached;

  const optionalMapImageRequest = isOptionalMapImageRequest(request.url);
  if (optionalMapImageRequest && (googleNetworkOfflineOnly || placeholderKeyRequest)) {
    return transparentPngResponse();
  }

  if (googleNetworkOfflineOnly || placeholderKeyRequest) {
    return new Response(
      `Map cache miss while Google network is disabled: ${cacheKey}`,
      { status: 504, headers: { 'Content-Type': 'text/plain' } },
    );
  }

  try {
    return await fetch(request);
  } catch (err) {
    if (optionalMapImageRequest) return transparentPngResponse();
    return new Response(
      `Map cache miss and network failed: ${err && err.message ? err.message : 'unknown'}`,
      { status: 504, headers: { 'Content-Type': 'text/plain' } },
    );
  }
}

function isVectorTilePayloadRequest(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.host !== 'maps.googleapis.com') return false;
    return (
      (u.pathname === '/maps/vt' && u.searchParams.has('pb'))
      || u.pathname.startsWith('/maps/vt/pb=')
    );
  } catch {
    return rawUrl.includes('maps.googleapis.com/maps/vt/pb=')
      || (rawUrl.includes('maps.googleapis.com/maps/vt?') && rawUrl.includes('pb='));
  }
}

function isCallbackJsonpRequest(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return isGoogleMapsJsonpPath(u.pathname) && u.searchParams.has('callback');
  } catch {
    return rawUrl.includes('/maps/api/js/jsonp/') && rawUrl.includes('callback=');
  }
}

function isOptionalJsonpRequest(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.pathname === '/maps/api/js/jsonp/ApplicationService.GetEntityDetails';
  } catch {
    return rawUrl.includes('/maps/api/js/jsonp/ApplicationService.GetEntityDetails');
  }
}

async function matchManifestBackedJsonp(loadIndex, cacheKey, rawUrl) {
  let index;
  try {
    index = await loadIndex();
  } catch {
    return null;
  }
  const entry = index.get(cacheKey);
  if (!entry) return null;

  const response = await responseFromManifestEntry(entry);
  if (!response) return null;

  let callback = '';
  try {
    callback = new URL(rawUrl).searchParams.get('callback') || '';
  } catch {
    return response;
  }
  if (!callback) return response;

  const text = await response.text();
  const rewritten = text.replace(/^[\w.$]+(?=\()/, callback);
  const headers = new Headers(response.headers);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/javascript');
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(rewritten, { status: response.status, headers });
}

function emptyJsonpResponse(rawUrl) {
  let callback = '';
  try {
    callback = new URL(rawUrl).searchParams.get('callback') || '';
  } catch {
    // Fall through to the generic empty script below.
  }
  const safeCallback = /^[\w.$]+$/.test(callback) ? callback : '';
  const body = safeCallback ? `/**/${safeCallback} && ${safeCallback}([]);` : '/**/';
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/javascript; charset=UTF-8',
      'Cache-Control': 'no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function isPlaceholderKeyRequest(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const key = u.searchParams.get('key') || '';
    return key === 'OFFLINE_NO_KEY' || key === 'YOUR_API_KEY_HERE' || key === OFFLINE_GOOGLE_MAPS_API_KEY;
  } catch {
    return rawUrl.includes('OFFLINE_NO_KEY') || rawUrl.includes(OFFLINE_GOOGLE_MAPS_API_KEY);
  }
}

function isOptionalMapImageRequest(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const isMapfilesImage = (
      u.pathname.startsWith('/mapfiles/')
      && /\.(?:png|gif|jpe?g|webp|svg)$/i.test(u.pathname)
    );
    return (
      isMapfilesImage
      || u.pathname.startsWith('/maps/vt/icon/')
      || u.pathname === '/maps/api/js/StaticMapService.GetMapImage'
      || u.pathname.endsWith('.cur')
    );
  } catch {
    return (
      /\/mapfiles\/.*\.(?:png|gif|jpe?g|webp|svg)(?:[?#]|$)/i.test(rawUrl)
      || rawUrl.includes('/maps/vt/icon/')
      || rawUrl.includes('/maps/api/js/StaticMapService.GetMapImage')
      || rawUrl.includes('.cur')
    );
  }
}

function transparentPngResponse() {
  const bytes = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
    0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5,
    0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66,
    96, 130,
  ]);
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
