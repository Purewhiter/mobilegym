import { type Locale, useLocale as useOsLocale, getLocale as getOsLocale } from '@/os/locale';
import { useRedBookStore } from './state';

export function resolveRedBookLocale(language: string | null | undefined): Locale {
  return language === 'en-US' ? 'en' : 'zh-Hans';
}

export function useLocale(): Locale {
  const language = useRedBookStore((state) => state.settings.language);
  const osLocale = useOsLocale();
  if (language == null) return osLocale;
  return resolveRedBookLocale(language);
}

export function getRedBookLocale(): Locale {
  const language = useRedBookStore.getState().settings.language;
  if (language == null) return getOsLocale();
  return resolveRedBookLocale(language);
}
