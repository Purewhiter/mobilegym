#!/usr/bin/env node
/**
 * 简化字符串 import - 把旧的 4 行 import 改为新的 1 行
 * 
 * 旧：
 *   import { strings } from '../res/strings';
 *   import { stringsEn } from '../res/strings.en';
 *   import { useAppStrings } from '@/os/useAppStrings';
 *   const s = useAppStrings(strings, stringsEn);
 * 
 * 新：
 *   import { useWechatStrings } from '../hooks/useWechatStrings';
 *   const t = useWechatStrings();
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function simplifyFile(file, appName) {
  let content = fs.readFileSync(file, 'utf-8');
  
  // 检查是否有旧的 import 模式
  if (!content.includes("from '../res/strings'") && 
      !content.includes("from '../../res/strings'") &&
      !content.includes("from '../../../res/strings'") &&
      !content.includes("from './res/strings'")) {
    return false;
  }
  
  // 检查是否已经使用新的 hook
  if (content.includes('useWechatStrings')) {
    return false;
  }
  
  let newContent = content;
  
  // 计算相对路径深度
  const relPath = path.relative(path.join(ROOT, 'apps', appName), file);
  const depth = (relPath.match(/\//g) || []).length;
  
  // 计算到 hooks 目录的相对路径
  let hooksPath;
  if (depth === 0) {
    hooksPath = './hooks/useWechatStrings';
  } else if (depth === 1) {
    hooksPath = '../hooks/useWechatStrings';
  } else {
    hooksPath = '../'.repeat(depth) + 'hooks/useWechatStrings';
  }
  
  // 1. 删除旧的 import 语句
  newContent = newContent.replace(/import \{ strings \} from ['"][^'"]+strings['"];\n/g, '');
  newContent = newContent.replace(/import \{ stringsEn \} from ['"][^'"]+strings\.en['"];\n/g, '');
  newContent = newContent.replace(/import \{ useAppStrings \} from ['"]@\/os\/useAppStrings['"];\n/g, '');
  
  // 2. 找到第一个 import 语句的位置，在其后添加新的 import
  const firstImportMatch = newContent.match(/^import .+;\n/m);
  if (firstImportMatch) {
    const insertPos = firstImportMatch.index + firstImportMatch[0].length;
    // 检查是否已经有这个 import
    if (!newContent.includes(`from '${hooksPath}'`)) {
      newContent = newContent.slice(0, insertPos) + 
        `import { useWechatStrings } from '${hooksPath}';\n` + 
        newContent.slice(insertPos);
    }
  }
  
  // 3. 替换 useAppStrings(strings, stringsEn) 为 useWechatStrings()
  newContent = newContent.replace(/const s = useAppStrings\(strings, stringsEn\);/g, 'const t = useWechatStrings();');
  
  // 4. 替换 s. 为 t. （只替换作为对象属性访问的情况）
  newContent = newContent.replace(/\bs\.(\w+)/g, 't.$1');
  
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
  console.log('用法: node scripts/simplify_strings_import.mjs <AppName>');
  process.exit(1);
}

console.log(`\n🔄 简化字符串 import: ${appName}\n`);

const appDir = path.join(ROOT, 'apps', appName);
const files = getAllTsxFiles(appDir);

let fixedCount = 0;
for (const file of files) {
  if (file.includes('/res/')) continue;
  
  if (simplifyFile(file, appName)) {
    const relPath = path.relative(ROOT, file);
    console.log(`  ✓ ${relPath}`);
    fixedCount++;
  }
}

console.log(`\n✅ 简化了 ${fixedCount} 个文件`);
