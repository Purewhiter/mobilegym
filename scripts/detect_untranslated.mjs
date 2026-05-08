#!/usr/bin/env node
/**
 * 检测未翻译的硬编码中文字符串 (v3 - 完善版)
 * 
 * 用法：
 *   node scripts/detect_untranslated.mjs <AppName>
 *   node scripts/detect_untranslated.mjs <AppName> --verbose
 *   node scripts/detect_untranslated.mjs <AppName> --all     # 包括已翻译的
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 解析 strings.ts 获取已翻译的中文
function getTranslatedStrings(appName) {
  const stringsPath = path.join(ROOT, 'apps', appName, 'res', 'strings.ts');
  if (!fs.existsSync(stringsPath)) return new Set();
  
  const content = fs.readFileSync(stringsPath, 'utf-8');
  const translated = new Set();
  
  // 匹配 key: '值' 或 key: "值"
  const regex = /(\w+):\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const value = match[2];
    if (/[\u4e00-\u9fff]/.test(value)) {
      translated.add(value);
    }
  }
  
  return translated;
}

// 提取一行中所有包含中文的字符串
function extractChineseStrings(line) {
  const results = [];
  
  // 方法：直接找出所有引号内的字符串，检查是否包含中文
  // 匹配所有单引号、双引号、反引号字符串
  
  // 1. 双引号字符串
  const doubleQuoteRegex = /"([^"\\]*(\\.[^"\\]*)*)"/g;
  let match;
  while ((match = doubleQuoteRegex.exec(line)) !== null) {
    const str = match[1];
    if (/[\u4e00-\u9fff]/.test(str)) {
      results.push({ text: str, type: 'double' });
    }
  }
  
  // 2. 单引号字符串
  const singleQuoteRegex = /'([^'\\]*(\\.[^'\\]*)*)'/g;
  while ((match = singleQuoteRegex.exec(line)) !== null) {
    const str = match[1];
    if (/[\u4e00-\u9fff]/.test(str)) {
      results.push({ text: str, type: 'single' });
    }
  }
  
  // 3. 模板字符串 (简单版，不处理嵌套)
  const templateRegex = /`([^`]*)`/g;
  while ((match = templateRegex.exec(line)) !== null) {
    const str = match[1];
    if (/[\u4e00-\u9fff]/.test(str) && !str.includes('${')) {
      results.push({ text: str, type: 'template' });
    }
  }
  
  // 4. JSX 文本内容: >中文<
  const jsxTextRegex = />([^<>{]+)</g;
  while ((match = jsxTextRegex.exec(line)) !== null) {
    const str = match[1].trim();
    if (/[\u4e00-\u9fff]/.test(str)) {
      results.push({ text: str, type: 'jsx' });
    }
  }
  
  return results;
}

// 扫描文件中的中文字符串
function scanFile(file, translatedSet, includeAll) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const results = [];
  
  lines.forEach((line, idx) => {
    // 跳过纯注释行
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) return;
    if (trimmed.startsWith('*') && !trimmed.startsWith('*/')) return;
    // 跳过 import 行
    if (trimmed.startsWith('import ')) return;
    // 跳过 export type 行
    if (trimmed.startsWith('export type ')) return;
    
    const found = extractChineseStrings(line);
    
    for (const item of found) {
      const str = item.text.trim();
      if (!str) continue;
      if (str.length > 100) continue;
      
      // 跳过已翻译的（除非 --all）
      if (!includeAll && translatedSet.has(str)) continue;
      
      // 跳过特殊情况
      if (str.includes('//')) continue;
      if (str.includes('/*')) continue;
      if (str.match(/^[\u4e00-\u9fff]$/)) continue; // 单个汉字
      if (str.includes('${')) continue; // 模板变量
      if (str.startsWith('data-')) continue;
      if (str.startsWith('aria-')) continue;
      // 跳过 CSS 类名
      if (str.match(/^[a-z-]+$/)) continue;
      // 跳过纯数字
      if (str.match(/^\d+$/)) continue;
      
      results.push({
        text: str,
        line: idx + 1,
        type: item.type,
        context: line.trim().substring(0, 120),
      });
    }
  });
  
  return results;
}

function getAllTsxFiles(dir) {
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllTsxFiles(fullPath));
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        // 只包含 .tsx 和业务 .ts 文件
        if (!entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    }
  } catch (e) {
    // ignore
  }
  
  return files;
}

// Main
const args = process.argv.slice(2);
const appName = args.find(a => !a.startsWith('-'));
const verbose = args.includes('--verbose') || args.includes('-v');
const includeAll = args.includes('--all');

if (!appName) {
  console.log('用法: node scripts/detect_untranslated.mjs <AppName> [--verbose] [--all]');
  process.exit(1);
}

console.log(`\n🔍 检测${includeAll ? '所有' : '未翻译的'}中文: ${appName}\n`);

const translatedSet = getTranslatedStrings(appName);
console.log(`📚 已定义翻译: ${translatedSet.size} 个字符串\n`);

const appDir = path.join(ROOT, 'apps', appName);
const files = getAllTsxFiles(appDir);

const allResults = new Map(); // text -> { count, locations: [{file, line}] }
const byFile = new Map(); // file -> results[]

for (const file of files) {
  // 跳过资源文件中的定义（strings.ts 本身）
  if (file.includes('/res/strings')) continue;
  // 跳过声明文件
  if (file.includes('.declaration.')) continue;
  // 跳过测试文件
  if (file.includes('.test.') || file.includes('.spec.')) continue;
  
  const results = scanFile(file, translatedSet, includeAll);
  const relPath = path.relative(ROOT, file);
  
  if (results.length > 0) {
    byFile.set(relPath, results);
  }
  
  for (const r of results) {
    if (!allResults.has(r.text)) {
      allResults.set(r.text, { count: 0, locations: [], types: new Set() });
    }
    const info = allResults.get(r.text);
    info.count++;
    info.locations.push({ file: relPath, line: r.line });
    info.types.add(r.type);
  }
}

// 按频次排序
const sorted = [...allResults.entries()].sort((a, b) => b[1].count - a[1].count);

console.log(`❌ ${includeAll ? '检测到' : '未翻译'}: ${allResults.size} 个不同的字符串 (共 ${[...allResults.values()].reduce((sum, v) => sum + v.count, 0)} 处)\n`);

// 按文件输出
console.log('━'.repeat(70));
console.log('📁 按文件分组:');
console.log('━'.repeat(70));

const sortedFiles = [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);

for (const [file, results] of sortedFiles) {
  console.log(`\n📄 ${file} (${results.length} 处)`);
  
  // 去重并统计
  const uniqueMap = new Map();
  for (const r of results) {
    if (!uniqueMap.has(r.text)) {
      uniqueMap.set(r.text, { line: r.line, count: 0 });
    }
    uniqueMap.get(r.text).count++;
  }
  
  const limit = verbose ? 100 : 10;
  let shown = 0;
  for (const [text, info] of uniqueMap) {
    if (shown >= limit) break;
    const suffix = info.count > 1 ? ` (${info.count}x)` : '';
    console.log(`   L${info.line.toString().padStart(3)}: "${text}"${suffix}`);
    shown++;
  }
  if (uniqueMap.size > limit) {
    console.log(`   ... 还有 ${uniqueMap.size - limit} 个不同的字符串`);
  }
}

// 高频字符串
console.log('\n' + '━'.repeat(70));
console.log('📊 高频字符串 (出现 2+ 次):');
console.log('━'.repeat(70));

const highFreq = sorted.filter(([, info]) => info.count >= 2);
if (highFreq.length === 0) {
  console.log('  (无)');
} else {
  for (const [text, info] of highFreq.slice(0, 30)) {
    console.log(`  ${info.count.toString().padStart(2)}x  "${text}"`);
  }
}

// 生成 strings.ts 模板
console.log('\n' + '━'.repeat(70));
console.log('📝 建议添加到 strings.ts (前 50 个):');
console.log('━'.repeat(70));
console.log();

let i = 1;
for (const [text] of sorted.slice(0, 50)) {
  const key = `pending_${i.toString().padStart(2, '0')}`;
  console.log(`  ${key}: '${text.replace(/'/g, "\\'")}',`);
  i++;
}

console.log('\n');
