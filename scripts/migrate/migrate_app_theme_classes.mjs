#!/usr/bin/env node
/**
 * Migrate Tailwind arbitrary hex classes to semantic app theme tokens.
 *
 * Rewrites only exact matches against manifest.ts theme.colors hex:
 *   bg-[#rrggbb]        -> bg-app-primary (etc)
 *   text-[#rrggbb]/20   -> text-app-primary/20 (etc)
 *   border-[#rrggbb]    -> border-app-border (when matches manifest.theme.colors.border)
 *
 * Usage:
 *   node scripts/migrate/migrate_app_theme_classes.mjs <AppDirName|path> [--execute]
 *
 * Example:
 *   node scripts/migrate/migrate_app_theme_classes.mjs Spotify
 *   node scripts/migrate/migrate_app_theme_classes.mjs system/Settings --execute
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function usage() {
  console.log('Usage: node scripts/migrate/migrate_app_theme_classes.mjs <AppDirName|path> [--execute]');
  console.log('Example: node scripts/migrate/migrate_app_theme_classes.mjs Spotify');
  console.log('Example: node scripts/migrate/migrate_app_theme_classes.mjs system/Settings --execute');
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

function extractObjectAfterProperty(source, propName) {
  const propRe = new RegExp(`(?:^|[,{])\\s*(?:${propName}|['"]${propName}['"])\\s*:`, 'm');
  const propMatch = propRe.exec(source);
  if (!propMatch) return null;

  const from = propMatch.index + propMatch[0].length;
  const open = source.indexOf('{', from);
  if (open === -1) return null;

  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }

  return null;
}

function extractThemeColorsFromManifest(source) {
  const themeBlock = extractObjectAfterProperty(source, 'theme');
  if (!themeBlock) return null;
  const colorsBlock = extractObjectAfterProperty(themeBlock, 'colors');
  if (!colorsBlock) return null;

  const keys = [
    'primary',
    'primaryDark',
    'secondary',
    'accent',
    'background',
    'surface',
    'textPrimary',
    'textSecondary',
    'border',
    'tabBarBg',
  ];

  const out = {};
  const keySet = new Set(keys);
  const colorRe = /(?:^|,|\n)\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*:\s*(['"])(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\4/g;
  let match;
  while ((match = colorRe.exec(colorsBlock)) !== null) {
    const key = match[1] || match[2] || match[3];
    if (!keySet.has(key)) continue;
    const hex = normalizeHex(match[5]);
    if (hex) out[key] = hex;
  }
  return out;
}

function buildReplacementMap(colors) {
  const map = new Map();
  const starPrefixes = [
    'bg',
    'text',
    'border',
    'border-l',
    'border-r',
    'border-t',
    'border-b',
    'border-x',
    'border-y',
    'from',
    'to',
    'via',
    'ring',
    'caret',
    'accent',
    'fill',
    'stroke',
    'outline',
  ];
  const borderPrefixes = [
    'border',
    'border-l',
    'border-r',
    'border-t',
    'border-b',
    'border-x',
    'border-y',
  ];

  const putStar = (hex, token) => {
    for (const p of starPrefixes) {
      map.set(`${p}:${hex}`, `${p}-${token}`);
    }
  };

  const putFixed = (prefix, hex, fullClass) => {
    map.set(`${prefix}:${hex}`, fullClass);
  };

  if (colors.primary) putStar(colors.primary, 'app-primary');
  if (colors.primaryDark) putStar(colors.primaryDark, 'app-primary-dark');
  if (colors.secondary) putStar(colors.secondary, 'app-secondary');
  if (colors.accent) putStar(colors.accent, 'app-accent');
  if (colors.background) putStar(colors.background, 'app-bg');
  if (colors.surface) putStar(colors.surface, 'app-surface');

  if (colors.textPrimary) putFixed('text', colors.textPrimary, 'text-app-text');
  if (colors.textSecondary) putFixed('text', colors.textSecondary, 'text-app-text-muted');
  if (colors.textSecondary) putFixed('placeholder', colors.textSecondary, 'placeholder-app-text-muted');
  if (colors.border) {
    for (const p of borderPrefixes) {
      putFixed(p, colors.border, `${p}-app-border`);
    }
  }
  if (colors.tabBarBg) putFixed('bg', colors.tabBarBg, 'bg-app-tab-bar-bg');

  return map;
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

async function resolveTargetDir(repoRoot, appArg) {
  if (appArg.includes(path.sep)) {
    return path.resolve(repoRoot, appArg);
  }

  for (const parent of ['apps', 'system']) {
    const candidate = path.resolve(repoRoot, parent, appArg);
    const st = await fs.stat(candidate).catch(() => null);
    if (st?.isDirectory()) return candidate;
  }

  return path.resolve(repoRoot, 'apps', appArg);
}

async function main() {
  const argv = process.argv.slice(2);
  const appArg = argv.find((a) => a && !a.startsWith('-'));
  const dryRun = !argv.includes('--execute');
  if (!appArg) {
    usage();
    process.exit(2);
  }

  const repoRoot = process.cwd();
  const appDir = await resolveTargetDir(repoRoot, appArg);
  const manifestPath = path.resolve(appDir, 'manifest.ts');

  const st = await fs.stat(appDir).catch(() => null);
  if (!st || !st.isDirectory()) {
    console.error(`[migrate_app_theme_classes] App dir not found: ${appDir}`);
    process.exit(2);
  }

  const manifestSrc = await fs.readFile(manifestPath, 'utf8').catch(() => null);
  if (!manifestSrc) {
    console.error(`[migrate_app_theme_classes] manifest.ts not found: ${manifestPath}`);
    process.exit(2);
  }

  const themeColors = extractThemeColorsFromManifest(manifestSrc);
  if (!themeColors || !themeColors.primary || !themeColors.background || !themeColors.textPrimary || !themeColors.textSecondary) {
    console.error('[migrate_app_theme_classes] Failed to extract theme.colors from manifest.ts (expected primary/background/textPrimary/textSecondary at least).');
    process.exit(2);
  }

  const repl = buildReplacementMap(themeColors);
  const files = await listFilesRecursive(appDir);
  const re = /(border-x|border-y|border-l|border-r|border-t|border-b|bg|text|border|from|to|via|ring|caret|accent|fill|stroke|outline|placeholder)-\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\](\/(?:\d{1,3}|\[[^\]]+\]))?/g;

  let changedFiles = 0;
  let totalReplacements = 0;

  for (const file of files) {
    const src = await fs.readFile(file, 'utf8');
    let fileRepl = 0;
    const next = src.replace(re, (match, prefix, hexRaw, opacity) => {
      const hex = normalizeHex(`#${hexRaw}`);
      if (!hex) return match;
      const key = `${prefix}:${hex}`;
      const replacement = repl.get(key);
      if (!replacement) return match;
      fileRepl++;
      return `${replacement}${opacity || ''}`;
    });

    if (next !== src) {
      changedFiles++;
      totalReplacements += fileRepl;
      if (!dryRun) {
        await fs.writeFile(file, next, 'utf8');
      }
      console.log(`${dryRun ? '[dry-run] ' : ''}${path.relative(repoRoot, file)}  (${fileRepl} replacements)`);
    }
  }

  console.log('');
  console.log(`App: ${path.relative(repoRoot, appDir)}`);
  console.log(`Changed files: ${changedFiles}`);
  console.log(`Total replacements: ${totalReplacements}`);
  if (dryRun) console.log('Dry run: no files written. Add --execute to apply changes.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
