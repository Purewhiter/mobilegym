import { type Locale, useLocale as useOsLocale } from '@/os/locale';
import { useAlipayStore } from './state';

export function resolveAlipayLocale(language: string | null | undefined): Locale {
  return language === 'en' ? 'en' : 'zh-Hans';
}

export function useLocale(): Locale {
  const language = useAlipayStore((state) => state.language);
  const osLocale = useOsLocale();
  if (language == null) return osLocale;
  return resolveAlipayLocale(language);
}
