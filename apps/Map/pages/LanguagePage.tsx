import React from 'react';
import {
  IcNavBack,
  IcCheck,
  IcGlobe,
} from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapStrings } from '../hooks/useMapStrings';
import { useMapStore } from '../state';
import { useLocale } from '../locale';
import { useLocale as useOsLocale } from '@/os/locale';

const SUGGESTED_LANGUAGES: { id: string | null; labelKey: 'language_system_default' | 'language_chinese' | 'language_english' }[] = [
  { id: null, labelKey: 'language_system_default' },
  { id: 'zh-Hans', labelKey: 'language_chinese' },
  { id: 'en', labelKey: 'language_english' },
];

const ALL_LANGUAGES = [
  { native: 'Afrikaans', zhLabel: '南非荷兰语', enLabel: 'Afrikaans' },
  { native: 'አማርኛ', zhLabel: '阿姆哈拉语', enLabel: 'Amharic' },
  { native: 'العربية', zhLabel: '阿拉伯语', enLabel: 'Arabic' },
  { native: 'azərbaycan', zhLabel: '阿塞拜疆语', enLabel: 'Azerbaijani' },
  { native: 'български', zhLabel: '保加利亚语', enLabel: 'Bulgarian' },
  { native: 'বাংলা', zhLabel: '孟加拉语', enLabel: 'Bengali' },
];

export const LanguagePage: React.FC = () => {
  const { bindBack, bindTap } = useMapGestures();
  const s = useMapStrings();
  const currentLanguage = useMapStore((state) => state.settings.appDisplay.language);
  const updateAppDisplay = useMapStore((state) => state.updateAppDisplay);
  const isEnglish = useLocale() === 'en';
  const osLocale = useOsLocale();
  const systemLanguageLabel = osLocale === 'en' ? s.language_english : s.language_chinese;

  const handleSelect = (id: string | null) => {
    updateAppDisplay('language', id);
  };

  return (
    <div className="font-sans flex flex-col h-full bg-app-surface">
      <div className="flex items-center gap-4 px-4 pb-4 pt-12 shadow-sm z-10 bg-app-surface border-b border-gray-100">
        <button {...bindBack()}>
          <IcNavBack size={24} className="text-gray-900" />
        </button>
        <div className="text-xl font-medium text-gray-900">{s.language_title}</div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4">
        <div className="py-4">
          <div className="text-sm font-medium text-app-text-muted mb-3">{s.language_suggested}</div>
          <div className="space-y-1">
            {SUGGESTED_LANGUAGES.map(({ id, labelKey }) => {
              const selected = currentLanguage === id;
              const sub = id === null ? systemLanguageLabel : undefined;
              return (
                <button
                  key={labelKey}
                  className="w-full flex items-center gap-3 py-3 px-1 rounded-lg"
                  {...(
                    id === null
                      ? bindTap<HTMLButtonElement>(
                          { kind: 'action', id: 'settings.appDisplay.language.select.system' },
                          { onTrigger: () => handleSelect(null) },
                        )
                      : id === 'zh-Hans'
                        ? bindTap<HTMLButtonElement>(
                            { kind: 'action', id: 'settings.appDisplay.language.select.zhHans' },
                            { onTrigger: () => handleSelect('zh-Hans') },
                          )
                        : bindTap<HTMLButtonElement>(
                            { kind: 'action', id: 'settings.appDisplay.language.select.en' },
                            { onTrigger: () => handleSelect('en') },
                          )
                  )}
                >
                  <div className="w-5 flex justify-center shrink-0">
                    {selected && <IcCheck size={20} className="text-app-primary" />}
                  </div>
                  <div className="text-left">
                    <div className="text-base font-medium text-gray-900">{s[labelKey]}</div>
                    {sub && <div className="text-sm text-app-text-muted">{sub}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-gray-100 my-4" />

        <div className="py-4">
          <div className="flex items-center gap-3 mb-4">
            <IcGlobe size={20} className="text-app-text-muted shrink-0" />
            <div className="text-sm font-medium text-app-text-muted">{s.language_all}</div>
          </div>
          <div className="pl-10 space-y-6">
            {ALL_LANGUAGES.map(({ native, zhLabel, enLabel }) => (
              <div key={native}>
                <div className="text-base font-medium text-gray-900">{native}</div>
                <div className="text-sm text-app-text-muted">{isEnglish ? enLabel : zhLabel}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LanguagePage;
