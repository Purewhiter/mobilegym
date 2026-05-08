#!/usr/bin/env node
/**
 * 分析各 App 的 dimens.ts 使用情况
 * 找出哪些定义实际被代码使用，哪些是"文档性质"
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 跳过这些已完成迁移的应用
const SKIP_APPS = ['Wechat', 'WechatReading'];

const args = process.argv.slice(2);
const targetApp = args.find(a => a.startsWith('--app='))?.split('=')[1];
const showUnused = args.includes('--unused');

const appsDir = join(ROOT, 'apps');
const apps = targetApp ? [targetApp] : readdirSync(appsDir).filter(f => {
  const dimensPath = join(appsDir, f, 'res', 'dimens.ts');
  return existsSync(dimensPath) && !SKIP_APPS.includes(f);
});

console.log('='.repeat(60));
console.log('Dimens 使用情况分析');
console.log('='.repeat(60));
console.log('');

for (const app of apps) {
  const dimensPath = join(appsDir, app, 'res', 'dimens.ts');
  const appDir = join(appsDir, app);
  
  // 解析 dimens.ts 中的定义
  const content = readFileSync(dimensPath, 'utf-8');
  const definitions = [];
  const regex = /(\w+):\s*(\d+)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    definitions.push({ name: match[1], value: parseInt(match[2]) });
  }
  
  // 分类
  const icSizeDefs = definitions.filter(d => d.name.startsWith('icSize') || d.name.startsWith('icStroke'));
  const layoutDefs = definitions.filter(d => !d.name.startsWith('icSize') && !d.name.startsWith('icStroke'));
  
  // 检查使用情况
  // 1. dimens.xxx 形式
  let dimesUsed = [];
  try {
    const grepResult = execSync(
      `grep -roh "dimens\\.[a-zA-Z_]*" "${appDir}" --include="*.tsx" 2>/dev/null | sort -u`,
      { encoding: 'utf-8' }
    ).trim();
    if (grepResult) {
      dimesUsed = grepResult.split('\n').map(s => s.replace('dimens.', ''));
    }
  } catch (e) {}
  
  // 2. CSS 变量形式 --app-xxx
  let cssVarUsed = [];
  try {
    const grepResult = execSync(
      `grep -roh "\\-\\-app-[a-z0-9-]*" "${appDir}" --include="*.tsx" 2>/dev/null | sort -u`,
      { encoding: 'utf-8' }
    ).trim();
    if (grepResult) {
      cssVarUsed = grepResult.split('\n')
        .map(s => s.replace('--app-', '').replace(/-/g, '_'))
        .filter(s => !s.startsWith('c_') && !s.startsWith('cs_') && 
                     !['primary', 'text', 'bg', 'surface', 'border', 'secondary'].includes(s));
    }
  } catch (e) {}
  
  // 合并使用的 dimens
  const allUsed = new Set([...dimesUsed, ...cssVarUsed]);
  
  // 统计
  const icSizeUsed = icSizeDefs.filter(d => allUsed.has(d.name));
  const layoutUsed = layoutDefs.filter(d => allUsed.has(d.name));
  const layoutUnused = layoutDefs.filter(d => !allUsed.has(d.name));
  
  console.log(`\n### ${app}`);
  console.log(`icSize 定义: ${icSizeDefs.length}, 布局定义: ${layoutDefs.length}`);
  console.log(`布局使用: ${layoutUsed.length}/${layoutDefs.length} (${layoutDefs.length ? Math.round(layoutUsed.length/layoutDefs.length*100) : 0}%)`);
  
  if (layoutUsed.length > 0) {
    console.log(`  ✅ 已使用: ${layoutUsed.map(d => d.name).join(', ')}`);
  }
  
  if (showUnused && layoutUnused.length > 0) {
    console.log(`  ❌ 未使用: ${layoutUnused.slice(0, 10).map(d => d.name).join(', ')}${layoutUnused.length > 10 ? ` ... (共${layoutUnused.length}个)` : ''}`);
  }
}

console.log('\n' + '='.repeat(60));
console.log('建议:');
console.log('  - 布局使用率 0%: 可删除所有布局 dimens，只保留 icSize*');
console.log('  - 布局使用率 < 20%: 建议清理未使用的');
console.log('  - 布局使用率 > 50%: 保留，考虑迁移剩余代码');
