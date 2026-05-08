import { type Locale, useLocale as useOsLocale } from '@/os/locale';
import { useBilibiliStore } from './state';

export function resolveBilibiliLocale(language: string | null | undefined): Locale {
  return language === 'en' ? 'en' : 'zh-Hans';
}

export function useLocale(): Locale {
  const language = useBilibiliStore((state) => state.settings.language);
  const osLocale = useOsLocale();
  if (language == null) return osLocale;
  return resolveBilibiliLocale(language);
}
