import { useSyncExternalStore } from 'react';
import {
  type Locale,
  getLocale as getOsLocale,
  subscribeLocale as subscribeOsLocale,
} from '@/os/locale';
import { useMapStore } from './state';

export function resolveMapLocale(
  language: string | null | undefined,
  fallbackLocale: Locale = 'zh-Hans',
): Locale {
  if (language == null) return fallbackLocale;
  return language === 'en' ? 'en' : 'zh-Hans';
}

export function getLocale(): Locale {
  const language = useMapStore.getState().settings.appDisplay.language;
  return resolveMapLocale(language, getOsLocale());
}

export function subscribeLocale(listener: () => void): () => void {
  const unsubscribeMap = (useMapStore.subscribe as any)(
    (state: { settings: { appDisplay: { language: string | null } } }) => state.settings.appDisplay.language,
    () => listener(),
  );
  const unsubscribeOs = subscribeOsLocale(listener);
  return () => {
    unsubscribeMap();
    unsubscribeOs();
  };
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    subscribeLocale,
    getLocale,
    getLocale,
  );
}
