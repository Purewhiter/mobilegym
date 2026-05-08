#!/usr/bin/env node
/**
 * Extract clean Chinese UI strings from untranslated Alipay files.
 * Focuses on actual user-visible text, not code/comments.
 */
import fs from 'fs';
import path from 'path';

const ALIPAY_DIR = path.resolve('apps/Alipay');
const EN_PATH = path.join(ALIPAY_DIR, 'i18n', 'en.ts');

// Read existing dictionary keys
const enContent = fs.readFileSync(EN_PATH, 'utf8');
const existingKeys = new Set();
const keyRegex = /^\s*'([^']+)'/gm;
let m;
while ((m = keyRegex.exec(enContent)) !== null) {
  existingKeys.add(m[1]);
}

// Find all .tsx files that DON'T import from i18n
const allFiles = [];
function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full);
    else if (entry.name.endsWith('.tsx')) allFiles.push(full);
  }
}
walkDir(ALIPAY_DIR);

const untranslated = allFiles.filter(f => {
  const src = fs.readFileSync(f, 'utf8');
  return !src.includes('useAlipayT') && /[\u4e00-\u9fff]/.test(src);
});

const chineseStrings = new Map(); // string -> Set<file>

for (const file of untranslated) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const rel = path.relative(ALIPAY_DIR, file);

  for (const line of lines) {
    // Skip comment-only lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    // Skip import lines
    if (trimmed.startsWith('import ')) continue;

    // Extract string literals with Chinese chars (single or double quoted)
    const strRegex = /(?:['"])([^'"]{1,80})(?:['"])/g;
    while ((m = strRegex.exec(line)) !== null) {
      const s = m[1].trim();
      if (!s || !/[\u4e00-\u9fff]/.test(s)) continue;
      // Skip if it looks like code/regex
      if (s.includes('=>') || s.includes('const ') || s.includes('import ') || s.includes('function ')) continue;
      if (s.includes('.tsx') || s.includes('.ts') || s.includes('.js')) continue;
      if (!chineseStrings.has(s)) chineseStrings.set(s, new Set());
      chineseStrings.get(s).add(rel);
    }

    // Extract JSX text content: >Chinese text< (only short ones)
    const jsxRegex = />([^<>{]{1,60})</g;
    while ((m = jsxRegex.exec(line)) !== null) {
      let s = m[1].trim();
      if (!s || !/[\u4e00-\u9fff]/.test(s)) continue;
      // Skip template expressions
      if (s.includes('{') || s.includes('}') || s.includes('$')) continue;
      if (!chineseStrings.has(s)) chineseStrings.set(s, new Set());
      chineseStrings.get(s).add(rel);
    }
  }
}

// Find strings NOT in existing dictionary
const missing = [];
for (const [str, files] of chineseStrings) {
  if (!existingKeys.has(str)) {
    missing.push({ str, files: [...files] });
  }
}

missing.sort((a, b) => a.str.localeCompare(b.str, 'zh-Hans-CN'));

console.log(`Files scanned: ${untranslated.length}`);
console.log(`Unique Chinese UI strings: ${chineseStrings.size}`);
console.log(`Already in dictionary: ${chineseStrings.size - missing.length}`);
console.log(`Need translation: ${missing.length}`);
console.log(`\n--- MISSING ---\n`);

for (const { str, files } of missing) {
  console.log(`  '${str.replace(/'/g, "\\'")}': '',  // ${files.join(', ')}`);
}
