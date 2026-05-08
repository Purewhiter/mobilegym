#!/usr/bin/env node
/**
 * Convert gettext-style strings.en.ts (Chinese → English) to named-key format.
 *
 * Input:  '中文': 'English',
 * Output:
 *   strings.ts:    key_name: '中文',
 *   strings.en.ts: key_name: 'English',
 *
 * Usage: node scripts/convert_gettext_to_named.mjs <appDir>
 *   e.g. node scripts/convert_gettext_to_named.mjs apps/RedBook
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const appDir = process.argv[2];
if (!appDir) {
  console.error('Usage: node scripts/convert_gettext_to_named.mjs <appDir>');
  process.exit(1);
}

const enPath = join(appDir, 'res/strings.en.ts');
const content = readFileSync(enPath, 'utf-8');

// Parse entries: section comments + key-value pairs
const lines = content.split('\n');
let currentSection = '';
const entries = [];
const usedKeys = new Set();

function toSnakeCase(str) {
  return str
    .replace(/[''""]/g, '')  // remove quotes
    .replace(/[&+]/g, '_and_')
    .replace(/[@#]/g, '_at_')
    .replace(/[^a-zA-Z0-9\s_]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function makeKey(en, section) {
  // Use English translation to generate key
  let base = toSnakeCase(en);

  // Truncate long keys
  if (base.length > 50) {
    base = base.substring(0, 50).replace(/_[^_]*$/, '');
  }

  // Ensure key doesn't start with a number (invalid JS identifier)
  if (/^\d/.test(base)) {
    base = 'n_' + base;
  }

  // Add section prefix for disambiguation if key is too generic
  if (base.length <= 3 || ['on', 'off', 'ok', 'me', 'all', 'more', 'done', 'send', 'save', 'edit', 'hot', 'new'].includes(base)) {
    const sectionPrefix = toSnakeCase(section);
    if (sectionPrefix && sectionPrefix !== base) {
      base = sectionPrefix + '_' + base;
    }
  }

  // Ensure unique
  let key = base;
  let i = 2;
  while (usedKeys.has(key)) {
    key = base + '_' + i;
    i++;
  }
  usedKeys.add(key);
  return key;
}

for (const line of lines) {
  // Section comment: // ── SectionName ──
  const sectionMatch = line.match(/\/\/\s*──\s*(.+?)\s*──/);
  if (sectionMatch) {
    currentSection = sectionMatch[1].trim();
    entries.push({ type: 'section', section: currentSection });
    continue;
  }

  // Comment-only line
  const commentMatch = line.match(/^\s*\/\/\s*(.+)/);
  if (commentMatch && !sectionMatch) {
    // Skip non-section comments but keep them
    entries.push({ type: 'comment', text: commentMatch[1] });
    continue;
  }

  // Key-value: '中文': 'English', or '中文': "English",
  // Also handle escaped quotes: 'won\'t': 'English',
  const kvMatch = line.match(/^\s*'((?:[^'\\]|\\.)*)'\s*:\s*['"](.+?)['"]\s*,?\s*$/) ||
                  line.match(/^\s*'((?:[^'\\]|\\.)*)'\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/);
  if (kvMatch) {
    const zh = kvMatch[1].replace(/\\'/g, "'");
    const en = kvMatch[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
    const key = makeKey(en, currentSection);
    entries.push({ type: 'entry', key, zh, en, section: currentSection });
    continue;
  }
}

// Generate strings.ts (named-key → Chinese)
const appName = appDir.split('/').pop();

let stringsTs = `/**
 * ${appName} 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {\n`;

for (const e of entries) {
  if (e.type === 'section') {
    stringsTs += `\n  // ── ${e.section} ──\n`;
  } else if (e.type === 'entry') {
    // Use double quotes if value contains single quote, else single quotes
    if (e.zh.includes("'")) {
      const zhEscaped = e.zh.replace(/"/g, '\\"');
      stringsTs += `  ${e.key}: "${zhEscaped}",\n`;
    } else {
      stringsTs += `  ${e.key}: '${e.zh}',\n`;
    }
  }
}

stringsTs += `} as const;

export type StringKey = keyof typeof strings;
`;

// Generate strings.en.ts (named-key → English)
let stringsEnTs = `/**
 * ${appName} 英文翻译 — 对应 AOSP res/values-en/strings.xml
 */
import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {\n`;

for (const e of entries) {
  if (e.type === 'section') {
    stringsEnTs += `\n  // ── ${e.section} ──\n`;
  } else if (e.type === 'entry') {
    // Use double quotes if value contains single quote, else single quotes
    if (e.en.includes("'")) {
      const enEscaped = e.en.replace(/"/g, '\\"');
      stringsEnTs += `  ${e.key}: "${enEscaped}",\n`;
    } else {
      stringsEnTs += `  ${e.key}: '${e.en}',\n`;
    }
  }
}

stringsEnTs += `};\n`;

// Write output
const outStrings = join(appDir, 'res/strings.ts');
const outStringsEn = join(appDir, 'res/strings.en.ts');

writeFileSync(outStrings, stringsTs);
writeFileSync(outStringsEn, stringsEnTs);

console.log(`Converted ${entries.filter(e => e.type === 'entry').length} entries`);
console.log(`  → ${outStrings}`);
console.log(`  → ${outStringsEn}`);

// Also output a summary of keys for review
const keysBySection = {};
for (const e of entries) {
  if (e.type === 'section') currentSection = e.section;
  if (e.type === 'entry') {
    if (!keysBySection[e.section]) keysBySection[e.section] = [];
    keysBySection[e.section].push(`${e.key}: '${e.zh}' → '${e.en}'`);
  }
}
console.log(`\nKey summary:`);
for (const [section, keys] of Object.entries(keysBySection)) {
  console.log(`  ${section}: ${keys.length} keys`);
}
