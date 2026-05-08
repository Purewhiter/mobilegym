#!/usr/bin/env node
/**
 * 验证 App 的 dimens.ts icSize 定义是否覆盖代码中实际使用的尺寸
 * 
 * 用法: node scripts/verify_dimens_coverage.mjs [--app=AppName]
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPS_DIR = resolve(__dirname, '..', 'apps');

const args = process.argv.slice(2);
const appArg = args.find(a => a.startsWith('--app='));
const targetApp = appArg?.split('=')[1];

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const path = join(dir, file);
    const stat = statSync(path);
    if (stat.isDirectory() && file !== 'node_modules' && file !== 'res') {
      walkDir(path, callback);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(path);
    }
  }
}

function analyzeApp(appName) {
  const appDir = join(APPS_DIR, appName);
  if (!existsSync(appDir)) return null;
  
  // 读取 dimens.ts 获取 icSize 定义
  const dimensPath = join(appDir, 'res', 'dimens.ts');
  const definedSizes = new Set();
  if (existsSync(dimensPath)) {
    const content = readFileSync(dimensPath, 'utf-8');
    const regex = /icSize\w+:\s*(\d+)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      definedSizes.add(parseInt(match[1], 10));
    }
  }
  
  // 统计代码中使用的尺寸
  const usedSizes = {};
  const sizeDetails = {};
  
  walkDir(appDir, (filePath) => {
    const content = readFileSync(filePath, 'utf-8');
    // 匹配: <组件名 ... size={数字}>，组件名必须首字母大写
    const regex = /<([A-Z][a-zA-Z0-9]*)[^>]*\bsize=\{(\d+)\}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const icon = match[1];
      const size = parseInt(match[2], 10);
      usedSizes[size] = (usedSizes[size] || 0) + 1;
      if (!sizeDetails[size]) sizeDetails[size] = [];
      sizeDetails[size].push(icon);
    }
  });
  
  // 分析缺失
  const missing = [];
  const covered = [];
  for (const [size, count] of Object.entries(usedSizes).sort((a, b) => b[1] - a[1])) {
    const sizeNum = parseInt(size, 10);
    if (definedSizes.has(sizeNum)) {
      covered.push({ size: sizeNum, count, icons: [...new Set(sizeDetails[sizeNum])] });
    } else {
      missing.push({ size: sizeNum, count, icons: [...new Set(sizeDetails[sizeNum])] });
    }
  }
  
  return {
    appName,
    defined: [...definedSizes].sort((a, b) => a - b),
    covered,
    missing,
    totalUsed: Object.values(usedSizes).reduce((a, b) => a + b, 0),
  };
}

// 主逻辑
const apps = targetApp ? [targetApp] : readdirSync(APPS_DIR).filter(f => 
  statSync(join(APPS_DIR, f)).isDirectory()
);

console.log('# dimens icSize 覆盖率验证报告\n');

const allMissing = [];

for (const appName of apps) {
  const result = analyzeApp(appName);
  if (!result || result.totalUsed === 0) continue;
  
  const coverageCount = result.covered.reduce((a, b) => a + b.count, 0);
  const coveragePct = ((coverageCount / result.totalUsed) * 100).toFixed(1);
  
  console.log(`## ${appName}`);
  console.log(`- 定义的尺寸: ${result.defined.join(', ') || '(无)'}`);
  console.log(`- 覆盖率: ${coverageCount}/${result.totalUsed} (${coveragePct}%)`);
  
  if (result.missing.length > 0) {
    console.log(`- **缺失的尺寸**:`);
    for (const m of result.missing) {
      console.log(`  - size={${m.size}}: ${m.count}次, 图标: ${m.icons.slice(0, 5).join(', ')}${m.icons.length > 5 ? '...' : ''}`);
      allMissing.push({ app: appName, ...m });
    }
  }
  console.log('');
}

if (!targetApp && allMissing.length > 0) {
  console.log('---');
  console.log('## 汇总：需要补充定义的常见尺寸\n');
  
  const sizeStats = {};
  for (const m of allMissing) {
    if (!sizeStats[m.size]) sizeStats[m.size] = { count: 0, apps: [], icons: new Set() };
    sizeStats[m.size].count += m.count;
    sizeStats[m.size].apps.push(m.app);
    m.icons.forEach(i => sizeStats[m.size].icons.add(i));
  }
  
  for (const [size, stat] of Object.entries(sizeStats).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`- **size={${size}}**: ${stat.count}次, ${stat.apps.length}个App`);
    console.log(`  图标: ${[...stat.icons].slice(0, 8).join(', ')}`);
  }
}
