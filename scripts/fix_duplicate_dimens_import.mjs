#!/usr/bin/env node
/**
 * 修复重复的 dimens import
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WECHAT_DIR = resolve(__dirname, '..', 'apps', 'Wechat');

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      callback(filePath);
    }
  }
}

function fixFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // 找出所有 dimens import 行
  const dimensImportIndices = [];
  lines.forEach((line, idx) => {
    if (/import\s*\{\s*dimens\s*\}\s*from/.test(line)) {
      dimensImportIndices.push(idx);
    }
  });
  
  if (dimensImportIndices.length <= 1) return 0;
  
  // 保留第一个，删除其他的
  const toRemove = dimensImportIndices.slice(1).reverse();
  for (const idx of toRemove) {
    lines.splice(idx, 1);
  }
  
  writeFileSync(filePath, lines.join('\n'));
  console.log(`✓ ${filePath.replace(WECHAT_DIR + '/', '')}: 删除 ${toRemove.length} 个重复 import`);
  return toRemove.length;
}

let totalFixed = 0;
walkDir(WECHAT_DIR, (filePath) => {
  if (filePath.endsWith('/res/dimens.ts')) return;
  totalFixed += fixFile(filePath);
});

console.log(`\n━━━ 完成: 修复了 ${totalFixed} 处重复 import ━━━`);
