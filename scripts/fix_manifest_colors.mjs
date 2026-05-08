#!/usr/bin/env node
/**
 * 修正 manifest.ts 中的 theme.colors，使其与实际代码一致
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.join(__dirname, '..', 'apps');

// Tailwind 颜色到 hex 的映射
const TW_TO_HEX = {
  'white': '#ffffff',
  'black': '#000000',
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-300': '#d1d5db',
  'gray-400': '#9ca3af',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  'neutral-100': '#f5f5f5',
  'neutral-200': '#e5e5e5',
  'neutral-400': '#a3a3a3',
  'neutral-500': '#737373',
  'neutral-600': '#525252',
  'neutral-700': '#404040',
  'neutral-800': '#262626',
  'neutral-900': '#171717',
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',
  'zinc-400': '#a1a1aa',
  'zinc-500': '#71717a',
  'zinc-800': '#27272a',
  'zinc-900': '#18181b',
};

// 深色文本的 Tailwind 类（用于 textPrimary）
const DARK_TEXT_CLASSES = ['gray-900', 'gray-800', 'gray-700', 'black', 'neutral-900', 'neutral-800', 'slate-900', 'slate-800', 'zinc-900', 'zinc-800'];
// 中等文本的 Tailwind 类（用于 textSecondary）
const MEDIUM_TEXT_CLASSES = ['gray-500', 'gray-400', 'gray-600', 'neutral-500', 'neutral-400', 'slate-500', 'slate-400', 'zinc-500', 'zinc-400'];
// 浅色背景的 Tailwind 类
const LIGHT_BG_CLASSES = ['white', 'gray-50', 'gray-100', 'neutral-50', 'neutral-100', 'slate-50', 'slate-100', 'zinc-50', 'zinc-100'];
// 边框颜色
const BORDER_CLASSES = ['gray-200', 'gray-100', 'gray-300', 'neutral-200', 'neutral-100', 'slate-200', 'slate-100', 'zinc-200'];

function getAllTsxFiles(dir) {
  const files = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d)) {
      const fp = path.join(d, f);
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) walk(fp);
      else if (f.endsWith('.tsx')) files.push(fp);
    }
  }
  walk(dir);
  return files;
}

function countColorUsage(files, prefix, colorList) {
  const counts = {};
  for (const c of colorList) counts[c] = 0;
  
  const patterns = colorList.map(c => new RegExp(`${prefix}-${c}(?![0-9])`, 'g'));
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    for (let i = 0; i < colorList.length; i++) {
      const matches = content.match(patterns[i]);
      if (matches) counts[colorList[i]] += matches.length;
    }
  }
  
  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
}

function analyzeApp(appDir) {
  const files = getAllTsxFiles(appDir);
  if (files.length === 0) return null;
  
  // 分析文本颜色使用
  const textUsage = countColorUsage(files, 'text', [...DARK_TEXT_CLASSES, ...MEDIUM_TEXT_CLASSES]);
  const bgUsage = countColorUsage(files, 'bg', LIGHT_BG_CLASSES);
  const borderUsage = countColorUsage(files, 'border', BORDER_CLASSES);
  
  // 找出最常用的深色文本（textPrimary）
  const darkTextUsage = textUsage.filter(([c]) => DARK_TEXT_CLASSES.includes(c));
  const mediumTextUsage = textUsage.filter(([c]) => MEDIUM_TEXT_CLASSES.includes(c));
  
  return {
    textPrimary: darkTextUsage[0]?.[0] || null,
    textSecondary: mediumTextUsage[0]?.[0] || null,
    background: bgUsage[0]?.[0] || null,
    border: borderUsage[0]?.[0] || null,
    stats: { darkTextUsage, mediumTextUsage, bgUsage, borderUsage }
  };
}

function updateManifest(manifestPath, updates) {
  let content = fs.readFileSync(manifestPath, 'utf-8');
  let modified = false;
  
  for (const [key, twColor] of Object.entries(updates)) {
    if (!twColor) continue;
    const hex = TW_TO_HEX[twColor];
    if (!hex) continue;
    
    // 匹配 key: '#xxxxxx' 或 key: "#xxxxxx"
    const regex = new RegExp(`(${key}:\\s*)(['"])#[0-9a-fA-F]{6}\\2`, 'g');
    const newContent = content.replace(regex, `$1'${hex}'`);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(manifestPath, content);
  }
  return modified;
}

// 深色主题应用（使用深色背景+白色文字）- 跳过这些应用的修正
const DARK_THEME_APPS = ['Spotify', 'X', 'Weather', 'Compass', 'Calculator'];

// 主流程
const apps = fs.readdirSync(APPS_DIR).filter(f => {
  const stat = fs.statSync(path.join(APPS_DIR, f));
  return stat.isDirectory() && fs.existsSync(path.join(APPS_DIR, f, 'manifest.ts'));
});

const dryRun = !process.argv.includes('--execute');
console.log(`模式: ${dryRun ? '预览' : '执行'}\n`);

let totalUpdates = 0;

for (const app of apps.sort()) {
  const appDir = path.join(APPS_DIR, app);
  const manifestPath = path.join(appDir, 'manifest.ts');
  
  // 跳过深色主题应用
  if (DARK_THEME_APPS.includes(app)) {
    continue;
  }
  
  const analysis = analyzeApp(appDir);
  if (!analysis) continue;
  
  const { textPrimary, textSecondary, background, border } = analysis;
  
  // 读取当前 manifest 的值
  const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
  const currentTextPrimary = manifestContent.match(/textPrimary:\s*['"]([^'"]+)['"]/)?.[1];
  const currentTextSecondary = manifestContent.match(/textSecondary:\s*['"]([^'"]+)['"]/)?.[1];
  const currentBackground = manifestContent.match(/background:\s*['"]([^'"]+)['"]/)?.[1];
  const currentBorder = manifestContent.match(/border:\s*['"]([^'"]+)['"]/)?.[1];
  
  const updates = {};
  const changes = [];
  
  if (textPrimary && currentTextPrimary && TW_TO_HEX[textPrimary] !== currentTextPrimary.toLowerCase()) {
    updates.textPrimary = textPrimary;
    changes.push(`textPrimary: ${currentTextPrimary} → ${TW_TO_HEX[textPrimary]} (${textPrimary})`);
  }
  if (textSecondary && currentTextSecondary && TW_TO_HEX[textSecondary] !== currentTextSecondary.toLowerCase()) {
    updates.textSecondary = textSecondary;
    changes.push(`textSecondary: ${currentTextSecondary} → ${TW_TO_HEX[textSecondary]} (${textSecondary})`);
  }
  if (background && currentBackground && TW_TO_HEX[background] !== currentBackground.toLowerCase()) {
    updates.background = background;
    changes.push(`background: ${currentBackground} → ${TW_TO_HEX[background]} (${background})`);
  }
  if (border && currentBorder && TW_TO_HEX[border] !== currentBorder.toLowerCase()) {
    updates.border = border;
    changes.push(`border: ${currentBorder} → ${TW_TO_HEX[border]} (${border})`);
  }
  
  if (changes.length > 0) {
    console.log(`### ${app}`);
    for (const c of changes) console.log(`  ${c}`);
    totalUpdates += changes.length;
    
    if (!dryRun) {
      updateManifest(manifestPath, updates);
    }
    console.log('');
  }
}

console.log(`\n总计: ${totalUpdates} 处修正${dryRun ? ' (预览)' : ' (已执行)'}`);
if (dryRun) {
  console.log('\n使用 --execute 参数执行修正');
}
