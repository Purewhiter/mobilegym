/**
 * useRedBookStrings — RedBook 专用 i18n hook
 * 
 * 简化用法：
 *   import { useRedBookStrings } from '../hooks/useRedBookStrings';
 *   const t = useRedBookStrings();
 *   <span>{t.some_key}</span>
 */

import { resolveAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useLocale } from '../locale';

export function useRedBookStrings() {
  const locale = useLocale();
  return resolveAppStrings(strings, stringsEn, locale);
}

export type RedBookStringKey = keyof typeof strings;
