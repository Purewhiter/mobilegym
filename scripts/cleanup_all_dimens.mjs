#!/usr/bin/env node
/**
 * 彻底清理所有 dimens 使用：把 dimens.xxx 替换为实际数值，删除 dimens.ts 文件
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.join(__dirname, '..', 'apps');

// 收集所有 app 的 dimens 映射
function collectDimensMappings() {
  const mappings = {}; // appName -> { dimensName: value }
  
  const apps = fs.readdirSync(APPS_DIR).filter(f => {
    const stat = fs.statSync(path.join(APPS_DIR, f));
    return stat.isDirectory();
  });
  
  for (const app of apps) {
    const dimensPath = path.join(APPS_DIR, app, 'res', 'dimens.ts');
    if (!fs.existsSync(dimensPath)) continue;
    
    const content = fs.readFileSync(dimensPath, 'utf-8');
    const dimensMap = {};
    
    // 匹配 name: 数字 模式
    const regex = /(\w+):\s*(\d+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const [, name, value] = match;
      dimensMap[name] = parseInt(value, 10);
    }
    
    if (Object.keys(dimensMap).length > 0) {
      mappings[app] = dimensMap;
    }
  }
  
  return mappings;
}

// 在 tsx 文件中替换 dimens.xxx 为数字
function revertTsxFile(filePath, dimensMap) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  let replacements = 0;
  
  // 替换 dimens.xxx 为数字
  for (const [name, value] of Object.entries(dimensMap)) {
    const regex = new RegExp(`dimens\\.${name}`, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, String(value));
      replacements += matches.length;
      modified = true;
    }
  }
  
  if (modified) {
    // 移除 dimens import
    if (!content.includes('dimens.')) {
      content = content.replace(/import\s*{\s*dimens\s*}\s*from\s*['"][^'"]+['"];\s*\n?/g, '');
      content = content.replace(/,\s*dimens\s*(?=})/g, '');
      content = content.replace(/{\s*dimens\s*,/g, '{');
    }
    
    fs.writeFileSync(filePath, content);
  }
  
  return replacements;
}

// 递归查找 tsx 文件
function findTsxFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      files.push(...findTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 主函数
async function main() {
  console.log('收集 dimens 映射...');
  const mappings = collectDimensMappings();
  
  console.log(`\n找到 ${Object.keys(mappings).length} 个 app 有 dimens 定义\n`);
  
  let totalReplacements = 0;
  let totalFilesModified = 0;
  let totalDimensDeleted = 0;
  
  for (const [app, dimensMap] of Object.entries(mappings)) {
    const appDir = path.join(APPS_DIR, app);
    const tsxFiles = findTsxFiles(appDir);
    
    let appReplacements = 0;
    let appFilesModified = 0;
    
    for (const tsxFile of tsxFiles) {
      const replacements = revertTsxFile(tsxFile, dimensMap);
      if (replacements > 0) {
        appReplacements += replacements;
        appFilesModified++;
      }
    }
    
    // 删除 dimens.ts
    const dimensPath = path.join(appDir, 'res', 'dimens.ts');
    if (fs.existsSync(dimensPath)) {
      fs.unlinkSync(dimensPath);
      totalDimensDeleted++;
    }
    
    if (appReplacements > 0 || fs.existsSync(dimensPath)) {
      console.log(`${app}: ${appReplacements} 替换 (${appFilesModified} 文件), dimens.ts 已删除`);
      totalReplacements += appReplacements;
      totalFilesModified += appFilesModified;
    }
  }
  
  console.log(`\n===== 总计 =====`);
  console.log(`替换: ${totalReplacements} 处`);
  console.log(`修改文件: ${totalFilesModified} 个`);
  console.log(`删除 dimens.ts: ${totalDimensDeleted} 个`);
}

main().catch(console.error);
