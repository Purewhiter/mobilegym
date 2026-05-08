import React from 'react';
import { SettingLayout, SettingSection, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';

const OPTIONS = [
  { id: 'zh', label: '简体中文' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
];

export const SettingsLanguagePage: React.FC = () => {
  const value = useBilibiliStore((s) => s.settings.language) ?? 'zh';
  const setSetting = useBilibiliStore((s) => s.setSetting);

  return (
    <SettingLayout title="语言">
      <SettingSection title="App 语言" />
      <SettingRadioGroup
        options={OPTIONS}
        value={value}
        onChange={(id) => setSetting('language', id)}
      />
      <div className="h-8" />
    </SettingLayout>
  );
};
