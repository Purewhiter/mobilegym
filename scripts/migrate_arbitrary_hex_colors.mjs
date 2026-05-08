#!/usr/bin/env node
/**
 * 迁移 Tailwind 任意值硬编码颜色（如 text-[#xxx]、bg-[#xxx]）
 * 
 * 启发式命名规则：
 *   1. 从文件路径提取上下文（如 discover/NearbyPeople → nearby）
 *   2. 从类名提取用途（如 border-b → border_bottom）
 *   3. 组合生成变量名：<context>_<usage>_<hex_suffix>
 * 
 * 用法：
 *   node scripts/migrate_arbitrary_hex_colors.mjs --app=Wechat           # 预览
 *   node scripts/migrate_arbitrary_hex_colors.mjs --app=Wechat --execute # 执行
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, relative, basename, dirname } from 'path';

// 解析命令行参数
const args = process.argv.slice(2);
const appArg = args.find(a => a.startsWith('--app='));
const targetApp = appArg?.split('=')[1];
const dryRun = !args.includes('--execute');

if (!targetApp) {
  console.error('用法: node scripts/migrate_arbitrary_hex_colors.mjs --app=Wechat');
  process.exit(1);
}

const APP_DIR = join(process.cwd(), 'apps', targetApp);
const COLORS_FILE = join(APP_DIR, 'res/colors.ts');

console.log('━'.repeat(60));
console.log('任意值 hex 颜色迁移');
console.log('━'.repeat(60));
console.log(`目标 App: ${targetApp}`);
console.log(`模式: ${dryRun ? '🔍 预览' : '⚡ 执行'}`);
console.log('━'.repeat(60));
console.log('');

// 匹配模式：text-[#xxx], bg-[#xxx], border-[#xxx], border-t-[#xxx] 等
const HEX_PATTERNS = [
  { regex: /\btext-\[#([0-9a-fA-F]{3,6})\]/g, type: 'text' },
  { regex: /\bbg-\[#([0-9a-fA-F]{3,6})\]/g, type: 'bg' },
  { regex: /\bborder-\[#([0-9a-fA-F]{3,6})\]/g, type: 'border' },
  { regex: /\bborder-t-\[#([0-9a-fA-F]{3,6})\]/g, type: 'border_top' },
  { regex: /\bborder-b-\[#([0-9a-fA-F]{3,6})\]/g, type: 'border_bottom' },
  { regex: /\bborder-l-\[#([0-9a-fA-F]{3,6})\]/g, type: 'border_left' },
  { regex: /\bborder-r-\[#([0-9a-fA-F]{3,6})\]/g, type: 'border_right' },
  { regex: /\bfill-\[#([0-9a-fA-F]{3,6})\]/g, type: 'fill' },
  { regex: /\bstroke-\[#([0-9a-fA-F]{3,6})\]/g, type: 'stroke' },
  { regex: /\bfrom-\[#([0-9a-fA-F]{3,6})\]/g, type: 'gradient_from' },
  { regex: /\bto-\[#([0-9a-fA-F]{3,6})\]/g, type: 'gradient_to' },
  { regex: /\bvia-\[#([0-9a-fA-F]{3,6})\]/g, type: 'gradient_via' },
];

// 从文件路径提取上下文名称
function getContextFromPath(filePath) {
  const parts = filePath.split('/');
  const fileName = basename(filePath, '.tsx');
  
  // 尝试从目录名获取上下文
  if (parts.includes('pages')) {
    const pagesIdx = parts.indexOf('pages');
    if (parts.length > pagesIdx + 2) {
      // pages/discover/NearbyPeople.tsx → nearby_people
      return toSnakeCase(parts[pagesIdx + 1]) + '_' + toSnakeCase(fileName);
    }
    // pages/ChatList.tsx → chat_list
    return toSnakeCase(fileName);
  }
  
  // 组件等其他文件
  return toSnakeCase(fileName);
}

function toSnakeCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

// 生成变量名
function generateVarName(context, type, hex) {
  // 简化 hex 后缀（取前 4 位）
  const hexSuffix = hex.toLowerCase().slice(0, 4);
  return `${context}_${type}_${hexSuffix}`;
}

// 收集所有文件
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

// 扫描
const files = getAllFiles(APP_DIR);
const colorUsages = new Map(); // varName → { hex, type, originalClass, files }
const replacements = []; // { filePath, from, to, varName }

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(APP_DIR, filePath);
  const context = getContextFromPath(relativePath);
  
  for (const { regex, type } of HEX_PATTERNS) {
    const clonedRegex = new RegExp(regex.source, 'g');
    let match;
    while ((match = clonedRegex.exec(content)) !== null) {
      const hex = match[1].toLowerCase();
      const fullHex = hex.length === 3 
        ? hex.split('').map(c => c + c).join('')
        : hex;
      
      const varName = generateVarName(context, type, fullHex);
      const originalClass = match[0];
      
      // 生成 CSS 变量引用
      let cssVarClass;
      if (type.startsWith('border_')) {
        // border-t-[#xxx] → border-t-(--app-c-xxx)
        const dir = type.replace('border_', '');
        cssVarClass = `border-${dir.charAt(0)}-(--app-c-${varName.replace(/_/g, '-')})`;
      } else if (type.startsWith('gradient_')) {
        const gradType = type.replace('gradient_', '');
        cssVarClass = `${gradType}-(--app-c-${varName.replace(/_/g, '-')})`;
      } else {
        cssVarClass = `${type}-(--app-c-${varName.replace(/_/g, '-')})`;
      }
      
      if (!colorUsages.has(varName)) {
        colorUsages.set(varName, { 
          hex: `#${fullHex}`, 
          type, 
          originalClass, 
          cssVarClass,
          files: new Set() 
        });
      }
      colorUsages.get(varName).files.add(relativePath);
      
      replacements.push({ filePath, from: originalClass, to: cssVarClass, varName });
    }
  }
}

// 显示结果
if (colorUsages.size === 0) {
  console.log('✅ 没有找到任意值 hex 颜色硬编码');
  process.exit(0);
}

console.log(`📋 发现 ${colorUsages.size} 个硬编码颜色`);
console.log('─'.repeat(60));
console.log('');

console.log('变量名                              | Hex     | 类型');
console.log('─'.repeat(60));
for (const [varName, { hex, type, originalClass, cssVarClass, files }] of colorUsages) {
  console.log(`${varName.padEnd(36)}| ${hex.padEnd(8)}| ${type}`);
  console.log(`  原始: ${originalClass}`);
  console.log(`  迁移: ${cssVarClass}`);
  console.log(`  文件: ${[...files].join(', ')}`);
  console.log('');
}

// 生成 colors.ts 追加内容
const newColorDefs = [];
newColorDefs.push('');
newColorDefs.push('  // ===== 任意值 hex 迁移（启发式命名）=====');
newColorDefs.push('  // 审核后请改为语义命名');
for (const [varName, { hex }] of colorUsages) {
  newColorDefs.push(`  '${varName.replace(/_/g, '-')}': '${hex}',`);
}

console.log('📋 将添加到 colors.ts:');
console.log('─'.repeat(40));
for (const line of newColorDefs) {
  console.log(line);
}
console.log('');

if (dryRun) {
  console.log('━'.repeat(60));
  console.log('💡 预览模式 - 添加 --execute 执行迁移');
  console.log('━'.repeat(60));
} else {
  // 更新 colors.ts（插入到主 colors 对象中，在 colorsDark 之前）
  if (existsSync(COLORS_FILE)) {
    let colorsContent = readFileSync(COLORS_FILE, 'utf-8');
    // 找到第一个 } as const（主 colors 对象的结尾），而不是 colorsDark 的
    const colorsDarkMatch = colorsContent.indexOf('export const colorsDark');
    if (colorsDarkMatch > 0) {
      // 在 colorsDark 之前找到 } as const
      const beforeColorsDark = colorsContent.slice(0, colorsDarkMatch);
      const insertPoint = beforeColorsDark.lastIndexOf('} as const');
      if (insertPoint > 0) {
        colorsContent = colorsContent.slice(0, insertPoint) + newColorDefs.join('\n') + '\n' + colorsContent.slice(insertPoint);
        writeFileSync(COLORS_FILE, colorsContent);
        console.log(`✅ 已更新 ${relative(process.cwd(), COLORS_FILE)}`);
      }
    }
  }
  
  // 更新各文件
  const fileChanges = new Map();
  for (const { filePath, from, to } of replacements) {
    if (!fileChanges.has(filePath)) {
      fileChanges.set(filePath, readFileSync(filePath, 'utf-8'));
    }
    let content = fileChanges.get(filePath);
    content = content.replace(from, to);
    fileChanges.set(filePath, content);
  }
  
  for (const [filePath, content] of fileChanges) {
    writeFileSync(filePath, content);
    console.log(`✅ 已更新 ${relative(process.cwd(), filePath)}`);
  }
  
  console.log('');
  console.log('━'.repeat(60));
  console.log('✅ 迁移完成！');
  console.log('━'.repeat(60));
}
