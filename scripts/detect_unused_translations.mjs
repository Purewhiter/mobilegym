#!/usr/bin/env node
/**
 * 检测"已定义翻译但代码中仍硬编码"的字符串
 * 
 * 用法：
 *   node scripts/detect_unused_translations.mjs <AppName>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 解析 strings.ts 获取已定义的中文及其 key
function getDefinedStrings(appName) {
  const stringsPath = path.join(ROOT, 'apps', appName, 'res', 'strings.ts');
  if (!fs.existsSync(stringsPath)) return new Map();
  
  const content = fs.readFileSync(stringsPath, 'utf-8');
  const defined = new Map(); // chinese -> key
  
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

// 扫描文件中硬编码的中文
function scanHardcoded(file, definedMap) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const results = [];
  
  lines.forEach((line, idx) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    if (line.trim().startsWith('import ')) return;
    
    // 匹配所有中文字符串
    const patterns = [
      /label[:=]\s*["']([^"']*[\u4e00-\u9fff][^"']*)["']/gi,
      /["']([^"']*[\u4e00-\u9fff][^"']*)["']/g,
      />([^<{]*[\u4e00-\u9fff][^<{]*)</g,
    ];
    
    const found = new Set();
    
    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(line)) !== null) {
        const str = match[1].trim();
        if (!str || found.has(str)) continue;
        
        // 检查是否在 definedMap 中（已定义翻译但仍硬编码）
        const key = definedMap.get(str);
        if (key) {
          found.add(str);
          results.push({
            text: str,
            key: key,
            line: idx + 1,
            context: line.trim().substring(0, 100),
          });
        }
      }
    }
  });
  
  return results;
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
  console.log('用法: node scripts/detect_unused_translations.mjs <AppName>');
  process.exit(1);
}

console.log(`\n🔍 检测已定义但未使用的翻译: ${appName}\n`);

const definedMap = getDefinedStrings(appName);
console.log(`📚 已定义翻译: ${definedMap.size} 个\n`);

const appDir = path.join(ROOT, 'apps', appName);
const files = getAllTsxFiles(appDir);

const byFile = new Map();
let total = 0;

for (const file of files) {
  if (file.includes('/res/')) continue;
  if (file.includes('.declaration.')) continue;
  
  const results = scanHardcoded(file, definedMap);
  const relPath = path.relative(ROOT, file);
  
  if (results.length > 0) {
    byFile.set(relPath, results);
    total += results.length;
  }
}

console.log(`❌ 发现 ${total} 处硬编码（应使用 t.xxx）\n`);

console.log('━'.repeat(70));
console.log('📁 按文件分组（需要替换为 t.key 的位置）:');
console.log('━'.repeat(70));

for (const [file, results] of byFile) {
  console.log(`\n📄 ${file}`);
  for (const r of results) {
    console.log(`   L${r.line.toString().padStart(3)}: "${r.text}" → t.${r.key}`);
  }
}

console.log('\n');
