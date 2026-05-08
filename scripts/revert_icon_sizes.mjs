#!/usr/bin/env node
/**
 * 反向脚本：撤销 fix_icon_sizes.mjs 的错误迁移
 * 将 size={dimens.xxx} 替换回原来的数值
 */

import fs from 'fs';
import path from 'path';

// 从 dimens.ts 读取映射关系
function loadDimensMappings(appDir) {
  const dimensPath = path.join(appDir, 'res', 'dimens.ts');
  if (!fs.existsSync(dimensPath)) return new Map();
  
  const content = fs.readFileSync(dimensPath, 'utf-8');
  const map = new Map(); // constantName -> value
  
  // 匹配 icSizeXxx: 24, 格式
  const regex = /(icSize\w+):\s*(\d+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    map.set(match[1], parseInt(match[2]));
  }
  
  return map;
}

// 处理单个文件
function revertFile(filePath, dimensMap) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let changes = 0;
  
  // 替换 size={dimens.icSizeXxx} 回 size={数值}
  content = content.replace(/size=\{dimens\.(icSize\w+)\}/g, (match, constName) => {
    const value = dimensMap.get(constName);
    if (value !== undefined) {
      changes++;
      return `size={${value}}`;
    }
    return match;
  });
  
  if (changes > 0) {
    // 检查是否需要移除 dimens import
    const stillUsesDimens = /dimens\./.test(content);
    if (!stillUsesDimens) {
      // 移除 import { dimens } from '...res/dimens';
      content = content.replace(/import\s*\{\s*dimens\s*\}\s*from\s*['"][^'"]*res\/dimens['"];\s*\n?/g, '');
    }
    
    fs.writeFileSync(filePath, content);
    return changes;
  }
  
  return 0;
}

// 遍历目录
function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(filePath);
    }
  }
}

// 主函数
function main() {
  const appsDir = path.join(process.cwd(), 'apps');
  const apps = fs.readdirSync(appsDir).filter(f => 
    fs.statSync(path.join(appsDir, f)).isDirectory()
  );
  
  let totalFiles = 0;
  let totalChanges = 0;
  
  for (const app of apps) {
    const appDir = path.join(appsDir, app);
    const dimensMap = loadDimensMappings(appDir);
    
    if (dimensMap.size === 0) continue;
    
    let appChanges = 0;
    let appFiles = 0;
    
    walkDir(appDir, (filePath) => {
      const changes = revertFile(filePath, dimensMap);
      if (changes > 0) {
        appFiles++;
        appChanges += changes;
      }
    });
    
    if (appFiles > 0) {
      console.log(`✓ ${app}: ${appFiles} file(s), ${appChanges} revert(s)`);
      totalFiles += appFiles;
      totalChanges += appChanges;
    }
  }
  
  console.log(`\n━━━ 完成: ${totalFiles} 个文件, ${totalChanges} 处还原 ━━━`);
}

main();
