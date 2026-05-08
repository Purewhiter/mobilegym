import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcCheck } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
type Lang = 'zh-CN' | 'zh-TW' | 'zh-HK' | 'en';

const LANG_OPTIONS: { id: Lang; label: string }[] = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'zh-TW', label: '繁体中文(台湾)' },
  { id: 'zh-HK', label: '繁体中文(香港)' },
  { id: 'en', label: 'English' },
];

export const LanguageSettingsPage: React.FC = () => {
  const language = useAlipayStore(s => s.language);
  const setLanguage = useAlipayStore(s => s.setLanguage);
  const { bindTap, bindBack, back } = useAlipayGestures();
  const s = useAlipayStrings();
  const [draft, setDraft] = React.useState<Lang>((language as Lang) || 'zh-CN');

  return (
    <div className="bg-app-surface h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.language_2}</span>
        <button
          className="text-app-primary text-base font-medium"
          {...bindTap<HTMLButtonElement>(
            { kind: 'action', id: 'language.save.submit' },
            {
              onTrigger: () => {
                setLanguage(draft);
                back();
              },
            },
          )}
        >
          {s.languagesettingspage_save}
        </button>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <div className="bg-app-surface">
          <button
            className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
            {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'language.select.zhCN' }, { onTrigger: () => setDraft('zh-CN') })}
          >
            <span className="text-base text-gray-800">{s.simplified_chinese}</span>
            {draft === 'zh-CN' && <IcCheck size={20} className="text-app-primary" strokeWidth={3} />}
          </button>
          <button
            className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
            {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'language.select.zhTW' }, { onTrigger: () => setDraft('zh-TW') })}
          >
            <span className="text-base text-gray-800">{s.traditional_chinese_tw}</span>
            {draft === 'zh-TW' && <IcCheck size={20} className="text-app-primary" strokeWidth={3} />}
          </button>
          <button
            className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
            {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'language.select.zhHK' }, { onTrigger: () => setDraft('zh-HK') })}
          >
            <span className="text-base text-gray-800">{s.traditional_chinese_hk}</span>
            {draft === 'zh-HK' && <IcCheck size={20} className="text-app-primary" strokeWidth={3} />}
          </button>
          <button
            className="w-full flex items-center justify-between px-4 py-4 border-b border-gray-100 active:bg-gray-50"
            {...bindTap<HTMLButtonElement>({ kind: 'action', id: 'language.select.en' }, { onTrigger: () => setDraft('en') })}
          >
            <span className="text-base text-gray-800">English</span>
            {draft === 'en' && <IcCheck size={20} className="text-app-primary" strokeWidth={3} />}
          </button>
        </div>
      </div>
    </div>
  );
};
