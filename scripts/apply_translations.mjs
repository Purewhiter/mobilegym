#!/usr/bin/env node
/**
 * 自动替换硬编码中文为翻译变量 t.xxx
 * 
 * 用法：
 *   node scripts/apply_translations.mjs <AppName>        # dry run
 *   node scripts/apply_translations.mjs <AppName> --apply # 实际替换
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 解析 strings.ts
function getDefinedStrings(appName) {
  const stringsPath = path.join(ROOT, 'apps', appName, 'res', 'strings.ts');
  if (!fs.existsSync(stringsPath)) return new Map();
  
  const content = fs.readFileSync(stringsPath, 'utf-8');
  const defined = new Map();
  
  const regex = /(\w+):\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const value = match[2];
    if (/[\u4e00-\u9fff]/.test(value)) {
      defined.set(value, key);
    }
  }
  
  return defined;
}

// 替换文件中的硬编码字符串
function processFile(file, definedMap, dryRun) {
  let content = fs.readFileSync(file, 'utf-8');
  const original = content;
  let changes = [];
  
  // 按字符串长度降序排序，先替换长的避免部分匹配
  const sortedEntries = [...definedMap.entries()].sort((a, b) => b[0].length - a[0].length);
  
  for (const [chinese, key] of sortedEntries) {
    // 跳过某些不应替换的场景
    const escapedChinese = chinese.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // 1. 替换 JSX 属性值: label="中文" → label={t.key}
    const attrPattern = new RegExp(`(label|title|placeholder|text|value)=["']${escapedChinese}["']`, 'g');
    const attrReplacement = `$1={t.${key}}`;
    if (attrPattern.test(content)) {
      changes.push(`属性值: "${chinese}" → t.${key}`);
      content = content.replace(attrPattern, attrReplacement);
    }
    
    // 2. 替换对象字面量: label: '中文' → label: t.key (注意不要破坏 strings.ts 本身)
    if (!file.includes('/res/strings')) {
      const objPattern = new RegExp(`(label|title|text):\\s*['"]${escapedChinese}['"]`, 'g');
      const objReplacement = `$1: t.${key}`;
      if (objPattern.test(content)) {
        changes.push(`对象: "${chinese}" → t.${key}`);
        content = content.replace(objPattern, objReplacement);
      }
    }
    
    // 3. 替换 JSX 文本内容: >中文< → >{t.key}<
    // 注意只替换单独的中文，不替换包含其他内容的
    const jsxPattern = new RegExp(`>\\s*${escapedChinese}\\s*<`, 'g');
    const jsxReplacement = `>{t.${key}}<`;
    if (jsxPattern.test(content)) {
      changes.push(`JSX: "${chinese}" → t.${key}`);
      content = content.replace(jsxPattern, jsxReplacement);
    }
  }
  
  if (content !== original) {
    // 确保文件有 useWechatStrings import 和 t 声明
    if (!content.includes('useWechatStrings')) {
      // 需要添加 import
      const firstImport = content.match(/^import .+;\n/m);
      if (firstImport) {
        const relPath = path.relative(path.dirname(file), path.join(ROOT, 'apps/Wechat/hooks'));
        const importPath = relPath.startsWith('.') ? relPath : './' + relPath;
        const importLine = `import { useWechatStrings } from '${importPath}/useWechatStrings';\n`;
        content = content.slice(0, firstImport.index + firstImport[0].length) + importLine + content.slice(firstImport.index + firstImport[0].length);
        changes.push('添加 import useWechatStrings');
      }
    }
    
    if (!dryRun) {
      fs.writeFileSync(file, content, 'utf-8');
    }
    return changes;
  }
  
  return [];
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
const appName = args.find(a => !a.startsWith('-'));
const apply = args.includes('--apply');

if (!appName) {
  console.log('用法: node scripts/apply_translations.mjs <AppName> [--apply]');
  process.exit(1);
}

const dryRun = !apply;
console.log(`\n${dryRun ? '🔍 预览模式' : '✏️ 应用模式'}: 替换硬编码为 t.xxx\n`);

const definedMap = getDefinedStrings(appName);
console.log(`📚 已定义翻译: ${definedMap.size} 个\n`);

const appDir = path.join(ROOT, 'apps', appName);
const files = getAllTsxFiles(appDir);

let totalChanges = 0;
let filesChanged = 0;

for (const file of files) {
  if (file.includes('/res/')) continue;
  if (file.includes('.declaration.')) continue;
  
  const changes = processFile(file, definedMap, dryRun);
  const relPath = path.relative(ROOT, file);
  
  if (changes.length > 0) {
    filesChanged++;
    totalChanges += changes.length;
    console.log(`📄 ${relPath}`);
    for (const c of changes) {
      console.log(`   ✓ ${c}`);
    }
  }
}

console.log(`\n${dryRun ? '预览' : '完成'}: ${filesChanged} 个文件, ${totalChanges} 处替换`);
if (dryRun) {
  console.log('\n运行 --apply 参数来实际应用更改');
}
