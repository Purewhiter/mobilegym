#!/usr/bin/env node
/**
 * 验证颜色迁移的数值一致性
 * 
 * 功能：
 * 1. 检查 manifest.ts 中 Tier-1 颜色的定义值
 * 2. 检查 colors.ts 中 Tier-2 颜色的定义值
 * 3. 与 Tailwind 标准颜色对比，确保迁移不会改变视觉效果
 * 
 * 用法：
 *   node scripts/verify_color_values.mjs --app=Wechat
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Tailwind 灰色标准值（默认调色板）
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
  950: '#030712',
};

// 解析命令行参数
const args = process.argv.slice(2);
const appArg = args.find(a => a.startsWith('--app='));
const targetApp = appArg?.split('=')[1];

if (!targetApp) {
  console.error('用法: node scripts/verify_color_values.mjs --app=Wechat');
  process.exit(1);
}

const APP_DIR = join(process.cwd(), 'apps', targetApp);

// 读取 manifest.ts 中的 theme colors
function parseManifestColors() {
  try {
    const content = readFileSync(join(APP_DIR, 'manifest.ts'), 'utf-8');
    const colors = {};
    
    // 提取 theme.colors 对象
    const themeMatch = content.match(/theme:\s*\{[\s\S]*?colors:\s*\{([\s\S]*?)\}/);
    if (themeMatch) {
      const colorBlock = themeMatch[1];
      const colorRegex = /(\w+):\s*['"]([^'"]+)['"]/g;
      let match;
      while ((match = colorRegex.exec(colorBlock)) !== null) {
        colors[match[1]] = match[2].toLowerCase();
      }
    }
    return colors;
  } catch {
    return {};
  }
}

// 读取 colors.ts 中的颜色定义
function parseColorsTs() {
  try {
    const content = readFileSync(join(APP_DIR, 'res/colors.ts'), 'utf-8');
    const colors = {};
    
    const colorRegex = /(\w+):\s*['"]([^'"]+)['"]/g;
    let match;
    while ((match = colorRegex.exec(content)) !== null) {
      colors[match[1]] = match[2].toLowerCase();
    }
    return colors;
  } catch {
    return {};
  }
}

// 颜色接近度比较（允许微小差异）
function colorsMatch(hex1, hex2) {
  if (!hex1 || !hex2) return false;
  return hex1.toLowerCase() === hex2.toLowerCase();
}

// 查找最接近的 Tailwind 灰色
function findClosestTailwindGray(hex) {
  const normalizedHex = hex.toLowerCase();
  for (const [shade, value] of Object.entries(TAILWIND_GRAY)) {
    if (value === normalizedHex) {
      return `gray-${shade}`;
    }
  }
  return null;
}

console.log('━'.repeat(60));
console.log(`颜色值验证 - ${targetApp}`);
console.log('━'.repeat(60));
console.log('');

// 1. 显示 Tier-1 颜色（manifest.ts）
console.log('📋 Tier-1 颜色 (manifest.ts theme.colors)');
console.log('─'.repeat(40));
const manifestColors = parseManifestColors();
const tier1Mapping = {
  textPrimary: { class: 'text-app-text', replaces: ['text-gray-900', 'text-gray-800'] },
  surface: { class: 'bg-app-surface', replaces: ['bg-white'] },
  background: { class: 'bg-app-bg', replaces: ['bg-gray-100'] },
  border: { class: 'border-app-border', replaces: ['border-gray-200'] },
};

for (const [key, value] of Object.entries(manifestColors)) {
  const mapping = tier1Mapping[key];
  const tailwindMatch = findClosestTailwindGray(value);
  console.log(`  ${key}: ${value}`);
  if (mapping) {
    console.log(`    → ${mapping.class}`);
    if (tailwindMatch) {
      console.log(`    ≈ Tailwind ${tailwindMatch}`);
    }
  }
}

console.log('');

// 2. 显示 Tier-2 颜色（colors.ts）
console.log('📋 Tier-2 颜色 (res/colors.ts)');
console.log('─'.repeat(40));
const colorsTs = parseColorsTs();
const sampleColors = Object.entries(colorsTs).slice(0, 10);
for (const [key, value] of sampleColors) {
  const tailwindMatch = findClosestTailwindGray(value);
  console.log(`  ${key}: ${value}${tailwindMatch ? ` ≈ ${tailwindMatch}` : ''}`);
}
if (Object.keys(colorsTs).length > 10) {
  console.log(`  ... 还有 ${Object.keys(colorsTs).length - 10} 个`);
}

console.log('');

// 3. 验证迁移映射
console.log('📋 迁移映射验证');
console.log('─'.repeat(40));

const validations = [
  { from: 'text-gray-900', to: 'text-app-text', expected: manifestColors.textPrimary, tailwind: TAILWIND_GRAY[900] },
  { from: 'bg-white', to: 'bg-app-surface', expected: manifestColors.surface, tailwind: '#ffffff' },
  { from: 'border-gray-200', to: 'border-app-border', expected: manifestColors.border, tailwind: TAILWIND_GRAY[200] },
];

let allPass = true;
for (const v of validations) {
  const match = colorsMatch(v.expected, v.tailwind);
  const status = match ? '✅' : '⚠️';
  if (!match) allPass = false;
  console.log(`  ${v.from} → ${v.to}`);
  console.log(`    原始: ${v.tailwind}`);
  console.log(`    目标: ${v.expected || '(未定义)'}`);
  console.log(`    状态: ${status} ${match ? '数值一致' : '数值不同！视觉可能有差异'}`);
}

console.log('');
console.log('━'.repeat(60));
if (allPass) {
  console.log('✅ 所有映射数值一致，视觉不会有差异');
} else {
  console.log('⚠️  部分映射数值不同，请确认这是预期行为');
  console.log('   （App 可能故意使用不同于 Tailwind 的颜色）');
}
console.log('━'.repeat(60));
