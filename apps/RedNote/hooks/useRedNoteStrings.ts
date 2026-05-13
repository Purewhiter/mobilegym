/**
 * useRedNoteStrings — RedNote 专用 i18n hook
 * 
 * 简化用法：
 *   import { useRedNoteStrings } from '../hooks/useRedNoteStrings';
 *   const t = useRedNoteStrings();
 *   <span>{t.some_key}</span>
 */

import { resolveAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useLocale } from '../locale';

export function useRedNoteStrings() {
  const locale = useLocale();
  return resolveAppStrings(strings, stringsEn, locale);
}

export type RedNoteStringKey = keyof typeof strings;
