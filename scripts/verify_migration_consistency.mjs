#!/usr/bin/env node
/**
 * 迁移一致性验证（通用）：将当前代码中的变量替换为 res 中的原始值，再与旧代码对比是否一致。
 *
 * 适用于任意 App（--app=<AppName>），只要该 App 使用 apps/<AppName>/res/colors.ts、dimens.ts，
 * 且 Tier-1 语义类名遵循项目约定（bg-app-surface、text-app-text、border-app-border）。
 *
 * 流程：
 *   1. 当前：(--app-xxx) 按 res 展开为字面量；gray/white 规范为语义名或 [#hex]
 *   2. 旧代码：灰阶→[#hex]，Tier-1 字面量→语义名，已有 (--app-xxx) 同样展开
 *   3. 逐文件比较「展开/规范后的 className、style」多集合是否一致
 *
 * 用法：
 *   node scripts/verify_migration_consistency.mjs --app=<AppName> [--before=HEAD~1] [--diff]
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// 与 migrate 脚本共用：Tailwind 全色板
const TAILWIND_PALETTES = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts', 'tailwind-palette.json'), 'utf-8')
);

const args = process.argv.slice(2);
const appArg = args.find((a) => a.startsWith('--app='));
const beforeArg = args.find((a) => a.startsWith('--before='));
const showDiff = args.includes('--diff');
const targetApp = appArg?.split('=')[1];
const gitRef = beforeArg ? beforeArg.split('=')[1] : 'HEAD~1';

if (!targetApp) {
  console.error('用法: node scripts/verify_migration_consistency.mjs --app=<AppName> [--before=HEAD~1] [--diff]');
  process.exit(1);
}

const APP_ROOT = join(process.cwd(), 'apps', targetApp);
const APP_REL = join('apps', targetApp);

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

function listTsxFiles(dir, base = '', acc = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!e.name.startsWith('.') && e.name !== 'node_modules') listTsxFiles(full, rel, acc);
      continue;
    }
    if (e.name.endsWith('.tsx')) acc.push(rel);
  }
  return acc;
}

function parseColorsTs() {
  const path = join(APP_ROOT, 'res/colors.ts');
  const content = readFileSync(path, 'utf-8');
  const map = {};
  const re = /(?:'([^']+)'|([a-zA-Z_][a-zA-Z0-9_]*)):\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const key = m[1] ?? m[2];
    const value = m[3].trim().toLowerCase();
    if (!key) continue;
    map[key] = value;
    const kebab = key.replace(/_/g, '-').toLowerCase();
    if (kebab !== key) map[kebab] = value;
  }
  return map;
}

function parseDimensTs() {
  const path = join(APP_ROOT, 'res/dimens.ts');
  const content = readFileSync(path, 'utf-8');
  const byKebab = {};
  const re = /([a-zA-Z_][a-zA-Z0-9_]*):\s*(\d+)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    byKebab[toKebabCase(m[1])] = parseInt(m[2], 10);
  }
  return byKebab;
}

const SKIP_DIMENS = new Set([
  'duration-short', 'easing-standard', 'primary', 'primary-dark', 'on-primary',
  'secondary', 'accent', 'bg', 'surface', 'on-surface', 'text', 'text-muted', 'border', 'tab-bar-bg',
]);

const colorsMap = parseColorsTs();
const dimensByKebab = parseDimensTs();

// 规范化 hex：统一为 6 位小写，便于 #555 与 #555555 视为相同
function normHex(hex) {
  let h = String(hex).replace(/^#/, '').toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return '#' + h;
}

// 在 class 字符串中把 3 位 hex 统一成 6 位并小写，避免 #555 vs #555555 或 #D1A056 vs #d1a056 误判
function normalizeHexInClassString(s) {
  return s
    .replace(/#([0-9a-fA-F]{3})\b/g, (_, three) => {
      const six = three.split('').map((c) => c + c).join('').toLowerCase();
      return '#' + six;
    })
    .replace(/#([0-9a-fA-F]{6})\b/g, (_, six) => '#' + six.toLowerCase());
}

/**
 * 将当前代码中的 (--app-xxx) 按 res 展开为字面量；未迁移的 gray-X 规范为 [#hex] 便于与旧代码同一形式比较
 */
function expandCurrentContent(content) {
  let out = content;
  const varRe = /([a-zA-Z][a-zA-Z0-9-]*)-\((--app-[a-z0-9-]+)\)/g;
  out = out.replace(varRe, (_, prefix, varName) => {
    const suffix = varName.replace(/^--app-(?:c(?:s)?-)?/, '');
    const key = suffix.replace(/_/g, '-').toLowerCase();
    if (varName.startsWith('--app-c-') || varName.startsWith('--app-cs-')) {
      const value = colorsMap[key];
      if (value !== undefined) return `${prefix}-[${normHex(value)}]`;
      return _;
    }
    if (SKIP_DIMENS.has(suffix)) return _;
    const num = dimensByKebab[suffix];
    if (num !== undefined) return `${prefix}-[${num}px]`;
    return _;
  });
  out = out.replace(/var\((--app-[a-z0-9-]+)\)/g, (_, varName) => {
    const suffix = varName.replace(/^--app-(?:c(?:s)?-)?/, '');
    const key = suffix.replace(/_/g, '-').toLowerCase();
    if (varName.startsWith('--app-c-') || varName.startsWith('--app-cs-')) {
      const value = colorsMap[key];
      if (value !== undefined) return normHex(value);
    }
    if (!SKIP_DIMENS.has(suffix)) {
      const num = dimensByKebab[suffix];
      if (num !== undefined) return `${num}px`;
    }
    return _;
  });
  // 全 Tailwind 色板：type-<palette>-<shade> → type-[#hex]
  for (const [paletteName, shades] of Object.entries(TAILWIND_PALETTES)) {
    const re = new RegExp(`\\b(text|bg|border|placeholder)(-[a-z]+)?-${paletteName}-(\\d+)(?!\\/)(\\/(\\d+))?`, 'g');
    out = out.replace(re, (_, type, mid, shade, _frac, fracVal) => {
      const hex = shades[shade];
      if (hex) return fracVal ? `${type}${mid || ''}-[${hex}]/${fracVal}` : `${type}${mid || ''}-[${normHex(hex)}]`;
      return _;
    });
  }
  // 当前中未迁移的 Tier-1 字面量统一为语义名，与 normalizeOldContent 一致
  out = out.replace(/\bbg-white(\/\d+)?\b/g, 'bg-app-surface$1');
  out = out.replace(/\btext-gray-900\b/g, 'text-app-text');
  out = out.replace(/\btext-gray-800\b/g, 'text-app-text');
  out = out.replace(/\bborder-gray-200\b/g, 'border-app-border');
  // 展开后与 gray-900/800 等价的 hex 也统一为 text-app-text，便于与旧代码一致
  out = out.replace(/\btext-\[#111827\]/g, 'text-app-text');
  out = out.replace(/\btext-\[#1f2937\]/g, 'text-app-text');
  return out;
}

/**
 * 将旧代码规范为与「展开后当前」可比的形式：先统一 Tier-1 语义名，再灰阶→[#hex]
 */
function normalizeOldContent(content) {
  let out = content;
  // 先做 Tier-1，避免 text-gray-900 被下面的 grayRe 变成 text-[#111827]
  out = out.replace(/\bbg-white\b/g, 'bg-app-surface');
  out = out.replace(/\btext-gray-900\b/g, 'text-app-text');
  out = out.replace(/\btext-gray-800\b/g, 'text-app-text');
  out = out.replace(/\bborder-gray-200\b/g, 'border-app-border');
  out = out.replace(/\btext-\[#111827\]\b/g, 'text-app-text');
  // 全 Tailwind 色板
  for (const [paletteName, shades] of Object.entries(TAILWIND_PALETTES)) {
    const re = new RegExp(`\\b(text|bg|border|placeholder)(-[a-z]+)?-${paletteName}-(\\d+)(?:\/(\\d+))?`, 'g');
    out = out.replace(re, (_, type, mid, shade, frac) => {
      const hex = shades[shade];
      if (hex) return frac ? `${type}${mid || ''}-[${hex}]/${frac}` : `${type}${mid || ''}-[${hex}]`;
      return _;
    });
  }
  return out;
}

// 从内容中提取所有 className / style 的取值；含 ${} 的模板串统一替换为占位符，便于与旧代码一一比较
function extractClassAndStyleStrings(content) {
  const list = [];
  // className="..." 或 className='...'（无插值）
  let re = /className=(["'])([\s\S]*?)\1/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    list.push(m[2].replace(/\s+/g, ' ').trim());
  }
  // className={`...`}：去掉反引号，将 ${...}（含嵌套）替换为占位符，使字面量部分可比较
  re = /className=\{(`[\s\S]*?`)\}/g;
  while ((m = re.exec(content)) !== null) {
    let s = m[1].slice(1, -1); // 去掉首尾反引号
    while (s.includes('${')) {
      s = s.replace(/\$\{[\s\S]*?\}/g, '__EXPR__');
    }
    list.push(s.replace(/\s+/g, ' ').trim());
  }
  // style={{ ... }} 中含 var(--app-xxx) 的
  re = /style=\{\{([\s\S]*?)\}\}/g;
  while ((m = re.exec(content)) !== null) {
    const s = m[1].replace(/\s+/g, ' ').trim();
    if (s.includes('--app-')) list.push(s);
  }
  return list;
}

// 将 class 字符串内的 token 按空格分并排序，再拼回，使顺序无关
function canonicalizeClassString(s) {
  return s
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

// 对提取出的 class/style 字符串做展开或规范化后排序，得到可比较的「多集合」
function toComparableList(strings, expandOrNormalize) {
  const out = strings
    .map((s) => expandOrNormalize(s))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(normalizeHexInClassString) // #555 与 #555555 统一为 6 位再比
    .map(canonicalizeClassString);
  return out.sort();
}

const tsxFiles = listTsxFiles(APP_ROOT).map((f) => f.replace(/\\/g, '/'));
const relPaths = tsxFiles.map((f) => join(APP_REL, f).replace(/\\/g, '/'));

console.log('━'.repeat(60));
console.log(`迁移一致性验证（展开后与旧代码一一对比）- ${targetApp}`);
console.log(`对比基准：当前变量展开为字面量 vs git ${gitRef}（旧代码灰阶规范为 [#hex]）`);
console.log('  仅比较各文件中 className / style 取值（提取→展开/规范化→排序）');
console.log('━'.repeat(60));
console.log('');

let hasError = false;
const mismatches = [];

for (let i = 0; i < relPaths.length; i++) {
  const rel = relPaths[i];
  const localPath = join(process.cwd(), rel);
  let oldContent = '';
  try {
    oldContent = execSync(`git show "${gitRef}:${rel}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  } catch {
    oldContent = '';
  }
  const currentContent = readFileSync(localPath, 'utf-8');

  const currentStrings = extractClassAndStyleStrings(currentContent);
  const oldStrings = extractClassAndStyleStrings(oldContent);

  const expandedCurrent = toComparableList(currentStrings, expandCurrentContent);
  // 旧代码先规范化 gray/white，再展开可能已有的 (--app-xxx)，使两边同一形式
  const normalizedOld = toComparableList(oldStrings, (s) => expandCurrentContent(normalizeOldContent(s)));

  const same =
    expandedCurrent.length === normalizedOld.length &&
    expandedCurrent.every((s, j) => s === normalizedOld[j]);
  if (!same) {
    mismatches.push({ rel, expandedCurrent, normalizedOld });
    hasError = true;
  }
}

if (mismatches.length) {
  console.log('📋 与旧代码不一致的文件（展开/规范化后仍不同）');
  console.log('─'.repeat(60));
  mismatches.forEach((m) => console.log(`  ${typeof m === 'string' ? m : m.rel}`));
  if (showDiff && mismatches[0] && typeof mismatches[0] === 'object') {
    const { rel, expandedCurrent, normalizedOld } = mismatches[0];
    console.log('');
    console.log('--- 首个文件差异示例:', rel, '---');
    console.log('当前(展开) 条数:', expandedCurrent.length, '| 旧(规范) 条数:', normalizedOld.length);
    const onlyCurrent = expandedCurrent.filter((s) => !normalizedOld.includes(s));
    const onlyOld = normalizedOld.filter((s) => !expandedCurrent.includes(s));
    if (onlyCurrent.length) console.log('仅当前有:', onlyCurrent.slice(0, 5).join(' | '));
    if (onlyOld.length) console.log('仅旧有:', onlyOld.slice(0, 5).join(' | '));
  }
  console.log('');
  console.log('说明：当前代码中 (--app-xxx) 已按 res 展开为字面量，旧代码中 gray-X 已规范为 [#hex]。');
  console.log('若仍不同，可能是：1) 迁移时值被改过 2) 旧代码中还有未规范的形式 3) 其他非 res 的改动。');
  console.log('可加 --diff 查看首个文件的详细差异。');
  console.log('');
}

console.log('━'.repeat(60));
if (!hasError) {
  console.log(`✅ 迁移一致性验证通过：所有文件在「变量展开 / 灰阶规范化」后与 ${gitRef} 一致`);
} else {
  console.log(`❌ 共 ${mismatches.length} 个文件与 ${gitRef} 不一致`);
  process.exit(1);
}
console.log('━'.repeat(60));
