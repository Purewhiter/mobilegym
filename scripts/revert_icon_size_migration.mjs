#!/usr/bin/env node
/**
 * 撤销图标尺寸迁移：把 size={dimens.icSizeXxx} 恢复为 size={数字}
 * 同时移除 dimens.ts 中的 icSize 定义，以及相关 import 语句
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.join(__dirname, '..', 'apps');

// 收集所有 app 的 icSize 映射
function collectIcSizeMappings() {
  const mappings = {}; // appName -> { icSizeName: value }
  
  const apps = fs.readdirSync(APPS_DIR).filter(f => {
    const stat = fs.statSync(path.join(APPS_DIR, f));
    return stat.isDirectory();
  });
  
  for (const app of apps) {
    const dimensPath = path.join(APPS_DIR, app, 'res', 'dimens.ts');
    if (!fs.existsSync(dimensPath)) continue;
    
    const content = fs.readFileSync(dimensPath, 'utf-8');
    const icSizeMap = {};
    
    // 匹配 icSizeXxx: 数字 模式
    const regex = /(\w+):\s*(\d+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const [, name, value] = match;
      if (name.startsWith('icSize') || name === 'icStrokeWidth') {
        icSizeMap[name] = parseInt(value, 10);
      }
    }
    
    if (Object.keys(icSizeMap).length > 0) {
      mappings[app] = icSizeMap;
    }
  }
  
  return mappings;
}

// 在 tsx 文件中替换 dimens.icSizeXxx 为数字
function revertTsxFile(filePath, icSizeMap) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  let replacements = 0;
  
  // 替换 size={dimens.icSizeXxx} 为 size={数字}
  for (const [name, value] of Object.entries(icSizeMap)) {
    const regex = new RegExp(`dimens\\.${name}`, 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, String(value));
      replacements += matches.length;
      modified = true;
    }
  }
  
  if (modified) {
    // 检查是否还有其他 dimens 使用，如果没有则移除 import
    if (!content.includes('dimens.')) {
      // 移除 dimens import
      content = content.replace(/import\s*{\s*dimens\s*}\s*from\s*['"][^'"]+['"];\s*\n?/g, '');
      // 移除 dimens 从联合导入中
      content = content.replace(/,\s*dimens\s*(?=})/g, '');
      content = content.replace(/{\s*dimens\s*,/g, '{');
    }
    
    fs.writeFileSync(filePath, content);
  }
  
  return replacements;
}

// 清理 dimens.ts 中的 icSize 定义
function cleanDimensFile(dimensPath) {
  if (!fs.existsSync(dimensPath)) return { removed: 0, deleted: false };
  
  let content = fs.readFileSync(dimensPath, 'utf-8');
  const originalContent = content;
  
  // 移除 icSize 和 icStrokeWidth 行
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    // 保留非 icSize/icStrokeWidth 行
    return !trimmed.match(/^icSize\w+:\s*\d+/) && 
           !trimmed.match(/^icStrokeWidth:\s*\d+/);
  });
  
  content = filteredLines.join('\n');
  
  // 检查 dimens 对象是否为空
  const dimensMatch = content.match(/export\s+const\s+dimens\s*=\s*{([^}]*)}/s);
  if (dimensMatch) {
    const innerContent = dimensMatch[1].trim();
    // 如果只剩下注释或空白
    if (!innerContent || innerContent.match(/^[\s\/\*]*$/)) {
      // 删除整个文件
      fs.unlinkSync(dimensPath);
      return { removed: lines.length - filteredLines.length, deleted: true };
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(dimensPath, content);
    return { removed: lines.length - filteredLines.length, deleted: false };
  }
  
  return { removed: 0, deleted: false };
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
  console.log('收集 icSize 映射...');
  const mappings = collectIcSizeMappings();
  
  console.log(`\n找到 ${Object.keys(mappings).length} 个 app 有 icSize 定义\n`);
  
  let totalReplacements = 0;
  let totalFilesModified = 0;
  let totalDimensCleaned = 0;
  
  for (const [app, icSizeMap] of Object.entries(mappings)) {
    const appDir = path.join(APPS_DIR, app);
    const tsxFiles = findTsxFiles(appDir);
    
    let appReplacements = 0;
    let appFilesModified = 0;
    
    for (const tsxFile of tsxFiles) {
      const replacements = revertTsxFile(tsxFile, icSizeMap);
      if (replacements > 0) {
        appReplacements += replacements;
        appFilesModified++;
      }
    }
    
    // 清理 dimens.ts
    const dimensPath = path.join(appDir, 'res', 'dimens.ts');
    const { removed, deleted } = cleanDimensFile(dimensPath);
    
    if (appReplacements > 0 || removed > 0) {
      console.log(`${app}: ${appReplacements} 替换 (${appFilesModified} 文件)${deleted ? ', dimens.ts 已删除' : removed > 0 ? `, dimens.ts 清理 ${removed} 行` : ''}`);
      totalReplacements += appReplacements;
      totalFilesModified += appFilesModified;
      if (removed > 0) totalDimensCleaned++;
    }
  }
  
  console.log(`\n===== 总计 =====`);
  console.log(`替换: ${totalReplacements} 处`);
  console.log(`修改文件: ${totalFilesModified} 个`);
  console.log(`清理 dimens.ts: ${totalDimensCleaned} 个`);
}

main().catch(console.error);
