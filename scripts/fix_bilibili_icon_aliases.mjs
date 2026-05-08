#!/usr/bin/env node
/**
 * 修复 Bilibili 的图标别名问题
 * 将 `const ChevronLeft = IcNavBack` + `<ChevronLeft size={24} />`
 * 改为直接使用 `<IcNavBack size={24} />`
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BILIBILI_DIR = resolve(__dirname, '..', 'apps', 'Bilibili');

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

console.log(`模式: ${dryRun ? '预览 (添加 --execute 执行)' : '执行'}`);
console.log('');

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const path = join(dir, file);
    const stat = statSync(path);
    if (stat.isDirectory() && file !== 'node_modules' && file !== 'res') {
      walkDir(path, callback);
    } else if (file.endsWith('.tsx')) {
      callback(path);
    }
  }
}

let totalFiles = 0;
let totalReplacements = 0;

walkDir(BILIBILI_DIR, (filePath) => {
  let content = readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  // 找到别名定义行: const ChevronLeft = IcNavBack, Search = IcSearch, ...
  const aliasLineRegex = /^const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*(Ic[A-Z][a-zA-Z0-9]*)/gm;
  
  // 收集别名映射: { 'ChevronLeft': 'IcNavBack', 'Search': 'IcSearch', ... }
  const aliasMap = {};
  let match;
  
  // 处理多种格式:
  // 1. const Search = IcSearch, Grid = IcGrid;
  // 2. const Search = IcSearch;
  const fullAliasLineRegex = /^const\s+([^;]+);?\s*$/gm;
  
  while ((match = fullAliasLineRegex.exec(content)) !== null) {
    const declarations = match[1];
    // 解析逗号分隔的声明
    const pairRegex = /([A-Z][a-zA-Z0-9]*)\s*=\s*(Ic[A-Z][a-zA-Z0-9]*)/g;
    let pairMatch;
    while ((pairMatch = pairRegex.exec(declarations)) !== null) {
      aliasMap[pairMatch[1]] = pairMatch[2];
    }
  }
  
  if (Object.keys(aliasMap).length === 0) {
    return; // 没有别名定义
  }
  
  const relPath = filePath.replace(BILIBILI_DIR, 'Bilibili');
  console.log(`\n=== ${relPath} ===`);
  console.log(`找到别名: ${Object.entries(aliasMap).map(([k, v]) => `${k}→${v}`).join(', ')}`);
  
  // 删除别名定义行
  content = content.replace(/^const\s+[A-Z][a-zA-Z0-9]*\s*=\s*Ic[A-Z][a-zA-Z0-9]*[^;]*;\s*\n/gm, '');
  
  // 替换 JSX 中的别名使用
  let replacements = 0;
  for (const [alias, icName] of Object.entries(aliasMap)) {
    // 替换 <Alias 和 </Alias>
    const openTagRegex = new RegExp(`<${alias}(\\s|>|/)`, 'g');
    const closeTagRegex = new RegExp(`</${alias}>`, 'g');
    // 替换 icon={Alias} 形式的 prop（注意：Alias 后面是 } 或空格）
    const propRegex = new RegExp(`(icon=\\{)${alias}(\\})`, 'g');
    // 替换 Icon={Alias} 形式的 prop
    const propRegex2 = new RegExp(`(Icon=\\{)${alias}(\\})`, 'g');
    
    const openMatches = content.match(openTagRegex) || [];
    const closeMatches = content.match(closeTagRegex) || [];
    const propMatches = content.match(propRegex) || [];
    const propMatches2 = content.match(propRegex2) || [];
    
    const totalMatches = openMatches.length + closeMatches.length + propMatches.length + propMatches2.length;
    
    if (totalMatches > 0) {
      content = content.replace(openTagRegex, `<${icName}$1`);
      content = content.replace(closeTagRegex, `</${icName}>`);
      content = content.replace(propRegex, `$1${icName}$2`);
      content = content.replace(propRegex2, `$1${icName}$2`);
      replacements += totalMatches;
      console.log(`  ${alias} → ${icName}: ${totalMatches} 处`);
    }
  }
  
  if (content !== originalContent) {
    totalFiles++;
    totalReplacements += replacements;
    
    if (!dryRun) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`  ✅ 已保存`);
    }
  }
});

console.log('\n========== 统计 ==========');
console.log(`修改文件数: ${totalFiles}`);
console.log(`替换次数: ${totalReplacements}`);

if (dryRun && totalFiles > 0) {
  console.log('\n预览完成。添加 --execute 执行修改。');
}
