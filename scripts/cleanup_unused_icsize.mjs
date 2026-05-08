#!/usr/bin/env node
/**
 * 清理未使用的 icSize 定义
 * 只保留 Wechat 和 WechatReading 的 icSize（它们实际在使用）
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.join(__dirname, '..', 'apps');

// 这些 app 的 icSize 实际被使用
const APPS_USING_ICSIZE = ['Wechat', 'WechatReading'];

const apps = fs.readdirSync(APPS_DIR).filter(f => {
  const dimensPath = path.join(APPS_DIR, f, 'res', 'dimens.ts');
  return fs.existsSync(dimensPath) && !APPS_USING_ICSIZE.includes(f);
});

let totalCleaned = 0;
let totalDeleted = 0;

for (const app of apps) {
  const dimensPath = path.join(APPS_DIR, app, 'res', 'dimens.ts');
  let content = fs.readFileSync(dimensPath, 'utf-8');
  
  // 移除 icSize 和 icStrokeWidth 行
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.match(/^icSize\w*:/) && !trimmed.match(/^icStrokeWidth:/);
  });
  
  const removed = lines.length - filteredLines.length;
  
  if (removed > 0) {
    content = filteredLines.join('\n');
    
    // 检查是否还有实际定义
    const hasContent = content.match(/^\s+\w+:\s*\d+/m);
    
    if (!hasContent) {
      // 文件只剩空壳，删除
      fs.unlinkSync(dimensPath);
      console.log(`${app}: 删除空文件 (移除 ${removed} 个 icSize)`);
      totalDeleted++;
    } else {
      fs.writeFileSync(dimensPath, content);
      console.log(`${app}: 移除 ${removed} 个 icSize`);
    }
    totalCleaned += removed;
  }
}

console.log(`\n总计: 清理 ${totalCleaned} 个 icSize 定义, 删除 ${totalDeleted} 个空文件`);
