#!/usr/bin/env node
/**
 * 修复 Bilibili 的 icon={短名称} 问题
 * 将 icon={Tv} 改为 icon={IcAnime}
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BILIBILI_DIR = resolve(__dirname, '..', 'apps', 'Bilibili');

const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

console.log(`模式: ${dryRun ? '预览 (添加 --execute 执行)' : '执行'}`);
console.log('');

// Lucide 短名称 -> Ic 名称的映射
const SHORT_TO_IC = {
  'Tv': 'IcAnime',
  'MonitorPlay': 'IcMonitorPlay',
  'Clapperboard': 'IcClapperboard',
  'Film': 'IcFilm',
  'Mic': 'IcMic',
  'Video': 'IcVideo',
  'Zap': 'IcLightning',
  'Music': 'IcMusic',
  'VenetianMask': 'IcMaskDance',
  'Palette': 'IcPainting',
  'Gamepad2': 'IcGaming',
  'Newspaper': 'IcNews',
  'GraduationCap': 'IcGraduationCap',
  'Cpu': 'IcAI',
  'Car': 'IcCar',
  'Shirt': 'IcSkin',
  'Home': 'IcHome',
  'Tent': 'IcOutdoor',
  'Dumbbell': 'IcFitness',
  'Trophy': 'IcTrophy',
  'Scissors': 'IcHandcraft',
  'Utensils': 'IcFood',
  'Plane': 'IcTravel',
  'Sprout': 'IcRural',
  'Cat': 'IcPets',
  'Baby': 'IcParenting',
  'HeartPulse': 'IcHeartPulse',
  'Heart': 'IcHeart',
  'Camera': 'IcCamera',
  'Coffee': 'IcLifestyle',
  'Wrench': 'IcLifeExp',
  'LayoutList': 'IcList',
  'TrendingUp': 'IcTrend',
  'Store': 'IcStore',
  'Ban': 'IcBan',
  'Download': 'IcDownload',
  'History': 'IcHistory',
  'Star': 'IcStar',
  'BookOpen': 'IcBookOpen',
  'Wallet': 'IcWallet',
  'Image': 'IcImage',
  'Flame': 'IcFlame',
  'Lightbulb': 'IcLightbulb',
  'MessageSquare': 'IcMessage',
  'BatteryCharging': 'IcBatteryCharge',
  'Ticket': 'IcTicket',
  'Calendar': 'IcCalendar',
  'Headphones': 'IcHeadphone',
  'Radio': 'IcRadio',
  'Shield': 'IcShield',
  'Settings': 'IcSettings',
  'ShoppingBag': 'IcShoppingBag',
};

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  for (const file of files) {
    const path = join(dir, file);
    const stat = statSync(path);
    if (stat.isDirectory() && file !== 'node_modules' && file !== 'res') {
      walkDir(path, callback);
    } else if (file.endsWith('.tsx')) {
      callback(path);
    }
  }
}

let totalFiles = 0;
let totalReplacements = 0;

walkDir(BILIBILI_DIR, (filePath) => {
  let content = readFileSync(filePath, 'utf-8');
  const originalContent = content;
  
  const relPath = filePath.replace(BILIBILI_DIR, 'Bilibili');
  const replacements = [];
  const neededIcons = new Set();
  
  // 替换 icon={短名称} 为 icon={Ic名称}
  for (const [shortName, icName] of Object.entries(SHORT_TO_IC)) {
    // icon={ShortName} 或 Icon={ShortName}
    const regex = new RegExp(`((?:icon|Icon)=\\{)${shortName}(\\})`, 'g');
    const matches = content.match(regex) || [];
    if (matches.length > 0) {
      content = content.replace(regex, `$1${icName}$2`);
      replacements.push(`${shortName} → ${icName}: ${matches.length} 处`);
      neededIcons.add(icName);
    }
  }
  
  if (replacements.length === 0) {
    return;
  }
  
  console.log(`\n=== ${relPath} ===`);
  replacements.forEach(r => console.log(`  ${r}`));
  
  // 更新 import 语句，确保需要的 Ic* 图标被导入
  const importMatch = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/res\/icons['"]/);
  if (importMatch) {
    const existingImports = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    const existingSet = new Set(existingImports);
    
    const missingImports = [...neededIcons].filter(ic => !existingSet.has(ic));
    if (missingImports.length > 0) {
      const newImports = [...existingImports, ...missingImports].sort();
      const newImportStr = newImports.join(', ');
      content = content.replace(
        /import\s*\{[^}]+\}\s*from\s*['"]\.\.\/res\/icons['"]/,
        `import { ${newImportStr} } from '../res/icons'`
      );
      console.log(`  + 添加 import: ${missingImports.join(', ')}`);
    }
  }
  
  if (content !== originalContent) {
    totalFiles++;
    totalReplacements += replacements.length;
    
    if (!dryRun) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`  ✅ 已保存`);
    }
  }
});

console.log('\n========== 统计 ==========');
console.log(`修改文件数: ${totalFiles}`);
console.log(`替换项数: ${totalReplacements}`);

if (dryRun && totalFiles > 0) {
  console.log('\n预览完成。添加 --execute 执行修改。');
}
