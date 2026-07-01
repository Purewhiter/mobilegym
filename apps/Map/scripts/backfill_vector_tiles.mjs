#!/usr/bin/env node
/**
 * Directly backfill Google vector tile responses into mobilegym-data/map/vector.
 *
 * This supplements, rather than replaces, the browser-driven snapshot:
 * - reads the existing vector manifest for the current Roadmap pb template
 * - calculates z/x/y tile ranges for named centers + radius
 * - fetches missing vector tiles
 * - merges them into manifest.json and updates map-sw.js VECTOR_CACHE_NAME
 * - regenerates the small bootstrap manifest used by service worker install
 *
 * Defaults are intentionally scoped to the bench hot spots requested during
 * development: Palace Museum and Wudaokou Shopping Center, 2km radius, z10-z18.
 *
 * Env:
 *   MAP_VECTOR_BACKFILL_CENTERS='[{"name":"...","lat":39.9,"lng":116.3}]'
 *   MAP_VECTOR_BACKFILL_RADIUS_M=2000
 *   MAP_VECTOR_BACKFILL_ZOOMS=10-18       # also supports "10,12,17-18"
 *   MAP_VECTOR_BACKFILL_CONCURRENCY=8
 *   MAP_VECTOR_BACKFILL_LIMIT=0           # non-zero for a capped probe
 *   MAP_VECTOR_BACKFILL_DRY_RUN=1
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  updateServiceWorkerCacheName,
  writeVectorBootstrapManifest,
} from './bootstrap_manifest_utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const APP_DIR = resolve(__dirname, '..');
const ROOT = resolve(APP_DIR, '../..');
const VECTOR_DIR = resolve(ROOT, 'mobilegym-data/map/vector');
const FILES_DIR = resolve(VECTOR_DIR, 'files');
const MANIFEST_PATH = resolve(VECTOR_DIR, 'manifest.json');
const SW_PATH = resolve(APP_DIR, 'sw/map-sw.js');
const BOOTSTRAP_MANIFEST_PATH = resolve(APP_DIR, 'sw/vector/bootstrap-manifest.json');
const PLACES_PATH = resolve(APP_DIR, 'data/places.json');
const VECTOR_MANIFEST_SOURCE = 'mobilegym-data/map/vector/manifest.json';

const DEFAULT_CENTER_NAMES = ['故宫博物院', '五道口购物中心'];
const RADIUS_M = Number.parseFloat(process.env.MAP_VECTOR_BACKFILL_RADIUS_M || '2000');
const CONCURRENCY = Math.max(1, Number.parseInt(process.env.MAP_VECTOR_BACKFILL_CONCURRENCY || '8', 10));
const LIMIT = Math.max(0, Number.parseInt(process.env.MAP_VECTOR_BACKFILL_LIMIT || '0', 10));
const DRY_RUN = process.env.MAP_VECTOR_BACKFILL_DRY_RUN === '1';
const ZOOMS = parseZooms(process.env.MAP_VECTOR_BACKFILL_ZOOMS || '10-20');

function parseZooms(raw) {
  const out = new Set();
  for (const part of raw.split(',').map((p) => p.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = Number.parseInt(range[1], 10);
      const b = Number.parseInt(range[2], 10);
      for (let z = Math.min(a, b); z <= Math.max(a, b); z++) out.add(z);
      continue;
    }
    const z = Number.parseInt(part, 10);
    if (Number.isFinite(z)) out.add(z);
  }
  return [...out].filter((z) => z >= 0 && z <= 22).sort((a, b) => a - b);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing vector manifest: ${MANIFEST_PATH}`);
  }
  return readJson(MANIFEST_PATH);
}

function loadCenters() {
  const raw = process.env.MAP_VECTOR_BACKFILL_CENTERS;
  if (raw?.trim()) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('MAP_VECTOR_BACKFILL_CENTERS must be a JSON array');
    return parsed.map((item, index) => normalizeCenter(item, `center-${index + 1}`));
  }

  const places = readJson(PLACES_PATH).places || {};
  const rows = Object.values(places);
  return DEFAULT_CENTER_NAMES.map((name) => {
    const row = rows.find((r) => localizedName(r) === name)
      || rows.find((r) => JSON.stringify(r).includes(name));
    if (!row) throw new Error(`Cannot find default center in places.json: ${name}`);
    return normalizeCenter({
      name,
      lat: row.lat,
      lng: row.lng,
    }, name);
  });
}

function localizedName(row) {
  if (!row?.name) return '';
  return typeof row.name === 'string' ? row.name : (row.name.zh || row.name.en || '');
}

function normalizeCenter(item, fallbackName) {
  const lat = Number(item?.lat);
  const lng = Number(item?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Invalid center ${fallbackName}: lat/lng required`);
  }
  return {
    name: String(item?.name || fallbackName),
    lat,
    lng,
  };
}

function findVectorTileTemplate(entries) {
  const entry = entries.find((e) => typeof e.url === 'string' && e.url.includes('/maps/vt/pb='));
  if (!entry) throw new Error('No /maps/vt/pb= vector tile URL found in vector manifest');
  const match = entry.url.match(/^(.*\/maps\/vt\/pb=!1m4!1m3!1i)\d+(!2i)\d+(!3i)\d+(.*)$/);
  if (!match) throw new Error(`Cannot parse vector tile pb template: ${entry.url}`);
  return {
    prefix: match[1],
    xToken: match[2],
    yToken: match[3],
    suffix: match[4],
    contentType: entry.contentType || 'application/vnd.google.octet-stream-compressible; charset=x-user-defined',
    cacheControl: entry.cacheControl,
  };
}

function tileUrl(template, z, x, y) {
  return `${template.prefix}${z}${template.xToken}${x}${template.yToken}${y}${template.suffix}`;
}

function lonToTileX(lng, z) {
  const n = 2 ** z;
  return Math.floor(((lng + 180) / 360) * n);
}

function latToTileY(lat, z) {
  const n = 2 ** z;
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const rad = (clamped * Math.PI) / 180;
  return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n);
}

function tileBoundsForRadius(center, radiusM, z) {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  const n = 2 ** z;
  const xMin = clampInt(lonToTileX(center.lng - dLng, z), 0, n - 1);
  const xMax = clampInt(lonToTileX(center.lng + dLng, z), 0, n - 1);
  const yMin = clampInt(latToTileY(center.lat + dLat, z), 0, n - 1);
  const yMax = clampInt(latToTileY(center.lat - dLat, z), 0, n - 1);
  return {
    xMin: Math.min(xMin, xMax),
    xMax: Math.max(xMin, xMax),
    yMin: Math.min(yMin, yMax),
    yMax: Math.max(yMin, yMax),
  };
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildWorkItems(centers, template, existingEntries) {
  const existing = new Map();
  for (const entry of existingEntries) {
    if (entry?.url && entry?.file && existsSync(resolve(FILES_DIR, entry.file))) {
      existing.set(entry.url, entry);
    }
  }

  const items = [];
  const seen = new Set();
  const perZoom = new Map();
  for (const center of centers) {
    for (const z of ZOOMS) {
      const bounds = tileBoundsForRadius(center, RADIUS_M, z);
      let total = 0;
      let missing = 0;
      for (let x = bounds.xMin; x <= bounds.xMax; x++) {
        for (let y = bounds.yMin; y <= bounds.yMax; y++) {
          total++;
          const url = tileUrl(template, z, x, y);
          if (existing.has(url) || seen.has(url)) continue;
          seen.add(url);
          missing++;
          items.push({ center: center.name, z, x, y, url });
        }
      }
      const prev = perZoom.get(z) || { total: 0, missing: 0 };
      prev.total += total;
      prev.missing += missing;
      perZoom.set(z, prev);
    }
  }
  return { items, perZoom };
}

function guessExt(contentType) {
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('javascript')) return '.js';
  if (ct.startsWith('application/json')) return '.json';
  if (ct.startsWith('text/css')) return '.css';
  if (ct.startsWith('font/woff2') || ct.includes('woff2')) return '.woff2';
  if (ct.startsWith('font/woff') || ct.includes('woff')) return '.woff';
  if (ct.startsWith('image/png')) return '.png';
  if (ct.startsWith('image/jpeg')) return '.jpg';
  if (ct.startsWith('image/webp')) return '.webp';
  return '.bin';
}

async function fetchOne(item, template) {
  const res = await fetch(item.url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || template.contentType;
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length === 0) throw new Error('empty body');
  const file = `${createHash('sha1').update(item.url).digest('hex').slice(0, 16)}${guessExt(contentType)}`;
  writeFileSync(resolve(FILES_DIR, file), body);
  return {
    url: item.url,
    file,
    contentType,
    cacheControl: res.headers.get('cache-control') || template.cacheControl || undefined,
    status: res.status,
    size: body.length,
    bodyHash: createHash('sha1').update(body).digest('hex'),
  };
}

async function runQueue(items, template) {
  const results = [];
  const failures = [];
  let cursor = 0;
  let done = 0;
  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        const entry = await fetchOne(item, template);
        results.push(entry);
      } catch (error) {
        failures.push({ item, error: error instanceof Error ? error.message : String(error) });
      }
      done++;
      if (done % 50 === 0 || done === items.length) {
        process.stdout.write(`\r[vector-backfill] fetched ${done}/${items.length}, ok=${results.length}, fail=${failures.length}     `);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  process.stdout.write('\n');
  return { results, failures };
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
  return `map-vector-cache-${hash}`;
}

function updateMapSwCacheName(cacheName) {
  updateServiceWorkerCacheName({
    swPath: SW_PATH,
    constName: 'VECTOR_CACHE_NAME',
    cacheName,
    prefix: 'map-vector-cache-',
    logPrefix: '[vector-backfill]',
  });
}

function writeBootstrapManifest(entries, sourceCacheName) {
  // Backfill only adds tile payloads, but still rewrite the bootstrap manifest
  // from the merged vector manifest so every vector-writing script has the same
  // derivation path and future non-tile changes cannot leave it stale.
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
    logPrefix: '[vector-backfill]',
  });
  return result;
}

function mergeAndWriteManifest(manifest, newEntries) {
  const byUrl = new Map();
  for (const entry of manifest.entries || []) {
    if (entry?.url && entry?.file) byUrl.set(entry.url, entry);
  }
  for (const entry of newEntries) byUrl.set(entry.url, entry);
  const entries = [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
  const cacheName = makeSnapshotCacheName(entries);
  const nextManifest = {
    ...manifest,
    version: 1,
    generatedAt: new Date().toISOString(),
    cacheName,
    entries,
  };
  writeFileSync(MANIFEST_PATH, JSON.stringify(nextManifest, null, 2));
  updateMapSwCacheName(cacheName);
  const bootstrapManifest = writeBootstrapManifest(entries, cacheName);
  console.log(`[vector-backfill] bootstrap manifest: ${bootstrapManifest.entries.length} startup entries`);
  return nextManifest;
}

async function main() {
  if (!ZOOMS.length) throw new Error('No zoom levels configured');
  if (!Number.isFinite(RADIUS_M) || RADIUS_M <= 0) throw new Error('MAP_VECTOR_BACKFILL_RADIUS_M must be > 0');
  if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });

  const manifest = loadManifest();
  const centers = loadCenters();
  const template = findVectorTileTemplate(manifest.entries || []);
  const { items: allItems, perZoom } = buildWorkItems(centers, template, manifest.entries || []);
  const items = LIMIT > 0 ? allItems.slice(0, LIMIT) : allItems;

  console.log('[vector-backfill] centers:', centers.map((c) => `${c.name}(${c.lat},${c.lng})`).join(', '));
  console.log(`[vector-backfill] radius=${RADIUS_M}m zooms=${ZOOMS.join(',')} concurrency=${CONCURRENCY}`);
  for (const z of ZOOMS) {
    const row = perZoom.get(z) || { total: 0, missing: 0 };
    console.log(`[vector-backfill] z${z}: total tiles in requested areas=${row.total}, missing=${row.missing}`);
  }
  console.log(`[vector-backfill] will fetch ${items.length}${LIMIT > 0 ? ` (limited from ${allItems.length})` : ''} tiles`);

  if (DRY_RUN || items.length === 0) {
    if (DRY_RUN) console.log('[vector-backfill] dry run: no files written');
    return;
  }

  const beforeCount = manifest.entries?.length || 0;
  const { results, failures } = await runQueue(items, template);
  const nextManifest = mergeAndWriteManifest(manifest, results);
  const addedBytes = results.reduce((sum, entry) => sum + (entry.size || 0), 0);
  console.log(`[vector-backfill] manifest: ${beforeCount} -> ${nextManifest.entries.length} entries`);
  console.log(`[vector-backfill] added ${results.length} tiles, ${(addedBytes / 1024 / 1024).toFixed(1)} MB`);
  if (failures.length) {
    console.warn(`[vector-backfill] failures=${failures.length}`);
    for (const failure of failures.slice(0, 12)) {
      console.warn(`  z${failure.item.z}/${failure.item.x}/${failure.item.y}: ${failure.error}`);
    }
  }
}

main().catch((error) => {
  console.error('[vector-backfill] failed:', error);
  process.exit(1);
});
