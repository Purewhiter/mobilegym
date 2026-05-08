#!/usr/bin/env node
/**
 * 颜色迁移脚本 - 将 Tailwind 标准颜色替换为语义化 App 颜色
 * 
 * 使用方法：
 *   node scripts/migrate_colors_to_semantic.mjs --app=Wechat --dry-run  # 预览
 *   node scripts/migrate_colors_to_semantic.mjs --app=Wechat            # 执行
 * 
 * 规则：
 * 1. 必须指定 --app 参数
 * 2. 默认 dry-run 模式，只显示将要修改的内容
 * 3. 只迁移确定安全的映射，不确定的输出报告供人工审核
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// ==================== 配置 ====================

// 解析命令行参数
const args = process.argv.slice(2);
const appArg = args.find(a => a.startsWith('--app='));
const targetApp = appArg?.split('=')[1];
const dryRun = !args.includes('--execute'); // 默认 dry-run，需要 --execute 才真正执行
const verbose = args.includes('--verbose');

if (!targetApp) {
  console.error('❌ 必须指定目标 App');
  console.error('');
  console.error('用法：');
  console.error('  node scripts/migrate_colors_to_semantic.mjs --app=Wechat --dry-run');
  console.error('  node scripts/migrate_colors_to_semantic.mjs --app=Wechat --execute');
  console.error('');
  console.error('参数：');
  console.error('  --app=<AppName>   目标 App 名称（必需）');
  console.error('  --execute         执行迁移（默认只预览）');
  console.error('  --verbose         显示详细信息');
  process.exit(1);
}

const APP_DIR = join(process.cwd(), 'apps', targetApp);

// 检查目录是否存在
try {
  statSync(APP_DIR);
} catch {
  console.error(`❌ App 目录不存在: ${APP_DIR}`);
  process.exit(1);
}

console.log('━'.repeat(60));
console.log(`颜色迁移脚本`);
console.log('━'.repeat(60));
console.log(`目标 App: ${targetApp}`);
console.log(`模式: ${dryRun ? '🔍 预览 (添加 --execute 执行)' : '⚡ 执行'}`);
console.log('━'.repeat(60));
console.log('');

// ==================== 迁移规则 ====================

/**
 * 安全的迁移规则 - 可直接替换
 * 格式: [pattern, replacement, description]
 */
const SAFE_RULES = [
  // Tier-1: 语义化主色
  [/\btext-gray-900\b/g, 'text-app-text', '主文字 → Tier-1 text'],
  [/\btext-gray-800\b/g, 'text-app-text', '主文字 → Tier-1 text'],
  [/\bbg-white\b(?!\/)/g, 'bg-app-surface', '白色背景 → Tier-1 surface'],
  [/\bborder-gray-200\b/g, 'border-app-border', '边框 → Tier-1 border'],
  
  // Tier-2: 组件级颜色（需要确保 colors.ts 已定义）
  // 这些需要结合上下文判断，暂时不自动迁移
];

/**
 * 需要人工审核的模式 - 生成报告但不自动迁移
 */
const REVIEW_PATTERNS = [
  { pattern: /\btext-gray-700\b/g, reason: '可能是主文字或次要文字' },
  { pattern: /\btext-gray-500\b/g, reason: '可能是组标题、次要文字或提示' },
  { pattern: /\btext-gray-400\b/g, reason: '可能是提示、禁用或占位符' },
  { pattern: /\btext-gray-300\b/g, reason: '可能是禁用状态或装饰' },
  { pattern: /\btext-gray-200\b/g, reason: '极浅文字，可能是状态指示' },
  
  { pattern: /\bbg-gray-50\b/g, reason: '可能是 hover/active 状态或浅背景' },
  { pattern: /\bbg-gray-100\b/g, reason: '可能是 active 状态、tag 背景或分隔区' },
  { pattern: /\bbg-gray-200\b/g, reason: '可能是 Switch 关闭状态或按钮背景' },
  { pattern: /\bbg-gray-400\b/g, reason: '可能是指示器或占位符' },
  
  { pattern: /\bborder-gray-100\b/g, reason: '细分割线 → 考虑 border-app-border/50' },
  { pattern: /\bborder-gray-300\b/g, reason: '边框 → 考虑 border-app-border' },
  
  { pattern: /\bactive:bg-gray-50\b/g, reason: '按下状态 → 考虑定义 bg-app-pressed-light' },
  { pattern: /\bactive:bg-gray-100\b/g, reason: '按下状态 → 考虑定义 bg-app-pressed' },
  { pattern: /\bactive:bg-gray-200\b/g, reason: '按下状态 → 考虑定义 bg-app-pressed-dark' },
];

// ==================== 工具函数 ====================

function getAllFiles(dir, files = []) {
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // 跳过 node_modules 和隐藏目录
      if (!item.startsWith('.') && item !== 'node_modules') {
        getAllFiles(fullPath, files);
      }
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      // 跳过类型定义和资源文件
      if (!item.endsWith('.d.ts') && !item.includes('colors.ts') && !item.includes('manifest.ts')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;
  const relativePath = relative(process.cwd(), filePath);
  
  const safeChanges = [];
  const reviewItems = [];
  
  // 1. 应用安全规则
  for (const [pattern, replacement, desc] of SAFE_RULES) {
    const matches = content.match(pattern);
    if (matches) {
      safeChanges.push({ pattern: pattern.source, replacement, count: matches.length, desc });
      content = content.replace(pattern, replacement);
    }
  }
  
  // 2. 检测需要审核的模式
  for (const { pattern, reason } of REVIEW_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      // 收集所有出现的行号
      const lines = content.split('\n');
      const locations = [];
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          locations.push({ line: idx + 1, content: line.trim().slice(0, 80) });
        }
        // 重置正则状态
        pattern.lastIndex = 0;
      });
      reviewItems.push({ pattern: pattern.source, count: matches.length, reason, locations });
    }
  }
  
  return {
    path: relativePath,
    original,
    modified: content,
    changed: content !== original,
    safeChanges,
    reviewItems,
  };
}

// ==================== 主流程 ====================

const files = getAllFiles(APP_DIR);
console.log(`📁 扫描 ${files.length} 个文件...\n`);

const results = files.map(processFile);

// 统计
const changedFiles = results.filter(r => r.changed);
const reviewFiles = results.filter(r => r.reviewItems.length > 0);

let totalSafeChanges = 0;
let totalReviewItems = 0;

// ==================== 输出安全迁移 ====================

if (changedFiles.length > 0) {
  console.log('━'.repeat(60));
  console.log('✅ 安全迁移（可直接替换）');
  console.log('━'.repeat(60));
  
  for (const result of changedFiles) {
    console.log(`\n📄 ${result.path}`);
    for (const change of result.safeChanges) {
      console.log(`   ${change.pattern.replace(/\\b/g, '')} → ${change.replacement}`);
      console.log(`   (${change.count} 处) ${change.desc}`);
      totalSafeChanges += change.count;
    }
    
    // 执行写入
    if (!dryRun) {
      writeFileSync(join(process.cwd(), result.path), result.modified);
    }
  }
  
  console.log('');
}

// ==================== 输出需要审核的 ====================

if (reviewFiles.length > 0) {
  console.log('━'.repeat(60));
  console.log('⚠️  需要人工审核（未自动迁移）');
  console.log('━'.repeat(60));
  
  for (const result of reviewFiles) {
    console.log(`\n📄 ${result.path}`);
    for (const item of result.reviewItems) {
      console.log(`   ${item.pattern.replace(/\\b/g, '')} (${item.count} 处)`);
      console.log(`   └─ ${item.reason}`);
      if (verbose) {
        for (const loc of item.locations.slice(0, 3)) {
          console.log(`      L${loc.line}: ${loc.content}`);
        }
        if (item.locations.length > 3) {
          console.log(`      ... 还有 ${item.locations.length - 3} 处`);
        }
      }
      totalReviewItems += item.count;
    }
  }
  
  console.log('');
}

// ==================== 总结 ====================

console.log('━'.repeat(60));
console.log('📊 统计');
console.log('━'.repeat(60));
console.log(`安全迁移: ${changedFiles.length} 个文件, ${totalSafeChanges} 处修改`);
console.log(`需要审核: ${reviewFiles.length} 个文件, ${totalReviewItems} 处待处理`);
console.log('');

if (dryRun) {
  console.log('💡 这是预览模式，未实际修改文件');
  console.log('   添加 --execute 参数执行迁移');
} else {
  console.log('✅ 迁移完成！');
}

console.log('');
console.log('下一步:');
console.log(`1. 检查 TypeScript: npx tsc --noEmit --skipLibCheck 2>&1 | grep "apps/${targetApp}"`);
console.log(`2. 人工审核上述 ⚠️ 项目，决定是否迁移`);
console.log(`3. 运行 npm run dev 验证页面渲染`);
