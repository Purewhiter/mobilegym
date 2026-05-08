#!/usr/bin/env node
/**
 * 解析反编译 APK 的 strings.xml，生成翻译辅助数据
 * 
 * 用法：
 *   node scripts/reverse/parse_apk_strings.mjs <apk_folder> [--output json|ts]
 *   node scripts/reverse/parse_apk_strings.mjs Weread_decompiled
 *   node scripts/reverse/parse_apk_strings.mjs Weread_decompiled --match bookshelf
 *   node scripts/reverse/parse_apk_strings.mjs Weread_decompiled --compare WechatReading
 * 
 * 功能：
 *   1. 解析 strings.xml 提取 key-value 映射
 *   2. 按前缀分组显示
 *   3. 与项目 strings.ts 对比，找出可参考的翻译
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// 解析 strings.xml
function parseStringsXml(xmlPath) {
  const content = fs.readFileSync(xmlPath, 'utf-8');
  const strings = new Map();
  
  // 匹配 <string name="key">value</string>
  const regex = /<string name="([^"]+)"[^>]*>([^<]*(?:<[^/][^<]*)*)<\/string>/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    let value = match[2]
      .replace(/\\n/g, '\n')
      .replace(/\\'/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
    
    // 只保留包含中文的字符串（业务相关）
    if (/[\u4e00-\u9fff]/.test(value)) {
      strings.set(key, value);
    }
  }
  
  return strings;
}

// 获取项目 strings.ts 的值
function getProjectStrings(appName) {
  const stringsPath = path.join(ROOT, 'apps', appName, 'res', 'strings.ts');
  if (!fs.existsSync(stringsPath)) return new Map();
  
  const content = fs.readFileSync(stringsPath, 'utf-8');
  const strings = new Map();
  
  const regex = /(\w+):\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    strings.set(match[1], match[2]);
  }
  
  return strings;
}

// 按前缀分组
function groupByPrefix(strings) {
  const groups = new Map();
  
  for (const [key, value] of strings) {
    const prefix = key.split('_')[0];
    if (!groups.has(prefix)) {
      groups.set(prefix, []);
    }
    groups.get(prefix).push({ key, value });
  }
  
  // 按组大小排序
  return new Map([...groups.entries()].sort((a, b) => b[1].length - a[1].length));
}

// 从 key 推导英文翻译建议
function suggestEnglish(key, value) {
  // 简单的 key 到英文的映射规则
  const words = key.split('_').filter(w => !['with', 'to', 'and', 'the', 'a', 'an'].includes(w.toLowerCase()));
  
  // 首字母大写
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  
  return words.map(capitalize).join(' ');
}

// Main
const args = process.argv.slice(2);

// 解析参数
function getArgValue(flag) {
  const eqArg = args.find(a => a.startsWith(`${flag}=`));
  if (eqArg) return eqArg.split('=')[1];
  
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('-')) {
    return args[idx + 1];
  }
  return null;
}

const apkFolder = args.find(a => !a.startsWith('-') && a !== getArgValue('--match') && a !== getArgValue('--compare'));
const matchFilter = getArgValue('--match');
const compareApp = getArgValue('--compare');
const outputFormat = args.includes('--json') ? 'json' : 'console';

if (!apkFolder) {
  console.log(`
用法: node scripts/reverse/parse_apk_strings.mjs <apk_folder> [选项]

选项:
  --match <prefix>     只显示匹配前缀的字符串
  --compare <AppName>  与项目 strings.ts 对比
  --json               输出 JSON 格式

示例:
  node scripts/reverse/parse_apk_strings.mjs Weread_decompiled
  node scripts/reverse/parse_apk_strings.mjs Weread_decompiled --match bookshelf
  node scripts/reverse/parse_apk_strings.mjs Weread_decompiled --compare WechatReading
`);
  process.exit(1);
}

const stringsXmlPath = path.join(ROOT, 'decompiled', apkFolder, 'res', 'values', 'strings.xml');

if (!fs.existsSync(stringsXmlPath)) {
  console.error(`错误: 找不到 ${stringsXmlPath}`);
  process.exit(1);
}

console.log(`\n📦 解析反编译资源: ${apkFolder}\n`);

const apkStrings = parseStringsXml(stringsXmlPath);
console.log(`📚 共解析 ${apkStrings.size} 个中文字符串\n`);

// 按前缀分组
const groups = groupByPrefix(apkStrings);

if (matchFilter) {
  // 过滤模式
  console.log(`🔍 匹配前缀: ${matchFilter}\n`);
  console.log('━'.repeat(80));
  
  for (const [key, value] of apkStrings) {
    if (key.toLowerCase().includes(matchFilter.toLowerCase())) {
      const suggestion = suggestEnglish(key, value);
      console.log(`${key}:`);
      console.log(`  中文: ${value}`);
      console.log(`  建议: ${suggestion}`);
      console.log();
    }
  }
} else if (compareApp) {
  // 对比模式
  const projectStrings = getProjectStrings(compareApp);
  console.log(`📊 对比 ${compareApp} strings.ts (${projectStrings.size} 个)\n`);
  
  // 按值匹配，找出可以参考的翻译
  const matchedByValue = [];
  const projectValues = new Map([...projectStrings].map(([k, v]) => [v, k]));
  
  for (const [apkKey, apkValue] of apkStrings) {
    if (projectValues.has(apkValue)) {
      matchedByValue.push({
        projectKey: projectValues.get(apkValue),
        apkKey,
        value: apkValue,
      });
    }
  }
  
  console.log(`✅ 值匹配: ${matchedByValue.length} 个字符串\n`);
  console.log('━'.repeat(80));
  console.log('可参考官方 key 命名:');
  console.log('━'.repeat(80));
  
  for (const m of matchedByValue.slice(0, 50)) {
    console.log(`  "${m.value}"`);
    console.log(`    项目 key: ${m.projectKey}`);
    console.log(`    官方 key: ${m.apkKey}`);
    console.log();
  }
  
  // 找出项目中没有但官方有的常用字符串
  console.log('\n' + '━'.repeat(80));
  console.log('📝 官方有但项目可能缺少的字符串 (按分组):');
  console.log('━'.repeat(80));
  
  const projectValuesSet = new Set(projectStrings.values());
  const missing = [];
  
  for (const [key, value] of apkStrings) {
    if (!projectValuesSet.has(value)) {
      missing.push({ key, value });
    }
  }
  
  // 按前缀分组显示
  const missingGroups = groupByPrefix(new Map(missing.map(m => [m.key, m.value])));
  
  for (const [prefix, items] of [...missingGroups].slice(0, 10)) {
    console.log(`\n[${prefix}] (${items.length} 个)`);
    for (const item of items.slice(0, 5)) {
      console.log(`  ${item.key}: "${item.value}"`);
    }
    if (items.length > 5) {
      console.log(`  ... 还有 ${items.length - 5} 个`);
    }
  }
  
} else {
  // 默认：显示分组统计
  console.log('📊 按前缀分组统计:');
  console.log('━'.repeat(80));
  
  let shown = 0;
  for (const [prefix, items] of groups) {
    if (shown >= 20) break;
    console.log(`  ${prefix.padEnd(25)} ${items.length.toString().padStart(4)} 个`);
    shown++;
  }
  
  if (groups.size > 20) {
    console.log(`  ... 还有 ${groups.size - 20} 个分组`);
  }
  
  console.log('\n提示: 使用 --match <prefix> 查看具体内容');
  console.log('      使用 --compare <AppName> 与项目对比');
}

console.log();
