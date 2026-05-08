import { useSyncExternalStore } from 'react';
import BroadcastBus, { ACTION_LOCALE_CHANGED } from './BroadcastBus';
import { mutateOsState, useOsStateStore } from './OsStateStore';

export type Locale = 'zh-Hans' | 'en';

function normalizeLocale(raw: unknown): Locale {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s === 'en' || s.startsWith('en-') || s.startsWith('en_')) return 'en';
  return 'zh-Hans';
}

function emitLocaleChanged(locale: Locale) {
  BroadcastBus.sendBroadcast({
    action: ACTION_LOCALE_CHANGED,
    extras: { locale },
  });
}

export function getLocale(): Locale {
  return normalizeLocale(useOsStateStore.getState().settings.global.language);
}

export function subscribeLocale(listener: () => void): () => void {
  listener();
  return (useOsStateStore.subscribe as any)(
    (state: { settings: { global: { language: string } } }) => normalizeLocale(state.settings.global.language),
    () => listener(),
  );
}

export function setLocale(locale: Locale): void {
  const next = normalizeLocale(locale);
  if (next === getLocale()) return;
  mutateOsState((state) => {
    state.settings.global.language = next;
  });
}

export function useLocale(): Locale {
  return useSyncExternalStore(
    subscribeLocale,
    getLocale,
  );
}

const localeApi = {
  getLocale,
  setLocale,
  subscribe: subscribeLocale,
};

let lastLocale = getLocale();
;(useOsStateStore.subscribe as any)(
  (state: { settings: { global: { language: string } } }) => normalizeLocale(state.settings.global.language),
  (locale: Locale) => {
    if (locale === lastLocale) return;
    lastLocale = locale;
    emitLocaleChanged(locale);
  },
);

export default localeApi;
