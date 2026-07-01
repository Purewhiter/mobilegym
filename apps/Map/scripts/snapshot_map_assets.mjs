#!/usr/bin/env node
/**
 * Map App 的 Service Worker 离线快照采集脚本。
 * 用 Puppeteer 打开 dev server 上的 Map App，捕获所有发往 Google Maps
 * 相关域名的响应，落盘到 mobilegym-data/map/cache/ 或 mobilegym-data/map/vector/，
 * 并生成 manifest.json。vector profile 还会从完整 manifest 派生一个小的
 * bootstrap-manifest.json，供 Service Worker 启动阶段快速加载。运行时由
 * /cdn/map/... 接入这些文件。
 *
 * 用法:
 *   1. 在另一个 terminal: npm run dev
 *   2. node apps/Map/scripts/snapshot_map_assets.mjs
 *      - 默认 headless=false，会弹一个浏览器窗口
 *      - 默认会自动打开 Map App，进行一组预设的搜索/缩放交互
 *      - 你也可以在浏览器里手动继续操作，最后回到终端按 Ctrl+C 触发保存
 *   3. SIGINT 时写入 manifest.json 并把 body 写到 files/
 *
 * 环境变量:
 *   DEV_URL          dev server URL，默认 http://localhost:5173
 *   MAP_SNAPSHOT_PROFILE  "vector" 写入 mobilegym-data/map/vector/；默认 "raster" 写入 mobilegym-data/map/cache/
 *   MAP_SNAPSHOT_OUT_DIR  覆盖输出目录
 *   HEADLESS         "1" 走 headless 模式
 *   MANUAL           "1" 跳过自动交互，仅捕获手动操作
 *   AUTO_EXIT_MS     非 0 时，自动交互完成后再等待 N ms，自动 flush + 退出（CI/无人值守）
 *   GRID_SCALE       grid 采集缩放系数，默认 1（按内置 COVERAGE 配置）。>1 加密，<1 稀疏
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import puppeteer from 'puppeteer';
import {
  updateServiceWorkerCacheName,
  writeVectorBootstrapManifest,
} from './bootstrap_manifest_utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_DIR = resolve(__dirname, '..');
const ROOT = resolve(APP_DIR, '../..');
const SW_DIR = resolve(APP_DIR, 'sw');
const SNAPSHOT_PROFILE = process.env.MAP_SNAPSHOT_PROFILE === 'vector' ? 'vector' : 'raster';
const VECTOR_PROFILE = SNAPSHOT_PROFILE === 'vector';
const DATA_ROOT = resolve(ROOT, 'mobilegym-data');
const DEFAULT_SNAPSHOT_DIR = VECTOR_PROFILE
  ? resolve(DATA_ROOT, 'map/vector')
  : resolve(DATA_ROOT, 'map/cache');
const SNAPSHOT_DIR = process.env.MAP_SNAPSHOT_OUT_DIR
  ? resolve(process.env.MAP_SNAPSHOT_OUT_DIR)
  : DEFAULT_SNAPSHOT_DIR;
const FILES_DIR = resolve(SNAPSHOT_DIR, 'files');
const MANIFEST_PATH = resolve(SNAPSHOT_DIR, 'manifest.json');
const SW_PATH = resolve(SW_DIR, 'map-sw.js');
const BOOTSTRAP_MANIFEST_PATH = resolve(SW_DIR, 'vector/bootstrap-manifest.json');
const PLACES_PATH = resolve(APP_DIR, 'data/places.json');
const VECTOR_MANIFEST_SOURCE = 'mobilegym-data/map/vector/manifest.json';

const TARGET_HOSTS = new Set([
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

const DEV_URL = process.env.DEV_URL || 'http://localhost:5173';
const HEADLESS = process.env.HEADLESS === '1';
const MANUAL_ONLY = process.env.MANUAL === '1';
const AUTO_EXIT_MS = Number.parseInt(process.env.AUTO_EXIT_MS || '0', 10);

const collected = new Map();
const stats = {
  skippedRasterImages: 0,
  staticMapImages: 0,
  vectorIcons: 0,
  vectorTiles: 0,
};

function ensureDirs() {
  if (!existsSync(SNAPSHOT_DIR)) mkdirSync(SNAPSHOT_DIR, { recursive: true });
  if (existsSync(FILES_DIR)) {
    for (const name of readdirSync(FILES_DIR)) {
      if (name === '.gitkeep') continue;
      rmSync(resolve(FILES_DIR, name), { recursive: true, force: true });
    }
  } else {
    mkdirSync(FILES_DIR, { recursive: true });
  }
}

function loadSearchTerms() {
  if (!existsSync(PLACES_PATH)) return [];
  try {
    const data = JSON.parse(readFileSync(PLACES_PATH, 'utf-8'));
    const keys = Object.keys(data.autocomplete_index || data.search_index || {});
    return keys
      .filter((k) => k.length >= 2)
      .sort()
      .slice(0, 12);
  } catch {
    return [];
  }
}

function guessExt(contentType) {
  if (!contentType) return '.bin';
  const ct = contentType.toLowerCase();
  if (ct.startsWith('image/png')) return '.png';
  if (ct.startsWith('image/jpeg')) return '.jpg';
  if (ct.startsWith('image/webp')) return '.webp';
  if (ct.startsWith('image/gif')) return '.gif';
  if (ct.startsWith('image/svg')) return '.svg';
  if (ct.includes('javascript')) return '.js';
  if (ct.startsWith('application/json')) return '.json';
  if (ct.startsWith('text/css')) return '.css';
  if (ct.startsWith('font/woff2') || ct.includes('woff2')) return '.woff2';
  if (ct.startsWith('font/woff') || ct.includes('woff')) return '.woff';
  if (ct.startsWith('text/')) return '.txt';
  return '.bin';
}

async function captureResponse(response) {
  try {
    const reqUrl = response.url();
    const url = new URL(reqUrl);
    if (!TARGET_HOSTS.has(url.host)) return;
    if (collected.has(reqUrl)) return;
    if (response.status() < 200 || response.status() >= 300) return;
    const headers = response.headers();
    const contentType = headers['content-type'] || 'application/octet-stream';
    if (VECTOR_PROFILE && shouldSkipVectorProfileResponse(url, contentType)) {
      stats.skippedRasterImages++;
      return;
    }
    const buf = await readResponseBody(response, contentType);
    if (!buf || buf.length === 0) return;
    if (VECTOR_PROFILE && isVectorTileResponse(url, contentType)) stats.vectorTiles++;
    if (VECTOR_PROFILE && isVectorIconResponse(url, contentType)) stats.vectorIcons++;
    if (VECTOR_PROFILE && isStaticMapImageResponse(url, contentType)) stats.staticMapImages++;
    collected.set(reqUrl, {
      contentType,
      cacheControl: headers['cache-control'] || '',
      status: response.status(),
      body: buf,
    });
    process.stdout.write(`\r[snapshot] 已捕获 ${collected.size} 个响应  `);
  } catch {
    /* skip */
  }
}

async function readResponseBody(response, contentType) {
  const ct = (contentType || '').toLowerCase();
  if (!ct.includes('charset=x-user-defined')) {
    return response.buffer().catch(() => null);
  }
  const text = await response.text().catch(() => null);
  if (text === null) return null;
  const bytes = Buffer.alloc(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[i] = code >= 0xf780 && code <= 0xf7ff ? code - 0xf700 : code & 0xff;
  }
  return bytes;
}

function shouldSkipVectorProfileResponse(url, contentType) {
  const ct = (contentType || '').toLowerCase();
  if (url.pathname === '/maps/vt' || url.pathname.startsWith('/maps/vt/')) {
    if (url.pathname.startsWith('/maps/vt/icon/')) return false;
    return ct.startsWith('image/');
  }
  if (/^khms\d\.googleapis\.com$/.test(url.host) || /^mts\d\.googleapis\.com$/.test(url.host)) {
    return ct.startsWith('image/');
  }
  return false;
}

function isVectorTileResponse(url, contentType) {
  const ct = (contentType || '').toLowerCase();
  return (
    url.host === 'maps.googleapis.com'
    && url.pathname.startsWith('/maps/vt/pb=')
    && !ct.startsWith('image/')
  );
}

function isVectorIconResponse(url, contentType) {
  const ct = (contentType || '').toLowerCase();
  return (
    url.host === 'maps.googleapis.com'
    && url.pathname.startsWith('/maps/vt/icon/')
    && ct.startsWith('image/')
  );
}

function isStaticMapImageResponse(url, contentType) {
  const ct = (contentType || '').toLowerCase();
  return (
    url.host === 'maps.googleapis.com'
    && url.pathname.includes('StaticMapService.GetMapImage')
    && ct.startsWith('image/')
  );
}

function readSimulatorLocation() {
  const simCfgPath = resolve(ROOT, 'os/data/simulatorConfig.ts');
  try {
    const content = readFileSync(simCfgPath, 'utf-8');
    const lat = content.match(/latitude:\s*([\d.-]+)/);
    const lng = content.match(/longitude:\s*([\d.-]+)/);
    if (lat && lng) return { lat: parseFloat(lat[1]), lng: parseFloat(lng[1]) };
  } catch { /* fall through */ }
  return { lat: 39.9794688, lng: 116.3323982 };
}

function offsetLatLng(lat, lng, dyMeters, dxMeters) {
  const dLat = dyMeters / 111_000;
  const dLng = dxMeters / (111_000 * Math.cos((lat * Math.PI) / 180));
  return { lat: lat + dLat, lng: lng + dLng };
}

async function driveMapTo(page, center, zoom) {
  await page.evaluate((c, z) => {
    const m = window.__mapInstance;
    if (!m) return false;
    m.setCenter(c);
    m.setZoom(z);
    return true;
  }, center, zoom);
  // 等 tiles 加载完毕：监听 idle 事件，最多等 3 秒
  await page.evaluate(() => new Promise((resolve) => {
    const m = window.__mapInstance;
    if (!m || !window.google?.maps?.event) { resolve(); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    window.google.maps.event.addListenerOnce(m, 'idle', finish);
    setTimeout(finish, 3000);
  }));
  // idle 事件只表示视口稳定，瓦片请求可能还在飞行中；多等 500ms 让网络完成
  await wait(500);
  if (VECTOR_PROFILE) {
    const renderingType = await page.evaluate(() => {
      const m = window.__mapInstance;
      return m && typeof m.getRenderingType === 'function' ? m.getRenderingType() : '';
    });
    if (renderingType && renderingType !== 'VECTOR') {
      throw new Error(`当前 Google Maps renderingType=${renderingType}，不是 VECTOR`);
    }
  }
}

/**
 * 在模拟器中心点周围按 grid 漫游 + 多 zoom 级别采集，确保 SW 缓存覆盖一定半径。
 *
 * 不同 zoom 单 tile 覆盖范围差异大（z10 ≈30km，z18 ≈250m），所以采用 per-zoom 配置：
 *   - 低 zoom（z10-12）单 tile 已覆盖大区域，只需中心 1 点
 *   - 中 zoom（z13-15）2×2 ~ 3×3 grid
 *   - 高 zoom（z16-18）4×4 grid 覆盖核心活动半径
 * 总共 ~70 个位置，每位置 setCenter+setZoom 后等 idle，~3 分钟。
 */
async function gridPanZoomCapture(page, simCenter, gridScale) {
  const COVERAGE = [
    { zoom: 10, gridN: 1, radiusM: 0 },
    { zoom: 11, gridN: 1, radiusM: 0 },
    { zoom: 12, gridN: 1, radiusM: 0 },
    { zoom: 13, gridN: 2, radiusM: 2000 },
    { zoom: 14, gridN: 3, radiusM: 3000 },
    { zoom: 15, gridN: 4, radiusM: 3000 },
    { zoom: 16, gridN: 4, radiusM: 3000 },
    { zoom: 17, gridN: 4, radiusM: 2000 },
    { zoom: 18, gridN: 4, radiusM: 1000 },
  ];

  const ready = await page.evaluate(() => Boolean(window.__mapInstance));
  if (!ready) {
    console.warn('[snapshot] window.__mapInstance 未暴露，跳过 grid 采集（确认 GoogleMap.tsx 暴露 mapInstance）');
    return;
  }

  for (const { zoom, gridN: configN, radiusM } of COVERAGE) {
    const gridN = Math.max(1, Math.round(configN * gridScale));
    const step = gridN > 1 ? (radiusM * 2) / (gridN - 1) : 0;
    const total = gridN * gridN;
    console.log(`\n[snapshot] grid 采集 zoom=${zoom}, 半径=${radiusM}m, ${gridN}×${gridN}=${total} 点${step ? `, step=${step.toFixed(0)}m` : ''}`);
    let n = 0;
    for (let i = 0; i < gridN; i++) {
      for (let j = 0; j < gridN; j++) {
        const dy = gridN > 1 ? (i - (gridN - 1) / 2) * step : 0;
        const dx = gridN > 1 ? (j - (gridN - 1) / 2) * step : 0;
        const pos = offsetLatLng(simCenter.lat, simCenter.lng, dy, dx);
        await driveMapTo(page, pos, zoom);
        n++;
        if (n % 4 === 0 || n === total) {
          process.stdout.write(`\r  ${n}/${total} (累计 ${collected.size} 个响应)        `);
        }
      }
    }
    console.log(`\r  完成 ${n}/${total} (累计 ${collected.size} 个响应)        `);
  }
}

async function drivePresetInteractions(page) {
  console.log('\n[snapshot] 等待 OS 启动...');
  await page.waitForFunction(() => typeof window.__OS__ !== 'undefined' && window.__OS__.openApp, {
    timeout: 30_000,
  });

  console.log('[snapshot] 打开 Map App');
  await page.evaluate(() => window.__OS__.openApp('map'));
  await wait(3000);

  await page.waitForFunction(
    () => {
      const win = window;
      return win.google && win.google.maps && win.google.maps.Map;
    },
    { timeout: 30_000 },
  ).catch(() => {
    console.warn('[snapshot] 警告: Google Maps SDK 未在 30s 内就绪');
  });

  await wait(2500);

  const terms = loadSearchTerms();
  if (terms.length > 0) {
    console.log(`[snapshot] 触发 ${terms.length} 个搜索词以填充 autocomplete/places 响应`);
    for (const term of terms) {
      await page.evaluate((q) => {
        const input = document.querySelector('input[type="search"], input[placeholder]');
        if (input) {
          input.value = q;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, term);
      await wait(800);
    }
  }

  const simCenter = readSimulatorLocation();
  const gridScale = Number.parseFloat(process.env.GRID_SCALE || '1');
  await gridPanZoomCapture(page, simCenter, gridScale);

  console.log('\n[snapshot] 预设交互完成。你可以在浏览器里继续手动操作，完成后回到终端按 Ctrl+C 保存。');
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Google API key 通用模式（AIzaSy + 33 字符）。写盘前从 URL 和响应体里抹掉，
// 避免把私有 key 落到 disk / 提交到 git。
const GOOGLE_API_KEY_PATTERN = /AIzaSy[A-Za-z0-9_-]{33}/g;

function stripKeyFromUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.delete('key');
    u.searchParams.delete('token');
    if (u.pathname === '/maps/vt' && u.searchParams.has('pb')) {
      u.searchParams.set('pb', normalizeTilePb(u.searchParams.get('pb') || ''));
    } else if (u.pathname.startsWith('/maps/vt/pb=')) {
      u.pathname = normalizeTilePb(u.pathname);
    }
    return u.toString();
  } catch {
    return rawUrl.replace(/([?&])key=[^&#]*(&?)/, (_, lead, trail) => (trail ? lead : ''));
  }
}

function normalizeTilePb(value) {
  return value
    .replace(/(!2sm!3i)\d+/g, '$1E')
    .replace(/(!28i)\d+/g, '$1E');
}

function looksTextual(contentType, buf) {
  const ct = (contentType || '').toLowerCase();
  if (ct.startsWith('image/') || ct.startsWith('font/') || ct.startsWith('audio/') || ct.startsWith('video/')) return false;
  // 嗅探 NUL 字节 → 二进制
  const sniffEnd = Math.min(buf.length, 512);
  for (let i = 0; i < sniffEnd; i++) {
    if (buf[i] === 0) return false;
  }
  return true;
}

function scrubBodyIfTextual(contentType, buf) {
  if (!looksTextual(contentType, buf)) return { body: buf, replaced: 0 };
  const text = buf.toString('utf-8');
  let count = 0;
  const cleaned = text.replace(GOOGLE_API_KEY_PATTERN, () => { count++; return ''; });
  if (count === 0) return { body: buf, replaced: 0 };
  return { body: Buffer.from(cleaned, 'utf-8'), replaced: count };
}

function makeSnapshotCacheName(entries) {
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
  return VECTOR_PROFILE ? `map-vector-cache-${hash}` : `map-cache-${hash}`;
}

function updateMapSwCacheName(cacheName) {
  const constName = VECTOR_PROFILE ? 'VECTOR_CACHE_NAME' : 'RASTER_CACHE_NAME';
  const prefix = VECTOR_PROFILE ? 'map-vector-cache-' : 'map-cache-';
  updateServiceWorkerCacheName({
    swPath: SW_PATH,
    constName,
    cacheName,
    prefix,
    logPrefix: '[snapshot]',
  });
}

function writeBootstrapManifestForVectorProfile(entries, sourceCacheName) {
  // The bootstrap manifest must be regenerated whenever the vector manifest is
  // regenerated. Otherwise startup resources can drift while the SW only checks
  // the small bootstrap index for non-tile requests.
  if (!VECTOR_PROFILE) return null;
  const result = writeVectorBootstrapManifest({
    entries,
    outputPath: BOOTSTRAP_MANIFEST_PATH,
    source: VECTOR_MANIFEST_SOURCE,
    sourceCacheName,
  });
  updateServiceWorkerCacheName({
    swPath: SW_PATH,
    constName: 'BOOTSTRAP_CACHE_NAME',
    cacheName: result.cacheName,
    prefix: 'map-bootstrap-cache-',
    logPrefix: '[snapshot]',
  });
  return result;
}

async function flushToDisk() {
  console.log(`\n[snapshot] 共 ${collected.size} 个响应，写入磁盘...`);
  const entryByUrl = new Map();
  let urlScrubs = 0;
  let bodyScrubs = 0;
  for (const [rawUrl, { contentType, cacheControl, status, body }] of collected) {
    const cleanUrl = stripKeyFromUrl(rawUrl);
    if (cleanUrl !== rawUrl) urlScrubs++;
    const { body: cleanBody, replaced } = scrubBodyIfTextual(contentType, body);
    bodyScrubs += replaced;
    const bodyHash = createHash('sha1').update(cleanBody).digest('hex');
    const ext = guessExt(contentType);
    // hash 用清洗后的 url，保证落盘文件名也不依赖 key
    const hash = createHash('sha1').update(cleanUrl).digest('hex').slice(0, 16);
    const file = `${hash}${ext}`;
    writeFileSync(resolve(FILES_DIR, file), cleanBody);
    entryByUrl.set(cleanUrl, {
      url: cleanUrl,
      file,
      contentType,
      cacheControl: cacheControl || undefined,
      status,
      size: cleanBody.length,
      bodyHash,
    });
  }
  const entries = [...entryByUrl.values()];
  const sortedEntries = entries.sort((a, b) => a.url.localeCompare(b.url));
  const cacheName = makeSnapshotCacheName(sortedEntries);
  const manifest = {
    version: 1,
    generatedAt: new Date().toISOString(),
    cacheName,
    entries: sortedEntries,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  updateMapSwCacheName(cacheName);
  const bootstrapManifest = writeBootstrapManifestForVectorProfile(sortedEntries, cacheName);
  const totalKB = (entries.reduce((sum, e) => sum + (e.size || 0), 0) / 1024).toFixed(1);
  console.log(`[snapshot] manifest 写入 ${MANIFEST_PATH}`);
  if (bootstrapManifest) {
    console.log(`[snapshot] bootstrap manifest 写入 ${BOOTSTRAP_MANIFEST_PATH} (${bootstrapManifest.entries.length} 条启动资源)`);
  }
  console.log(`[snapshot] ${entries.length} 条响应, 总计 ${totalKB} KB`);
  if (VECTOR_PROFILE) {
    console.log(`[snapshot] 矢量统计: 捕获 ${stats.vectorTiles} 个 vector tile 响应，${stats.vectorIcons} 个 icon 响应，${stats.staticMapImages} 个 static map image 响应，跳过 ${stats.skippedRasterImages} 个 raster tile/image 响应`);
  }
  console.log(`[snapshot] 安全清洗: ${urlScrubs} 个 URL 去 key，${bodyScrubs} 处响应体抹掉 API key`);
}

async function main() {
  ensureDirs();

  console.log(`[snapshot] Puppeteer 启动 (${HEADLESS ? 'headless' : 'headful'})`);
  console.log(`[snapshot] profile=${SNAPSHOT_PROFILE}, 输出目录 ${SNAPSHOT_DIR}`);
  console.log(`[snapshot] 打开 ${DEV_URL}`);

  const browser = await puppeteer.launch({
    headless: HEADLESS,
    defaultViewport: HEADLESS ? { width: 480, height: 900 } : null,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=metal',
      ...(HEADLESS ? ['--no-sandbox', '--disable-setuid-sandbox'] : ['--window-size=520,940']),
    ],
  });

  const [page] = await browser.pages();
  await page.setBypassServiceWorker(true);
  page.on('response', captureResponse);
  page.on('pageerror', (err) => console.error('[snapshot][pageerror]', err.message));

  await page.goto(DEV_URL, { waitUntil: 'domcontentloaded' });

  if (!MANUAL_ONLY) {
    try {
      await drivePresetInteractions(page);
    } catch (e) {
      console.warn('[snapshot] 自动交互失败，回退到手动模式:', e.message);
    }
  } else {
    console.log('[snapshot] MANUAL 模式：自行操作浏览器，完成后按 Ctrl+C');
  }

  await new Promise((resolveExit) => {
    let saving = false;
    const finish = async (reason) => {
      if (saving) return;
      saving = true;
      console.log(`\n[snapshot] 触发 flush (${reason})`);
      try {
        await flushToDisk();
      } catch (e) {
        console.error('[snapshot] 写盘失败:', e);
      }
      await browser.close().catch(() => {});
      resolveExit();
    };
    process.once('SIGINT', () => finish('SIGINT'));
    if (AUTO_EXIT_MS > 0) {
      console.log(`[snapshot] AUTO_EXIT_MS=${AUTO_EXIT_MS}，等待该时长后自动 flush`);
      setTimeout(() => finish('AUTO_EXIT_MS'), AUTO_EXIT_MS);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
