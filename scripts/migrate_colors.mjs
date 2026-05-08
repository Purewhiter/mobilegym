#!/usr/bin/env node
/**
 * 颜色硬编码迁移脚本
 * 
 * 功能：
 * 1. 读取 colors.ts 建立 hex → CSS 变量名映射
 * 2. 扫描 tsx 文件，自动替换硬编码颜色
 * 
 * 用法：
 *   node scripts/migrate_colors.mjs <AppName> [--dry-run]
 * 
 * 示例：
 *   node scripts/migrate_colors.mjs Wechat --dry-run  # 预览变更
 *   node scripts/migrate_colors.mjs Wechat            # 执行替换
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ============================================================================
// 解析 colors.ts
// ============================================================================

function parseColorsTs(appName) {
  const colorsPath = path.join(ROOT, 'apps', appName, 'res', 'colors.ts');
  if (!fs.existsSync(colorsPath)) {
    console.error(`❌ 找不到 ${colorsPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(colorsPath, 'utf-8');
  const colorMap = new Map(); // hex (lowercase) → cssVarName
  
  // 匹配 key: '#xxx' 或 key: 'rgba(...)'
  const regex = /(\w+):\s*['"]([#\w(),.]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const [, key, value] = match;
    if (value.startsWith('#')) {
      // 转为小写统一比较
      const hex = value.toLowerCase();
      const cssVar = `--app-c-${toKebabCase(key)}`;
      colorMap.set(hex, cssVar);
    }
  }
  
  console.log(`📦 从 colors.ts 读取了 ${colorMap.size} 个颜色映射`);
  return colorMap;
}

function toKebabCase(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase();
}

// ============================================================================
// 扫描和替换
// ============================================================================

function scanAndReplace(appName, colorMap, dryRun) {
  const appDir = path.join(ROOT, 'apps', appName);
  const files = getAllTsxFiles(appDir);
  
  let totalChanges = 0;
  const unmatchedColors = new Map(); // 记录未匹配的颜色
  
  for (const file of files) {
    // 跳过 res/ 目录
    if (file.includes('/res/')) continue;
    
    let content = fs.readFileSync(file, 'utf-8');
    let newContent = content;
    let fileChanges = 0;
    
    // 1. 替换 text-[#xxx] → text-(--app-c-xxx)
    newContent = newContent.replace(/text-\[#([0-9a-fA-F]{3,6})\]/g, (match, hex) => {
      const fullHex = normalizeHex(hex);
      const cssVar = colorMap.get(fullHex);
      if (cssVar) {
        fileChanges++;
        return `text-(${cssVar})`;
      }
      recordUnmatched(unmatchedColors, fullHex, file, 'text');
      return match;
    });
    
    // 2. 替换 bg-[#xxx] → bg-(--app-c-xxx)
    newContent = newContent.replace(/bg-\[#([0-9a-fA-F]{3,6})\]/g, (match, hex) => {
      const fullHex = normalizeHex(hex);
      const cssVar = colorMap.get(fullHex);
      if (cssVar) {
        fileChanges++;
        return `bg-(${cssVar})`;
      }
      recordUnmatched(unmatchedColors, fullHex, file, 'bg');
      return match;
    });
    
    // 3. 替换 className="text-[#xxx]" 中嵌入的（已被上面处理）
    
    // 4. 替换 style={{ color: '#xxx' }} → style={{ color: 'var(--app-c-xxx)' }}
    newContent = newContent.replace(/color:\s*['"]#([0-9a-fA-F]{3,6})['"]/g, (match, hex) => {
      const fullHex = normalizeHex(hex);
      const cssVar = colorMap.get(fullHex);
      if (cssVar) {
        fileChanges++;
        return `color: 'var(${cssVar})'`;
      }
      recordUnmatched(unmatchedColors, fullHex, file, 'style-color');
      return match;
    });
    
    // 5. 替换 backgroundColor: '#xxx' → backgroundColor: 'var(--app-c-xxx)'
    newContent = newContent.replace(/backgroundColor:\s*['"]#([0-9a-fA-F]{3,6})['"]/g, (match, hex) => {
      const fullHex = normalizeHex(hex);
      const cssVar = colorMap.get(fullHex);
      if (cssVar) {
        fileChanges++;
        return `backgroundColor: 'var(${cssVar})'`;
      }
      recordUnmatched(unmatchedColors, fullHex, file, 'style-bg');
      return match;
    });
    
    if (fileChanges > 0) {
      const relPath = path.relative(ROOT, file);
      console.log(`  ${relPath}: ${fileChanges} 处替换`);
      totalChanges += fileChanges;
      
      if (!dryRun) {
        fs.writeFileSync(file, newContent, 'utf-8');
      }
    }
  }
  
  // 报告未匹配的颜色
  if (unmatchedColors.size > 0) {
    console.log('\n⚠️  未匹配的颜色（需要先添加到 colors.ts）:');
    for (const [hex, info] of unmatchedColors) {
      console.log(`  ${hex} (${info.count} 处, 类型: ${[...info.types].join('/')})`);
    }
  }
  
  return totalChanges;
}

function normalizeHex(hex) {
  // 3位转6位
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return '#' + hex.toLowerCase();
}

function recordUnmatched(map, hex, file, type) {
  if (!map.has(hex)) {
    map.set(hex, { count: 0, types: new Set(), files: new Set() });
  }
  const info = map.get(hex);
  info.count++;
  info.types.add(type);
  info.files.add(file);
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
  console.log('用法: node scripts/migrate_colors.mjs <AppName> [--dry-run]');
  console.log('示例: node scripts/migrate_colors.mjs Wechat --dry-run');
  process.exit(1);
}

console.log(`\n🎨 颜色迁移: ${appName} ${dryRun ? '(预览模式)' : ''}\n`);

const colorMap = parseColorsTs(appName);
const totalChanges = scanAndReplace(appName, colorMap, dryRun);

console.log(`\n✅ 共 ${totalChanges} 处${dryRun ? '可替换' : '已替换'}`);

if (dryRun && totalChanges > 0) {
  console.log('\n💡 去掉 --dry-run 执行实际替换');
}
