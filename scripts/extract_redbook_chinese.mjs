#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const DIR = path.resolve('apps/RedBook');
const EN_PATH = path.join(DIR, 'i18n', 'en.ts');

const enContent = fs.readFileSync(EN_PATH, 'utf8');
const existingKeys = new Set();
let m;
const keyRegex = /^\s*'([^']+)'/gm;
while ((m = keyRegex.exec(enContent)) !== null) existingKeys.add(m[1]);

const allFiles = [];
function walkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full);
    else if (entry.name.endsWith('.tsx')) allFiles.push(full);
  }
}
walkDir(DIR);

const untranslated = allFiles.filter(f => {
  const src = fs.readFileSync(f, 'utf8');
  return !src.includes('useRedBookT') && /[\u4e00-\u9fff]/.test(src);
});

const chineseStrings = new Map();
for (const file of untranslated) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const rel = path.relative(DIR, file);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
    if (trimmed.startsWith('import ')) continue;
    const strRegex = /(?:['"])([^'"]{1,80})(?:['"])/g;
    while ((m = strRegex.exec(line)) !== null) {
      const s = m[1].trim();
      if (!s || !/[\u4e00-\u9fff]/.test(s)) continue;
      if (s.includes('=>') || s.includes('const ') || s.includes('.tsx')) continue;
      if (!chineseStrings.has(s)) chineseStrings.set(s, new Set());
      chineseStrings.get(s).add(rel);
    }
    const jsxRegex = />([^<>{]{1,60})</g;
    while ((m = jsxRegex.exec(line)) !== null) {
      let s = m[1].trim();
      if (!s || !/[\u4e00-\u9fff]/.test(s)) continue;
      if (s.includes('{') || s.includes('}') || s.includes('$')) continue;
      if (!chineseStrings.has(s)) chineseStrings.set(s, new Set());
      chineseStrings.get(s).add(rel);
    }
  }
}

const missing = [];
for (const [str, files] of chineseStrings) {
  if (!existingKeys.has(str)) missing.push({ str, files: [...files] });
}
missing.sort((a, b) => a.str.localeCompare(b.str, 'zh-Hans-CN'));

console.log(`Files: ${untranslated.length}, Strings: ${chineseStrings.size}, In dict: ${chineseStrings.size - missing.length}, Missing: ${missing.length}`);
if (missing.length > 0) {
  console.log('\n--- MISSING ---\n');
  for (const { str, files } of missing) console.log(`  '${str.replace(/'/g, "\\'")}': '',  // ${files.join(', ')}`);
}
