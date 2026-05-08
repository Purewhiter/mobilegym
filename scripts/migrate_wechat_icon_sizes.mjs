#!/usr/bin/env node
/**
 * 微信图标尺寸迁移脚本
 * 根据图标名称和尺寸值智能判断语义常量
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WECHAT_DIR = resolve(__dirname, '..', 'apps', 'Wechat');

// 语义映射规则：[图标名称模式, 尺寸值] -> dimens 常量
const MAPPING_RULES = [
  // Tab 图标
  { pattern: /IcTab\w+/, size: 24, dimens: 'icSizeTab' },
  
  // 导航返回
  { pattern: /IcNavBack/, size: 28, dimens: 'icSizeNav' },
  { pattern: /IcNavBack/, size: 24, dimens: 'icSizeTab' },
  
  // 关闭按钮
  { pattern: /IcClose/, size: 26, dimens: 'icSizeClose' },
  { pattern: /IcClose/, size: 28, dimens: 'icSizeCloseLg' },
  { pattern: /IcClose/, size: 16, dimens: 'icSizeChevronSm' },
  
  // 刷新按钮（相机视图）
  { pattern: /IcRefresh/, size: 28, dimens: 'icSizeCloseLg' },
  
  // 箭头 chevron
  { pattern: /IcNavForward|IcExpand|IcChevron/, size: 18, dimens: 'icSizeChevron' },
  { pattern: /IcNavForward|IcExpand|IcChevron/, size: 16, dimens: 'icSizeChevronSm' },
  { pattern: /IcNavForward|IcExpand|IcChevron/, size: 20, dimens: 'icSizeChevronLg' },
  { pattern: /IcExpand/, size: 28, dimens: 'icSizeNav' },
  
  // 心形 - 运动页面
  { pattern: /IcHeart/, size: 26, dimens: 'icSizeHeartLg' },
  { pattern: /IcHeart/, size: 20, dimens: 'icSizeHeartSm' },
  
  // 大型占位图标 (48px)
  { pattern: /.*/, size: 48, dimens: 'icSizePlaceholder' },
  
  // TopBar 主图标
  { pattern: /IcMessage|IcMore/, size: 24, dimens: 'icSizeTab' },
  
  // TopBar/Toolbar 操作图标
  { pattern: /IcSearch|IcAddCircle|IcCamera|IcScan|IcMenu/, size: 22, dimens: 'icSizeToolbar' },
  
  // 加号菜单图标
  { pattern: /IcMessageSquare|IcUserAdd|IcScan|IcQrCode/, size: 20, dimens: 'icSizePlusMenu' },
  
  // 服务网格图标
  { pattern: /IcScan|IcWallet/, size: 32, dimens: 'icSizeServiceGrid' },
  
  // 添加朋友列表项图标
  { pattern: /IcScan|IcSmartphone|IcRadio|IcContacts|IcFile|IcShoppingBag/, size: 24, dimens: 'icSizeListIcon' },
  
  // 大型添加按钮
  { pattern: /IcAdd/, size: 36, dimens: 'icSizeAddLarge' },
  { pattern: /IcAdd/, size: 28, dimens: 'icSizeNav' },
  { pattern: /IcAdd/, size: 13, dimens: 'icSizeWxidAdd' },
  
  // 相机图标 32px（用户朋友圈封面）
  { pattern: /IcCamera/, size: 32, dimens: 'icSizeServiceGrid' },
  
  // 勾选图标
  { pattern: /IcCheck/, size: 20, dimens: 'icSizeCheck' },
  { pattern: /IcCheck/, size: 16, dimens: 'icSizeChevronSm' },
  
  // 用户图标（小）
  { pattern: /IcUser/, size: 16, dimens: 'icSizeChevronSm' },
  
  // 搜索图标 16px
  { pattern: /IcSearch/, size: 16, dimens: 'icSizeChevronSm' },
  
  // 小型图标
  { pattern: /.*/, size: 18, dimens: 'icSizeAction' },
  { pattern: /.*/, size: 14, dimens: 'icSizeTiny' },
  { pattern: /.*/, size: 12, dimens: 'icSizeXs' },
  
  // 列表项图标
  { pattern: /.*/, size: 22, dimens: 'icSizeToolbar' },
  
  // 默认 20px
  { pattern: /.*/, size: 20, dimens: 'icSizeCheck' },
];

function findDimensConstant(iconName, sizeValue) {
  for (const rule of MAPPING_RULES) {
    if (rule.pattern.test(iconName) && rule.size === sizeValue) {
      return rule.dimens;
    }
  }
  return null;
}

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

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8');
  const original = content;
  let changes = 0;
  let needsDimensImport = false;
  
  // 匹配 <IcXxx size={数字} 或 size={数字} 在 <Ic 之后
  const regex = /<(Ic\w+)[^>]*\bsize=\{(\d+)\}/g;
  
  content = content.replace(regex, (match, iconName, sizeStr) => {
    const sizeValue = parseInt(sizeStr, 10);
    const dimensConst = findDimensConstant(iconName, sizeValue);
    
    if (dimensConst) {
      changes++;
      needsDimensImport = true;
      return match.replace(`size={${sizeStr}}`, `size={dimens.${dimensConst}}`);
    }
    return match;
  });
  
  // 处理动态图标 <item.icon size={数字}
  content = content.replace(/<(\w+\.icon)[^>]*\bsize=\{(\d+)\}/g, (match, iconExpr, sizeStr) => {
    const sizeValue = parseInt(sizeStr, 10);
    // 动态图标使用通用规则
    let dimensConst = null;
    if (sizeValue === 22) dimensConst = 'icSizeToolbar';
    else if (sizeValue === 48) dimensConst = 'icSizePlaceholder';
    else if (sizeValue === 18) dimensConst = 'icSizeAction';
    
    if (dimensConst) {
      changes++;
      needsDimensImport = true;
      return match.replace(`size={${sizeStr}}`, `size={dimens.${dimensConst}}`);
    }
    return match;
  });
  
  if (changes > 0) {
    // 添加 dimens import（如果没有）
    if (needsDimensImport && !content.includes("from '../res/dimens'") && !content.includes("from './res/dimens'")) {
      // 在第一个 import 后添加
      const importMatch = content.match(/^(import .+ from ['"][^'"]+['"];?\n)/m);
      if (importMatch) {
        const insertPos = importMatch.index + importMatch[0].length;
        const relativePath = filePath.includes('/pages/') ? '../../res/dimens' : '../res/dimens';
        // 检查是否有多层嵌套
        const depth = (filePath.split('/pages/')[1] || '').split('/').length - 1;
        const prefix = '../'.repeat(Math.max(1, depth + 1));
        content = content.slice(0, insertPos) + 
                  `import { dimens } from '${prefix}res/dimens';\n` + 
                  content.slice(insertPos);
      }
    }
    
    writeFileSync(filePath, content);
    console.log(`✓ ${filePath.replace(WECHAT_DIR + '/', '')}: ${changes} 处`);
    return changes;
  }
  
  return 0;
}

// 主函数
let totalChanges = 0;
let totalFiles = 0;

walkDir(WECHAT_DIR, (filePath) => {
  // 跳过 dimens.ts 本身
  if (filePath.endsWith('/res/dimens.ts')) return;
  
  const changes = processFile(filePath);
  if (changes > 0) {
    totalFiles++;
    totalChanges += changes;
  }
});

console.log(`\n━━━ 完成: ${totalFiles} 个文件, ${totalChanges} 处迁移 ━━━`);
