#!/usr/bin/env node
/**
 * 通用图标尺寸迁移脚本
 * 
 * 用法:
 *   node scripts/migrate_icon_sizes.mjs --app=Alipay           # 预览模式
 *   node scripts/migrate_icon_sizes.mjs --app=Alipay --execute # 执行迁移
 *   node scripts/migrate_icon_sizes.mjs --app=Alipay --verbose # 详细输出
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APPS_DIR = resolve(__dirname, '..', 'apps');

// 解析命令行参数
const args = process.argv.slice(2);
const appArg = args.find(a => a.startsWith('--app='));
const targetApp = appArg?.split('=')[1];
const dryRun = !args.includes('--execute');
const verbose = args.includes('--verbose');

if (!targetApp) {
  console.error('错误: 必须指定 --app=<AppName>');
  console.error('用法: node scripts/migrate_icon_sizes.mjs --app=Alipay [--execute] [--verbose]');
  process.exit(1);
}

const APP_DIR = join(APPS_DIR, targetApp);
if (!existsSync(APP_DIR)) {
  console.error(`错误: 找不到 App 目录: ${APP_DIR}`);
  process.exit(1);
}

console.log(`目标 App: ${targetApp}`);
console.log(`模式: ${dryRun ? '预览 (添加 --execute 执行)' : '执行'}`);
console.log('');

// ============================================================
// 通用映射规则（按语义优先级排序）
// 规则格式: { pattern: /图标名正则/, size: 数值, dimens: 'icSizeXxx', desc: '描述' }
// 规则按顺序匹配，先匹配的优先
// ============================================================

const COMMON_RULES = [
  // === 导航/Header（高优先级，图标名明确） ===
  { pattern: /IcNavBack/, size: 24, dimens: 'icSizeNav', desc: 'Header 返回' },
  { pattern: /IcNavBack/, size: 28, dimens: 'icSizeNav', desc: 'Header 返回(大)' },
  { pattern: /IcNavBack/, size: 26, dimens: 'icSizeNav', desc: 'Header 返回(大)' },
  { pattern: /IcNavBack/, size: 22, dimens: 'icSizeNavCompact', desc: 'Header 返回(紧凑)' },
  { pattern: /IcNavBack/, size: 20, dimens: 'icSizeNav', desc: 'Header 返回(小)' },
  { pattern: /IcClose/, size: 24, dimens: 'icSizeNav', desc: 'Header 关闭' },
  { pattern: /IcClose/, size: 26, dimens: 'icSizeNav', desc: 'Header 关闭(大)' },
  { pattern: /IcClose/, size: 28, dimens: 'icSizeNav', desc: 'Modal 关闭' },
  { pattern: /IcClose/, size: 20, dimens: 'icSizeCardArrow', desc: 'Modal 关闭(小)' },
  { pattern: /IcMore|IcMoreHorizontal|IcMoreVertical/, size: 24, dimens: 'icSizeNav', desc: 'Header 更多' },
  { pattern: /IcMore|IcMoreHorizontal/, size: 22, dimens: 'icSizeNavCompact', desc: 'Header 更多(紧凑)' },
  { pattern: /IcMore|IcMoreHorizontal/, size: 20, dimens: 'icSizeToolbar', desc: 'Toolbar 更多' },
  
  // === 列表箭头（高优先级） ===
  { pattern: /IcNavForward|IcChevronRight|IcChevron/, size: 16, dimens: 'icSizeChevron', desc: '列表箭头(小)' },
  { pattern: /IcNavForward|IcChevronRight|IcChevron/, size: 18, dimens: 'icSizeChevronLg', desc: '列表箭头(大)' },
  { pattern: /IcNavForward|IcChevronRight|IcChevron/, size: 20, dimens: 'icSizeChevron', desc: '列表箭头(大)' },
  { pattern: /IcExpand|IcCollapse/, size: 16, dimens: 'icSizeChevron', desc: '展开箭头' },
  { pattern: /IcExpand|IcCollapse/, size: 18, dimens: 'icSizeChevronLg', desc: '展开箭头' },
  { pattern: /IcExpand|IcCollapse/, size: 20, dimens: 'icSizeCardArrow', desc: '卡片箭头' },
  
  // === 选中勾 ===
  { pattern: /IcCheck/, size: 20, dimens: 'icSizeCheck', desc: '选中勾' },
  { pattern: /IcCheck/, size: 18, dimens: 'icSizeAction', desc: '选中勾(小)' },
  { pattern: /IcCheck/, size: 16, dimens: 'icSizeChevron', desc: '选中勾(小)' },
  
  // === TabBar 图标（高优先级，Tab 前缀或特定名） ===
  { pattern: /IcTab\w+/, size: 24, dimens: 'icSizeTab', desc: 'TabBar 图标' },
  { pattern: /IcTab\w+/, size: 22, dimens: 'icSizeTab', desc: 'TabBar 图标' },
  { pattern: /IcHome|IcUser|IcMessage|IcDiscover|IcMe|IcLibrary/, size: 24, dimens: 'icSizeTab', desc: 'TabBar 图标' },
  { pattern: /IcHome|IcUser|IcMessage|IcDiscover|IcMe|IcLibrary/, size: 22, dimens: 'icSizeTab', desc: 'TabBar 图标' },
  
  // === 搜索 ===
  { pattern: /IcSearch/, size: 16, dimens: 'icSizeChevron', desc: '搜索图标(小)' },
  { pattern: /IcSearch/, size: 18, dimens: 'icSizeAction', desc: '搜索图标' },
  { pattern: /IcSearch/, size: 20, dimens: 'icSizeToolbar', desc: '搜索图标(大)' },
  { pattern: /IcSearch/, size: 22, dimens: 'icSizeToolbar', desc: '搜索图标' },
  { pattern: /IcSearch/, size: 24, dimens: 'icSizeNav', desc: '搜索图标(大)' },
  
  // === 工具栏（中优先级） ===
  { pattern: /IcCamera|IcScan|IcMenu|IcEdit|IcFilter|IcSort|IcRefresh|IcAdd|IcPlus/, size: 22, dimens: 'icSizeToolbar', desc: '工具栏图标' },
  { pattern: /IcCamera|IcScan|IcMenu|IcEdit|IcFilter|IcSort|IcRefresh|IcAdd|IcPlus/, size: 24, dimens: 'icSizeNav', desc: '工具栏图标(大)' },
  { pattern: /IcShare|IcSettings|IcGlobe|IcImage/, size: 22, dimens: 'icSizeToolbar', desc: '工具栏图标' },
  { pattern: /IcShare|IcSettings|IcGlobe|IcImage/, size: 24, dimens: 'icSizeNav', desc: '工具栏图标(大)' },
  
  // === 社交操作图标（中优先级） ===
  { pattern: /IcHeart|IcLike|IcComment|IcRepost|IcBookmark|IcStar/, size: 18, dimens: 'icSizeAction', desc: '操作图标' },
  { pattern: /IcHeart|IcLike|IcComment|IcRepost|IcBookmark|IcStar/, size: 20, dimens: 'icSizeAction', desc: '操作图标' },
  
  // === 服务网格（低优先级通配） ===
  { pattern: /.*/, size: 28, dimens: 'icSizeService', desc: '服务图标' },
  { pattern: /.*/, size: 32, dimens: 'icSizeService', desc: '服务图标(大)' },
  { pattern: /.*/, size: 26, dimens: 'icSizeService', desc: '服务图标(中)' },
  
  // === 内联操作（最低优先级通配） ===
  { pattern: /.*/, size: 18, dimens: 'icSizeAction', desc: '内联操作图标' },
  { pattern: /.*/, size: 14, dimens: 'icSizeInlineArrow', desc: '内联小图标' },
  { pattern: /.*/, size: 12, dimens: 'icSizeTinyArrow', desc: '极小图标' },
  { pattern: /.*/, size: 10, dimens: 'icSizeBadgeArrow', desc: '徽章图标' },
];

// 不迁移的尺寸（特殊/非标准）
const SKIP_SIZES = [192, 224, 40, 48, 64, 80, 96, 100, 120, 160];

// ============================================================
// 读取 App 的 dimens.ts，获取已有常量及其值
// ============================================================

function getExistingDimens(appDir) {
  const dimensPath = join(appDir, 'res', 'dimens.ts');
  if (!existsSync(dimensPath)) {
    console.warn(`警告: 找不到 ${dimensPath}`);
    return { names: new Set(), values: {} };
  }
  
  const content = readFileSync(dimensPath, 'utf-8');
  const names = new Set(content.match(/icSize\w+/g) || []);
  
  // 解析常量值: icSizeXxx: 24, 或 icSizeXxx: 24
  const values = {};
  const valueRegex = /(icSize\w+):\s*(\d+)/g;
  let match;
  while ((match = valueRegex.exec(content)) !== null) {
    values[match[1]] = parseInt(match[2], 10);
  }
  
  return { names, values };
}

// ============================================================
// 根据 App 实际定义值，构建动态规则
// ============================================================

function buildDynamicRules(dimensValues) {
  const rules = [];
  
  // 导航图标：匹配所有 icSizeNav* 变体的实际值
  for (const [name, value] of Object.entries(dimensValues)) {
    if (name.startsWith('icSizeNav')) {
      rules.push({ pattern: /IcNavBack/, size: value, dimens: name, desc: `返回(${name})` });
      rules.push({ pattern: /IcClose/, size: value, dimens: name, desc: `关闭(${name})` });
      rules.push({ pattern: /IcMore|IcMoreHorizontal|IcMoreVertical/, size: value, dimens: name, desc: `更多(${name})` });
      rules.push({ pattern: /IcSearch/, size: value, dimens: name, desc: `搜索(${name})` });
      rules.push({ pattern: /IcAdd|IcPlus/, size: value, dimens: name, desc: `添加(${name})` });
      rules.push({ pattern: /IcShare/, size: value, dimens: name, desc: `分享(${name})` });
    }
  }
  
  // Tab 图标
  if (dimensValues.icSizeTab) {
    const v = dimensValues.icSizeTab;
    rules.push({ pattern: /IcTab\w+/, size: v, dimens: 'icSizeTab', desc: 'TabBar 图标' });
    rules.push({ pattern: /IcHome|IcUser|IcMessage|IcDiscover|IcMe|IcLibrary|IcSearch|IcNotification/, size: v, dimens: 'icSizeTab', desc: 'TabBar 图标' });
  }
  
  // Chevron 图标：所有 Chevron 变体
  for (const [name, value] of Object.entries(dimensValues)) {
    if (name.includes('Chevron') || name.includes('Arrow')) {
      rules.push({ pattern: /IcNavForward|IcChevronRight|IcChevron|IcExpand|IcCollapse/, size: value, dimens: name, desc: `箭头(${name})` });
    }
  }
  
  // 列表尾部图标（通常与 Chevron 同尺寸）
  if (dimensValues.icSizeChevron) {
    const v = dimensValues.icSizeChevron;
    // 这些图标常出现在列表项尾部，尺寸与 chevron 一致
    rules.push({ pattern: /IcEdit|IcInfo|IcWifi|IcBluetooth|IcStorage|IcFile|IcImage|IcFilm|IcMusic|IcFileText|IcRefresh/, size: v, dimens: 'icSizeChevron', desc: '列表尾部图标' });
  }
  
  // 如果有专门的 icSizeListIcon 常量则优先使用
  if (dimensValues.icSizeListIcon) {
    const v = dimensValues.icSizeListIcon;
    rules.push({ pattern: /Ic\w+/, size: v, dimens: 'icSizeListIcon', desc: '列表图标' });
  }
  
  // Action 图标
  if (dimensValues.icSizeAction) {
    const v = dimensValues.icSizeAction;
    rules.push({ pattern: /IcSearch|IcHeart|IcShare|IcComment|IcRepost|IcBookmark|IcLike|IcStar/, size: v, dimens: 'icSizeAction', desc: '操作图标' });
    rules.push({ pattern: /IcPlay|IcPause|IcShuffle|IcRepeat|IcSkip/, size: v, dimens: 'icSizeAction', desc: '播放操作' });
  }
  
  // Toolbar 图标
  if (dimensValues.icSizeToolbar) {
    const v = dimensValues.icSizeToolbar;
    rules.push({ pattern: /IcCamera|IcScan|IcMenu|IcEdit|IcShare|IcSettings|IcFilter|IcSort|IcRefresh/, size: v, dimens: 'icSizeToolbar', desc: '工具栏图标' });
    rules.push({ pattern: /IcAdd|IcPlus|IcImage|IcGlobe|IcMic|IcSmile|IcDelete|IcTrash/, size: v, dimens: 'icSizeToolbar', desc: '工具栏图标' });
    // 22px 常用工具图标
    rules.push({ pattern: /IcMessage|IcMail|IcFile|IcInfo|IcCog|IcSliders/, size: v, dimens: 'icSizeToolbar', desc: '工具栏图标' });
  }
  
  // Service 图标（通配，放最后）
  if (dimensValues.icSizeService) {
    const v = dimensValues.icSizeService;
    rules.push({ pattern: /.*/, size: v, dimens: 'icSizeService', desc: '服务图标' });
  }
  
  // Check 图标
  if (dimensValues.icSizeCheck) {
    const v = dimensValues.icSizeCheck;
    rules.push({ pattern: /IcCheck/, size: v, dimens: 'icSizeCheck', desc: '选中勾' });
  }
  
  // CardArrow 图标
  if (dimensValues.icSizeCardArrow) {
    const v = dimensValues.icSizeCardArrow;
    rules.push({ pattern: /IcNavForward|IcChevronRight|IcExpand|IcClose/, size: v, dimens: 'icSizeCardArrow', desc: '卡片箭头' });
  }
  
  // TinyArrow/Breadcrumb/Badge 图标
  for (const [name, value] of Object.entries(dimensValues)) {
    if (name.includes('Tiny') || name.includes('Breadcrumb') || name.includes('Badge')) {
      rules.push({ pattern: /IcNavForward|IcChevronRight/, size: value, dimens: name, desc: `小箭头(${name})` });
    }
  }
  
  // 档位命名常量（icSizeXs/Sm/Md/Lg/Xl/Xxl/Menu/Meta/Fab）作为通用回退
  const sizeGrades = ['icSizeXxs', 'icSizeXs', 'icSizeSm', 'icSizeMd', 'icSizeLg', 'icSizeXl', 'icSizeXxl', 'icSizeMenu', 'icSizeMeta', 'icSizeFab'];
  for (const gradeName of sizeGrades) {
    if (dimensValues[gradeName]) {
      const v = dimensValues[gradeName];
      rules.push({ pattern: /Ic\w+/, size: v, dimens: gradeName, desc: `${gradeName}(${v}px)` });
    }
  }
  
  return rules;
}

// ============================================================
// 查找匹配的 dimens 常量（混合静态 + 动态规则）
// ============================================================

function findDimensConstant(iconName, sizeValue, existingDimens, dynamicRules) {
  // 跳过特殊尺寸
  if (SKIP_SIZES.includes(sizeValue)) {
    return { dimens: null, reason: 'skip_special_size' };
  }
  
  // 优先使用动态规则（基于 App 实际定义）
  for (const rule of dynamicRules) {
    if (rule.pattern.test(iconName) && rule.size === sizeValue) {
      return { dimens: rule.dimens, desc: rule.desc };
    }
  }
  
  // 回退到通用规则
  for (const rule of COMMON_RULES) {
    if (rule.pattern.test(iconName) && rule.size === sizeValue) {
      // 检查 App 是否已有该常量
      if (existingDimens.has(rule.dimens)) {
        return { dimens: rule.dimens, desc: rule.desc };
      } else {
        return { dimens: null, reason: `missing_dimens:${rule.dimens}`, desc: rule.desc };
      }
    }
  }
  
  return { dimens: null, reason: 'no_matching_rule' };
}

// ============================================================
// 遍历目录
// ============================================================

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const path = join(dir, file);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      // 跳过 node_modules、res 目录
      if (file !== 'node_modules' && file !== 'res') {
        walkDir(path, callback);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(path);
    }
  }
}

// ============================================================
// 主逻辑
// ============================================================

const { names: existingDimens, values: dimensValues } = getExistingDimens(APP_DIR);
const dynamicRules = buildDynamicRules(dimensValues);

console.log(`已有 icSize 常量: ${[...existingDimens].join(', ')}`);
console.log(`动态规则数: ${dynamicRules.length}`);
console.log('');

const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  missingDimens: {},
  noRule: 0,
};

const filesToModify = [];

walkDir(APP_DIR, (filePath) => {
  const content = readFileSync(filePath, 'utf-8');
  const relPath = relative(APPS_DIR, filePath);
  
  // 匹配: <IcXxx size={数字} 或 size={数字} 前面有 <IcXxx
  const regex = /<(Ic\w+)[^>]*\bsize=\{(\d+)\}/g;
  let match;
  const replacements = [];
  
  while ((match = regex.exec(content)) !== null) {
    const iconName = match[1];
    const sizeValue = parseInt(match[2], 10);
    const fullMatch = match[0];
    
    stats.total++;
    
    const result = findDimensConstant(iconName, sizeValue, existingDimens, dynamicRules);
    
    if (result.dimens) {
      stats.migrated++;
      replacements.push({
        original: `size={${sizeValue}}`,
        replacement: `size={dimens.${result.dimens}}`,
        icon: iconName,
        size: sizeValue,
        dimens: result.dimens,
        desc: result.desc,
      });
      
      if (verbose) {
        console.log(`✅ ${relPath}: ${iconName} size={${sizeValue}} → dimens.${result.dimens} (${result.desc})`);
      }
    } else {
      stats.skipped++;
      
      if (result.reason === 'skip_special_size') {
        if (verbose) {
          console.log(`⏭️  ${relPath}: ${iconName} size={${sizeValue}} — 特殊尺寸，跳过`);
        }
      } else if (result.reason?.startsWith('missing_dimens:')) {
        const missingDimens = result.reason.split(':')[1];
        stats.missingDimens[missingDimens] = (stats.missingDimens[missingDimens] || 0) + 1;
        if (verbose) {
          console.log(`⚠️  ${relPath}: ${iconName} size={${sizeValue}} — 缺少 ${missingDimens} (${result.desc})`);
        }
      } else {
        stats.noRule++;
        if (verbose) {
          console.log(`❓ ${relPath}: ${iconName} size={${sizeValue}} — 无匹配规则`);
        }
      }
    }
  }
  
  if (replacements.length > 0) {
    filesToModify.push({ path: filePath, relPath, replacements, content });
  }
});

// ============================================================
// 输出统计
// ============================================================

console.log('');
console.log('========== 统计 ==========');
console.log(`总数: ${stats.total}`);
console.log(`可迁移: ${stats.migrated} (${(stats.migrated / stats.total * 100).toFixed(1)}%)`);
console.log(`跳过: ${stats.skipped}`);

if (Object.keys(stats.missingDimens).length > 0) {
  console.log('');
  console.log('缺少的 dimens 常量（如需迁移更多，可在 dimens.ts 中添加）:');
  for (const [dimens, count] of Object.entries(stats.missingDimens)) {
    console.log(`  ${dimens}: ${count} 处`);
  }
}

if (stats.noRule > 0) {
  console.log(`无匹配规则: ${stats.noRule} 处`);
}

// ============================================================
// 执行替换
// ============================================================

if (!dryRun && stats.migrated > 0) {
  console.log('');
  console.log('========== 执行迁移 ==========');
  
  for (const file of filesToModify) {
    let newContent = file.content;
    let needsDimensImport = false;
    
    // 执行替换
    for (const r of file.replacements) {
      // 精确替换：找到 <IcXxx ... size={N} 的位置
      const iconRegex = new RegExp(`(<${r.icon}[^>]*\\b)size=\\{${r.size}\\}`, 'g');
      newContent = newContent.replace(iconRegex, `$1size={dimens.${r.dimens}}`);
      needsDimensImport = true;
    }
    
    // 添加 import { dimens }（如果需要且不存在）
    if (needsDimensImport && !newContent.includes("import { dimens }") && !newContent.includes("dimens }")) {
      // 查找合适的位置插入 import
      const importRegex = /^(import .+ from ['"][^'"]+['"];?\s*\n)/m;
      const match = newContent.match(importRegex);
      if (match) {
        const dimensImport = `import { dimens } from '../res/dimens';\n`;
        // 在第一个 import 后添加
        const firstImportEnd = newContent.indexOf(match[0]) + match[0].length;
        newContent = newContent.slice(0, firstImportEnd) + dimensImport + newContent.slice(firstImportEnd);
      }
    }
    
    writeFileSync(file.path, newContent, 'utf-8');
    console.log(`✅ ${file.relPath}: ${file.replacements.length} 处`);
  }
  
  console.log('');
  console.log(`迁移完成! 共修改 ${filesToModify.length} 个文件`);
  console.log('');
  console.log('后续步骤:');
  console.log('1. 运行 npx tsc --noEmit 检查 TypeScript 错误');
  console.log('2. 运行 node scripts/fix_duplicate_dimens_import.mjs --app=' + targetApp + ' 修复重复 import');
  console.log('3. 启动 dev server 验证视觉效果');
} else if (dryRun && stats.migrated > 0) {
  console.log('');
  console.log(`预览完成。添加 --execute 参数执行迁移。`);
}
