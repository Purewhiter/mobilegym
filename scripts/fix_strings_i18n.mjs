#!/usr/bin/env node
/**
 * 修复字符串 i18n - 把 strings 改为 useAppStrings 方式
 * 
 * 修复:
 *   import { strings } from '@/apps/Xxx/res/strings'; (or @/system/Xxx/res/strings)
 *   // 使用 strings.xxx
 * 
 * 改为:
 *   import { strings } from '../res/strings';
 *   import { stringsEn } from '../res/strings.en';
 *   import { useAppStrings } from '@/os/useAppStrings';
 *   // const s = useAppStrings(strings, stringsEn);
 *   // 使用 s.xxx
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function resolveAppDir(appName) {
  for (const base of ['apps', 'system']) {
    const dir = path.join(ROOT, base, appName);
    if (fs.existsSync(dir)) return { base, dir };
  }
  return null;
}

function fixFile(file, appName, appBase, appDir) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // 检查是否有脚本添加的 import (支持 apps/ 和 system/)
  const importPattern = `import { strings } from '@/${appBase}/${appName}/res/strings'`;
  if (!content.includes(importPattern)) {
    return false;
  }
  
  let newContent = content;
  
  // 1. 替换 import 语句
  newContent = newContent.replace(
    `${importPattern};`,
    `import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';`
  );
  
  // 对于深层目录，需要调整相对路径
  const relPath = path.relative(appDir, file);
  const depth = (relPath.match(/\//g) || []).length;
  const relPrefix = depth > 1 ? '../'.repeat(depth - 1) : '';
  
  if (depth > 1) {
    newContent = newContent.replace(
      `import { strings } from '../res/strings';`,
      `import { strings } from '${relPrefix}../res/strings';`
    );
    newContent = newContent.replace(
      `import { stringsEn } from '../res/strings.en';`,
      `import { stringsEn } from '${relPrefix}../res/strings.en';`
    );
  }
  
  // 2. 在组件函数内部添加 useAppStrings 调用
  // 找到 React.FC 或 function 组件的开头
  const patterns = [
    // const Xxx: React.FC = () => {
    /const \w+:\s*React\.FC[^=]*=\s*\([^)]*\)\s*=>\s*{/,
    // export const Xxx: React.FC = () => {
    /export const \w+:\s*React\.FC[^=]*=\s*\([^)]*\)\s*=>\s*{/,
    // function Xxx() {
    /function \w+\s*\([^)]*\)\s*{/,
    // export function Xxx() {
    /export function \w+\s*\([^)]*\)\s*{/,
  ];
  
  let matched = false;
  for (const pattern of patterns) {
    const match = newContent.match(pattern);
    if (match && !newContent.includes('useAppStrings(strings, stringsEn)')) {
      const insertPos = match.index + match[0].length;
      newContent = 
        newContent.slice(0, insertPos) + 
        '\n  const s = useAppStrings(strings, stringsEn);' + 
        newContent.slice(insertPos);
      matched = true;
      break;
    }
  }
  
  // 3. 替换 strings.xxx 为 s.xxx
  newContent = newContent.replace(/\bstrings\.(\w+)/g, 's.$1');
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf-8');
    return true;
  }
  return false;
}

function getAllTsxFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main
const args = process.argv.slice(2);
const appName = args[0];

if (!appName) {
  console.log('用法: node scripts/fix_strings_i18n.mjs <AppName>');
  process.exit(1);
}

console.log(`\n🔧 修复 i18n: ${appName}\n`);

const resolved = resolveAppDir(appName);
if (!resolved) {
  console.error(`❌ 找不到 apps/${appName} 或 system/${appName}`);
  process.exit(1);
}
const appDir = resolved.dir;
const appBase = resolved.base;
const files = getAllTsxFiles(appDir);

let fixedCount = 0;
for (const file of files) {
  if (file.includes('/res/')) continue;
  
  if (fixFile(file, appName, appBase, appDir)) {
    const relPath = path.relative(ROOT, file);
    console.log(`  ✓ ${relPath}`);
    fixedCount++;
  }
}

console.log(`\n✅ 修复了 ${fixedCount} 个文件`);
