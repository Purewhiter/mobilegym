/**
 * Backfill cached high-resolution artwork pointers for existing Spotify seed data.
 *
 * This does not download files. It records the deterministic Apple artwork URL that
 * can later be mirrored into mobilegym-data/spotify/images and rewritten to CDN paths.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');
const FILES = [
  'defaults.json',
  'playlistTracks.json',
  'artistTracks.json',
  'searchResults.json',
  'albumTracks.json',
];

const APPLE_ARTWORK_SIZE_RE = /\/(\d+)x(\d+)(bb)?(?=\.[a-z0-9]+(?:\?|$))/i;

function inferLargeArtworkUrl(raw) {
  if (typeof raw !== 'string' || !raw) return '';
  const resized = raw.replace(APPLE_ARTWORK_SIZE_RE, '/1000x1000$3');
  return resized === raw ? '' : resized;
}

function backfill(value) {
  const walk = (node) => {
    let changed = 0;
    if (Array.isArray(node)) {
      for (const item of node) {
        changed += walk(item);
      }
      return changed;
    }
    if (!node || typeof node !== 'object') return 0;

    if (typeof node.cover === 'string' && !node.coverLarge) {
      const large = inferLargeArtworkUrl(node.cover);
      if (large) {
        node.coverLarge = large;
        changed += 1;
      }
    }

    for (const child of Object.values(node)) changed += walk(child);
    return changed;
  };

  return walk(value);
}

for (const file of FILES) {
  const path = resolve(DATA_DIR, file);
  if (!existsSync(path)) continue;
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const changed = backfill(data);
  if (changed > 0) {
    writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }
  console.log(`${file}: ${changed} coverLarge field(s) added`);
}
