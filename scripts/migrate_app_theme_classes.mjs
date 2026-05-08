#!/usr/bin/env node
/**
 * Migrate Tailwind arbitrary hex classes to semantic app theme tokens.
 *
 * Rewrites (only exact matches against apps/<App>/manifest.ts theme.colors hex):
 *   bg-[#rrggbb]        -> bg-app-primary (etc)
 *   text-[#rrggbb]/20   -> text-app-primary/20 (etc)
 *   border-[#rrggbb]    -> border-app-border (when matches manifest.theme.colors.border)
 *
 * Usage:
 *   node scripts/migrate_app_theme_classes.mjs <AppDirName> [--dry-run]
 *
 * Example:
 *   node scripts/migrate_app_theme_classes.mjs Spotify --dry-run
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import * as ts from 'typescript';

function usage() {
  console.log('Usage: node scripts/migrate_app_theme_classes.mjs <AppDirName> [--dry-run]');
  console.log('Example: node scripts/migrate_app_theme_classes.mjs Spotify --dry-run');
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

function getProp(obj, name) {
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue;
    const n = p.name;
    if (ts.isIdentifier(n) && n.text === name) return p.initializer;
    if (ts.isStringLiteral(n) && n.text === name) return p.initializer;
  }
  return null;
}

function extractThemeColorsFromManifest(sourceFile) {
  let manifestObj = null;

  const visit = (node) => {
    if (ts.isVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name) && node.name.text === 'manifest') {
        if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
          manifestObj = node.initializer;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  if (!manifestObj) return null;
  const themeInit = getProp(manifestObj, 'theme');
  if (!themeInit || !ts.isObjectLiteralExpression(themeInit)) return null;
  const colorsInit = getProp(themeInit, 'colors');
  if (!colorsInit || !ts.isObjectLiteralExpression(colorsInit)) return null;

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
  for (const k of keys) {
    const init = getProp(colorsInit, k);
    if (!init) continue;
    if (!ts.isStringLiteral(init)) continue;
    const hex = normalizeHex(init.text);
    if (!hex) continue;
    out[k] = hex;
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

async function main() {
  const argv = process.argv.slice(2);
  const appArg = argv.find(a => a && !a.startsWith('-'));
  const dryRun = argv.includes('--dry-run');
  if (!appArg) {
    usage();
    process.exit(2);
  }

  const repoRoot = process.cwd();
  const appDir = appArg.includes(path.sep) ? path.resolve(repoRoot, appArg) : path.resolve(repoRoot, 'apps', appArg);
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

  const sourceFile = ts.createSourceFile(manifestPath, manifestSrc, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const themeColors = extractThemeColorsFromManifest(sourceFile);
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
  if (dryRun) console.log('Dry run: no files written.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
