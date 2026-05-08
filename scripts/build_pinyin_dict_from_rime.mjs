import fs from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Build a compact dictionary JSON for the Mobile-Gym OS keyboard IME.
 *
 * Input: Rime .dict.yaml (tab-separated entries after header)
 * Output: public/ime/pinyin_dict.json
 *
 * We keep only topK candidates per normalized pinyin key to keep file small.
 */

const ROOT = process.cwd();
const INPUTS = [
  // High frequency phrases with weights
  'all_dicts/cn_dicts/base.dict.yaml',
  // Common characters with pinyin + weight
  'all_dicts/cn_dicts/8105.dict.yaml',
  // Big character table (no weights) — useful fallback coverage
  'all_dicts/cn_dicts/41448.dict.yaml',
];

const OUT_DIR = 'public/ime';
const OUT_FILE = path.join(OUT_DIR, 'pinyin_dict.json');

const TOP_K = 12;
// For phrases, keep reasonable length so output stays compact and lookup stays fast.
const MAX_SYLLABLES = 5;
const MAX_PINYIN_LEN = 24;

function normalizePinyin(pinyinWithSpaces) {
  return String(pinyinWithSpaces || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '');
}

function countSyllables(pinyinWithSpaces) {
  const s = String(pinyinWithSpaces || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  if (!s) return 0;
  return s.split(' ').filter(Boolean).length;
}

function pushTopK(map, key, text, weight) {
  if (!key || !text) return;
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  // de-dupe
  if (arr.some(x => x.text === text)) return;
  arr.push({ text, weight });
  // prune cheaply
  if (arr.length > TOP_K * 3) {
    arr.sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text));
    arr.length = TOP_K;
  }
}

async function processFile(relPath, map, stats) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) {
    console.warn(`[ime-dict] skip missing: ${relPath}`);
    return;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(full, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let inBody = false;

  for await (const lineRaw of rl) {
    const line = lineRaw.trimEnd();
    if (!line) continue;
    if (!inBody) {
      // Rime dict body starts after the YAML header ends ("...") then entries
      if (line === '...') {
        inBody = true;
      }
      continue;
    }

    if (line.startsWith('#')) continue;

    const parts = line.split('\t');
    if (parts.length < 2) continue;

    const text = parts[0]?.trim();
    const pinyin = parts[1]?.trim();
    const weight = parts.length >= 3 ? Number(parts[2]) || 1 : 1;

    const key = normalizePinyin(pinyin);
    if (!key) continue;
    if (key.length > MAX_PINYIN_LEN) continue;

    // phrase length constraint (helps keep output size manageable)
    const syl = countSyllables(pinyin);
    if (syl > MAX_SYLLABLES) continue;

    pushTopK(map, key, text, weight);
    stats.lines++;
  }

  stats.files++;
  console.log(`[ime-dict] processed ${relPath}`);
}

async function main() {
  const map = new Map();
  const stats = { files: 0, lines: 0 };

  for (const p of INPUTS) {
    // eslint-disable-next-line no-await-in-loop
    await processFile(p, map, stats);
  }

  // finalize
  const out = {};
  let keys = 0;
  for (const [k, arr] of map) {
    arr.sort((a, b) => b.weight - a.weight || a.text.localeCompare(b.text));
    out[k] = arr.slice(0, TOP_K).map(x => x.text);
    keys++;
  }

  fs.mkdirSync(path.join(ROOT, OUT_DIR), { recursive: true });
  fs.writeFileSync(path.join(ROOT, OUT_FILE), JSON.stringify(out));

  console.log(`[ime-dict] done. files=${stats.files} lines=${stats.lines} keys=${keys}`);
  console.log(`[ime-dict] wrote ${OUT_FILE}`);
}

main().catch(err => {
  console.error('[ime-dict] failed:', err);
  process.exit(1);
});

