#!/usr/bin/env node
/**
 * 迁移 Tailwind 任意值布局尺寸（如 h-[56px]、w-[320px]、text-[18px]）
 * 
 * 启发式命名策略：
 *   1. 上下文关键词识别（modal、item、avatar、title 等）
 *   2. 相同数值合并（同一 App 内）
 *   3. 文件路径作为 fallback
 * 
 * 用法：
 *   node scripts/migrate_dimens_arbitrary.mjs --app=Wechat           # 预览
 *   node scripts/migrate_dimens_arbitrary.mjs --app=Wechat --execute # 执行
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, relative, basename, dirname } from 'path';

// ============================================================================
// 配置
// ============================================================================

// 匹配模式
const DIMEN_PATTERNS = [
  { regex: /\bh-\[(\d+)px\]/g, type: 'height', cssPrefix: 'h' },
  { regex: /\bw-\[(\d+)px\]/g, type: 'width', cssPrefix: 'w' },
  { regex: /\btext-\[(\d+)px\]/g, type: 'text_size', cssPrefix: 'text' },
  { regex: /\bmin-h-\[(\d+)px\]/g, type: 'min_height', cssPrefix: 'min-h' },
  { regex: /\bmax-h-\[(\d+)px\]/g, type: 'max_height', cssPrefix: 'max-h' },
  { regex: /\bmin-w-\[(\d+)px\]/g, type: 'min_width', cssPrefix: 'min-w' },
  { regex: /\bmax-w-\[(\d+)px\]/g, type: 'max_width', cssPrefix: 'max-w' },
  { regex: /\bgap-\[(\d+)px\]/g, type: 'gap', cssPrefix: 'gap' },
  { regex: /\bp-\[(\d+)px\]/g, type: 'padding', cssPrefix: 'p' },
  { regex: /\bpx-\[(\d+)px\]/g, type: 'padding_x', cssPrefix: 'px' },
  { regex: /\bpy-\[(\d+)px\]/g, type: 'padding_y', cssPrefix: 'py' },
  { regex: /\bm-\[(\d+)px\]/g, type: 'margin', cssPrefix: 'm' },
  { regex: /\bmx-\[(\d+)px\]/g, type: 'margin_x', cssPrefix: 'mx' },
  { regex: /\bmy-\[(\d+)px\]/g, type: 'margin_y', cssPrefix: 'my' },
];

// 上下文关键词 → 语义元素名
const CONTEXT_KEYWORDS = {
  // 弹窗/模态框
  modal: ['modal', 'dialog', 'popup', 'sheet', 'drawer', 'overlay'],
  // 列表项
  item: ['item', 'list', 'row', 'cell', 'flex items-center.*border'],
  // 头像
  avatar: ['avatar', 'profile', 'rounded-full.*w-\\[.*h-\\['],
  // 标题
  title: ['font-bold', 'font-semibold', 'font-medium'],
  // 分割线
  divider: ['h-\\[1px\\]', 'h-\\[2px\\]', 'border-b', 'border-t'],
  // 卡片
  card: ['card', 'rounded-\\[.*shadow', 'bg-app-surface.*rounded'],
  // 按钮
  button: ['button', 'btn', 'cursor-pointer.*rounded'],
  // 输入框
  input: ['input', 'textarea', 'placeholder'],
  // 图标
  icon: ['icon', 'svg', 'lucide'],
  // 标签
  badge: ['badge', 'tag', 'label', 'rounded-full.*text-\\['],
};

// 数值范围 → 大小后缀
const SIZE_SUFFIXES = {
  height: { 1: 'divider', 2: 'divider', 36: 'sm', 44: 'sm', 48: 'md', 56: 'md', 64: 'lg', 72: 'lg', 80: 'xl' },
  width: { 160: 'sm', 240: 'md', 280: 'md', 320: 'lg', 360: 'xl' },
  text_size: { 10: 'xs', 11: 'xs', 12: 'sm', 14: 'base', 16: 'base', 17: 'base', 18: 'lg', 20: 'lg', 22: 'xl', 24: 'xl', 28: '2xl' },
};

// ============================================================================
// 工具函数
// ============================================================================

function toSnakeCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

function toCamelCase(str) {
  return str
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/^([A-Z])/, (_, c) => c.toLowerCase());
}

function getContextFromPath(filePath) {
  const parts = filePath.split('/');
  const fileName = basename(filePath, '.tsx');
  
  if (parts.includes('pages')) {
    const pagesIdx = parts.indexOf('pages');
    if (parts.length > pagesIdx + 2) {
      return toSnakeCase(parts[pagesIdx + 1]) + '_' + toSnakeCase(fileName);
    }
    return toSnakeCase(fileName);
  }
  if (parts.includes('components')) {
    return 'comp_' + toSnakeCase(fileName);
  }
  return toSnakeCase(fileName);
}

// 从 className 上下文推断语义元素
function inferElementFromContext(className, type, value) {
  // 1. 检查上下文关键词
  for (const [element, keywords] of Object.entries(CONTEXT_KEYWORDS)) {
    for (const kw of keywords) {
      const regex = new RegExp(kw, 'i');
      if (regex.test(className)) {
        return element;
      }
    }
  }
  
  // 2. 基于数值范围推断
  if (type === 'height' && value <= 2) return 'divider';
  if (type === 'height' && value >= 56 && value <= 80) return 'item';
  if (type === 'width' && value >= 280 && value <= 360) return 'modal';
  if (type === 'text_size' && value >= 18) return 'title';
  if (type === 'text_size' && value <= 12) return 'hint';
  
  return null;
}

// 获取大小后缀
function getSizeSuffix(type, value) {
  const suffixes = SIZE_SUFFIXES[type];
  if (!suffixes) return value;
  
  // 精确匹配
  if (suffixes[value]) return suffixes[value];
  
  // 范围匹配
  const sortedValues = Object.keys(suffixes).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < sortedValues.length; i++) {
    if (value <= sortedValues[i]) {
      return suffixes[sortedValues[i]];
    }
  }
  return value;
}

// 生成变量名（始终包含数值以确保唯一性）
function generateVarName(element, type, value, fileContext) {
  if (element) {
    // 有语义元素名：element_type_value
    return `${element}_${type}_${value}`;
  }
  
  // fallback: 使用文件上下文
  return `${fileContext}_${type}_${value}`;
}

// 收集所有文件
function getAllFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
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

// ============================================================================
// 主逻辑
// ============================================================================

const args = process.argv.slice(2);
const appArg = args.find(a => a.startsWith('--app='));
const targetApp = appArg?.split('=')[1];
const dryRun = !args.includes('--execute');

if (!targetApp) {
  console.error('用法: node scripts/migrate_dimens_arbitrary.mjs --app=Wechat');
  process.exit(1);
}

const APP_DIR = join(process.cwd(), 'apps', targetApp);
const DIMENS_FILE = join(APP_DIR, 'res/dimens.ts');

if (!existsSync(APP_DIR)) {
  console.error(`错误: App 目录不存在 - ${APP_DIR}`);
  process.exit(1);
}

console.log('━'.repeat(60));
console.log('任意值布局尺寸迁移');
console.log('━'.repeat(60));
console.log(`目标 App: ${targetApp}`);
console.log(`模式: ${dryRun ? '🔍 预览' : '⚡ 执行'}`);
console.log('━'.repeat(60));
console.log('');

// 扫描所有文件
const files = getAllFiles(APP_DIR);
const usages = new Map(); // key: `${type}_${value}` → { value, type, element, varName, cssPrefix, occurrences: [] }

for (const filePath of files) {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(APP_DIR, filePath);
  const fileContext = getContextFromPath(relativePath);
  
  // 按行扫描以获取上下文
  const lines = content.split('\n');
  
  for (const { regex, type, cssPrefix } of DIMEN_PATTERNS) {
    const clonedRegex = new RegExp(regex.source, 'g');
    let match;
    while ((match = clonedRegex.exec(content)) !== null) {
      const value = parseInt(match[1], 10);
      const originalClass = match[0];
      
      // 找到所在行以获取上下文
      const beforeMatch = content.slice(0, match.index);
      const lineNum = (beforeMatch.match(/\n/g) || []).length;
      const lineContent = lines[lineNum] || '';
      
      // 推断语义元素
      const element = inferElementFromContext(lineContent, type, value);
      
      // 生成 key（用于合并相同数值）
      const key = `${type}_${value}`;
      
      if (!usages.has(key)) {
        const varName = generateVarName(element, type, value, fileContext);
        usages.set(key, {
          value,
          type,
          element,
          varName,
          cssPrefix,
          originalClass,
          occurrences: [],
        });
      }
      
      const usage = usages.get(key);
      usage.occurrences.push({
        filePath,
        relativePath,
        lineNum: lineNum + 1,
        lineContent: lineContent.trim().slice(0, 80),
        originalClass,
      });
    }
  }
}

// 合并相同数值的用法，选择最佳变量名
for (const [key, usage] of usages) {
  // 如果多处使用，尝试找到最有语义的名称
  const elements = usage.occurrences.map(o => {
    const content = readFileSync(o.filePath, 'utf-8');
    const lines = content.split('\n');
    return inferElementFromContext(lines[o.lineNum - 1] || '', usage.type, usage.value);
  }).filter(Boolean);
  
  if (elements.length > 0) {
    // 统计最常见的元素
    const elementCounts = {};
    for (const e of elements) {
      elementCounts[e] = (elementCounts[e] || 0) + 1;
    }
    const bestElement = Object.entries(elementCounts).sort((a, b) => b[1] - a[1])[0][0];
    usage.element = bestElement;
    usage.varName = generateVarName(bestElement, usage.type, usage.value, '');
  }
}

// 显示结果
if (usages.size === 0) {
  console.log('✅ 没有找到任意值布局尺寸硬编码');
  process.exit(0);
}

// 按类型分组显示
const byType = {};
for (const [key, usage] of usages) {
  if (!byType[usage.type]) byType[usage.type] = [];
  byType[usage.type].push(usage);
}

let totalOccurrences = 0;
for (const [type, typeUsages] of Object.entries(byType)) {
  console.log(`📋 ${type.toUpperCase()} (${typeUsages.length} 个变量)`);
  console.log('─'.repeat(60));
  
  for (const usage of typeUsages.sort((a, b) => b.occurrences.length - a.occurrences.length)) {
    const count = usage.occurrences.length;
    totalOccurrences += count;
    console.log(`  ${usage.varName}`);
    console.log(`    值: ${usage.value}px | 使用: ${count} 处 | 元素: ${usage.element || '(未识别)'}`);
    console.log(`    原始: ${usage.originalClass} → ${usage.cssPrefix}-(--app-${usage.varName.replace(/_/g, '-')})`);
    if (count <= 3) {
      for (const o of usage.occurrences) {
        console.log(`      📄 ${o.relativePath}:${o.lineNum}`);
      }
    } else {
      console.log(`      📄 ${usage.occurrences[0].relativePath}:${usage.occurrences[0].lineNum} 等 ${count} 处`);
    }
    console.log('');
  }
}

console.log('━'.repeat(60));
console.log(`总计: ${usages.size} 个变量, ${totalOccurrences} 处使用`);
console.log('━'.repeat(60));
console.log('');

// 生成 dimens.ts 追加内容
const newDimens = [];
newDimens.push('');
newDimens.push('  // ===== 任意值迁移（启发式命名）=====');
newDimens.push('  // 审核后请改为语义命名');

for (const [type, typeUsages] of Object.entries(byType)) {
  newDimens.push(`  // --- ${type} ---`);
  for (const usage of typeUsages.sort((a, b) => a.value - b.value)) {
    const camelName = toCamelCase(usage.varName);
    newDimens.push(`  ${camelName}: ${usage.value},`);
  }
}

console.log('📋 将添加到 dimens.ts:');
console.log('─'.repeat(40));
for (const line of newDimens) {
  console.log(line);
}
console.log('');

if (dryRun) {
  console.log('━'.repeat(60));
  console.log('💡 预览模式 - 添加 --execute 执行迁移');
  console.log('━'.repeat(60));
} else {
  // 更新 dimens.ts
  if (existsSync(DIMENS_FILE)) {
    let dimensContent = readFileSync(DIMENS_FILE, 'utf-8');
    
    // 在 } as const 之前插入
    const insertPoint = dimensContent.lastIndexOf('} as const');
    if (insertPoint > 0) {
      dimensContent = dimensContent.slice(0, insertPoint) + newDimens.join('\n') + '\n' + dimensContent.slice(insertPoint);
      writeFileSync(DIMENS_FILE, dimensContent);
      console.log(`✅ 已更新 ${relative(process.cwd(), DIMENS_FILE)}`);
    }
  } else {
    console.log(`⚠️  dimens.ts 不存在，跳过`);
  }
  
  // 更新各文件
  let changedFiles = 0;
  for (const [key, usage] of usages) {
    const cssVar = `--app-${usage.varName.replace(/_/g, '-')}`;
    const newClass = `${usage.cssPrefix}-(${cssVar})`;
    
    for (const o of usage.occurrences) {
      let content = readFileSync(o.filePath, 'utf-8');
      const original = content;
      
      // 替换
      content = content.replace(new RegExp(escapeRegex(usage.originalClass), 'g'), newClass);
      
      if (content !== original) {
        writeFileSync(o.filePath, content);
        changedFiles++;
      }
    }
  }
  
  console.log(`✅ 已更新 ${changedFiles} 处文件引用`);
  console.log('');
  console.log('━'.repeat(60));
  console.log('✅ 迁移完成！');
  console.log('━'.repeat(60));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
