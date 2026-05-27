/**
 * Map App Service Worker
 *
 * 拦截 Google Maps 相关域名的请求，命中本地快照则返回，未命中再走网络。
 * 快照内容来自 /map-cache/manifest.json + /map-cache/files/*。
 *
 * 生命周期:
 *   install  → 读取 manifest，将本地文件回填到 CacheStorage
 *   activate → 立即接管所有客户端
 *   fetch    → INTERCEPT_HOSTS 域名走缓存优先；其他域名透传
 */

const CACHE_NAME = 'map-cache-786a79e6b3e1';
// 从 SW 自身 URL 推导部署 base（'/' 或 '/sim/'），使 /map-cache 路径在子路径部署下也正确。
const SW_BASE = new URL('.', self.location.href).href;
const MANIFEST_URL = SW_BASE + 'map-cache/manifest.json';
const FILES_BASE = SW_BASE + 'map-cache/files/';

const INTERCEPT_HOSTS = new Set([
  'maps.googleapis.com',
  'maps.gstatic.com',
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
  // 关键：install 必须永远 resolve。
  // 否则 populateCache 里任何抛错（caches.open 失败、manifest fetch 异常等）
  // 都会让 SW 进入 redundant 状态，navigator.serviceWorker.ready 永远 pending，
  // MapApp 的 ensureMapServiceWorkerControlling 永远卡住，bench 直接挂死。
  // 即便 manifest 空载，至少让 SW 顺利激活、能拦截后续请求。
  event.waitUntil(
    populateCache()
      .catch((err) => {
        console.warn('[map-sw] populateCache 异常，跳过缓存填充', err);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // 只清理本 SW 自己管理的旧版本缓存（map-cache-<version>），不要碰别人的 cache。
  // 否则同源里其它 app 或将来 OS 自己注册的 CacheStorage 会被这里 wipe 掉。
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((k) => k.startsWith('map-cache-') && k !== CACHE_NAME)
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

/**
 * 把 URL 规范化为缓存键：剥掉 `key=` 参数，并按字母序排序其它 query。
 * Google Maps loader / tile / static map 的 URL 都把 API key 拼在 query 里，但
 * 同一份缓存内容对任何 key 值都有效（host+path+其它 query 一致即可）。同时排序
 * query 避免 SDK 不同版本生成 URL 时参数顺序不同导致缓存 miss。
 */
function canonicalUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.delete('key');
    const sorted = [...u.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    u.search = new URLSearchParams(sorted).toString();
    return u.toString();
  } catch {
    return rawUrl;
  }
}

async function populateCache() {
  let manifest;
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) return;
    manifest = await res.json();
  } catch {
    return;
  }
  const entries = manifest && Array.isArray(manifest.entries) ? manifest.entries : [];
  if (entries.length === 0) return;

  const cache = await caches.open(CACHE_NAME);
  await Promise.all(entries.map((entry) => populateOne(cache, entry)));
}

async function populateOne(cache, entry) {
  if (!entry || !entry.url || !entry.file) return;
  try {
    const fileRes = await fetch(FILES_BASE + entry.file);
    if (!fileRes.ok) return;
    // 防御：如果拿回 text/html，说明 dev server SPA fallback 兜底了（文件其实不存在），
    // 不能把 SPA 入口 HTML 当成缓存内容塞进去，否则会替换掉 SDK JS 返回 HTML 导致解析失败。
    const fetchedCT = (fileRes.headers.get('content-type') || '').toLowerCase();
    const expectedCT = (entry.contentType || '').toLowerCase();
    if (fetchedCT.startsWith('text/html') && !expectedCT.startsWith('text/html')) return;
    const body = await fileRes.arrayBuffer();
    const headers = new Headers();
    if (entry.contentType) headers.set('Content-Type', entry.contentType);
    if (entry.cacheControl) headers.set('Cache-Control', entry.cacheControl);
    headers.set('Access-Control-Allow-Origin', '*');
    await cache.put(
      canonicalUrl(entry.url),
      new Response(body, { status: entry.status || 200, headers }),
    );
  } catch {
    /* skip individual failures */
  }
}

async function handleRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(canonicalUrl(request.url));
  if (cached) return cached;

  try {
    return await fetch(request);
  } catch (err) {
    return new Response(
      `Map cache miss and network failed: ${err && err.message ? err.message : 'unknown'}`,
      { status: 504, headers: { 'Content-Type': 'text/plain' } },
    );
  }
}
