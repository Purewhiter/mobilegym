#!/usr/bin/env node
/**
 * 中文字符串扫描脚本
 * 
 * 功能：
 * 1. 扫描 tsx 文件中的中文字符串
 * 2. 生成 strings.ts 模板
 * 
 * 用法：
 *   node scripts/scan_strings.mjs <AppName>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function scanStrings(appName) {
  const appDir = path.join(ROOT, 'apps', appName);
  const files = getAllTsxFiles(appDir);
  
  const allStrings = new Map(); // string → { count, files }
  
  for (const file of files) {
    // 跳过 res/ 目录（已提取的）
    if (file.includes('/res/')) continue;
    
    const content = fs.readFileSync(file, 'utf-8');
    const relPath = path.relative(ROOT, file);
    
    // 匹配中文字符串（在 JSX 中的和在 JS 中的）
    // 1. JSX 文本: >中文<
    // 2. 字符串字面量: "中文" 或 '中文' 或 `中文`
    
    // 正则匹配包含中文的字符串
    const patterns = [
      // JSX 文本内容 >xxx<
      />([^<]*[\u4e00-\u9fff][^<]*)</g,
      // 双引号字符串
      /"([^"]*[\u4e00-\u9fff][^"]*)"/g,
      // 单引号字符串  
      /'([^']*[\u4e00-\u9fff][^']*)'/g,
      // 模板字符串（简单情况）
      /`([^`]*[\u4e00-\u9fff][^`]*)`/g,
    ];
    
    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(content)) !== null) {
        const str = match[1].trim();
        if (!str || str.length > 100) continue; // 跳过空或太长的
        
        // 跳过注释
        if (str.includes('//') || str.includes('/*')) continue;
        
        if (!allStrings.has(str)) {
          allStrings.set(str, { count: 0, files: new Set() });
        }
        const info = allStrings.get(str);
        info.count++;
        info.files.add(relPath);
      }
    }
  }
  
  return allStrings;
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

function toConstName(str) {
  // 生成常量名（基于内容的拼音首字母）
  // 这里简单用数字编号，实际使用时需要手动命名
  return str
    .slice(0, 20)
    .replace(/[^\u4e00-\u9fff]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function generateStringsTemplate(strings, appName) {
  const lines = [
    '// Tier-2 i18n strings',
    '// Naming: <area>_<purpose> or snake_case descriptive name',
    '',
    'export const strings = {',
  ];
  
  // 按出现频次排序
  const sorted = [...strings.entries()].sort((a, b) => b[1].count - a[1].count);
  
  for (const [str, info] of sorted) {
    // 生成一个占位符key名
    const key = `str_${strings.size - sorted.indexOf([str, info])}`;
    lines.push(`  // ${info.count}次, ${[...info.files].slice(0, 2).join(', ')}`);
    lines.push(`  // ${key}: '${str.replace(/'/g, "\\'")}',`);
    lines.push('');
  }
  
  lines.push('} as const;');
  lines.push('');
  lines.push('export type StringKey = keyof typeof strings;');
  
  return lines.join('\n');
}

// Main
const args = process.argv.slice(2);
const appName = args[0];

if (!appName) {
  console.log('用法: node scripts/scan_strings.mjs <AppName>');
  process.exit(1);
}

console.log(`\n📝 扫描中文字符串: ${appName}\n`);

const strings = scanStrings(appName);

// 按频次排序输出统计
const sorted = [...strings.entries()].sort((a, b) => b[1].count - a[1].count);

console.log(`共发现 ${strings.size} 个不同的中文字符串\n`);

console.log('频次最高的 30 个：');
for (const [str, info] of sorted.slice(0, 30)) {
  const truncated = str.length > 30 ? str.slice(0, 30) + '...' : str;
  console.log(`  ${info.count.toString().padStart(3)}x  "${truncated}"`);
}

// 输出模板文件
const templatePath = path.join(ROOT, 'apps', appName, 'res', 'strings_template.ts');
const template = generateStringsTemplate(strings, appName);
fs.writeFileSync(templatePath, template, 'utf-8');

console.log(`\n📄 模板已生成: ${path.relative(ROOT, templatePath)}`);
console.log('  请手动编辑此文件，为每个字符串命名');
