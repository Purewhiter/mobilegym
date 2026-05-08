/**
 * useAlipayStrings — Alipay 专用 i18n hook
 * 
 * 简化用法：
 *   import { useAlipayStrings } from '../hooks/useAlipayStrings';
 *   const t = useAlipayStrings();
 *   <span>{t.some_key}</span>
 */

import { resolveAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useLocale } from '../locale';

export function useAlipayStrings() {
  const locale = useLocale();
  return resolveAppStrings(strings, stringsEn, locale);
}

export type AlipayStringKey = keyof typeof strings;
