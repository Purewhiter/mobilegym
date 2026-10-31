/**
 * useAppStrings — 通用 App i18n hook
 *
 * 用法:
 *   import { strings } from '../res/strings';
 *   import { stringsEn } from '../res/strings.en';
 *   const s = useAppStrings(strings, stringsEn);
 *   <span>{s.home}</span>  // 中文返回 '首页'，英文返回 'Home'
 */

import { type Locale, useLocale } from './locale';

// Merged tables per (base, en), so a locale's strings keep one identity across renders.
const mergedStrings = new WeakMap<object, WeakMap<object, Record<string, string>>>();

export function resolveAppStrings<T extends Record<string, string>>(
  base: T,
  en?: Partial<Record<keyof T, string>>,
  locale: Locale = 'zh-Hans',
): T {
  if (!en || locale === 'zh-Hans') return base;
  let byEn = mergedStrings.get(base);
  if (!byEn) mergedStrings.set(base, (byEn = new WeakMap()));
  let merged = byEn.get(en);
  if (!merged) byEn.set(en, (merged = { ...base, ...en } as Record<string, string>));
  return merged as T;
}

export function useAppStrings<T extends Record<string, string>>(
  base: T,
  en?: Partial<Record<keyof T, string>>,
  localeOverride?: Locale,
): T {
  const osLocale = useLocale();
  const locale = localeOverride ?? osLocale;
  return resolveAppStrings(base, en, locale);
}
