#!/usr/bin/env node
/**
 * Extract hex color usage frequencies for an app.
 *
 * Scans:
 * - Tailwind arbitrary colors: bg-[#...], text-[#...], border-[#...], from/to/via-[#...]
 * - SVG attributes: fill="#...", stroke="#..."
 *
 * Usage:
 *   node scripts/extract_app_hex_colors.mjs <AppDirName>
 *
 * Example:
 *   node scripts/extract_app_hex_colors.mjs Spotify
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function usage() {
  console.log('Usage: node scripts/extract_app_hex_colors.mjs <AppDirName>');
  console.log('Example: node scripts/extract_app_hex_colors.mjs Spotify');
}

function normalizeHex(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s.startsWith('#')) return null;
  const hex = s.slice(1);
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return `#${hex}`;
  }
  return null;
}

async function listFilesRecursive(rootDir) {
  const out = [];
  async function walk(dir) {
    const ents = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of ents) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.git') continue;
        await walk(p);
        continue;
      }
      if (!ent.isFile()) continue;
      if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
    }
  }
  await walk(rootDir);
  return out;
}

async function main() {
  const arg = process.argv.slice(2).find(a => a && !a.startsWith('-'));
  if (!arg) {
    usage();
    process.exit(2);
  }

  const repoRoot = process.cwd();
  const appDir = arg.includes(path.sep) ? path.resolve(repoRoot, arg) : path.resolve(repoRoot, 'apps', arg);

  const st = await fs.stat(appDir).catch(() => null);
  if (!st || !st.isDirectory()) {
    console.error(`[extract_app_hex_colors] App dir not found: ${appDir}`);
    process.exit(2);
  }

  const files = await listFilesRecursive(appDir);
  const counts = new Map();

  const twRe = /(bg|text|border|from|to|via)-\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\]/g;
  const svgRe = /\b(?:fill|stroke)=["']#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})["']/g;

  for (const file of files) {
    const src = await fs.readFile(file, 'utf8');
    for (const m of src.matchAll(twRe)) {
      const norm = normalizeHex(`#${m[2]}`);
      if (!norm) continue;
      counts.set(norm, (counts.get(norm) || 0) + 1);
    }
    for (const m of src.matchAll(svgRe)) {
      const norm = normalizeHex(`#${m[1]}`);
      if (!norm) continue;
      counts.set(norm, (counts.get(norm) || 0) + 1);
    }
  }

  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  console.log(`App: ${path.relative(repoRoot, appDir)}`);
  console.log(`Files scanned: ${files.length}`);
  console.log('');
  for (const [hex, n] of rows) {
    console.log(`${hex}  ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

