#!/usr/bin/env node
/**
 * 将 gettext 风格 t('中文') 调用替换为 named-key s.key 引用。
 *
 * 用法: node scripts/replace_t_calls.mjs <appDir> [--dry-run]
 *   e.g. node scripts/replace_t_calls.mjs apps/RedBook
 *        node scripts/replace_t_calls.mjs apps/RedBook --dry-run
 *
 * 做的事情:
 * 1. 读 res/strings.ts，建立 {中文值 → key名} 映射
 * 2. 扫描 app 目录下所有 .tsx/.ts 文件（排除 res/ 和 data/）
 * 3. 替换 import { useXxxT } → import { strings } + import { stringsEn } + import { useAppStrings }
 * 4. 替换 const t = useXxxT() → const s = useAppStrings(strings, stringsEn)
 * 5. 替换 t('中文') → s.key
 * 6. 替换 t("中文") → s.key
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';

const appDir = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!appDir) {
  console.error('Usage: node scripts/replace_t_calls.mjs <appDir> [--dry-run]');
  process.exit(1);
}

// ── Step 1: 读 strings.ts，建立 中文值→key 映射 ──────────────────
const stringsPath = join(appDir, 'res/strings.ts');
const stringsContent = readFileSync(stringsPath, 'utf-8');

const zhToKey = new Map();
// 匹配: key: '中文值', 或 key: "中文值",
const entryRe = /^\s+(\w+):\s*['"](.+?)['"]\s*,?\s*$/gm;
let m;
while ((m = entryRe.exec(stringsContent)) !== null) {
  const key = m[1];
  const zh = m[2];
  // 跳过纯英文/符号值（如 Calculator2 的 sin, cos）
  if (/[\u4e00-\u9fff]/.test(zh) || zh.includes('：') || zh.includes('～')) {
    if (!zhToKey.has(zh)) {
      zhToKey.set(zh, key);
    }
  }
}

console.log(`Loaded ${zhToKey.size} zh→key mappings from ${stringsPath}`);

// ── Step 2: 找到 app 名和 hook 名 ─────────────────────────────────
const appName = appDir.split('/').pop();
const hookNameRe = /export function (use\w+T)\(\)/;
const hookMatch = stringsContent.match(hookNameRe);
// 也检查旧 strings.ts（可能 hook 在 gettext 版本）
let hookName = hookMatch?.[1];
if (!hookName) {
  // 扫描所有文件找 useXxxT 的使用
  const files = getAllFiles(appDir);
  for (const f of files) {
    const c = readFileSync(f, 'utf-8');
    const m2 = c.match(/import\s*\{\s*(use\w+T)\s*\}\s*from/);
    if (m2) { hookName = m2[1]; break; }
  }
}

if (!hookName) {
  console.log('No useXxxT hook found — nothing to replace.');
  process.exit(0);
}

console.log(`Found hook: ${hookName}`);

// ── Step 3: 扫描并替换所有 TS/TSX 文件 ────────────────────────────
function getAllFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // 跳过 res/, data/, node_modules
      if (['res', 'data', 'node_modules', 'assets'].includes(entry)) continue;
      results.push(...getAllFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      results.push(full);
    }
  }
  return results;
}

const files = getAllFiles(appDir);
let totalReplacements = 0;
let modifiedFiles = 0;

for (const filePath of files) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;

  // 检查是否使用了该 hook
  if (!content.includes(hookName)) continue;

  // ── 替换 import ──
  // import { useXxxT } from '../res/strings';
  // → import { strings } from '../res/strings';
  //   import { stringsEn } from '../res/strings.en';
  //   import { useAppStrings } from '@/os/useAppStrings';
  const relDir = dirname(relative(filePath, join(appDir, 'res/strings')));
  // 计算相对路径
  const fileDir = dirname(filePath);
  const resDir = join(appDir, 'res');
  let relPath = relative(fileDir, resDir).replace(/\\/g, '/');
  if (!relPath.startsWith('.')) relPath = './' + relPath;

  const importRe = new RegExp(
    `import\\s*\\{\\s*${hookName}\\s*\\}\\s*from\\s*['"]([^'"]+)['"]\\s*;?`,
  );
  const importMatch = content.match(importRe);
  if (importMatch) {
    const oldImport = importMatch[0];
    const newImport = [
      `import { strings } from '${relPath}/strings';`,
      `import { stringsEn } from '${relPath}/strings.en';`,
      `import { useAppStrings } from '@/os/useAppStrings';`,
    ].join('\n');
    content = content.replace(oldImport, newImport);
  }

  // ── 替换 hook 调用 ──
  // const t = useXxxT();  →  const s = useAppStrings(strings, stringsEn);
  const hookCallRe = new RegExp(`const\\s+t\\s*=\\s*${hookName}\\(\\)\\s*;?`);
  content = content.replace(hookCallRe, 'const s = useAppStrings(strings, stringsEn);');

  // ── 替换 t('中文') / t("中文") → s.key ──
  let replacements = 0;
  // 匹配 t('...') 和 t("...")
  content = content.replace(/\bt\(['"]([^'"]+)['"]\)/g, (match, zhValue) => {
    const key = zhToKey.get(zhValue);
    if (key) {
      replacements++;
      return `s.${key}`;
    }
    // 没找到映射，保持原样
    console.warn(`  ⚠ No key for: t('${zhValue}') in ${relative('.', filePath)}`);
    return match;
  });

  totalReplacements += replacements;

  if (content !== original) {
    modifiedFiles++;
    if (dryRun) {
      console.log(`[dry-run] Would modify: ${relative('.', filePath)} (${replacements} replacements)`);
    } else {
      writeFileSync(filePath, content);
      console.log(`Modified: ${relative('.', filePath)} (${replacements} replacements)`);
    }
  }
}

console.log(`\nDone: ${totalReplacements} replacements in ${modifiedFiles} files`);
if (dryRun) console.log('(dry-run mode — no files were written)');
