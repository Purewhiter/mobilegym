#!/usr/bin/env node
/**
 * 保值颜色迁移脚本（视觉零差异）
 * 
 * 核心原则：
 * 1. 使用 Tailwind 原始 hex 值，确保视觉完全不变
 * 2. 按原始类名统一命名，减少变量数量
 * 3. 后续人工审核，改为语义命名
 * 
 * 命名规则（使用连字符，匹配 toKebabCase 转换）：
 *   text-gray-400 → tw-text-gray-400 (#9ca3af)
 *   bg-gray-100   → tw-bg-gray-100 (#f3f4f6)
 *   active:bg-gray-50 → tw-active-bg-gray-50 (#f9fafb)
 * 
 * 用法：
 *   node scripts/migrate_colors_preserve_value.mjs --app=Wechat           # 预览
 *   node scripts/migrate_colors_preserve_value.mjs --app=Wechat --execute # 执行
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, relative, basename } from 'path';

// 加载 Tailwind 全色板（与官方默认一致，支持所有 palette + 50–950）
const TAILWIND_PALETTES = JSON.parse(
  readFileSync(join(process.cwd(), 'scripts', 'tailwind-palette.json'), 'utf-8')
);

// 解析命令行参数
const args = process.argv.slice(2);
const appArg = args.find(a => a.startsWith('--app='));
const targetApp = appArg?.split('=')[1];
const dryRun = !args.includes('--execute');

if (!targetApp) {
  console.error('用法: node scripts/migrate_colors_preserve_value.mjs --app=Wechat');
  process.exit(1);
}

const APP_DIR = join(process.cwd(), 'apps', targetApp);
const COLORS_FILE = join(APP_DIR, 'res/colors.ts');

console.log('━'.repeat(60));
console.log('保值颜色迁移（视觉零差异）');
console.log('━'.repeat(60));
console.log(`目标 App: ${targetApp}`);
console.log(`模式: ${dryRun ? '🔍 预览' : '⚡ 执行'}`);
console.log('━'.repeat(60));
console.log('');

// 为每个 Tailwind 色板生成模式（text/bg/border/active:bg/hover:bg/placeholder-<name>-<shade>）
const PREFIX_SPECS = [
  { classPrefix: 'text', prefix: 'text' },
  { classPrefix: 'bg', prefix: 'bg' },
  { classPrefix: 'border', prefix: 'border' },
  { classPrefix: 'active:bg', prefix: 'active_bg' },
  { classPrefix: 'hover:bg', prefix: 'hover_bg' },
  { classPrefix: 'placeholder', prefix: 'placeholder' },
];

const PALETTES = Object.entries(TAILWIND_PALETTES).map(([name, shades]) => ({
  name,
  map: shades,
  patterns: PREFIX_SPECS.map(({ classPrefix, prefix }) => ({
    regex: new RegExp(`\\b${classPrefix.replace(':', '\\:')}-${name}-(\\d+)(?!\\/)`, 'g'),
    prefix,
  })),
}));

// 带透明度的模式（用于报告「跳过」；所有色板统一用 gray 的 regex 形状，仅统计用）
const OPACITY_PATTERN_SPECS = [
  { regex: /\btext-(\w+)-(\d+)\/(\d+)/g, prefix: 'text' },
  { regex: /\bbg-(\w+)-(\d+)\/(\d+)/g, prefix: 'bg' },
  { regex: /\bborder-(\w+)-(\d+)\/(\d+)/g, prefix: 'border' },
  { regex: /\bactive:bg-(\w+)-(\d+)\/(\d+)/g, prefix: 'active_bg' },
  { regex: /\bhover:bg-(\w+)-(\d+)\/(\d+)/g, prefix: 'hover_bg' },
];

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

// 扫描收集所有使用（全 Tailwind 色板）
const files = getAllFiles(APP_DIR);
const colorUsages = new Map(); // varName -> { hex, originalClass, count, files }
const opacityUsages = new Map(); // 带透明度的用法（仅 gray）

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(APP_DIR, filePath);

  for (const palette of PALETTES) {
    const { name, map, patterns } = palette;
    for (const p of patterns) {
      const clonedRegex = new RegExp(p.regex.source, 'g');
      let match;
      while ((match = clonedRegex.exec(content)) !== null) {
        const shade = p.shade ?? match[1];
        const hex = map[shade];
        if (!hex) continue;
        const prefixNorm = p.prefix.replace(/_/g, '-');
        const varName = `tw-${prefixNorm}-${name}-${shade}`;
        const originalClass = p.prefix.includes('_')
          ? `${p.prefix.replace('_', ':')}-${name}-${shade}`
          : `${p.prefix}-${name}-${shade}`;
        if (!colorUsages.has(varName)) {
          colorUsages.set(varName, { hex, originalClass, count: 0, files: new Set() });
        }
        const usage = colorUsages.get(varName);
        usage.count++;
        usage.files.add(relativePath);
      }
    }
  }

  // 带透明度的（任意色板，仅统计并报告跳过）
  for (const { regex } of OPACITY_PATTERN_SPECS) {
    const clonedRegex = new RegExp(regex.source, 'g');
    let match;
    while ((match = clonedRegex.exec(content)) !== null) {
      const paletteName = match[1];
      const shade = match[2];
      const opacity = match[3];
      const shades = TAILWIND_PALETTES[paletteName];
      if (!shades || !shades[shade]) continue;
      const key = match[0];
      if (!opacityUsages.has(key)) {
        opacityUsages.set(key, { originalClass: key, count: 0, files: new Set() });
      }
      opacityUsages.get(key).count++;
      opacityUsages.get(key).files.add(relativePath);
    }
  }
}

// 显示统计
console.log('📋 Tailwind 颜色使用统计（全色板）');
console.log('─'.repeat(40));

const sortedUsages = [...colorUsages.entries()].sort((a, b) => b[1].count - a[1].count);

console.log('');
console.log('变量名                        | Hex     | 使用次数 | 文件数');
console.log('─'.repeat(60));
for (const [varName, { hex, count, files }] of sortedUsages) {
  const name = varName.padEnd(30);
  const hexStr = hex.padEnd(8);
  const countStr = String(count).padStart(4);
  const fileCount = String(files.size).padStart(4);
  console.log(`${name}| ${hexStr}| ${countStr} 处 | ${fileCount} 文件`);
}

const totalNormal = [...colorUsages.values()].reduce((s, u) => s + u.count, 0);
const totalOpacity = [...opacityUsages.values()].reduce((s, u) => s + u.count, 0);

console.log('');
console.log(`总计: ${colorUsages.size} 个变量, ${totalNormal} 处使用`);

// 显示带透明度的使用（⚠️ 不迁移，只报告）
if (opacityUsages.size > 0) {
  console.log('');
  console.log('⚠️  带透明度的使用（如 gray-100/50）— 不迁移');
  console.log('─'.repeat(40));
  console.log('   原因: CSS 变量不支持 Tailwind 透明度修饰符');
  console.log('   这些用法保留原样，不进行迁移');
  console.log('');
  for (const [, { originalClass, count, files }] of opacityUsages) {
    console.log(`  ⏭️  ${originalClass} (${count} 处, ${files.size} 文件) — 跳过`);
  }
  console.log(`总计: ${opacityUsages.size} 种透明度组合, ${totalOpacity} 处跳过`);
}
console.log('');

// 生成 colors.ts 追加内容
const newColorDefs = [];
newColorDefs.push('');
newColorDefs.push('  // ===== Tailwind 原值迁移（视觉零差异）=====');
newColorDefs.push("  // 命名: 'tw-<type>-gray-<shade>'（连字符需要引号包裹）");
newColorDefs.push("  // 审核后请改为语义命名（如 'tw-text-gray-400' → hint_text）");
for (const [varName, { hex }] of sortedUsages) {
  newColorDefs.push(`  '${varName}': '${hex}',`);
}

console.log('📋 将添加到 colors.ts:');
console.log('─'.repeat(40));
for (const line of newColorDefs) {
  console.log(line);
}
console.log('');

// 生成替换映射
const replacements = [];

// 注意：带透明度的颜色（如 border-gray-100/50）不迁移
// 因为 CSS 变量不支持 Tailwind 的透明度修饰符

// 只处理不带透明度的；统一用 originalClass 作 from，支持全色板
for (const [varName, { originalClass }] of sortedUsages) {
  const cssVar = `--app-c-${varName}`;
  // 从 tw-text-gray-400 / tw-active-bg-slate-200 等提取前缀（任意 -<palette>-<shade>）
  const prefix = varName.slice(3).replace(/-[a-z]+-\d+$/, '');
  const classPrefix = prefix.replace(/-/g, ':'); // active-bg -> active:bg
  replacements.push({ from: originalClass, to: `${classPrefix}-(${cssVar})` });
}

console.log('📋 替换规则:');
console.log('─'.repeat(40));
for (const r of replacements) {
  console.log(`  ${r.from.padEnd(20)} → ${r.to}`);
}
console.log('');

if (dryRun) {
  console.log('━'.repeat(60));
  console.log('💡 预览模式');
  console.log('   添加 --execute 执行迁移');
  console.log('');
  console.log('✅ 优势:');
  console.log('   - 视觉零差异（使用 Tailwind 原始 hex 值）');
  console.log('   - 变量数量少（按类名合并，不按页面拆分）');
  console.log('   - 后续审核时改为语义命名即可');
  console.log('━'.repeat(60));
} else {
  // 执行：更新 colors.ts
  if (existsSync(COLORS_FILE)) {
    let colorsContent = readFileSync(COLORS_FILE, 'utf-8');
    
    // 检查是否已有 tw- 开头的颜色
    if (colorsContent.includes('tw-')) {
      console.log('⚠️  colors.ts 已包含 tw- 颜色，跳过添加');
    } else {
      // 插入到主 colors 对象中（在 colorsDark 之前）
      const colorsDarkMatch = colorsContent.indexOf('export const colorsDark');
      if (colorsDarkMatch > 0) {
        const beforeColorsDark = colorsContent.slice(0, colorsDarkMatch);
        const insertPoint = beforeColorsDark.lastIndexOf('} as const');
        if (insertPoint > 0) {
          colorsContent = colorsContent.slice(0, insertPoint) + newColorDefs.join('\n') + '\n' + colorsContent.slice(insertPoint);
          writeFileSync(COLORS_FILE, colorsContent);
          console.log(`✅ 已更新 ${relative(process.cwd(), COLORS_FILE)}`);
        }
      }
    }
  }
  
  // 执行：更新各文件
  let changedFiles = 0;
  let totalChanges = 0;
  
  for (const filePath of files) {
    let content = readFileSync(filePath, 'utf-8');
    const original = content;
    
    for (const { from, to } of replacements) {
      const regex = new RegExp(`\\b${escapeRegex(from)}\\b`, 'g');
      content = content.replace(regex, to);
    }
    
    if (content !== original) {
      writeFileSync(filePath, content);
      changedFiles++;
      // 计算变更数
      for (const { from } of replacements) {
        const regex = new RegExp(`\\b${escapeRegex(from)}\\b`, 'g');
        const matches = original.match(regex);
        if (matches) totalChanges += matches.length;
      }
    }
  }
  
  console.log(`✅ 已更新 ${changedFiles} 个文件, ${totalChanges} 处替换`);
  
  console.log('');
  console.log('━'.repeat(60));
  console.log('✅ 迁移完成！视觉零差异');
  console.log('');
  console.log('下一步:');
  console.log('  1. 运行 npm run dev 验证页面正常');
  console.log('  2. 审核 colors.ts 中的 tw- 颜色');
  console.log('  3. 改为语义命名（如 tw-text-gray-400 → hint-text）');
  console.log('━'.repeat(60));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
