#!/usr/bin/env node
/**
 * Rasterize cached Google vector map tiles into PNG tiles.
 *
 * This is intentionally outside the Map app runtime. It uses a tiny headless
 * browser page plus request interception:
 *   - Google Maps JS SDK / map config / vector tile requests are served from
 *     the offline manifest + mobilegym-data/map/vector/files.
 *   - Network misses are blocked, so successful output proves the raster came
 *     from local cached resources.
 *
 * Google vector tiles are not standard Mapbox Vector Tiles; the .bin payloads
 * are proprietary Google renderer input. This script therefore does not decode
 * them. It converts them by driving the cached Google vector renderer and
 * screenshotting the exact WebMercator tile viewport.
 *
 * Examples:
 *   node apps/Map/scripts/rasterize_vector_tiles.mjs --manifest-git e9f7ea8 --limit 1 --online-sdk --headed
 *   node apps/Map/scripts/rasterize_vector_tiles.mjs --manifest /tmp/map-manifest.json --zoom 18 --limit 20
 *   node apps/Map/scripts/rasterize_vector_tiles.mjs --tile 18/215782/99261 --manifest-git e9f7ea8
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { createServer } from 'http';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const DEFAULT_MANIFEST = resolve(ROOT, 'mobilegym-data/map/vector/manifest.json');
const DEFAULT_FILES_DIR = resolve(ROOT, 'mobilegym-data/map/vector/files');
const DEFAULT_OUT_DIR = resolve(ROOT, 'mobilegym-data/map/vector-raster');
const DEFAULT_ENV_FILE = resolve(ROOT, '.env.local');

const TILE_RE = /!1i(\d+)!2i(\d+)!3i(\d+)/;

function parseArgs(argv) {
  const localEnv = readLocalEnv();
  const out = {
    manifest: DEFAULT_MANIFEST,
    manifestGit: '',
    filesDir: DEFAULT_FILES_DIR,
    outDir: DEFAULT_OUT_DIR,
    limit: 1,
    zoom: null,
    tile: null,
    cssSize: 256,
    scale: 2,
    paddingTiles: 1,
    waitMs: 1200,
    headless: true,
    verbose: false,
    onlineSdk: false,
    apiKey:
      localEnv.VITE_GOOGLE_MAPS_API_KEY ||
      localEnv.GOOGLE_MAPS_API_KEY ||
      localEnv.VITE_GOOGLE_API_KEY ||
      '',
    mapId: localEnv.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID',
  };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--manifest') out.manifest = resolve(next());
    else if (arg === '--manifest-git') out.manifestGit = next();
    else if (arg === '--files-dir') out.filesDir = resolve(next());
    else if (arg === '--out') out.outDir = resolve(next());
    else if (arg === '--limit') out.limit = Number.parseInt(next(), 10);
    else if (arg === '--zoom') out.zoom = Number.parseInt(next(), 10);
    else if (arg === '--tile') out.tile = parseTile(next());
    else if (arg === '--css-size') out.cssSize = Number.parseInt(next(), 10);
    else if (arg === '--scale') out.scale = Number.parseInt(next(), 10);
    else if (arg === '--padding-tiles') out.paddingTiles = Number.parseInt(next(), 10);
    else if (arg === '--wait-ms') out.waitMs = Number.parseInt(next(), 10);
    else if (arg === '--headed') out.headless = false;
    else if (arg === '--verbose') out.verbose = true;
    else if (arg === '--online-sdk') out.onlineSdk = true;
    else if (arg === '--api-key') out.apiKey = next();
    else if (arg === '--map-id') out.mapId = next();
    else throw new Error(`Unknown arg: ${arg}`);
  }
  return out;
}

function readLocalEnv() {
  if (!existsSync(DEFAULT_ENV_FILE)) return {};
  const env = {};
  for (const line of readFileSync(DEFAULT_ENV_FILE, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseTile(raw) {
  const parts = String(raw).split('/').map((v) => Number.parseInt(v, 10));
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) {
    throw new Error(`Invalid --tile "${raw}", expected z/x/y`);
  }
  return { z: parts[0], x: parts[1], y: parts[2] };
}

function readManifest(opts) {
  if (opts.manifestGit) {
    const spec = `${opts.manifestGit}:apps/Map/sw/manifest.json`;
    return JSON.parse(
      execFileSync('git', ['show', spec], {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 128 * 1024 * 1024,
      }),
    );
  }
  return JSON.parse(readFileSync(opts.manifest, 'utf8'));
}

function normalizeTilePb(pb) {
  return pb
    .replace(/(!2sm!3i)\d+/g, '$1E')
    .replace(/(!28i)\d+/g, '$1E');
}

function canonicalUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    u.searchParams.delete('key');
    u.searchParams.delete('callback');
    u.searchParams.delete('token');
    if (u.pathname.endsWith('/maps/vt')) {
      const pb = u.searchParams.get('pb');
      if (pb) u.searchParams.set('pb', normalizeTilePb(pb));
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

function redactUrl(value) {
  return String(value)
    .replace(/([?&]key=)[^&\s]+/g, '$1<redacted>')
    .replace(/([?&]token=)[^&\s]+/g, '$1<redacted>');
}

function tileFromVectorUrl(url) {
  const match = url.match(TILE_RE);
  if (!match) return null;
  return { z: Number(match[1]), x: Number(match[2]), y: Number(match[3]) };
}

function vectorEntries(manifest) {
  return (manifest.entries || [])
    .filter((entry) => entry?.url?.includes('/maps/vt/pb='))
    .map((entry) => ({ entry, tile: tileFromVectorUrl(entry.url) }))
    .filter((item) => item.tile);
}

function tileCenterLatLng(z, x, y) {
  const n = 2 ** z;
  const lon = ((x + 0.5) / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng: lon };
}

function buildManifestIndex(manifest) {
  const index = new Map();
  for (const entry of manifest.entries || []) {
    if (!entry?.url || !entry?.file) continue;
    index.set(canonicalUrl(entry.url), entry);
  }
  return index;
}

function responseHeaders(entry) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': entry.cacheControl || 'public, max-age=31536000',
  };
  if (entry.contentType) headers['Content-Type'] = entry.contentType;
  return headers;
}

async function installOfflineInterceptor(page, manifestIndex, opts) {
  const misses = new Map();
  await page.setRequestInterception(true);
  page.on('request', async (request) => {
    const url = request.url();
    const resourceType = request.resourceType();
    if (url.startsWith('data:') || url === 'about:blank') {
      request.continue();
      return;
    }

    const canonical = canonicalUrl(url);
    const isGoogleMapTile = url.includes('maps.googleapis.com/maps/vt');
    if (request.method() === 'OPTIONS') {
      request.respond({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
        body: '',
      });
      return;
    }

    const entry = opts.onlineSdk && !isGoogleMapTile ? null : manifestIndex.get(canonical);
    if (entry) {
      const filePath = resolve(opts.filesDir, entry.file);
      if (!filePath.startsWith(opts.filesDir) || !existsSync(filePath)) {
        misses.set(canonical, `missing file ${entry.file}`);
        request.respond({ status: 404, body: 'missing cached file' });
        return;
      }
      if (
        opts.verbose &&
        (url.includes('/maps/vt') ||
          url.includes('GetViewportInfo') ||
          url.includes('/webgl.js') ||
          url.includes('/vectortown-worker.js') ||
          url.includes('/labeler_wrapper'))
      ) {
        console.log(`[serve] ${request.method()} ${entry.file} ${redactUrl(url).slice(0, 220)}`);
      }
      request.respond({
        status: entry.status || 200,
        headers: responseHeaders(entry),
        body: readFileSync(filePath),
      });
      return;
    }

    let host = '';
    try {
      host = new URL(url).host;
    } catch {
      // ignore
    }
    if (host.includes('google') || host.includes('gstatic')) {
      if (opts.onlineSdk && !isGoogleMapTile) {
        request.continue();
        return;
      }
      if (url.includes('/gen_204')) {
        request.respond({ status: 204, body: '' });
        return;
      }
      if (opts.verbose) {
        const preview = isGoogleMapTile ? redactUrl(url) : redactUrl(url).slice(0, 240);
        console.warn(`[miss] ${request.method()} ${resourceType} ${preview}`);
      }
      misses.set(canonical, resourceType);
      request.respond({
        status: 404,
        headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
        body: `offline cache miss: ${canonical}`,
      });
      return;
    }
    request.continue();
  });
  return misses;
}

function htmlForTile(tile, opts) {
  const center = tileCenterLatLng(tile.z, tile.x, tile.y);
  const renderCssSize = opts.cssSize * (1 + 2 * opts.paddingTiles);
  const apiKey = encodeURIComponent(opts.apiKey || 'OFFLINE_NO_KEY');
  const mapIdLine =
    opts.mapId && opts.mapId !== 'none' ? `mapId: ${JSON.stringify(opts.mapId)},` : '';
  const src = [
    'https://maps.googleapis.com/maps/api/js',
    '?libraries=maps%2Cplaces%2Cgeometry%2Cmarker%2Croutes',
    '&v=weekly',
    '&language=zh-CN',
    '&region=CN',
    '&callback=google.maps.__ib__',
    `&key=${apiKey}`,
  ].join('');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; width: ${renderCssSize}px; height: ${renderCssSize}px; overflow: hidden; background: #e5e7eb; }
    #map { width: ${renderCssSize}px; height: ${renderCssSize}px; }
    .gm-style-cc, .gmnoprint, a[href^="https://maps.google.com/maps"] { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    window.__rasterReady = false;
    window.__rasterError = null;
    window.__initMap = function initMap() {
      try {
        const map = new google.maps.Map(document.getElementById('map'), {
          center: { lat: ${center.lat}, lng: ${center.lng} },
          zoom: ${tile.z},
          heading: 0,
          tilt: 0,
          ${mapIdLine}
          disableDefaultUI: true,
          clickableIcons: false,
          keyboardShortcuts: false,
          gestureHandling: 'none',
          renderingType: google.maps.RenderingType?.VECTOR || 'VECTOR',
        });
        google.maps.event.addListenerOnce(map, 'idle', () => {
          console.log('renderingType=' + (map.getRenderingType?.() || 'unknown'));
          setTimeout(() => { window.__rasterReady = true; }, ${opts.waitMs});
        });
      } catch (err) {
        window.__rasterError = String(err && err.stack ? err.stack : err);
      }
    };
    window.google = window.google || {};
    window.google.maps = window.google.maps || {};
    window.google.maps.__ib__ = window.__initMap;
  </script>
  <script src="${src}"></script>
</body>
</html>`;
}

async function rasterizeTile(page, tile, opts) {
  const html = htmlForTile(tile, opts);
  const renderCssSize = opts.cssSize * (1 + 2 * opts.paddingTiles);
  await page.setViewport({
    width: renderCssSize,
    height: renderCssSize,
    deviceScaleFactor: opts.scale,
  });
  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/tile.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = server.address();
  try {
    await page.goto(`http://127.0.0.1:${port}/tile.html`, { waitUntil: 'domcontentloaded' });
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
  await page.waitForFunction(
    () => window.__rasterReady || window.__rasterError,
    { timeout: 45_000 },
  );
  const error = await page.evaluate(() => window.__rasterError);
  if (error) throw new Error(error);
  const map = await page.$('#map');
  if (!map) throw new Error('map element missing');
  const offset = opts.cssSize * opts.paddingTiles;
  return page.screenshot({
    type: 'png',
    clip: {
      x: offset,
      y: offset,
      width: opts.cssSize,
      height: opts.cssSize,
    },
  });
}

async function main() {
  const opts = parseArgs(process.argv);
  const manifest = readManifest(opts);
  const vectors = vectorEntries(manifest);
  if (vectors.length === 0) {
    console.error('No vector tile entries found. Expected manifest URLs like /maps/vt/pb=...');
    process.exit(2);
  }

  let tiles = vectors.map((item) => item.tile);
  if (opts.zoom !== null) tiles = tiles.filter((tile) => tile.z === opts.zoom);
  if (opts.tile) tiles = tiles.filter((tile) => tile.z === opts.tile.z && tile.x === opts.tile.x && tile.y === opts.tile.y);
  tiles = [...new Map(tiles.map((tile) => [`${tile.z}/${tile.x}/${tile.y}`, tile])).values()];
  if (Number.isFinite(opts.limit) && opts.limit > 0) tiles = tiles.slice(0, opts.limit);
  if (tiles.length === 0) {
    console.error('No tiles selected.');
    process.exit(2);
  }

  mkdirSync(opts.outDir, { recursive: true });
  const manifestIndex = buildManifestIndex(manifest);
  const browser = await puppeteer.launch({
    headless: opts.headless,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=metal',
    ],
  });
  try {
    const page = await browser.newPage();
    const misses = await installOfflineInterceptor(page, manifestIndex, opts);
    page.on('console', (msg) => {
      if (opts.verbose) console.log(`[browser:${msg.type()}] ${redactUrl(msg.text())}`);
    });
    page.on('pageerror', (err) => {
      if (opts.verbose) console.error(`[pageerror] ${err.stack || err.message}`);
    });

    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const outPath = resolve(opts.outDir, `${tile.z}_${tile.x}_${tile.y}.png`);
      const png = await rasterizeTile(page, tile, opts);
      writeFileSync(outPath, png);
      console.log(`[${i + 1}/${tiles.length}] ${tile.z}/${tile.x}/${tile.y} -> ${outPath}`);
    }
    if (misses.size > 0) {
      console.warn(`offline misses: ${misses.size}`);
      for (const [url, why] of [...misses.entries()].slice(0, 12)) {
        console.warn(`  ${why}: ${url.slice(0, 220)}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
