#!/usr/bin/env node
/**
 * 清理 colors.ts 中未使用的颜色定义
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.join(__dirname, '..', 'apps');

// 跳过这些已完成迁移的应用
const SKIP_APPS = ['Wechat', 'WechatReading'];

function findTsxFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'res') {
      files.push(...findTsxFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !entry.name.includes('colors')) {
      files.push(fullPath);
    }
  }
  return files;
}

function isColorUsed(appDir, colorName) {
  const files = findTsxFiles(appDir);
  // snake_case 转 kebab-case，已经是 kebab-case 的保持不变
  const kebabName = colorName.replace(/_/g, '-');
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    // CSS var: --app-c-{kebab-name}
    if (content.includes(`--app-c-${kebabName}`)) return true;
    // Direct ref: colors.{name} 或 colors['{name}']
    if (colorName.includes('-')) {
      if (content.includes(`colors['${colorName}']`) || content.includes(`colors["${colorName}"]`)) return true;
    } else {
      if (new RegExp(`colors\\.${colorName}\\b`).test(content)) return true;
    }
  }
  return false;
}

function cleanColorsFile(colorsPath, appDir) {
  if (!fs.existsSync(colorsPath)) return null;
  
  const content = fs.readFileSync(colorsPath, 'utf-8');
  const lines = content.split('\n');
  const newLines = [];
  let removed = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 检查是否是颜色定义行 (支持带引号和不带引号的 key)
    // 1. 无引号: bookshelf_bg: '#xxx'
    // 2. 单引号: 'tw-text-slate-800': '#xxx'
    // 3. 双引号: "tw-text-slate-800": '#xxx'
    const colorMatch = trimmed.match(/^(?:'([^']+)'|"([^"]+)"|(\w+)):\s*['"]#/);
    
    if (colorMatch) {
      const colorName = colorMatch[1] || colorMatch[2] || colorMatch[3];
      if (isColorUsed(appDir, colorName)) {
        newLines.push(line);
      } else {
        removed++;
        // 跳过这行
      }
    } else {
      newLines.push(line);
    }
  }
  
  // 清理连续的空行
  let result = newLines.join('\n');
  result = result.replace(/\n{3,}/g, '\n\n');
  
  return { content: result, removed };
}

const args = process.argv.slice(2);
const execute = args.includes('--execute');

console.log(`模式: ${execute ? '执行' : '预览 (添加 --execute 执行)'}\n`);

const apps = fs.readdirSync(APPS_DIR).filter(f => {
  return fs.statSync(path.join(APPS_DIR, f)).isDirectory();
});

let totalRemoved = 0;

for (const app of apps) {
  // 跳过已完成迁移的应用
  if (SKIP_APPS.includes(app)) continue;
  
  const colorsPath = path.join(APPS_DIR, app, 'res', 'colors.ts');
  if (!fs.existsSync(colorsPath)) continue;
  
  const result = cleanColorsFile(colorsPath, path.join(APPS_DIR, app));
  if (!result || result.removed === 0) continue;
  
  console.log(`${app}: 移除 ${result.removed} 个未使用颜色`);
  totalRemoved += result.removed;
  
  if (execute) {
    // 不删除文件，只写入清理后的内容（即使为空也保留文件结构）
    fs.writeFileSync(colorsPath, result.content);
  }
}

console.log(`\n总计: 移除 ${totalRemoved} 个颜色`);
console.log(`跳过应用: ${SKIP_APPS.join(', ')}`);
