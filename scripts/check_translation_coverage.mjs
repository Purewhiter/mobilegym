#!/usr/bin/env node
/**
 * 检查翻译覆盖率和质量
 * 
 * 用法：
 *   node scripts/check_translation_coverage.mjs <AppName>
 *   node scripts/check_translation_coverage.mjs Alipay
 *   node scripts/check_translation_coverage.mjs TencentMeeting
 *   node scripts/check_translation_coverage.mjs --all
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 解析 strings.ts 获取所有 key-value
function parseStrings(filePath) {
  if (!fs.existsSync(filePath)) return null;
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const strings = new Map();
  
  // 匹配 key: 'value' 或 key: "value"
  const regex = /^\s*(\w+):\s*['"]([^'"]*(?:\\.[^'"]*)*)['"]/gm;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const value = match[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
    strings.set(key, value);
  }
  
  return strings;
}

// 检查翻译质量问题
function checkTranslationIssues(zhStrings, enStrings) {
  const issues = [];
  
  for (const [key, zhValue] of zhStrings) {
    const enValue = enStrings.get(key);
    
    // 1. 未翻译
    if (!enValue) {
      issues.push({ type: 'missing', key, zhValue });
      continue;
    }
    
    // 2. 英文翻译和中文相同（可能是忘记翻译）
    if (enValue === zhValue && /[\u4e00-\u9fff]/.test(zhValue)) {
      issues.push({ type: 'same', key, zhValue, enValue });
      continue;
    }
    
    // 3. 英文中包含中文字符（翻译不完整）
    if (/[\u4e00-\u9fff]/.test(enValue)) {
      issues.push({ type: 'partial', key, zhValue, enValue });
      continue;
    }
    
    // 4. 占位符不匹配
    const zhPlaceholders = (zhValue.match(/%\d?\$?[sd]|%s|\{[\w]+\}/g) || []).sort().join(',');
    const enPlaceholders = (enValue.match(/%\d?\$?[sd]|%s|\{[\w]+\}/g) || []).sort().join(',');
    if (zhPlaceholders !== enPlaceholders) {
      issues.push({ type: 'placeholder', key, zhValue, enValue, zhPH: zhPlaceholders, enPH: enPlaceholders });
    }
  }
  
  return issues;
}

// 检查单个应用
function checkApp(appName) {
  const stringsPath = path.join(ROOT, 'apps', appName, 'res', 'strings.ts');
  const stringsEnPath = path.join(ROOT, 'apps', appName, 'res', 'strings.en.ts');
  
  const zhStrings = parseStrings(stringsPath);
  const enStrings = parseStrings(stringsEnPath);
  
  if (!zhStrings) {
    return { appName, error: '未找到 strings.ts' };
  }
  
  const result = {
    appName,
    totalKeys: zhStrings.size,
    translatedKeys: enStrings ? enStrings.size : 0,
    coverage: enStrings ? ((enStrings.size / zhStrings.size) * 100).toFixed(1) : 0,
    issues: enStrings ? checkTranslationIssues(zhStrings, enStrings) : [],
  };
  
  return result;
}

// 获取所有有 strings.ts 的应用
function getAllAppsWithStrings() {
  const appsDir = path.join(ROOT, 'apps');
  const apps = [];
  
  for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const stringsPath = path.join(appsDir, entry.name, 'res', 'strings.ts');
      if (fs.existsSync(stringsPath)) {
        apps.push(entry.name);
      }
    }
  }
  
  return apps.sort();
}

// Main
const args = process.argv.slice(2);
const checkAll = args.includes('--all');
const appName = args.find(a => !a.startsWith('-'));

console.log('\n📊 翻译覆盖率检测\n');

if (checkAll || !appName) {
  // 检查所有应用
  const apps = getAllAppsWithStrings();
  
  console.log('━'.repeat(80));
  console.log(`${'App'.padEnd(25)} ${'总数'.padStart(6)} ${'已翻译'.padStart(6)} ${'覆盖率'.padStart(8)} ${'问题'.padStart(6)}`);
  console.log('━'.repeat(80));
  
  let totalKeys = 0;
  let totalTranslated = 0;
  let totalIssues = 0;
  
  for (const app of apps) {
    const result = checkApp(app);
    if (result.error) {
      console.log(`${app.padEnd(25)} ${result.error}`);
    } else {
      const issueCount = result.issues.length;
      const coverageStr = result.coverage + '%';
      console.log(`${app.padEnd(25)} ${result.totalKeys.toString().padStart(6)} ${result.translatedKeys.toString().padStart(6)} ${coverageStr.padStart(8)} ${issueCount.toString().padStart(6)}`);
      
      totalKeys += result.totalKeys;
      totalTranslated += result.translatedKeys;
      totalIssues += issueCount;
    }
  }
  
  console.log('━'.repeat(80));
  const totalCoverage = totalKeys > 0 ? ((totalTranslated / totalKeys) * 100).toFixed(1) : 0;
  console.log(`${'总计'.padEnd(25)} ${totalKeys.toString().padStart(6)} ${totalTranslated.toString().padStart(6)} ${(totalCoverage + '%').padStart(8)} ${totalIssues.toString().padStart(6)}`);
  console.log();
  
} else {
  // 检查单个应用
  const result = checkApp(appName);
  
  if (result.error) {
    console.log(`❌ ${result.error}`);
    process.exit(1);
  }
  
  console.log(`📱 ${appName}`);
  console.log(`   总 key 数: ${result.totalKeys}`);
  console.log(`   已翻译数: ${result.translatedKeys}`);
  console.log(`   覆盖率: ${result.coverage}%`);
  console.log();
  
  if (result.issues.length === 0) {
    console.log('✅ 未发现翻译问题\n');
  } else {
    // 按类型分组显示问题
    const byType = {};
    for (const issue of result.issues) {
      if (!byType[issue.type]) byType[issue.type] = [];
      byType[issue.type].push(issue);
    }
    
    const typeLabels = {
      missing: '❌ 缺少翻译',
      same: '⚠️ 英文与中文相同',
      partial: '⚠️ 翻译不完整（含中文）',
      placeholder: '⚠️ 占位符不匹配',
    };
    
    for (const [type, issues] of Object.entries(byType)) {
      console.log(`${typeLabels[type]} (${issues.length} 个):`);
      console.log('━'.repeat(70));
      
      const limit = 10;
      for (const issue of issues.slice(0, limit)) {
        console.log(`  ${issue.key}:`);
        console.log(`    中: "${issue.zhValue}"`);
        if (issue.enValue) {
          console.log(`    英: "${issue.enValue}"`);
        }
        if (issue.zhPH || issue.enPH) {
          console.log(`    占位符: 中[${issue.zhPH}] 英[${issue.enPH}]`);
        }
      }
      
      if (issues.length > limit) {
        console.log(`  ... 还有 ${issues.length - limit} 个`);
      }
      console.log();
    }
  }
}
