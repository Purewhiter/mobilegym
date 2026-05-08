#!/usr/bin/env node
/**
 * 自动迁移 Tailwind 类到 theme.colors CSS 变量
 * 保守策略：只替换最常见且安全的模式
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.join(__dirname, '..', 'apps');

// Tailwind 颜色到 hex 的映射
const TW_COLORS = {
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
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-200': '#e2e8f0',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'slate-800': '#1e293b',
  'slate-900': '#0f172a',
  'neutral-50': '#fafafa',
  'neutral-100': '#f5f5f5',
  'neutral-200': '#e5e5e5',
  'neutral-500': '#737373',
  'neutral-600': '#525252',
  'neutral-700': '#404040',
  'neutral-800': '#262626',
  'neutral-900': '#171717',
  'zinc-50': '#fafafa',
  'zinc-100': '#f4f4f5',
  'zinc-200': '#e4e4e7',
  'zinc-500': '#71717a',
  'zinc-600': '#52525b',
  'zinc-800': '#27272a',
  'zinc-900': '#18181b',
};

// 读取 manifest 中的 theme.colors
function getThemeColors(appDir) {
  const manifestPath = path.join(appDir, 'manifest.ts');
  if (!fs.existsSync(manifestPath)) return null;
  
  const content = fs.readFileSync(manifestPath, 'utf-8');
  const match = content.match(/colors:\s*{([^}]+)}/s);
  if (!match) return null;
  
  const colors = {};
  const regex = /(\w+):\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = regex.exec(match[1])) !== null) {
    colors[m[1]] = m[2].toLowerCase();
  }
  return colors;
}

// 找到匹配的 theme color
function findMatchingThemeColor(themeColors, hex) {
  hex = hex.toLowerCase();
  for (const [name, value] of Object.entries(themeColors)) {
    if (value === hex) return name;
  }
  return null;
}

// 生成替换规则
function generateRules(themeColors) {
  const rules = [];
  
  for (const [twColor, hex] of Object.entries(TW_COLORS)) {
    const themeName = findMatchingThemeColor(themeColors, hex);
    if (!themeName) continue;
    
    // 背景色替换
    if (themeName === 'background' || themeName === 'surface') {
      rules.push({ from: `bg-${twColor}`, to: `bg-app-${themeName}`, type: 'bg' });
    }
    
    // 文字颜色替换
    if (themeName === 'textPrimary' || themeName === 'textSecondary') {
      rules.push({ from: `text-${twColor}`, to: `text-app-${themeName}`, type: 'text' });
    }
    
    // 边框颜色替换
    if (themeName === 'border' || themeName === 'divider') {
      rules.push({ from: `border-${twColor}`, to: `border-app-${themeName}`, type: 'border' });
    }
  }
  
  return rules;
}

// 在文件中应用替换
function applyRules(filePath, rules, execute) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changes = [];
  
  for (const rule of rules) {
    // 匹配 className 中的使用（避免误替换其他地方）
    const patterns = [
      new RegExp(`(className="[^"]*\\b)${rule.from}(\\b[^"]*")`, 'g'),
      new RegExp(`(className={\`[^\`]*\\b)${rule.from}(\\b[^\`]*\`})`, 'g'),
      new RegExp(`(className={[^}]*['"][^'"]*\\b)${rule.from}(\\b[^'"]*['"][^}]*})`, 'g'),
    ];
    
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        changes.push({ rule, count: matches.length });
        if (execute) {
          content = content.replace(pattern, `$1${rule.to}$2`);
        }
      }
    }
  }
  
  if (execute && changes.length > 0) {
    fs.writeFileSync(filePath, content);
  }
  
  return changes;
}

// 递归查找 tsx 文件
function findTsxFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'res') {
      files.push(...findTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

// 主函数
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const targetApp = args.find(a => a.startsWith('--app='))?.split('=')[1];

console.log(`模式: ${execute ? '执行' : '预览'}`);
if (targetApp) console.log(`目标: ${targetApp}`);
console.log('');

const apps = targetApp 
  ? [targetApp]
  : fs.readdirSync(APPS_DIR).filter(f => fs.statSync(path.join(APPS_DIR, f)).isDirectory());

// 深色主题应用列表（仅供参考，不再跳过）
const DARK_THEME_APPS = ['Spotify', 'X', 'Weather', 'Compass', 'Calculator'];

let totalChanges = 0;

for (const app of apps) {
  
  const appDir = path.join(APPS_DIR, app);
  const themeColors = getThemeColors(appDir);
  if (!themeColors) continue;
  
  const rules = generateRules(themeColors);
  if (rules.length === 0) continue;
  
  const files = findTsxFiles(appDir);
  let appChanges = [];
  
  for (const file of files) {
    const changes = applyRules(file, rules, execute);
    if (changes.length > 0) {
      appChanges.push({ file: path.relative(appDir, file), changes });
    }
  }
  
  if (appChanges.length > 0) {
    console.log(`### ${app}`);
    console.log(`规则: ${rules.map(r => `${r.from} → ${r.to}`).join(', ')}`);
    for (const { file, changes } of appChanges) {
      const summary = changes.map(c => `${c.rule.from}→${c.rule.to}(${c.count})`).join(', ');
      console.log(`  ${file}: ${summary}`);
      totalChanges += changes.reduce((sum, c) => sum + c.count, 0);
    }
    console.log('');
  }
}

console.log(`总计: ${totalChanges} 处替换${execute ? ' (已执行)' : ' (预览，添加 --execute 执行)'}`);
