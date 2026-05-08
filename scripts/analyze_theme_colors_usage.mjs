#!/usr/bin/env node
/**
 * 分析 manifest.ts 中 theme.colors 的使用情况
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.join(__dirname, '..', 'apps');

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

// 标准的 theme.colors 键名
const THEME_COLOR_KEYS = [
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'background', 'onBackground', 'surface', 'onSurface',
  'error', 'onError', 'border', 'divider'
];

console.log('============================================================');
console.log('Manifest Theme Colors 使用情况分析');
console.log('============================================================\n');

const apps = fs.readdirSync(APPS_DIR).filter(f => {
  return fs.statSync(path.join(APPS_DIR, f)).isDirectory();
});

for (const app of apps) {
  const manifestPath = path.join(APPS_DIR, app, 'manifest.ts');
  if (!fs.existsSync(manifestPath)) continue;
  
  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
  
  // 提取定义的 theme.colors 键
  const colorsMatch = manifestContent.match(/colors:\s*{([^}]+)}/s);
  if (!colorsMatch) continue;
  
  const definedKeys = [];
  const colorBlock = colorsMatch[1];
  const keyRegex = /(\w+):/g;
  let match;
  while ((match = keyRegex.exec(colorBlock)) !== null) {
    definedKeys.push(match[1]);
  }
  
  if (definedKeys.length === 0) continue;
  
  // 检查使用情况
  const files = findTsxFiles(path.join(APPS_DIR, app));
  const allContent = files.map(f => fs.readFileSync(f, 'utf-8')).join('\n');
  
  const used = [];
  const unused = [];
  
  for (const key of definedKeys) {
    // theme colors 被转换为 --app-{key} CSS 变量
    // 使用方式: bg-app-{key}, text-app-{key}, border-app-{key} 等
    const pattern = new RegExp(`app-${key}(?:\\s|"|'|\\)|\\]|,|;|$)`, 'i');
    if (pattern.test(allContent)) {
      used.push(key);
    } else {
      unused.push(key);
    }
  }
  
  const rate = definedKeys.length > 0 ? Math.round(used.length / definedKeys.length * 100) : 0;
  
  console.log(`### ${app}`);
  console.log(`定义: ${definedKeys.length}, 使用: ${used.length} (${rate}%)`);
  if (unused.length > 0) {
    console.log(`  ❌ 未使用: ${unused.join(', ')}`);
  }
  console.log('');
}
