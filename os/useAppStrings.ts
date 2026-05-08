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

export function resolveAppStrings<T extends Record<string, string>>(
  base: T,
  en?: Partial<Record<keyof T, string>>,
  locale: Locale = 'zh-Hans',
): T {
  if (!en || locale === 'zh-Hans') return base;
  return { ...base, ...en } as T;
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
