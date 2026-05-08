#!/usr/bin/env node
/**
 * 迁移已定义的布局 dimens
 * 把代码中的硬编码尺寸替换为 CSS 变量形式
 * 
 * 例如：dimens.ts 定义 header_height: 48
 *       代码中 h-12 或 h-[48px] → h-(--app-header-height)
 * 
 * 用法：
 *   node scripts/migrate_layout_dimens.mjs --app=Alipay           # 预览
 *   node scripts/migrate_layout_dimens.mjs --app=Alipay --execute # 执行
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'fs';
import { join, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ============================================================================
// 参数解析
// ============================================================================
const args = process.argv.slice(2);
const appArg = args.find(a => a.startsWith('--app='));
const appName = appArg ? appArg.split('=')[1] : null;
const dryRun = !args.includes('--execute');
const verbose = args.includes('--verbose');

if (!appName) {
  console.log('用法: node scripts/migrate_layout_dimens.mjs --app=<AppName> [--execute] [--verbose]');
  process.exit(1);
}

console.log(`目标 App: ${appName}`);
console.log(`模式: ${dryRun ? '预览 (添加 --execute 执行)' : '执行'}`);
console.log('');

// ============================================================================
// 读取 dimens.ts
// ============================================================================
const dimensPath = join(ROOT, 'apps', appName, 'res', 'dimens.ts');
if (!existsSync(dimensPath)) {
  console.error(`错误: 找不到 ${dimensPath}`);
  process.exit(1);
}

const dimensContent = readFileSync(dimensPath, 'utf-8');

// 解析 dimens 定义（排除 icSize* 因为那是图标尺寸）
const dimensMap = {}; // { name: value }
const dimensRegex = /(\w+):\s*(\d+),?\s*\/\//g;
let match;
while ((match = dimensRegex.exec(dimensContent)) !== null) {
  const [, name, value] = match;
  // 排除图标尺寸和 stroke width
  if (!name.startsWith('icSize') && !name.startsWith('icStroke')) {
    dimensMap[name] = parseInt(value, 10);
  }
}

console.log(`已定义的布局 dimens (${Object.keys(dimensMap).length} 个):`);
Object.entries(dimensMap).forEach(([name, value]) => {
  console.log(`  ${name}: ${value}px`);
});
console.log('');

// ============================================================================
// 构建替换规则
// ============================================================================

// Tailwind rem 类到 px 的映射（基于 1rem = 16px）
// 注意：实际浏览器可能不是 16px，但我们按标准计算
const tailwindToPx = {
  '1': 4, '2': 8, '3': 12, '4': 16, '5': 20, '6': 24,
  '7': 28, '8': 32, '9': 36, '10': 40, '11': 44, '12': 48,
  '14': 56, '16': 64, '20': 80, '24': 96, '28': 112, '32': 128,
  '36': 144, '40': 160, '44': 176, '48': 192, '52': 208, '56': 224,
  '60': 240, '64': 256, '72': 288, '80': 320, '96': 384,
};

// 生成替换规则: { pattern, replacement, dimenName }
const rules = [];

for (const [name, px] of Object.entries(dimensMap)) {
  const cssVar = `--app-${name.replace(/_/g, '-')}`;
  
  // 找到对应的 Tailwind 数字类
  const twNum = Object.entries(tailwindToPx).find(([k, v]) => v === px)?.[0];
  
  // 规则 1: h-[Npx] → h-(--app-xxx)
  rules.push({
    pattern: new RegExp(`\\bh-\\[${px}px\\]`, 'g'),
    replacement: `h-(${cssVar})`,
    dimenName: name,
    desc: `h-[${px}px]`
  });
  
  // 规则 2: w-[Npx] → w-(--app-xxx)
  rules.push({
    pattern: new RegExp(`\\bw-\\[${px}px\\]`, 'g'),
    replacement: `w-(${cssVar})`,
    dimenName: name,
    desc: `w-[${px}px]`
  });
  
  // 规则 3: size-[Npx] → size-(--app-xxx)
  rules.push({
    pattern: new RegExp(`\\bsize-\\[${px}px\\]`, 'g'),
    replacement: `size-(${cssVar})`,
    dimenName: name,
    desc: `size-[${px}px]`
  });
  
  // 规则 4: 如果有对应 Tailwind 数字类，且名称含特定关键词
  if (twNum && shouldMigrateTailwindClass(name, px)) {
    // h-N → h-(--app-xxx)  (仅限特定语义)
    rules.push({
      pattern: new RegExp(`\\bh-${twNum}\\b(?![\\d\\[])`, 'g'),
      replacement: `h-(${cssVar})`,
      dimenName: name,
      desc: `h-${twNum}`,
      semantic: true // 标记为语义迁移，需要更谨慎
    });
    
    // w-N → w-(--app-xxx)
    rules.push({
      pattern: new RegExp(`\\bw-${twNum}\\b(?![\\d\\[])`, 'g'),
      replacement: `w-(${cssVar})`,
      dimenName: name,
      desc: `w-${twNum}`,
      semantic: true
    });
  }
}

// 判断是否应该迁移 Tailwind 标准类（只迁移语义明确的）
function shouldMigrateTailwindClass(name, px) {
  // 只迁移特定场景的尺寸
  const semanticNames = [
    'header_height', 'tabbar_height', 'status_bar_height',
    'balance_avatar_size', 'quick_action_icon_container',
    'zhima_score_circle', 'zhima_action_icon',
    'transfer_action_card_height', 'pay_barcode_height', 'pay_qr_size',
    'forest_card_height', 'forest_tree_blob_size', 'forest_dot_size',
  ];
  return semanticNames.includes(name);
}

console.log(`生成替换规则: ${rules.length} 条`);
console.log('');

// ============================================================================
// 扫描和替换
// ============================================================================
const appDir = join(ROOT, 'apps', appName);
const stats = { total: 0, files: 0, byDimen: {} };

function walkDir(dir, callback) {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir);
  for (const file of files) {
    const path = join(dir, file);
    const stat = statSync(path);
    if (stat.isDirectory() && file !== 'node_modules' && file !== 'res') {
      walkDir(path, callback);
    } else if (file.endsWith('.tsx')) {
      callback(path);
    }
  }
}

walkDir(appDir, (filePath) => {
  let content = readFileSync(filePath, 'utf-8');
  const originalContent = content;
  const relPath = relative(ROOT, filePath);
  const fileMatches = [];
  
  for (const rule of rules) {
    const matches = content.match(rule.pattern) || [];
    if (matches.length > 0) {
      // 对于语义迁移规则，需要检查上下文
      if (rule.semantic) {
        // 跳过语义迁移，太容易误判
        continue;
      }
      
      content = content.replace(rule.pattern, rule.replacement);
      fileMatches.push({ ...rule, count: matches.length });
      stats.total += matches.length;
      stats.byDimen[rule.dimenName] = (stats.byDimen[rule.dimenName] || 0) + matches.length;
    }
  }
  
  if (fileMatches.length > 0) {
    stats.files++;
    console.log(`\n${relPath}:`);
    fileMatches.forEach(m => {
      console.log(`  ${m.desc} → ${m.replacement}: ${m.count} 处`);
    });
    
    if (!dryRun && content !== originalContent) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`  ✅ 已保存`);
    }
  }
});

// ============================================================================
// 统计
// ============================================================================
console.log('\n========== 统计 ==========');
console.log(`替换总数: ${stats.total}`);
console.log(`涉及文件: ${stats.files}`);
console.log('');
console.log('按 dimens 常量统计:');
Object.entries(stats.byDimen)
  .sort((a, b) => b[1] - a[1])
  .forEach(([name, count]) => {
    console.log(`  ${name}: ${count} 处`);
  });

// 分析未使用的 dimens
const unusedDimens = Object.keys(dimensMap).filter(name => !stats.byDimen[name]);
if (unusedDimens.length > 0) {
  console.log('\n未被此次迁移覆盖的 dimens:');
  unusedDimens.forEach(name => {
    console.log(`  ${name}: ${dimensMap[name]}px (可能已用 CSS 变量或不需要)`);
  });
}

if (dryRun && stats.total > 0) {
  console.log('\n预览完成。添加 --execute 执行迁移。');
}

if (stats.total === 0) {
  console.log('\n没有找到可迁移的硬编码尺寸。');
  console.log('可能原因：');
  console.log('  1. 代码中使用的是 Tailwind 标准类（如 h-12），脚本默认不迁移这些');
  console.log('  2. 已经使用了 CSS 变量形式');
  console.log('  3. 使用的尺寸值与 dimens.ts 中定义的不匹配');
}
