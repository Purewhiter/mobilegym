#!/usr/bin/env node
/**
 * 为应用创建专用 strings hook 并自动迁移所有组件
 * 
 * 用法：
 *   node scripts/create_app_strings_hook.mjs <AppName>
 *   node scripts/create_app_strings_hook.mjs Alipay
 *   node scripts/create_app_strings_hook.mjs TencentMeeting --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const appName = args.find(a => !a.startsWith('-'));

if (!appName) {
  console.log('用法: node scripts/create_app_strings_hook.mjs <AppName> [--dry-run]');
  process.exit(1);
}

const appDir = path.join(ROOT, 'apps', appName);
if (!fs.existsSync(appDir)) {
  console.log(`❌ 应用不存在: ${appName}`);
  process.exit(1);
}

// 检查 strings.ts 是否存在
const stringsPath = path.join(appDir, 'res', 'strings.ts');
const stringsEnPath = path.join(appDir, 'res', 'strings.en.ts');
if (!fs.existsSync(stringsPath)) {
  console.log(`❌ ${appName} 没有 res/strings.ts`);
  process.exit(1);
}

const hookName = `use${appName}Strings`;
const hookFileName = `${hookName}.ts`;
const hooksDir = path.join(appDir, 'hooks');
const hookPath = path.join(hooksDir, hookFileName);

console.log(`\n📱 ${appName} — 创建 ${hookName}\n`);
console.log(dryRun ? '🔍 DRY RUN 模式（不会实际修改文件）\n' : '');

// 1. 创建 hooks 目录（如果不存在）
if (!fs.existsSync(hooksDir)) {
  console.log(`📁 创建 hooks 目录`);
  if (!dryRun) fs.mkdirSync(hooksDir, { recursive: true });
}

// 2. 创建 hook 文件
const hasEnStrings = fs.existsSync(stringsEnPath);
const hookContent = `/**
 * ${hookName} — ${appName} 专用 i18n hook
 * 
 * 简化用法：
 *   import { ${hookName} } from '../hooks/${hookName}';
 *   const t = ${hookName}();
 *   <span>{t.some_key}</span>
 */

import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
${hasEnStrings ? "import { stringsEn } from '../res/strings.en';" : ''}

export function ${hookName}() {
  return useAppStrings(strings${hasEnStrings ? ', stringsEn' : ''});
}

export type ${appName}StringKey = keyof typeof strings;
`;

if (fs.existsSync(hookPath)) {
  console.log(`⚠️  ${hookFileName} 已存在，跳过创建`);
} else {
  console.log(`✅ 创建 hooks/${hookFileName}`);
  if (!dryRun) fs.writeFileSync(hookPath, hookContent);
}

// 3. 扫描并迁移所有使用 useAppStrings 的文件
function findTsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...findTsxFiles(fullPath));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = findTsxFiles(appDir);
let migratedCount = 0;

for (const file of files) {
  // 跳过 hook 文件本身
  if (file === hookPath) continue;
  
  let content = fs.readFileSync(file, 'utf-8');
  
  // 检查是否使用了 useAppStrings
  if (!content.includes('useAppStrings(strings')) continue;
  
  const relativePath = path.relative(appDir, file);
  const relHookImport = getRelativeImport(file, hookPath);
  
  let modified = content;
  
  // 替换 import 语句
  // 移除: import { useAppStrings } from '@/os/useAppStrings';
  modified = modified.replace(/import\s*{\s*useAppStrings\s*}\s*from\s*['"]@\/os\/useAppStrings['"];?\n?/g, '');
  
  // 移除: import { strings } from '../res/strings';
  modified = modified.replace(/import\s*{\s*strings\s*}\s*from\s*['"][^'"]*\/res\/strings['"];?\n?/g, '');
  
  // 移除: import { stringsEn } from '../res/strings.en';
  modified = modified.replace(/import\s*{\s*stringsEn\s*}\s*from\s*['"][^'"]*\/res\/strings\.en['"];?\n?/g, '');
  
  // 替换调用: useAppStrings(strings, stringsEn) 或 useAppStrings(strings)
  modified = modified.replace(/useAppStrings\(strings(?:,\s*stringsEn)?\)/g, `${hookName}()`);
  
  // 添加新的 import（在第一个 import 后面）
  const hookImportLine = `import { ${hookName} } from '${relHookImport}';\n`;
  
  // 如果已经有这个 import，跳过
  if (!modified.includes(hookName)) {
    // 找第一个 import 的位置
    const firstImportMatch = modified.match(/^import\s/m);
    if (firstImportMatch) {
      const idx = modified.indexOf(firstImportMatch[0]);
      // 在文件开头的 import 块之后插入
      const lines = modified.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ') || lines[i].match(/^import\s*{/)) {
          lastImportIdx = i;
        } else if (lastImportIdx >= 0 && !lines[i].trim().startsWith('//') && lines[i].trim() !== '') {
          break;
        }
      }
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, hookImportLine.trim());
        modified = lines.join('\n');
      }
    }
  }
  
  if (modified !== content) {
    console.log(`  ✏️  ${relativePath}`);
    if (!dryRun) fs.writeFileSync(file, modified);
    migratedCount++;
  }
}

console.log(`\n📊 结果: 迁移了 ${migratedCount} 个文件`);
if (dryRun) {
  console.log('\n💡 去掉 --dry-run 参数以实际执行迁移\n');
}

// 计算相对路径
function getRelativeImport(from, to) {
  let rel = path.relative(path.dirname(from), to);
  rel = rel.replace(/\.ts$/, '');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}
