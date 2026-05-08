/**
 * 将 apps/X/data/repliesData.ts 转换为 replies.json
 *
 * repliesData.ts 是纯数据文件，仅有 TS 类型声明头，数据体为标准 JSON 对象字面量。
 * 本脚本：
 *   1. 读取 repliesData.ts 文本
 *   2. 剥离 import + export 声明包装
 *   3. JSON.parse 验证并重新序列化
 *   4. 写出 replies.json
 *
 * 运行：node scripts/convert_x_replies_to_json.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const inputPath  = join(root, 'apps/X/data/repliesData.ts');
const outputPath = join(root, 'apps/X/data/replies.json');

console.log('Reading repliesData.ts ...');
const raw = readFileSync(inputPath, 'utf-8');

// 逐行处理：
//   行1：import { XPost } from './xTypes';  → 删除
//   行2：空行                                → 删除
//   行3：export const MOCK_REPLIES: Record<string, XPost[]> = {  → 保留 "{"
//   最后一行：};  → 保留 "}"，去掉 ";"

const lines = raw.split('\n');

// 移除第 1 行（import）和第 2 行（空行），取从第 3 行开始的内容
const dataLines = lines.slice(2);

// 第 1 行（原第 3 行）移除声明前缀，只保留 "{"
dataLines[0] = dataLines[0].replace(/^export const MOCK_REPLIES: Record<string, XPost\[\]> = /, '');

// 最后一行可能是 "};" 或 "}" 后跟空行，移除尾部 ";"
for (let i = dataLines.length - 1; i >= 0; i--) {
  const trimmed = dataLines[i].trim();
  if (trimmed === '};') {
    dataLines[i] = '}';
    break;
  } else if (trimmed === '') {
    continue; // 跳过尾部空行
  } else {
    break;
  }
}

const jsonText = dataLines.join('\n');

console.log('Parsing JSON (this may take a moment for large data)...');
const data = JSON.parse(jsonText);

const keyCount = Object.keys(data).length;
console.log(`Parsed OK: ${keyCount} post reply threads`);

console.log('Writing replies.json ...');
writeFileSync(outputPath, JSON.stringify(data));

const statBytes = readFileSync(outputPath).length;
console.log(`Done: replies.json written (${(statBytes / 1024 / 1024).toFixed(1)} MB)`);
