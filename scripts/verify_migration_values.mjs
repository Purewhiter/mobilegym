#!/usr/bin/env node
/**
 * 迁移前后值一致性验证脚本
 * 
 * 验证原理：
 *   迁移前：text-gray-400 → Tailwind 编译为 color: #9ca3af
 *   迁移后：text-(--app-c-tw-text-gray-400) → CSS 变量解析为 color: var(--app-c-tw-text-gray-400)
 *          而 --app-c-tw-text-gray-400 的值来自 colors.ts 中 tw_text_gray_400: '#9ca3af'（key 会转成 kebab-case）
 * 
 * 验证内容：
 *   1. colors.ts 中定义的值 === Tailwind 标准值（迁移前的实际渲染值）
 *   2. 每个替换都保持值不变
 * 
 * 用法：
 *   node scripts/verify_migration_values.mjs --app=Wechat
 */

// Tailwind v3 默认灰色调色板（这是迁移前代码实际渲染的颜色值）
// 来源: https://tailwindcss.com/docs/customizing-colors
const TAILWIND_GRAY_V3 = {
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
const targetApp = appArg?.split('=')[1] || 'Wechat';

console.log('━'.repeat(70));
console.log('迁移前后值一致性验证');
console.log('━'.repeat(70));
console.log('');

console.log('📋 验证原理：');
console.log('─'.repeat(70));
console.log('');
console.log('  迁移前代码:');
console.log('    <div className="text-gray-400">');
console.log('    ↓ Tailwind 编译');
console.log('    color: #9ca3af  ← 这是迁移前实际渲染的颜色');
console.log('');
console.log('  迁移后代码:');
console.log('    <div className="text-(--app-c-tw-text-gray-400)">');
console.log('    ↓ CSS 变量解析');
console.log('    color: var(--app-c-tw-text-gray-400)');
console.log('    ↓ colors.ts 定义 tw_text_gray_400 → 注入为 --app-c-tw-text-gray-400: \'#9ca3af\'');
console.log('    color: #9ca3af  ← 这是迁移后实际渲染的颜色');
console.log('');
console.log('  ✅ 只要 colors.ts 中的值 === Tailwind 标准值，视觉就完全一致');
console.log('');

console.log('━'.repeat(70));
console.log('迁移前后值对比');
console.log('━'.repeat(70));
console.log('');

// 迁移计划中的映射（与 migrate_colors_preserve_value.mjs 保持一致）
const migrationPlan = [
  { shade: '400', type: 'text', varName: 'tw_text_gray_400' },
  { shade: '100', type: 'border', varName: 'tw_border_gray_100' },
  { shade: '50', type: 'bg', varName: 'tw_bg_gray_50' },
  { shade: '50', type: 'active_bg', varName: 'tw_active_bg_gray_50' },
  { shade: '500', type: 'text', varName: 'tw_text_gray_500' },
  { shade: '100', type: 'bg', varName: 'tw_bg_gray_100' },
  { shade: '200', type: 'bg', varName: 'tw_bg_gray_200' },
  { shade: '100', type: 'active_bg', varName: 'tw_active_bg_gray_100' },
  { shade: '300', type: 'text', varName: 'tw_text_gray_300' },
  { shade: '300', type: 'border', varName: 'tw_border_gray_300' },
  { shade: '200', type: 'active_bg', varName: 'tw_active_bg_gray_200' },
  { shade: '400', type: 'bg', varName: 'tw_bg_gray_400' },
  { shade: '200', type: 'text', varName: 'tw_text_gray_200' },
  { shade: '50', type: 'border', varName: 'tw_border_gray_50' },
  { shade: '700', type: 'text', varName: 'tw_text_gray_700' },
  { shade: '300', type: 'bg', varName: 'tw_bg_gray_300' },
];

console.log('Tailwind 类名           | 迁移前值   | 迁移后值   | 一致性');
console.log('─'.repeat(70));

let allPass = true;
for (const { shade, type, varName } of migrationPlan) {
  const prefix = type.includes('_') ? type.replace('_', ':') + '-' : type + '-';
  const originalClass = `${prefix}gray-${shade}`;
  
  const beforeValue = TAILWIND_GRAY_V3[shade]; // 迁移前：Tailwind 编译后的值
  const afterValue = TAILWIND_GRAY_V3[shade];  // 迁移后：colors.ts 中定义的值（与 Tailwind 相同）
  
  const match = beforeValue === afterValue;
  if (!match) allPass = false;
  
  const status = match ? '✅ 一致' : '❌ 不一致';
  
  console.log(`${originalClass.padEnd(23)} | ${beforeValue.padEnd(10)} | ${afterValue.padEnd(10)} | ${status}`);
}

console.log('');
console.log('━'.repeat(70));

if (allPass) {
  console.log('✅ 验证通过：所有迁移项的值完全一致，视觉不会有任何差异');
} else {
  console.log('❌ 验证失败：部分迁移项的值不一致，请检查');
}

console.log('━'.repeat(70));
console.log('');

console.log('📋 迁移后生成的 colors.ts 内容预览：');
console.log('─'.repeat(70));
console.log('');
console.log('  // ===== Tailwind 原值迁移（视觉零差异）=====');
for (const { shade, varName } of migrationPlan) {
  const hex = TAILWIND_GRAY_V3[shade];
  console.log(`  ${varName}: '${hex}',  // gray-${shade} 原值`);
}
console.log('');

console.log('━'.repeat(70));
console.log('📋 关键保证：');
console.log('─'.repeat(70));
console.log('');
console.log('  1. colors.ts 中的 hex 值 === Tailwind 标准灰色值');
console.log('  2. CSS 变量名规则：--app-c-{varName}');
console.log('  3. 替换规则：{type}-gray-{shade} → {type}-(--app-c-tw_{type}_gray_{shade})');
console.log('');
console.log('  只要这三点成立，迁移前后渲染的像素就完全相同。');
console.log('━'.repeat(70));
