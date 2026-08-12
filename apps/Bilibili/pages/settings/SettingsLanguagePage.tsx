import React from 'react';
import { SettingLayout, SettingSection, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

// 语言名使用各语言自称（endonym），i18n 惯例不随界面语言翻译
const OPTIONS = [
  { id: 'zh', label: '简体中文' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
];

export const SettingsLanguagePage: React.FC = () => {
  const s = useBilibiliStrings();
  const value = useBilibiliStore((st) => st.settings.language) ?? 'zh';
  const setSetting = useBilibiliStore((st) => st.setSetting);

  return (
    <SettingLayout title={s.sl_title}>
      <SettingSection title={s.sl_sec} />
      <SettingRadioGroup
        options={OPTIONS}
        value={value}
        onChange={(id) => setSetting('language', id)}
      />
      <div className="h-8" />
    </SettingLayout>
  );
};
