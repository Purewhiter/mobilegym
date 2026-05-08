#!/usr/bin/env node
/**
 * Build pinyin dictionaries from Rime dict files in all_dicts/
 * 
 * Output:
 * - public/ime/pinyin_dict.json   (large dict for runtime lazy loading)
 * - os/keyboard/pinyinData.ts     (small built-in dict for immediate use)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// Rime dict files to process
const DICT_FILES = {
  // 8105 common characters (sorted by frequency)
  chars: path.join(ROOT, 'all_dicts/cn_dicts/8105.dict.yaml'),
  // Base vocabulary (phrases)
  base: path.join(ROOT, 'all_dicts/cn_dicts/base.dict.yaml'),
};

/**
 * Parse a Rime dictionary YAML file
 * Format: word\tpinyin\tweight (tab-separated, after --- header)
 */
function parseRimeDict(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let inData = false;
  const entries = [];
  
  for (const line of lines) {
    // Skip until we hit the data section (after ---)
    if (line.trim() === '...') {
      inData = true;
      continue;
    }
    if (!inData) continue;
    
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Parse: word\tpinyin[\tweight]
    const parts = line.split('\t');
    if (parts.length < 2) continue;
    
    const word = parts[0].trim();
    const pinyin = parts[1].trim().replace(/\s+/g, ''); // Remove spaces between syllables
    const weight = parts[2] ? parseInt(parts[2], 10) : 0;
    
    // Skip if pinyin contains non-letter chars (special annotations)
    if (!/^[a-z]+$/.test(pinyin)) continue;
    
    entries.push({ word, pinyin, weight });
  }
  
  return entries;
}

/**
 * Build pinyin -> words mapping (sorted by weight)
 */
function buildPinyinToWords(entries, limit = 20) {
  const map = new Map();
  
  for (const { word, pinyin, weight } of entries) {
    if (!map.has(pinyin)) {
      map.set(pinyin, []);
    }
    map.get(pinyin).push({ word, weight });
  }
  
  // Sort by weight descending and limit
  const result = {};
  for (const [pinyin, items] of map) {
    items.sort((a, b) => b.weight - a.weight);
    result[pinyin] = items.slice(0, limit).map(x => x.word);
  }
  
  return result;
}

/**
 * Build pinyin -> single chars mapping (for segmentation fallback)
 */
function buildPinyinToChars(entries, limit = 15) {
  const map = new Map();
  
  for (const { word, pinyin, weight } of entries) {
    // Only single characters
    if ([...word].length !== 1) continue;
    
    if (!map.has(pinyin)) {
      map.set(pinyin, []);
    }
    map.get(pinyin).push({ char: word, weight });
  }
  
  // Sort by weight descending and limit
  const result = {};
  for (const [pinyin, items] of map) {
    items.sort((a, b) => b.weight - a.weight);
    result[pinyin] = items.slice(0, limit).map(x => x.char);
  }
  
  return result;
}

/**
 * Extract common phrases for built-in dict
 */
function extractCommonPhrases(entries, minWeight = 50000, limit = 300) {
  return entries
    .filter(e => e.weight >= minWeight && [...e.word].length >= 2)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
}

/**
 * Generate TypeScript code for pinyinData.ts
 */
function generatePinyinDataTs(phrases, chars) {
  // Group phrases by pinyin
  const phraseMap = {};
  for (const { word, pinyin } of phrases) {
    if (!phraseMap[pinyin]) phraseMap[pinyin] = [];
    if (!phraseMap[pinyin].includes(word)) {
      phraseMap[pinyin].push(word);
    }
  }
  
  // Limit chars to common syllables
  const commonChars = {};
  for (const [pinyin, charList] of Object.entries(chars)) {
    // Only include syllables that are commonly used
    if (charList.length > 0) {
      commonChars[pinyin] = charList.slice(0, 10); // Top 10 chars per syllable
    }
  }
  
  // Valid pinyin syllables
  const SYLLABLES = [
    'a', 'ai', 'an', 'ang', 'ao',
    'ba', 'bai', 'ban', 'bang', 'bao', 'bei', 'ben', 'beng', 'bi', 'bian', 'biao', 'bie', 'bin', 'bing', 'bo', 'bu',
    'ca', 'cai', 'can', 'cang', 'cao', 'ce', 'cen', 'ceng', 'cha', 'chai', 'chan', 'chang', 'chao', 'che', 'chen', 'cheng', 'chi', 'chong', 'chou', 'chu', 'chuan', 'chuang', 'chui', 'chun', 'chuo',
    'ci', 'cong', 'cou', 'cu', 'cuan', 'cui', 'cun', 'cuo',
    'da', 'dai', 'dan', 'dang', 'dao', 'de', 'dei', 'deng', 'di', 'dian', 'diao', 'die', 'ding', 'diu', 'dong', 'dou', 'du', 'duan', 'dui', 'dun', 'duo',
    'e', 'ei', 'en', 'eng', 'er',
    'fa', 'fan', 'fang', 'fei', 'fen', 'feng', 'fo', 'fou', 'fu',
    'ga', 'gai', 'gan', 'gang', 'gao', 'ge', 'gei', 'gen', 'geng', 'gong', 'gou', 'gu', 'gua', 'guai', 'guan', 'guang', 'gui', 'gun', 'guo',
    'ha', 'hai', 'han', 'hang', 'hao', 'he', 'hei', 'hen', 'heng', 'hong', 'hou', 'hu', 'hua', 'huai', 'huan', 'huang', 'hui', 'hun', 'huo',
    'ji', 'jia', 'jian', 'jiang', 'jiao', 'jie', 'jin', 'jing', 'jiong', 'jiu', 'ju', 'juan', 'jue', 'jun',
    'ka', 'kai', 'kan', 'kang', 'kao', 'ke', 'ken', 'keng', 'kong', 'kou', 'ku', 'kua', 'kuai', 'kuan', 'kuang', 'kui', 'kun', 'kuo',
    'la', 'lai', 'lan', 'lang', 'lao', 'le', 'lei', 'leng', 'li', 'lian', 'liang', 'liao', 'lie', 'lin', 'ling', 'liu', 'long', 'lou', 'lu', 'lv', 'luan', 'lue', 'lun', 'luo',
    'ma', 'mai', 'man', 'mang', 'mao', 'me', 'mei', 'men', 'meng', 'mi', 'mian', 'miao', 'mie', 'min', 'ming', 'miu', 'mo', 'mou', 'mu',
    'na', 'nai', 'nan', 'nang', 'nao', 'ne', 'nei', 'nen', 'neng', 'ni', 'nian', 'niang', 'niao', 'nie', 'nin', 'ning', 'niu', 'nong', 'nou', 'nu', 'nv', 'nuan', 'nue', 'nun', 'nuo',
    'o', 'ou',
    'pa', 'pai', 'pan', 'pang', 'pao', 'pei', 'pen', 'peng', 'pi', 'pian', 'piao', 'pie', 'pin', 'ping', 'po', 'pou', 'pu',
    'qi', 'qia', 'qian', 'qiang', 'qiao', 'qie', 'qin', 'qing', 'qiong', 'qiu', 'qu', 'quan', 'que', 'qun',
    'ran', 'rang', 'rao', 're', 'ren', 'reng', 'ri', 'rong', 'rou', 'ru', 'ruan', 'rui', 'run', 'ruo',
    'sa', 'sai', 'san', 'sang', 'sao', 'se', 'sen', 'seng', 'sha', 'shai', 'shan', 'shang', 'shao', 'she', 'shen', 'sheng', 'shi', 'shou', 'shu', 'shua', 'shuai', 'shuan', 'shuang', 'shui', 'shun', 'shuo',
    'si', 'song', 'sou', 'su', 'suan', 'sui', 'sun', 'suo',
    'ta', 'tai', 'tan', 'tang', 'tao', 'te', 'teng', 'ti', 'tian', 'tiao', 'tie', 'ting', 'tong', 'tou', 'tu', 'tuan', 'tui', 'tun', 'tuo',
    'wa', 'wai', 'wan', 'wang', 'wei', 'wen', 'weng', 'wo', 'wu',
    'xi', 'xia', 'xian', 'xiang', 'xiao', 'xie', 'xin', 'xing', 'xiong', 'xiu', 'xu', 'xuan', 'xue', 'xun',
    'ya', 'yan', 'yang', 'yao', 'ye', 'yi', 'yin', 'ying', 'yo', 'yong', 'you', 'yu', 'yuan', 'yue', 'yun',
    'za', 'zai', 'zan', 'zang', 'zao', 'ze', 'zei', 'zen', 'zeng', 'zha', 'zhai', 'zhan', 'zhang', 'zhao', 'zhe', 'zhen', 'zheng', 'zhi', 'zhong', 'zhou', 'zhu', 'zhua', 'zhuai', 'zhuan', 'zhuang', 'zhui', 'zhun', 'zhuo',
    'zi', 'zong', 'zou', 'zu', 'zuan', 'zui', 'zun', 'zuo',
  ];
  
  // Generate code
  return `/**
 * Built-in pinyin data for Chinese IME.
 * 
 * AUTO-GENERATED from all_dicts/ by scripts/ime/build_pinyin_dict.mjs
 * DO NOT EDIT MANUALLY
 * 
 * To regenerate: node scripts/ime/build_pinyin_dict.mjs
 */

export const PINYIN_PHRASES: Record<string, string[]> = ${JSON.stringify(phraseMap, null, 2)};

export const PINYIN_TO_HANZI: Record<string, string[]> = ${JSON.stringify(commonChars, null, 2)};

export const PINYIN_SYLLABLES: readonly string[] = ${JSON.stringify(SYLLABLES, null, 2)};
`;
}

// Main
async function main() {
  console.log('Building pinyin dictionaries...\n');
  
  // Check if dict files exist
  for (const [name, filePath] of Object.entries(DICT_FILES)) {
    if (!fs.existsSync(filePath)) {
      console.error(`Dict file not found: ${filePath}`);
      process.exit(1);
    }
  }
  
  // Parse character dict (8105)
  console.log('Parsing 8105.dict.yaml (characters)...');
  const charEntries = parseRimeDict(DICT_FILES.chars);
  console.log(`  Found ${charEntries.length} character entries`);
  
  // Parse base dict (phrases)
  console.log('Parsing base.dict.yaml (phrases)...');
  const baseEntries = parseRimeDict(DICT_FILES.base);
  console.log(`  Found ${baseEntries.length} phrase entries`);
  
  // Combine all entries
  const allEntries = [...charEntries, ...baseEntries];
  console.log(`  Total: ${allEntries.length} entries\n`);
  
  // Build pinyin -> words mapping for large dict
  console.log('Building pinyin_dict.json (large runtime dict)...');
  const pinyinToWords = buildPinyinToWords(allEntries, 20);
  const dictPath = path.join(ROOT, 'public/ime/pinyin_dict.json');
  fs.mkdirSync(path.dirname(dictPath), { recursive: true });
  fs.writeFileSync(dictPath, JSON.stringify(pinyinToWords));
  const dictSize = (fs.statSync(dictPath).size / 1024 / 1024).toFixed(2);
  console.log(`  Written to ${dictPath} (${dictSize} MB)`);
  console.log(`  Contains ${Object.keys(pinyinToWords).length} pinyin keys\n`);
  
  // Build pinyin -> chars mapping
  console.log('Building pinyinData.ts (built-in dict)...');
  const pinyinToChars = buildPinyinToChars(charEntries, 15);
  
  // Extract common phrases for built-in dict
  const commonPhrases = extractCommonPhrases(baseEntries, 100000, 200);
  console.log(`  Selected ${commonPhrases.length} common phrases`);
  
  // Generate TypeScript
  const tsCode = generatePinyinDataTs(commonPhrases, pinyinToChars);
  const tsPath = path.join(ROOT, 'os/keyboard/pinyinData.ts');
  fs.writeFileSync(tsPath, tsCode);
  console.log(`  Written to ${tsPath}\n`);
  
  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
