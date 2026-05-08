#!/usr/bin/env node
/**
 * 启发式颜色迁移脚本
 * 
 * 方案：
 * 1. 扫描所有 Tailwind 灰色使用
 * 2. 按"页面_原始颜色_用途"自动生成 CSS 变量名
 * 3. 在 colors.ts 中添加定义（保留原始值，视觉不变）
 * 4. 后续人工审核，合并语义相同的颜色
 * 
 * 命名规则：
 *   text-gray-400 in ChatList.tsx → heuristic_chatList_text_gray400
 *   bg-gray-100 in Settings.tsx   → heuristic_settings_bg_gray100
 * 
 * 用法：
 *   node scripts/migrate_colors_heuristic.mjs --app=Wechat           # 预览
 *   node scripts/migrate_colors_heuristic.mjs --app=Wechat --execute # 执行
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, relative, basename, dirname } from 'path';

// Tailwind 灰色标准值
const TAILWIND_GRAY = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
};

// 解析命令行参数
const args = process.argv.slice(2);
const appArg = args.find(a => a.startsWith('--app='));
const targetApp = appArg?.split('=')[1];
const dryRun = !args.includes('--execute');

if (!targetApp) {
  console.error('用法: node scripts/migrate_colors_heuristic.mjs --app=Wechat');
  process.exit(1);
}

const APP_DIR = join(process.cwd(), 'apps', targetApp);
const COLORS_FILE = join(APP_DIR, 'res/colors.ts');

console.log('━'.repeat(60));
console.log('启发式颜色迁移');
console.log('━'.repeat(60));
console.log(`目标 App: ${targetApp}`);
console.log(`模式: ${dryRun ? '🔍 预览' : '⚡ 执行'}`);
console.log('━'.repeat(60));
console.log('');

// 要处理的灰色模式
const GRAY_PATTERNS = [
  { regex: /\b(text-gray-(\d+))\b/g, type: 'text', prefix: 'text' },
  { regex: /\b(bg-gray-(\d+))\b/g, type: 'bg', prefix: 'bg' },
  { regex: /\b(border-gray-(\d+))\b/g, type: 'border', prefix: 'border' },
  { regex: /\b(active:bg-gray-(\d+))\b/g, type: 'active_bg', prefix: 'active_bg' },
  { regex: /\b(hover:bg-gray-(\d+))\b/g, type: 'hover_bg', prefix: 'hover_bg' },
];

// 从文件路径生成页面标识
function getPageId(filePath) {
  const fileName = basename(filePath, '.tsx');
  const dirName = basename(dirname(filePath));
  
  // 特殊处理
  if (fileName === 'WechatApp' || fileName === `${targetApp}App`) return 'app';
  if (dirName === 'components') return `comp_${camelCase(fileName)}`;
  if (dirName === 'pages') return camelCase(fileName);
  if (dirName !== targetApp) return `${camelCase(dirName)}_${camelCase(fileName)}`;
  return camelCase(fileName);
}

function camelCase(str) {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/-/g, '_');
}

// 收集所有灰色使用
function getAllFiles(dir, files = []) {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory() && !item.startsWith('.')) {
      getAllFiles(fullPath, files);
    } else if (item.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

// 扫描收集所有灰色使用
const files = getAllFiles(APP_DIR);
const colorUsages = new Map(); // varName -> { hex, files: [], count }
const fileChanges = new Map(); // filePath -> replacements[]

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf-8');
  const pageId = getPageId(filePath);
  const relativePath = relative(APP_DIR, filePath);
  
  for (const { regex, prefix } of GRAY_PATTERNS) {
    const clonedRegex = new RegExp(regex.source, 'g');
    let match;
    while ((match = clonedRegex.exec(content)) !== null) {
      const fullClass = match[1];
      const shade = match[2];
      const hex = TAILWIND_GRAY[shade];
      
      if (!hex) continue;
      
      // 生成启发式变量名
      const varName = `heuristic_${pageId}_${prefix}_gray${shade}`;
      
      if (!colorUsages.has(varName)) {
        colorUsages.set(varName, { hex, originalClass: fullClass, files: new Set(), count: 0 });
      }
      const usage = colorUsages.get(varName);
      usage.files.add(relativePath);
      usage.count++;
      
      // 记录文件修改
      if (!fileChanges.has(filePath)) {
        fileChanges.set(filePath, []);
      }
      fileChanges.get(filePath).push({
        from: fullClass,
        to: fullClass.replace(`gray-${shade}`, `(--app-c-${varName})`),
        varName,
      });
    }
  }
}

// 按页面分组显示
console.log('📋 发现的灰色使用（启发式命名）');
console.log('─'.repeat(40));

const sortedUsages = [...colorUsages.entries()].sort((a, b) => a[0].localeCompare(b[0]));

let currentPage = '';
for (const [varName, { hex, originalClass, files, count }] of sortedUsages) {
  const page = varName.split('_')[1];
  if (page !== currentPage) {
    currentPage = page;
    console.log(`\n  【${page}】`);
  }
  console.log(`    ${varName}: '${hex}'`);
  console.log(`      原始: ${originalClass} (${count} 处)`);
}

console.log('');
console.log('─'.repeat(40));
console.log(`总计: ${colorUsages.size} 个变量, ${[...colorUsages.values()].reduce((s, u) => s + u.count, 0)} 处使用`);
console.log('');

// 生成 colors.ts 追加内容
const newColorDefs = [];
newColorDefs.push('');
newColorDefs.push('  // ===== 启发式迁移颜色（待审核）=====');
newColorDefs.push('  // 命名规则: heuristic_<page>_<type>_gray<shade>');
newColorDefs.push('  // 审核后请改为语义命名并删除 heuristic_ 前缀');
for (const [varName, { hex }] of sortedUsages) {
  newColorDefs.push(`  ${varName}: '${hex}',`);
}

console.log('📋 将添加到 colors.ts 的内容:');
console.log('─'.repeat(40));
console.log(newColorDefs.slice(0, 15).join('\n'));
if (newColorDefs.length > 15) {
  console.log(`  ... 还有 ${newColorDefs.length - 15} 行`);
}
console.log('');

// 显示文件修改示例
console.log('📋 文件修改示例:');
console.log('─'.repeat(40));
const sampleFiles = [...fileChanges.entries()].slice(0, 3);
for (const [filePath, changes] of sampleFiles) {
  console.log(`  ${relative(APP_DIR, filePath)}`);
  for (const change of changes.slice(0, 2)) {
    console.log(`    ${change.from} → ${change.to}`);
  }
  if (changes.length > 2) {
    console.log(`    ... 还有 ${changes.length - 2} 处`);
  }
}
console.log('');

if (dryRun) {
  console.log('━'.repeat(60));
  console.log('💡 预览模式 - 添加 --execute 执行迁移');
  console.log('━'.repeat(60));
} else {
  // 执行：更新 colors.ts
  if (existsSync(COLORS_FILE)) {
    let colorsContent = readFileSync(COLORS_FILE, 'utf-8');
    
    // 在 } as const 前插入新颜色
    const insertPoint = colorsContent.lastIndexOf('} as const');
    if (insertPoint > 0) {
      colorsContent = colorsContent.slice(0, insertPoint) + newColorDefs.join('\n') + '\n' + colorsContent.slice(insertPoint);
      writeFileSync(COLORS_FILE, colorsContent);
      console.log(`✅ 已更新 ${COLORS_FILE}`);
    }
  }
  
  // 执行：更新各文件
  for (const [filePath, changes] of fileChanges) {
    let content = readFileSync(filePath, 'utf-8');
    for (const { from, to } of changes) {
      content = content.replace(new RegExp(escapeRegex(from), 'g'), to);
    }
    writeFileSync(filePath, content);
  }
  console.log(`✅ 已更新 ${fileChanges.size} 个文件`);
  
  console.log('');
  console.log('━'.repeat(60));
  console.log('✅ 迁移完成！视觉效果不变（使用原始 hex 值）');
  console.log('');
  console.log('下一步: 审核 colors.ts 中的 heuristic_ 颜色');
  console.log('  1. 合并语义相同的颜色');
  console.log('  2. 改为语义命名（去掉 heuristic_ 前缀）');
  console.log('━'.repeat(60));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
