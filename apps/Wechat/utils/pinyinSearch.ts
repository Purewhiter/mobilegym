/**
 * 拼音搜索工具 — 支持汉字部分匹配、拼音首字母匹配、全拼匹配
 */
import { PINYIN_TO_HANZI } from '@/os/keyboard/pinyinData';
import type { ContactItem } from '../types';

// ---- 反向索引：汉字 → 拼音音节列表（懒初始化）----

let _hanziToPinyin: Map<string, string[]> | null = null;

function getHanziToPinyin(): Map<string, string[]> {
  if (_hanziToPinyin) return _hanziToPinyin;
  const map = new Map<string, string[]>();
  for (const [syllable, chars] of Object.entries(PINYIN_TO_HANZI)) {
    for (const ch of chars) {
      const existing = map.get(ch);
      if (existing) {
        if (!existing.includes(syllable)) existing.push(syllable);
      } else {
        map.set(ch, [syllable]);
      }
    }
  }
  _hanziToPinyin = map;
  return map;
}

/** 获取单个汉字的所有拼音音节 */
export function getCharPinyin(char: string): string[] {
  return getHanziToPinyin().get(char) ?? [];
}

/**
 * 获取名字所有可能的拼音首字母组合
 * 例如 "王芳" → ["wf"]（多音字时会有多个组合）
 */
export function getNamePinyinInitials(name: string): string[] {
  const chars = [...name];
  if (chars.length === 0) return [];

  // 每个字符的首字母候选列表
  let combinations: string[] = [''];
  for (const ch of chars) {
    const pinyins = getCharPinyin(ch);
    if (pinyins.length === 0) {
      // 非汉字字符，保留原字符小写
      combinations = combinations.map(c => c + ch.toLowerCase());
    } else {
      // 取每个拼音的首字母，去重
      const initials = [...new Set(pinyins.map(p => p[0]))];
      const next: string[] = [];
      for (const combo of combinations) {
        for (const initial of initials) {
          next.push(combo + initial);
        }
      }
      combinations = next;
      // 限制组合爆炸
      if (combinations.length > 32) combinations = combinations.slice(0, 32);
    }
  }
  return combinations;
}

/**
 * 获取名字所有可能的全拼组合
 * 例如 "王芳" → ["wangfang", "wangfāng", ...]（多音字产生多个）
 */
export function getNameFullPinyin(name: string): string[] {
  const chars = [...name];
  if (chars.length === 0) return [];

  let combinations: string[] = [''];
  for (const ch of chars) {
    const pinyins = getCharPinyin(ch);
    if (pinyins.length === 0) {
      combinations = combinations.map(c => c + ch.toLowerCase());
    } else {
      const next: string[] = [];
      for (const combo of combinations) {
        for (const py of pinyins) {
          next.push(combo + py);
        }
      }
      combinations = next;
      if (combinations.length > 64) combinations = combinations.slice(0, 64);
    }
  }
  return combinations;
}

/** 判断字符是否为汉字 */
function isChinese(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x4E00 && code <= 0x9FFF;
}

/** 判断字符串是否包含汉字 */
function containsChinese(s: string): boolean {
  return [...s].some(isChinese);
}

/**
 * 判断联系人是否匹配搜索词
 *
 * 匹配策略：
 * - 汉字查询：对 name 做子串匹配
 * - 纯拉丁字母查询：同时尝试拼音首字母前缀匹配和全拼前缀匹配
 * - 混合查询：两种策略都尝试
 */
export function matchContact(contact: ContactItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  const name = contact.name;

  // 1. 汉字子串匹配（对所有含汉字的查询）
  if (containsChinese(q)) {
    if (name.includes(q)) return true;
  }

  // 2. 纯拉丁或混合 — 也做 name 的 toLowerCase 包含检查
  if (name.toLowerCase().includes(q)) return true;

  // 3. 纯拉丁字母 — 拼音匹配
  if (/^[a-z]+$/.test(q)) {
    // 首字母前缀匹配
    const initials = getNamePinyinInitials(name);
    if (initials.some(ini => ini.startsWith(q))) return true;

    // 全拼前缀匹配
    const fullPinyins = getNameFullPinyin(name);
    if (fullPinyins.some(fp => fp.startsWith(q))) return true;
  }

  return false;
}
