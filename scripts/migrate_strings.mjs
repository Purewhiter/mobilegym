#!/usr/bin/env node
/**
 * 中文字符串迁移脚本
 * 
 * 功能：
 * 1. 读取 strings.ts 建立 中文值 → key 映射
 * 2. 扫描 tsx 文件，自动替换匹配的中文字符串
 * 
 * 用法：
 *   node scripts/migrate_strings.mjs <AppName> [--dry-run]
 * 
 * 示例：
 *   node scripts/migrate_strings.mjs Wechat --dry-run  # 预览变更
 *   node scripts/migrate_strings.mjs Wechat            # 执行替换
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

// ============================================================================
// 解析 strings.ts
// ============================================================================

function parseStringsTs(appName) {
  const resolved = resolveAppDir(appName);
  if (!resolved) {
    console.error(`❌ 找不到 apps/${appName} 或 system/${appName}`);
    process.exit(1);
  }
  const stringsPath = path.join(resolved.dir, 'res', 'strings.ts');
  if (!fs.existsSync(stringsPath)) {
    console.error(`❌ 找不到 ${stringsPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(stringsPath, 'utf-8');
  const stringMap = new Map(); // 中文值 → key
  
  // 匹配 key: '中文值'
  const regex = /(\w+):\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const [, key, value] = match;
    // 只处理包含中文的值
    if (/[\u4e00-\u9fff]/.test(value)) {
      stringMap.set(value, key);
    }
  }
  
  console.log(`📦 从 strings.ts 读取了 ${stringMap.size} 个字符串映射`);
  return stringMap;
}

// ============================================================================
// 扫描和替换
// ============================================================================

function scanAndReplace(appName, stringMap, dryRun) {
  const resolved = resolveAppDir(appName);
  if (!resolved) {
    console.error(`❌ 找不到 apps/${appName} 或 system/${appName}`);
    process.exit(1);
  }
  const appDir = resolved.dir;
  const appBase = resolved.base;
  const files = getAllTsxFiles(appDir);
  
  let totalChanges = 0;
  const filesNeedImport = new Set();
  
  for (const file of files) {
    // 跳过 res/ 目录
    if (file.includes('/res/')) continue;
    
    let content = fs.readFileSync(file, 'utf-8');
    let newContent = content;
    let fileChanges = 0;
    
    // 检查是否已导入 strings
    const hasStringsImport = /import\s+{\s*strings\s*}/.test(content) || 
                            /import\s+.*strings.*from.*strings/.test(content);
    
    // 按字符串长度降序排序，优先匹配更长的字符串
    const sortedEntries = [...stringMap.entries()].sort((a, b) => b[0].length - a[0].length);
    
    for (const [zhValue, key] of sortedEntries) {
      // 1. 替换 JSX 文本内容 >中文<  →  >{strings.xxx}<
      const jsxTextRegex = new RegExp(`>(\\s*)${escapeRegex(zhValue)}(\\s*)<`, 'g');
      const jsxReplacement = `>$1{strings.${key}}$2<`;
      const before1 = newContent;
      newContent = newContent.replace(jsxTextRegex, jsxReplacement);
      if (newContent !== before1) {
        fileChanges += (before1.match(jsxTextRegex) || []).length;
      }
      
      // 2. 替换属性中的字符串 title="中文"  →  title={strings.xxx}
      const attrRegex = new RegExp(`(\\w+)=["']${escapeRegex(zhValue)}["']`, 'g');
      const attrReplacement = `$1={strings.${key}}`;
      const before2 = newContent;
      newContent = newContent.replace(attrRegex, attrReplacement);
      if (newContent !== before2) {
        fileChanges += (before2.match(attrRegex) || []).length;
      }
      
      // 3. 替换 JS 字符串变量 const x = "中文"  →  const x = strings.xxx
      // （这个比较危险，只替换独立的字符串赋值）
      const varRegex = new RegExp(`(=\\s*)["']${escapeRegex(zhValue)}["']([;,\\s\\)])`, 'g');
      const varReplacement = `$1strings.${key}$2`;
      const before3 = newContent;
      newContent = newContent.replace(varRegex, varReplacement);
      if (newContent !== before3) {
        fileChanges += (before3.match(varRegex) || []).length;
      }
    }
    
    if (fileChanges > 0) {
      const relPath = path.relative(ROOT, file);
      console.log(`  ${relPath}: ${fileChanges} 处替换`);
      totalChanges += fileChanges;
      
      // 添加 import 语句（如果需要）
      if (!hasStringsImport) {
        filesNeedImport.add(relPath);
        // 在文件顶部添加 import
        const importLine = `import { strings } from '@/${appBase}/${appName}/res/strings';\n`;
        
        // 找到最后一个 import 语句的位置
        const importRegex = /^import .+;?\n/gm;
        let lastImportEnd = 0;
        let importMatch;
        while ((importMatch = importRegex.exec(newContent)) !== null) {
          lastImportEnd = importMatch.index + importMatch[0].length;
        }
        
        if (lastImportEnd > 0) {
          newContent = newContent.slice(0, lastImportEnd) + importLine + newContent.slice(lastImportEnd);
        } else {
          newContent = importLine + newContent;
        }
      }
      
      if (!dryRun) {
        fs.writeFileSync(file, newContent, 'utf-8');
      }
    }
  }
  
  if (filesNeedImport.size > 0) {
    console.log(`\n📝 ${filesNeedImport.size} 个文件需要添加 import`);
  }
  
  return totalChanges;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// ============================================================================
// Main
// ============================================================================

const args = process.argv.slice(2);
const appName = args.find(a => !a.startsWith('-'));
const dryRun = args.includes('--dry-run');

if (!appName) {
  console.log('用法: node scripts/migrate_strings.mjs <AppName> [--dry-run]');
  console.log('示例: node scripts/migrate_strings.mjs Wechat --dry-run');
  process.exit(1);
}

console.log(`\n📝 字符串迁移: ${appName} ${dryRun ? '(预览模式)' : ''}\n`);

const stringMap = parseStringsTs(appName);
const totalChanges = scanAndReplace(appName, stringMap, dryRun);

console.log(`\n✅ 共 ${totalChanges} 处${dryRun ? '可替换' : '已替换'}`);

if (dryRun && totalChanges > 0) {
  console.log('\n💡 去掉 --dry-run 执行实际替换');
}
