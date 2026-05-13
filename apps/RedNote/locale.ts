import { type Locale, useLocale as useOsLocale, getLocale as getOsLocale } from '@/os/locale';
import { useRedNoteStore } from './state';

export function resolveRedNoteLocale(language: string | null | undefined): Locale {
  return language === 'en-US' ? 'en' : 'zh-Hans';
}

export function useLocale(): Locale {
  const language = useRedNoteStore((state) => state.settings.language);
  const osLocale = useOsLocale();
  if (language == null) return osLocale;
  return resolveRedNoteLocale(language);
}

export function getRedNoteLocale(): Locale {
  const language = useRedNoteStore.getState().settings.language;
  if (language == null) return getOsLocale();
  return resolveRedNoteLocale(language);
}
