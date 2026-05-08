#!/usr/bin/env node
/**
 * scripts/reverse/verify_strings_vs_apk.mjs
 *
 * 将各 App 的 strings.ts 中文值与反编译 APK 的 strings.xml 进行交叉验证，
 * 报告：
 *   ❌ NOT_FOUND  — 找不到任何匹配（可能是 Agent 编造的字符串）
 *   ⚠️ PARTIAL    — 仅有子串匹配（简化/截断版本，需人工确认）
 *   ✅ EXACT      — 完全匹配
 *
 * Usage:
 *   node scripts/reverse/verify_strings_vs_apk.mjs                 # 检查所有有 APK 对应的 app
 *   node scripts/reverse/verify_strings_vs_apk.mjs Weather         # 只检查 Weather
 *   node scripts/reverse/verify_strings_vs_apk.mjs --show-partial  # 同时显示 PARTIAL 匹配
 *   node scripts/reverse/verify_strings_vs_apk.mjs --show-all      # 显示全部（包括 EXACT）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const APPS_DIR = path.join(ROOT, 'apps');
const DEC_DIR = path.join(ROOT, 'decompiled');

// ─── CLI ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const showPartial = argv.includes('--show-partial') || argv.includes('--show-all');
const showExact   = argv.includes('--show-all');
const filterApp   = argv.find(a => !a.startsWith('--')) ?? null;

// ─── App → Decompiled dir mapping ────────────────────────────────────────
const APP_TO_APK = {
  Alipay:          'Alipaygphone_decompiled',
  Calculator:      'Calculator_decompiled',
  Calendar:        'Calendar_decompiled',
  Clock:           'Deskclock_decompiled',
  Compass:         'Compass_decompiled',
  Contacts:        'Contacts_decompiled',
  FileManager:     'Fileexplorer_decompiled',
  Gallery:         'Gallery_decompiled',
  Notes:           'Notes_decompiled',
  Railway12306:    'Mobileticket_decompiled',
  RedBook:         'Xhs_decompiled',
  Settings:        'Settings_decompiled',
  Sms:             'Mms_decompiled',
  TencentMeeting:  'Wemeet_decompiled',
  ThemeStore:      'Thememanager_decompiled',
  Weather:         'Weather_decompiled',
  XiaomiNotes:     'Notes_decompiled',   // same APK, different simulation
};

// ─── Helpers ──────────────────────────────────────────────────────────────
const HAS_CJK = /[\u4e00-\u9fff\u3400-\u4dbf\uff01-\uffee]/;

/** Parse all string values from an APK strings.xml (and zh-rCN variant). */
function parseApkStrings(apkDir) {
  const values = new Set();
  const nameToValue = {};

  const xmlFiles = [
    path.join(apkDir, 'res', 'values', 'strings.xml'),
    path.join(apkDir, 'res', 'values-zh-rCN', 'strings.xml'),
  ];

  for (const f of xmlFiles) {
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf-8');

    // Match: <string name="key">value</string>
    // Also handles multiline and translatable="false"
    const re = /<string\s[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const name = m[1];
      const raw  = m[2];
      // Decode common XML entities
      const val  = raw
        .replace(/&amp;/g,  '&')
        .replace(/&lt;/g,   '<')
        .replace(/&gt;/g,   '>')
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\\n/g,    '\n')
        .trim();
      values.add(val);
      nameToValue[name] = val;
    }
  }

  return { values, nameToValue };
}

/** Parse ZH string values from strings.ts (returns key→value map). */
function parseStringsTs(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const src = fs.readFileSync(filePath, 'utf-8');
  const result = {};

  const reStr = /^[ \t]{2,}(\w+):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/gm;
  let m;
  while ((m = reStr.exec(src)) !== null) {
    result[m[1]] = (m[2] ?? m[3])
      .replace(/\\n/g, '\n').replace(/\\t/g, '\t')
      .replace(/\\'/g, "'").replace(/\\"/g, '"');
  }
  return result;
}

/**
 * Normalize a string for fuzzy comparison:
 *  - Remove trailing punctuation (…, ..., ！, ：等)
 *  - Collapse whitespace
 *  - Strip format placeholders (%s, %d, %1$s, etc.)
 */
function normalize(s) {
  return s
    .replace(/%\d*\$?[sdfe]/g, '')   // printf placeholders
    .replace(/\{[^}]*\}/g, '')       // {name} placeholders
    .replace(/[…\.]{2,}$/g, '')      // trailing ellipsis
    .replace(/[！。，：；、…]+$/g, '')   // trailing CJK punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Check if value appears in APK strings (exact, normalized-exact, or partial). */
function checkMatch(val, apkValues) {
  if (apkValues.has(val)) return 'exact';

  const norm = normalize(val);
  if (norm.length > 1) {
    // Normalized exact match (strips trailing ellipsis/punctuation)
    for (const av of apkValues) {
      if (normalize(av) === norm) return 'exact';
    }
    // Substring match: val is contained in an APK string, or APK string is contained in val
    for (const av of apkValues) {
      if (!HAS_CJK.test(av)) continue;  // skip non-Chinese APK values
      const normAv = normalize(av);
      if (normAv.length < 2) continue;
      if (normAv.includes(norm) || norm.includes(normAv)) return 'partial';
    }
  }
  return 'not_found';
}

// ─── Main ─────────────────────────────────────────────────────────────────
const appNames = Object.keys(APP_TO_APK)
  .filter(n => filterApp ? n.toLowerCase() === filterApp.toLowerCase() : true)
  .sort();

let grandTotal = 0, grandExact = 0, grandPartial = 0, grandNotFound = 0;

for (const appName of appNames) {
  const apkDirName = APP_TO_APK[appName];
  const apkDir     = path.join(DEC_DIR, apkDirName);
  const tsPath     = path.join(APPS_DIR, appName, 'res', 'strings.ts');

  if (!fs.existsSync(apkDir)) {
    console.log(`⚠️  ${appName}: APK 目录不存在 (${apkDirName})`);
    continue;
  }
  if (!fs.existsSync(tsPath)) {
    console.log(`⚠️  ${appName}: 缺少 strings.ts`);
    continue;
  }

  const { values: apkValues } = parseApkStrings(apkDir);
  const zhStrings = parseStringsTs(tsPath);

  // Only check keys with Chinese values
  const chineseEntries = Object.entries(zhStrings)
    .filter(([, v]) => HAS_CJK.test(v));

  const notFound = [], partial = [], exact = [];
  for (const [key, val] of chineseEntries) {
    const result = checkMatch(val, apkValues);
    if (result === 'exact')     exact.push({ key, val });
    else if (result === 'partial') partial.push({ key, val });
    else                        notFound.push({ key, val });
  }

  const total = chineseEntries.length;
  grandTotal    += total;
  grandExact    += exact.length;
  grandPartial  += partial.length;
  grandNotFound += notFound.length;

  const pctExact   = total ? Math.round(exact.length   / total * 100) : 0;
  const pctNotFound = total ? Math.round(notFound.length / total * 100) : 0;

  // Only show apps with issues (or everything if --show-all)
  const hasIssues = notFound.length > 0 || (showPartial && partial.length > 0);
  if (!hasIssues && !showExact) continue;

  console.log(`\n${'─'.repeat(66)}`);
  const statusIcon = notFound.length > 10 ? '❌' : notFound.length > 0 ? '⚠️ ' : '✅';
  console.log(`${statusIcon} ${appName}  (中文字符串 ${total} 条  ✅ ${exact.length}完全匹配 / ⚠️  ${partial.length}部分匹配 / ❌ ${notFound.length}未找到)`);
  console.log(`   APK: ${apkDirName}  覆盖率: ${pctExact}%  未匹配率: ${pctNotFound}%`);

  for (const { key, val } of notFound) {
    console.log(`   ❌ [${key}]  "${val}"`);
  }
  if (showPartial) {
    for (const { key, val } of partial) {
      console.log(`   ⚠️  [${key}]  "${val}"`);
    }
  }
  if (showExact) {
    for (const { key, val } of exact.slice(0, 10)) {
      console.log(`   ✅ [${key}]  "${val}"`);
    }
    if (exact.length > 10) console.log(`   ✅ ... 和 ${exact.length - 10} 条完全匹配（省略）`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(66)}`);
console.log(`📊 对比汇总（App strings.ts vs 反编译 APK strings.xml）`);
console.log(`   检查 App 数  ：${appNames.length}`);
console.log(`   中文字符串总数：${grandTotal}`);
console.log(`   ✅ 完全匹配  ：${grandExact}  (${grandTotal ? Math.round(grandExact/grandTotal*100) : 0}%)`);
console.log(`   ⚠️  部分匹配  ：${grandPartial}  (${grandTotal ? Math.round(grandPartial/grandTotal*100) : 0}%)`);
console.log(`   ❌ 未找到    ：${grandNotFound}  (${grandTotal ? Math.round(grandNotFound/grandTotal*100) : 0}%)`);
console.log(`   （部分匹配 = strings.ts 值是 APK 字符串的截短/简化版本）`);
console.log(`   （未找到   = APK 中找不到近似内容，可能由 Agent 编造）`);
console.log('═'.repeat(66));

if (grandNotFound > 0) process.exit(1);
