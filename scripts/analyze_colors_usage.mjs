#!/usr/bin/env node
/**
 * 分析 colors.ts 中定义的颜色使用情况
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.join(__dirname, '..', 'apps');

// 跳过这些已完成迁移的应用
const SKIP_APPS = ['Wechat', 'WechatReading'];

function findTsxFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'res') {
      files.push(...findTsxFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !entry.name.includes('colors')) {
      files.push(fullPath);
    }
  }
  return files;
}

function extractColorNames(colorsPath) {
  if (!fs.existsSync(colorsPath)) return [];
  const content = fs.readFileSync(colorsPath, 'utf-8');
  const names = [];
  // 匹配 key: (带或不带引号)
  // 1. 无引号: bookshelf_bg: '#xxx'
  // 2. 带引号: 'tw-text-slate-800': '#xxx'
  const regex = /^\s*(?:'([^']+)'|"([^"]+)"|(\w+)):\s*['"]?#/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    // match[1] = 单引号内容, match[2] = 双引号内容, match[3] = 无引号
    names.push(match[1] || match[2] || match[3]);
  }
  return names;
}

function checkUsage(appDir, colorNames) {
  const files = findTsxFiles(appDir);
  const allContent = files.map(f => fs.readFileSync(f, 'utf-8')).join('\n');
  
  const used = [];
  const unused = [];
  
  for (const name of colorNames) {
    // CSS var 名: snake_case 转 kebab-case，但已经是 kebab-case 的保持不变
    const kebabName = name.replace(/_/g, '-');
    // 检查 CSS var 使用: --app-c-{name}
    const cssVarPattern = new RegExp(`--app-c-${kebabName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    // 检查直接引用: colors.{name} 或 colors['{name}']
    const directPattern = name.includes('-')
      ? new RegExp(`colors\\[['"]${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\]`)
      : new RegExp(`colors\\.${name}\\b`);
    
    if (cssVarPattern.test(allContent) || directPattern.test(allContent)) {
      used.push(name);
    } else {
      unused.push(name);
    }
  }
  
  return { used, unused };
}

console.log('============================================================');
console.log('Colors 使用情况分析');
console.log('============================================================\n');

const apps = fs.readdirSync(APPS_DIR).filter(f => {
  return fs.statSync(path.join(APPS_DIR, f)).isDirectory();
});

let totalDefined = 0;
let totalUsed = 0;

for (const app of apps) {
  // 跳过已完成迁移的应用
  if (SKIP_APPS.includes(app)) {
    console.log(`### ${app} [跳过 - 已迁移]`);
    console.log('');
    continue;
  }
  
  const colorsPath = path.join(APPS_DIR, app, 'res', 'colors.ts');
  if (!fs.existsSync(colorsPath)) continue;
  
  const colorNames = extractColorNames(colorsPath);
  if (colorNames.length === 0) continue;
  
  const { used, unused } = checkUsage(path.join(APPS_DIR, app), colorNames);
  
  totalDefined += colorNames.length;
  totalUsed += used.length;
  
  const rate = colorNames.length > 0 ? Math.round(used.length / colorNames.length * 100) : 0;
  
  console.log(`### ${app}`);
  console.log(`定义: ${colorNames.length}, 使用: ${used.length} (${rate}%)`);
  
  if (unused.length > 0 && unused.length <= 10) {
    console.log(`  ❌ 未使用: ${unused.join(', ')}`);
  } else if (unused.length > 10) {
    console.log(`  ❌ 未使用: ${unused.length} 个`);
  }
  console.log('');
}

console.log('============================================================');
console.log(`总计: 定义 ${totalDefined}, 使用 ${totalUsed} (${Math.round(totalUsed/totalDefined*100)}%)`);
