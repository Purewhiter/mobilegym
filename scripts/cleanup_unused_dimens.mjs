#!/usr/bin/env node
/**
 * 清理未使用的布局 dimens，只保留 icSize* 和实际使用的布局常量
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// 跳过这些已完成迁移的应用
const SKIP_APPS = ['Wechat', 'WechatReading'];

const args = process.argv.slice(2);
const targetApp = args.find(a => a.startsWith('--app='))?.split('=')[1];
const dryRun = !args.includes('--execute');

if (!targetApp) {
  console.log('用法: node scripts/cleanup_unused_dimens.mjs --app=<AppName> [--execute]');
  process.exit(1);
}

if (SKIP_APPS.includes(targetApp)) {
  console.log(`跳过 ${targetApp} - 已完成迁移`);
  process.exit(0);
}

console.log(`目标 App: ${targetApp}`);
console.log(`模式: ${dryRun ? '预览' : '执行'}`);
console.log('');

const dimensPath = join(ROOT, 'apps', targetApp, 'res', 'dimens.ts');
const appDir = join(ROOT, 'apps', targetApp);

if (!existsSync(dimensPath)) {
  console.error(`错误: ${dimensPath} 不存在`);
  process.exit(1);
}

// 读取 dimens.ts
const content = readFileSync(dimensPath, 'utf-8');

// 检查使用情况
let usedNames = new Set();

// 1. dimens.xxx 形式
try {
  const grepResult = execSync(
    `grep -roh "dimens\\.[a-zA-Z_]*" "${appDir}" --include="*.tsx" 2>/dev/null | sort -u`,
    { encoding: 'utf-8' }
  ).trim();
  if (grepResult) {
    grepResult.split('\n').forEach(s => usedNames.add(s.replace('dimens.', '')));
  }
} catch (e) {}

// 2. CSS 变量形式 --app-xxx
try {
  const grepResult = execSync(
    `grep -roh "\\-\\-app-[a-z0-9-]*" "${appDir}" --include="*.tsx" 2>/dev/null | sort -u`,
    { encoding: 'utf-8' }
  ).trim();
  if (grepResult) {
    grepResult.split('\n')
      .map(s => s.replace('--app-', '').replace(/-/g, '_'))
      .filter(s => !s.startsWith('c_') && !s.startsWith('cs_') && 
                   !['primary', 'text', 'bg', 'surface', 'border', 'secondary'].includes(s))
      .forEach(s => usedNames.add(s));
  }
} catch (e) {}

console.log(`实际使用的 dimens: ${usedNames.size > 0 ? [...usedNames].join(', ') : '无'}`);
console.log('');

// 解析并过滤
const lines = content.split('\n');
const newLines = [];
let inDimens = false;
let removedCount = 0;
let keptCount = 0;

for (const line of lines) {
  // 检测 dimens 对象开始
  if (line.includes('export const dimens')) {
    inDimens = true;
    newLines.push(line);
    continue;
  }
  
  // 检测 dimens 对象结束
  if (inDimens && line.includes('} as const')) {
    inDimens = false;
    newLines.push(line);
    continue;
  }
  
  if (!inDimens) {
    newLines.push(line);
    continue;
  }
  
  // 解析 dimens 定义行
  const match = line.match(/^\s*(\w+):\s*(\d+)/);
  if (!match) {
    // 注释或空行
    // 检查下一行是否被删除，如果是则也删除这个注释
    newLines.push(line);
    continue;
  }
  
  const [, name] = match;
  const isIcSize = name.startsWith('icSize') || name.startsWith('icStroke');
  const isUsed = usedNames.has(name);
  
  if (isIcSize || isUsed) {
    newLines.push(line);
    keptCount++;
  } else {
    removedCount++;
    console.log(`  删除: ${name}`);
  }
}

// 清理多余的空行和孤立注释
let cleanedLines = [];
for (let i = 0; i < newLines.length; i++) {
  const line = newLines[i];
  const prevLine = cleanedLines[cleanedLines.length - 1] || '';
  
  // 跳过连续空行
  if (line.trim() === '' && prevLine.trim() === '') {
    continue;
  }
  
  cleanedLines.push(line);
}

console.log('');
console.log(`保留: ${keptCount}, 删除: ${removedCount}`);

if (!dryRun && removedCount > 0) {
  writeFileSync(dimensPath, cleanedLines.join('\n'), 'utf-8');
  console.log(`✅ 已保存 ${dimensPath}`);
} else if (dryRun && removedCount > 0) {
  console.log('\n预览完成。添加 --execute 执行清理。');
}
